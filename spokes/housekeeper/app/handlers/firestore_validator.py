"""
Firestore Composite Index and Security Rules Validator for Spoke Housekeeper.
Audits firestore.rules and firestore.indexes.json for security risks and missing indexes.
"""

from __future__ import annotations
import os
import re
import json
from typing import Dict, Any, List, Optional


class FirestoreAuditResult:
    def __init__(self):
        self.is_valid = True
        self.security_warnings: List[Dict[str, Any]] = []
        self.index_warnings: List[Dict[str, Any]] = []
        self.recommendations: List[str] = []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "valid": self.is_valid and len(self.security_warnings) == 0,
            "security_warnings_count": len(self.security_warnings),
            "security_warnings": self.security_warnings,
            "index_warnings_count": len(self.index_warnings),
            "index_warnings": self.index_warnings,
            "recommendations": self.recommendations,
        }


def validate_firestore_rules_and_indexes(
    repo_path: str,
    rules_file: str = "firestore.rules",
    indexes_file: str = "firestore.indexes.json",
) -> Dict[str, Any]:
    """
    Inspects Firestore security rules and index definitions.
    """
    result = FirestoreAuditResult()
    rules_path = os.path.join(repo_path, rules_file)
    indexes_path = os.path.join(repo_path, indexes_file)

    # 1. Audit Security Rules
    if os.path.isfile(rules_path):
        try:
            with open(rules_path, "r", encoding="utf-8") as rf:
                rules_text = rf.read()

            # Check rules version
            if "rules_version = '2'" not in rules_text and 'rules_version = "2"' not in rules_text:
                result.security_warnings.append({
                    "file": rules_file,
                    "severity": "MEDIUM",
                    "issue": "Missing or outdated 'rules_version = 2' declaration.",
                })
                result.recommendations.append("Specify rules_version = '2' at top of firestore.rules.")

            # Check for unauthenticated global access
            insecure_matches = re.finditer(
                r'allow\s+(?:read|write|read,\s*write|write,\s*read)\s*:\s*if\s+true\s*;',
                rules_text,
                re.IGNORECASE,
            )
            for m in insecure_matches:
                result.security_warnings.append({
                    "file": rules_file,
                    "severity": "CRITICAL",
                    "issue": "Overly permissive rule detected: 'allow ... : if true;' grants unauthenticated public access.",
                    "snippet": m.group(0),
                })
                result.recommendations.append("Enforce 'request.auth != null' or granular role checks.")

            # Check for missing write restrictions
            if "request.auth" not in rules_text:
                result.security_warnings.append({
                    "file": rules_file,
                    "severity": "HIGH",
                    "issue": "No authentication checks ('request.auth') detected anywhere in security rules.",
                })

        except Exception as e:
            result.is_valid = False
            result.security_warnings.append({
                "file": rules_file,
                "severity": "ERROR",
                "issue": f"Failed to parse firestore.rules: {e}",
            })
    else:
        result.recommendations.append(f"No {rules_file} found in repository root.")

    # 2. Audit Firestore Indexes
    if os.path.isfile(indexes_path):
        try:
            with open(indexes_path, "r", encoding="utf-8") as idxf:
                indexes_data = json.load(idxf)

            if not isinstance(indexes_data, dict):
                result.is_valid = False
                result.index_warnings.append({
                    "file": indexes_file,
                    "severity": "HIGH",
                    "issue": "Root JSON element must be an object containing 'indexes' array.",
                })
            else:
                indexes_list = indexes_data.get("indexes", [])
                if not isinstance(indexes_list, list):
                    result.index_warnings.append({
                        "file": indexes_file,
                        "severity": "HIGH",
                        "issue": "'indexes' key must be an array.",
                    })
                else:
                    seen_combos = set()
                    for idx_item in indexes_list:
                        col_group = idx_item.get("collectionGroup")
                        fields = idx_item.get("fields", [])
                        if not col_group or not fields:
                            result.index_warnings.append({
                                "file": indexes_file,
                                "severity": "MEDIUM",
                                "issue": f"Malformed index item: missing collectionGroup or fields: {idx_item}",
                            })
                            continue

                        field_names = tuple(f.get("fieldPath") for f in fields if isinstance(f, dict))
                        combo_key = (col_group, field_names)
                        if combo_key in seen_combos:
                            result.index_warnings.append({
                                "file": indexes_file,
                                "severity": "LOW",
                                "issue": f"Duplicate composite index definition for collection '{col_group}': {field_names}",
                            })
                        seen_combos.add(combo_key)

        except json.JSONDecodeError as jde:
            result.is_valid = False
            result.index_warnings.append({
                "file": indexes_file,
                "severity": "CRITICAL",
                "issue": f"Invalid JSON in {indexes_file}: {jde}",
            })
        except Exception as e:
            result.is_valid = False
            result.index_warnings.append({
                "file": indexes_file,
                "severity": "ERROR",
                "issue": f"Failed to read {indexes_file}: {e}",
            })
    else:
        result.recommendations.append(f"No {indexes_file} found in repository root.")

    return result.to_dict()
