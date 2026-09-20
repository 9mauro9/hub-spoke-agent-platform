---
name: spoke-video-ingest
description: Analyzes public YouTube videos and Cloud Storage video recordings using Gemini multimodal reasoning to compile structured technical software specifications, architecture diagrams, and API contracts.
---

# Spoke Skill: Technical Video Researcher (`spoke-video-ingest`)

## Description
Analyzes public YouTube videos and Cloud Storage video recordings using Gemini multimodal reasoning to compile structured technical software specifications, architecture diagrams, and API contracts.

## Triggers & Scope
- Triggered when architectural research, reverse engineering, or technical synthesis is requested from video links.
- Target Spoke ID: `spoke-video-ingest`
- Primary Action: `parse_video_research`

## Progressive Disclosure of Available Tools

### 1. Multimodal Video Research Extraction (`analyze_video_research`)
- **Action ID:** `parse_video_research`
- **Tool Name:** `analyze_video_research`
- **Input Parameters:**
  - `youtube_url` (string, required): Full public YouTube URL (`https://www.youtube.com/watch?v=...`) or Cloud Storage URI (`gs://...`).
  - `research_focus` (string, required): Specific engineering subtopic or architectural extraction goal (e.g., "Firestore data model, security rules, and distributed caching").
  - `session_id` (string, optional): Stateful session ID for artifact indexing.
  - `hint_duration_seconds` (integer, optional): Video duration in seconds for FinOps duration gate checks.

- **Extraction Output Format:**
  The tool returns a GCS pointer to an exhaustive 4-part Markdown synthesis:
  1. **Executive Architecture Overview:** End-to-end design, paradigms, and technology stack.
  2. **Visual & Architectural Artifacts:** Detailed slide, sequence, and system diagrams with `[MM:SS]` video timestamps.
  3. **Code & API Contracts:** Transcribed schemas, configurations, and function signatures.
  4. **Operational Tradeoffs & Caveats:** Failure modes, scaling bottlenecks, and operational constraints.

## Operational Guardrails & FinOps
- **45-Minute Duration Gate:** Videos exceeding 45 minutes (2700 seconds) automatically return `status: "retry_required"`, pausing execution at the Hub's `hitl_approval_gate` for operator sign-off before LLM inference.
- **Context Compression:** Output synthesis is wrapped in metadata headers to prevent context saturation during downstream multi-agent consumption.
- **Direct Streaming:** Videos are ingested via URI reference without downloading local binaries, and compiled outputs are streamed directly to GCS at `gs://{GCS_RESEARCH_BUCKET}/{session_id}/research_compilation.md`.
