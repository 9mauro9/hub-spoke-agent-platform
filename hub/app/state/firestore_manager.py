"""
Google Cloud Firestore State & Session Persistence Manager for AES v3 Standard.
Persists session states, FinOps telemetry, audit logs, and HITL approval flags.
Dual-mode: uses real google-cloud-firestore if configured, otherwise high-fidelity in-memory.
"""

from __future__ import annotations
import os
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

logger = logging.getLogger("FirestoreStateManager")


class FirestoreStateManager:
    """
    Manages transactional state persistence in Firestore with an in-memory fallback.
    """

    def __init__(
        self,
        project_id: Optional[str] = None,
        database: str = "(default)",
        force_in_memory: bool = False,
    ):
        self.project_id = project_id or os.getenv("GCP_PROJECT", "hub-spoke-agent-platform")
        self.database = database
        self.force_in_memory = force_in_memory
        self.firestore_client = None

        # In-memory stores for testing, offline runs, and dev
        self._memory_sessions: Dict[str, Dict[str, Any]] = {}
        self._memory_telemetry: Dict[str, Dict[str, Any]] = {}
        self._memory_audit_logs: list[Dict[str, Any]] = []

        if not self.force_in_memory and os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
            try:
                from google.cloud import firestore
                self.firestore_client = firestore.Client(project=self.project_id, database=self.database)
                logger.info(f"Connected to Cloud Firestore in project '{self.project_id}'")
            except Exception as e:
                logger.warning(f"Could not connect to Cloud Firestore, using in-memory mode: {e}")
                self.firestore_client = None

    def save_session_state(self, session_id: str, state: Dict[str, Any]) -> None:
        """
        Saves or updates session state dictionary.
        """
        data = {
            **state,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        self._memory_sessions[session_id] = data

        if self.firestore_client:
            try:
                doc_ref = self.firestore_client.collection("agent_sessions").document(session_id)
                doc_ref.set(data, merge=True)
            except Exception as e:
                logger.error(f"Firestore write failed for session {session_id}: {e}")

    def get_session_state(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves session state dictionary by session_id.
        """
        if self.firestore_client:
            try:
                doc_ref = self.firestore_client.collection("agent_sessions").document(session_id)
                snapshot = doc_ref.get()
                if snapshot.exists:
                    return snapshot.to_dict()
            except Exception as e:
                logger.error(f"Firestore read failed for session {session_id}: {e}")

        return self._memory_sessions.get(session_id)

    def record_telemetry(self, session_id: str, telemetry_data: Dict[str, Any]) -> None:
        """
        Records reconciled token usage and execution metrics.
        """
        record = {
            "session_id": session_id,
            "recorded_at": datetime.now(timezone.utc).isoformat(),
            **telemetry_data,
        }
        self._memory_telemetry[session_id] = record

        if self.firestore_client:
            try:
                doc_ref = self.firestore_client.collection("agent_telemetry").document(session_id)
                doc_ref.set(record, merge=True)
            except Exception as e:
                logger.error(f"Firestore telemetry write failed for session {session_id}: {e}")

    def get_telemetry(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves telemetry for a session.
        """
        if self.firestore_client:
            try:
                doc_ref = self.firestore_client.collection("agent_telemetry").document(session_id)
                snap = doc_ref.get()
                if snap.exists:
                    return snap.to_dict()
            except Exception:
                pass
        return self._memory_telemetry.get(session_id)

    def record_audit_log(self, action: str, details: Dict[str, Any]) -> None:
        """
        Records platform audit event.
        """
        entry = {
            "action": action,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": details,
        }
        self._memory_audit_logs.append(entry)

        if self.firestore_client:
            try:
                self.firestore_client.collection("agent_audit_logs").add(entry)
            except Exception as e:
                logger.error(f"Firestore audit write failed: {e}")

    def approve_hitl(self, session_id: str, approver_id: str) -> bool:
        """
        Marks an interrupted HITL session as approved in Firestore.
        """
        state = self.get_session_state(session_id)
        if not state:
            return False

        state["hitl_approved"] = True
        state["approver_id"] = approver_id
        state["status"] = "APPROVED"
        self.save_session_state(session_id, state)
        self.record_audit_log("HITL_APPROVAL", {"session_id": session_id, "approver_id": approver_id})
        return True
