# Hub & Spoke Agent Platform — Web Management Dashboard (AES v3 Standard)

A modern, terminal-free graphical control center providing visual orchestration, real-time agent observability, interactive Human-in-the-Loop (HITL) approvals, pre/post-execution FinOps tracking, and one-click dispatching across all registered Spokes.

## Architecture & Core Modules

- **Task Launcher Wizard (`LauncherView.tsx`):**
  - Eliminates CLI commands by providing contextual visual form wizards.
  - Automatically queries the Hub's `pre_execution_cost_estimator` node to project token consumption and compute costs in USD before execution.
  - Enforces Principal Access Boundaries (PAB) across tenant domains (`academy-apps`, `avventiq`, `core-hub`).

- **Live Graph & Execution Monitor (`MonitorView.tsx`):**
  - Powered by `@xyflow/react` (React Flow), rendering the deterministic LangGraph state machine:
    `init_state` ➔ `analyzer_agent` ➔ `pre_execution_cost_estimator` ➔ `dispatch_task` ➔ `validation_node` ➔ `hitl_approval_gate` ➔ `commit_telemetry`
  - Dynamic node status glow: **Green** (Complete), **Pulsing Blue** (Executing), **Yellow** (Paused for HITL), **Red** (Error/Retry).
  - Terminal-free slide-over drawer streaming Server-Sent Events (SSE) and real-time accumulated token counters.

- **Interactive Human-in-the-Loop (HITL) Gate (`HitlApprovalModal.tsx` & `DiffViewer.tsx`):**
  - Automatically triggers when LangGraph enters `hitl_approval_gate` or when the 3-cycle retry circuit breaker trips.
  - Interactive unified diff viewer highlighting additions, deletions, Firestore rules, and synthesized markdown summaries.
  - Operator controls: **Approve & Commit**, **Reject Task**, or **Provide Corrective Feedback** (injects human guidance back into the sliding-context retry loop).

- **FinOps & Governance Panel (`FinancialsView.tsx`):**
  - Reconciles pre-run token/cost projections against post-run actuals written to Cloud Firestore.
  - Expenditure breakdown across downstream tenants.
  - Monthly spending cap adjustment slider and emergency "HALT ALL AGENTS" master kill switch.

- **Spoke Registry & Health Probes (`RegistryView.tsx`):**
  - Status indicators, MCP JSON-RPC endpoints, and parameter schemas for `spoke-housekeeper` and `spoke-video-ingest`.

## Local Development Setup

### 1. Start the Hub Orchestrator Backend
From repository root:
```bash
source .venv/bin/activate
export PORT=8080
python -m hub.app.main
```
Backend will listen at `http://127.0.0.1:8080`.

### 2. Start the Vite Frontend Development Server
From `ui/web/`:
```bash
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

## SpokeOps Telemetry & Observability (AES v3 Standard)

The Web Management Dashboard natively integrates as an authorized Spoke into the **SpokeOps Master Observability Platform**:
- **Dual-Cadence Heartbeat:**
  - Emits active heartbeat pings every **2 minutes (120,000ms)** while active.
  - Automatically shifts down to an idle **5-minute (300,000ms)** cadence when `document.visibilityState === "hidden"`.
  - Dispatches session termination beacons via `navigator.sendBeacon` and `keepalive: true` on tab closure.
- **Operator RBAC Persona Switcher:**
  - Header controls allow toggling between `Operator`, `Admin`, and `Viewer`.
  - Enforces Principal Access Boundaries and emits `permission_denied` audit logs upon restricted route access attempts.
- **Workflow & Tool Audit Hooks:**
  - Emits `agent_task_started` on task dispatch.
  - Emits `agent_task_executed` for tool executions (`analyzer_agent`, `dispatch_task`, `validation_node`, etc.) with duration metrics.
  - Emits `policy_update` on HITL gate sign-offs and FinOps budget cap adjustments.

## Cloud Run & Container Deployment

### 1. Multi-Stage Container Build
The production container is built using multi-stage Docker packaging (`ui/Dockerfile`), compiling TypeScript and React static assets with Node.js and serving them with optimized Nginx:
```bash
# Build with Google Cloud Build
gcloud builds submit --tag=us-central1-docker.pkg.dev/hub-spoke-agent-platform/agent-platform/hub-spoke-web-ui:latest -f ui/Dockerfile ui/ --project=hub-spoke-agent-platform
```

### 2. Deploy to Google Cloud Run (Production)
Deploy to project `hub-spoke-agent-platform`:
```bash
gcloud run deploy hub-spoke-web-ui \
  --image=us-central1-docker.pkg.dev/hub-spoke-agent-platform/agent-platform/hub-spoke-web-ui:latest \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --project=hub-spoke-agent-platform
```

### 3. Service Verification
- **Production Dashboard URL:** [https://hub-spoke-web-ui-60727530657.us-central1.run.app](https://hub-spoke-web-ui-60727530657.us-central1.run.app)
- **SpokeOps Telemetry Ingestion Endpoint:** [https://spokeops-ingestion-541312712358.us-central1.run.app/api/v1/telemetry](https://spokeops-ingestion-541312712358.us-central1.run.app/api/v1/telemetry)
- **SpokeOps Central Console:** [https://spokeops-509217.web.app](https://spokeops-509217.web.app)
- **Health Check:**
```bash
curl https://hub-spoke-web-ui-60727530657.us-central1.run.app/healthz
```
- **Backend Proxy Verification:**
```bash
curl https://hub-spoke-web-ui-60727530657.us-central1.run.app/api/v1/spokes
```


