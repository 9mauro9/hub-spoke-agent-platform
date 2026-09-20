"""
LangGraph execution nodes for the Master Platform Orchestrator (AES v3 Standard).
"""

from __future__ import annotations
import os
import uuid
import logging
from typing import Dict, Any, Optional

from shared.contracts.task_models import AgentTaskRequest, AgentTaskResponse, TaskPayload
from shared.telemetry.otel import get_tracer
from shared.telemetry.finops import PreExecutionCostEstimator, FinOpsReconciler, CostEstimate
from shared.security.pab_policy import PrincipalAccessBoundaryManager, PABViolationException
from hub.app.state.state_schema import HubWorkflowState
from hub.app.state.firestore_manager import FirestoreStateManager
from spokes.housekeeper.app.main import SpokeHousekeeperWorker

logger = logging.getLogger("HubGraphNodes")
tracer = get_tracer("master-orchestrator")


def init_state_node(
    state: HubWorkflowState,
    firestore_manager: Optional[FirestoreStateManager] = None,
) -> HubWorkflowState:
    """
    Node 1: Initializes workflow state and loads any prior session context from Firestore.
    """
    session_id = state.get("session_id") or str(uuid.uuid4())
    trace_id = state.get("trace_id") or str(uuid.uuid4())
    
    fm = firestore_manager or FirestoreStateManager()
    prior_state = fm.get_session_state(session_id)
    
    new_state: HubWorkflowState = {
        **state,
        "session_id": session_id,
        "trace_id": trace_id,
        "retry_count": state.get("retry_count", 0),
        "retry_history": state.get("retry_history", []),
        "circuit_breaker_tripped": state.get("circuit_breaker_tripped", False),
        "hitl_required": state.get("hitl_required", False),
        "hitl_approved": state.get("hitl_approved", False),
        "status": "INITIALIZED",
    }
    
    # Merge prior state if resuming
    if prior_state:
        if prior_state.get("hitl_approved"):
            new_state["hitl_approved"] = True
            
    fm.save_session_state(session_id, new_state)
    logger.info(f"[init_state] Initialized session {session_id} (trace: {trace_id})")
    return new_state


def analyzer_agent_node(
    state: HubWorkflowState,
    pab_manager: Optional[PrincipalAccessBoundaryManager] = None,
) -> HubWorkflowState:
    """
    Node 2: Verifies Principal Access Boundary (PAB) and constructs task execution plan.
    """
    source_app = state.get("source_app", "core-hub")
    payload = state.get("payload", {})
    repo = payload.get("repository", "")
    target_files = payload.get("target_files", [])
    action = state.get("action", "")

    # Enforce PAB cross-tenant isolation
    pab = pab_manager or PrincipalAccessBoundaryManager()
    try:
        pab.validate_access(source_app=source_app, repository=repo)
    except PABViolationException as pe:
        logger.error(f"[PAB VIOLATION] {pe}")
        return {
            **state,
            "status": "PAB_VIOLATION",
            "error_message": str(pe),
        }

    plan = {
        "action": action,
        "repository": repo,
        "target_files_count": len(target_files),
        "target_files": target_files,
        "strategy": f"Execute action '{action}' on target '{repo}' with standard Spoke isolation.",
    }

    return {
        **state,
        "analysis_plan": plan,
        "status": "ANALYZED",
    }


def pre_execution_cost_estimator_node(
    state: HubWorkflowState,
    cost_estimator: Optional[PreExecutionCostEstimator] = None,
) -> HubWorkflowState:
    """
    Node 3: Computes pre-execution token budget and cost ceiling based on file metrics.
    """
    payload = state.get("payload", {})
    target_files = payload.get("target_files", [])
    repo = payload.get("repository", "")

    estimator = cost_estimator or PreExecutionCostEstimator()
    estimate = estimator.estimate_cost(
        target_files=target_files,
        base_dir=repo if os.path.isdir(repo) else None,
        model_name="gemini-1.5-flash",
    )

    logger.info(
        f"[FinOps Estimator] Projected tokens: {estimate.estimated_total_tokens} | "
        f"Cost ceiling: ${estimate.estimated_cost_usd:.6f} USD"
    )

    return {
        **state,
        "cost_estimate": estimate.model_dump(),
        "status": "ESTIMATED",
    }


