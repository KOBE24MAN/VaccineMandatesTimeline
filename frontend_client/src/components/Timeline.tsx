import { useRef, useEffect, useState } from "react";
import * as d3 from "d3";
import type { EventIndex, Region, EventType } from "../types/event";
import { ALL_REGIONS } from "../types/event";
import { parseDate, yearsBetween } from "../utils/dates";

const MARGIN = { top: 32, right: 16, bottom: 8, left: 56 };
const LANE_GAP = 2; // px gap between lanes

export const REGION_COLOR: Record<Region, string> = {
  WA:  "#2563EB",
  NT:  "#EA580C",
  QLD: "#DC2626",
  NSW: "#16A34A",
  VIC: "#7C3AED",
  TAS: "#0D9488",
  SA:  "#DB2777",
  ACT: "#CA8A04",
};

function eventColor(region: Region, type: string): string {
  const hsl = d3.hsl(REGION_COLOR[region]);
  if (type === "Employment")
    return d3.hsl(hsl.h, hsl.s, Math.max(hsl.l - 0.12, 0.15)).toString();
  return d3.hsl(hsl.h, hsl.s * 0.65, Math.min(hsl.l + 0.18, 0.82)).toString();
}

interface DeduplicatedEvent extends EventIndex {
  mergedIds?: string[]; // populated when multiple events were merged into this bar
}

/**
 * Merge events that share the same title, region, start_date, and end_date.
 * The merged event keeps the first event's ID, joins all short_descriptions,
 * and records all source IDs in mergedIds so they can be listed on click.
 */
