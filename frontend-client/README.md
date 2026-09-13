# MandEval - standalone frontend

The frontend runs without the backend and reads the mandate data from
`vaccine_mandates.csv` in this folder. Policy-name search supports small spelling
mistakes and reordered words when the original keyword search finds no results.

This folder contains the entire frontend and its data. It can be copied or opened
in VS Code on its own. No files outside this folder, Python server, SQLite database
or API connection are required. The Zijun interface and interactions are preserved.

## Start

Use Node.js 20.19+ or 22+. Open a terminal in this folder:

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5174
```

Dependencies are already installed on this computer; `npm ci` is only necessary on
a fresh copy or after dependency changes. Open the Local URL shown in the terminal.
If that port is busy Vite will select another available port.

On Windows, double-click `Start-Local-Demo.bat`. Double-click `Stop-Local-Demo.bat`, close its terminal or press Ctrl+C
to stop the frontend.

## Files

```text
frontend-client/
  src/App.tsx                 Main page
  src/components/             Timeline, filters, details and minimap
  src/data/store.ts           Local data loading and lookup
  src/data/dataset.ts         CSV parsing and search
  src/index.css               Styles
  vaccine_mandates.csv         Tab-delimited mandate data
  data/notable_events.csv      5 notable events
  tests/                      Data and search regression tests
  package.json                Dependencies and commands
  Start-Local-Demo.bat         Windows launcher
  Stop-Local-Demo.bat          Stop only this frontend (any local port)
  dist/                       Generated static website
```

Edit `vaccine_mandates.csv` to change the frontend data. Keep the same header row
and tab delimiter. To attach a booster segment to an original mandate, set the
original row's `booster_id` to the booster row's `id`; the booster row will be
used as an overlay instead of a separate timeline bar. Rebuild before deploying
updated data.

Optional `visibility_level` values (integers 1–6) override automatic levels.
If omitted, the original backend duration rules apply: >=365 days → 1,
>=270 → 2, >=180 → 3, >=90 → 4, >=30 → 5, shorter/unknown → 6.
Missing `duration_days` values are calculated from effective/enforcement to removal.
These levels control display density, not policy importance.

Optional `ongoing` accepts true/false or 1/0. If omitted, a missing removal date
means ongoing; a supplied removal date means ended. The tail toggle adds a fade
and arrow without changing the recorded dates. It is disabled with an explanation
when the dataset has no ongoing mandates. Booster rows follow the same rule and
can extend beyond the original mandate's removal date.

Date markers distinguish announcement/effective (hollow circle), enforcement
(filled circle), booster start (diamond), and removal/booster end (double circle).
Dates that coincide share a marker; records with different phases are not merged.

## Check and build

```sh
npm test
npm run lint
npm run build
npm run preview
```

Publish the contents of `dist/` to a static web host. All data is included; relative
asset paths also support a subdirectory. Preview through an HTTP server instead of
double-clicking the generated HTML.

Tests check the new tab-delimited dataset, booster links, newline parsing, notable
events and search. Update expected counts when intentionally changing the dataset.
