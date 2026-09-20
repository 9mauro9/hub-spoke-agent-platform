"""
Principal Access Boundary (PAB) & Cross-Project Isolation for AES v3 Standard.
Prevents cross-tenant permission bleed across multi-domain target applications.
"""

from __future__ import annotations
from typing import Dict, Any, List, Optional


class PABViolationException(Exception):
    """Raised when an agent violates Principal Access Boundary policies."""
    pass


class PrincipalAccessBoundaryManager:
    """
    Enforces tenant isolation boundaries between downstream application domains
    (e.g., separating Academy Apps from AvventiQ).
    """

    def __init__(self, enforce_strict_isolation: bool = True):
        self.enforce_strict_isolation = enforce_strict_isolation
        # Define allowed resource patterns per application domain
        self.domain_patterns = {
            "academy-apps": ["academy", "library", "timeliner", "builder", "insight", "toolkit"],
            "avventiq": ["avventiq", "rbac", "tenant", "avventiq-portal"],
            "core-hub": ["*"],  # Platform control plane has global orchestration scope
        }

    def validate_access(self, source_app: str, repository: str) -> bool:
        """
        Validates that source_app is permitted to access the target repository.
        """
        if not self.enforce_strict_isolation:
            return True

        if source_app not in self.domain_patterns:
            raise PABViolationException(
                f"PAB Violation: Unknown or untrusted source application '{source_app}'"
            )

        allowed_keywords = self.domain_patterns[source_app]
        if "*" in allowed_keywords:
            return True

        repo_lower = repository.lower()

        # Check for cross-tenant breach attempt
        if source_app == "academy-apps":
            for foreign in self.domain_patterns["avventiq"]:
                if foreign in repo_lower:
                    raise PABViolationException(
                        f"PAB Cross-Tenant Bleed Blocked: Source '{source_app}' "
                        f"attempted to access restricted AvventiQ target '{repository}'"
                    )

        if source_app == "avventiq":
            for foreign in self.domain_patterns["academy-apps"]:
                if foreign in repo_lower:
                    raise PABViolationException(
                        f"PAB Cross-Tenant Bleed Blocked: Source '{source_app}' "
                        f"attempted to access restricted Academy Apps target '{repository}'"
                    )

        return True
