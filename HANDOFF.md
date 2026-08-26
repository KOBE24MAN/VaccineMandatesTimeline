# Backend handoff

## What is ready

- FastAPI 2.0 application split into configuration, routers, repositories, and services
- SQLite local fallback and PostgreSQL connection via `DATABASE_URL`
- Environment-controlled CORS; production wildcard origins are rejected
- Filtered/paginated mandate endpoint without breaking the current frontend response
- Separate liveness and database-readiness endpoints
- Reproducible seed pipeline for mandates, categories, visibility levels, and notable events
- Docker image, PostgreSQL Compose stack, GitHub CI, and manual Azure deployment workflow
- 15 backend/data regression tests plus frontend lint, type-check, build, and production audit

## Important data boundary

Eighteen non-Booster corrections from the client's green-highlighted workbook were
applied. Nine records remain `ongoing=1`:

`ACT-001`, `NT-019`, `NT-020`, `SA-006`, `SA-007`, `SA-017`, `TAS-005`,
`VIC-061`, `WA-032`.

This is intentional. The teacher/client instruction limited updates to green cells
and excluded Booster entries, while the supplied evidence did not give a safe,
unique date for these records. A database teammate should not fill them by guess.

## Database teammate contract

Production must provide a SQLAlchemy URL such as:

```text
postgresql+psycopg://USER:PASSWORD@HOST:5432/DATABASE
```

For an empty database, seed it once with:

```bash
DATABASE_URL="..." python scripts/init_database.py
```

`--replace` deletes and rebuilds the three application tables. Use it only for the
read-only demo dataset or after explicit team approval.

## Frontend contract

The current `fetch("/api/mandates")` behavior remains valid. The response now also
contains `total`, `page`, and `page_size`; existing consumers can ignore them.
For separate hosting, set `VITE_API_BASE_URL` to the API origin without a trailing
slash and add the frontend origin to backend `ALLOWED_ORIGINS`.

## Before merging

Run every command in `ACCEPTANCE.md`, review the nine unresolved rows with the
client, and have the database owner confirm the production `DATABASE_URL`. Do not
commit `.env` values or database passwords.
