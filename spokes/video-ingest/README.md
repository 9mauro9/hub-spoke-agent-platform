# Spoke 2: Multimodal Video Ingest & Technical Extraction (`spoke-video-ingest`) — AES v3 Standard

The **Video Ingest Spoke** is a high-performance worker microservice designed to ingest public YouTube engineering talks and Google Cloud Storage technical video recordings. Using Gemini's native multimodal capabilities via the official `google-genai` SDK, it extracts deep architectural specifications, system diagrams, and schema contracts, streaming structured Markdown syntheses directly to Cloud Storage.

---

## 1. Core Capabilities

- **Direct Multimodal Ingestion:** Ingests video URIs directly using `types.Part.from_uri(file_uri=..., mime_type="video/*")` without downloading heavy video binaries to disk.
- **4-Part Technical Synthesis:**
  1. **Executive Architecture Overview:** Core purpose, architectural patterns, and design objectives.
  2. **Visual & Architectural Artifacts:** Mermaid flowcharts, diagrams, and timestamped keyframes `[MM:SS]`.
  3. **Code & API Contracts:** Data models, schema definitions, and function signatures extracted from on-screen slides and IDE code.
  4. **Operational Tradeoffs & Caveats:** Scalability bottlenecks, latency considerations, and failure modes.
- **FinOps Duration Gate:** Videos exceeding 45 minutes (2,700s) trigger `status: "retry_required"`, halting execution and requiring Human-in-the-Loop (HITL) gate sign-off before expensive model inference is initiated.
- **Sliding Context Window Compaction:** Wraps raw analysis in compressed metadata headers to avoid context window saturation for downstream agents.
- **Cloud Storage Streaming:** Syntheses are uploaded automatically to Google Cloud Storage at `gs://agent-research-artifacts/{session_id}/research_compilation.md`.

---

## 2. FastMCP Tool & REST Interfaces

### FastMCP Tool: `analyze_video_research`
- **Arguments:**
  - `youtube_url` (string, required): Public YouTube video URL or `gs://` video URI.
  - `research_focus` (string, optional): Specific technical area (e.g. "Firestore Data Model, Security Rules").
- **Returns:** GCS storage URI, token consumption metrics, and markdown synthesis snippet.

### REST & Pub/Sub Endpoints
- `POST /tasks/execute`: Processes incoming `AgentTaskRequest` envelopes (supports Pub/Sub push format).
- `POST /mcp`: FastMCP JSON-RPC 2.0 interface.
- `GET /health`: Microservice liveness and readiness probe.

---

## 3. Production Cloud Run & GCP Profile

| Parameter | Production Value |
|---|---|
| **Service Name** | `spoke-video-ingest` |
| **Service URL** | [https://spoke-video-ingest-60727530657.us-central1.run.app](https://spoke-video-ingest-60727530657.us-central1.run.app) |
| **GCP Project** | `hub-spoke-agent-platform` |
| **Region** | `us-central1` |
| **Runtime** | Python 3.11 |
| **Model** | `gemini-3.8-flash` |
| **GCS Research Bucket** | `gs://agent-research-artifacts` |
| **CPU / Memory** | `2 vCPU` / `2Gi` |
| **Min / Max Instances** | `0` (Scale to Zero) / `10` |
| **Request Timeout** | `900s` (15 minutes) |