function deduplicateEvents(events: EventIndex[]): DeduplicatedEvent[] {
  const groups = new Map<string, EventIndex[]>();

  for (const ev of events) {
    const key = `${ev.title}||${ev.region}||${ev.start_date ?? ""}||${ev.end_date ?? ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(ev);
  }

  return [...groups.values()].map(group => {
    if (group.length === 1) return group[0];
    const descriptions = group.map(e => e.short_description).filter(Boolean);
    return {
      ...group[0],
      short_description: descriptions.join("\n"),
      mergedIds: group.map(e => String(e.id)),
    };
  });
}

/**
 * Pack events into non-overlapping horizontal lanes (greedy interval scheduling).
 * Returns a map of event id → lane index (0-based).
 */
function assignLanes(events: EventIndex[]): Map<string, number> {
  const sorted = [...events]
    .filter(e => e.start_date)
    .sort((a, b) => parseDate(a.start_date!).getTime() - parseDate(b.start_date!).getTime());

  const laneEnds: number[] = []; // end time of last event in each lane
  const result = new Map<string, number>();

  for (const ev of sorted) {
    const start = parseDate(ev.start_date!).getTime();
    const end   = ev.end_date
      ? parseDate(ev.end_date).getTime()
      : start + 14 * 24 * 60 * 60 * 1000;

    // Find first lane where the previous event has already ended
    let lane = laneEnds.findIndex(t => t <= start);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(0); }
    result.set(ev.id, lane);
    laneEnds[lane] = end;
  }

  return result;
}

interface TooltipState { x: number; y: number; event: EventIndex }

interface Props {
  events: EventIndex[];
  activeRegions: Set<Region>;
  activeTypes: Set<EventType>;
  onEventClick: (id: string) => void;
  onGroupClick: (ids: string[]) => void;
  windowStart: Date;
  windowEnd: Date;
  onWidthChange?: (width: number) => void;
}

export function Timeline({ events, activeRegions, activeTypes, onEventClick, onGroupClick, windowStart, windowEnd, onWidthChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef       = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [dims, setDims] = useState({ width: 800, height: 500 });

  const onClickRef = useRef(onEventClick);
  useEffect(() => { onClickRef.current = onEventClick; }, [onEventClick]);

  const onGroupClickRef = useRef(onGroupClick);
  useEffect(() => { onGroupClickRef.current = onGroupClick; }, [onGroupClick]);

  const onWidthChangeRef = useRef(onWidthChange);
  useEffect(() => { onWidthChangeRef.current = onWidthChange; }, [onWidthChange]);

  // Track previous filter/data state to detect window-only changes (panning),
  // which should not trigger the enter animation.
  const prevFilterKey = useRef<string>("");

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      const h = entry.contentRect.height;
      setDims({ width: w, height: h });
      onWidthChangeRef.current?.(w);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const windowYears = yearsBetween(windowStart, windowEnd);
  const isDetail    = windowYears < 0.5;

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const filterKey = `${[...activeRegions].sort().join(",")}|${[...activeTypes].sort().join(",")}|${events.length}`;
    const shouldAnimate = filterKey !== prevFilterKey.current;
    prevFilterKey.current = filterKey;

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    const { width, height } = dims;
    const innerW = width  - MARGIN.left - MARGIN.right;
    const innerH = height - MARGIN.top  - MARGIN.bottom;
    if (innerW <= 0 || innerH <= 0) return;

    const xScale = d3.scaleTime()
      .domain([windowStart, windowEnd])
      .range([MARGIN.left, MARGIN.left + innerW]);

    // ── Deduplicate then group by region ─────────────────────────────────────
    const visibleRegions = ALL_REGIONS.filter(r => activeRegions.has(r));
    const dedupedEvents = deduplicateEvents(events);
    const byRegion = new Map<Region, DeduplicatedEvent[]>();
    visibleRegions.forEach(r => byRegion.set(r, []));
    dedupedEvents.forEach(e => { byRegion.get(e.region as Region)?.push(e); });

    // ── Calculate lane counts per region ─────────────────────────────────────
    // (needed before drawing so we can size rows proportionally)
    const lanesPerRegion = new Map<Region, Map<string, number>>();
    const laneCountPerRegion = new Map<Region, number>();

    visibleRegions.forEach(region => {
      const rowEvents = byRegion.get(region) ?? [];
      const lanes = assignLanes(rowEvents);
      lanesPerRegion.set(region, lanes);
      const maxLane = lanes.size > 0 ? Math.max(0, ...lanes.values()) : 0;
      laneCountPerRegion.set(region, Math.max(maxLane + 1, 1));
    });

    // Each region row gets height proportional to its lane count so bars
    // fill the available space equally regardless of how many lanes there are.
    const totalLanes = visibleRegions.reduce((sum, r) => sum + (laneCountPerRegion.get(r) ?? 1), 0);
    let cursor = MARGIN.top;
    const rowMeta = visibleRegions.map(region => {
      const laneCount = laneCountPerRegion.get(region) ?? 1;
      const rowH  = (laneCount / totalLanes) * innerH;
      const laneH = rowH / laneCount;
      const barH  = Math.max(laneH - LANE_GAP, 3);
      const y = cursor;
      cursor += rowH;
      return { region, rowH, laneH, barH, y, laneCount };
    });

    // ── Defs: stripe patterns (one per region colour) ─────────────────────────
    const defs = svg.append("defs");
    ALL_REGIONS.forEach(r => {
      const col = REGION_COLOR[r];
      const pid = `stripe-${r}`;
      const pat = defs.append("pattern")
        .attr("id", pid)
        .attr("patternUnits", "userSpaceOnUse")
        .attr("width", 8).attr("height", 8)
        .attr("patternTransform", "rotate(45)");
      pat.append("rect").attr("width", 8).attr("height", 8).attr("fill", "white").attr("fill-opacity", 0.55);
      pat.append("line")
        .attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 8)
        .attr("stroke", col).attr("stroke-width", 3).attr("stroke-opacity", 0.6);
    });

    // ── X axis ────────────────────────────────────────────────────────────────
    svg.append("g")
      .attr("transform", `translate(0, ${MARGIN.top})`)
      .call(
        d3.axisTop(xScale)
          .ticks(isDetail ? 8 : 6)
          .tickSizeInner(-innerH)
          .tickSizeOuter(0),
      )
      .call(ax => ax.select(".domain").remove())
      .call(ax => ax.selectAll(".tick line")
        .attr("stroke", "#E5E7EB")
        .attr("stroke-dasharray", "2,4"))
      .call(ax => ax.selectAll(".tick text")
        .attr("fill", "#9CA3AF")
        .attr("font-size", "11px")
        .attr("y", -16));

    // ── Rows + bars ───────────────────────────────────────────────────────────
    rowMeta.forEach(({ region, rowH, laneH, barH, y }, ri) => {
      const rowEvents = byRegion.get(region) ?? [];
      const lanes     = lanesPerRegion.get(region) ?? new Map();

      // Row background
      svg.append("rect")
        .attr("x", MARGIN.left).attr("y", y)
        .attr("width", innerW).attr("height", rowH)
        .attr("fill", ri % 2 === 0 ? "#F9FAFB" : "#FFFFFF");

      // Region label — centred vertically in row
      svg.append("text")
        .attr("x", MARGIN.left - 8).attr("y", y + rowH / 2)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .attr("fill", REGION_COLOR[region])
        .attr("font-size", "12px")
        .attr("font-weight", "700")
        .text(region);

      rowEvents.forEach(ev => {
          if (!ev.start_date) return;

          const startD = parseDate(ev.start_date);
          if (startD.getTime() === 0) return;

          const endD = ev.end_date
            ? parseDate(ev.end_date)
            : new Date(startD.getTime() + 14 * 24 * 60 * 60 * 1000);

          const x1 = xScale(startD);
          const x2 = xScale(endD);
          const w  = Math.max(x2 - x1, 3);

          if (x2 < MARGIN.left || x1 > MARGIN.left + innerW) return;

          const lane  = lanes.get(ev.id) ?? 0;
          const barY  = y + rowH - (lane + 1) * laneH + LANE_GAP / 2;
          const rx    = barH / 2;
          const barColor = eventColor(region, ev.type);
          const outlineColor = REGION_COLOR[region];

          // Unique clip path per bar
          const clipId = `clip-${ev.id.replace(/\W/g, "_")}`;
          defs.append("clipPath").attr("id", clipId)
            .append("rect")
              .attr("x", x1).attr("y", barY)
              .attr("width", w).attr("height", barH)
              .attr("rx", rx);

          const g = svg.append("g")
            .attr("clip-path", `url(#${clipId})`)
            .attr("opacity", shouldAnimate ? 0 : 1);

          if (shouldAnimate) {
            g.transition().duration(300).ease(d3.easeCubicOut).attr("opacity", 1);
          }

          // White base (so stripe pattern has a clean background)
          g.append("rect")
            .attr("x", x1).attr("y", barY)
            .attr("width", w).attr("height", barH)
            .attr("fill", "white");

          // Solid fill for the whole bar (the main-period colour)
          g.append("rect")
            .attr("x", x1).attr("y", barY)
            .attr("width", w).attr("height", barH)
            .attr("fill", barColor).attr("fill-opacity", 0.85);

          // Striped lead segment: start_date → enforcement_date
          if (ev.enforcement_date) {
            const enfD = parseDate(ev.enforcement_date);
            if (enfD.getTime() > startD.getTime()) {
              const xe = xScale(enfD);
              const leadW = xe - x1;
              if (leadW > 0) {
                // Overlay stripe pattern on the lead segment only
                g.append("rect")
                  .attr("x", x1).attr("y", barY)
                  .attr("width", leadW).attr("height", barH)
                  .attr("fill", `url(#stripe-${region})`);
              }
            }
          }

          // Pill outline
          const outline = svg.append("rect")
            .attr("x", x1).attr("y", barY)
            .attr("width", w).attr("height", barH)
            .attr("rx", rx)
            .attr("fill", "none")
            .attr("stroke", outlineColor)
            .attr("stroke-width", 1)
            .attr("stroke-opacity", 0.5)
            .attr("pointer-events", "none");

          // Transparent hit rect (full pill area, receives all mouse events)
          svg.append("rect")
            .attr("x", x1).attr("y", barY)
            .attr("width", w).attr("height", barH)
            .attr("rx", rx)
            .attr("fill", "transparent")
            .attr("cursor", "pointer")
            .on("mouseenter", (e: MouseEvent) => {
              g.attr("opacity", 1);
              outline.attr("stroke-width", 2).attr("stroke-opacity", 1);
              const r = svgEl.getBoundingClientRect();
              setTooltip({ x: e.clientX - r.left, y: e.clientY - r.top, event: ev });
            })
            .on("mousemove", (e: MouseEvent) => {
              const r = svgEl.getBoundingClientRect();
              setTooltip(t => t ? { ...t, x: e.clientX - r.left, y: e.clientY - r.top } : null);
            })
            .on("mouseleave", () => {
              g.attr("opacity", 1);
              outline.attr("stroke-width", 1).attr("stroke-opacity", 0.5);
              setTooltip(null);
            })
            .on("click", () => {
              if (ev.mergedIds && ev.mergedIds.length > 1) {
                onGroupClickRef.current(ev.mergedIds);
              } else {
                onClickRef.current(ev.id);
              }
            });

          // Count badge for merged bars
          if (ev.mergedIds && ev.mergedIds.length > 1 && w > 20) {
            const badgeW = 16;
            const badgeH = 11;
            const badgeX = Math.min(x1 + w - badgeW - 3, MARGIN.left + innerW - badgeW - 3);
            const badgeY = barY + 3;
            svg.append("rect")
              .attr("x", badgeX).attr("y", badgeY)
              .attr("width", badgeW).attr("height", badgeH)
              .attr("rx", 3)
              .attr("fill", "#1F2937")
              .attr("pointer-events", "none");
            svg.append("text")
              .attr("x", badgeX + badgeW / 2).attr("y", badgeY + badgeH / 2)
              .attr("text-anchor", "middle")
              .attr("dominant-baseline", "middle")
              .attr("fill", "#fff")
              .attr("font-size", "8px")
              .attr("font-weight", "700")
              .attr("pointer-events", "none")
              .text(`×${ev.mergedIds.length}`);
          }

          // Label when bar is tall and wide enough to hold text
          const visibleX1 = Math.max(x1, MARGIN.left);
          const visibleX2 = Math.min(x2, MARGIN.left + innerW);
          const visibleW  = visibleX2 - visibleX1;
          const fontSize  = Math.min(Math.floor(barH * 0.6), 12);
          if (barH >= 14 && visibleW > 50) {
            const txt = svg.append("text")
              .attr("x", visibleX1 + rx + 4)
              .attr("y", barY + barH / 2)
              .attr("dominant-baseline", "middle")
              .attr("fill", "#fff")
              .attr("font-size", `${fontSize}px`)
              .attr("pointer-events", "none")
              .text(ev.title);

            const node = txt.node();
            if (node) {
              let label = ev.title;
              while (node.getComputedTextLength() > visibleW - rx * 2 - 8 && label.length > 3) {
                label = label.slice(0, -1);
                txt.text(label + "…");
              }
              if (label.length <= 3) txt.remove();
            }
          }
      });

      // Thin separator line between rows
      if (ri < visibleRegions.length - 1) {
        svg.append("line")
          .attr("x1", MARGIN.left).attr("x2", MARGIN.left + innerW)
          .attr("y1", y + rowH).attr("y2", y + rowH)
          .attr("stroke", "#E5E7EB")
          .attr("stroke-width", 1);
      }
    });
  }, [events, activeRegions, activeTypes, windowStart, windowEnd, dims, isDetail]);

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden relative bg-white">
      <svg ref={svgRef} style={{ width: dims.width, height: dims.height }} />

      {tooltip && (
        <div
          className="absolute z-10 pointer-events-none bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs max-w-xs"
          style={{
            left: tooltip.x + 14,
            top:  tooltip.y - 8,
            transform: tooltip.x > dims.width * 0.65 ? "translateX(-110%)" : undefined,
          }}
        >
          <p className="font-semibold text-gray-800 mb-1">{tooltip.event.title}</p>
          <p className="text-gray-500">{tooltip.event.region} · {tooltip.event.type}</p>
          <p className="text-gray-500">
            {tooltip.event.start_date}
            {tooltip.event.end_date ? ` — ${tooltip.event.end_date}` : " (ongoing)"}
          </p>
          {tooltip.event.short_description && (
            <ul className="mt-1 space-y-0.5 list-none">
              {tooltip.event.short_description.split("\n").map((line, i) => (
                <li key={i} className="text-gray-600 leading-snug">· {line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
