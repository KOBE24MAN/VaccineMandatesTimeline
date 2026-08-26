from __future__ import annotations

import csv
import shutil
import sqlite3
from datetime import date
from pathlib import Path

from sqlalchemy import text

from app.database import create_database_engine
from apply_end_date_updates import load_updates, update_csv, update_database, verify
from scripts.init_database import initialize_database

ROOT = Path(__file__).resolve().parents[1]


def test_seed_database_has_expected_shape(seeded_engine):
    with seeded_engine.connect() as connection:
        assert connection.execute(text("SELECT COUNT(*) FROM mandates")).scalar_one() == 279
        assert connection.execute(text("SELECT COUNT(*) FROM mandate_categories")).scalar_one() == 341
        assert connection.execute(text("SELECT COUNT(*) FROM notable_events")).scalar_one() == 5
        assert connection.execute(
            text("SELECT COUNT(*) FROM mandates WHERE ongoing = 1")
        ).scalar_one() == 9


def test_client_approved_end_dates_are_consistent(seeded_engine):
    with (ROOT / "data_updates" / "end_dates_2026-08-21.csv").open(
        "r", encoding="utf-8-sig", newline=""
    ) as source:
        updates = {row["id"]: row["removal_date"] for row in csv.DictReader(source)}

    assert len(updates) == 18
    with seeded_engine.connect() as connection:
        for mandate_id, expected_removal_date in updates.items():
            row = connection.execute(
                text(
                    "SELECT effective_date, removal_date, duration_days, ongoing "
                    "FROM mandates WHERE id = :mandate_id"
                ),
                {"mandate_id": mandate_id},
            ).mappings().one()
            assert row["removal_date"] == expected_removal_date
            assert row["ongoing"] == 0
            if row["effective_date"]:
                expected_duration = (
                    date.fromisoformat(expected_removal_date)
                    - date.fromisoformat(row["effective_date"])
                ).days
                assert row["duration_days"] == expected_duration


def test_ongoing_rows_are_explicitly_auditable(seeded_engine):
    expected = {
        "ACT-001",
        "NT-019",
        "NT-020",
        "SA-006",
        "SA-007",
        "SA-017",
        "TAS-005",
        "VIC-061",
        "WA-032",
    }
    with seeded_engine.connect() as connection:
        actual = set(
            connection.execute(
                text("SELECT id FROM mandates WHERE ongoing = 1 ORDER BY id")
            ).scalars()
        )
    assert actual == expected


def test_all_visibility_levels_are_in_supported_range(seeded_engine):
    with seeded_engine.connect() as connection:
        invalid = connection.execute(
            text(
                "SELECT COUNT(*) FROM mandates WHERE visibility_level IS NULL "
                "OR visibility_level < 1 OR visibility_level > 6"
            )
        ).scalar_one()
    assert invalid == 0


def test_ongoing_flag_matches_missing_removal_date(seeded_engine):
    with seeded_engine.connect() as connection:
        invalid = connection.execute(
            text(
                "SELECT COUNT(*) FROM mandates WHERE "
                "(ongoing = 1 AND removal_date IS NOT NULL) OR "
                "(ongoing = 0 AND removal_date IS NULL)"
            )
        ).scalar_one()
    assert invalid == 0


def test_all_stored_durations_match_dates(seeded_engine):
    with seeded_engine.connect() as connection:
        rows = connection.execute(
            text(
                "SELECT id, effective_date, removal_date, duration_days FROM mandates "
                "WHERE effective_date IS NOT NULL AND removal_date IS NOT NULL"
            )
        ).mappings()
        for row in rows:
            expected = (
                date.fromisoformat(row["removal_date"])
                - date.fromisoformat(row["effective_date"])
            ).days
            assert row["duration_days"] == expected, row["id"]


def test_end_date_update_is_idempotent(tmp_path):
    csv_path = tmp_path / "mandates.csv"
    database_path = tmp_path / "mandates.db"
    shutil.copy2(ROOT / "All_Mandates.csv", csv_path)
    initialize_database(
        create_database_engine(f"sqlite:///{database_path.as_posix()}"),
        csv_path,
        ROOT / "data" / "notable_events.csv",
    )
    updates = load_updates(ROOT / "data_updates" / "end_dates_2026-08-21.csv")

    for _ in range(2):
        assert update_csv(csv_path, updates) == set(updates)
        assert update_database(database_path, updates) == set(updates)
        verify(csv_path, database_path, updates)


def test_committed_sqlite_matches_versioned_seed(seeded_engine):
    committed = sqlite3.connect(ROOT / "mandates.db")
    try:
        with seeded_engine.connect() as rebuilt:
            for table in ("mandates", "mandate_categories", "notable_events"):
                expected = committed.execute(
                    f"SELECT * FROM {table} ORDER BY 1, 2"
                ).fetchall()
                actual = [
                    tuple(row)
                    for row in rebuilt.execute(
                        text(f"SELECT * FROM {table} ORDER BY 1, 2")
                    )
                ]
                assert actual == expected, table
    finally:
        committed.close()
