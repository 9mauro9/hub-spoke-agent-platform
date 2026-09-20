# Hub-and-Spoke Agent Architecture Specification (Version 3.0 / AES v3 Standard)

## 1. Executive Summary & Architectural Vision
This consolidated specification defines a production-grade, event-driven, and self-improving Hub-and-Spoke (Orchestrator-Worker) Agent Architecture on Google Cloud Platform. Built upon Google Antigravity as the foundational development and agent harness framework, this platform supports multi-domain applications, automated development workflows, and enterprise ecosystems (such as Academy Apps and AvventiQ). It integrates stateful graph execution, Model Context Protocol (MCP) standardized tooling, strict message contracts, automated self-improvement loops, predictive financial governance, native Antigravity skill packaging, enterprise-grade GCP perimeter security, explicit Human-in-the-Loop (HITL) gateways, robust dead-letter queue (DLQ) error isolation, and operational fine-tuning protocols for real-world production deployments.

## 2. Core Architectural Components & Recommended GCP Tool Stack
| Layer | Recommended Tool / Service | Core Responsibility |
|---|---|---|
| **Agent Foundation & Harness** | Google Antigravity | Core development platform, agent execution framework, and skill orchestration engine. |
| **Orchestration & State Machine** | LangGraph / Agent Engine on Cloud Run | Manages deterministic graph execution, state transitions, step resumption, and compensation logic. |
| **Compute & Microservices** | Google Cloud Run | Serverless container execution for Master Orchestrator and specialized Spoke workers. |
| **Asynchronous Event Bus & DLQ** | Google Cloud Pub/Sub + Dead-Letter Queues | Decoupled asynchronous event passing with poisoned payload isolation to `agent-dlq`. |
| **State & Memory Store** | Google Cloud Firestore | Transactional persistence for session states, execution history, agent memory, and telemetry. |
| **Tool Interoperability** | Model Context Protocol (MCP) | Universal protocol exposing spoke capabilities securely via uniform, discoverable interfaces. |
| **Observability & Tracing** | OpenTelemetry + Cloud Trace | End-to-end request tracing across distributed hub-and-spoke message paths. |
| **Edge & Identity Perimeter** | Cloud Armor + Model Armor + VPC-SC | WAF, DDoS protection, prompt injection filtering, PII scrubbing, and Principal Access Boundary (PAB). |

## 3. Inter-Agent Messaging Contract, Schema Validation, & Dead-Letter Queues
All communication between the Hub and Spoke agents strictly adheres to JSON Schema specifications. Unstructured payloads are strictly prohibited.

### 3.1 Hub-to-Spoke Task Request Contract (`AgentTaskRequest`)
- `trace_id` (UUID): Unique OpenTelemetry distributed trace identifier.
- `session_id` (string): Stateful session identifier across multi-turn workflows.
- `source_app` (enum): Originating system (`academy-apps`, `avventiq`, `core-hub`).
- `target_spoke` (string): Destination worker ID (e.g., `spoke-housekeeper`).
- `action` (string): Action to execute (e.g., `clean_repo_noise`, `audit_markdown_and_schemas`).
- `payload` (object): Required `repository` and `target_files`, optional `branch`, `storage_uri`, `context_metadata`.

### 3.2 Spoke-to-Hub Task Response Contract (`AgentTaskResponse`)
- `trace_id` (UUID): Correlated distributed trace identifier.
- `session_id` (string): Stateful session identifier.
- `spoke_id` (string): Originating worker identity.
- `status` (enum): `success`, `failure`, `retry_required`.
- `execution_metrics` (object): Required `duration_ms` and `token_consumption`.
- `result_payload` (object): Optional `modified_files`, `storage_uri`, `error_logs`.

### 3.3 Dead-Letter Queue (DLQ) Protocol
- **Poisoned Payload Isolation:** Any Pub/Sub message failing schema validation or deserialization is immediately pushed to `agent-dlq`.
- **Introspection & Alerting:** Cloud Monitoring triggers high-priority alerts to operators without halting active orchestrator loops.

