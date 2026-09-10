import { useMemo, useState } from "react";
import type {
  DateField,
  EventIndex,
  NotableEvent,
  Region,
} from "../types/event";
import { ALL_REGIONS } from "../types/event";
import { searchMandates } from "../utils/mandates";
import { REGION_COLOR } from "./Timeline";
interface Props {
  events: EventIndex[];
  dateField: DateField;
  onDateFieldChange: (field: DateField) => void;
  activeRegions: Set<Region>;
  activeTypes: Set<string>;
  types: string[];
  onToggleRegion: (region: Region) => void;
  onToggleType: (type: string) => void;
  onReset: () => void;
  onClear: () => void;
  onSelect: (id: string) => void;
  notableEvents: NotableEvent[];
  activeNotableIds: Set<number>;
  onToggleNotable: (id: number) => void;
  showNotableLabels: boolean;
  onToggleNotableLabels: () => void;
}
export function FilterBar(props: Props) {
  const [query, setQuery] = useState("");
  const results = useMemo(
    () => searchMandates(props.events, query),
    [props.events, query],
  );
  const availableRegions = new Set(props.events.map((event) => event.region));
  return (
    <div className="filter-content">
      <div className="section-heading">
        <h2>Explore mandates</h2>
        <button
          className="text-button"
          onClick={() => {
            props.onReset();
            setQuery("");
          }}
        >
          Reset
        </button>
      </div>
      <section>
        <label className="control-label" htmlFor="mandate-search">
          Search by name or ID
        </label>
        <div className="search-input">
          <span aria-hidden="true">⌕</span>
          <input
            id="mandate-search"
            type="search"
            value={query}
            placeholder="e.g. vaccination policy"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <p className="helper">
          Search all records, including boosters. Partial names and small typos
          work.
        </p>
        {query.trim() && (
          <div className="search-results" aria-live="polite">
            <p className="result-count">
              {results.length} {results.length === 1 ? "result" : "results"}
            </p>
            {!results.length && (
              <p className="helper">No matching names. Try fewer words.</p>
            )}
            {results.map((event) => (
              <button
                key={event.id}
                className="search-result"
                onClick={() => props.onSelect(event.id)}
              >
                <span className="row-meta">
                  {event.region} · #{event.id}
                  {event.isBooster && " · Booster"}
                </span>
                <strong>{event.title}</strong>
                <span>{event.target}</span>
              </button>
            ))}
          </div>
        )}
      </section>
      <section>
        <div className="section-heading">
          <h3>Jurisdictions</h3>
          <button className="text-button" onClick={props.onClear}>
            Clear filters
          </button>
        </div>
        <div className="region-options">
          {ALL_REGIONS.map((region) => (
            <button
              key={region}
              disabled={!availableRegions.has(region)}
              aria-pressed={props.activeRegions.has(region)}
              onClick={() => props.onToggleRegion(region)}
              style={
                {
                  "--region-color": REGION_COLOR[region],
                } as React.CSSProperties
              }
              title={
                !availableRegions.has(region)
                  ? "No records in the current dataset"
                  : undefined
              }
            >
              <span />
              {region}
            </button>
          ))}
        </div>
        <p className="helper">
          Available in this dataset: {[...availableRegions].join(", ")}.
        </p>
      </section>
      <section>
        <h3>Mandate type</h3>
        <div className="check-options">
          {props.types.map((type) => (
            <label key={type}>
              <input
                type="checkbox"
                checked={props.activeTypes.has(type)}
                onChange={() => props.onToggleType(type)}
              />
              <span>{type}</span>
              <small>
                {
                  props.events.filter(
                    (event) => !event.isBooster && event.types.includes(type),
                  ).length
                }
              </small>
            </label>
          ))}
        </div>
      </section>
      <section>
        <label className="control-label" htmlFor="event-date-filter">
          Filter by event date
        </label>
        <select
          id="event-date-filter"
          value={props.dateField}
          onChange={(event) =>
            props.onDateFieldChange(event.target.value as DateField)
          }
        >
          <option value="">None — all matching records</option>
          <option value="announcement_date">Announcement Date</option>
          <option value="effective_date">Publish/Effective Date</option>
          <option value="enforcement_date">Enforcement Date</option>
          <option value="removal_date">Removal Date</option>
        </select>
        <p className="helper">
          Show original policies with this date inside the selected timeline
          window.
        </p>
      </section>
      <section>
        <h3>Notable events</h3>
        <p className="helper">Add historical context to the timeline.</p>
        <div className="notable-options">
          {props.notableEvents.map((event) => (
            <label key={event.id} title={event.description ?? undefined}>
              <input
                type="checkbox"
                checked={props.activeNotableIds.has(event.id)}
                onChange={() => props.onToggleNotable(event.id)}
              />
              <span>
                {event.title}
                <small>
                  {event.date_approximate ? "Approx. " : ""}
                  {event.event_date}
                  {event.date_end ? ` – ${event.date_end}` : ""}
                </small>
              </span>
            </label>
          ))}
        </div>
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={props.showNotableLabels}
            onChange={props.onToggleNotableLabels}
          />
          Show event labels
        </label>
      </section>
    </div>
  );
}
