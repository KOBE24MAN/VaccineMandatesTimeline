# MandEval frontend

A static, read-only React + TypeScript timeline for the MandEval vaccine mandate dataset. All data loading, searching, filtering and detail display run in the browser. No API, database or backend is required.

## Run locally

Use Node.js 20.19+ or 22+ with npm:

```sh
cd frontend_client
npm ci
npm run dev
```

Open the local URL printed by Vite. Run these commands from `frontend_client` if you are already in this folder.

## Validate and build

```sh
npm test
npm run lint
npm run build
npm run preview
```

`npm test` uses Node's test runner and Vite's existing compiler. Tests cover the actual attached data, quoted TSV, escaped newlines, missing dates, shared boosters, search, mixed types, event-date filtering, detail fields and safe text rendering.

`dist/` is a complete static website. Deploy its **contents** to any static web host. The relative asset base supports hosting beneath a path, including a GitHub repository path. There is no `/api` dependency. Preview through an HTTP server; opening `index.html` via `file://` cannot fetch the dataset.

## Data and directory layout

```text
VaccineMandatesTimeline/
├── vaccine_mandates.csv           # single source dataset, in the repository root
└── frontend_client/
    ├── src/
    │   ├── data/notableEvents.ts # five existing client-supplied notable events
    │   ├── utils/mandates.ts     # parsing, validation, linking and search
    │   └── components/          # filters, timeline, overview and details
    ├── tests/
    └── vite.config.ts           # exposes only the root CSV, copies it into dist
```

Replace `../vaccine_mandates.csv` to update the dataset; retain its 28 headers. It is UTF-8 **tab-delimited**, despite the `.csv` suffix. Quoted fields, doubled quotes, embedded tabs/newlines and literal `\n` are supported. Vite reloads after a source data edit. Rebuild to include an update in a production deployment, or replace `dist/vaccine_mandates.csv` directly on a static host. Data is fetched at page load with cache revalidation.

## Timeline rules

- Announcements appear as independent diamond markers. They are not substituted for an effective date and still work if recorded later than the effective date.
- Solid original bars span `effective_date` → `removal_date`.
- A record referenced by `booster_id` is suppressed as a standalone row. Its `enforcement_date` → `removal_date` interval is hatched and drawn above **every** linked original. Original segments remain visible before/after the booster, including when the two dates overlap or the booster extends past the original removal.
- Missing/invalid interval endpoints are not inferred. Undated records remain available as labelled rows, search results and details. Raw field values are preserved.
- Search is case-insensitive, supports partial names/minor typos and includes all originals and boosters. Selecting a booster opens its details and focuses a linked original. Links in details allow switching between related policies.
- Types are comma-separated memberships. A record may match more than one type. Choosing no regions or types returns no matches.
- Optional event-date filtering includes originals whose selected date is inside the visible date interval. Selecting a search result clears that date filter and reveals the matching policy.
- Details show every populated source field with the requested English label and preserved line breaks. Text is escaped by React.
- The dataset has no category, visibility-level or ongoing-status fields, so legacy controls based on those fields have been removed from the active interface. Records are shown individually to avoid merging policies with distinct booster links.

The supplied snapshot has **54 WA records: 48 originals, 6 linked boosters and 24 original-to-booster links**. Other jurisdictions are disabled until data is supplied. Source records 53 and 54 retain their provided `NEED UPDATE!!!` titles.

## Interaction and accessibility

Use the From/To controls or +/− to zoom, and the overview to pan. The overview supports left/right arrow keys. Timeline rows, segments, filters and details are keyboard-operable. Sidebars can be hidden; they become overlays on smaller screens. The timeline scrolls vertically and horizontally when necessary. About uses a native dialog with Escape and focus handling.

Existing backend and prototype files elsewhere in the repository are retained as historical work. They are not used by this frontend.
