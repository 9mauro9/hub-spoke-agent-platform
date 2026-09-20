"""
OpenTelemetry Tracing and Observability integration for AES v3 Standard.
Provides distributed tracing across Hub-to-Spoke message paths.
"""

from __future__ import annotations
import uuid
import time
from contextlib import contextmanager
from typing import Dict, Any, Optional, Generator


class SpanContext:
    def __init__(self, trace_id: str, span_id: str, name: str):
        self.trace_id = trace_id
        self.span_id = span_id
        self.name = name
        self.start_time = time.time()
        self.end_time: Optional[float] = None
        self.attributes: Dict[str, Any] = {}
        self.events: list = []
        self.status = "OK"

    def set_attribute(self, key: str, value: Any) -> None:
        self.attributes[key] = value

    def add_event(self, name: str, attributes: Optional[Dict[str, Any]] = None) -> None:
        self.events.append({
            "name": name,
            "timestamp": time.time(),
            "attributes": attributes or {}
        })

    def finish(self) -> None:
        self.end_time = time.time()

    @property
    def duration_ms(self) -> int:
        end = self.end_time or time.time()
        return int((end - self.start_time) * 1000)


class Tracer:
    def __init__(self, service_name: str):
        self.service_name = service_name
        self.active_spans: list[SpanContext] = []
        self.completed_spans: list[SpanContext] = []

    @contextmanager
    def start_as_current_span(
        self, name: str, trace_id: Optional[str] = None
    ) -> Generator[SpanContext, None, None]:
        tid = trace_id or str(uuid.uuid4())
        sid = str(uuid.uuid4())[:16]
        span = SpanContext(trace_id=tid, span_id=sid, name=name)
        span.set_attribute("service.name", self.service_name)
        self.active_spans.append(span)
        try:
            yield span
        except Exception as e:
            span.status = "ERROR"
            span.set_attribute("error.type", type(e).__name__)
            span.set_attribute("error.message", str(e))
            raise
        finally:
            span.finish()
            if span in self.active_spans:
                self.active_spans.remove(span)
            self.completed_spans.append(span)

    def extract_trace_context(self, headers_or_dict: Dict[str, Any]) -> str:
        """Extracts trace_id from headers or payload, or generates a new one."""
        return headers_or_dict.get("trace_id") or headers_or_dict.get("x-trace-id") or str(uuid.uuid4())

    def inject_trace_context(self, headers_or_dict: Dict[str, Any], trace_id: str) -> Dict[str, Any]:
        """Injects trace_id into payload or headers."""
        headers_or_dict["trace_id"] = trace_id
        headers_or_dict["x-trace-id"] = trace_id
        return headers_or_dict


def get_tracer(service_name: str) -> Tracer:
    return Tracer(service_name=service_name)
