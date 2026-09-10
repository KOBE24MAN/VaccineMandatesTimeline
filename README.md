# MandEval — Vaccine Mandates Timeline

The current frontend is a static React application in [`frontend_client/`](frontend_client/README.md). It reads [`vaccine_mandates.csv`](vaccine_mandates.csv) directly in the browser; no Python server or database is needed.

```sh
cd frontend_client
npm ci
npm run dev
```

For tests, production builds, data updates and timeline rules, see the [frontend guide](frontend_client/README.md).

The current supplied dataset contains 54 WA records (48 originals and 6 linked boosters). Frontend files stay in `frontend_client/`, and the source dataset stays at the repository root.

## Historical backend documentation

The files and instructions below describe the previous backend workflow. They are retained for reference and are not required for the current frontend.

# Mandeval Backend

FastAPI + SQLite backend for the COVID-19 Vaccine Mandates Timeline visualisation project.

## Local Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Import CSV data into SQLite
python import_data.py

# Validate data quality
python validate_data.py

# Start the server
uvicorn main:app --reload
```

Open http://localhost:8000/docs for interactive API documentation (Swagger UI).

## Updating Data

If the source CSV changes, re-run the import:

```bash
python import_data.py All_Mandates.csv mandates.db
python validate_data.py
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/mandates` | List mandates with filters |
| GET | `/api/mandates/{id}` | Get single mandate details |
| GET | `/api/search?q=` | Keyword search |
| GET | `/api/stats` | Aggregate statistics |
| GET | `/api/filters` | Available filter options |
| GET | `/health` | Health check |

### Query Parameters for `/api/mandates`

- `jurisdiction` — Comma-separated, e.g. `WA,NSW`
- `type` — `Employment` or `Public Space`
- `category` — Comma-separated, e.g. `healthcare,education`
- `start_date` / `end_date` — YYYY-MM-DD, uses active-window filtering
- `search` — Keyword search in name and target fields

## Deploy to Railway

1. Push to GitHub
2. Create a new project on Railway
3. Connect the GitHub repo
4. Railway auto-detects Python and deploys
5. Copy the public URL and configure the frontend
