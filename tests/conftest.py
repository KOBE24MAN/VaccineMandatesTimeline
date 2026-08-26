from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.database import create_database_engine
from app.main import create_app
from scripts.init_database import initialize_database


ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session")
def seeded_engine(tmp_path_factory):
    database_path = tmp_path_factory.mktemp("database") / "mandates.db"
    engine = create_database_engine(f"sqlite:///{database_path.as_posix()}")
    initialize_database(
        engine,
        ROOT / "All_Mandates.csv",
        ROOT / "data" / "notable_events.csv",
    )
    yield engine
    engine.dispose()


@pytest.fixture(scope="session")
def client(seeded_engine):
    settings = Settings(
        database_url="sqlite://",
        allowed_origins=("http://localhost:5173",),
        app_env="test",
        log_level="WARNING",
        port=8000,
    )
    with TestClient(create_app(settings=settings, engine=seeded_engine)) as test_client:
        yield test_client
