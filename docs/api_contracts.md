# Hub-and-Spoke Agent Platform: API Contracts & Protocols

## 1. Inter-Service Message Contracts

All inter-agent and inter-service communications adhere to strict schemas defined under `config/schemas/` and implemented via Pydantic in `shared/contracts/task_models.py`.

### 1.1 `AgentTaskRequest`
Payload submitted to the Master Orchestrator via REST or published to `projects/hub-spoke-agent-platform/topics/agent-tasks`.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AgentTaskRequest",
  "type": "object",
  "required": [
    "trace_id",
    "source_app",
    "target_spoke",
    "action",
    "payload"
  ],
  "properties": {
    "trace_id": {
      "type": "string",
      "format": "uuid",
      "description": "Standard W3C / UUIDv4 trace identifier for end-to-end distributed observability."
    },
    "session_id": {
      "type": "string",
      "description": "Unique session identifier for multi-turn state tracking."
    },
    "source_app": {
      "type": "string",
      "enum": ["academy-apps", "avventiq", "core-hub"],
      "description": "Originating application domain for PAB tenant isolation."
    },
    "target_spoke": {
      "type": "string",
      "description": "Target Spoke identifier (e.g., 'housekeeper', 'video-ingest')."
    },
    "action": {
      "type": "string",
      "description": "Action or FastMCP tool verb to execute."
    },
    "payload": {
      "type": "object",
      "description": "Domain-specific input arguments for the tool."
    },
    "metadata": {
      "type": "object",
      "description": "Optional metadata, tags, and request-level telemetry."
    }
  }
}
```

### 1.2 `AgentTaskResponse`
Payload returned by the Master Orchestrator or published to `projects/hub-spoke-agent-platform/topics/agent-responses`.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AgentTaskResponse",
  "type": "object",
  "required": [
    "trace_id",
    "session_id",
    "status",
    "result"
  ],
  "properties": {
    "trace_id": {
      "type": "string",
      "format": "uuid"
    },
    "session_id": {
      "type": "string"
    },
    "status": {
      "type": "string",
      "enum": ["success", "failed", "retry_required", "awaiting_approval"]
    },
    "result": {
      "type": "object",
      "description": "Structured execution output."
    },
    "error": {
      "type": "string",
      "description": "Error message or traceback if status is failed."
    },
    "telemetry": {
      "type": "object",
      "properties": {
        "execution_time_ms": {"type": "number"},
        "tokens_consumed": {"type": "integer"},
        "estimated_cost_usd": {"type": "number"}
      }
    }
  }
}
```

### 1.3 `DeadLetterPayload`
Structure quarantined to `projects/hub-spoke-agent-platform/topics/agent-dlq` upon validation failure or poison pill detection:

```json
{
  "dlq_id": "02013ab7-0755-4957-b618-a9417cc552c2",
  "failed_at": "2026-09-20T17:34:38Z",
  "source": "test-runner",
  "original_payload": { ... },
  "error_type": "ValidationError",
  "validation_errors": [ ... ],
  "retry_count": 5
}
```

---

## 2. Master Orchestrator REST & SSE APIs

Base URL: `https://master-orchestrator-60727530657.us-central1.run.app`

### 2.1 Synchronous Task Execution
- **Endpoint:** `POST /api/v1/tasks`
- **Request Headers:** `Content-Type: application/json`
- **Body:** `AgentTaskRequest`
- **Response:** `AgentTaskResponse` (HTTP 200 OK or 400 Bad Request)

### 2.2 Server-Sent Events (SSE) Streaming
- **Endpoint:** `GET /api/v1/tasks/{session_id}/stream`
- **Response Headers:** `Content-Type: text/event-stream`, `Cache-Control: no-cache`
- **Stream Events:**
  - `event: step` — Emitted at each node transition (`input_validation`, `finops_budget`, `spoke_dispatch`, etc.)
  - `event: token` — Streaming tokens from LLM reasoning nodes
  - `event: hitl_required` — Fired when workflow transitions to `AWAITING_APPROVAL`
  - `event: complete` — Emitted with final `AgentTaskResponse`

