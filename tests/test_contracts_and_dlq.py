"""
Unit tests for Deliverable 2.1: Contract Enforcement & Dead-Letter Isolation.
"""

import uuid
import pytest
from shared.contracts.task_models import (
    AgentTaskRequest,
    AgentTaskResponse,
    TaskPayload,
    ExecutionMetrics,
    ResultPayload,
)
from shared.contracts.dlq import DeadLetterQueueManager


def test_valid_task_request_contract():
    req_dict = {
        "trace_id": str(uuid.uuid4()),
        "session_id": "sess-12345",
        "source_app": "academy-apps",
        "target_spoke": "spoke-housekeeper",
        "action": "clean_repo_noise",
        "payload": {
            "repository": "tests/mock_target_repo",
            "branch": "main",
            "target_files": ["tests/mock_target_repo/README.md"],
            "context_metadata": {"dry_run": True},
        },
    }

    req = AgentTaskRequest.model_validate(req_dict)
    assert req.source_app == "academy-apps"
    assert req.action == "clean_repo_noise"
    assert len(req.payload.target_files) == 1


def test_invalid_task_request_missing_required_field():
    # Missing required target_spoke and payload.target_files
    invalid_dict = {
        "trace_id": str(uuid.uuid4()),
        "session_id": "sess-12345",
        "source_app": "academy-apps",
        "action": "clean_repo_noise",
        "payload": {
            "repository": "tests/mock_target_repo",
        },
    }

    dlq = DeadLetterQueueManager()
    parsed, dlq_record = dlq.validate_and_parse_request(invalid_dict, source="test-suite")

    assert parsed is None
    assert dlq_record is not None
    assert dlq_record["alert_triggered"] is True
    assert dlq_record["target_dlq_topic"] == "agent-dlq"
    assert dlq.get_quarantined_count() == 1


def test_invalid_trace_id_format():
    invalid_trace_dict = {
        "trace_id": "not-a-valid-uuid",
        "session_id": "sess-12345",
        "source_app": "core-hub",
        "target_spoke": "spoke-housekeeper",
        "action": "clean_repo_noise",
        "payload": {
            "repository": "tests/mock_target_repo",
            "target_files": ["README.md"],
        },
    }

    dlq = DeadLetterQueueManager()
    parsed, dlq_record = dlq.validate_and_parse_request(invalid_trace_dict, source="test-suite")

    assert parsed is None
    assert dlq_record is not None
    assert "UUID" in dlq_record["error_message"] or "uuid" in dlq_record["error_message"].lower()


def test_valid_task_response_contract():
    resp_dict = {
        "trace_id": str(uuid.uuid4()),
        "session_id": "sess-12345",
        "spoke_id": "spoke-housekeeper",
        "status": "success",
        "execution_metrics": {
            "duration_ms": 150,
            "token_consumption": 450,
        },
        "result_payload": {
            "modified_files": [".DS_Store"],
            "error_logs": None,
        },
    }

    dlq = DeadLetterQueueManager()
    resp, dlq_record = dlq.validate_and_parse_response(resp_dict, source="test-suite")

    assert dlq_record is None
    assert resp is not None
    assert resp.status == "success"
    assert resp.execution_metrics.token_consumption == 450


def test_poison_pill_response_isolation():
    # Corrupted status and negative token metrics
    corrupt_dict = {
        "trace_id": str(uuid.uuid4()),
        "session_id": "sess-corrupted",
        "spoke_id": "spoke-housekeeper",
        "status": "NOT_AN_ENUM_STATUS",
        "execution_metrics": {
            "duration_ms": -10,
            "token_consumption": -500,
        },
    }

    dlq = DeadLetterQueueManager()
    resp, dlq_record = dlq.validate_and_parse_response(corrupt_dict, source="test-suite")

    assert resp is None
    assert dlq_record is not None
    assert dlq_record["error_type"] == "ValidationError"
