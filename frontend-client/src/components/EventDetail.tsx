import { useEffect, useState } from "react";
import type { EventIndex, EventDetail as EventDetailType, Region } from "../types/event";
import type { DateIssueRecord } from "../hooks/useEvents";
import { REGION_COLOR } from "./Timeline";
import { DETAIL_SECTIONS, FOOTER_FIELDS, MandateDetails, MandateSummary } from "./MandateDetails";
import { mandateFields, mandateLabel } from "../utils/mandateDetails";

interface DateNotice {
  hiddenRecords: DateIssueRecord[];
}

interface Props {
  eventId: string | null;
  groupIds: string[] | null;
  events: EventIndex[];
  fetchDetail: (id: string) => Promise<EventDetailType>;
  onClose: () => void;
  onSelectFromGroup: (id: string) => void;
  onBackToGroup?: () => void;
  dateNotice?: DateNotice;
}

function formatHiddenField(key: string, value: string) {
  return key === "ref_no" ? value.split(/[\s,]+/).filter(Boolean).join(", ") : value;
}

function hexToRgba(hex: string, alpha: number) {
  const value = parseInt(hex.replace("#", ""), 16);
  return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

function formatCompactDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

const HIDDEN_DATE_FIELDS = [
  ["announcement_date", mandateLabel("announcement_date")],
  ["effective_date", mandateLabel("effective_date")],
  ["enforcement_date", mandateLabel("enforcement_date")],
  ["removal_date", mandateLabel("removal_date")],
] as const;

function HiddenRecordCard({ record }: { record: DateIssueRecord["record"] }) {
  const [expanded, setExpanded] = useState(false);
  const fields = mandateFields(record).filter(field => field.key !== "duration_days");
  const values = Object.fromEntries(fields.map(field => [field.key, field.value]));
  const color = REGION_COLOR[(record.jurisdiction ?? "") as Region] ?? "#6B7280";

  return (
    <section
      className="overflow-hidden rounded border border-l-4 border-black/10"
      style={{ borderLeftColor: color, backgroundColor: hexToRgba(color, 0.07) }}
    >
      <button
        onClick={() => setExpanded(value => !value)}
        className="w-full p-3 text-left transition-colors hover:bg-white/40"
        aria-expanded={expanded}
      >
        <p className="text-sm font-bold leading-snug text-gray-900">
          <span className="text-xs text-gray-500">{mandateLabel("id")}: </span>{record.id}
          <br />
          <span className="text-xs text-gray-500">{mandateLabel("name")}: </span>{record.name || "Unnamed mandate"}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {record.jurisdiction && (
            <span
              className="rounded-full border px-2 py-0.5 text-xs"
              style={{ color, borderColor: hexToRgba(color, 0.35), backgroundColor: hexToRgba(color, 0.15) }}
            >
              <span className="font-semibold">{mandateLabel("jurisdiction")}:</span>&nbsp;{record.jurisdiction}
            </span>
          )}
          {record.type && (
            <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              <span className="font-semibold">{mandateLabel("type")}:</span>&nbsp;{record.type}
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-col gap-0.5">
          {HIDDEN_DATE_FIELDS.map(([key, label]) => values[key] && (
            <div key={key} className="flex gap-2 text-xs">
              <span className="w-24 flex-shrink-0 text-gray-400">{label}</span>
              <span className="break-words text-gray-700">{formatCompactDate(values[key])}</span>
            </div>
          ))}
        </div>
        {values.target && (
          <div className="mt-2">
            <p className="mb-0.5 text-xs font-bold tracking-wide text-gray-500">{mandateLabel("target")}</p>
            <p className="whitespace-pre-wrap break-words text-xs font-medium leading-snug text-gray-700">
              {values.target}
            </p>
          </div>
        )}
        {values.booster_id && (
          <p className="mt-2 text-xs text-gray-400">{mandateLabel("booster_id")}: {values.booster_id}</p>
        )}
        <div className="mt-2 border-t border-black/10 pt-1.5 text-right text-xs font-semibold" style={{ color }}>
          {expanded ? "Hide full details ↑" : "View full details →"}
        </div>
      </button>
      {expanded && DETAIL_SECTIONS.map(([key, label]) => values[key] && (
        <div key={key} className="border-t border-black/10 px-3 py-2">
          <p className="mb-0.5 text-xs font-bold tracking-wide text-gray-500">{label}</p>
          <p className="whitespace-pre-wrap break-words text-xs leading-snug text-gray-700">{values[key]}</p>
        </div>
      ))}
      {expanded && FOOTER_FIELDS.some(([key]) => values[key]) && (
        <div className="flex flex-col gap-1 border-t border-black/10 px-3 py-2">
          {FOOTER_FIELDS.map(([key, label]) => values[key] && (
            <p key={key} className="whitespace-pre-wrap break-words text-xs text-gray-400">
              {label}: {formatHiddenField(key, values[key])}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

function HiddenDateRecordsPanel({ records, global, onClose }: {
  records: DateIssueRecord[];
  global: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed z-40 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl"
      style={{ top: 96, right: 332, bottom: 24, width: "min(460px, calc(100vw - 352px))" }}
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-200 bg-white px-3 py-2">
        <div>
          <h3 className="text-sm font-bold text-gray-800">
            {global ? "Global hidden information" : "Hidden information for this timeline"}
          </h3>
          <p className="text-xs text-gray-400">
            {records.length} {global ? "records across the full dataset" : "related records for the selected timeline"}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-lg leading-none text-gray-400 hover:text-gray-700"
          aria-label="Close hidden information"
        >
          &times;
        </button>
      </div>
      <div className="p-3 flex flex-col gap-2">
        {records.map(({ record }) => <HiddenRecordCard key={record.id} record={record} />)}
      </div>
    </div>
  );
}

export function EventDetail({ eventId, groupIds, events, fetchDetail, onClose, onSelectFromGroup, onBackToGroup, dateNotice }: Props) {
  const [detail, setDetail] = useState<EventDetailType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFullDetails, setShowFullDetails] = useState(false);
  const [hiddenPanelMode, setHiddenPanelMode] = useState<"global" | "selected" | null>(null);
  const [dateNoticeDismissed, setDateNoticeDismissed] = useState(false);

  useEffect(() => {
    if (eventId === null) { setDetail(null); setShowFullDetails(false); return; }
    let cancelled = false;
    setDetail(null);
    setShowFullDetails(false);
    setLoading(true);
    setError(null);
    fetchDetail(eventId)
      .then(data => { if (!cancelled) { setDetail(data); setLoading(false); } })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load event");
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [eventId, fetchDetail]);

  const isEmpty = eventId === null && !groupIds;
  const groupEvents = groupIds
    ? (groupIds.map(id => events.find(e => e.id === id)).filter(Boolean) as EventIndex[])
    : [];
  const hiddenRecords = dateNotice?.hiddenRecords ?? [];
  const selectedEvents = eventId
    ? events.filter(event => event.id === eventId || event.booster?.id === eventId)
    : groupEvents;
  const selectedHiddenRecords = selectedEvents.length
    ? hiddenRecords.filter(({ record }) => selectedEvents.some(event =>
        record.jurisdiction === event.region &&
        (record.type ?? "").split(",").some(type => event.type.split(",").map(value => value.trim()).includes(type.trim()))))
    : hiddenRecords;
  const hiddenCount = hiddenRecords.length;
  const selectedHiddenCount = selectedHiddenRecords.length;
  const selectedColor = selectedEvents.length > 0
    ? REGION_COLOR[selectedEvents[0].region] ?? "#6B7280"
    : "#6B7280";
  const hasLinkedBooster = Boolean(detail?.booster || detail?.boosterRecord);

  useEffect(() => {
    if (hiddenCount === 0) {
      setHiddenPanelMode(null);
    }
  }, [hiddenCount]);

  useEffect(() => {
    setHiddenPanelMode(mode => mode === "selected" ? null : mode);
  }, [eventId, groupIds]);

  return (
    <div className="relative flex flex-col">
      {hiddenPanelMode && (
        <HiddenDateRecordsPanel
          records={hiddenPanelMode === "global" ? hiddenRecords : selectedHiddenRecords}
          global={hiddenPanelMode === "global"}
          onClose={() => setHiddenPanelMode(null)}
        />
      )}

      <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
        <div className="min-w-0 flex-1 pr-3">
          <h2 className="text-base font-bold text-gray-800">Information bar</h2>
          {groupIds && (
            <p className="text-xs text-gray-400 mt-0.5">
              {groupEvents.length} linked {groupEvents.length === 1 ? "mandate" : "mandates"}
            </p>
          )}
          {!groupIds && !isEmpty && (
            <p className="text-xs text-gray-400 mt-0.5">
              {hasLinkedBooster ? "2 linked mandates" : "Click a bar to explore"}
            </p>
          )}
          {hiddenCount > 0 && dateNotice && !dateNoticeDismissed && (
            <div className="relative mt-2">
              <div className="flex overflow-hidden rounded border border-amber-200 bg-amber-50 text-xs text-gray-500">
                <button
                  onClick={() => setHiddenPanelMode(mode => mode === "global" ? null : "global")}
                  className="flex min-w-0 flex-1 items-center justify-between gap-2 px-2 py-1 text-left hover:bg-amber-100"
                  aria-expanded={hiddenPanelMode === "global"}
                  title="Show or hide all records with hidden date fields"
                >
                  <span className="truncate">{hiddenCount} records have hidden date fields globally</span>
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-white">!</span>
                </button>
                <button
                  onClick={() => {
                    setDateNoticeDismissed(true);
                    setHiddenPanelMode(mode => mode === "global" ? null : mode);
                  }}
                  className="flex w-7 flex-shrink-0 items-center justify-center border-l border-amber-200 text-base text-amber-500 hover:bg-amber-100 hover:text-amber-700"
                  aria-label="Hide date issue notice"
                  title="Hide this notice"
                >
                  &times;
                </button>
              </div>
            </div>
          )}
        </div>
        {!isEmpty && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none" title="Clear selection" aria-label="Clear selection">
            &times;
          </button>
        )}
      </div>

      <div className="p-3 flex flex-col gap-3">
        {!isEmpty && (
          <button
            onClick={() => selectedHiddenCount > 0 && setHiddenPanelMode(mode => mode === "selected" ? null : "selected")}
            disabled={selectedHiddenCount === 0}
            className="flex w-full items-center justify-between gap-3 rounded border px-3 py-2 text-left text-xs font-semibold transition-colors disabled:cursor-default disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
            style={selectedHiddenCount > 0 ? {
              color: selectedColor,
              borderColor: hexToRgba(selectedColor, 0.35),
              backgroundColor: hexToRgba(selectedColor, 0.08),
            } : undefined}
            aria-expanded={hiddenPanelMode === "selected"}
          >
            <span>
              {selectedHiddenCount > 0
                ? `${selectedHiddenCount} ${selectedHiddenCount === 1 ? "record has" : "records have"} hidden information in this timeline`
                : "No hidden information in this timeline"}
            </span>
            {selectedHiddenCount > 0 && <span aria-hidden="true">{hiddenPanelMode === "selected" ? "▲" : "▼"}</span>}
          </button>
        )}

        {isEmpty && (
          <div className="flex-1 flex items-center justify-center text-gray-300 text-sm text-center">
            Click a mandate bar to see details
          </div>
        )}

        {/* Group view — compact cards, with full records available on selection. */}
        {groupIds && groupEvents.map(ev => (
          <MandateSummary key={ev.id} event={ev} color={REGION_COLOR[ev.region] ?? "#5a84ff"}
            onSelect={() => onSelectFromGroup(ev.id)} />
        ))}

        {/* Single event view — full detail card */}
        {eventId && (
          <>
            {loading && <p className="text-gray-500 text-sm">Loading…</p>}
            {error   && <p className="text-red-500 text-sm">{error}</p>}
            {detail && hasLinkedBooster && !showFullDetails && (
              <MandateSummary
                event={detail}
                color={REGION_COLOR[detail.region] ?? "#5a84ff"}
                onSelect={() => setShowFullDetails(true)}
              />
            )}
            {detail && (!hasLinkedBooster || showFullDetails) && (
              <MandateDetails
                event={detail}
                color={REGION_COLOR[detail.region] ?? "#5a84ff"}
                onBack={hasLinkedBooster && showFullDetails
                  ? () => setShowFullDetails(false)
                  : onBackToGroup ?? onClose}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
