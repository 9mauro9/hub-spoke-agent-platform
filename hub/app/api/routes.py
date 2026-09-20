"""
FastAPI route definitions for Master Platform Orchestrator (Hub).
Exposes REST and Server-Sent Events (SSE) endpoints on Google Cloud Run for
task dispatch, dynamic estimation, HITL approval, telemetry inspection, and FinOps governance.
Conforms strictly to AES v3 Standard.
"""

from __future__ import annotations
import os
import json
import asyncio
import uuid
from typing import Dict, Any, Optional, List, Literal
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from shared.contracts.task_models import AgentTaskRequest
from shared.contracts.dlq import DeadLetterQueueManager
from shared.security.perimeter import PerimeterSecurityManager, SecurityException
from shared.telemetry.finops import PreExecutionCostEstimator
from hub.app.state.firestore_manager import FirestoreStateManager
from hub.app.graph.workflow import HubOrchestrator

router = APIRouter()
perimeter_security = PerimeterSecurityManager()
dlq_manager = DeadLetterQueueManager()
firestore_manager = FirestoreStateManager()
orchestrator = HubOrchestrator(firestore_manager=firestore_manager)
cost_estimator = PreExecutionCostEstimator()

# In-memory platform settings for FinOps budget thresholds and emergency circuit breaker
platform_governance = {
    "monthly_budget_cap_usd": 50.0,
    "emergency_circuit_breaker_active": False,
    "halt_reason": None,
}


class ApprovalRequest(BaseModel):
    approver_id: str = Field(..., description="Operator or human ID granting sign-off")
    comments: Optional[str] = Field(default="Approved via HITL gateway")


class HitlDecisionRequest(BaseModel):
    action: Literal["approve", "reject", "feedback"] = Field(..., description="HITL action")
    approver_id: str = Field(default="operator", description="Operator identifier")
    comments: Optional[str] = Field(default=None, description="Approval or rejection notes")
    feedback: Optional[str] = Field(default=None, description="Corrective guidance for retry loop")


class EstimateRequest(BaseModel):
    target_spoke: str = Field(..., description="Target spoke worker ID")
    action: str = Field(..., description="Target action")
    target_files: List[str] = Field(default_factory=list, description="Target files")
    repository: Optional[str] = Field(default=".", description="Target repo path or URI")
    model_name: Optional[str] = Field(default="gemini-1.5-flash", description="Gemini model name")
    task_prompt_length: Optional[int] = Field(default=500, description="Estimated prompt characters")


class CircuitBreakerRequest(BaseModel):
    monthly_budget_cap_usd: Optional[float] = Field(default=None, ge=1.0)
    emergency_halt: Optional[bool] = Field(default=None)
    halt_reason: Optional[str] = Field(default=None)


# ---------------------------------------------------------------------------
# API v1: SPOKE REGISTRY & HEALTH
# ---------------------------------------------------------------------------

