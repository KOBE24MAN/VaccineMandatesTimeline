# MandEval — standalone frontend

This folder contains the frontend. Its authoritative mandate data is
**`../vaccine_mandates.csv`**, at the repository root. Keep both when copying the
project. No Python server, database or API connection is required.

## Start

Use Node.js 20.19+ or 22+. Open a terminal in this folder:

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5174
```

Open the local URL shown in the terminal. If the requested port is busy, Vite
selects another available port. On Windows, the repository root contains
`Start-Local-Demo.bat` and `Stop-Local-Demo.bat`; run them from there. The stop
launcher targets this checkout's Vite processes, regardless of the local port.
Ctrl+C in the startup terminal also stops the app.

## Files

```text
repository/
  vaccine_mandates.csv          Authoritative tab-delimited mandate data
  Start-Local-Demo.bat          Windows launcher
  Stop-Local-Demo.bat           Windows stop launcher
  frontend-client/
    src/App.tsx                Main page
    src/components/            Timeline, filters, details and minimap
    src/data/store.ts          Runtime data loading and lookup
    src/data/dataset.ts        Data parsing and search
    src/index.css              Styles
    data/notable_events.csv    Notable events bundled with the frontend
    scripts/stop-local-demo.ps1  Checkout-scoped Windows process stop helper
    tests/                     Data and search regression tests
    vite.config.ts             Root CSV serving and build-copy configuration
    package.json              Dependencies and commands
    dist/                     Generated static website
```

## Data and search

Edit the root `vaccine_mandates.csv` to change mandate data. Keep the header names,
unique IDs and tab delimiter. The frontend fetches the file once per page load;
search and policy details share the loaded records. Development changes to the
root file reload the page automatically. A failed load displays an error instead
of silently substituting data.

To link a booster to an original mandate, set the original's `booster_id` to the
booster row's `id`. Its timeline segment overlays the original row. Hover cards
keep concise phase/date summaries, with a linked booster summary
below the original. The information panel keeps the original field order and
compact layout, with the complete booster record below the original. Both use
`(ID:123) Policy Name` headings.

Name and policy-target fuzzy searches update the displayed results as you type.
Each query matches its own field; when both are filled, a record must match both.
Search covers all records, including boosters, regardless of the normal region,
type and visibility filters. The results list includes every matching record.
On the timeline, a matching booster overlays its original when that original
also matches; otherwise it appears as its own search-result row from enforcement
to removal. Each Clear button clears only the adjacent field. Once both fields
are empty, the previous region, type, visibility and date-window settings return.
The category filter and separate experimental search are removed.

Optional `visibility_level` values (integers 1–6) override automatic levels.
If omitted, duration thresholds are used: >=365 days → 1, >=270 → 2,
>=180 → 3, >=90 → 4, >=30 → 5, shorter/unknown → 6.
Missing `duration_days` values are calculated from effective/enforcement to removal.
These levels control display density, not policy importance.

Optional `ongoing` accepts true/false or 1/0. If omitted, a missing removal date
means ongoing; a supplied removal date means ended. The tail toggle adds a fade
and arrow without changing the recorded dates. It is disabled when the dataset
has no ongoing mandates. Booster rows follow the same rule and can extend beyond
the original mandate's removal date.

## Validate and build

```sh
npm test
npm run lint
npm run build
npm run preview
```

Publish the contents of `dist/` to a static web host. The build copies the current
root CSV into `dist/vaccine_mandates.csv`; the browser fetches this separate asset
at runtime. Publish that CSV along with the other build files. For data-only
updates, replace the deployed CSV and reload the page, or rebuild from the updated
root CSV and redeploy. Relative asset paths support deployment in a subdirectory.
Use an HTTP server rather than opening the generated HTML directly.
