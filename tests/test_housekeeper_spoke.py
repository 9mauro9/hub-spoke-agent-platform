"""
Unit tests for Deliverable 2.3: Spoke 1 — Housekeeper Agent (MVP Baseline Spoke).
"""

import os
import uuid
import pytest
from spokes.housekeeper.app.handlers.repo_cleaner import clean_repo_noise
from spokes.housekeeper.app.handlers.docs_auditor import audit_markdown_and_schemas
from spokes.housekeeper.app.handlers.firestore_validator import validate_firestore_rules_and_indexes
from spokes.housekeeper.app.mcp.server import HousekeeperMCPServer
from spokes.housekeeper.app.main import SpokeHousekeeperWorker

MOCK_REPO = "tests/mock_target_repo"


def test_clean_repo_noise_dry_run():
    # Dry run should discover noise files without removing them
    res = clean_repo_noise(repo_path=MOCK_REPO, dry_run=True)
    assert res["status"] == "success"
    assert res["dry_run"] is True
    assert res["deleted_files_count"] >= 1
    # Check that .DS_Store was found in deleted_files
    assert any(".DS_Store" in f for f in res["deleted_files"])
    # File must still exist
    assert os.path.exists(os.path.join(MOCK_REPO, ".DS_Store"))


def test_clean_repo_noise_execution():
    # Real run should purge the files
    res = clean_repo_noise(repo_path=MOCK_REPO, dry_run=False)
    assert res["status"] == "success"
    assert res["dry_run"] is False
    assert not os.path.exists(os.path.join(MOCK_REPO, ".DS_Store"))
    assert not os.path.exists(os.path.join(MOCK_REPO, "orphaned_test.log"))


def test_docs_auditor_broken_link_detection():
    res = audit_markdown_and_schemas(repo_path=MOCK_REPO)
    assert res["scanned_markdown_files_count"] >= 1
    assert res["broken_links_count"] >= 1
    # Should detect the link to non_existent_guide.md
    assert any("non_existent_guide.md" in item["target"] for item in res["broken_links"])


def test_firestore_validator_security_and_indexes():
    res = validate_firestore_rules_and_indexes(repo_path=MOCK_REPO)
    # Rules has insecure allow read, write: if true;
    assert res["security_warnings_count"] >= 1
    assert any("Overly permissive rule" in w["issue"] for w in res["security_warnings"])
    # Indexes has duplicate composite index
    assert res["index_warnings_count"] >= 1
    assert any("Duplicate composite index" in w["issue"] for w in res["index_warnings"])


def test_housekeeper_mcp_server_protocol():
    server = HousekeeperMCPServer()
    # Test list_tools
    tools = server.list_tools()
    tool_names = [t["name"] for t in tools]
    assert "clean_repo_noise" in tool_names
    assert "audit_markdown_and_schemas" in tool_names
    assert "validate_firestore_rules_and_indexes" in tool_names

    # Test call_tool
    call_res = server.call_tool(
        "clean_repo_noise", {"repository_path": MOCK_REPO, "dry_run": True}
    )
    assert call_res["isError"] is False
    assert "repository_path" in call_res["raw_result"]

    # Test JSON-RPC format
    rpc_req = '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'
    rpc_resp = server.handle_json_rpc(rpc_req)
    assert '"result"' in rpc_resp
    assert "clean_repo_noise" in rpc_resp


def test_spoke_worker_end_to_end():
    worker = SpokeHousekeeperWorker()
    req = {
        "trace_id": str(uuid.uuid4()),
        "session_id": "test-session-hk",
        "source_app": "core-hub",
        "target_spoke": "spoke-housekeeper",
        "action": "audit_markdown_and_schemas",
        "payload": {
            "repository": MOCK_REPO,
            "target_files": ["docs/overview.md"],
        },
    }

    response = worker.process_task(req)
    assert response.status == "success"
    assert response.spoke_id == "spoke-housekeeper"
    assert response.execution_metrics.duration_ms >= 0
    assert response.execution_metrics.token_consumption > 0
