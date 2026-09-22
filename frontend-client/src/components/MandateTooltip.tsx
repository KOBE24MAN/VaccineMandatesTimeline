import * as d3 from "d3";
import type { EventIndex } from "../types/event";
import { linkedBoosterRecord, mandateHeading } from "../utils/mandateDetails";

function activeColor(color: string, type: string): string {
  const hsl = d3.hsl(color);
  return type === "Employment"
    ? d3.hsl(hsl.h, hsl.s, Math.max(hsl.l - 0.12, 0.15)).toString()
    : d3.hsl(hsl.h, hsl.s * 0.65, Math.min(hsl.l + 0.18, 0.82)).toString();
}

function TooltipPeriods({ event, color }: { event: EventIndex; color: string }) {
  const effective = event.effective_date === undefined ? event.start_date : event.effective_date;
  const firstStageEnd = effective ?? event.enforcement_date;
  const end = event.ongoing ? "Ongoing" : event.end_date ?? "End date not recorded";
  const periods = [
    ...(event.announcement_date && firstStageEnd && event.announcement_date < firstStageEnd ? [{
      label: effective ? "Announced → effective" : "Announced → enforcement",
      dates: `${event.announcement_date} → ${firstStageEnd}`,
      meaning: effective ? "Announced, not yet effective · pale dashed segment" : "Effective date not recorded · pale dashed segment",
      kind: "announcement",
    }] : []),
    ...(effective && event.enforcement_date && effective < event.enforcement_date ? [{
      label: "Effective → enforcement",
      dates: `${effective} → ${event.enforcement_date}`,
      meaning: "Effective, pending enforcement · light stripes",
      kind: "pending",
    }] : []),
    {
      label: event.enforcement_date ? "Enforcement → removal" : "Mandate period",
      dates: `${event.enforcement_date ?? event.start_date} → ${end}`,
      meaning: event.enforcement_date ? "Active mandate · original solid colour" : "Enforcement date not recorded · solid colour",
      kind: "active",
    },
  ];
  return <div className="mt-2 space-y-2 border-t border-gray-200 pt-2">
    {periods.map(period => <div key={period.kind} className="flex gap-2 leading-snug">
      <span className="mt-1 h-2.5 w-3.5 flex-shrink-0 rounded-sm" style={{
        background: period.kind === "announcement" ? `${color}20`
          : period.kind === "pending" ? `repeating-linear-gradient(45deg, white 0 3px, ${color} 3px 5px)`
          : activeColor(color, event.type),
        border: period.kind === "announcement" ? `1px dashed ${color}` : undefined,
      }} />
      <div>
        <p className="font-semibold text-gray-700">{period.label}</p>
        <p className="text-gray-800 tabular-nums">{period.dates}</p>
        <p className="text-[11px] text-gray-500">{period.meaning}</p>
      </div>
    </div>)}
    {effective && effective === event.enforcement_date && <p className="text-[11px] text-gray-500">Effective and enforced on the same day ({effective}); no pending period.</p>}
    {event.announcement_date && (!firstStageEnd || event.announcement_date >= firstStageEnd) && <p className="text-[11px] text-gray-500">Announced: {event.announcement_date}{event.announcement_date === firstStageEnd ? " (same day as effective / enforcement)" : ""}.</p>}
    {!effective && <p className="text-[11px] text-gray-500">Effective date not recorded.</p>}
  </div>;
}


/** A quick timeline summary; full policy text belongs in the information bar. */
export function MandateTooltip({ events, color, transparent = false }: {
  events: EventIndex[];
  color: string;
  transparent?: boolean;
}) {
  const event = events[0];
  if (!event) return null;
  const boosters = [...new Map(events.flatMap(item => {
    const record = linkedBoosterRecord(item);
    return record ? [[record.id, record] as const] : [];
  })).values()];
  return (
    <div data-mandate-tooltip-summary={event.id}>
      <p className={`font-semibold mb-1 ${transparent ? "text-gray-900" : "text-gray-800"}`}>
        {mandateHeading(event.id, event.title)}
      </p>
      {events.length > 1 && <p className="text-gray-500 mb-1">Grouped with {events.slice(1).map(item => `(ID:${item.id})`).join(", ")}</p>}
      <p className={transparent ? "text-gray-600" : "text-gray-500"}>{event.region} · {event.type}</p>
      <TooltipPeriods event={event} color={color} />
      {event.short_description && <ul className="mt-1 space-y-0.5 list-none">
        {event.short_description.split("\n").map((line, index) => <li key={index} className="leading-snug text-gray-600">· {line}</li>)}
      </ul>}
      {boosters.map(booster => (
        <div key={booster.id} data-tooltip-booster-id={booster.id} className="mt-2 pt-2 border-t border-gray-200">
          <p className="font-semibold mb-1 text-gray-800">{mandateHeading(booster.id, booster.name)}</p>
          <p className="text-gray-500">{booster.jurisdiction ?? event.region} · {booster.type ?? event.type}</p>
          <div className="flex gap-2 leading-snug mt-2">
            <span className="mt-1 h-2.5 w-3.5 flex-shrink-0 rounded-sm" style={{
              background: `repeating-linear-gradient(-45deg, ${d3.color(color)?.darker(1.25)} 0 3px, white 3px 4px)`,
            }} />
            <div>
              <p className="font-semibold text-gray-700">Booster enforcement → booster removal</p>
              <p className="text-gray-800 tabular-nums">{booster.enforcement_date ?? "Date not recorded"} → {booster.ongoing ? "Ongoing" : booster.removal_date ?? "End date not recorded"}</p>
              <p className="text-[11px] text-gray-500">Booster requirement · dark striped overlay</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
