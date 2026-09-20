# Agentic Engineering Standard Version 3 (AES v3) Platform Guidelines

## 1. Architectural Boundary & Platform Isolation
- **Role:** This repository (`hub-spoke-agent-platform`) serves strictly as the foundational multi-agent infrastructure, orchestrator, and control plane.
- **Isolation Principle:** Application business logic for downstream target products (e.g., Academy Apps, AvventiQ) MUST NEVER be embedded directly within this platform.
- **External Targets:** Downstream applications are treated strictly as external targets accessed via standard Git repositories, GCP service identities, or remote Model Context Protocol (MCP) endpoints.

## 2. Contract Enforcement & Dead-Letter Isolation (Deliverable 2.1)
- **Strict Validation:** All inter-agent requests and responses must strictly validate against the JSON Schemas registered in `config/schemas/` (`AgentTaskRequest` and `AgentTaskResponse`).
- **Zero Unstructured Payloads:** Unstructured, loosely typed, or non-conforming JSON payloads are strictly forbidden.
- **Poison-Pill Quarantine:** Any message failing deserialization or schema validation must immediately be routed to the Dead-Letter Queue (`agent-dlq`) with forensic metadata and Cloud Monitoring alert triggers, without halting the orchestrator loop.

## 3. Orchestration & FinOps Governance (Deliverable 2.2)
- **Deterministic State Flows:** Workflows must be governed by LangGraph state machines on Google Cloud Run with the following baseline topology:
  `init_state` ➔ `analyzer_agent` ➔ `pre_execution_cost_estimator` ➔ `dispatch_task` ➔ `validation_node` ➔ `hitl_approval_gate` ➔ `commit_telemetry`.
- **Pre-Execution Cost Ceiling:** Prior to task dispatch, the orchestrator must compute an upfront token and financial cost estimate based on input file metrics, character counts, and model pricing tables.
- **Post-Execution Telemetry Reconciliation:** Actual input/output token metrics reported by spokes must be reconciled with pre-execution estimates and committed directly to Google Cloud Firestore.
- **Sliding Context Window & Anti-Token Bloat:** During recursive retry loops (e.g., compiler/lint failure cycles), raw diagnostic outputs must never be concatenated naively. The state machine must compute compacted error diff summaries, bounded strictly to 3 retry cycles.
- **Circuit Breaker:** If a spoke fails 3 consecutive cycles on a single task, the orchestrator opens the circuit breaker, logs an incident, and escalates directly to Human-in-the-Loop (HITL) review.

## 4. Spoke Standardization & Progressive Disclosure (Deliverable 2.3)
- **Universal Tooling Protocol:** Every Spoke must expose its functional capabilities through a standard Model Context Protocol (MCP) interface running as a Cloud Run microservice.
- **Progressive Disclosure:** Agent skill definitions in `.agents/skills/<spoke-name>/SKILL.md` must present high-level intent and trigger criteria upfront, revealing tool arguments and schemas only when an action is selected.
- **Scale-to-Zero Optimization:** Spoke services must be configured with `min_instances: 0` to eliminate idle compute spend while maintaining rapid ephemeral spin-up.

## 5. Enterprise Perimeter Security & Cross-Project Isolation (Deliverable 2.4)
- **Edge Ingress Protection:** All external traffic must traverse Google Cloud Armor (WAF/DDoS) and Model Armor extensions to block prompt injections and sanitize PII at the edge.
- **Principal Access Boundary (PAB):** Cross-tenant permissions are strictly enforced. Runtimes operating under an `academy-apps` context cannot access `avventiq` resources, preventing permission bleed.
- **VPC Service Controls:** Platform services operate within an organization-level service perimeter.
