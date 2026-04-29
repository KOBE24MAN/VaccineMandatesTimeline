import { useEffect, useState } from "react";
import type { EventIndex, EventDetail as EventDetailType } from "../types/event";
import { REGION_COLOR } from "./Timeline";

interface Props {
  eventId: string | null;
  groupIds: string[] | null;
  events: EventIndex[];
  fetchDetail: (id: string) => Promise<EventDetailType>;
  onClose: () => void;
  onSelectFromGroup: (id: string) => void;
}

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function fmt(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date + "T00:00:00").toLocaleDateString("en-AU", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function DateRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-gray-400 w-24 flex-shrink-0">{label}</span>
      <span className="text-gray-700">{fmt(value)}</span>
    </div>
  );
}

function SummaryCard({ ev, onSelect }: { ev: EventIndex; onSelect: () => void }) {
  const color = REGION_COLOR[ev.region] ?? "#5a84ff";
  // Format target_category tags (comma/underscore separated) into readable pills
  const categoryTags = ev.short_description
    ? ev.short_description.split(",").map(t => t.trim().replace(/_/g, " ")).filter(Boolean)
    : [];

  return (
    <button
      onClick={onSelect}
      className="w-full text-left rounded border border-l-4 border-black/10 transition-shadow hover:shadow-md"
      style={{ borderLeftColor: color, backgroundColor: hexToRgba(color, 0.07) }}
    >
      <div className="p-3">
        <div className="flex flex-wrap gap-1 mb-2">
          <span className="text-xs px-2 py-0.5 rounded-full border"
            style={{ backgroundColor: hexToRgba(color, 0.15), borderColor: hexToRgba(color, 0.35), color }}>
            {ev.region}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-gray-600">
            {ev.type}
          </span>
          {categoryTags.map(tag => (
            <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-gray-50 border border-gray-200 text-gray-500">
              {tag}
            </span>
          ))}
        </div>
        {ev.target && (
          <p className="text-xs text-gray-800 leading-snug mb-2 font-medium">{ev.target}</p>
        )}
        <div className="flex flex-col gap-0.5">
          <DateRow label="Effective" value={ev.start_date} />
          <DateRow label="Enforcement" value={ev.enforcement_date} />
          <DateRow label="Removal" value={ev.end_date} />
        </div>
      </div>
      <div className="px-3 py-1.5 border-t border-black/10 text-right text-xs font-semibold" style={{ color }}>
        View full details →
      </div>
    </button>
  );
}

function DetailCard({ detail }: { detail: EventDetailType }) {
  const color = REGION_COLOR[detail.region] ?? "#5a84ff";
  const sections = [
    { label: "Compliance",       value: detail.compliance },
    { label: "Exemptions",       value: detail.exemptions },
    { label: "Enforcement",      value: detail.enforcement_measures },
    { label: "Executive orders", value: detail.executive_orders },
    { label: "Removal method",   value: detail.removal_method },
    { label: "Removal details",  value: detail.removal_details },
  ].filter(s => s.value);

  return (
    <div className="rounded border border-l-4 border-black/10 overflow-hidden"
      style={{ borderLeftColor: color, backgroundColor: hexToRgba(color, 0.07) }}>
      <div className="p-3">
        <p className="font-bold text-sm text-gray-900 leading-snug mb-1.5">{detail.title}</p>
        <div className="flex flex-wrap gap-1 mb-2">
          <span className="text-xs px-2 py-0.5 rounded-full border"
            style={{ backgroundColor: hexToRgba(color, 0.15), borderColor: hexToRgba(color, 0.35), color }}>
            {detail.region}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-gray-600">
            {detail.type}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 mb-2">
          <DateRow label="Effective"    value={detail.start_date} />
          <DateRow label="Enforcement"  value={detail.enforcement_date} />
          <DateRow label="Removal"      value={detail.end_date} />
        </div>
        {detail.target && (
          <p className="text-xs text-gray-600 leading-snug">{detail.target}</p>
        )}
      </div>

      {sections.map(({ label, value }) => (
        <div key={label} className="px-3 py-2 border-t border-black/10">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
          <p className="text-xs text-gray-700 leading-snug">{value}</p>
        </div>
      ))}

      {(detail.authority || detail.ref_code) && (
        <div className="px-3 py-2 border-t border-black/10 flex flex-wrap gap-3">
          {detail.authority && <p className="text-xs text-gray-400">Authority: {detail.authority}</p>}
          {detail.ref_code  && <p className="text-xs text-gray-400">Ref: {detail.ref_code}</p>}
        </div>
      )}
    </div>
  );
}

export function EventDetail({ eventId, groupIds, events, fetchDetail, onClose, onSelectFromGroup }: Props) {
  const [detail, setDetail] = useState<EventDetailType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (eventId === null) { setDetail(null); return; }
    setLoading(true);
    setError(null);
    fetchDetail(eventId)
      .then(data => { setDetail(data); setLoading(false); })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load event");
        setLoading(false);
      });
  }, [eventId, fetchDetail]);

  const isEmpty = eventId === null && !groupIds;
  const groupEvents = groupIds
    ? (groupIds.map(id => events.find(e => e.id === id)).filter(Boolean) as EventIndex[])
    : [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
        <div>
          <h2 className="text-base font-bold text-gray-800">Information bar</h2>
          {groupIds && (
            <p className="text-xs text-gray-400 mt-0.5">
              {groupEvents.length} linked {groupEvents.length === 1 ? "mandate" : "mandates"}
            </p>
          )}
          {!groupIds && !isEmpty && (
            <p className="text-xs text-gray-400 mt-0.5">Click a bar to explore</p>
          )}
        </div>
        {!isEmpty && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none" title="Clear selection">
            &times;
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {isEmpty && (
          <div className="flex-1 flex items-center justify-center text-gray-300 text-sm text-center">
            Click a mandate bar to see details
          </div>
        )}

        {/* Group view — multiple summary cards */}
        {groupIds && groupEvents.map(ev => (
          <SummaryCard key={ev.id} ev={ev} onSelect={() => onSelectFromGroup(ev.id)} />
        ))}

        {/* Single event view — full detail card */}
        {eventId && (
          <>
            {loading && <p className="text-gray-500 text-sm">Loading…</p>}
            {error   && <p className="text-red-500 text-sm">{error}</p>}
            {detail  && <DetailCard detail={detail} />}
          </>
        )}
      </div>
    </div>
  );
}
