import type { Region, EventType, NotableEvent } from "../types/event";
import { ALL_REGIONS, ALL_EVENT_TYPES } from "../types/event";
import type { Mandate } from "../data/dataset";
import { REGION_COLOR } from "./Timeline";

interface Props {
  activeRegions: Set<Region>;
  activeTypes: Set<EventType>;
  onToggleRegion: (region: Region) => void;
  onToggleType: (type: EventType) => void;
  onSelectAllRegions: () => void;
  onClearAllRegions: () => void;
  onSelectAllTypes: () => void;
  onClearAllTypes: () => void;
  nameQuery: string;
  targetQuery: string;
  onNameQueryChange: (query: string) => void;
  onTargetQueryChange: (query: string) => void;
  searchResults: Mandate[];
  isSearching: boolean;
  windowStart: Date;
  windowEnd: Date;
  fullStart: Date;
  fullEnd: Date;
  onWindowChange: (start: Date, end: Date) => void;
  autoVisibilityPercent: number;
  manualVisibilityPercent: number | null;
  onVisibilityPercentChange: (percent: number | null) => void;
  showOngoingTail: boolean;
  ongoingCount: number;
  onToggleOngoingTail: () => void;
  tooltipTransparent: boolean;
  onToggleTooltipTransparent: () => void;
  unstackBars: boolean;
  onToggleUnstackBars: () => void;
  autoUnstackEnabled: boolean;
  onToggleAutoUnstack: () => void;
  onResetWindow: () => void;
  notableEvents: NotableEvent[];
  activeNotableEventIds: Set<number>;
  onToggleNotableEvent: (id: number) => void;
  onSelectAllNotableEvents: () => void;
  onClearAllNotableEvents: () => void;
  showNotableLabels: boolean;
  onToggleNotableLabels: () => void;
  multiNotableSelect: boolean;
  onToggleMultiNotableSelect: () => void;
  onSearchResultClick: (id: string) => void;
}

function toInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function FilterBar({
  activeRegions,
  activeTypes,
  onToggleRegion,
  onToggleType,
  onSelectAllRegions,
  onClearAllRegions,
  onSelectAllTypes,
  onClearAllTypes,
  nameQuery,
  targetQuery,
  onNameQueryChange,
  onTargetQueryChange,
  searchResults,
  isSearching,
  windowStart,
  windowEnd,
  fullStart,
  fullEnd,
  onWindowChange,
  autoVisibilityPercent,
  manualVisibilityPercent,
  onVisibilityPercentChange,
  showOngoingTail,
  ongoingCount,
  onToggleOngoingTail,
  tooltipTransparent,
  onToggleTooltipTransparent,
  unstackBars,
  onToggleUnstackBars,
  autoUnstackEnabled,
  onToggleAutoUnstack,
  onResetWindow,
  notableEvents,
  activeNotableEventIds,
  onToggleNotableEvent,
  onSelectAllNotableEvents,
  onClearAllNotableEvents,
  showNotableLabels,
  onToggleNotableLabels,
  multiNotableSelect,
  onToggleMultiNotableSelect,
  onSearchResultClick,
}: Props) {
  return (
    <div className="flex flex-col gap-5 p-4">
      <p className="text-center text-base font-bold text-gray-800 mt-1">Filter bar</p>

      {/* Date window */}
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Timeline window</p>
        <div className="flex flex-col gap-1.5">
          <input
            type="date"
            value={toInputValue(windowStart)}
            min={toInputValue(fullStart)}
            max={toInputValue(windowEnd)}
            onChange={e => {
              const d = new Date(e.target.value + "T12:00:00Z");
              if (!isNaN(d.getTime()) && d < windowEnd) onWindowChange(d, windowEnd);
            }}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-gray-700"
          />
          <span className="text-center text-xs text-gray-400">to</span>
          <input
            type="date"
            value={toInputValue(windowEnd)}
            min={toInputValue(windowStart)}
            max={toInputValue(fullEnd)}
            onChange={e => {
              const d = new Date(e.target.value + "T12:00:00Z");
              if (!isNaN(d.getTime()) && d > windowStart) onWindowChange(windowStart, d);
            }}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-gray-700"
          />
        </div>
        <div className="flex items-center justify-between gap-2 mt-2">
          <button
            onClick={onResetWindow}
            className="text-xs text-blue-500 hover:underline"
          >
            Reset
          </button>
          <span className="text-[11px] text-gray-400 text-right">Wheel: zoom · Middle-drag: pan</span>
        </div>
      </div>

      <fieldset disabled={isSearching} className="flex flex-col gap-5 disabled:opacity-50">
      {/* Jurisdiction */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Jurisdiction</p>
          <div className="flex gap-2">
            <button onClick={onSelectAllRegions} className="text-xs text-blue-500 hover:underline">All</button>
            <button onClick={onClearAllRegions} className="text-xs text-blue-500 hover:underline">Clear</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ALL_REGIONS.map((region) => {
            const color = REGION_COLOR[region];
            const active = activeRegions.has(region);
            return (
              <button
                key={region}
                onClick={() => onToggleRegion(region)}
                className="px-3 py-1 rounded-full text-sm border transition-colors"
                style={active
                  ? { backgroundColor: color, borderColor: color, color: "#fff" }
                  : { backgroundColor: "#fff", borderColor: "#D1D5DB", color: "#6B7280" }
                }
              >
                {region}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mandate type */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Mandate Event</p>
          <div className="flex gap-2">
            <button onClick={onSelectAllTypes} className="text-xs text-blue-500 hover:underline">All</button>
            <button onClick={onClearAllTypes} className="text-xs text-blue-500 hover:underline">Clear</button>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          {ALL_EVENT_TYPES.map(type => (
            <button key={type} onClick={() => onToggleType(type)}
              className={`px-3 py-1.5 rounded text-sm border text-left transition-colors ${activeTypes.has(type)
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-500 border-gray-300 hover:border-indigo-400 hover:text-indigo-600"}`}>
              {type}
            </button>
          ))}
        </div>
      </div>

      </fieldset>

      {/* Full-dataset, field-specific fuzzy search */}
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Search policies</p>
        <div className="flex flex-col gap-3">
          {[{ label: "Name", value: nameQuery, update: onNameQueryChange },
            { label: "Target", value: targetQuery, update: onTargetQueryChange }].map(field => (
            <div key={field.label}>
              <label htmlFor={`search-${field.label.toLowerCase()}`} className="block text-xs text-gray-500 mb-1">{field.label}</label>
              <div className="flex gap-1.5 items-center">
                <input id={`search-${field.label.toLowerCase()}`} type="search" value={field.value}
                  onChange={event => field.update(event.target.value)} placeholder={`Search by ${field.label.toLowerCase()}…`}
                  className="min-w-0 flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:border-indigo-400" />
                <button onClick={() => field.update("")} disabled={!field.value} aria-label={`Clear ${field.label.toLowerCase()} search`}
                  className="text-xs text-blue-500 hover:underline disabled:text-gray-300 disabled:no-underline">Clear</button>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-400 leading-relaxed">Search all policies, including boosters. Both fields must match when used together.</p>
        {isSearching && (
          <div className="mt-2">
            <p role="status" className="text-xs text-gray-500 mb-1.5">{searchResults.length} matching {searchResults.length === 1 ? "record" : "records"}</p>
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto" aria-label="Matching policies">
              {searchResults.length === 0 && <p className="text-xs text-gray-400 px-1">No matching policies. Try another name or target.</p>}
              {searchResults.map(record => (
                <button key={record.id} onClick={() => onSearchResultClick(record.id)} data-search-result-id={record.id}
                  className="text-left px-2 py-1.5 rounded border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
                  <p className="text-xs font-semibold text-gray-700 leading-snug">(ID:{record.id}) {record.name ?? record.id}</p>
                  <p className="text-[10px] text-gray-400">{record.jurisdiction} · {record.type}</p>
                  {record.target && <p className="text-[10px] text-gray-500 mt-0.5 leading-snug line-clamp-2">{record.target}</p>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Visibility percentage */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Visibility</p>
          <span className="text-xs font-medium text-indigo-600">
            {manualVisibilityPercent === null ? "Auto" : "Manual"} · {Math.round(manualVisibilityPercent ?? autoVisibilityPercent)}%
          </span>
        </div>
        <input
          type="range"
          min={10}
          max={100}
          step={5}
          disabled={isSearching}
          value={manualVisibilityPercent ?? autoVisibilityPercent}
          onChange={event => onVisibilityPercentChange(Number(event.target.value))}
          aria-label="Timeline visibility percentage"
          className="w-full accent-indigo-600 disabled:opacity-50"
        />
        <div className="flex justify-between text-[10px] text-gray-400 -mt-0.5">
          <span>10%</span>
          <span>100% · all records</span>
        </div>
        <p className="mt-1.5 text-xs text-gray-400 leading-relaxed">
          Percentage of filtered records shown. Auto follows the timeline zoom.
        </p>
        {isSearching && <p className="mt-1 text-xs text-gray-400">All matching policies are shown while searching.</p>}
        {manualVisibilityPercent !== null && !isSearching && (
          <button
            onClick={() => onVisibilityPercentChange(null)}
            className="mt-1.5 text-xs text-blue-500 hover:underline"
          >
            Reset to auto
          </button>
        )}
      </div>

      {/* Notable Events */}
      {notableEvents.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Notable Events</p>
            {multiNotableSelect && (
              <div className="flex gap-2">
                <button onClick={onSelectAllNotableEvents} className="text-xs text-blue-500 hover:underline">All</button>
                <button onClick={onClearAllNotableEvents} className="text-xs text-blue-500 hover:underline">Clear</button>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            {notableEvents.map(ev => {
              const active = activeNotableEventIds.has(ev.id);
              return (
                <button
                  key={ev.id}
                  onClick={() => onToggleNotableEvent(ev.id)}
                  title={`${ev.display_date}${ev.date_approximate ? " (approx.)" : ""}\n${ev.description ?? ""}`}
                  className={`px-2.5 py-1.5 rounded text-xs border text-left transition-colors leading-snug ${
                    active
                      ? "bg-red-50 text-red-700 border-red-400"
                      : "bg-white text-gray-500 border-gray-300 hover:border-red-300 hover:text-red-500"
                  }`}
                >
                  <span className={`inline-block w-2 h-2 rounded-full border mr-1.5 mb-px flex-shrink-0 ${
                    active
                      ? "bg-red-500 border-red-500"
                      : multiNotableSelect
                        ? "bg-gray-200 border-gray-300"
                        : "bg-white border-gray-400"
                  }`} />
                  {ev.title}
                  {ev.date_approximate && <span className="ml-1 opacity-60 text-[10px]">~</span>}
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-1.5 mt-2">
          <label className="flex items-center justify-between cursor-pointer select-none">
            <span className="text-xs text-gray-500">Multiple selection</span>
            <button
              onClick={onToggleMultiNotableSelect}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                multiNotableSelect ? "bg-red-500" : "bg-gray-300"
              }`}
              role="switch"
              aria-checked={multiNotableSelect}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                multiNotableSelect ? "translate-x-4" : "translate-x-1"
              }`} />
            </button>
          </label>
          <label className="flex items-center justify-between cursor-pointer select-none">
            <span className="text-xs text-gray-500">Show labels</span>
            <button
              onClick={onToggleNotableLabels}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                showNotableLabels ? "bg-red-500" : "bg-gray-300"
              }`}
              role="switch"
              aria-checked={showNotableLabels}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                showNotableLabels ? "translate-x-4" : "translate-x-1"
              }`} />
            </button>
          </label>
          </div>
        </div>
      )}

      {/* Experimental */}
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Experimental</p>
        <div className="flex flex-col gap-3">

          {/* Toggles */}
          <label className="flex items-center justify-between cursor-pointer select-none">
            <span className="text-sm text-gray-600">Ongoing tail</span>
            <button
              aria-label="Ongoing tail"
              disabled={ongoingCount === 0}
              title={ongoingCount === 0 ? "All mandates in this dataset have an end date" : "Show a fading tail and arrow on ongoing mandates"}
              onClick={onToggleOngoingTail}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                showOngoingTail ? "bg-indigo-600" : "bg-gray-300"
              }`}
              role="switch" aria-checked={showOngoingTail}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                showOngoingTail ? "translate-x-4" : "translate-x-1"
              }`} />
            </button>
          </label>
          {ongoingCount === 0 && <p className="text-xs text-gray-400 -mt-1">No ongoing mandates in this dataset.</p>}
          <label className="flex items-center justify-between cursor-pointer select-none">
            <span className="text-sm text-gray-600">Unstack bars</span>
            <button
              onClick={onToggleUnstackBars}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                unstackBars ? "bg-indigo-600" : "bg-gray-300"
              }`}
              role="switch" aria-checked={unstackBars}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                unstackBars ? "translate-x-4" : "translate-x-1"
              }`} />
            </button>
          </label>
          <label className="flex items-center justify-between cursor-pointer select-none">
            <span className="text-sm text-gray-600">Auto unstack on zoom</span>
            <button
              onClick={onToggleAutoUnstack}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                autoUnstackEnabled ? "bg-indigo-600" : "bg-gray-300"
              }`}
              role="switch" aria-checked={autoUnstackEnabled}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                autoUnstackEnabled ? "translate-x-4" : "translate-x-1"
              }`} />
            </button>
          </label>
          <label className="flex items-center justify-between cursor-pointer select-none">
            <span className="text-sm text-gray-600">Transparent tooltip</span>
            <button
              onClick={onToggleTooltipTransparent}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                tooltipTransparent ? "bg-indigo-600" : "bg-gray-300"
              }`}
              role="switch" aria-checked={tooltipTransparent}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                tooltipTransparent ? "translate-x-4" : "translate-x-1"
              }`} />
            </button>
          </label>
        </div>
      </div>

      <p className="text-xs text-gray-400 leading-relaxed mt-auto">
        Jurisdiction colours are consistent across the timeline. Use the top bar to hide either panel for a wider view.
      </p>
    </div>
  );
}
