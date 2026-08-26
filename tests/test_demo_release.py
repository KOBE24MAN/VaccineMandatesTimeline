from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.config import Settings
from app.database import create_database_engine
from app.main import create_app


ROOT = Path(__file__).resolve().parents[1]
RELEASE_DIR = ROOT / "data" / "release"


def test_release_manifest_matches_database():
    manifest = json.loads(
        (RELEASE_DIR / "release-manifest.json").read_text(encoding="utf-8")
    )
    with sqlite3.connect(RELEASE_DIR / "mandates.db") as connection:
        total = connection.execute("SELECT COUNT(*) FROM mandates").fetchone()[0]
        distinct_ids = connection.execute(
            "SELECT COUNT(DISTINCT id) FROM mandates"
        ).fetchone()[0]
        uncertain_ids = [
            row[0]
            for row in connection.execute(
                "SELECT id FROM mandates WHERE date_uncertain = 1 ORDER BY id"
            ).fetchall()
        ]
        ongoing_mismatch = connection.execute(
            "SELECT COUNT(*) FROM mandates "
            "WHERE ongoing != CASE WHEN removal_date IS NULL THEN 1 ELSE 0 END"
        ).fetchone()[0]
        events = connection.execute("SELECT COUNT(*) FROM notable_events").fetchone()[0]

    validation = manifest["validation"]
    assert total == distinct_ids == validation["records"] == 279
    assert uncertain_ids == validation["date_uncertain_ids"] == [
        "VIC-086",
        "WA-032",
        "WA-052",
    ]
    assert ongoing_mismatch == 0
    assert events == validation["notable_events"] == 5


def test_release_database_rejects_writes():
    database_path = (RELEASE_DIR / "mandates.db").resolve().as_posix()
    engine = create_database_engine(
        f"sqlite:///file:{database_path}?mode=ro&uri=true"
    )
    with pytest.raises(OperationalError):
        with engine.begin() as connection:
            connection.execute(
                text("INSERT INTO mandates (id, jurisdiction) VALUES ('TEST', 'WA')")
            )
    engine.dispose()


def test_spa_fallback_does_not_shadow_api(seeded_engine, tmp_path):
    static_dir = tmp_path / "static"
    static_dir.mkdir()
    (static_dir / "index.html").write_text(
        "<!doctype html><title>MandEval Test</title>", encoding="utf-8"
    )
    (static_dir / "asset.txt").write_text("asset", encoding="utf-8")
    settings = Settings(
        database_url="sqlite://",
        allowed_origins=("http://localhost:8000",),
        app_env="test",
        log_level="WARNING",
        port=8000,
        static_dir=static_dir,
    )
    with TestClient(create_app(settings=settings, engine=seeded_engine)) as client:
        assert client.get("/").status_code == 200
        assert "MandEval Test" in client.get("/timeline/example").text
        assert client.get("/asset.txt").text == "asset"
        assert client.get("/api/mandates").json()["total"] == 279
        assert client.get("/health/ready").json()["records"] == 279
        assert client.get("/api/not-a-route").status_code == 404


def test_public_api_has_no_mutating_routes(client):
    schema = client.get("/openapi.json").json()
    mutating_methods = {"post", "put", "patch", "delete"}
    exposed = {
        f"{method.upper()} {path}"
        for path, operations in schema["paths"].items()
        for method in mutating_methods.intersection(operations)
    }
    assert exposed == set()
