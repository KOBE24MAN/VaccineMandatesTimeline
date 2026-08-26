"""Database engine construction shared by the API and import tooling."""

from __future__ import annotations

from sqlalchemy import Engine, create_engine


def create_database_engine(database_url: str) -> Engine:
    options: dict[str, object] = {"pool_pre_ping": True}
    if database_url.startswith("sqlite"):
        options["connect_args"] = {"check_same_thread": False}
    return create_engine(database_url, **options)

