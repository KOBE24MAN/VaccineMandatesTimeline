import type { EventIndex } from "../types/event";
import { eventRecord, linkedBoosterRecord, mandateFields, mandateHeading, type MandateRecord } from "../utils/mandateDetails";

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
  ["announcement_date", "Announced"],
  ["effective_date", "Effective"],
  ["enforcement_date", "Enforcement"],
  ["removal_date", "Removal"],
] as const;

// Keep the original information bar's section order and concise labels.
const DETAIL_SECTIONS = [
  ["compliance", "Compliance"],
  ["exemptions", "Exemptions"],
  ["enforcement_measures", "Enforcement"],
  ["executive_orders", "Executive orders"],
  ["removal_method", "Removal method"],
  ["removal_details", "Removal details"],
  ["communications", "Communications"],
  ["vaccine_eligibility_info", "Vaccine eligibility"],
  ["vaccine_availability_info", "Vaccine availability"],
  ["ATAGI", "ATAGI"],
  ["uptake", "Uptake"],
  ["popu_info", "Population affected"],
  ["notes", "Notes"],
  ["source", "Source"],
] as const;

const FOOTER_FIELDS = [
  ["authority", "Authority"],
  ["ref_code", "Ref"],
  ["ref_no", "Ref no"],
] as const;

function recordValues(record: MandateRecord) {
  return Object.fromEntries(mandateFields(record).map(({ key, value }) => [key, value]));
}

function MandateHeader({ record, color, booster = false, summary = false }: {
  record: MandateRecord;
  color: string;
  booster?: boolean;
  summary?: boolean;
}) {
  const values = recordValues(record);
  const target = values.target && (
    <p data-mandate-field="target"
      className={`text-xs leading-snug whitespace-pre-wrap break-words ${summary ? "text-gray-800 mb-2 font-medium" : "text-gray-600"}`}>
      {values.target}
    </p>
  );

  return (
    <div className="p-3">
      {booster && <p className="text-xs font-semibold text-gray-500 mb-1">Linked booster mandate</p>}
      <h3 className="font-bold text-sm text-gray-900 leading-snug mb-1.5 break-words">
        <span data-mandate-field="id">(ID:{record.id})</span>{" "}
        <span data-mandate-field="name">{values.name || "Unnamed mandate"}</span>
      </h3>
      <div className="flex flex-wrap gap-1 mb-2">
        {values.jurisdiction && <span data-mandate-field="jurisdiction"
          className="text-xs px-2 py-0.5 rounded-full border"
          style={{ backgroundColor: hexToRgba(color, 0.15), borderColor: hexToRgba(color, 0.35), color }}>
          {values.jurisdiction}
        </span>}
        {values.type && <span data-mandate-field="type"
          className="text-xs px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-gray-600">
          {values.type}
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
      {!summary && (values.duration_days || values.booster_id) && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-xs text-gray-400">
          {values.duration_days && <span data-mandate-field="duration_days">Duration: {values.duration_days} days</span>}
          {values.booster_id && <span data-mandate-field="booster_id">Booster ID: {values.booster_id}</span>}
        </div>
      )}
    </div>
  );
}

function MandateCard({ record, color, booster = false }: {
  record: MandateRecord;
  color: string;
  booster?: boolean;
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
      {DETAIL_SECTIONS.map(([key, label]) => values[key] && (
        <div key={key} data-mandate-field={key} className="px-3 py-2 border-t border-black/10">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
          <p className="text-xs text-gray-700 leading-snug whitespace-pre-wrap break-words">{values[key]}</p>
        </div>
      ))}
      {FOOTER_FIELDS.some(([key]) => values[key]) && (
        <div className="px-3 py-2 border-t border-black/10 flex flex-wrap gap-3">
          {FOOTER_FIELDS.map(([key, label]) => values[key] && (
            <p key={key} data-mandate-field={key} className="text-xs text-gray-400 whitespace-pre-wrap break-words">
              {label}: {values[key]}
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
export function MandateDetails({ event, color }: { event: EventIndex; color: string }) {
  const booster = linkedBoosterRecord(event);
  return (
    <div data-mandate-pair-id={event.id} className="flex flex-col gap-2">
      <MandateCard record={eventRecord(event)} color={color} />
      {booster && <MandateCard record={booster} color={color} booster />}
    </div>
  );
}
