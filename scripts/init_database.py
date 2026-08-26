"""Initialize SQLite or PostgreSQL from version-controlled CSV seed data."""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from sqlalchemy import Engine, inspect, text

from app.config import Settings
from app.database import create_database_engine


MANDATE_COLUMNS = [
    "id",
    "jurisdiction",
    "name",
    "type",
    "target",
    "target_category",
    "effective_date",
    "enforcement_date",
    "removal_date",
    "duration_days",
    "date_uncertain",
    "compliance",
    "exemptions",
    "enforcement_measures",
    "executive_orders",
    "removal_method",
    "removal_details",
    "authority",
    "mandate_communications",
    "ref_code",
    "ongoing",
    "visibility_level",
]


CREATE_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS mandates (
        id TEXT PRIMARY KEY,
        jurisdiction TEXT NOT NULL,
        name TEXT,
        type TEXT,
        target TEXT,
        target_category TEXT,
        effective_date TEXT,
        enforcement_date TEXT,
        removal_date TEXT,
        duration_days INTEGER,
        date_uncertain INTEGER NOT NULL DEFAULT 0,
        compliance TEXT,
        exemptions TEXT,
        enforcement_measures TEXT,
        executive_orders TEXT,
        removal_method TEXT,
        removal_details TEXT,
        authority TEXT,
        mandate_communications TEXT,
        ref_code TEXT,
        ongoing INTEGER NOT NULL DEFAULT 0,
        visibility_level INTEGER
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS mandate_categories (
        mandate_id TEXT NOT NULL,
        category TEXT NOT NULL,
        PRIMARY KEY (mandate_id, category),
        FOREIGN KEY (mandate_id) REFERENCES mandates(id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS notable_events (
        id INTEGER PRIMARY KEY,
        event_date TEXT NOT NULL,
        date_end TEXT,
        date_approximate INTEGER NOT NULL DEFAULT 0,
        title TEXT NOT NULL,
        description TEXT,
        source TEXT
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_mandates_jurisdiction ON mandates(jurisdiction)",
    "CREATE INDEX IF NOT EXISTS idx_mandates_type ON mandates(type)",
    "CREATE INDEX IF NOT EXISTS idx_mandates_effective_date ON mandates(effective_date)",
    "CREATE INDEX IF NOT EXISTS idx_mandates_removal_date ON mandates(removal_date)",
    "CREATE INDEX IF NOT EXISTS idx_mandate_categories_category ON mandate_categories(category)",
]


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    # Normalize multiline CSV cells so Windows and Linux builds seed identical text.
    cleaned = value.replace("\r\n", "\n").replace("\r", "\n").strip()
    return cleaned or None


def _integer(value: str | None) -> int | None:
    cleaned = _clean(value)
    if cleaned is None:
        return None
    return int(float(cleaned))


def _boolean(value: str | None) -> int:
    cleaned = (_clean(value) or "").upper()
    return int(cleaned in {"1", "TRUE", "YES", "Y"})


def _read_mandates(csv_path: Path) -> list[dict[str, object]]:
    with csv_path.open("r", encoding="utf-8-sig", newline="") as source:
        rows = list(csv.DictReader(source))

    mandates: list[dict[str, object]] = []
    seen: set[str] = set()
    for source_row in rows:
        mandate_id = _clean(source_row.get("id"))
        if not mandate_id:
            continue
        if mandate_id in seen:
            raise ValueError(f"Duplicate mandate ID in seed file: {mandate_id}")
        seen.add(mandate_id)
        row: dict[str, object] = {
            column: _clean(source_row.get(column)) for column in MANDATE_COLUMNS
        }
        row["id"] = mandate_id
        row["duration_days"] = _integer(source_row.get("duration_days"))
        row["date_uncertain"] = _boolean(source_row.get("date_uncertain"))
        row["ongoing"] = _boolean(source_row.get("ongoing"))
        row["visibility_level"] = _integer(source_row.get("visibility_level"))
        mandates.append(row)
    return mandates


def _read_events(events_path: Path) -> list[dict[str, object]]:
    with events_path.open("r", encoding="utf-8-sig", newline="") as source:
        rows = list(csv.DictReader(source))
    events: list[dict[str, object]] = []
    for row in rows:
        events.append(
            {
                "id": _integer(row.get("id")),
                "event_date": _clean(row.get("event_date")),
                "date_end": _clean(row.get("date_end")),
                "date_approximate": _boolean(row.get("date_approximate")),
                "title": _clean(row.get("title")),
                "description": _clean(row.get("description")),
                "source": _clean(row.get("source")),
            }
        )
    return events


def initialize_database(
    engine: Engine,
    csv_path: Path,
    events_path: Path,
    *,
    replace: bool = False,
) -> dict[str, int]:
    mandates = _read_mandates(csv_path)
    events = _read_events(events_path)
    if not mandates:
        raise ValueError("Mandate seed file contains no records")

    with engine.begin() as connection:
        for statement in CREATE_STATEMENTS:
            connection.execute(text(statement))

        existing = int(connection.execute(text("SELECT COUNT(*) FROM mandates")).scalar_one())
        if existing and not replace:
            raise RuntimeError(
                "Database already contains mandate data; pass --replace to rebuild it"
            )
        if replace:
            connection.execute(text("DELETE FROM mandate_categories"))
            connection.execute(text("DELETE FROM notable_events"))
            connection.execute(text("DELETE FROM mandates"))

        insert_columns = ", ".join(MANDATE_COLUMNS)
        insert_values = ", ".join(f":{column}" for column in MANDATE_COLUMNS)
        connection.execute(
            text(f"INSERT INTO mandates ({insert_columns}) VALUES ({insert_values})"),
            mandates,
        )

        categories = []
        for mandate in mandates:
            target_category = mandate.get("target_category")
            if isinstance(target_category, str):
                categories.extend(
                    {
                        "mandate_id": mandate["id"],
                        "category": category.strip(),
                    }
                    for category in target_category.split(",")
                    if category.strip()
                )
        if categories:
            connection.execute(
                text(
                    "INSERT INTO mandate_categories (mandate_id, category) "
                    "VALUES (:mandate_id, :category)"
                ),
                categories,
            )
        if events:
            connection.execute(
                text(
                    "INSERT INTO notable_events "
                    "(id, event_date, date_end, date_approximate, title, description, source) "
                    "VALUES (:id, :event_date, :date_end, :date_approximate, :title, "
                    ":description, :source)"
                ),
                events,
            )

    return {
        "mandates": len(mandates),
        "categories": len(categories),
        "events": len(events),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database-url", default=Settings.from_env().database_url)
    parser.add_argument("--csv", type=Path, default=Path("All_Mandates.csv"))
    parser.add_argument(
        "--events", type=Path, default=Path("data/notable_events.csv")
    )
    parser.add_argument("--replace", action="store_true")
    args = parser.parse_args()

    engine = create_database_engine(args.database_url)
    result = initialize_database(
        engine, args.csv, args.events, replace=args.replace
    )
    dialect = inspect(engine).dialect.name
    print(
        f"Initialized {dialect}: {result['mandates']} mandates, "
        f"{result['categories']} categories, {result['events']} notable events"
    )


if __name__ == "__main__":
    main()