### 2.3 Human-in-the-Loop (HITL) Resolution
- **Endpoint:** `POST /api/v1/tasks/{session_id}/approve`
- **Body:**
  ```json
  {
    "approver": "lead-architect",
    "decision": "APPROVED",
    "modifications": {}
  }
  ```
- **Response:** Resumes LangGraph workflow to completion.

---

## 3. FastMCP Tool Specifications

FastMCP tools are implemented via MCP JSON-RPC protocol over standard stdio or HTTP endpoints (`POST /mcp`).

### 3.1 Spoke 1: Housekeeper Tools
- `clean_repo_noise`:
  - Input: `{"target_directory": str, "dry_run": bool}`
  - Output: `{"cleaned_files": list[str], "bytes_freed": int, "dry_run": bool}`
- `audit_markdown_and_schemas`:
  - Input: `{"target_directory": str}`
  - Output: `{"scanned_files": int, "broken_links": list[dict], "status": str}`
- `validate_firestore_rules_and_indexes`:
  - Input: `{"rules_file": str, "indexes_file": str}`
  - Output: `{"security_issues": list[str], "index_warnings": list[str], "compliant": bool}`

### 3.2 Spoke 2: Video Ingest Tools
- `analyze_video_research`:
  - Input: `{"video_source": str, "session_id": str, "max_duration_seconds": int}`
  - Output: `{"status": str, "gcs_uri": str, "summary": str, "action_items": list[str]}`

---

## 4. SpokeOps Telemetry & Observability API Contract

Base URL: `https://spokeops-ingestion-541312712358.us-central1.run.app`

### 4.1 Master Telemetry Ingestion Endpoint
- **Endpoint:** `POST /api/v1/telemetry`
- **Request Headers:**
  - `Content-Type: application/json`
  - `x-spoke-token: <SPOKEOPS_TENANT_TOKEN>` (Mandatory SHA-256 validated secret token)
  - `x-spoke-app-id: <appId>` (e.g. `hub-spoke-agent-platform`)

#### A. Session Heartbeat Payload
```json
{
  "type": "session_heartbeat",
  "appId": "hub-spoke-agent-platform",
  "sessionId": "sess_a8f9c1b2_1726848000",
  "userId": "usr_hub_op_01",
  "userEmail": "operator@hub-spoke.net",
  "userRoles": ["platform_operator"],
  "status": "active",
  "clientMetadata": {
    "userAgent": "Mozilla/5.0 ...",
    "viewport": "1920x1080",
    "path": "/launcher"
  }
}
```
*Note: Status cycles dynamically between `"active"` (2-minute cadence), `"idle"` (5-minute cadence on tab blur/hide), and `"closed"` (on unload beacon).*

#### B. Autonomous Workflow Audit Event Payload
```json
{
  "type": "audit_event",
  "appId": "hub-spoke-agent-platform",
  "sessionId": "sess_a8f9c1b2_1726848000",
  "userId": "usr_hub_op_01",
  "userEmail": "operator@hub-spoke.net",
  "roleAtExecution": "platform_operator",
  "action": "agent_task_started",
  "resourceType": "agent_workflow",
  "resourceId": "ui-sess-7b19a0c2",
  "status": "success",
  "metadata": {
    "targetAgent": "spoke-housekeeper",
    "action": "clean_repo_noise",
    "sourceApp": "core-hub",
    "promptLength": 48
  },
  "timestamp": "2026-09-20T17:40:00.000Z"
}
```

#### Supported Audit Actions:
- `agent_task_started`: Fired upon dispatch of a Spoke workflow.
- `agent_task_executed`: Emitted on tool and LangGraph node executions with execution duration metrics.
- `agent_task_failed`: Emitted upon execution or dispatch failure.
- `policy_update`: Emitted when an operator signs off on HITL gates or updates FinOps spend caps.
- `permission_denied`: Emitted when RBAC boundaries prevent unauthorized route or action execution.
