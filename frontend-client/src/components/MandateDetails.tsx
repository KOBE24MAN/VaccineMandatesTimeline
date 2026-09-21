import type { EventIndex } from "../types/event";
import { eventRecord, linkedBoosterRecord, mandateFields, mandateHeading, type MandateRecord } from "../utils/mandateDetails";

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function MandateCard({ record, color, booster = false }: {
  record: MandateRecord;
  color: string;
  booster?: boolean;
}) {
  return (
    <section
      data-mandate-detail-id={record.id}
      data-mandate-kind={booster ? "booster" : "original"}
      aria-label={mandateHeading(record.id, record.name)}
      className="rounded border border-l-4 border-black/10 overflow-hidden"
      style={{ borderLeftColor: color, backgroundColor: hexToRgba(color, 0.07) }}
    >
      <div className="p-3">
        {booster && <p className="text-xs font-semibold text-gray-500 mb-1">Linked booster mandate</p>}
        <h3 className="font-bold text-sm text-gray-900 leading-snug break-words">
          {mandateHeading(record.id, record.name)}
        </h3>
        <div className="flex flex-wrap gap-1 mt-2">
          {record.jurisdiction && <span className="text-xs px-2 py-0.5 rounded-full border"
            style={{ backgroundColor: hexToRgba(color, 0.15), borderColor: hexToRgba(color, 0.35), color }}>
            {record.jurisdiction}
          </span>}
          {record.type && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-gray-600">
            {record.type}
          </span>}
        </div>
      </div>
      <dl>
        {mandateFields(record).map(({ key, label, value }) => (
          <div key={key} data-mandate-field={key} className="px-3 py-2 border-t border-black/10">
            <dt className="text-xs font-bold text-gray-500 mb-0.5">{label}</dt>
            <dd className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
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
