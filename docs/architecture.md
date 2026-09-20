# Hub-and-Spoke Agent Platform: System Architecture

## 1. Architectural Overview

The **Hub-and-Spoke Agent Platform** implements the **Agentic Engineering Standard Version 3 (AES v3)**. It decouples high-level reasoning, FinOps governance, and safety routing (the Central Hub) from discrete domain capabilities and tool execution (the Spokes).

```
                            +-----------------------------+
                            |     Web Control Center      |
                            |  React + TS + Tailwind      |
                            |  (Cloud Run: hub-spoke-ui)  |
                            +--------------+--------------+
                                           | REST / SSE
                                           v
+-----------------------------------------------------------------------------------------+
|                               Central Master Orchestrator                                |
|                              FastAPI + LangGraph (AES v3)                                |
|                                                                                         |
|  +-------------------+     +---------------------+     +-----------------------------+  |
|  | Input Validation  | --> | FinOps Pre-Exec     | --> | Security Perimeter          |  |
|  | JSON Schema Gate  |     | Cost Ceiling Engine |     | Model Armor & PAB Policy    |  |
|  +-------------------+     +---------------------+     +--------------+--------------+  |
|                                                                       |                 |
|                                    +----------------------------------+                 |
|                                    v                                                    |
|  +-------------------+     +---------------------+     +-----------------------------+  |
|  | HITL Approval     | <-- | Validation & Diff   | <-- | Spoke Dispatcher            |  |
|  | Gate (Suspension) |     | Circuit Breaker     |     | FastMCP / Cloud Run Invoker |  |
|  +-------------------+     +---------------------+     +-----------------------------+  |
|                                    | (OK)                                               |
|                                    v                                                    |
|                            +---------------------+                                      |
|                            | FinOps Post-Exec    |                                      |
|                            | Reconcile & Store   |                                      |
|                            +---------------------+                                      |
+------------------------------------+----------------------------------------------------+
                                     |
             +-----------------------+-----------------------+
             | Cloud Pub/Sub                                 | Cloud Pub/Sub
             v                                               v
+-----------------------------+               +-----------------------------+
|     Spoke 1: Housekeeper    |               |    Spoke 2: Video Ingest    |
|   FastMCP + Cloud Run       |               |    FastMCP + Cloud Run      |
|                             |               |                             |
| - Repo Noise Cleaning       |               | - Multimodal Gemini Parse   |
| - Markdown & Link Auditing  |               | - Tech Spec Compilation     |
| - Firestore Security & Index|               | - GCS Artifact Storage      |
+-----------------------------+               +-----------------------------+
             |                                               |
             +-----------------------+-----------------------+
                                     |
                                     v
                 +---------------------------------------+
                 |       Shared Persistence Layer        |
                 | - Cloud Firestore Native (Sessions)   |
                 | - Cloud Storage (Artifacts)           |
                 | - Cloud Pub/Sub (Dead-Letter Queue)   |
                 | - OpenTelemetry / Cloud Trace         |
                 +---------------------------------------+
```

---

## 2. Core Components

### 2.1 Central Master Orchestrator (`hub/`)
- **Runtime:** Python 3.12 / FastAPI deployed as a containerized service on Cloud Run (`https://master-orchestrator-60727530657.us-central1.run.app`).
- **Workflow Engine:** LangGraph 7-node state machine executing deterministic execution cycles:
  1. `input_validation_node`: Strict validation against `config/schemas/task_request.json`.
  2. `finops_budget_node`: Pre-execution token and cost calculation against model pricing tables.
  3. `security_perimeter_node`: PII redaction and prompt injection scrubbing via Model Armor rules.
  4. `spoke_dispatch_node`: HTTP/REST or Pub/Sub dispatch to designated Spoke microservices.
  5. `validation_node`: Response schema check and sliding context error diffing (bounded to 3 retry loops).
  6. `hitl_approval_gate_node`: Human-in-the-loop suspension when circuit breaker trips or runtime budgets are exceeded.
  7. `finops_reconciliation_node`: Calculates exact token usage and persists session state to Firestore.

