"""
Contracts and Pydantic models for AgentTaskRequest and AgentTaskResponse.
Strictly conforms to JSON Schemas in config/schemas/ and AES v3 Standard.
"""

from __future__ import annotations
import uuid
import json
from typing import Dict, Any, List, Optional, Literal
from pydantic import BaseModel, Field, field_validator


class TaskPayload(BaseModel):
    repository: str = Field(..., description="Target repository name or URL")
    branch: Optional[str] = Field(default="main", description="Target git branch")
    target_files: List[str] = Field(..., min_length=1, description="List of files to inspect or modify")
    storage_uri: Optional[str] = Field(default=None, description="Cloud Storage URI for artifacts")
    context_metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Arbitrary task context")


class AgentTaskRequest(BaseModel):
    trace_id: str = Field(..., description="UUID for OpenTelemetry distributed tracing")
    session_id: str = Field(..., description="Stateful session ID")
    source_app: Literal["academy-apps", "avventiq", "core-hub"] = Field(
        ..., description="Originating application domain"
    )
    target_spoke: str = Field(..., description="Target spoke worker identifier")
    action: str = Field(..., description="Action name to execute")
    payload: TaskPayload = Field(..., description="Task payload parameters")

    @field_validator("trace_id")
    @classmethod
    def validate_trace_id(cls, v: str) -> str:
        try:
            uuid.UUID(v)
        except ValueError:
            raise ValueError(f"trace_id '{v}' is not a valid UUID format")
        return v

    def to_json(self) -> str:
        return self.model_dump_json(indent=2)

    @classmethod
    def from_json(cls, json_str: str) -> AgentTaskRequest:
        return cls.model_validate_json(json_str)


class ExecutionMetrics(BaseModel):
    duration_ms: int = Field(..., ge=0, description="Execution elapsed time in milliseconds")
    token_consumption: int = Field(..., ge=0, description="Actual total tokens consumed")


class ResultPayload(BaseModel):
    modified_files: Optional[List[str]] = Field(default_factory=list, description="List of files changed")
    storage_uri: Optional[str] = Field(default=None, description="Cloud Storage URI for output")
    error_logs: Optional[str] = Field(default=None, description="Compiler or execution error logs if any")
    details: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Structured execution details")


class AgentTaskResponse(BaseModel):
    trace_id: str = Field(..., description="Correlated trace UUID")
    session_id: str = Field(..., description="Stateful session ID")
    spoke_id: str = Field(..., description="Originating Spoke worker ID")
    status: Literal["success", "failure", "retry_required"] = Field(
        ..., description="Outcome of task execution"
    )
    execution_metrics: ExecutionMetrics = Field(..., description="Execution metrics")
    result_payload: Optional[ResultPayload] = Field(
        default_factory=ResultPayload, description="Result payload"
    )

    @field_validator("trace_id")
    @classmethod
    def validate_trace_id(cls, v: str) -> str:
        try:
            uuid.UUID(v)
        except ValueError:
            raise ValueError(f"trace_id '{v}' is not a valid UUID format")
        return v

    def to_json(self) -> str:
        return self.model_dump_json(indent=2)

    @classmethod
    def from_json(cls, json_str: str) -> AgentTaskResponse:
        return cls.model_validate_json(json_str)
