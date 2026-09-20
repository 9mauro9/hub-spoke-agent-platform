"""
Model Context Protocol (MCP) Server for spoke-video-ingest.
Exposes standardized tools for multimodal video research and architecture extraction.
Conforms to AES v3 Standard and Hub-and-Spoke Specification Version 1.0.
"""

from __future__ import annotations
import json
import uuid
import logging
from typing import Dict, Any, List, Optional

from ..video_parser import VideoResearchParser
from ..storage import ResearchStorageManager

logger = logging.getLogger("VideoIngestMCPServer")

MCP_TOOLS = [
    {
        "name": "analyze_video_research",
        "description": "Analyzes a public technical YouTube video or GCS recording, extracting architecture overviews, visual diagram artifacts, code contracts, and operational tradeoffs into a compiled technical specification.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "youtube_url": {
                    "type": "string",
                    "description": "Public YouTube URL (https://www.youtube.com/watch?v=...) or Cloud Storage URI (gs://...)."
                },
                "research_focus": {
                    "type": "string",
                    "description": "Specific architectural focus or engineering extraction goal."
                },
                "session_id": {
                    "type": "string",
                    "description": "Optional session ID for stateful traceability."
                },
                "hint_duration_seconds": {
                    "type": "integer",
                    "description": "Optional video duration in seconds for FinOps duration gate checks."
                }
            },
            "required": ["youtube_url", "research_focus"]
        }
    }
]


class VideoIngestMCPServer:
    """
    Model Context Protocol (MCP) server exposing video research tools.
    """

    def __init__(self, server_name: str = "spoke-video-ingest-mcp"):
        self.server_name = server_name
        self.parser = VideoResearchParser()
        self.storage = ResearchStorageManager()
        self.tools = {tool["name"]: tool for tool in MCP_TOOLS}

    def list_tools(self) -> List[Dict[str, Any]]:
        """Returns registered MCP tool schemas."""
        return list(self.tools.values())

    def call_tool(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes an MCP tool by name.
        """
        if name != "analyze_video_research":
            return {
                "isError": True,
                "content": [{"type": "text", "text": f"Unknown tool: {name}"}]
            }

        youtube_url = arguments.get("youtube_url")
        research_focus = arguments.get("research_focus", "General Architecture")
        session_id = arguments.get("session_id") or f"mcp-{uuid.uuid4()}"
        hint_dur = arguments.get("hint_duration_seconds")

        if not youtube_url:
            return {
                "isError": True,
                "content": [{"type": "text", "text": "Missing required argument 'youtube_url'."}]
            }

        # 1. FinOps Pre-Execution Duration Gate
        dur_secs, exceeds_threshold = self.parser.inspect_video_duration(
            video_url=youtube_url, hint_duration_seconds=hint_dur
        )
        if exceeds_threshold:
            return {
                "isError": False,
                "content": [{
                    "type": "text",
                    "text": f"Pre-execution Duration Gate Triggered: Video duration ({dur_secs}s) exceeds 45-minute threshold. Requires Human-in-the-Loop approval gate sign-off."
                }],
                "raw_result": {
                    "status": "retry_required",
                    "duration_seconds": dur_secs,
                    "reason": "Exceeds 45-minute FinOps threshold",
                }
            }

        # 2. Multimodal Extraction
        try:
            extraction = self.parser.parse_video(
                youtube_url=youtube_url,
                research_focus=research_focus,
                session_id=session_id,
                hint_duration_seconds=dur_secs,
            )

            # 3. Cloud Storage Upload
            gcs_uri = self.storage.upload_compilation(
                session_id=session_id,
                markdown_content=extraction["markdown_content"],
            )

            result = {
                "status": "success",
                "session_id": session_id,
                "storage_uri": gcs_uri,
                "research_focus": research_focus,
                "token_consumption": extraction["token_consumption"],
                "duration_ms": extraction["duration_ms"],
                "model_used": extraction["model_used"],
            }

            return {
                "isError": False,
                "content": [{"type": "text", "text": json.dumps(result, indent=2)}],
                "raw_result": result,
            }

        except Exception as e:
            logger.error(f"MCP tool execution failed: {e}")
            return {
                "isError": True,
                "content": [{"type": "text", "text": f"Extraction failure: {str(e)}"}],
                "raw_result": {"status": "failure", "error": str(e)},
            }

    def handle_json_rpc(self, request_json: str) -> str:
        """
        Handles JSON-RPC 2.0 requests over stdio or HTTP.
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
                res = self.call_tool(name=name, arguments=args)
                return json.dumps({
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "result": res
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
