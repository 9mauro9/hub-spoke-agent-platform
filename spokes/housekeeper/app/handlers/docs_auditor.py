"""
Documentation & Schema Cross-Reference Auditor for Spoke Housekeeper.
Audits Markdown files for dead internal links, broken schema references, and syntax anomalies.
"""

from __future__ import annotations
import os
import re
from typing import Dict, Any, List, Optional


# Match markdown link targets: [text](target)
MD_LINK_REGEX = re.compile(r'\[([^\]]+)\]\(([^)]+)\)')
# Match schema references: schema: `path/to/schema.json` or $ref: "path/to/schema.json"
SCHEMA_REF_REGEX = re.compile(r'(?:["\'`])([a-zA-Z0-9_\-./]+\.json)(?:["\'`])')


def audit_markdown_and_schemas(
    repo_path: str,
    schemas_dir: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Audits Markdown files across repo_path for broken links and invalid schema references.
    """
    if not os.path.exists(repo_path):
        raise ValueError(f"Repository path does not exist: {repo_path}")

    scanned_md_files: List[str] = []
    broken_links: List[Dict[str, Any]] = []
    broken_schema_refs: List[Dict[str, Any]] = []
    valid_links_count = 0

    # Collect all markdown files
    for root, _, files in os.walk(repo_path):
        for f in files:
            if f.endswith(".md") or f.endswith(".markdown"):
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, repo_path)
                scanned_md_files.append(rel_path)

                try:
                    with open(full_path, "r", encoding="utf-8", errors="ignore") as md_file:
                        content = md_file.read()
                except Exception as e:
                    broken_links.append({
                        "file": rel_path,
                        "line": 0,
                        "target": "",
                        "error": f"Could not read file: {e}"
                    })
                    continue

                # Audit Markdown Links
                for lineno, line in enumerate(content.splitlines(), start=1):
                    for match in MD_LINK_REGEX.finditer(line):
                        link_text, link_target = match.groups()
                        # Skip web URLs or mailto
                        if link_target.startswith(("http://", "https://", "mailto:", "#")):
                            valid_links_count += 1
                            continue

                        # Handle anchor tags within target (e.g. docs/guide.md#section)
                        clean_target = link_target.split("#")[0]
                        if not clean_target:
                            valid_links_count += 1
                            continue

                        # Check if target exists relative to the md file or repo root
                        target_from_file = os.path.normpath(os.path.join(root, clean_target))
                        target_from_repo = os.path.normpath(os.path.join(repo_path, clean_target))

                        if not (os.path.exists(target_from_file) or os.path.exists(target_from_repo)):
                            broken_links.append({
                                "file": rel_path,
                                "line": lineno,
                                "link_text": link_text,
                                "target": link_target,
                                "error": "Target file or path does not exist",
                            })
                        else:
                            valid_links_count += 1

                # Audit Schema References
                if schemas_dir:
                    resolved_schemas_dir = (
                        schemas_dir
                        if os.path.isabs(schemas_dir)
                        else os.path.join(repo_path, schemas_dir)
                    )
                else:
                    resolved_schemas_dir = os.path.join(repo_path, "config", "schemas")

                for lineno, line in enumerate(content.splitlines(), start=1):
                    for match in SCHEMA_REF_REGEX.finditer(line):
                        schema_file = match.group(1)
                        # Only check if it looks like a schema reference
                        if "schema" in schema_file.lower() or schema_file in ("task_request.json", "task_response.json"):
                            schema_from_dir = os.path.join(resolved_schemas_dir, os.path.basename(schema_file))
                            schema_from_repo = os.path.join(repo_path, schema_file)
                            if not (os.path.exists(schema_from_dir) or os.path.exists(schema_from_repo)):
                                broken_schema_refs.append({
                                    "file": rel_path,
                                    "line": lineno,
                                    "schema_reference": schema_file,
                                    "error": "Referenced schema JSON file not found",
                                })

    return {
        "repository_path": repo_path,
        "scanned_markdown_files_count": len(scanned_md_files),
        "scanned_markdown_files": scanned_md_files,
        "valid_links_count": valid_links_count,
        "broken_links_count": len(broken_links),
        "broken_links": broken_links,
        "broken_schema_refs_count": len(broken_schema_refs),
        "broken_schema_refs": broken_schema_refs,
        "status": "success" if (not broken_links and not broken_schema_refs) else "issues_found",
    }