@router.get("/api/v1/spokes")
async def list_spokes():
    """
    Returns registered spokes with health status, supported actions, and parameter schemas.
    """
    spokes = [
        {
            "id": "spoke-housekeeper",
            "name": "Spoke Housekeeper",
            "description": "Baseline repository hygiene, markdown link & schema reference auditing, and Firestore rules & composite indexes verification.",
            "status": "Active",
            "version": "1.0.0",
            "mcp_endpoint": "http://spoke-housekeeper:8080/mcp",
            "actions": [
                {
                    "id": "clean_repo_noise",
                    "name": "Clean Repository Noise",
                    "description": "Scans and removes temporary cache files (.DS_Store, __pycache__, logs).",
                    "parameters": [
                        {"name": "repository", "type": "string", "required": True, "description": "Target repository path or name"},
                        {"name": "dry_run", "type": "boolean", "required": False, "default": False, "description": "Preview candidate files without deleting"}
                    ]
                },
                {
                    "id": "audit_markdown_and_schemas",
                    "name": "Audit Markdown & Schemas",
                    "description": "Scans markdown documentation for broken relative paths and invalid schema links.",
                    "parameters": [
                        {"name": "repository", "type": "string", "required": True, "description": "Target repository path"},
                        {"name": "schemas_dir", "type": "string", "required": False, "description": "Path to JSON schemas directory"}
                    ]
                },
                {
                    "id": "validate_firestore_rules_and_indexes",
                    "name": "Validate Firestore Security & Indexes",
                    "description": "Validates firestore.rules and firestore.indexes.json against schema queries.",
                    "parameters": [
                        {"name": "repository", "type": "string", "required": True, "description": "Target repository path"},
                        {"name": "rules_file", "type": "string", "required": False, "default": "firestore.rules", "description": "Firestore rules file"},
                        {"name": "indexes_file", "type": "string", "required": False, "default": "firestore.indexes.json", "description": "Firestore indexes file"}
                    ]
                }
            ],
            "allowed_sources": ["academy-apps", "avventiq", "core-hub"]
        },
        {
            "id": "spoke-video-ingest",
            "name": "Spoke Video Ingest",
            "description": "Multimodal video analysis agent for YouTube and GCS recordings. Generates architecture blueprints and API specifications.",
            "status": "Active",
            "version": "1.0.0",
            "mcp_endpoint": "http://spoke-video-ingest:8081/mcp",
            "actions": [
                {
                    "id": "parse_video_research",
                    "name": "Parse Video Architecture Research",
                    "description": "Extracts executive summaries, system diagrams, and transcribed API contracts from video.",
                    "parameters": [
                        {"name": "video_url", "type": "string", "required": True, "description": "YouTube URL (https://...) or Cloud Storage URI (gs://...)"},
                        {"name": "research_focus", "type": "string", "required": True, "description": "Architectural extraction focus or topic"},
                        {"name": "video_duration_seconds", "type": "integer", "required": False, "description": "Video duration in seconds for FinOps duration gate (>2700s requires HITL)"}
                    ]
                }
            ],
            "allowed_sources": ["academy-apps", "avventiq", "core-hub"]
        }
    ]
    return {"spokes": spokes, "total": len(spokes)}


# ---------------------------------------------------------------------------
# API v1: TASK PRE-EXECUTION ESTIMATE
# ---------------------------------------------------------------------------

@router.post("/api/v1/tasks/estimate")
async def estimate_task(req: EstimateRequest):
    """
    Computes upfront token consumption and financial cost projections before execution.
    """
    # Video duration cost calculation adjustment
    char_count = req.task_prompt_length
    if req.target_spoke == "spoke-video-ingest":
        char_count = max(char_count, 12000)

    estimate = cost_estimator.estimate_cost(
        target_files=req.target_files if req.target_files else ["virtual_manifest.json"],
        base_dir=req.repository if (req.repository and os.path.isdir(req.repository)) else None,
        model_name=req.model_name or "gemini-1.5-flash",
        task_prompt_length=char_count,
    )

    est_dict = estimate.model_dump()
    # Projected runtime heuristic based on tokens
    est_runtime_seconds = round(max(1.5, est_dict["estimated_total_tokens"] / 1200.0), 1)

    return {
        **est_dict,
        "estimated_runtime_seconds": est_runtime_seconds,
        "monthly_budget_cap_usd": platform_governance["monthly_budget_cap_usd"],
        "exceeds_threshold": est_dict["estimated_cost_usd"] > platform_governance["monthly_budget_cap_usd"],
        "emergency_circuit_breaker_active": platform_governance["emergency_circuit_breaker_active"],
    }


# ---------------------------------------------------------------------------
# API v1 & LEGACY: TASK DISPATCH
# ---------------------------------------------------------------------------

