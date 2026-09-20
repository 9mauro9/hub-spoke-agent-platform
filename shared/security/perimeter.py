"""
GCP Edge Security, Cloud Armor WAF, and Model Armor Extension Simulator for AES v3.
Provides prompt injection filtering and PII scrubbing at the ingress perimeter.
"""

from __future__ import annotations
import re
from typing import Dict, Any, Tuple, List, Optional


class SecurityException(Exception):
    """Raised when an ingress payload fails security perimeter policies."""
    pass


# High-confidence prompt injection heuristics
PROMPT_INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|prior)\s+instructions",
    r"disregard\s+(all\s+)?(previous|prior)\s+rules",
    r"system\s+override",
    r"bypass\s+all\s+(security|guardrails|filters)",
    r"you\s+are\s+now\s+(in\s+)?dan\s+mode",
    r"reveal\s+(your\s+)?(system\s+prompt|developer\s+instructions)",
    r"exfiltrate\s+credentials",
    r"roleplay\s+as\s+an\s+unfiltered\s+ai",
]

# PII regex matchers
PII_PATTERNS = {
    "EMAIL": r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+",
    "CREDIT_CARD": r"\b(?:\d{4}[-\s]?){3}\d{4}\b",
    "SSN": r"\b\d{3}-\d{2}-\d{4}\b",
    "API_KEY": r"\b(?:AIza[0-9A-Za-z-_]{30,40}|sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{30,})\b",
    "PHONE": r"\b(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b",
}


class PerimeterSecurityManager:
    """
    Simulates Google Cloud Armor and Model Armor ingress inspection.
    """

    def __init__(
        self,
        block_prompt_injection: bool = True,
        scrub_pii: bool = True,
    ):
        self.block_prompt_injection = block_prompt_injection
        self.scrub_pii = scrub_pii
        self.compiled_injections = [
            re.compile(p, re.IGNORECASE) for p in PROMPT_INJECTION_PATTERNS
        ]

    def detect_prompt_injection(self, text: str) -> Tuple[bool, Optional[str]]:
        """
        Inspects input text for prompt injection and jailbreak signatures.
        """
        for pattern in self.compiled_injections:
            match = pattern.search(text)
            if match:
                return True, match.group(0)
        return False, None

    def scrub_text_pii(self, text: str) -> Tuple[str, List[str]]:
        """
        Scans and redacts sensitive PII from string inputs.
        """
        redacted = text
        detected_types: List[str] = []

        for pii_type, pattern in PII_PATTERNS.items():
            matches = re.findall(pattern, redacted)
            if matches:
                detected_types.append(pii_type)
                redacted = re.sub(pattern, f"[REDACTED_{pii_type}]", redacted)

        return redacted, detected_types

    def inspect_and_sanitize_payload(
        self, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Recursively scans strings in payload, blocks injections, and redacts PII.
        """
        def _walk(item: Any) -> Any:
            if isinstance(item, str):
                if self.block_prompt_injection:
                    is_injected, match = self.detect_prompt_injection(item)
                    if is_injected:
                        raise SecurityException(
                            f"Model Armor Ingress Violation: Detected prompt injection pattern '{match}'"
                        )
                if self.scrub_pii:
                    sanitized, _ = self.scrub_text_pii(item)
                    return sanitized
                return item
            elif isinstance(item, dict):
                return {k: _walk(v) for k, v in item.items()}
            elif isinstance(item, list):
                return [_walk(elem) for elem in item]
            return item

        return _walk(payload)
