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
