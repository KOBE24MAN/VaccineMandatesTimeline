"""Public API response schemas."""

from __future__ import annotations

from pydantic import BaseModel


class MandateSummary(BaseModel):
    id: str
    jurisdiction: str
    name: str | None = None
    type: str | None = None
    target: str | None = None
    target_category: str | None = None
    effective_date: str | None = None
    enforcement_date: str | None = None
    removal_date: str | None = None
    duration_days: int | None = None
    date_uncertain: bool = False
    ongoing: bool = False
    visibility_level: int | None = None


class MandateDetail(MandateSummary):
    compliance: str | None = None
    exemptions: str | None = None
    enforcement_measures: str | None = None
    executive_orders: str | None = None
    removal_method: str | None = None
    removal_details: str | None = None
    authority: str | None = None
    mandate_communications: str | None = None
    ref_code: str | None = None


class MandateListResponse(BaseModel):
    count: int
    total: int
    page: int
    page_size: int
    mandates: list[MandateSummary]


class SearchResult(BaseModel):
    id: str
    jurisdiction: str
    name: str | None = None
    type: str | None = None
    snippet: str | None = None


class SearchResponse(BaseModel):
    count: int
    results: list[SearchResult]


class StatsResponse(BaseModel):
    total: int
    by_jurisdiction: dict[str, int]
    by_type: dict[str, int]
    by_category: dict[str, int]
    date_range: dict[str, str | None]
    uncertain_dates: int


class FiltersResponse(BaseModel):
    jurisdictions: list[str]
    types: list[str]
    categories: list[str]


class NotableEventResponse(BaseModel):
    id: int
    event_date: str
    date_end: str | None = None
    date_approximate: bool
    title: str
    description: str | None = None
    source: str | None = None


class HealthResponse(BaseModel):
    status: str
    database: str
    records: int


class LivenessResponse(BaseModel):
    status: str

