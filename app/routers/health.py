"""Liveness and database readiness endpoints."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Request

from app.repositories.mandates import database_record_count
from app.schemas import HealthResponse, LivenessResponse


logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/health/live", response_model=LivenessResponse)
def liveness():
    return {"status": "ok"}


def _readiness(request: Request) -> dict[str, object]:
    try:
        count = database_record_count(request.app.state.engine)
        return {"status": "ok", "database": "connected", "records": count}
    except Exception as error:
        logger.exception("Database readiness check failed: %s", error)
        raise HTTPException(status_code=503, detail="Database unavailable") from error


@router.get("/health/ready", response_model=HealthResponse)
def readiness(request: Request):
    return _readiness(request)


@router.get("/health", response_model=HealthResponse)
def backwards_compatible_health(request: Request):
    return _readiness(request)