def _run_workflow_background(initial_state: Dict[str, Any]):
    try:
        orchestrator.run(initial_state)
    except Exception as e:
        firestore_manager.record_audit_log("WORKFLOW_BACKGROUND_EXCEPTION", {
            "session_id": initial_state.get("session_id"),
            "error": str(e)
        })


@router.post("/tasks/dispatch")
@router.post("/api/v1/tasks/dispatch")
async def dispatch_task(
    request_body: Dict[str, Any],
    background_tasks: BackgroundTasks,
    mode: str = Query(default="sync", description="'sync' for full execution or 'async' for background execution"),
):
    """
    Ingress point for task execution:
    1. Edge security & perimeter checks.
    2. Contract validation & DLQ isolation.
    3. LangGraph execution (sync or async).
    """
    if platform_governance["emergency_circuit_breaker_active"]:
        raise HTTPException(
            status_code=503,
            detail=f"Platform emergency circuit breaker active: {platform_governance.get('halt_reason') or 'Execution halted by operator'}"
        )

    # 1. Edge Security & Perimeter Sanitization
    try:
        sanitized_payload = perimeter_security.inspect_and_sanitize_payload(request_body)
    except SecurityException as se:
        dlq_manager.isolate_payload(
            raw_payload=request_body,
            error=se,
            source="cloud-armor-edge",
            trace_id=request_body.get("trace_id"),
        )
        raise HTTPException(status_code=400, detail=str(se))

    # 2. Strict Schema Validation & Dead-Letter Isolation
    req, dlq_record = dlq_manager.validate_and_parse_request(
        payload_dict=sanitized_payload, source="hub-rest-api"
    )
    if dlq_record is not None:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "Contract validation failure: quarantined to agent-dlq",
                "dlq_id": dlq_record["dlq_id"],
                "reason": dlq_record["error_message"],
            }
        )

    # 3. Prepare State
    initial_state = {
        "trace_id": req.trace_id,
        "session_id": req.session_id,
        "source_app": req.source_app,
        "target_spoke": req.target_spoke,
        "action": req.action,
        "payload": req.payload.model_dump(),
        "hitl_required": req.payload.context_metadata.get("hitl_required", False),
    }

    if mode == "async":
        # Launch in background and immediately return session info
        background_tasks.add_task(_run_workflow_background, initial_state)
        return {
            "session_id": req.session_id,
            "trace_id": req.trace_id,
            "status": "INITIALIZED",
            "stream_url": f"/api/v1/tasks/{req.session_id}/stream",
        }

    # Synchronous execution
    result = orchestrator.run(initial_state)
    return result


# ---------------------------------------------------------------------------
# API v1: SERVER-SENT EVENTS (SSE) STREAM
# ---------------------------------------------------------------------------

@router.get("/api/v1/tasks/{session_id}/stream")
async def stream_task_events(session_id: str):
    """
    Server-Sent Events (SSE) streaming real-time LangGraph state transitions and logs.
    """
    async def event_generator():
        event_queue = asyncio.Queue()

        def queue_listener(event):
            event_queue.put_nowait(event)

        # 1. Yield all historical events first
        history = orchestrator.get_event_history(session_id)
        for evt in history:
            yield f"data: {json.dumps(evt)}\n\n"

        # Check current state from Firestore
        current_state = firestore_manager.get_session_state(session_id)
        if current_state and current_state.get("status") in ["COMPLETED", "REJECTED", "PAB_VIOLATION"]:
            yield f"data: {json.dumps({'type': 'stream_end', 'status': current_state.get('status')})}\n\n"
            return

        # 2. Subscribe to live events
        orchestrator.add_listener(session_id, queue_listener)
        try:
            # Stream live events with timeout
            while True:
                try:
                    evt = await asyncio.wait_for(event_queue.get(), timeout=25.0)
                    yield f"data: {json.dumps(evt)}\n\n"

                    # Stop if terminal event reached
                    if evt.get("type") in ["workflow_complete", "task_rejected", "stream_end"] or evt.get("status") in ["completed", "rejected"]:
                        break
                except asyncio.TimeoutError:
                    # Heartbeat comment to keep HTTP connection alive
                    yield ": ping\n\n"
                    # Check if session completed in the meantime
                    st = firestore_manager.get_session_state(session_id)
                    if st and st.get("status") in ["COMPLETED", "REJECTED"]:
                        yield f"data: {json.dumps({'type': 'stream_end', 'status': st.get('status')})}\n\n"
                        break
        finally:
            orchestrator.remove_listener(session_id, queue_listener)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# API v1 & LEGACY: HITL GATE DECISION
