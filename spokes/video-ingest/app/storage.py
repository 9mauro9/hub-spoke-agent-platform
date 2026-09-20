"""
Cloud Storage Management for spoke-video-ingest.
Uploads and manages research compilation artifacts in Google Cloud Storage.
Conforms to AES v3 Standard and Hub-and-Spoke Specification Version 1.0.
"""

from __future__ import annotations
import os
import logging
from typing import Optional
from ..config.settings import settings

logger = logging.getLogger("ResearchStorageManager")


class ResearchStorageManager:
    """
    Manages streaming and uploading of technical research compilations to GCS.
    Dual-mode: uses google-cloud-storage if credentials exist, otherwise local fallback.
    """

    def __init__(self, bucket_name: Optional[str] = None):
        self.bucket_name = bucket_name or settings.gcs_research_bucket
        self.gcs_client = None
        self._local_storage_base = "/tmp/agent-research-artifacts"

        if os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
            try:
                from google.cloud import storage
                self.gcs_client = storage.Client(project=settings.gcp_project)
                logger.info(f"Connected to Cloud Storage with bucket '{self.bucket_name}'")
            except Exception as e:
                logger.warning(f"Could not initialize GCS client, falling back to local simulation: {e}")
                self.gcs_client = None

    def upload_compilation(
        self,
        session_id: str,
        markdown_content: str,
        filename: str = "research_compilation.md",
    ) -> str:
        """
        Uploads research compilation markdown to GCS at:
        gs://{GCS_RESEARCH_BUCKET}/{session_id}/{filename}
        Returns the GCS URI string.
        """
        gcs_uri = f"gs://{self.bucket_name}/{session_id}/{filename}"

        # Write to local file simulation path
        local_dir = os.path.join(self._local_storage_base, session_id)
        os.makedirs(local_dir, exist_ok=True)
        local_path = os.path.join(local_dir, filename)
        with open(local_path, "w", encoding="utf-8") as f:
            f.write(markdown_content)

        # Upload to real GCS if client is initialized
        if self.gcs_client:
            try:
                bucket = self.gcs_client.bucket(self.bucket_name)
                blob = bucket.blob(f"{session_id}/{filename}")
                blob.upload_from_string(markdown_content, content_type="text/markdown")
                logger.info(f"Uploaded research compilation to GCS: {gcs_uri}")
            except Exception as e:
                logger.error(f"GCS upload failed ({e}), persisted locally at {local_path}")

        return gcs_uri

    def read_compilation(self, session_id: str, filename: str = "research_compilation.md") -> Optional[str]:
        """
        Reads compilation from GCS or local simulation.
        """
        if self.gcs_client:
            try:
                bucket = self.gcs_client.bucket(self.bucket_name)
                blob = bucket.blob(f"{session_id}/{filename}")
                if blob.exists():
                    return blob.download_as_text()
            except Exception:
                pass

        local_path = os.path.join(self._local_storage_base, session_id, filename)
        if os.path.isfile(local_path):
            with open(local_path, "r", encoding="utf-8") as f:
                return f.read()

        return None