### 2.2 Spoke 1: Repository Housekeeper (`spokes/housekeeper/`)
- **Runtime:** Python 3.12 / FastMCP & FastAPI on Cloud Run (`https://spoke-housekeeper-60727530657.us-central1.run.app`).
- **Core Capabilities:**
  - `clean_repo_noise`: Identifies and removes ephemeral artifacts (`.DS_Store`, `__pycache__`, `.pytest_cache`, temp files).
  - `audit_markdown_and_schemas`: Recursively inspects markdown files for relative broken links, anchors, and missing references.
  - `validate_firestore_rules_and_indexes`: Audits `firestore.rules` and `firestore.indexes.json` against security vulnerabilities and composite indexing standards.
- **Asynchronous Execution:** Pulls tasks from `spoke-housekeeper-sub` topic. Automatically routes unparseable or malicious payloads to `agent-dlq`.

### 2.3 Spoke 2: Multimodal Video Ingest (`spokes/video-ingest/`)
- **Runtime:** Python 3.12 / FastMCP & FastAPI on Cloud Run (`https://spoke-video-ingest-60727530657.us-central1.run.app`).
- **Core Capabilities:**
  - `analyze_video_research`: Ingests YouTube URLs or GCS video blobs, analyzes frames and audio tracks using Gemini 1.5 / 2.0 Flash multimodal reasoning, and generates structured technical specifications.
  - **FinOps Duration Guardrail:** If video runtime exceeds 45 minutes (2,700s), an automatic pause is triggered requiring human supervisor approval before heavy processing.
  - **Artifact Export:** Persists compiled technical specs directly to `gs://agent-research-artifacts/{session_id}/research_compilation.md`.

### 2.4 Control Center Web UI (`ui/`)
- **Runtime:** Nginx Alpine reverse-proxy container hosting React 18, TypeScript, Tailwind CSS, and Lucide icons on Cloud Run (`https://hub-spoke-web-ui-60727530657.us-central1.run.app`).
- **Features:**
  - Real-time SSE task streaming with live step indicators.
  - Interactive Spoke dispatch console with payload editors.
  - Live FinOps token and cost reconciliation charts.
  - One-click Human-in-the-Loop (HITL) approval actions.
  - Distributed trace explorer and DLQ inspection monitor.

---

## 3. Data & Security Architecture

### 3.1 Contract Enforcement & DLQ Isolation
All inter-agent messages conform to strict JSON schemas:
- `AgentTaskRequest`: `trace_id` (UUIDv4), `source_app` (enum: `academy-apps`, `avventiq`, `core-hub`), `target_spoke`, `action`, `payload`, and optional `session_id`.
- Any malformed payload is intercepted prior to processing and quarantined to `projects/hub-spoke-agent-platform/topics/agent-dlq` with full stack traces and diagnostic tags.

### 3.2 Perimeter Security & Model Armor
- **Prompt Injection Defense:** Filters known jailbreaks, roleplay escapes, and prompt injection signatures.
- **PII Redaction:** Automatically scrubs credit card numbers, email addresses, and phone numbers before payloads reach LLM reasoning steps.
- **Principal Access Boundary (PAB):** Enforces multi-tenant isolation. Client applications (e.g. `academy-apps`) cannot dispatch tasks targeting restricted databases or spokes reserved for other tenants (e.g. `avventiq`).

### 3.3 State & Telemetry
- **State Store:** Cloud Firestore Native `(default)` database located in `us-central1`.
  - Collections: `agent_sessions`, `telemetry_records`, `audit_logs`, `hitl_tasks`.
- **Artifact Store:** Cloud Storage bucket `gs://agent-research-artifacts`.
- **Distributed Tracing:** OpenTelemetry SDK exported to Google Cloud Trace with standardized W3C `traceparent` headers propagation.