## 4. LangGraph State Machine & Human-in-the-Loop Gateways
The Hub utilizes a deterministic LangGraph workflow:
1. `init_state`: Loads session context from Firestore, sets up OpenTelemetry span.
2. `analyzer_agent`: Inspects target workspace files, prepares step plan.
3. `pre_execution_cost_estimator`: Computes token budget and price ceiling based on input metrics.
4. `dispatch_task`: Publishes validated task to the Spoke via Pub/Sub or RPC.
5. `validation_node`: Validates output against acceptance criteria. On error, triggers sliding context summary (max 3 retry cycles).
6. `hitl_approval_gate`: Pauses graph for high-risk operations (schema updates, PR creation) or when retry limit is reached.
7. `commit_telemetry`: Reconciles actual token consumption vs pre-execution estimates, stores state in Firestore.

## 5. Application-Specific Spoke Integration
- **Academy Apps:** Documentation Spoke (markdown cross-referencing, API sync) and Database Verification Spoke (Firestore composite indexes and rules validation).
- **AvventiQ:** Multi-Tenant RBAC Spoke (permission matrix checks) and Component Scaffolding Spoke (React/Tailwind component generation).

## 6. Self-Improvement & Adaptive Optimization Loop
- **Telemetry Capture:** Every transaction logs duration, tokens, tool invocations, and error diffs to Firestore.
- **Automated Reflection:** Evaluator runs cluster failure patterns to diagnose ambiguous prompt instructions or schema mismatch.
- **Dynamic Few-Shot Injection:** Successful execution runs are stored in Firestore few-shot collections and injected dynamically into future prompts.

## 7. Strategic Governance, Predictive Cost Control, & FinOps
- **Pre-Execution Estimation:** Analyzes character count, file tokens, and task type against model pricing matrices (Gemini 1.5 Pro / Flash).
- **Post-Execution Actuals:** Reconciles estimated vs actual token expenditure.
- **Sliding Context Window:** Summarizes compiler/lint diffs during retries to prevent token explosion.

## 8. Enterprise Google Cloud Security & Isolation
- **Edge Protection:** Google Cloud Armor WAF and Model Armor prompt injection filters and PII scrubbers.
- **Principal Access Boundary (PAB):** Prevents cross-tenant permission bleed between `academy-apps` and `avventiq`.
- **Ephemeral Spoke Lifecycle:** Cloud Run scale-to-zero (`min_instances: 0`) for worker spokes to prevent idle spend.

## 9. Production Deployment Topology (GCP Project: `hub-spoke-agent-platform`)
| Resource / Service | Name / ID | Configuration & SLA |
|---|---|---|
| **Google Cloud Project** | `hub-spoke-agent-platform` | Multi-tenant Agent Production Host |
| **Artifact Registry** | `agent-platform` (`us-central1`) | Multi-service Docker Repository |
| **Master Orchestrator** | `master-orchestrator` | Cloud Run, 2 vCPU, 2Gi, min: 1, max: 10, concurrency: 80 |
| **Worker Spoke 1** | `spoke-housekeeper` | Cloud Run, 1 vCPU, 1Gi, min: 0, max: 5, FastMCP /mcp |
| **Worker Spoke 2** | `spoke-video-ingest` | Cloud Run, 2 vCPU, 2Gi, min: 0, max: 10, timeout: 900s |
| **Web Control UI** | `hub-spoke-web-ui` | Cloud Run, Multi-stage Nginx + Vite React Dashboard |
| **Pub/Sub Topics** | `agent-tasks`, `agent-responses`, `agent-dlq` | Asynchronous contract dispatch & poison isolation |
| **Pub/Sub Subscriptions** | `spoke-housekeeper-sub`, `hub-responses-sub` | DLQ enabled with max 5 delivery attempts |
| **Cloud Firestore** | `(default)` in `us-central1` | Firestore Native (`agent_sessions`, `agent_telemetry`) |
| **Cloud Storage** | `gs://agent-research-artifacts` | Research specs, timestamped artifacts, Markdown outputs |

