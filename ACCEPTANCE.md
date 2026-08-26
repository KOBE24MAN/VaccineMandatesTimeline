# Strict acceptance gate

A release is acceptable only when every applicable automated gate passes and every
environment-dependent exception is recorded.

## Data

- [ ] `python validate_data.py` reports 10 passed, 0 warnings, 0 errors.
- [ ] A clean seed produces 279 mandates, 341 category links, and 5 notable events.
- [ ] All 18 approved mappings have the exact removal date, calculated duration, and `ongoing=0`.
- [ ] The unresolved ongoing set is exactly the nine IDs documented in `HANDOFF.md`.
- [ ] No Booster or non-green workbook instruction has been inferred.

## Backend/API

- [ ] `python -m pytest -q` passes all tests.
- [ ] `python -m pip_audit -r requirements.txt` reports no known vulnerabilities.
- [ ] Default `/api/mandates` remains frontend-compatible and returns 279 records.
- [ ] Pagination, jurisdiction/type/category, date-window, and search filters work.
- [ ] Detail 404, invalid date-window 422, and failed readiness 503 behavior are covered.
- [ ] Production refuses wildcard CORS.

## Frontend

- [ ] `npm run lint` reports no errors or warnings.
- [ ] `npm run build` completes successfully.
- [ ] `npm audit --omit=dev --audit-level=high` reports no production vulnerabilities.

## Container/deployment

- [ ] `docker compose config` succeeds.
- [ ] A clean `docker compose up --build` makes `/health/ready` return 279 records.
- [ ] No SQLite database is copied into the production image.
- [ ] Azure deployment uses an immutable SHA tag, secret-backed `DATABASE_URL`,
      restricted CORS, and scale-to-zero.
- [ ] The deployed Azure URL passes live, ready, list, filter, and detail smoke tests.

## Repository quality

- [ ] `git diff --check` passes.
- [ ] No `.env`, credentials, caches, build output, or dependency directories are tracked.
- [ ] CI validates backend, data, frontend, and Docker build on pull requests.
- [ ] A teammate reviews the changes before merge to `main`.
