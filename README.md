# Mandeval Vaccine Mandates Timeline

Mandeval is a React timeline backed by a FastAPI service. The backend supports
SQLite for local development and PostgreSQL for Docker/Azure deployments.

## Current dataset

- 279 mandate records across all eight Australian states and territories
- 341 category associations
- 5 curated notable events
- 18 client-approved end-date corrections from the green-highlighted workbook
- 9 records still marked ongoing because no unambiguous, in-scope end date was supplied

The source of truth is `All_Mandates.csv` plus `data/notable_events.csv`. The
committed `mandates.db` remains available for the existing demo, but deployments
can rebuild the same data in PostgreSQL.

## Local development

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
python -m pip install -r requirements-dev.txt
python validate_data.py
python -m pytest -q
uvicorn main:app --reload
```

The API documentation is at <http://localhost:8000/docs> and readiness is at
<http://localhost:8000/health/ready>.

Run the frontend in a second terminal:

```bash
cd frontend_client
npm ci
npm run dev
```

Vite proxies `/api` to port 8000. For a separately hosted backend, set
`VITE_API_BASE_URL` from `frontend_client/.env.example`.

## PostgreSQL with Docker Compose

```bash
docker compose up --build
```

Compose starts PostgreSQL, rebuilds the read-only historical dataset, and then
starts the API on port 8000. `db-init --replace` is deliberate for this demo data;
do not reuse that command for a shared writable database without approval.

## Data update workflow

The approved mapping is versioned in
`data_updates/end_dates_2026-08-21.csv`. Applying it is idempotent:

```bash
python apply_end_date_updates.py
python validate_data.py
python -m pytest -q
```

Do not infer dates for the remaining nine ongoing rows. Add any later
client-approved corrections to a new dated mapping file and cover them with a
regression test.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/mandates` | List, filter, search, and paginate mandates |
| GET | `/api/mandates/{id}` | Fetch full mandate details |
| GET | `/api/search?q=` | Search with context snippets |
| GET | `/api/stats` | Aggregate statistics |
| GET | `/api/filters` | Available filter options |
| GET | `/api/notable-events` | Timeline context events |
| GET | `/health/live` | Process liveness |
| GET | `/health/ready` | Database readiness |

`/api/mandates` accepts comma-separated `jurisdiction`, `type`, and `category`,
plus `start_date`, `end_date`, `search`, `page`, and `page_size`. Its default page
size is 500, so the existing frontend still receives all 279 records in one call.

See `DEPLOYMENT.md` for Azure setup and `ACCEPTANCE.md` for the release gate.
