"""
Unit and integration tests for spoke-video-ingest.
Validates multimodal YouTube video parsing, GCS storage streaming, FinOps duration gate,
MCP tool execution, dead-letter queue isolation, and Hub orchestrator integration.
Conforms to AES v3 Standard and Hub-and-Spoke Specification Version 1.0.
"""

import os
import uuid
import pytest
from shared.contracts.task_models import AgentTaskRequest, AgentTaskResponse
from shared.contracts.dlq import DeadLetterQueueManager
from spokes.video_ingest.app.main import SpokeVideoIngestWorker
from spokes.video_ingest.app.video_parser import VideoResearchParser
from spokes.video_ingest.app.storage import ResearchStorageManager
from spokes.video_ingest.app.mcp.server import VideoIngestMCPServer
from hub.app.state.firestore_manager import FirestoreStateManager
from hub.app.graph.workflow import HubOrchestrator
from hub.app.state.state_schema import HubWorkflowState

SAMPLE_YOUTUBE_URL = "https://www.youtube.com/watch?v=sample-distributed-arch"


def test_video_ingest_contract_compliance():
    worker = SpokeVideoIngestWorker()
    session_id = f"sess-video-{uuid.uuid4()}"
    trace_id = str(uuid.uuid4())

    req_payload = {
        "trace_id": trace_id,
        "session_id": session_id,
        "source_app": "academy-apps",
        "target_spoke": "spoke-video-ingest",
        "action": "parse_video_research",
        "payload": {
            "repository": SAMPLE_YOUTUBE_URL,
            "storage_uri": SAMPLE_YOUTUBE_URL,
            "target_files": ["research_compilation.md"],
            "context_metadata": {
                "research_focus": "Firestore Data Model, Security Rules, and Distributed Caching",
                "video_duration_seconds": 1200,  # 20 minutes (within 45 min gate)
            },
        },
    }

    response: AgentTaskResponse = worker.process_task(req_payload)

    # Validate Task Response Contract
    assert response.trace_id == trace_id
    assert response.session_id == session_id
    assert response.spoke_id == "spoke-video-ingest"
    assert response.status == "success"
    assert response.execution_metrics.duration_ms >= 0
    assert response.execution_metrics.token_consumption > 0

    # Validate GCS Artifact Pointer
    assert response.result_payload is not None
    assert response.result_payload.storage_uri.startswith("gs://")
    assert f"{session_id}/research_compilation.md" in response.result_payload.storage_uri
    assert response.result_payload.details["research_focus"] == "Firestore Data Model, Security Rules, and Distributed Caching"


def test_finops_duration_gate_interception():
    """
    Videos > 45 minutes (2700s) must trigger retry_required requiring HITL approval gate.
    """
    worker = SpokeVideoIngestWorker()
    session_id = f"sess-long-video-{uuid.uuid4()}"
    trace_id = str(uuid.uuid4())

    req_payload = {
        "trace_id": trace_id,
        "session_id": session_id,
        "source_app": "core-hub",
        "target_spoke": "spoke-video-ingest",
        "action": "parse_video_research",
        "payload": {
            "repository": SAMPLE_YOUTUBE_URL,
            "storage_uri": SAMPLE_YOUTUBE_URL,
            "target_files": ["research_compilation.md"],
            "context_metadata": {
                "research_focus": "End-to-End Deep Learning Architecture",
                "video_duration_seconds": 3600,  # 60 minutes (> 45 min gate)
            },
        },
    }

    response: AgentTaskResponse = worker.process_task(req_payload)

    assert response.status == "retry_required"
    assert "45-minute FinOps threshold" in response.result_payload.error_logs
    assert response.result_payload.details["gate_triggered"] is True
    assert response.result_payload.details["video_duration_seconds"] == 3600


def test_multimodal_extraction_structure_and_context_compression():
    parser = VideoResearchParser()
    session_id = f"sess-parse-{uuid.uuid4()}"
    focus = "Distributed Pub/Sub Queues and Event-Driven Microservices"

    extraction = parser.parse_video(
        youtube_url=SAMPLE_YOUTUBE_URL,
        research_focus=focus,
        session_id=session_id,
        hint_duration_seconds=1500,
    )

    md = extraction["markdown_content"]

    # Verify Context Compression header
    assert "---" in md
    assert "artifact_type: technical_research_compilation" in md
    assert f'session_id: "{session_id}"' in md
    assert f'research_focus: "{focus}"' in md

    # Verify 4 Essential Architecture Sections
    assert "## 1. Executive Architecture Overview" in md
    assert "## 2. Visual & Architectural Artifacts" in md
    assert "## 3. Code & API Contracts" in md
    assert "## 4. Operational Tradeoffs & Caveats" in md

    # Verify timestamps exist in Visual Artifacts section
    assert "[" in md and "]" in md
    assert any(f"[{m:02d}:" in md for m in range(60))


