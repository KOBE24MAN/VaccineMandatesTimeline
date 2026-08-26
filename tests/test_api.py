from __future__ import annotations

from fastapi.testclient import TestClient

from app.config import Settings
from app.database import create_database_engine
from app.main import create_app


def test_health_endpoints(client):
    assert client.get("/health/live").json() == {"status": "ok"}
    assert client.get("/health/ready").json() == {
        "status": "ok",
        "database": "connected",
        "records": 279,
    }
    assert client.get("/health").status_code == 200


def test_readiness_returns_503_when_schema_is_unavailable():
    engine = create_database_engine("sqlite:///:memory:")
    settings = Settings(
        database_url="sqlite:///:memory:",
        allowed_origins=("http://localhost:5173",),
        app_env="test",
        log_level="CRITICAL",
        port=8000,
    )
    with TestClient(create_app(settings=settings, engine=engine)) as unavailable:
        response = unavailable.get("/health/ready")
    engine.dispose()
    assert response.status_code == 503
    assert response.json()["detail"] == "Database unavailable"


def test_default_list_is_backwards_compatible(client):
    response = client.get("/api/mandates")
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 279
    assert body["total"] == 279
    assert len(body["mandates"]) == 279


def test_pagination_and_jurisdiction_filter(client):
    response = client.get(
        "/api/mandates", params={"jurisdiction": "NSW", "page": 2, "page_size": 10}
    )
    body = response.json()
    assert response.status_code == 200
    assert body["total"] == 45
    assert body["count"] == 10
    assert body["page"] == 2
    assert all(row["jurisdiction"] == "NSW" for row in body["mandates"])


def test_type_category_search_and_date_filters(client):
    response = client.get(
        "/api/mandates",
        params={
            "type": "Employment",
            "category": "healthcare",
            "search": "vaccination",
            "start_date": "2022-01-01",
            "end_date": "2022-12-31",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total"] > 0
    assert all(row["type"] == "Employment" for row in body["mandates"])


def test_invalid_date_window_is_rejected(client):
    response = client.get(
        "/api/mandates",
        params={"start_date": "2023-01-02", "end_date": "2023-01-01"},
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "start_date must not be after end_date"


def test_updated_mandate_detail_includes_runtime_fields(client):
    response = client.get("/api/mandates/NSW-036")
    body = response.json()
    assert response.status_code == 200
    assert body["removal_date"] == "2023-10-06"
    assert body["ongoing"] is False
    assert 1 <= body["visibility_level"] <= 6


def test_missing_mandate_returns_404(client):
    assert client.get("/api/mandates/DOES-NOT-EXIST").status_code == 404


def test_search_returns_context_snippets(client):
    response = client.get("/api/search", params={"q": "booster", "jurisdiction": "WA"})
    body = response.json()
    assert response.status_code == 200
    assert body["count"] > 0
    assert all(result["jurisdiction"] == "WA" for result in body["results"])
    assert any(result["snippet"] for result in body["results"])


def test_metadata_and_events(client):
    filters = client.get("/api/filters").json()
    stats = client.get("/api/stats").json()
    events = client.get("/api/notable-events").json()
    assert filters["jurisdictions"] == ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"]
    assert stats["total"] == 279
    assert len(events) == 5
    assert isinstance(events[0]["date_approximate"], bool)


def test_cors_is_limited_to_configured_origin(client):
    allowed = client.options(
        "/api/mandates",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    denied = client.options(
        "/api/mandates",
        headers={
            "Origin": "https://untrusted.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "access-control-allow-origin" not in denied.headers


def test_production_rejects_wildcard_cors():
    settings = Settings(
        database_url="sqlite://",
        allowed_origins=("*",),
        app_env="production",
        log_level="WARNING",
        port=8000,
    )
    try:
        create_app(settings=settings)
    except ValueError as error:
        assert "Wildcard CORS" in str(error)
    else:
        raise AssertionError("Production app accepted wildcard CORS")
