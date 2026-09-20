---
name: spoke-housekeeper
description: Housekeeper Spoke skill for the Hub-and-Spoke Agent Platform. Performs repository noise cleanup, documentation and link auditing, and Firestore composite index and security rules validation under AES v3.
---

# Spoke Housekeeper Agent (MVP Baseline Spoke)

The `spoke-housekeeper` is a specialized worker agent deployed as a containerized microservice and Model Context Protocol (MCP) server.

## Trigger Criteria
Activate this skill when:
- Cleaning repository clutter (`.DS_Store`, `__pycache__`, `.pytest_cache`, orphaned build artifacts or test logs).
- Auditing Markdown documentation for broken internal links, schema references, or formatting consistency.
- Validating Google Cloud Firestore security rules (`firestore.rules`) and composite index configurations (`firestore.indexes.json`) against application schemas.

## Progressive Disclosure of Available Tools

### 1. Repository Clutter Cleaning (`clean_repo_noise`)
- **Action ID:** `clean_repo_noise`
- **Parameters:**
  - `repository_path` (string, required): Absolute or relative path to target repository root.
  - `dry_run` (boolean, optional, default: false): If true, returns candidate files without deleting them.
- **Output:** List of deleted/targeted files and total bytes reclaimed.

### 2. Documentation & Schema Cross-Reference Audit (`audit_markdown_and_schemas`)
- **Action ID:** `audit_markdown_and_schemas`
- **Parameters:**
  - `repository_path` (string, required): Path to repository root containing docs and schemas.
  - `schemas_dir` (string, optional): Directory containing JSON schema definitions.
- **Output:** Report detailing broken relative links, missing schema references, and syntax anomalies.

### 3. Firestore Rules & Composite Indexes Validation (`validate_firestore_rules_and_indexes`)
- **Action ID:** `validate_firestore_rules_and_indexes`
- **Parameters:**
  - `rules_file_path` (string, required): Path to `firestore.rules`.
  - `indexes_file_path` (string, optional): Path to `firestore.indexes.json`.
  - `schemas_dir` (string, optional): Directory containing entity collection schemas.
- **Output:** Audit verdict, syntax validity, unindexed compound query risks, and overly permissive wildcard rules.

## Protocol Integration
- **MCP Server Endpoint:** `http://spoke-housekeeper:8080/mcp` or stdio protocol.
- **Pub/Sub Worker Topic:** Consumes from `agent-tasks`, publishes responses to `agent-responses`.
- **Response Format:** Strictly conforms to `AgentTaskResponse` (`config/schemas/task_response.json`).
