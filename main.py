"""Compatibility entry point for existing deployment commands."""

from __future__ import annotations

import uvicorn

from app.config import Settings
from app.main import app


if __name__ == "__main__":
    settings = Settings.from_env()
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=settings.app_env == "development",
    )
