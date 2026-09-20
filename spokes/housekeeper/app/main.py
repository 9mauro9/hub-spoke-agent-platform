"""
Spoke Housekeeper Service Entrypoint for Cloud Run.
Handles Pub/Sub task requests and direct dispatches adhering to AES v3 Standard.
"""

from __future__ import annotations
import time
import uuid
import logging
from typing import Dict, Any, Optional

from shared.contracts.task_models import AgentTaskRequest, AgentTaskResponse, ExecutionMetrics, ResultPayload
from shared.contracts.dlq import DeadLetterQueueManager
from shared.telemetry.otel import get_tracer
from spokes.housekeeper.app.mcp.server import HousekeeperMCPServer
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware


logger = logging.getLogger("SpokeHousekeeper")
tracer = get_tracer("spoke-housekeeper")


class SpokeHousekeeperWorker:
    def __init__(self, dlq_manager: Optional[DeadLetterQueueManager] = None):
        self.spoke_id = "spoke-housekeeper"
        self.dlq_manager = dlq_manager or DeadLetterQueueManager()
        self.mcp_server = HousekeeperMCPServer()

    def process_task(self, raw_request: Dict[str, Any]) -> AgentTaskResponse:
        """
        Validates request, isolates poison pills, executes action, and returns AgentTaskResponse.
        """
        start_time = time.time()

        # Contract Validation & Poison-Pill Isolation
        req, dlq_record = self.dlq_manager.validate_and_parse_request(
            payload_dict=raw_request, source="spoke-housekeeper-worker"
        )
        if dlq_record is not None:
            # Poison pill quarantined
            elapsed_ms = int((time.time() - start_time) * 1000)
            resp_trace = dlq_record["trace_id"]
            try:
                uuid.UUID(resp_trace)
            except ValueError:
                resp_trace = str(uuid.uuid4())

            return AgentTaskResponse(
                trace_id=resp_trace,
                session_id=raw_request.get("session_id", "quarantined"),
                spoke_id=self.spoke_id,
                status="failure",
                execution_metrics=ExecutionMetrics(
                    duration_ms=elapsed_ms,
                    token_consumption=0,
                ),
                result_payload=ResultPayload(
                    error_logs=f"Contract validation failure: Payload quarantined to DLQ. Error: {dlq_record['error_message']}",
                    details={"dlq_id": dlq_record["dlq_id"]},
                ),
            )

        # Valid Request: Execute inside OpenTelemetry Span
        with tracer.start_as_current_span(name=f"housekeeper.{req.action}", trace_id=req.trace_id) as span:
            span.set_attribute("target.repository", req.payload.repository)
            span.set_attribute("target.files_count", len(req.payload.target_files))

            action = req.action
            repo = req.payload.repository
            target_files = req.payload.target_files
            context = req.payload.context_metadata or {}

            token_consumption = 0
            modified_files = []
            error_logs = None
            status = "success"
            details = {}

            try:
                if action == "clean_repo_noise":
                    dry_run = context.get("dry_run", False)
                    res = self.mcp_server.call_tool(
                        "clean_repo_noise", {"repository_path": repo, "dry_run": dry_run}
                    )
                    raw = res.get("raw_result", {})
                    modified_files = raw.get("deleted_files", [])
                    details = raw
                    token_consumption = 120 + len(modified_files) * 15

                elif action == "audit_markdown_and_schemas":
                    schemas_dir = context.get("schemas_dir")
                    res = self.mcp_server.call_tool(
                        "audit_markdown_and_schemas",
                        {"repository_path": repo, "schemas_dir": schemas_dir}
                    )
                    raw = res.get("raw_result", {})
                    details = raw
                    token_consumption = 250 + raw.get("scanned_markdown_files_count", 0) * 80
                    if raw.get("broken_links_count", 0) > 0 or raw.get("broken_schema_refs_count", 0) > 0:
                        error_logs = f"Found {raw.get('broken_links_count')} broken links and {raw.get('broken_schema_refs_count')} broken schema references."

                elif action == "validate_firestore_rules_and_indexes":
                    rules_file = context.get("rules_file", "firestore.rules")
                    indexes_file = context.get("indexes_file", "firestore.indexes.json")
                    res = self.mcp_server.call_tool(
                        "validate_firestore_rules_and_indexes",
                        {"repository_path": repo, "rules_file": rules_file, "indexes_file": indexes_file}
                    )
                    raw = res.get("raw_result", {})
                    details = raw
                    token_consumption = 300
                    if not raw.get("valid", True):
                        error_logs = f"Firestore security warnings found: {len(raw.get('security_warnings', []))}"

                else:
                    status = "failure"
                    error_logs = f"Unknown action: {action}"
                    token_consumption = 50

            except Exception as exc:
                status = "failure"
                error_logs = f"Spoke execution error: {str(exc)}"
                span.set_attribute("error", str(exc))

            duration_ms = int((time.time() - start_time) * 1000)

            return AgentTaskResponse(
                trace_id=req.trace_id,
                session_id=req.session_id,
                spoke_id=self.spoke_id,
                status=status,
                execution_metrics=ExecutionMetrics(
                    duration_ms=duration_ms,
                    token_consumption=token_consumption,
                ),
                result_payload=ResultPayload(
                    modified_files=modified_files,
                    storage_uri=req.payload.storage_uri,
                    error_logs=error_logs,
                    details=details,
                ),
            )


# Default worker instance
worker = SpokeHousekeeperWorker()

# FastAPI Service Application for Cloud Run & Pub/Sub push
app = FastAPI(
    title="Spoke Housekeeper Service",
    description="Repository Hygiene, Markdown Auditing & Firestore Security Auditor for AES v3 Platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/tasks/execute")
async def execute_task(request: Request):
    """
    Pub/Sub Push and REST Dispatch endpoint.
    """
    body = await request.json()
    if "message" in body and "data" in body["message"]:
        import base64
        import json
        decoded_bytes = base64.b64decode(body["message"]["data"])
        task_data = json.loads(decoded_bytes.decode("utf-8"))
    else:
        task_data = body

    response = worker.process_task(task_data)
    return response.model_dump()


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "spoke-housekeeper",
        "standard": "AES v3",
    }


@app.post("/mcp")
async def mcp_endpoint(request: Request):
    """
    Model Context Protocol JSON-RPC endpoint.
    """
    raw_body = await request.body()
    rpc_response = worker.mcp_server.handle_json_rpc(raw_body.decode("utf-8"))
    import json
    return json.loads(rpc_response)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8080))
    uvicorn.run("spokes.housekeeper.app.main:app", host="0.0.0.0", port=port, reload=False)

