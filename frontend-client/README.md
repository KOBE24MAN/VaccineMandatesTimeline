# MandEval — standalone frontend

The original 279-record frontend interface is restored. Policy-name search also
supports small spelling mistakes and reordered words when the original keyword
search finds no results. No backend is needed.

This folder contains the entire frontend and its data. It can be copied or opened
in VS Code on its own. No files outside this folder, Python server, SQLite database
or API connection are required. The Zijun interface and interactions are preserved.

## Start

Use Node.js 20.19+ or 22+. Open a terminal in this folder:

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5174
```

Run `npm ci` on a fresh clone or after dependency changes.
Open the Local URL shown in the terminal.
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
  data/All_Mandates.csv        279 policies including full details
  data/notable_events.csv      5 notable events
  tests/                      Data and search regression tests
  package.json                Dependencies and commands
  Start-Local-Demo.bat         Windows launcher
  Stop-Local-Demo.bat          Stop only this frontend (any local port)
  dist/                       Generated static website
```

Edit the CSV files inside this folder to change the frontend data. They are bundled
by Vite; rebuild before deploying updated data. The old project's root CSV files
and `mandates.db` are separate copies and do not synchronize automatically.

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

Tests compare all fields against the original 279-record database snapshot and
check the five notable events, search and CSV parsing. The snapshot is test-only;
review and update it and expected counts when intentionally changing the dataset.
