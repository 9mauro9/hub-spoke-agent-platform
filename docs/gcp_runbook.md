# Hub-and-Spoke Agent Platform: GCP Operations Runbook

## 1. Google Cloud Environment Details

| Property | Value |
|---|---|
| **Google Cloud Project ID** | `hub-spoke-agent-platform` |
| **Google Cloud Project Number** | `60727530657` |
| **Primary Deployment Region** | `us-central1` |
| **Artifact Registry Repository** | `us-central1-docker.pkg.dev/hub-spoke-agent-platform/agent-platform` |
| **Billing Account** | `016492-1F2CD6-BE4A40` |

---

## 2. Production Service Endpoints

All core platform and observability services are deployed and operational on Google Cloud Run and Firebase:

| Service Name | Description | Cloud Run / Hosting URL | Health Endpoint |
|---|---|---|---|
| **`master-orchestrator`** | Central Hub Orchestrator (FastAPI + LangGraph) | `https://master-orchestrator-60727530657.us-central1.run.app` | `GET /health` |
| **`spoke-housekeeper`** | Spoke 1 Housekeeper (FastMCP + Pub/Sub Worker) | `https://spoke-housekeeper-60727530657.us-central1.run.app` | `GET /health` |
| **`spoke-video-ingest`** | Spoke 2 Video Ingest (Multimodal Gemini Ingest) | `https://spoke-video-ingest-60727530657.us-central1.run.app` | `GET /health` |
| **`hub-spoke-web-ui`** | Web Control Center (React UI + Nginx Proxy) | `https://hub-spoke-web-ui-60727530657.us-central1.run.app` | `GET /healthz` |
| **`spokeops-ingestion`** | SpokeOps Central Telemetry Ingestion API | `https://spokeops-ingestion-541312712358.us-central1.run.app` | `GET /api/v1/health` |
| **`spokeops-509217`** | SpokeOps Master Operations Console | `https://spokeops-509217.web.app` | `GET /` |

---

## 3. Cloud Resources Provisioning

### 3.1 Pub/Sub Topics & Subscriptions
```bash
# Topics
gcloud pubsub topics create agent-tasks --project=hub-spoke-agent-platform
gcloud pubsub topics create agent-responses --project=hub-spoke-agent-platform
gcloud pubsub topics create agent-dlq --project=hub-spoke-agent-platform

# Dead Letter Queue Subscription
gcloud pubsub subscriptions create spoke-housekeeper-sub \
  --topic=agent-tasks \
  --dead-letter-topic=agent-dlq \
  --max-delivery-attempts=5 \
  --project=hub-spoke-agent-platform

# Orchestrator Response Subscription
gcloud pubsub subscriptions create hub-responses-sub \
  --topic=agent-responses \
  --project=hub-spoke-agent-platform
```

### 3.2 Cloud Firestore
- **Instance:** `(default)`
- **Database Type:** Firestore Native
- **Location:** `us-central1`
- **Security Rules:** `shared/security/firestore.rules`

### 3.3 Cloud Storage
- **Artifact Bucket:** `gs://agent-research-artifacts`
- **Location:** `us-central1`
- **Access Control:** Uniform bucket-level access

---

## 4. Build & Deployment Commands

### 4.1 Master Orchestrator
```bash
gcloud builds submit . \
  --config=hub/cloudbuild.yaml \
  --project=hub-spoke-agent-platform

gcloud run deploy master-orchestrator \
  --image=us-central1-docker.pkg.dev/hub-spoke-agent-platform/agent-platform/master-orchestrator:latest \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --set-env-vars=GCP_PROJECT=hub-spoke-agent-platform,GCP_REGION=us-central1,PUBSUB_TASKS_TOPIC=agent-tasks,PUBSUB_RESPONSES_TOPIC=agent-responses,PUBSUB_DLQ_TOPIC=agent-dlq,FIRESTORE_DATABASE=(default),GCS_BUCKET=agent-research-artifacts \
  --project=hub-spoke-agent-platform
```

