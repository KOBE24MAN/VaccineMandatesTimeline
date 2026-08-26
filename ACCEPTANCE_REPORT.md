# Acceptance report — 2026-08-23

Branch: `codex/backend-production-readiness`  
Base: `origin/main` at `96a9520dce93c1fdc466084dbae134086f4ea9fc`

## Passed locally

| Gate | Result |
|---|---|
| Source data validation | PASS — 10 passed, 0 warnings, 0 errors |
| Automated backend/data tests | PASS — 20 passed, warnings treated as errors |
| Clean database reconstruction | PASS — 279 mandates, 341 category links, 5 events |
| Rebuilt vs committed SQLite | PASS — all values equal in all three tables |
| Approved update scope | PASS — exactly 18 IDs; only removal dates and derived durations changed in legacy fields |
| Remaining ongoing audit | PASS — exactly 9 documented IDs |
| Update idempotency | PASS — covered by two consecutive applications in tests |
| Actual HTTP smoke test | PASS — readiness 279; WA filter/pagination/detail verified |
| Python production and test dependency audits | PASS — no known vulnerabilities |
| Python compilation | PASS |
| Frontend ESLint | PASS — no errors or warnings |
| Frontend TypeScript/Vite production build | PASS — 963 modules transformed |
| Frontend production dependency audit | PASS — 0 vulnerabilities |
| Compose and workflow YAML parsing | PASS |
| Docker Desktop installation/runtime | PASS — Desktop 4.87.0; Engine/CLI 29.7.2; Compose 5.4.0; WSL 2 backend |
| Docker image build | PASS — Python 3.12 slim application images built successfully |
| PostgreSQL Compose integration | PASS — PostgreSQL 16 healthy; initializer exited 0; API healthy on port 8000 |
| Live PostgreSQL/API acceptance | PASS — 279 mandates, 341 category links, 5 events; filters, pagination, detail, search, validation and CORS verified |
| PostgreSQL persistence/recovery | PASS — database restart retained all 279 mandates and the API reconnected automatically |
| Azure local tooling | PASS — Azure CLI 2.89.1 authenticated to the enabled `Azure for Students` subscription; Container Apps extension 1.3.0b4 installed |
| `git diff --check` | PASS (Windows line-ending notices only) |
| Credential and tracked-artifact scan | PASS |

## Environment-dependent gate not executed

| Gate | Status and required next action |
|---|---|
| Azure deployment and live smoke | NOT RUN — `Azure for Students` is available, but resource providers are not yet registered and no billable resources have been created. Team approval, resource names, OIDC identity, and the production database URL are still required. |

## Non-production advisory

The full npm audit reports vulnerabilities in inherited development/build tooling
(ESLint 8, Vite 5, Tailwind/PostCSS dependency tree). `npm audit --omit=dev`
reports zero vulnerabilities, so these packages are not present in the deployed
static bundle. A separate frontend-toolchain major upgrade should address them; it
is not mixed into this backend/data change because it carries UI build-migration risk.

## Release decision

The code and all local data/API/frontend/Docker/PostgreSQL gates pass. If deploying
now, release is conditional on selecting an approved Azure subscription and passing
the Azure live smoke gate. The nine unresolved ongoing records also require explicit
client evidence before their dates can be changed.
