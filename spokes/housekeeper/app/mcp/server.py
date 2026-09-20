"""
Model Context Protocol (MCP) Server for Spoke Housekeeper.
Exposes standardized tools for repository cleanup, documentation auditing, and Firestore validation.
"""

from __future__ import annotations
import json
from typing import Dict, Any, List, Optional

from spokes.housekeeper.app.handlers.repo_cleaner import clean_repo_noise
from spokes.housekeeper.app.handlers.docs_auditor import audit_markdown_and_schemas
from spokes.housekeeper.app.handlers.firestore_validator import validate_firestore_rules_and_indexes


# Formal MCP Tool Definitions adhering to Model Context Protocol specification
MCP_TOOLS = [
    {
        "name": "clean_repo_noise",
        "description": "Scans and cleans development noise, OS artifacts (.DS_Store), build caches, and test logs.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "repository_path": {
                    "type": "string",
                    "description": "Absolute or relative path to the target repository."
                },
                "dry_run": {
                    "type": "boolean",
                    "default": False,
                    "description": "If true, identifies files without deleting them."
                },
                "noise_patterns": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Optional custom glob patterns to match and purge."
                }
            },
            "required": ["repository_path"]
        }
    },
    {
        "name": "audit_markdown_and_schemas",
        "description": "Audits Markdown documentation for broken internal links and missing schema JSON references.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "repository_path": {
                    "type": "string",
                    "description": "Path to the repository to audit."
                },
                "schemas_dir": {
                    "type": "string",
                    "description": "Optional directory containing JSON schemas."
                }
            },
            "required": ["repository_path"]
        }
    },
    {
        "name": "validate_firestore_rules_and_indexes",
        "description": "Validates Firestore security rules and composite indexes against security standards and schemas.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "repository_path": {
                    "type": "string",
                    "description": "Path to the repository root."
                },
                "rules_file": {
                    "type": "string",
                    "default": "firestore.rules",
                    "description": "Name of rules file."
                },
                "indexes_file": {
                    "type": "string",
                    "default": "firestore.indexes.json",
                    "description": "Name of indexes file."
                }
            },
            "required": ["repository_path"]
        }
    }
]


class HousekeeperMCPServer:
    """
    Standard Model Context Protocol (MCP) server for Spoke Housekeeper.
    """

    def __init__(self, server_name: str = "spoke-housekeeper-mcp"):
        self.server_name = server_name
        self.tools = {tool["name"]: tool for tool in MCP_TOOLS}

    def list_tools(self) -> List[Dict[str, Any]]:
        """Returns the list of available MCP tools."""
        return list(self.tools.values())

    def call_tool(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes an MCP tool by name with arguments.
        """
        if name not in self.tools:
            return {
                "isError": True,
                "content": [{"type": "text", "text": f"Unknown tool: {name}"}]
            }

        try:
            if name == "clean_repo_noise":
                repo_path = arguments.get("repository_path", ".")
                dry_run = arguments.get("dry_run", False)
                patterns = arguments.get("noise_patterns")
                result = clean_repo_noise(repo_path=repo_path, dry_run=dry_run, noise_patterns=patterns)

            elif name == "audit_markdown_and_schemas":
                repo_path = arguments.get("repository_path", ".")
                schemas_dir = arguments.get("schemas_dir")
                result = audit_markdown_and_schemas(repo_path=repo_path, schemas_dir=schemas_dir)

            elif name == "validate_firestore_rules_and_indexes":
                repo_path = arguments.get("repository_path", ".")
                rules_file = arguments.get("rules_file", "firestore.rules")
                indexes_file = arguments.get("indexes_file", "firestore.indexes.json")
                result = validate_firestore_rules_and_indexes(
                    repo_path=repo_path, rules_file=rules_file, indexes_file=indexes_file
                )
            else:
                return {
                    "isError": True,
                    "content": [{"type": "text", "text": f"Unimplemented tool: {name}"}]
                }

            return {
                "isError": False,
                "content": [{"type": "text", "text": json.dumps(result, indent=2)}],
                "raw_result": result,
            }

        except Exception as e:
            return {
                "isError": True,
                "content": [{"type": "text", "text": f"Tool execution failed: {str(e)}"}]
            }

    def handle_json_rpc(self, request_json: str) -> str:
        """
        Handles standard JSON-RPC 2.0 requests for MCP stdio / HTTP transport.
        """
        try:
            req = json.loads(request_json)
            msg_id = req.get("id")
            method = req.get("method")

            if method == "tools/list":
                return json.dumps({
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "result": {"tools": self.list_tools()}
                })
            elif method == "tools/call":
                params = req.get("params", {})
                name = params.get("name")
                args = params.get("arguments", {})
                tool_resp = self.call_tool(name=name, arguments=args)
                return json.dumps({
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "result": tool_resp
                })
            else:
                return json.dumps({
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "error": {"code": -32601, "message": f"Method not found: {method}"}
                })
        except Exception as e:
            return json.dumps({
                "jsonrpc": "2.0",
                "id": None,
                "error": {"code": -32700, "message": f"Parse error: {str(e)}"}
            })
