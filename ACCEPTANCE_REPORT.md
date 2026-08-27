# Acceptance Report - 2026-08-27

Branch: `zijun-branch`

Public demo: https://mandeval-timeline-demo.whitesea-84fcda14.australiaeast.azurecontainerapps.io/

## Release Decision

PASS. The client demo is deployed, publicly reachable, and suitable for the scheduled demonstration.

## Azure Deployment

| Item | Value |
|---|---|
| Subscription | Azure for Students |
| Region | Australia East |
| Resource group | `mandeval-demo-rg` |
| Container registry | `mandevalg5uwa2026.azurecr.io` |
| Container Apps environment | `mandeval-demo-env` |
| Container App | `mandeval-timeline-demo` |
| Revision | `mandeval-timeline-demo--pbc6cr7` |
| Revision state | Healthy, active, one replica |
| Resources | 0.25 CPU, 0.5 GiB memory, minimum 1, maximum 1 replica |
| Image | `mandeval-demo:20260827-002` |
| Image digest | `sha256:c70f3481e3d821da20c793e0097448b37d51fb2a4b86a4c447f24c5fa07d7898` |
| Local image ID | `sha256:e09204242ae289a10caa0120b3838eabadaf2f4176c9fb87e41fa54622cd97fa` |
| Local image size | 125,790,523 bytes |
| Registry access | User-assigned managed identity with AcrPull; registry admin account disabled |

## Acceptance Results

| Gate | Result |
|---|---|
| Source workbook validation | PASS - 279 records and 279 distinct IDs |
| Deterministic CSV output | PASS - SHA256 `99344e2b557870b829314fb4b72ec8f22552d2c4247cef3be6204dbf1d072d04` |
| Deterministic SQLite output | PASS - SHA256 `fbad6ebcee99520791e828e2e701bb55276510dc14f99a5f0d55752d653609ee` |
| Database contents | PASS - 279 mandates, 341 category links, 5 notable events |
| Automated backend tests | PASS - 24 tests |
| Frontend lint | PASS |
| Frontend production build | PASS |
| Local container readiness | PASS - database connected, 279 records |
| Local API acceptance | PASS - list, detail `WA-032`, search, events, 404, root, and SPA route |
| Container security | PASS - user `app`, read-only root filesystem, no new privileges |
| Runtime contents | PASS - no XLSX, CSV, Node.js executable, or Node modules |
| Container restart recovery | PASS - database connected, 279 records, search returned 87 results |
| Public Azure readiness | PASS - database connected, 279 records |
| Public API acceptance | PASS - list 279, detail `WA-032`, search 87, events 5, 404, root, and SPA route |
| Public browser acceptance | PASS - timeline rendered, search and detail interaction worked, no console errors |
| Azure revision | PASS - provisioned, active, healthy, one replica |
| Delivery character scan | PASS |

## Data Advisories

- `VIC-086`, `WA-032`, and `WA-052` are marked `date_uncertain` because the approved source data does not support a confident normal timeline position.
- `WA-032` preserves a negative source duration caused by its recorded date sequence.
- `VIC-086` and `WA-052` have no start date in the approved source workbook.
- Source business data remains unchanged where uncertainty exists.

## Host Notes

Docker Desktop 4.88.1 on this workstation continues to fail while creating its Windows socket. The verified Docker Engine in Ubuntu WSL 2 was used for the build and acceptance process. The public client demo does not require Docker, Azure credentials, or local software installation.

## Character Scan Confirmation

- No Chinese characters in generated file or directory names.
- No Chinese characters in scripts, code comments, logs, UI text, or documentation.
- No non-ASCII characters in `.bat` and `.cmd` files.
- Any remaining Chinese characters exist only in preserved source data, if applicable.
