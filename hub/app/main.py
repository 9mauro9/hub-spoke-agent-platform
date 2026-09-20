"""
Master Platform Orchestrator (The Hub) Cloud Run Application Entrypoint.
Conforms to AES v3 Standard.
"""

from __future__ import annotations
import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from hub.app.api.routes import router

app = FastAPI(
    title="Hub-and-Spoke Master Orchestrator",
    description="Control plane orchestrator for multi-agent workflows under AES v3 Standard.",
    version="3.0.0",
)

# Standard Cross-Origin Resource Sharing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    uvicorn.run("hub.app.main:app", host="0.0.0.0", port=port, reload=False)
