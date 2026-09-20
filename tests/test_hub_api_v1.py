"""
Unit and Integration Tests for Hub API v1 Endpoints (AES v3 Standard).
Validates Spoke Registry, Cost Estimation, Task Dispatch (Sync & Async),
SSE Stream replay/subscription, HITL decisions, and FinOps governance.
"""

import uuid
import pytest
from fastapi.testclient import TestClient
from hub.app.main import app

client = TestClient(app)


def test_list_spokes():
    resp = client.get("/api/v1/spokes")
    assert resp.status_code == 200
    data = resp.json()
    assert "spokes" in data
    assert data["total"] >= 2
    spoke_ids = [s["id"] for s in data["spokes"]]
    assert "spoke-housekeeper" in spoke_ids
    assert "spoke-video-ingest" in spoke_ids


def test_estimate_task():
    payload = {
        "target_spoke": "spoke-housekeeper",
        "action": "clean_repo_noise",
        "target_files": ["hub/app/main.py"],
        "repository": ".",
        "model_name": "gemini-1.5-flash",
    }
    resp = client.post("/api/v1/tasks/estimate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "estimated_total_tokens" in data
    assert "estimated_cost_usd" in data
    assert "estimated_runtime_seconds" in data
    assert data["estimated_total_tokens"] > 0
    assert data["estimated_cost_usd"] > 0


def test_dispatch_task_sync_and_stream():
    session_id = f"test-sess-{uuid.uuid4().hex[:8]}"
    trace_id = str(uuid.uuid4())
    req_body = {
        "trace_id": trace_id,
        "session_id": session_id,
        "source_app": "core-hub",
        "target_spoke": "spoke-housekeeper",
        "action": "clean_repo_noise",
        "payload": {
            "repository": ".",
            "target_files": ["hub/app/main.py"],
            "context_metadata": {"dry_run": True},
        },
    }

    # Dispatch sync
    resp = client.post("/api/v1/tasks/dispatch?mode=sync", json=req_body)
    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["session_id"] == session_id
    assert res_data["status"] in ["COMPLETED", "VALIDATED", "APPROVED"]

    # Stream SSE events
    stream_resp = client.get(f"/api/v1/tasks/{session_id}/stream")
    assert stream_resp.status_code == 200
    assert "text/event-stream" in stream_resp.headers["content-type"]
    assert "node_start" in stream_resp.text
    assert "init_state" in stream_resp.text


def test_dispatch_task_async():
    session_id = f"async-sess-{uuid.uuid4().hex[:8]}"
    trace_id = str(uuid.uuid4())
    req_body = {
        "trace_id": trace_id,
        "session_id": session_id,
        "source_app": "core-hub",
        "target_spoke": "spoke-housekeeper",
        "action": "clean_repo_noise",
        "payload": {
            "repository": ".",
            "target_files": ["hub/app/main.py"],
            "context_metadata": {"dry_run": True},
        },
    }

    resp = client.post("/api/v1/tasks/dispatch?mode=async", json=req_body)
    assert resp.status_code == 200
    data = resp.json()
    assert data["session_id"] == session_id
    assert data["status"] == "INITIALIZED"
    assert "stream_url" in data


def test_hitl_decision_workflow():
    session_id = f"hitl-sess-{uuid.uuid4().hex[:8]}"
    trace_id = str(uuid.uuid4())
    req_body = {
        "trace_id": trace_id,
        "session_id": session_id,
        "source_app": "core-hub",
        "target_spoke": "spoke-housekeeper",
        "action": "clean_repo_noise",
        "payload": {
            "repository": ".",
            "target_files": ["hub/app/main.py"],
            "context_metadata": {"dry_run": True, "hitl_required": True},
        },
    }

    # Dispatch task requiring HITL approval
    resp = client.post("/api/v1/tasks/dispatch?mode=sync", json=req_body)
    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["status"] == "AWAITING_APPROVAL"

    # Operator approves via /api/v1/tasks/{session_id}/hitl
    hitl_resp = client.post(
        f"/api/v1/tasks/{session_id}/hitl",
        json={"action": "approve", "approver_id": "lead-operator", "comments": "Signed off"}
    )
    assert hitl_resp.status_code == 200
    approved_data = hitl_resp.json()
    assert approved_data["status"] == "COMPLETED"
    assert approved_data["hitl_approved"] is True


def test_finops_summary_and_circuit_breaker():
    # Fetch summary
    resp = client.get("/api/v1/finops/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_tokens" in data
    assert "total_cost_usd" in data
    assert "monthly_budget_cap_usd" in data
    assert "domains" in data
    assert "academy-apps" in data["domains"]

    # Update circuit breaker threshold
    cb_resp = client.post(
        "/api/v1/finops/circuit-breaker",
        json={"monthly_budget_cap_usd": 75.0, "emergency_halt": False}
    )
    assert cb_resp.status_code == 200
    cb_data = cb_resp.json()
    assert cb_data["monthly_budget_cap_usd"] == 75.0
    assert cb_data["emergency_circuit_breaker_active"] is False
