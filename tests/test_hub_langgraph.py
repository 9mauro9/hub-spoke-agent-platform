"""
Unit tests for Deliverable 2.2: Master Orchestrator (The Hub) with LangGraph & FinOps Guardrails.
"""

import uuid
import pytest
from hub.app.state.firestore_manager import FirestoreStateManager
from hub.app.graph.workflow import HubOrchestrator
from hub.app.graph.nodes import validation_node
from hub.app.state.state_schema import HubWorkflowState

MOCK_REPO = "tests/mock_target_repo"


def test_hub_orchestrator_success_flow():
    fm = FirestoreStateManager(force_in_memory=True)
    orchestrator = HubOrchestrator(firestore_manager=fm)

    session_id = f"test-sess-{uuid.uuid4()}"
    trace_id = str(uuid.uuid4())

    initial_state: HubWorkflowState = {
        "trace_id": trace_id,
        "session_id": session_id,
        "source_app": "core-hub",
        "target_spoke": "spoke-housekeeper",
        "action": "clean_repo_noise",
        "payload": {
            "repository": MOCK_REPO,
            "target_files": ["README.md"],
            "context_metadata": {"dry_run": True},
        },
        "hitl_required": False,
    }

    final_state = orchestrator.run(initial_state)

    # Verify flow state transitions
    assert final_state["status"] == "COMPLETED"
    assert final_state["task_dispatched"] is True
    assert final_state["telemetry_committed"] is True

    # Verify FinOps Pre-Execution Cost Estimator
    cost_est = final_state.get("cost_estimate")
    assert cost_est is not None
    assert cost_est["estimated_total_tokens"] > 0
    assert cost_est["estimated_cost_usd"] > 0

    # Verify FinOps Post-Execution Reconciliation
    reconciled = final_state.get("reconciled_usage")
    assert reconciled is not None
    assert reconciled["session_id"] == session_id
    assert reconciled["actual_tokens"] > 0
    assert "accuracy_percentage" in reconciled

    # Verify state saved in Firestore
    saved_session = fm.get_session_state(session_id)
    assert saved_session is not None
    assert saved_session["status"] == "COMPLETED"

    saved_telem = fm.get_telemetry(session_id)
    assert saved_telem is not None
    assert saved_telem["actual_tokens"] == reconciled["actual_tokens"]


def test_hub_hitl_approval_gate_pause_and_resume():
    fm = FirestoreStateManager(force_in_memory=True)
    orchestrator = HubOrchestrator(firestore_manager=fm)

    session_id = f"test-sess-hitl-{uuid.uuid4()}"
    trace_id = str(uuid.uuid4())

    initial_state: HubWorkflowState = {
        "trace_id": trace_id,
        "session_id": session_id,
        "source_app": "core-hub",
        "target_spoke": "spoke-housekeeper",
        "action": "clean_repo_noise",
        "payload": {
            "repository": MOCK_REPO,
            "target_files": ["README.md"],
        },
        "hitl_required": True,  # High risk: requires manual approval
        "hitl_approved": False,
    }

    # Step 1: Run until HITL gate pauses
    paused_state = orchestrator.run(initial_state)
    assert paused_state["status"] == "AWAITING_APPROVAL"
    assert paused_state["hitl_approved"] is False

    # Check that session is stored as awaiting approval in Firestore
    stored = fm.get_session_state(session_id)
    assert stored["status"] == "AWAITING_APPROVAL"

    # Step 2: Human Operator grants approval
    resumed_state = orchestrator.resume_approved(session_id=session_id, approver_id="security-admin")
    assert resumed_state is not None
    assert resumed_state["status"] == "COMPLETED"
    assert resumed_state["hitl_approved"] is True
    assert resumed_state["telemetry_committed"] is True


def test_sliding_context_window_and_circuit_breaker():
    """
    Verifies sliding context window diff summarization and circuit breaker tripping after 3 cycles.
    """
    state: HubWorkflowState = {
        "trace_id": str(uuid.uuid4()),
        "session_id": "test-circuit-breaker",
        "retry_count": 0,
        "retry_history": [],
        "spoke_response": {
            "status": "failure",
            "result_payload": {"error_logs": "SyntaxError: unexpected token at line 42"},
        },
    }

    # Cycle 1
    state = validation_node(state)
    assert state["status"] == "RETRY_REQUIRED"
    assert state["retry_count"] == 1
    assert "Cycle 1 Diff" in state["sliding_context_summary"]

    # Cycle 2
    state["spoke_response"]["result_payload"]["error_logs"] = "TypeError: cannot read property 'auth' of undefined"
    state = validation_node(state)
    assert state["status"] == "RETRY_REQUIRED"
    assert state["retry_count"] == 2
    assert "Cycle 2 Diff" in state["sliding_context_summary"]

    # Cycle 3 - Circuit Breaker must trip
    state["spoke_response"]["result_payload"]["error_logs"] = "ReferenceError: schema not found"
    state = validation_node(state)
    assert state["status"] == "CIRCUIT_BREAKER_TRIPPED"
    assert state["retry_count"] == 3
    assert state["circuit_breaker_tripped"] is True
    assert state["hitl_required"] is True

    # Verify sliding window only preserves bounded recent diffs, not unbounded exponential concatenation
    lines = state["sliding_context_summary"].splitlines()
    assert len(lines) <= 2  # Bounded to latest 2 summaries
