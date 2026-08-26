"""Environment-backed application configuration."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def _database_url() -> str:
    configured = os.getenv("DATABASE_URL", "").strip()
    if configured:
        if configured.startswith("postgres://"):
            return configured.replace("postgres://", "postgresql+psycopg://", 1)
        if configured.startswith("postgresql://"):
            return configured.replace("postgresql://", "postgresql+psycopg://", 1)
        return configured

    database_path = Path(os.getenv("DATABASE_PATH", str(PROJECT_ROOT / "mandates.db")))
    return f"sqlite:///{database_path.resolve().as_posix()}"


def _origins() -> tuple[str, ...]:
    value = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    )
    origins = tuple(origin.strip().rstrip("/") for origin in value.split(",") if origin.strip())
    return origins or ("http://localhost:5173",)


@dataclass(frozen=True, slots=True)
class Settings:
    database_url: str
    allowed_origins: tuple[str, ...]
    app_env: str
    log_level: str
    port: int
    static_dir: Path | None = None

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            database_url=_database_url(),
            allowed_origins=_origins(),
            app_env=os.getenv("APP_ENV", "development").strip().lower(),
            log_level=os.getenv("LOG_LEVEL", "INFO").strip().upper(),
            port=int(os.getenv("PORT", "8000")),
            static_dir=(
                Path(os.environ["STATIC_DIR"]).resolve()
                if os.getenv("STATIC_DIR", "").strip()
                else None
            ),
        )
