"""FastAPI application factory."""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.staticfiles import StaticFiles
from sqlalchemy import Engine

from app.config import Settings
from app.database import create_database_engine
from app.routers import health, mandates


class SPAStaticFiles(StaticFiles):
    """Serve built frontend assets and fall back to index.html for SPA routes."""

    async def get_response(self, path: str, scope):
        normalized_path = path.lstrip("/")
        reserved_path = (
            normalized_path == "api"
            or normalized_path.startswith("api/")
            or normalized_path == "health"
            or normalized_path.startswith("health/")
        )
        try:
            response = await super().get_response(path, scope)
        except StarletteHTTPException as error:
            if (
                error.status_code != 404
                or scope["method"] not in {"GET", "HEAD"}
                or reserved_path
            ):
                raise
            return await super().get_response("index.html", scope)
        if (
            response.status_code == 404
            and scope["method"] in {"GET", "HEAD"}
            and not reserved_path
        ):
            return await super().get_response("index.html", scope)
        return response


def create_app(settings: Settings | None = None, engine: Engine | None = None) -> FastAPI:
    active_settings = settings or Settings.from_env()
    if active_settings.app_env == "production" and "*" in active_settings.allowed_origins:
        raise ValueError("Wildcard CORS origins are not allowed in production")
    logging.basicConfig(
        level=getattr(logging, active_settings.log_level, logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    application = FastAPI(
        title="Mandeval API",
        description="COVID-19 Vaccine Mandates Timeline API",
        version="2.0.0",
    )
    application.state.settings = active_settings
    application.state.engine = engine or create_database_engine(
        active_settings.database_url
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(active_settings.allowed_origins),
        allow_credentials=False,
        allow_methods=["GET", "OPTIONS"],
        allow_headers=["Accept", "Content-Type"],
    )
    application.include_router(health.router, tags=["health"])
    application.include_router(mandates.router, tags=["mandates"])

    @application.api_route(
        "/api/{unmatched_path:path}",
        methods=["GET", "HEAD", "OPTIONS"],
        include_in_schema=False,
    )
    def unmatched_api_route(unmatched_path: str):
        raise HTTPException(status_code=404, detail="API route not found")

    @application.api_route(
        "/health/{unmatched_path:path}",
        methods=["GET", "HEAD", "OPTIONS"],
        include_in_schema=False,
    )
    def unmatched_health_route(unmatched_path: str):
        raise HTTPException(status_code=404, detail="Health route not found")

    static_dir = active_settings.static_dir
    if static_dir is not None:
        index_path = Path(static_dir) / "index.html"
        if not index_path.is_file():
            raise ValueError(f"Frontend index file does not exist: {index_path}")
        application.mount(
            "/",
            SPAStaticFiles(directory=static_dir, html=True),
            name="frontend",
        )
    return application


app = create_app()
