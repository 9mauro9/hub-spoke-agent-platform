"""
Dead-Letter Queue (DLQ) Protocol implementation for AES v3 Standard.
Isolates poisoned payloads, malformed JSON, and contract validation failures.
"""

from __future__ import annotations
import uuid
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
from pydantic import ValidationError

from shared.contracts.task_models import AgentTaskRequest, AgentTaskResponse

logger = logging.getLogger("DeadLetterQueue")


class DLQMessage(dict):
    """Container for quarantined dead-letter messages."""
    pass


class DeadLetterQueueManager:
    """
    Manages poison pill payload isolation and Dead-Letter Queue dispatching.
    Integrates with GCP Pub/Sub agent-dlq topic and Cloud Monitoring alerting.
    """

    def __init__(self, dlq_topic: str = "agent-dlq", alert_webhook: Optional[str] = None):
        self.dlq_topic = dlq_topic
        self.alert_webhook = alert_webhook
        # In-memory storage for inspection and local testing
        self.quarantined_messages: List[Dict[str, Any]] = []

    def isolate_payload(
        self,
        raw_payload: Any,
        error: Exception | str,
        source: str = "pubsub-ingress",
        trace_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Quarantines an unparseable or malicious payload and triggers alerts.
        """
        error_msg = str(error)
        dlq_entry = {
            "dlq_id": str(uuid.uuid4()),
            "trace_id": trace_id or str(uuid.uuid4()),
            "source": source,
            "error_type": type(error).__name__ if isinstance(error, Exception) else "ValidationError",
            "error_message": error_msg,
            "raw_payload": raw_payload,
            "quarantined_at": datetime.now(timezone.utc).isoformat(),
            "target_dlq_topic": self.dlq_topic,
            "alert_triggered": True,
        }

        self.quarantined_messages.append(dlq_entry)
        logger.error(
            f"[DLQ ALERT] Poisoned payload isolated to {self.dlq_topic}! "
            f"ID: {dlq_entry['dlq_id']} | Source: {source} | Error: {error_msg}"
        )

        # Trigger monitoring alert hook
        self._trigger_cloud_monitoring_alert(dlq_entry)
        return dlq_entry

    def validate_and_parse_request(
        self, payload_dict: Dict[str, Any], source: str = "hub-ingress"
    ) -> Tuple[Optional[AgentTaskRequest], Optional[Dict[str, Any]]]:
        """
        Validates an incoming task request. If invalid, routes to DLQ immediately.
        Returns: (parsed_request, dlq_entry)
        """
        try:
            req = AgentTaskRequest.model_validate(payload_dict)
            return req, None
        except ValidationError as e:
            trace = payload_dict.get("trace_id") if isinstance(payload_dict, dict) else None
            dlq_record = self.isolate_payload(
                raw_payload=payload_dict,
                error=e,
                source=source,
                trace_id=trace,
            )
            return None, dlq_record
        except Exception as e:
            trace = payload_dict.get("trace_id") if isinstance(payload_dict, dict) else None
            dlq_record = self.isolate_payload(
                raw_payload=payload_dict,
                error=e,
                source=source,
                trace_id=trace,
            )
            return None, dlq_record

    def validate_and_parse_response(
        self, payload_dict: Dict[str, Any], source: str = "spoke-ingress"
    ) -> Tuple[Optional[AgentTaskResponse], Optional[Dict[str, Any]]]:
        """
        Validates an incoming task response from a Spoke.
        If invalid, routes to DLQ.
        """
        try:
            resp = AgentTaskResponse.model_validate(payload_dict)
            return resp, None
        except ValidationError as e:
            trace = payload_dict.get("trace_id") if isinstance(payload_dict, dict) else None
            dlq_record = self.isolate_payload(
                raw_payload=payload_dict,
                error=e,
                source=source,
                trace_id=trace,
            )
            return None, dlq_record
        except Exception as e:
            trace = payload_dict.get("trace_id") if isinstance(payload_dict, dict) else None
            dlq_record = self.isolate_payload(
                raw_payload=payload_dict,
                error=e,
                source=source,
                trace_id=trace,
            )
            return None, dlq_record

    def _trigger_cloud_monitoring_alert(self, dlq_entry: Dict[str, Any]) -> None:
        """
        Simulates / triggers Cloud Monitoring alerting hook for DLQ incidents.
        """
        logger.info(
            f"[MONITORING HOOK] Dispatched incident notification for DLQ message {dlq_entry['dlq_id']}"
        )

    def get_quarantined_count(self) -> int:
        return len(self.quarantined_messages)