def dispatch_task_node(
    state: HubWorkflowState,
    spoke_worker: Optional[Any] = None,
) -> HubWorkflowState:
    """
    Node 4: Dispatches validated task request to target Spoke.
    Dynamically resolves worker spoke based on target_spoke.
    """
    target_spoke = state.get("target_spoke", "spoke-housekeeper")
    if spoke_worker is not None:
        worker = spoke_worker
    elif target_spoke == "spoke-video-ingest":
        from spokes.video_ingest.app.main import SpokeVideoIngestWorker
        worker = SpokeVideoIngestWorker()
    else:
        worker = SpokeHousekeeperWorker()

    payload_data = state.get("payload", {})
    repo = payload_data.get("repository") or payload_data.get("storage_uri") or "video-stream"
    target_files = payload_data.get("target_files") or ["research_compilation.md"]

    task_req = AgentTaskRequest(
        trace_id=state["trace_id"],
        session_id=state["session_id"],
        source_app=state.get("source_app", "core-hub"),
        target_spoke=target_spoke,
        action=state.get("action", "clean_repo_noise"),
        payload=TaskPayload(
            repository=repo,
            branch=payload_data.get("branch", "main"),
            target_files=target_files,
            storage_uri=payload_data.get("storage_uri"),
            context_metadata={
                **(payload_data.get("context_metadata") or {}),
                "sliding_context_summary": state.get("sliding_context_summary"),
            },
        ),
    )

    # Invoke spoke worker
    response: AgentTaskResponse = worker.process_task(task_req.model_dump())

    return {
        **state,
        "task_dispatched": True,
        "spoke_response": response.model_dump(),
        "status": "DISPATCHED",
    }


def validation_node(state: HubWorkflowState) -> HubWorkflowState:
    """
    Node 5: Validates worker output.
    On failure: Applies sliding context window to summarize error diffs without exponential bloat.
    Binds retries to max 3 cycles.
    """
    resp_dict = state.get("spoke_response", {})
    status = resp_dict.get("status")
    result_payload = resp_dict.get("result_payload", {})
    error_logs = result_payload.get("error_logs")
    current_retries = state.get("retry_count", 0)
    history = list(state.get("retry_history", []))

    if status == "success" and not error_logs:
        return {
            **state,
            "validation_result": {"valid": True, "details": "Execution verified successfully."},
            "status": "VALIDATED",
        }

    # Failure / retry path: summarize error diff for next cycle
    compact_diff = f"[Cycle {current_retries + 1} Diff] Error: {error_logs or 'Spoke reported failure status'}"
    history.append(compact_diff)
    
    # Sliding window: keep only latest 2 diffs to prevent token explosion
    sliding_summary = "\n".join(history[-2:])
    next_retries = current_retries + 1
    circuit_tripped = next_retries >= 3

    logger.warning(
        f"[Validation Failure] Cycle {next_retries}/3. Compact Diff: {compact_diff}. "
        f"Circuit Breaker: {'TRIPPED' if circuit_tripped else 'OK'}"
    )

    return {
        **state,
        "validation_result": {"valid": False, "error": error_logs},
        "retry_count": next_retries,
        "retry_history": history,
        "sliding_context_summary": sliding_summary,
        "circuit_breaker_tripped": circuit_tripped,
        "hitl_required": circuit_tripped or state.get("hitl_required", False),
        "status": "CIRCUIT_BREAKER_TRIPPED" if circuit_tripped else "RETRY_REQUIRED",
    }


def hitl_approval_gate_node(state: HubWorkflowState) -> HubWorkflowState:
    """
    Node 6: Human-in-the-Loop Gate.
    Pauses execution for manual sign-off if required or if circuit breaker tripped.
    """
    hitl_required = state.get("hitl_required", False)
    hitl_approved = state.get("hitl_approved", False)

    if hitl_required and not hitl_approved:
        logger.info(f"[HITL GATE] Workflow PAUSED for Human Approval: session {state['session_id']}")
        return {
            **state,
            "status": "AWAITING_APPROVAL",
        }

    return {
        **state,
        "status": "APPROVED",
    }


def commit_telemetry_node(
    state: HubWorkflowState,
    firestore_manager: Optional[FirestoreStateManager] = None,
    finops_reconciler: Optional[FinOpsReconciler] = None,
) -> HubWorkflowState:
    """
    Node 7: Reconciles FinOps tokens against pre-execution estimates and commits state to Firestore.
    """
    fm = firestore_manager or FirestoreStateManager()
    reconciler = finops_reconciler or FinOpsReconciler()

    cost_est_data = state.get("cost_estimate")
    spoke_resp = state.get("spoke_response") or {}
    exec_metrics = spoke_resp.get("execution_metrics") or {"duration_ms": 0, "token_consumption": 0}

    reconciled_dict = None
    if cost_est_data:
        cost_est = CostEstimate.model_validate(cost_est_data)
        actual_tokens = exec_metrics.get("token_consumption", 0)
        duration_ms = exec_metrics.get("duration_ms", 0)

        usage = reconciler.reconcile(
            estimate=cost_est,
            actual_tokens=actual_tokens,
            duration_ms=duration_ms,
            trace_id=state["trace_id"],
            session_id=state["session_id"],
            spoke_id=state.get("target_spoke", "unknown-spoke"),
        )
        reconciled_dict = usage.model_dump()
        fm.record_telemetry(session_id=state["session_id"], telemetry_data=reconciled_dict)

    final_state: HubWorkflowState = {
        **state,
        "reconciled_usage": reconciled_dict,
        "status": "COMPLETED",
        "telemetry_committed": True,
    }

    fm.save_session_state(session_id=state["session_id"], state=final_state)
    logger.info(f"[commit_telemetry] Telemetry committed to Firestore for session {state['session_id']}")
    return final_state
