# Changelog

All notable changes to SpokeOps will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and [Mauro Development Standards (m-dev-standards)](https://github.com/9mauro9/hub-spoke-agent-platform).

## [1.1.0] - 2026-09-26

### Added
- **Telemetry Range Extension**:
  - Support for 30-day (`30d`) and all-time (`ALL`) queries across all telemetry views.
  - Centralized lower bound calculation in `telemetryStore` with a 7-day cold-query threshold.
- **Cursor-Based Pagination**:
  - Incremental data fetching for `/api/v1/sessions` and `/api/v1/events` with `limit`, `cursor`, and `range` query parameters.
  - Client hooks (`useSessions`, `useAuditLogs`) with cursor accumulation, `loadMore`, and `hasMore` state.
- **Resilient UI & Fallback Empty States**:
  - Non-blocking shimmer progress indicators (`isColdQueryLoading`) for queries spanning beyond 7 days.
  - Contextual empty state card when 0 transactions are found in historical ranges (>7d), providing an immediate action button to reset to the default 24-hour range.
  - Composite index warning banner with direct Google Cloud Console indexing deep links when encountering Firestore `FAILED_PRECONDITION` index requirements.
- **Composite Firestore Indexes**:
  - Defined compound indexes on `sessions` (`active`, `lastPingTimestamp desc`) and `events` (`range`, `timestamp desc`) in `firestore.indexes.json`.

### Changed
- Standardized architectural compliance under `m-dev-standards`, completely deprecating AES v3.
- Enforced zero-lateral-import invariants across spoke visual components and stores.
- Header responsive layout enhanced to prevent flex wrapping at 1280px, 1440px, and 1920px viewports.

## [1.0.0] - 2026-09-20

### Added
- Initial release of SpokeOps telemetry ingestion, RBAC observability, and session monitoring platform.
- Multi-spoke telemetry visualization dashboard and audit explorer.

[1.1.0]: https://github.com/9mauro9/hub-spoke-agent-platform/releases/tag/v1.1.0
[1.0.0]: https://github.com/9mauro9/hub-spoke-agent-platform/releases/tag/v1.0.0

