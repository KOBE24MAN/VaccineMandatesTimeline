"""Apply the client-approved, green-highlighted end-date corrections.

The mapping is intentionally explicit. It does not infer dates for unlisted rows and
does not apply any entry from a Booster section of the client workbook.
"""

from __future__ import annotations

import argparse
import csv
import os
import sqlite3
import tempfile
from datetime import date
from pathlib import Path


REQUIRED_CSV_COLUMNS = {"id", "effective_date", "removal_date", "duration_days"}


def load_updates(path: Path) -> dict[str, str]:
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        rows = list(csv.DictReader(stream))

    updates: dict[str, str] = {}
    for row in rows:
        mandate_id = (row.get("id") or "").strip()
        removal_date = (row.get("removal_date") or "").strip()
        if not mandate_id or not removal_date:
            raise ValueError(f"Invalid update row: {row}")
        date.fromisoformat(removal_date)
        if mandate_id in updates:
            raise ValueError(f"Duplicate update ID: {mandate_id}")
        updates[mandate_id] = removal_date
    return updates


def duration_days(effective_date: str, removal_date: str) -> str:
    if not effective_date:
        return ""
    return str((date.fromisoformat(removal_date) - date.fromisoformat(effective_date)).days)


def update_csv(csv_path: Path, updates: dict[str, str]) -> set[str]:
    with csv_path.open("r", encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        if not reader.fieldnames or not REQUIRED_CSV_COLUMNS.issubset(reader.fieldnames):
            missing = REQUIRED_CSV_COLUMNS - set(reader.fieldnames or [])
            raise ValueError(f"CSV is missing required columns: {sorted(missing)}")
        fieldnames = list(reader.fieldnames)
        rows = list(reader)

    seen: set[str] = set()
    for row in rows:
        mandate_id = (row.get("id") or "").strip()
        if mandate_id not in updates:
            continue
        removal_date = updates[mandate_id]
        current = (row.get("removal_date") or "").strip()
        if current and current != removal_date:
            raise ValueError(
                f"Refusing to replace existing removal date for {mandate_id}: "
                f"{current} != {removal_date}"
            )
        row["removal_date"] = removal_date
        row["duration_days"] = duration_days(
            (row.get("effective_date") or "").strip(), removal_date
        )
        if "ongoing" in fieldnames:
            row["ongoing"] = "0"
        seen.add(mandate_id)

    missing_ids = set(updates) - seen
    if missing_ids:
        raise ValueError(f"Update IDs not found in CSV: {sorted(missing_ids)}")

    fd, temp_name = tempfile.mkstemp(prefix=csv_path.stem + "-", suffix=".csv", dir=csv_path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8-sig", newline="") as stream:
            writer = csv.DictWriter(stream, fieldnames=fieldnames, lineterminator="\n")
            writer.writeheader()
            writer.writerows(rows)
        os.replace(temp_name, csv_path)
    except Exception:
        if os.path.exists(temp_name):
            os.unlink(temp_name)
        raise
    return seen


def update_database(db_path: Path, updates: dict[str, str]) -> set[str]:
    connection = sqlite3.connect(db_path)
    try:
        columns = {
            row[1] for row in connection.execute("PRAGMA table_info(mandates)").fetchall()
        }
        required = {"id", "effective_date", "removal_date", "duration_days"}
        if not required.issubset(columns):
            raise ValueError(f"Database is missing required columns: {sorted(required - columns)}")

        updated: set[str] = set()
        for mandate_id, removal_date in updates.items():
            row = connection.execute(
                "SELECT effective_date, removal_date FROM mandates WHERE id = ?",
                (mandate_id,),
            ).fetchone()
            if row is None:
                raise ValueError(f"Update ID not found in database: {mandate_id}")
            effective_date, current_removal_date = row
            if current_removal_date and current_removal_date != removal_date:
                raise ValueError(
                    f"Refusing to replace existing removal date for {mandate_id}: "
                    f"{current_removal_date} != {removal_date}"
                )
            duration = int(duration_days(effective_date or "", removal_date)) if effective_date else None
            if "ongoing" in columns:
                connection.execute(
                    "UPDATE mandates SET removal_date = ?, duration_days = ?, ongoing = 0 WHERE id = ?",
                    (removal_date, duration, mandate_id),
                )
            else:
                connection.execute(
                    "UPDATE mandates SET removal_date = ?, duration_days = ? WHERE id = ?",
                    (removal_date, duration, mandate_id),
                )
            updated.add(mandate_id)
        connection.commit()
        return updated
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def verify(csv_path: Path, db_path: Path, updates: dict[str, str]) -> None:
    with csv_path.open("r", encoding="utf-8-sig", newline="") as stream:
        csv_rows = {row["id"]: row for row in csv.DictReader(stream)}

    connection = sqlite3.connect(db_path)
    try:
        for mandate_id, removal_date in updates.items():
            csv_row = csv_rows[mandate_id]
            if csv_row["removal_date"] != removal_date:
                raise ValueError(f"CSV verification failed for {mandate_id}")
            if "ongoing" in csv_row and csv_row["ongoing"] != "0":
                raise ValueError(f"CSV ongoing verification failed for {mandate_id}")
            db_row = connection.execute(
                "SELECT removal_date, ongoing FROM mandates WHERE id = ?", (mandate_id,)
            ).fetchone()
            if db_row != (removal_date, 0):
                raise ValueError(f"Database verification failed for {mandate_id}: {db_row}")
    finally:
        connection.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--updates", default="data_updates/end_dates_2026-08-21.csv")
    parser.add_argument("--csv", default="All_Mandates.csv")
    parser.add_argument("--db", default="mandates.db")
    args = parser.parse_args()

    updates = load_updates(Path(args.updates))
    csv_ids = update_csv(Path(args.csv), updates)
    db_ids = update_database(Path(args.db), updates)
    if csv_ids != db_ids:
        raise ValueError("CSV and database update sets differ")
    verify(Path(args.csv), Path(args.db), updates)
    print(f"Applied and verified {len(updates)} client-approved end-date updates.")


if __name__ == "__main__":
    main()
