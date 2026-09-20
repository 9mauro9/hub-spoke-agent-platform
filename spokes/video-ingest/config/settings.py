"""
Configuration settings for spoke-video-ingest.
Conforms to AES v3 Standard and Hub-and-Spoke Specification Version 1.0.
"""

from __future__ import annotations
import os
from pydantic import BaseModel, Field


class VideoIngestSettings(BaseModel):
    service_name: str = Field(default="spoke-video-ingest", description="Worker spoke identity")
    gcp_project: str = Field(
        default_factory=lambda: os.getenv("GCP_PROJECT", "hub-spoke-agent-platform")
    )
    vertex_location: str = Field(
        default_factory=lambda: os.getenv("VERTEX_LOCATION", "us-central1")
    )
    gcs_research_bucket: str = Field(
        default_factory=lambda: os.getenv("GCS_RESEARCH_BUCKET", "agent-research-artifacts")
    )
    gemini_model: str = Field(
        default_factory=lambda: os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
    )
    max_video_duration_seconds: int = Field(
        default=2700, description="FinOps 45-minute threshold before requiring HITL gate sign-off"
    )
    mcp_port: int = Field(default=8080, description="MCP server listening port")
    request_timeout_seconds: int = Field(default=900, description="15-minute Cloud Run request timeout")


settings = VideoIngestSettings()