# ---------------------------------------------------------------------------

@router.post("/api/v1/tasks/{session_id}/hitl")
async def handle_hitl_decision(session_id: str, body: HitlDecisionRequest):
    """
    Submits human approval, rejection, or steering comments for a paused workflow.
    """
    if body.action == "approve":
        resumed = orchestrator.resume_approved(session_id=session_id, approver_id=body.approver_id)
        if not resumed:
            raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found or not in paused state.")
        return resumed

    elif body.action == "feedback":
        guidance = body.feedback or body.comments or "Operator requested adjustments."
        resumed = orchestrator.resume_with_feedback(session_id=session_id, feedback=guidance, approver_id=body.approver_id)
        if not resumed:
            raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")
        return resumed

    elif body.action == "reject":
        reason = body.comments or "Rejected by human operator."
        rejected = orchestrator.reject(session_id=session_id, reason=reason, approver_id=body.approver_id)
        if not rejected:
            raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")
        return rejected

    else:
        raise HTTPException(status_code=400, detail=f"Unknown HITL action: {body.action}")


@router.post("/tasks/{session_id}/approve")
async def approve_task_legacy(session_id: str, body: ApprovalRequest):
    """
    Legacy approval endpoint for backwards compatibility.
    """
    resumed = orchestrator.resume_approved(session_id=session_id, approver_id=body.approver_id)
    if not resumed:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found or not in paused state.")
    return resumed


# ---------------------------------------------------------------------------
# API v1: FINOPS SUMMARY & GOVERNANCE
# ---------------------------------------------------------------------------

