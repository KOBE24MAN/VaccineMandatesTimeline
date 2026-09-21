# MandEval Vaccine Mandates Timeline

A standalone frontend for exploring vaccine mandates and their linked booster
mandates. It runs in the browser without a backend, database or API service.

## Start locally

Install Node.js 20.19+ or 22+, then run these commands from the repository root:

```sh
cd frontend-client
npm ci
npm run dev -- --host 127.0.0.1 --port 5174
```

Open the local URL printed in the terminal. If the requested port is busy, Vite
selects another available port.

On Windows, double-click **Start-Local-Demo.bat** in the repository root. It installs
dependencies on first use and opens the app. **Stop-Local-Demo.bat** stops Vite
processes belonging to this checkout; it does not stop unrelated Node.js apps.
You can also press Ctrl+C in the startup window.

## Repository layout

```text
vaccine_mandates.csv      Authoritative mandate data
Start-Local-Demo.bat      Windows launcher
Stop-Local-Demo.bat       Windows stop launcher
frontend-client/         Frontend source, supporting scripts and tests
```

Keep the root CSV alongside `frontend-client/`. The frontend reads the complete
CSV at runtime. During development, saving this file reloads the page; no database
import is needed. The build copies it to `frontend-client/dist/vaccine_mandates.csv`
as a separate data file.

The name and policy-target search fields filter as you type and accept small
spelling mistakes. Both include booster records. Each Clear button clears its
adjacent field; clearing both restores the view from before searching.
Policy details and timeline hover cards identify records using
`(ID:123) Policy Name` and show linked booster information below the original.

See [the frontend README](frontend-client/README.md) for data conventions,
validation and static-site deployment.
