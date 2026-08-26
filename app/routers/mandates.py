"""Mandate, metadata, and timeline endpoints."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, HTTPException, Query, Request
from sqlalchemy import Engine

from app.repositories import mandates as repository
from app.schemas import (
    FiltersResponse,
    MandateDetail,
    MandateListResponse,
    NotableEventResponse,
    SearchResponse,
    StatsResponse,
)
from app.services.mandates import build_search_result, normalize_event, normalize_mandate


router = APIRouter()


def _engine(request: Request) -> Engine:
    return request.app.state.engine


@router.get("/api/mandates", response_model=MandateListResponse)
def list_mandates(
    request: Request,
    jurisdiction: str | None = Query(None, description="Comma-separated jurisdictions"),
    mandate_type: str | None = Query(None, alias="type", description="Comma-separated types"),
    category: str | None = Query(None, description="Comma-separated categories"),
    start_date: date | None = Query(None, description="Active on or after this date"),
    end_date: date | None = Query(None, description="Active on or before this date"),
    search: str | None = Query(None, min_length=1, max_length=200),
    page: int = Query(1, ge=1),
    page_size: int = Query(500, ge=1, le=1000),
):
    """List mandates with optional server-side filters and pagination."""
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=422, detail="start_date must not be after end_date")

    total, rows = repository.list_mandates(
        _engine(request),
        jurisdiction=jurisdiction,
        mandate_type=mandate_type,
        category=category,
        start_date=start_date.isoformat() if start_date else None,
        end_date=end_date.isoformat() if end_date else None,
        search=search.strip() if search else None,
        page=page,
        page_size=page_size,
    )
    mandates = [normalize_mandate(row) for row in rows]
    return {
        "count": len(mandates),
        "total": total,
        "page": page,
        "page_size": page_size,
        "mandates": mandates,
    }


@router.get("/api/mandates/{mandate_id}", response_model=MandateDetail)
def get_mandate(request: Request, mandate_id: str):
    row = repository.get_mandate(_engine(request), mandate_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f"Mandate {mandate_id} not found")
    return normalize_mandate(row)


@router.get("/api/search", response_model=SearchResponse)
def search_mandates(
    request: Request,
    q: str = Query(..., min_length=1, max_length=200, description="Search keyword"),
    jurisdiction: str | None = Query(None, description="Comma-separated jurisdictions"),
):
    rows = repository.search_mandates(_engine(request), q.strip(), jurisdiction)
    results = [build_search_result(row, q.strip()) for row in rows]
    return {"count": len(results), "results": results}


@router.get("/api/stats", response_model=StatsResponse)
def get_stats(request: Request):
    return repository.get_stats(_engine(request))


@router.get("/api/filters", response_model=FiltersResponse)
def get_filters(request: Request):
    return repository.get_filters(_engine(request))


@router.get("/api/notable-events", response_model=list[NotableEventResponse])
def list_notable_events(request: Request):
    return [
        normalize_event(row)
        for row in repository.list_notable_events(_engine(request))
    ]

