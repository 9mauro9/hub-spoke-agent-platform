"""
LangGraph Workflow State Machine Assembly for the Master Platform Orchestrator (AES v3 Standard).
Manages deterministic node transitions, retry loops, HITL approval gates, and telemetry commits.
"""

from __future__ import annotations
import logging
from typing import Dict, Any, Optional

from hub.app.state.state_schema import HubWorkflowState
from hub.app.state.firestore_manager import FirestoreStateManager
from hub.app.graph.nodes import (
    init_state_node,
    analyzer_agent_node,
    pre_execution_cost_estimator_node,
    dispatch_task_node,
    validation_node,
    hitl_approval_gate_node,
    commit_telemetry_node,
)

logger = logging.getLogger("HubWorkflow")


class HubOrchestrator:
    """
    State machine engine governing deterministic multi-step Hub-and-Spoke executions.
    """

    def __init__(self, firestore_manager: Optional[FirestoreStateManager] = None):
        self.firestore_manager = firestore_manager or FirestoreStateManager()
        self._session_listeners: Dict[str, list] = {}
        self._session_event_history: Dict[str, list] = {}

    def add_listener(self, session_id: str, callback: Any) -> None:
        if session_id not in self._session_listeners:
            self._session_listeners[session_id] = []
        self._session_listeners[session_id].append(callback)

    def remove_listener(self, session_id: str, callback: Any) -> None:
        if session_id in self._session_listeners and callback in self._session_listeners[session_id]:
            self._session_listeners[session_id].remove(callback)

    def get_event_history(self, session_id: str) -> list:
        return self._session_event_history.get(session_id, [])

    def _emit_event(self, session_id: str, event_data: Dict[str, Any]) -> None:
        from datetime import datetime, timezone
        event = {
            "session_id": session_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **event_data,
        }
        if session_id not in self._session_event_history:
            self._session_event_history[session_id] = []
        self._session_event_history[session_id].append(event)

        listeners = list(self._session_listeners.get(session_id, []))
        for listener in listeners:
            try:
                listener(event)
            except Exception as e:
                logger.warning(f"Error invoking listener for session {session_id}: {e}")

    def run(self, initial_state: HubWorkflowState, event_callback: Optional[Any] = None) -> HubWorkflowState:
        """
        Executes the workflow from initial state until completion or HITL pause,
        emitting live state transition events.
        """
        session_id = initial_state.get("session_id", "pending")
        if event_callback:
            self.add_listener(session_id, event_callback)

        try:
            # 1. Init State
            self._emit_event(session_id, {"type": "node_start", "node": "init_state", "status": "executing"})
            state = init_state_node(initial_state, firestore_manager=self.firestore_manager)
            session_id = state["session_id"]
            self._emit_event(session_id, {"type": "node_complete", "node": "init_state", "status": "completed", "state": state})

            # 2. Analyzer Agent & PAB Enforcement
            self._emit_event(session_id, {"type": "node_start", "node": "analyzer_agent", "status": "executing"})
            state = analyzer_agent_node(state)
            if state.get("status") == "PAB_VIOLATION":
                self.firestore_manager.save_session_state(state["session_id"], state)
                self._emit_event(session_id, {"type": "node_error", "node": "analyzer_agent", "status": "error", "error": state.get("error_message")})
                return state
            self._emit_event(session_id, {"type": "node_complete", "node": "analyzer_agent", "status": "completed", "state": state})

            # 3. Pre-execution FinOps Cost Estimator
            self._emit_event(session_id, {"type": "node_start", "node": "pre_execution_cost_estimator", "status": "executing"})
            state = pre_execution_cost_estimator_node(state)
            self._emit_event(session_id, {
                "type": "node_complete",
                "node": "pre_execution_cost_estimator",
                "status": "completed",
                "cost_estimate": state.get("cost_estimate"),
                "state": state
            })

            # 4 & 5. Dispatch & Validation Loop (with sliding context retries, max 3)
            while True:
                self._emit_event(session_id, {"type": "node_start", "node": "dispatch_task", "status": "executing"})
                state = dispatch_task_node(state)
                self._emit_event(session_id, {"type": "node_complete", "node": "dispatch_task", "status": "completed", "state": state})

                self._emit_event(session_id, {"type": "node_start", "node": "validation_node", "status": "executing"})
                state = validation_node(state)

                if state.get("status") == "VALIDATED":
                    self._emit_event(session_id, {"type": "node_complete", "node": "validation_node", "status": "completed", "state": state})
                    break
                elif state.get("status") == "RETRY_REQUIRED":
                    self._emit_event(session_id, {
                        "type": "node_retry",
                        "node": "validation_node",
                        "status": "retry_required",
                        "retry_count": state.get("retry_count"),
                        "sliding_summary": state.get("sliding_context_summary"),
                        "state": state
                    })
                    continue
                elif state.get("status") == "CIRCUIT_BREAKER_TRIPPED":
                    self._emit_event(session_id, {
                        "type": "node_error",
                        "node": "validation_node",
                        "status": "circuit_breaker_tripped",
                        "retry_count": state.get("retry_count"),
                        "state": state
                    })
                    break

            # 6. Human-in-the-Loop Gate
            self._emit_event(session_id, {"type": "node_start", "node": "hitl_approval_gate", "status": "executing"})
            state = hitl_approval_gate_node(state)
            if state.get("status") == "AWAITING_APPROVAL":
                self.firestore_manager.save_session_state(state["session_id"], state)
                self._emit_event(session_id, {
                    "type": "hitl_required",
                    "node": "hitl_approval_gate",
                    "status": "paused",
                    "validation_result": state.get("validation_result"),
                    "spoke_response": state.get("spoke_response"),
                    "state": state
                })
                return state
            self._emit_event(session_id, {"type": "node_complete", "node": "hitl_approval_gate", "status": "completed", "state": state})

            # 7. Commit Telemetry & Reconcile Tokens
            self._emit_event(session_id, {"type": "node_start", "node": "commit_telemetry", "status": "executing"})
            state = commit_telemetry_node(state, firestore_manager=self.firestore_manager)
            self._emit_event(session_id, {
                "type": "workflow_complete",
                "node": "commit_telemetry",
                "status": "completed",
                "reconciled_usage": state.get("reconciled_usage"),
                "state": state
            })
            return state
        finally:
            if event_callback:
                self.remove_listener(session_id, event_callback)

    def resume_approved(self, session_id: str, approver_id: str = "operator") -> Optional[HubWorkflowState]:
        """
        Resumes a paused workflow after human approval has been granted.
        """
        current_state = self.firestore_manager.get_session_state(session_id)
        if not current_state:
            return None

        # Mark approved
        self.firestore_manager.approve_hitl(session_id, approver_id)
        current_state["hitl_approved"] = True
        current_state["approver_id"] = approver_id
        current_state["status"] = "APPROVED"

        self._emit_event(session_id, {
            "type": "hitl_approved",
            "node": "hitl_approval_gate",
            "status": "approved",
            "approver_id": approver_id,
        })

        # Resume from commit_telemetry
        self._emit_event(session_id, {"type": "node_start", "node": "commit_telemetry", "status": "executing"})
        resumed_state = commit_telemetry_node(current_state, firestore_manager=self.firestore_manager)
        self._emit_event(session_id, {
            "type": "workflow_complete",
            "node": "commit_telemetry",
            "status": "completed",
            "reconciled_usage": resumed_state.get("reconciled_usage"),
            "state": resumed_state,
        })
        return resumed_state

    def resume_with_feedback(self, session_id: str, feedback: str, approver_id: str = "operator") -> Optional[HubWorkflowState]:
        """
        Resumes a paused workflow by injecting operator feedback into sliding context
        and continuing the dispatch/validation retry loop.
        """
        current_state = self.firestore_manager.get_session_state(session_id)
        if not current_state:
            return None

        history = list(current_state.get("retry_history", []))
        feedback_entry = f"[Operator Feedback via HITL] {feedback}"
        history.append(feedback_entry)
        current_state["retry_history"] = history
        current_state["sliding_context_summary"] = "\n".join(history[-2:])
        current_state["status"] = "RETRY_REQUIRED"
        # Reset circuit breaker so it can retry with guidance
        current_state["circuit_breaker_tripped"] = False
        current_state["retry_count"] = max(0, current_state.get("retry_count", 1) - 1)

        self._emit_event(session_id, {
            "type": "hitl_feedback",
            "node": "hitl_approval_gate",
            "status": "feedback_provided",
            "approver_id": approver_id,
            "feedback": feedback,
        })

        # Loop back into dispatch_task and run to completion
        while True:
            self._emit_event(session_id, {"type": "node_start", "node": "dispatch_task", "status": "executing"})
            current_state = dispatch_task_node(current_state)
            self._emit_event(session_id, {"type": "node_complete", "node": "dispatch_task", "status": "completed", "state": current_state})

            self._emit_event(session_id, {"type": "node_start", "node": "validation_node", "status": "executing"})
            current_state = validation_node(current_state)

            if current_state.get("status") == "VALIDATED":
                self._emit_event(session_id, {"type": "node_complete", "node": "validation_node", "status": "completed", "state": current_state})
                break
            elif current_state.get("status") == "RETRY_REQUIRED":
                self._emit_event(session_id, {
                    "type": "node_retry",
                    "node": "validation_node",
                    "status": "retry_required",
                    "retry_count": current_state.get("retry_count"),
                    "sliding_summary": current_state.get("sliding_context_summary"),
                    "state": current_state
                })
                continue
            elif current_state.get("status") == "CIRCUIT_BREAKER_TRIPPED":
                self._emit_event(session_id, {
                    "type": "node_error",
                    "node": "validation_node",
                    "status": "circuit_breaker_tripped",
                    "retry_count": current_state.get("retry_count"),
                    "state": current_state
                })
                break

        current_state = hitl_approval_gate_node(current_state)
        if current_state.get("status") == "AWAITING_APPROVAL":
            self.firestore_manager.save_session_state(current_state["session_id"], current_state)
            self._emit_event(session_id, {
                "type": "hitl_required",
                "node": "hitl_approval_gate",
                "status": "paused",
                "validation_result": current_state.get("validation_result"),
                "spoke_response": current_state.get("spoke_response"),
                "state": current_state
            })
            return current_state

        self._emit_event(session_id, {"type": "node_start", "node": "commit_telemetry", "status": "executing"})
        final_state = commit_telemetry_node(current_state, firestore_manager=self.firestore_manager)
        self._emit_event(session_id, {
            "type": "workflow_complete",
            "node": "commit_telemetry",
            "status": "completed",
            "reconciled_usage": final_state.get("reconciled_usage"),
            "state": final_state,
        })
        return final_state

    def reject(self, session_id: str, reason: str, approver_id: str = "operator") -> Optional[HubWorkflowState]:
        """
        Rejects a paused workflow, halting execution and recording the audit log.
        """
        current_state = self.firestore_manager.get_session_state(session_id)
        if not current_state:
            return None

        current_state["status"] = "REJECTED"
        current_state["rejection_reason"] = reason
        current_state["rejected_by"] = approver_id
        self.firestore_manager.save_session_state(session_id, current_state)
        self.firestore_manager.record_audit_log("TASK_REJECTED", {
            "session_id": session_id,
            "approver_id": approver_id,
            "reason": reason,
        })

        self._emit_event(session_id, {
            "type": "task_rejected",
            "status": "rejected",
            "approver_id": approver_id,
            "reason": reason,
            "state": current_state,
        })
        return current_state