def test_gcs_compilation_storage():
    storage = ResearchStorageManager()
    session_id = f"sess-storage-{uuid.uuid4()}"
    content = "# Test Research Content\n\nValid architecture extract."

    gcs_uri = storage.upload_compilation(session_id=session_id, markdown_content=content)

    assert gcs_uri.startswith("gs://")
    assert f"{session_id}/research_compilation.md" in gcs_uri

    # Verify read back
    read_back = storage.read_compilation(session_id=session_id)
    assert read_back == content


def test_mcp_server_video_research_tool():
    mcp_server = VideoIngestMCPServer()

    # 1. Tool discovery
    tools = mcp_server.list_tools()
    tool_names = [t["name"] for t in tools]
    assert "analyze_video_research" in tool_names

    # 2. Tool execution (standard call)
    call_res = mcp_server.call_tool(
        name="analyze_video_research",
        arguments={
            "youtube_url": SAMPLE_YOUTUBE_URL,
            "research_focus": "Kubernetes and Service Mesh Architecture",
            "hint_duration_seconds": 1800,
        },
    )
    assert call_res["isError"] is False
    raw = call_res["raw_result"]
    assert raw["status"] == "success"
    assert raw["storage_uri"].startswith("gs://")

    # 3. Tool execution (duration gate exceeded)
    gate_res = mcp_server.call_tool(
        name="analyze_video_research",
        arguments={
            "youtube_url": SAMPLE_YOUTUBE_URL,
            "research_focus": "Monolithic Database Migrations",
            "hint_duration_seconds": 4000,
        },
    )
    assert gate_res["raw_result"]["status"] == "retry_required"

    # 4. JSON-RPC protocol handling
    rpc_req = '{"jsonrpc": "2.0", "id": 42, "method": "tools/list"}'
    rpc_resp = mcp_server.handle_json_rpc(rpc_req)
    assert '"id": 42' in rpc_resp
    assert "analyze_video_research" in rpc_resp


def test_video_ingest_poison_pill_dlq():
    worker = SpokeVideoIngestWorker()

    corrupt_req = {
        "trace_id": "MALFORMED_NON_UUID",
        "session_id": "sess-corrupt",
        "source_app": "untrusted-origin",
        "target_spoke": "spoke-video-ingest",
        "payload": {},
    }

    response = worker.process_task(corrupt_req)
    assert response.status == "failure"
    assert "Contract validation failure: Quarantined to DLQ" in response.result_payload.error_logs
    assert "dlq_id" in response.result_payload.details


def test_hub_orchestrator_video_ingest_dispatch():
    """
    Verifies that the Master Orchestrator (Hub) can dispatch a video research
    task end-to-end to spoke-video-ingest.
    """
    fm = FirestoreStateManager(force_in_memory=True)
    orchestrator = HubOrchestrator(firestore_manager=fm)

    session_id = f"sess-hub-video-{uuid.uuid4()}"
    trace_id = str(uuid.uuid4())

    initial_state: HubWorkflowState = {
        "trace_id": trace_id,
        "session_id": session_id,
        "source_app": "core-hub",
        "target_spoke": "spoke-video-ingest",
        "action": "parse_video_research",
        "payload": {
            "repository": SAMPLE_YOUTUBE_URL,
            "storage_uri": SAMPLE_YOUTUBE_URL,
            "target_files": ["research_compilation.md"],
            "context_metadata": {
                "research_focus": "Multi-Tenant Isolation and VPC Service Controls",
                "video_duration_seconds": 1800,
            },
        },
        "hitl_required": False,
    }

    final_state = orchestrator.run(initial_state)

    assert final_state["status"] == "COMPLETED"
    assert final_state["task_dispatched"] is True
    assert final_state["telemetry_committed"] is True

    # Check Spoke response payload
    spoke_resp = final_state["spoke_response"]
    assert spoke_resp["status"] == "success"
    assert spoke_resp["spoke_id"] == "spoke-video-ingest"
    assert spoke_resp["result_payload"]["storage_uri"].startswith("gs://")

    # Check FinOps reconciliation
    reconciled = final_state["reconciled_usage"]
    assert reconciled["spoke_id"] == "spoke-video-ingest"
    assert reconciled["actual_tokens"] > 0
