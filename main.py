"""
FastAPI backend for COVID-19 Vaccine Mandates Timeline.
Serves mandate data from SQLite for the React + D3.js frontend.
"""

import logging
import os
import sqlite3
from contextlib import contextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DATABASE_PATH = os.environ.get("DATABASE_PATH", "./mandates.db")
PORT = int(os.environ.get("PORT", 8000))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Mandeval API",
    description="COVID-19 Vaccine Mandates Timeline API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Database helper
# ---------------------------------------------------------------------------

@contextmanager
def get_db():
    """Context manager for database connections."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class MandateSummary(BaseModel):
    id: str
    jurisdiction: str
    name: Optional[str] = None
    type: Optional[str] = None
    target: Optional[str] = None
    target_category: Optional[str] = None
    effective_date: Optional[str] = None
    enforcement_date: Optional[str] = None
    removal_date: Optional[str] = None
    duration_days: Optional[int] = None
    date_uncertain: bool = False
    ongoing: bool = False
    visibility_level: Optional[int] = None


class MandateDetail(BaseModel):
    id: str
    jurisdiction: str
    name: Optional[str] = None
    type: Optional[str] = None
    target: Optional[str] = None
    target_category: Optional[str] = None
    effective_date: Optional[str] = None
    enforcement_date: Optional[str] = None
    removal_date: Optional[str] = None
    duration_days: Optional[int] = None
    date_uncertain: bool = False
    compliance: Optional[str] = None
    exemptions: Optional[str] = None
    enforcement_measures: Optional[str] = None
    executive_orders: Optional[str] = None
    removal_method: Optional[str] = None
    removal_details: Optional[str] = None
    authority: Optional[str] = None
    mandate_communications: Optional[str] = None
    ref_code: Optional[str] = None


class MandateListResponse(BaseModel):
    count: int
    mandates: list[MandateSummary]


class SearchResult(BaseModel):
    id: str
    jurisdiction: str
    name: Optional[str] = None
    type: Optional[str] = None
    snippet: Optional[str] = None


class SearchResponse(BaseModel):
    count: int
    results: list[SearchResult]


class StatsResponse(BaseModel):
    total: int
    by_jurisdiction: dict[str, int]
    by_type: dict[str, int]
    by_category: dict[str, int]
    date_range: dict[str, Optional[str]]
    uncertain_dates: int


class FiltersResponse(BaseModel):
    jurisdictions: list[str]
    types: list[str]
    categories: list[str]


class NotableEventResponse(BaseModel):
    id: int
    event_date: str
    date_end: Optional[str] = None
    date_approximate: bool
    title: str
    description: Optional[str] = None
    source: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    database: str
    records: int


# ---------------------------------------------------------------------------
# Helper: convert sqlite3.Row to dict with boolean conversion
# ---------------------------------------------------------------------------

def row_to_summary(row) -> dict:
    d = dict(row)
    d["date_uncertain"] = bool(d.get("date_uncertain", 0))
    d["ongoing"] = bool(d.get("ongoing", 0))
    return d


def row_to_detail(row) -> dict:
    d = dict(row)
    d["date_uncertain"] = bool(d.get("date_uncertain", 0))
    return d


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/mandates", response_model=MandateListResponse)
def list_mandates(
    jurisdiction: Optional[str] = Query(None, description="Comma-separated jurisdictions, e.g. WA,NSW"),
    type: Optional[str] = Query(None, description="Employment or Public Space"),
    category: Optional[str] = Query(None, description="Comma-separated categories, e.g. healthcare,education"),
    start_date: Optional[str] = Query(None, description="Window start YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="Window end YYYY-MM-DD"),
    search: Optional[str] = Query(None, description="Keyword search in name and target"),
):
    """
    List mandates with optional filters.
    Date filtering uses an "active window" approach: returns mandates that were
    active at any point during [start_date, end_date].
    """
    conditions = []
    params = []

    # Jurisdiction filter
    if jurisdiction:
        jurisdictions = [j.strip() for j in jurisdiction.split(",") if j.strip()]
        placeholders = ",".join("?" * len(jurisdictions))
        conditions.append(f"m.jurisdiction IN ({placeholders})")
        params.extend(jurisdictions)

    # Type filter
    if type:
        conditions.append("m.type = ?")
        params.append(type)

    # Category filter via junction table
    if category:
        categories = [c.strip() for c in category.split(",") if c.strip()]
        placeholders = ",".join("?" * len(categories))
        conditions.append(f"m.id IN (SELECT mandate_id FROM mandate_categories WHERE category IN ({placeholders}))")
        params.extend(categories)

    # Date window filter: mandate is active if effective_date <= end AND (removal_date >= start OR removal_date IS NULL)
    if start_date and end_date:
        conditions.append("""
            (
                (m.effective_date <= ? AND (m.removal_date >= ? OR m.removal_date IS NULL))
                OR (m.effective_date IS NULL AND m.removal_date IS NOT NULL AND m.removal_date >= ?)
            )
        """)
        params.extend([end_date, start_date, start_date])
    elif start_date:
        conditions.append("(m.removal_date >= ? OR m.removal_date IS NULL)")
        params.append(start_date)
    elif end_date:
        conditions.append("(m.effective_date <= ? OR m.effective_date IS NULL)")
        params.append(end_date)

    # Keyword search
    if search:
        conditions.append("(m.name LIKE ? OR m.target LIKE ?)")
        term = f"%{search}%"
        params.extend([term, term])

    where = " AND ".join(conditions) if conditions else "1=1"

    query = f"""
        SELECT m.id, m.jurisdiction, m.name, m.type, m.target, m.target_category,
               m.effective_date, m.enforcement_date, m.removal_date,
               m.duration_days, m.date_uncertain, m.ongoing, m.visibility_level
        FROM mandates m
        WHERE {where}
        ORDER BY m.effective_date ASC, m.jurisdiction ASC
    """

    with get_db() as conn:
        rows = conn.execute(query, params).fetchall()
        mandates = [row_to_summary(r) for r in rows]

    logger.info(f"GET /api/mandates -> {len(mandates)} results")
    return {"count": len(mandates), "mandates": mandates}


@app.get("/api/mandates/{mandate_id}", response_model=MandateDetail)
def get_mandate(mandate_id: str):
    """Get full details for a single mandate."""
    with get_db() as conn:
        row = conn.execute("SELECT * FROM mandates WHERE id = ?", (mandate_id,)).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail=f"Mandate {mandate_id} not found")

    logger.info(f"GET /api/mandates/{mandate_id}")
    return row_to_detail(row)


@app.get("/api/search", response_model=SearchResponse)
def search_mandates(
    q: str = Query(..., description="Search keyword"),
    jurisdiction: Optional[str] = Query(None, description="Comma-separated jurisdictions"),
):
    """Keyword search across name, target, compliance, and executive_orders."""
    conditions = ["(m.name LIKE ? OR m.target LIKE ? OR m.compliance LIKE ? OR m.executive_orders LIKE ?)"]
    term = f"%{q}%"
    params = [term, term, term, term]

    if jurisdiction:
        jurisdictions = [j.strip() for j in jurisdiction.split(",") if j.strip()]
        placeholders = ",".join("?" * len(jurisdictions))
        conditions.append(f"m.jurisdiction IN ({placeholders})")
        params.extend(jurisdictions)

    where = " AND ".join(conditions)

    query = f"""
        SELECT m.id, m.jurisdiction, m.name, m.type, m.target, m.compliance
        FROM mandates m
        WHERE {where}
        ORDER BY m.jurisdiction, m.id
    """

    with get_db() as conn:
        rows = conn.execute(query, params).fetchall()

    results = []
    for row in rows:
        d = dict(row)
        # Build a context snippet from the first matching field
        snippet = None
        for field in ["name", "target", "compliance", "executive_orders"]:
            val = d.get(field)
            if val and q.lower() in val.lower():
                idx = val.lower().index(q.lower())
                start = max(0, idx - 40)
                end = min(len(val), idx + len(q) + 40)
                snippet = ("..." if start > 0 else "") + val[start:end] + ("..." if end < len(val) else "")
                break
        results.append({
            "id": d["id"],
            "jurisdiction": d["jurisdiction"],
            "name": d.get("name"),
            "type": d.get("type"),
            "snippet": snippet,
        })

    logger.info(f"GET /api/search?q={q} -> {len(results)} results")
    return {"count": len(results), "results": results}


@app.get("/api/stats", response_model=StatsResponse)
def get_stats():
    """Return aggregate statistics."""
    with get_db() as conn:
        total = conn.execute("SELECT COUNT(*) FROM mandates").fetchone()[0]

        by_jurisdiction = {}
        for row in conn.execute("SELECT jurisdiction, COUNT(*) as cnt FROM mandates GROUP BY jurisdiction ORDER BY cnt DESC"):
            by_jurisdiction[row["jurisdiction"]] = row["cnt"]

        by_type = {}
        for row in conn.execute("SELECT type, COUNT(*) as cnt FROM mandates WHERE type IS NOT NULL GROUP BY type ORDER BY cnt DESC"):
            by_type[row["type"]] = row["cnt"]

        by_category = {}
        for row in conn.execute("SELECT category, COUNT(*) as cnt FROM mandate_categories GROUP BY category ORDER BY cnt DESC"):
            by_category[row["category"]] = row["cnt"]

        date_range = conn.execute("""
            SELECT MIN(effective_date) as earliest, MAX(COALESCE(removal_date, effective_date)) as latest
            FROM mandates WHERE effective_date IS NOT NULL
        """).fetchone()

        uncertain = conn.execute("SELECT COUNT(*) FROM mandates WHERE date_uncertain = 1").fetchone()[0]

    logger.info("GET /api/stats")
    return {
        "total": total,
        "by_jurisdiction": by_jurisdiction,
        "by_type": by_type,
        "by_category": by_category,
        "date_range": {
            "earliest": date_range["earliest"],
            "latest": date_range["latest"],
        },
        "uncertain_dates": uncertain,
    }


@app.get("/api/filters", response_model=FiltersResponse)
def get_filters():
    """Return all available filter options for the frontend."""
    with get_db() as conn:
        jurisdictions = [r[0] for r in conn.execute(
            "SELECT DISTINCT jurisdiction FROM mandates ORDER BY jurisdiction"
        ).fetchall()]

        types = [r[0] for r in conn.execute(
            "SELECT DISTINCT type FROM mandates WHERE type IS NOT NULL ORDER BY type"
        ).fetchall()]

        categories = [r[0] for r in conn.execute(
            "SELECT DISTINCT category FROM mandate_categories ORDER BY category"
        ).fetchall()]

    logger.info("GET /api/filters")
    return {
        "jurisdictions": jurisdictions,
        "types": types,
        "categories": categories,
    }


@app.get("/api/notable-events", response_model=list[NotableEventResponse])
def list_notable_events():
    """Return all notable historical events for timeline overlay."""
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM notable_events ORDER BY event_date").fetchall()
    return [
        {
            "id": r["id"],
            "event_date": r["event_date"],
            "date_end": r["date_end"],
            "date_approximate": bool(r["date_approximate"]),
            "title": r["title"],
            "description": r["description"],
            "source": r["source"],
        }
        for r in rows
    ]


@app.get("/health", response_model=HealthResponse)
def health_check():
    """Health check endpoint for deployment verification."""
    try:
        with get_db() as conn:
            count = conn.execute("SELECT COUNT(*) FROM mandates").fetchone()[0]
        return {"status": "ok", "database": "connected", "records": count}
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Database unavailable")


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
