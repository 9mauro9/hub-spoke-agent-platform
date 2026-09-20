"""
FastAPI Microservice & Pub/Sub Push Subscriber for spoke-video-ingest.
Conforms to AES v3 Standard and Hub-and-Spoke Specification Version 1.0.
"""

from __future__ import annotations
import os
import time
import uuid
import logging
from typing import Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from shared.contracts.task_models import (
    AgentTaskRequest,
    AgentTaskResponse,
    ExecutionMetrics,
    ResultPayload,
)
from shared.contracts.dlq import DeadLetterQueueManager
from shared.telemetry.otel import get_tracer
from ..config.settings import settings
from .video_parser import VideoResearchParser
from .storage import ResearchStorageManager
from .mcp.server import VideoIngestMCPServer

logger = logging.getLogger("SpokeVideoIngestWorker")
tracer = get_tracer("spoke-video-ingest")


class SpokeVideoIngestWorker:
    """
    Worker engine processing multimodal YouTube video research tasks.
    """

    def __init__(self, dlq_manager: Optional[DeadLetterQueueManager] = None):
        self.spoke_id = settings.service_name
        self.dlq_manager = dlq_manager or DeadLetterQueueManager()
        self.parser = VideoResearchParser()
        self.storage = ResearchStorageManager()
        self.mcp_server = VideoIngestMCPServer()

    def process_task(self, raw_request: Dict[str, Any]) -> AgentTaskResponse:
        """
        Validates request against AgentTaskRequest, enforces duration gate,
        performs multimodal parsing, uploads to GCS, and returns AgentTaskResponse.
        """
        start_time = time.time()

        # Contract Validation & Dead-Letter Isolation
        req, dlq_record = self.dlq_manager.validate_and_parse_request(
            payload_dict=raw_request, source="spoke-video-ingest-worker"
        )
        if dlq_record is not None:
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
                    error_logs=f"Contract validation failure: Quarantined to DLQ. Error: {dlq_record['error_message']}",
                    details={"dlq_id": dlq_record["dlq_id"]},
                ),
            )

        # Execute inside OpenTelemetry Span
        with tracer.start_as_current_span(name=f"video_ingest.{req.action}", trace_id=req.trace_id) as span:
            span.set_attribute("target.spoke", self.spoke_id)
            span.set_attribute("task.action", req.action)

            # Resolve target video URI
            video_url = req.payload.storage_uri or req.payload.repository
            context = req.payload.context_metadata or {}
            research_focus = context.get("research_focus", "End-to-End System Architecture")
            hint_duration = context.get("video_duration_seconds")

            # FinOps Pre-Execution Duration Gate (>45 minutes = 2700s)
            dur_secs, exceeds_threshold = self.parser.inspect_video_duration(
                video_url=video_url, hint_duration_seconds=hint_duration
            )

            if exceeds_threshold:
                elapsed_ms = int((time.time() - start_time) * 1000)
                span.set_attribute("duration_gate.exceeded", True)
                logger.warning(
                    f"[FINOPS GATE] Video runtime ({dur_secs}s) exceeds 45-minute threshold. Requiring HITL gate approval."
                )
                return AgentTaskResponse(
                    trace_id=req.trace_id,
                    session_id=req.session_id,
                    spoke_id=self.spoke_id,
                    status="retry_required",
                    execution_metrics=ExecutionMetrics(
                        duration_ms=elapsed_ms,
                        token_consumption=50,
                    ),
                    result_payload=ResultPayload(
                        error_logs=(
                            f"Pre-execution Duration Gate: Video runtime ({dur_secs}s) exceeds 45-minute FinOps threshold "
                            f"(limit: {settings.max_video_duration_seconds}s). Requires Human-in-the-Loop approval gate sign-off."
                        ),
                        details={
                            "video_duration_seconds": dur_secs,
                            "threshold_seconds": settings.max_video_duration_seconds,
                            "gate_triggered": True,
                        },
                    ),
                )

            # Multimodal Video Extraction
            try:
                extraction = self.parser.parse_video(
                    youtube_url=video_url,
                    research_focus=research_focus,
                    session_id=req.session_id,
                    hint_duration_seconds=dur_secs,
                )

                # Cloud Storage Upload
                gcs_uri = self.storage.upload_compilation(
                    session_id=req.session_id,
                    markdown_content=extraction["markdown_content"],
                )

                elapsed_ms = int((time.time() - start_time) * 1000)

                return AgentTaskResponse(
                    trace_id=req.trace_id,
                    session_id=req.session_id,
                    spoke_id=self.spoke_id,
                    status="success",
                    execution_metrics=ExecutionMetrics(
                        duration_ms=elapsed_ms,
                        token_consumption=extraction["token_consumption"],
                    ),
                    result_payload=ResultPayload(
                        storage_uri=gcs_uri,
                        modified_files=[gcs_uri],
                        details={
                            "research_focus": research_focus,
                            "model_used": extraction["model_used"],
                            "storage_uri": gcs_uri,
                            "video_duration_seconds": dur_secs,
                        },
                    ),
                )

            except Exception as e:
                logger.error(f"Video extraction failed: {e}", exc_info=True)
                elapsed_ms = int((time.time() - start_time) * 1000)
                span.set_attribute("error", str(e))
                return AgentTaskResponse(
                    trace_id=req.trace_id,
                    session_id=req.session_id,
                    spoke_id=self.spoke_id,
                    status="failure",
                    execution_metrics=ExecutionMetrics(
                        duration_ms=elapsed_ms,
                        token_consumption=100,
                    ),
                    result_payload=ResultPayload(
                        error_logs=f"Multimodal video extraction failure: {str(e)}",
                        details={"exception_type": type(e).__name__},
                    ),
                )


# Global worker instance
worker = SpokeVideoIngestWorker()

# FastAPI Service Application
app = FastAPI(
    title="Spoke Video Ingest Service",
    description="Multimodal YouTube Research & Technical Extraction Spoke for AES v3 Platform",
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
    # Handle Pub/Sub push envelope if present
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
        "service": settings.service_name,
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
    port = int(os.getenv("PORT", settings.mcp_port))
    uvicorn.run("spokes.video_ingest.app.main:app", host="0.0.0.0", port=port, reload=False)

