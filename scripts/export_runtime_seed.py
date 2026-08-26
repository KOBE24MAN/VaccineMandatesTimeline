"""Export curated runtime-only fields from SQLite into versioned seed files.

This migration is intentionally separate from the normal import path. Run it only
when the curated visibility levels or notable events in the legacy SQLite database
need to be captured in source control.
"""

from __future__ import annotations

import argparse
import csv
import sqlite3
from pathlib import Path


def export(csv_path: Path, database_path: Path, events_path: Path) -> None:
    connection = sqlite3.connect(database_path)
    connection.row_factory = sqlite3.Row
    try:
        runtime_fields = {
            row["id"]: {
                "ongoing": int(row["ongoing"] or 0),
                "visibility_level": row["visibility_level"],
            }
            for row in connection.execute(
                "SELECT id, ongoing, visibility_level FROM mandates"
            )
        }
        events = [
            dict(row)
            for row in connection.execute(
                "SELECT id, event_date, date_end, date_approximate, title, "
                "description, source FROM notable_events ORDER BY id"
            )
        ]
    finally:
        connection.close()

    with csv_path.open("r", encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        rows = list(reader)
        fieldnames = list(reader.fieldnames or [])

    missing = sorted({row["id"] for row in rows} - set(runtime_fields))
    if missing:
        raise RuntimeError(f"SQLite database is missing CSV IDs: {', '.join(missing)}")

    for field in ("ongoing", "visibility_level"):
        if field not in fieldnames:
            fieldnames.append(field)

    for row in rows:
        values = runtime_fields[row["id"]]
        row["ongoing"] = str(values["ongoing"])
        row["visibility_level"] = (
            "" if values["visibility_level"] is None else str(values["visibility_level"])
        )

    temporary_csv = csv_path.with_suffix(csv_path.suffix + ".tmp")
    with temporary_csv.open("w", encoding="utf-8", newline="") as target:
        writer = csv.DictWriter(target, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    temporary_csv.replace(csv_path)

    events_path.parent.mkdir(parents=True, exist_ok=True)
    event_fields = [
        "id",
        "event_date",
        "date_end",
        "date_approximate",
        "title",
        "description",
        "source",
    ]
    with events_path.open("w", encoding="utf-8", newline="") as target:
        writer = csv.DictWriter(target, fieldnames=event_fields)
        writer.writeheader()
        writer.writerows(events)

    print(f"Exported runtime fields for {len(rows)} mandates to {csv_path}")
    print(f"Exported {len(events)} notable events to {events_path}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", type=Path, default=Path("All_Mandates.csv"))
    parser.add_argument("--database", type=Path, default=Path("mandates.db"))
    parser.add_argument(
        "--events", type=Path, default=Path("data/notable_events.csv")
    )
    args = parser.parse_args()
    export(args.csv, args.database, args.events)


if __name__ == "__main__":
    main()
