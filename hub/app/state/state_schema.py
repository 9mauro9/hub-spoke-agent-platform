"""
State schema definitions for LangGraph Master Orchestrator in AES v3 Standard.
"""

from __future__ import annotations
from typing import Dict, Any, List, Optional, TypedDict
from pydantic import BaseModel, Field


class HubWorkflowState(TypedDict, total=False):
    trace_id: str
    session_id: str
    source_app: str
    target_spoke: str
    action: str
    payload: Dict[str, Any]
    
    # Analysis & Planning
    analysis_plan: Optional[Dict[str, Any]]
    
    # FinOps Governance
    cost_estimate: Optional[Dict[str, Any]]
    reconciled_usage: Optional[Dict[str, Any]]
    
    # Spoke Execution
    task_dispatched: bool
    spoke_response: Optional[Dict[str, Any]]
    
    # Validation & Sliding Context Error Retries
    validation_result: Optional[Dict[str, Any]]
    retry_count: int
    retry_history: List[str]
    sliding_context_summary: Optional[str]
    
    # Governance & HITL Approval
    circuit_breaker_tripped: bool
    hitl_required: bool
    hitl_approved: bool
    approver_id: Optional[str]
    
    # Lifecycle Status
    status: str
    error_message: Optional[str]
    telemetry_committed: bool