# LangGraph StateGraph builder for native LangGraph runtime
def build_langgraph_workflow(firestore_manager: Optional[FirestoreStateManager] = None):
    try:
        from langgraph.graph import StateGraph, END
    except ImportError:
        logger.info("langgraph package not installed; HubOrchestrator provides native state machine.")
        return None

    fm = firestore_manager or FirestoreStateManager()
    workflow = StateGraph(HubWorkflowState)

    workflow.add_node("init_state", lambda s: init_state_node(s, firestore_manager=fm))
    workflow.add_node("analyzer_agent", analyzer_agent_node)
    workflow.add_node("pre_execution_cost_estimator", pre_execution_cost_estimator_node)
    workflow.add_node("dispatch_task", dispatch_task_node)
    workflow.add_node("validation_node", validation_node)
    workflow.add_node("hitl_approval_gate", hitl_approval_gate_node)
    workflow.add_node("commit_telemetry", lambda s: commit_telemetry_node(s, firestore_manager=fm))

    workflow.set_entry_point("init_state")
    workflow.add_edge("init_state", "analyzer_agent")

    def route_after_analyzer(state: HubWorkflowState):
        if state.get("status") == "PAB_VIOLATION":
            return END
        return "pre_execution_cost_estimator"

    workflow.add_conditional_edges("analyzer_agent", route_after_analyzer)
    workflow.add_edge("pre_execution_cost_estimator", "dispatch_task")
    workflow.add_edge("dispatch_task", "validation_node")

    def route_after_validation(state: HubWorkflowState):
        if state.get("status") == "VALIDATED":
            return "hitl_approval_gate"
        elif state.get("status") == "RETRY_REQUIRED":
            return "dispatch_task"
        return "hitl_approval_gate"

    workflow.add_conditional_edges("validation_node", route_after_validation)

    def route_after_hitl(state: HubWorkflowState):
        if state.get("status") == "AWAITING_APPROVAL":
            return END
        return "commit_telemetry"

    workflow.add_conditional_edges("hitl_approval_gate", route_after_hitl)
    workflow.add_edge("commit_telemetry", END)

    return workflow.compile()
