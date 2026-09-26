import type { EventIndex } from "../types/event";
import { eventRecord, linkedBoosterRecord, mandateFields, mandateHeading, mandateLabel, type MandateRecord } from "../utils/mandateDetails";

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function fmt(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("en-AU", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

const DATE_FIELDS = [
  ["announcement_date", mandateLabel("announcement_date")],
  ["effective_date", mandateLabel("effective_date")],
  ["enforcement_date", mandateLabel("enforcement_date")],
  ["removal_date", mandateLabel("removal_date")],
] as const;

// Keep the original information bar's section order while using the canonical labels.
export const DETAIL_SECTIONS = [
  ["compliance", mandateLabel("compliance")],
  ["exemptions", mandateLabel("exemptions")],
  ["enforcement_measures", mandateLabel("enforcement_measures")],
  ["executive_orders", mandateLabel("executive_orders")],
  ["removal_method", mandateLabel("removal_method")],
  ["removal_details", mandateLabel("removal_details")],
  ["communications", mandateLabel("communications")],
  ["vaccine_eligibility_info", mandateLabel("vaccine_eligibility_info")],
  ["vaccine_availability_info", mandateLabel("vaccine_availability_info")],
  ["ATAGI", mandateLabel("ATAGI")],
  ["uptake", mandateLabel("uptake")],
  ["popu_info", mandateLabel("popu_info")],
  ["notes", mandateLabel("notes")],
  ["source", mandateLabel("source")],
] as const;

export const FOOTER_FIELDS = [
  ["authority", mandateLabel("authority")],
  ["ref_code", mandateLabel("ref_code")],
  ["ref_no", mandateLabel("ref_no")],
] as const;

function recordValues(record: MandateRecord) {
  return Object.fromEntries(mandateFields(record).map(({ key, value }) => [key, value]));
}

function formatFooterValue(key: string, value: string) {
  return key === "ref_no" ? value.split(/[\s,]+/).filter(Boolean).join(", ") : value;
}

function MandateHeader({ record, color, booster = false, summary = false }: {
  record: MandateRecord;
  color: string;
  booster?: boolean;
  summary?: boolean;
}) {
  const values = recordValues(record);
  const duration = Number(values.duration_days);
  const showDuration = Boolean(values.duration_days) && Number.isFinite(duration) && duration >= 0;
  const target = values.target && (
    <div data-mandate-field="target" className={summary ? "mb-2" : ""}>
      <p className="text-xs font-bold tracking-wide text-gray-500 mb-0.5">{mandateLabel("target")}</p>
      <p className={`text-xs leading-snug whitespace-pre-wrap break-words ${summary ? "text-gray-800 font-medium" : "text-gray-600"}`}>
        {values.target}
      </p>
    </div>
  );

  return (
    <div className="p-3">
      {booster && <p className="text-xs font-semibold text-gray-500 mb-1">Linked booster mandate</p>}
      <h3 className="font-bold text-sm text-gray-900 leading-snug mb-1.5 break-words">
        <span className="text-xs text-gray-500">{mandateLabel("id")}: </span>
        <span data-mandate-field="id">{record.id}</span>
        <br />
        <span className="text-xs text-gray-500">{mandateLabel("name")}: </span>
        <span data-mandate-field="name">{values.name || "Unnamed mandate"}</span>
      </h3>
      <div className="flex flex-wrap gap-1 mb-2">
        {values.jurisdiction && <span data-mandate-field="jurisdiction"
          className="text-xs px-2 py-0.5 rounded-full border"
          style={{ backgroundColor: hexToRgba(color, 0.15), borderColor: hexToRgba(color, 0.35), color }}>
          <span className="font-semibold">{mandateLabel("jurisdiction")}:</span>&nbsp;{values.jurisdiction}
        </span>}
        {values.type && <span data-mandate-field="type"
          className="text-xs px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-gray-600">
          <span className="font-semibold">{mandateLabel("type")}:</span>&nbsp;{values.type}
        </span>}
      </div>
      {summary && target}
      <div className={`flex flex-col gap-0.5 ${summary ? "" : "mb-2"}`}>
        {DATE_FIELDS.map(([key, label]) => values[key] && (
          <div key={key} data-mandate-field={key} className="flex gap-2 text-xs">
            <span className="text-gray-400 w-24 flex-shrink-0">{label}</span>
            <span className="text-gray-700">{fmt(values[key])}</span>
          </div>
        ))}
      </div>
      {!summary && target}
      {!summary && (showDuration || values.booster_id) && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-xs text-gray-400">
          {showDuration && <span data-mandate-field="duration_days">{mandateLabel("duration_days")}: {values.duration_days}</span>}
          {values.booster_id && <span data-mandate-field="booster_id">{mandateLabel("booster_id")}: {values.booster_id}</span>}
        </div>
      )}
    </div>
  );
}

function MandateCard({ record, color, booster = false, onBack }: {
  record: MandateRecord;
  color: string;
  booster?: boolean;
  onBack?: () => void;
}) {
  const values = recordValues(record);
  return (
    <section
      data-mandate-detail-id={record.id}
      data-mandate-kind={booster ? "booster" : "original"}
      aria-label={mandateHeading(record.id, record.name)}
      className="rounded border border-l-4 border-black/10 overflow-hidden"
      style={{ borderLeftColor: color, backgroundColor: hexToRgba(color, 0.07) }}
    >
      <MandateHeader record={record} color={color} booster={booster} />
      {onBack && (
        <div className="border-t border-black/10 px-3 py-1.5 text-right">
          <button
            onClick={onBack}
            className="text-xs font-semibold transition-opacity hover:opacity-70"
            style={{ color }}
            aria-label="Back to mandate summary"
          >
            ← Back
          </button>
        </div>
      )}
      {DETAIL_SECTIONS.map(([key, label]) => values[key] && (
        <div key={key} data-mandate-field={key} className="px-3 py-2 border-t border-black/10">
          <p className="text-xs font-bold text-gray-500 tracking-wide mb-0.5">{label}</p>
          <p className="text-xs text-gray-700 leading-snug whitespace-pre-wrap break-words">{values[key]}</p>
        </div>
      ))}
      {FOOTER_FIELDS.some(([key]) => values[key]) && (
        <div className="px-3 py-2 border-t border-black/10 flex flex-col gap-1">
          {FOOTER_FIELDS.map(([key, label]) => values[key] && (
            <p key={key} data-mandate-field={key} className="text-xs text-gray-400 whitespace-pre-wrap break-words">
              {label}: {formatFooterValue(key, values[key])}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

/** Group selections use the compact overview; a click opens the full record pair. */
export function MandateSummary({ event, color, onSelect }: {
  event: EventIndex;
  color: string;
  onSelect: () => void;
}) {
  const booster = linkedBoosterRecord(event);
  return (
    <button
      onClick={onSelect}
      data-mandate-pair-id={event.id}
      aria-label={`View full details for ${mandateHeading(event.id, event.title)}`}
      className="w-full text-left rounded border border-l-4 border-black/10 transition-shadow hover:shadow-md"
      style={{ borderLeftColor: color, backgroundColor: hexToRgba(color, 0.07) }}
    >
      <div data-mandate-summary-id={event.id} data-mandate-kind="original">
        <MandateHeader record={eventRecord(event)} color={color} summary />
      </div>
      {booster && (
        <div data-mandate-summary-id={booster.id} data-mandate-kind="booster" className="border-t border-black/10">
          <MandateHeader record={booster} color={color} booster summary />
        </div>
      )}
      <div className="px-3 py-1.5 border-t border-black/10 text-right text-xs font-semibold" style={{ color }}>
        View full details →
      </div>
    </button>
  );
}

/** Always keep the full linked booster immediately below its original mandate. */
export function MandateDetails({ event, color, onBack }: { event: EventIndex; color: string; onBack?: () => void }) {
  const booster = linkedBoosterRecord(event);
  return (
    <div data-mandate-pair-id={event.id} className="flex flex-col gap-2">
      <MandateCard record={eventRecord(event)} color={color} onBack={onBack} />
      {booster && <MandateCard record={booster} color={color} booster />}
    </div>
  );
}
