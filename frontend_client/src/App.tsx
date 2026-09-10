import { useEffect, useMemo, useRef, useState } from "react";
import { useEvents } from "./hooks/useEvents";
import { useNotableEvents } from "./hooks/useNotableEvents";
import { FilterBar } from "./components/FilterBar";
import { Timeline } from "./components/Timeline";
import { Minimap } from "./components/Minimap";
import { EventDetail } from "./components/EventDetail";
import {
  ALL_REGIONS,
  ALL_EVENT_TYPES,
  type DateField,
  type Region,
} from "./types/event";
import { eventMatches, matchesDateWindow, validDate } from "./utils/mandates";
import { parseDate } from "./utils/dates";
const DAY = 86_400_000;
export default function App() {
  const { events, allEvents, warnings, loading, error, retry } = useEvents();
  const notableEvents = useNotableEvents();
  const [regions, setRegions] = useState(new Set<Region>(ALL_REGIONS));
  const [types, setTypes] = useState(new Set<string>(ALL_EVENT_TYPES));
  const [notableIds, setNotableIds] = useState(new Set<number>());
  const [showNotableLabels, setShowNotableLabels] = useState(true);
  const [dateField, setDateField] = useState<DateField>("");
  const [focusRow, setFocusRow] = useState<{
    id: string;
    request: number;
  } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(
    () => window.innerWidth >= 1100,
  );
  const [showDetails, setShowDetails] = useState(false);
  const aboutDialog = useRef<HTMLDialogElement>(null);
  const typeOptions = useMemo(
    () => [...new Set(allEvents.flatMap((event) => event.types))].sort(),
    [allEvents],
  );
  useEffect(() => {
    if (typeOptions.length) setTypes(new Set(typeOptions));
  }, [typeOptions]);
  const extent = useMemo(() => {
    const dates = allEvents
      .flatMap((event) => [
        event.record.announcement_date,
        event.record.effective_date,
        event.record.enforcement_date,
        event.record.removal_date,
      ])
      .filter(validDate)
      .sort();
    return {
      start: dates.length
        ? new Date(parseDate(dates[0]).getTime() - 14 * DAY)
        : parseDate("2021-01-01"),
      end: dates.length
        ? new Date(parseDate(dates[dates.length - 1]).getTime() + 14 * DAY)
        : parseDate("2022-12-31"),
    };
  }, [allEvents]);
  const [dateWindow, setDateWindow] = useState<{
    start: Date;
    end: Date;
  } | null>(null);
  const windowStart = dateWindow?.start ?? extent.start;
  const windowEnd = dateWindow?.end ?? extent.end;
  const filtered = useMemo(
    () =>
      events.filter(
        (event) =>
          eventMatches(event, regions, types) &&
          matchesDateWindow(
            event,
            dateField,
            windowStart.toISOString().slice(0, 10),
            windowEnd.toISOString().slice(0, 10),
          ),
      ),
    [events, regions, types, dateField, windowStart, windowEnd],
  );
  const selected = allEvents.find((event) => event.id === selectedId) ?? null;
  function changeWindow(start: Date, end: Date) {
    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      end <= start
    )
      return;
    start = parseDate(start.toISOString().slice(0, 10));
    end = parseDate(end.toISOString().slice(0, 10));
    const duration = Math.min(
      Math.max(end.getTime() - start.getTime(), DAY),
      extent.end.getTime() - extent.start.getTime(),
    );
    const startMs = Math.max(
      extent.start.getTime(),
      Math.min(start.getTime(), extent.end.getTime() - duration),
    );
    setDateWindow({
      start: new Date(startMs),
      end: new Date(startMs + duration),
    });
  }
  function selectEvent(id: string, navigate = false) {
    const event = allEvents.find((item) => item.id === id);
    if (!event) return;
    setSelectedId(id);
    setShowDetails(true);
    if (window.innerWidth < 1100) setShowFilters(false);
    if (navigate) {
      setDateField("");
      const original = event.isBooster
        ? events.find((item) => event.parentIds.includes(item.id))
        : event;
      if (original) {
        setFocusRow((previous) => ({
          id: original.id,
          request: (previous?.request ?? 0) + 1,
        }));
        setRegions(new Set([original.region]));
        setTypes(new Set(original.types));
      }
      const dates = [
        event.start_date,
        event.end_date,
        event.record.enforcement_date,
        event.record.removal_date,
      ]
        .filter((value): value is string => Boolean(value) && validDate(value!))
        .sort();
      if (dates.length)
        changeWindow(
          new Date(parseDate(dates[0]).getTime() - 30 * DAY),
          new Date(parseDate(dates[dates.length - 1]).getTime() + 30 * DAY),
        );
    }
  }
  function zoom(factor: number) {
    const center = (windowStart.getTime() + windowEnd.getTime()) / 2;
    const half = Math.max(
      ((windowEnd.getTime() - windowStart.getTime()) * factor) / 2,
      7 * DAY,
    );
    changeWindow(new Date(center - half), new Date(center + half));
  }
  function toggle<T>(values: Set<T>, value: T): Set<T> {
    const next = new Set(values);
    next.has(value) ? next.delete(value) : next.add(value);
    return next;
  }
  if (loading)
    return (
      <main className="load-state" role="status">
        <span className="brand-mark">M</span>
        <h1>Loading MandEval</h1>
        <p>Preparing the mandate timeline…</p>
      </main>
    );
  if (error)
    return (
      <main className="load-state" role="alert">
        <h1>Unable to load the timeline</h1>
        <p>{error}</p>
        <button className="primary-button" onClick={retry}>
          Try again
        </button>
      </main>
    );
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            M
          </span>
          <div>
            <h1>
              MandEval<span> / Timeline</span>
            </h1>
            <p>COVID-19 vaccine mandates · Australia</p>
          </div>
        </div>
        <div className="header-actions">
          <button
            onClick={() => {
              setShowFilters((value) => !value);
              if (window.innerWidth < 1100) setShowDetails(false);
            }}
            aria-expanded={showFilters}
            aria-controls="filters-panel"
          >
            Filters
          </button>
          <button
            onClick={() => {
              setShowDetails((value) => !value);
              if (window.innerWidth < 1100) setShowFilters(false);
            }}
            aria-expanded={showDetails}
            aria-controls="details-panel"
          >
            Details
          </button>
          <button
            className="about-button"
            onClick={() => aboutDialog.current?.showModal()}
            aria-label="About MandEval"
          >
            ?
          </button>
        </div>
      </header>
      <div className="workspace">
        {showFilters && (
          <aside
            id="filters-panel"
            className="filter-panel"
            aria-label="Filters"
          >
            <FilterBar
              events={allEvents}
              activeRegions={regions}
              activeTypes={types}
              types={typeOptions}
              onToggleRegion={(region) =>
                setRegions((values) => toggle(values, region))
              }
              onToggleType={(type) =>
                setTypes((values) => toggle(values, type))
              }
              dateField={dateField}
              onDateFieldChange={setDateField}
              onReset={() => {
                setDateField("");
                setRegions(new Set(ALL_REGIONS));
                setTypes(new Set(typeOptions));
              }}
              onClear={() => {
                setRegions(new Set());
                setTypes(new Set());
              }}
              onSelect={(id) => selectEvent(id, true)}
              notableEvents={notableEvents}
              activeNotableIds={notableIds}
              onToggleNotable={(id) =>
                setNotableIds((values) => toggle(values, id))
              }
              showNotableLabels={showNotableLabels}
              onToggleNotableLabels={() =>
                setShowNotableLabels((value) => !value)
              }
            />
          </aside>
        )}
        <main className="main-panel">
          <div className="timeline-heading">
            <div>
              <p className="eyebrow">POLICY EXPLORER</p>
              <h2>Vaccine mandates timeline</h2>
              <p aria-live="polite">
                {filtered.length} of {events.length} original mandates ·{" "}
                {allEvents.filter((event) => event.isBooster).length} linked
                booster records
              </p>
            </div>
          </div>
          <div className="timeline-toolbar">
            <div className="date-controls">
              <label>
                From
                <input
                  aria-label="Timeline start date"
                  type="date"
                  min={extent.start.toISOString().slice(0, 10)}
                  max={windowEnd.toISOString().slice(0, 10)}
                  value={windowStart.toISOString().slice(0, 10)}
                  onChange={(event) => {
                    if (validDate(event.target.value))
                      changeWindow(parseDate(event.target.value), windowEnd);
                  }}
                />
              </label>
              <span aria-hidden="true">→</span>
              <label>
                To
                <input
                  aria-label="Timeline end date"
                  type="date"
                  min={windowStart.toISOString().slice(0, 10)}
                  max={extent.end.toISOString().slice(0, 10)}
                  value={windowEnd.toISOString().slice(0, 10)}
                  onChange={(event) => {
                    if (validDate(event.target.value))
                      changeWindow(windowStart, parseDate(event.target.value));
                  }}
                />
              </label>
            </div>
            <div className="zoom-controls">
              <button onClick={() => zoom(1.5)} aria-label="Zoom out">
                −
              </button>
              <button onClick={() => zoom(1 / 1.5)} aria-label="Zoom in">
                +
              </button>
              <button onClick={() => setDateWindow(null)}>Full range</button>
            </div>
          </div>
          <div className="timeline-legend">
            <span>
              <i className="legend-announcement" />
              Announcement
            </span>
            <span>
              <i className="legend-active" />
              Original: effective → removal
            </span>
            <span>
              <i className="legend-booster" />
              Booster: enforcement → removal
            </span>
          </div>
          {warnings.length > 0 && (
            <details className="notice">
              <summary>{warnings.length} data notices</summary>
              {warnings.map((warning, index) => (
                <p key={index}>{warning}</p>
              ))}
            </details>
          )}
          <Timeline
            events={filtered}
            windowStart={windowStart}
            windowEnd={windowEnd}
            selectedEventId={selectedId}
            focusRow={focusRow}
            onEventClick={(id) => selectEvent(id)}
            onEventDoubleClick={(id) => {
              const event = allEvents.find((item) => item.id === id);
              if (event) setRegions(new Set([event.region]));
            }}
            notableEvents={notableEvents.filter((event) =>
              notableIds.has(event.id),
            )}
            showNotableLabels={showNotableLabels}
          />
          <div className="minimap-label">
            <span>FULL DATASET OVERVIEW</span>
            <span>Drag to pan · use + / − to zoom</span>
          </div>
          <Minimap
            events={events}
            fullStart={extent.start}
            fullEnd={extent.end}
            windowStart={windowStart}
            windowEnd={windowEnd}
            onWindowChange={changeWindow}
          />
          <footer className="timeline-footer">
            Select a bar for details. Blank dates are left unplotted.{" "}
            <span>{allEvents.length} source records</span>
          </footer>
        </main>
        {showDetails && (
          <aside
            id="details-panel"
            className="detail-panel"
            aria-label="Details"
          >
            <EventDetail
              event={selected}
              events={allEvents}
              onClose={() => setShowDetails(false)}
              onSelect={(id) => selectEvent(id, true)}
            />
          </aside>
        )}
      </div>
      <dialog
        ref={aboutDialog}
        className="about-dialog"
        onClick={(event) => {
          if (event.target === event.currentTarget)
            aboutDialog.current?.close();
        }}
      >
        <div className="section-heading">
          <h2>About MandEval</h2>
          <button
            className="icon-button"
            aria-label="Close about"
            onClick={() => aboutDialog.current?.close()}
          >
            ×
          </button>
        </div>
        <p>
          Explore COVID-19 vaccine mandate policies across Australian
          jurisdictions. This timeline presents the research dataset and its
          recorded policy dates.
        </p>
        <h3>Reading the timeline</h3>
        <p>
          Diamonds mark announcements. Solid bars run from the original policy’s
          effective date to removal. Hatched booster bars run from enforcement
          to removal and overlay each linked original policy. Missing dates are
          skipped, and records remain available through search and details.
        </p>
        <h3>Explore and compare</h3>
        <p>
          Filter by jurisdiction or policy type. Search all mandate names,
          including boosters, using partial words or minor typos. Select a
          result to focus its timeline. Drag the overview to pan or change the
          date range to zoom. Double-click a bar to isolate its jurisdiction.
        </p>
        <h3>Project team</h3>
        <p>
          Created for the MandEval research project by Zhiheng Zhou, Zijun Zhou,
          Joel Fitzpatrick, Jiaren Zhu and Yupeng Sun at The University of
          Western Australia.
        </p>
      </dialog>
    </div>
  );
}