### 4.2 Spoke 1: Housekeeper
```bash
gcloud builds submit . \
  --config=spokes/housekeeper/cloudbuild.yaml \
  --project=hub-spoke-agent-platform

gcloud run deploy spoke-housekeeper \
  --image=us-central1-docker.pkg.dev/hub-spoke-agent-platform/agent-platform/spoke-housekeeper:latest \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --set-env-vars=GCP_PROJECT=hub-spoke-agent-platform,PUBSUB_SUBSCRIPTION=spoke-housekeeper-sub,PUBSUB_DLQ_TOPIC=agent-dlq \
  --project=hub-spoke-agent-platform
```

### 4.3 Spoke 2: Video Ingest
```bash
gcloud builds submit . \
  --config=spokes/video-ingest/cloudbuild.yaml \
  --project=hub-spoke-agent-platform

gcloud run deploy spoke-video-ingest \
  --image=us-central1-docker.pkg.dev/hub-spoke-agent-platform/agent-platform/spoke-video-ingest:latest \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --set-env-vars=GCP_PROJECT=hub-spoke-agent-platform,GCS_BUCKET=agent-research-artifacts \
  --project=hub-spoke-agent-platform
```

### 4.4 Web Control Center UI
Build and deploy the React UI with SpokeOps Telemetry Client:
```bash
gcloud builds submit \
  --tag=us-central1-docker.pkg.dev/hub-spoke-agent-platform/agent-platform/hub-spoke-web-ui:latest \
  -f ui/Dockerfile ui/ \
  --project=hub-spoke-agent-platform

gcloud run deploy hub-spoke-web-ui \
  --image=us-central1-docker.pkg.dev/hub-spoke-agent-platform/agent-platform/hub-spoke-web-ui:latest \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --project=hub-spoke-agent-platform
```

---

## 5. Verification & Health Monitoring

### 5.1 Automated Backend & Contract Test Suite
Run local unit and integration tests:
```bash
./.venv/bin/pytest -v
```
*(All 30 unit and integration tests covering FinOps, DLQ, FastMCP, Model Armor, and LangGraph workflow)*

### 5.2 SpokeOps Telemetry Client Test Suite
Execute the frontend client SDK verification:
```bash
npx tsx ui/web/test/spokeOpsClient.test.ts
```
*(Validates dual-cadence timer, OWASP secret redaction, unload beacon fallback, and tenant token authentication)*

### 5.3 End-to-End AES v3 Verification Script
Run the automated end-to-end verification script:
```bash
./.venv/bin/python verify_platform.py
```
This validates all core AES v3 requirements against live or local components and generates `docs/aes_v3_compliance_report.md`.

### 5.4 Live Endpoint Health Checks
```bash
# Core Hub-and-Spoke Services
curl -i https://master-orchestrator-60727530657.us-central1.run.app/health
curl -i https://spoke-housekeeper-60727530657.us-central1.run.app/health
curl -i https://spoke-video-ingest-60727530657.us-central1.run.app/health
curl -i https://hub-spoke-web-ui-60727530657.us-central1.run.app/healthz

# SpokeOps Observability Services
curl -i https://spokeops-ingestion-541312712358.us-central1.run.app/api/v1/health
curl -i https://spokeops-509217.web.app
```

### 5.5 Verify SpokeOps Live Ingestion Pipeline
Verify that telemetry payloads from `hub-spoke-agent-platform` are successfully ingested:
```bash
curl -X POST https://spokeops-ingestion-541312712358.us-central1.run.app/api/v1/telemetry \
  -H "Content-Type: application/json" \
  -H "x-spoke-token: spk_live_hubspoke_b82f109" \
  -d '{
    "appId": "hub-spoke-agent-platform",
    "sessionId": "runbook-verify-session",
    "eventType": "heartbeat",
    "timestamp": "2026-09-20T18:00:00Z",
    "userId": "platform-operator-1",
    "userRole": "platform_operator",
    "state": "active",
    "environment": "production"
  }'
```
Expected response:
```json
{"status":"accepted","received":true,"sessionId":"runbook-verify-session"}
```
