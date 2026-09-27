# Handoff: Data Pipeline -> Frontend Integration

## Deliverables

| # | File | Description |
|---|------|-------------|
| 1 | `All_Mandates.csv` | Cleaned mandate data (279 records, 20 columns) |
| 2 | `mandates.db` | SQLite database (ready to use) |
| 3 | `import_data.py` | CSV-to-SQLite import script (for re-importing) |
| 4 | `main.py` | FastAPI backend (complete, replaces temp version) |
| 5 | `validate_data.py` | Data validation script (10 checks) |
| 6 | `requirements.txt` | Python dependencies |
| 7 | `Procfile` + `railway.json` | Railway deployment config |
| 8 | `schema.sql` | Database schema reference |

## Quick Start for Joel

```bash
# 1. Place mandates.db in the backend project root
# 2. Validate data
python validate_data.py

# 3. Start the backend
pip install -r requirements.txt
uvicorn main:app --reload

# 4. Verify
# Open http://localhost:8000/health -> should return {"status": "ok", ...}
# Open http://localhost:8000/api/stats -> should show correct counts
# Open http://localhost:8000/docs -> Swagger UI for all endpoints
```

## Frontend Integration Guide

### Replacing the Existing API

Update the frontend API base URL to point to the new backend:

```javascript
// Development
const API_BASE = "http://localhost:8000";

// Production (after Railway deploy)
const API_BASE = "https://your-app.up.railway.app";
```

### Type Filter Options

The `type` field has 2 values: **Employment** and **Public Space**.

Options for the frontend filter:
- **Option 1 (recommended)**: Use `type` for a simple 2-button filter
- **Option 2**: Use the `/api/filters` endpoint to dynamically populate filter buttons

The API supports filtering by `type` via query parameter:
```
GET /api/mandates?type=Employment
GET /api/mandates?type=Public Space
```

### Category Filtering

Categories are stored in a junction table for efficient queries:
```
GET /api/mandates?category=healthcare,education
```

Available categories: healthcare, aged_care, education, quarantine, construction, mining, transport, emergency, public_service, public_space, travel, other

### Date Window Filtering

The API uses **active-window** logic: it returns mandates that were active at any point during the specified window, not just mandates that started within the window.

```
GET /api/mandates?start_date=2022-01-01&end_date=2022-06-30
```

This returns any mandate where:
- `effective_date <= 2022-06-30` AND
- `removal_date >= 2022-01-01` (or removal_date is NULL)

### Detail Panel

Click a mandate bar -> fetch full details:
```
GET /api/mandates/WA-001
```

Returns all 20 fields including compliance, exemptions, enforcement_measures, etc.

## Deployment to Railway

1. Create GitHub repo, push all files (including `mandates.db`)
2. Create Railway project -> connect GitHub repo
3. Railway auto-detects Python, installs deps, runs Procfile
4. Get the public URL -> update frontend env var
5. Done!

Note: `mandates.db` is committed to git because the data is static. No need for a separate database service.
