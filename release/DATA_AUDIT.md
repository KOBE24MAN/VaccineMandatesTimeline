# Data Audit

## Authoritative Source

The approved demo source is `Modification Brief/all_mandates.xlsx`.

- Last modified: 2026-08-26 20:14:37 Australia/Perth
- SHA-256: `f86183c4ade352cf69af80ab400a85163c014c9b8363987e50e0a87d6999e6e3`
- Worksheet: `Sheet1`
- Records: 279
- Unique mandate IDs: 279
- Duplicate mandate IDs: 0
- Source columns: 20
- Date-uncertain records: 3
- Blank removal dates: 0
- Missing effective and enforcement dates: 2
- Negative durations: 1

The three date-uncertain records are `VIC-086`, `WA-032`, and `WA-052`. They are retained in the canonical CSV and SQLite database. `WA-032` retains its source duration of -50 days. `VIC-086` and `WA-052` retain their missing start dates. These values are preserved because they are explicitly marked uncertain source records.

## Candidate Comparison

| Candidate | Modified | SHA-256 | Records | Unique IDs | Date Uncertain | Decision |
| --- | --- | --- | ---: | ---: | ---: | --- |
| `Modification Brief/all_mandates.xlsx` | 2026-08-26 20:14 | `f86183c4ade352cf69af80ab400a85163c014c9b8363987e50e0a87d6999e6e3` | 279 | 279 | 3 | Selected; newest team-provided workbook |
| `Modification Brief/VaccineMandatesTimeline-main/all_mandates.xlsx` | 2026-08-25 14:57 | `eb532a5b6e3fa4ddadb7e443a1b713fc9746348ded339c711d916154d1141a20` | 279 | 279 | 46 | Rejected; older intermediate copy |
| `Modification Brief/VaccineMandatesTimeline-main/mandates_consolidated.xlsx` | 2026-08-25 03:11 | `ad642853a0b58bc7c434072227aa50b74db88d09675947cfdab2e3d3c8935a19` | 279 | 279 | 46 | Rejected; older intermediate copy |
| `All_Mandates.csv` | 2026-08-22 16:39 | `fb8993f6e31e4cb2994766f7803862462acc2d800d1a061f6362bd6a5a24ba65` | 279 | 279 | 46 | Used only as the curated visibility-level seed |
| `mandates.db` | 2026-08-22 16:39 | `5d5a2e5e7f8f44d30ce74482d7a0dde44ff0fd9a2ac71b511d0c47955b72f051` | 279 | 279 | 46 | Replaced by the reproducible release database |

## Release Output

The deterministic build command is:

```powershell
.venv\Scripts\python.exe scripts\build_demo_data.py --source "..\Modification Brief\all_mandates.xlsx" --version demo-2026-08-26
```

The command creates `data/release/mandates.csv`, `data/release/mandates.db`, and `data/release/release-manifest.json`. Repeating the build produced identical CSV and database SHA-256 hashes.
