"""Backward-compatible SQLite importer.

For PostgreSQL or deployment automation, use ``python scripts/init_database.py``.
"""

from __future__ import annotations

import sys
from pathlib import Path

from app.database import create_database_engine
from scripts.init_database import initialize_database


def main() -> None:
    csv_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("All_Mandates.csv")
    database_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("mandates.db")
    events_path = Path("data/notable_events.csv")
    database_url = f"sqlite:///{database_path.resolve().as_posix()}"
    result = initialize_database(
        create_database_engine(database_url),
        csv_path,
        events_path,
        replace=True,
    )
    print(
        f"Imported {result['mandates']} mandates, {result['categories']} categories, "
        f"and {result['events']} notable events into {database_path}"
    )


if __name__ == "__main__":
    main()