@router.get("/api/v1/finops/summary")
async def get_finops_summary():
    """
    Aggregates token spend, budget variance, domain breakdown, and recent telemetry from Firestore.
    """
    sessions = firestore_manager._memory_sessions
    telemetry = firestore_manager._memory_telemetry

    total_tokens = 0
    total_cost_usd = 0.0
    total_estimated_tokens = 0
    total_estimated_cost_usd = 0.0

    domain_breakdown = {
        "academy-apps": {"tokens": 0, "cost_usd": 0.0, "tasks": 0},
        "avventiq": {"tokens": 0, "cost_usd": 0.0, "tasks": 0},
        "core-hub": {"tokens": 0, "cost_usd": 0.0, "tasks": 0},
    }

    recent_telemetry = []

    for sid, telem in telemetry.items():
        sess = sessions.get(sid, {})
        source_app = sess.get("source_app", "core-hub")
        actual_tokens = telem.get("actual_tokens", 0)
        actual_cost = telem.get("actual_cost_usd", 0.0)
        est_tokens = telem.get("estimated_tokens", 0)
        est_cost = telem.get("estimated_cost_usd", 0.0)

        total_tokens += actual_tokens
        total_cost_usd += actual_cost
        total_estimated_tokens += est_tokens
        total_estimated_cost_usd += est_cost

        if source_app in domain_breakdown:
            domain_breakdown[source_app]["tokens"] += actual_tokens
            domain_breakdown[source_app]["cost_usd"] = round(domain_breakdown[source_app]["cost_usd"] + actual_cost, 6)
            domain_breakdown[source_app]["tasks"] += 1

        recent_telemetry.append({
            "session_id": sid,
            "spoke_id": telem.get("spoke_id", sess.get("target_spoke", "spoke-housekeeper")),
            "source_app": source_app,
            "action": sess.get("action", "unknown"),
            "actual_tokens": actual_tokens,
            "actual_cost_usd": actual_cost,
            "estimated_cost_usd": est_cost,
            "token_variance": telem.get("token_variance", 0),
            "cost_variance_usd": telem.get("cost_variance_usd", 0.0),
            "accuracy_percentage": telem.get("accuracy_percentage", 100.0),
            "duration_ms": telem.get("duration_ms", 0),
            "status": sess.get("status", "COMPLETED"),
            "timestamp": telem.get("recorded_at", sess.get("updated_at")),
        })

    total_cost_usd = round(total_cost_usd, 6)
    total_estimated_cost_usd = round(total_estimated_cost_usd, 6)
    variance_cost_usd = round(total_cost_usd - total_estimated_cost_usd, 6)

    # Sort recent telemetry by timestamp descending
    recent_telemetry.sort(key=lambda x: x.get("timestamp") or "", reverse=True)

    return {
        "total_tokens": total_tokens,
        "total_cost_usd": total_cost_usd,
        "total_estimated_cost_usd": total_estimated_cost_usd,
        "variance_cost_usd": variance_cost_usd,
        "monthly_budget_cap_usd": platform_governance["monthly_budget_cap_usd"],
        "budget_utilized_percentage": round((total_cost_usd / max(1.0, platform_governance["monthly_budget_cap_usd"])) * 100.0, 2),
        "emergency_circuit_breaker_active": platform_governance["emergency_circuit_breaker_active"],
        "halt_reason": platform_governance.get("halt_reason"),
        "domains": domain_breakdown,
        "recent_telemetry": recent_telemetry[:20],
        "total_sessions": len(sessions),
    }


@router.post("/api/v1/finops/circuit-breaker")
async def update_circuit_breaker(body: CircuitBreakerRequest):
    """
    Adjusts monthly spending limits or triggers an immediate platform-wide emergency halt.
    """
    if body.monthly_budget_cap_usd is not None:
        platform_governance["monthly_budget_cap_usd"] = body.monthly_budget_cap_usd

    if body.emergency_halt is not None:
        platform_governance["emergency_circuit_breaker_active"] = body.emergency_halt
        platform_governance["halt_reason"] = body.halt_reason or ("Manual emergency halt triggered by operator" if body.emergency_halt else None)
        firestore_manager.record_audit_log("CIRCUIT_BREAKER_TOGGLED", {
            "emergency_halt": body.emergency_halt,
            "reason": platform_governance["halt_reason"],
        })

    return {
        "status": "success",
        "monthly_budget_cap_usd": platform_governance["monthly_budget_cap_usd"],
        "emergency_circuit_breaker_active": platform_governance["emergency_circuit_breaker_active"],
        "halt_reason": platform_governance["halt_reason"],
    }


# ---------------------------------------------------------------------------
# API v1 & LEGACY: TASK STATE & TELEMETRY
# ---------------------------------------------------------------------------

@router.get("/tasks/{session_id}/state")
@router.get("/api/v1/tasks/{session_id}/state")
async def get_task_state(session_id: str):
    """
    Retrieves current state from Google Cloud Firestore.
    """
    state = firestore_manager.get_session_state(session_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")
    return state


@router.get("/tasks/{session_id}/telemetry")
@router.get("/api/v1/tasks/{session_id}/telemetry")
async def get_task_telemetry(session_id: str):
    """
    Retrieves reconciled FinOps telemetry from Firestore.
    """
    telem = firestore_manager.get_telemetry(session_id)
    if not telem:
        raise HTTPException(status_code=404, detail=f"Telemetry for session '{session_id}' not found.")
    return telem


@router.get("/health")
@router.get("/api/v1/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "master-orchestrator",
        "standard": "AES v3",
    }

