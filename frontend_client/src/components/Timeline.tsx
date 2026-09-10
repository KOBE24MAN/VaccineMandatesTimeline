import { useEffect, useMemo, useRef } from "react";
import { scaleUtc, utcFormat, utcDay } from "d3";
import type {
  EventIndex,
  NotableEvent,
  Region,
  TimelineSegment,
} from "../types/event";
import { parseDate } from "../utils/dates";

export const REGION_COLOR: Record<Region, string> = {
  WA: "#2563EB",
  NT: "#EA580C",
  QLD: "#DC2626",
  NSW: "#16A34A",
  VIC: "#7C3AED",
  TAS: "#0D9488",
  SA: "#DB2777",
  ACT: "#A16207",
};
interface Props {
  events: EventIndex[];
  windowStart: Date;
  windowEnd: Date;
  selectedEventId: string | null;
  focusRow?: { id: string; request: number } | null;
  onEventClick: (id: string) => void;
  onEventDoubleClick: (id: string) => void;
  notableEvents: NotableEvent[];
  showNotableLabels: boolean;
}
export function Timeline({
  events,
  windowStart,
  windowEnd,
  selectedEventId,
  focusRow,
  onEventClick,
  onEventDoubleClick,
  notableEvents,
  showNotableLabels,
}: Props) {
  const selectedRow = useRef<HTMLDivElement>(null);
  const scale = useMemo(
    () => scaleUtc().domain([windowStart, windowEnd]).range([0, 100]),
    [windowStart, windowEnd],
  );
  const days = (windowEnd.getTime() - windowStart.getTime()) / 86_400_000;
  const ticks = days < 7 ? scale.ticks(utcDay.every(1)!) : scale.ticks(5);
  const tickLabel = utcFormat(days < 120 ? "%d %b" : "%b %Y");
  const inWindow = (segment: TimelineSegment) =>
    parseDate(segment.start) <= windowEnd &&
    parseDate(segment.end) >= windowStart;
  const visibleNotable = notableEvents.filter(
    (event) =>
      parseDate(event.display_date) >= windowStart &&
      parseDate(event.display_date) <= windowEnd,
  );
  useEffect(() => {
    selectedRow.current?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [focusRow]);

  if (!events.length)
    return (
      <div className="empty-state">
        <h2>No mandates match these filters</h2>
        <p>Select a jurisdiction and a mandate type, or reset filters.</p>
      </div>
    );
  const hasVisibleSegment = events.some((event) =>
    event.segments.some(inWindow),
  );
  return (
    <div className="timeline-scroll" aria-label="Mandate timeline">
      {!hasVisibleSegment && (
        <p className="notice">
          No dated segments fall in this window. Adjust the dates or use Full
          range. Records remain available below.
        </p>
      )}
      <div className="timeline-grid">
        <div className="timeline-axis">
          <div className="axis-label">MANDATE / POLICY TARGET</div>
          <div className="axis-track">
            {ticks.map((tick) => (
              <span
                className="axis-tick"
                key={tick.toISOString()}
                style={{ left: `${scale(tick)}%` }}
              >
                {tickLabel(tick)}
              </span>
            ))}
          </div>
        </div>
        {visibleNotable.length > 0 && showNotableLabels && (
          <div className="notable-strip">
            <strong>Notable events</strong>
            <div>
              {visibleNotable.map((event) => (
                <span key={event.id} title={event.description ?? undefined}>
                  {event.title} · {event.date_approximate ? "≈ " : ""}
                  {event.display_date}
                </span>
              ))}
            </div>
          </div>
        )}
        {events.map((event, index) => {
          const selected =
            event.id === selectedEventId ||
            event.boosterIds.includes(selectedEventId ?? "");
          const visible = event.segments.filter(inWindow);
          // Original fills first; booster intervals cover them, then announcement markers.
          const ordered = [...visible].sort(
            (a, b) =>
              ({ active: 0, booster: 1, announcement: 2 })[a.kind] -
              { active: 0, booster: 1, announcement: 2 }[b.kind],
          );
          return (
            <div
              key={event.id}
              data-mandate-id={event.id}
              className={`timeline-row ${selected ? "selected" : ""}`}
              ref={event.id === focusRow?.id ? selectedRow : undefined}
            >
              <button
                className="row-label"
                onClick={() => onEventClick(event.id)}
                onDoubleClick={() => onEventDoubleClick(event.id)}
                title={`${event.title}\n${event.target ?? ""}`}
              >
                <span className="row-meta">
                  <span style={{ color: REGION_COLOR[event.region] }}>
                    {event.region}
                  </span>{" "}
                  / #{event.id}
                  {event.boosterIds.length > 0 && (
                    <span className="booster-tag">+ booster</span>
                  )}
                </span>
                <span className="row-title">{event.target || event.title}</span>
              </button>
              <div
                className="row-track"
                style={{ backgroundColor: index % 2 ? "#fff" : "#f8fafc" }}
              >
                {ticks.map((tick) => (
                  <span
                    className="gridline"
                    key={tick.toISOString()}
                    style={{ left: `${scale(tick)}%` }}
                  />
                ))}
                {visibleNotable.map((item) => (
                  <span
                    key={item.id}
                    className="notable-line"
                    style={{ left: `${scale(parseDate(item.display_date))}%` }}
                    title={item.title}
                  />
                ))}
                {!event.segments.length && (
                  <span className="segment-note">
                    Dates incomplete · open details
                  </span>
                )}
                {event.segments.length > 0 && !visible.length && (
                  <span className="segment-note">Outside selected dates</span>
                )}
                {ordered.map((segment) => {
                  const left = Math.max(0, scale(parseDate(segment.start)));
                  const right = Math.min(100, scale(parseDate(segment.end)));
                  const label =
                    segment.kind === "announcement"
                      ? "Announcement"
                      : segment.kind === "active"
                        ? "Original mandate"
                        : "Booster mandate";
                  return (
                    <button
                      key={`${segment.kind}-${segment.recordId}`}
                      data-segment={segment.kind}
                      data-record-id={segment.recordId}
                      className={`mandate-segment segment-${segment.kind}`}
                      style={{
                        left: `${left}%`,
                        width:
                          segment.kind === "announcement"
                            ? undefined
                            : `max(4px, ${right - left}%)`,
                        backgroundColor:
                          segment.kind === "active"
                            ? REGION_COLOR[event.region]
                            : undefined,
                      }}
                      aria-label={`${label} #${segment.recordId}: ${event.title}, ${segment.start}${segment.end !== segment.start ? ` to ${segment.end}` : ""}`}
                      title={`${label} #${segment.recordId}\n${segment.start}${segment.end !== segment.start ? ` → ${segment.end}` : ""}\n${event.title}\n${event.target ?? ""}`}
                      onClick={() => onEventClick(segment.recordId)}
                      onDoubleClick={() => onEventDoubleClick(event.id)}
                    >
                      {segment.kind !== "announcement" && right - left > 18 && (
                        <span>
                          {segment.kind === "booster"
                            ? `Booster #${segment.recordId}`
                            : event.types.join(" · ")}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
