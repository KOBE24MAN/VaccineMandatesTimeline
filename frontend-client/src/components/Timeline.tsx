import { useRef, useEffect, useLayoutEffect, useState, useMemo } from "react";
import * as d3 from "d3";
import type { EventIndex, Region, NotableEvent } from "../types/event";
import { ALL_REGIONS } from "../types/event";
import { parseDate, yearsBetween } from "../utils/dates";
import { visualStartDate, visualEndDate, hasOngoingSegment, timelineGroupKey } from "../utils/timeline";

const MARGIN = { top: 70, right: 16, bottom: 8, left: 56 };
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
    const key = timelineGroupKey(ev);
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
    .sort((a, b) => parseDate(visualStartDate(a)).getTime() - parseDate(visualStartDate(b)).getTime());

  const laneEnds: number[] = []; // end time of last event in each lane
  const result = new Map<string, number>();

  for (const ev of sorted) {
    const start = parseDate(visualStartDate(ev)).getTime();
    const end   = hasOngoingSegment(ev)
      ? Number.MAX_SAFE_INTEGER
      : visualEndDate(ev)
        ? parseDate(visualEndDate(ev)!).getTime()
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

function TooltipPeriods({ event }: { event: EventIndex }) {
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
    ...(event.booster ? [{
      label: "Booster enforcement → booster removal",
      dates: `${event.booster.start_date} → ${event.booster.ongoing ? "Ongoing" : event.booster.end_date ?? "End date not recorded"}`,
      meaning: "Booster requirement · dark striped overlay",
      kind: "booster",
    }] : []),
  ];
  const color = REGION_COLOR[event.region];
  return <div className="mt-2 space-y-2 border-t border-gray-200 pt-2">
    {periods.map(period => <div key={period.kind} className="flex gap-2 leading-snug">
      <span className="mt-1 h-2.5 w-3.5 flex-shrink-0 rounded-sm" style={{
        background: period.kind === "announcement" ? `${color}20`
          : period.kind === "pending" ? `repeating-linear-gradient(45deg, white 0 3px, ${color} 3px 5px)`
          : period.kind === "booster" ? `repeating-linear-gradient(-45deg, ${d3.color(color)!.darker(1.25)} 0 3px, white 3px 4px)`
          : eventColor(event.region, event.type),
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

interface Props {
  events: EventIndex[];
  activeRegions: Set<Region>;
  onEventClick: (id: string) => void;
  onEventDoubleClick?: (id: string) => void;
  onGroupClick: (ids: string[]) => void;
  windowStart: Date;
  windowEnd: Date;
  onWidthChange?: (width: number) => void;
  showOngoingTail?: boolean;
  notableEvents?: NotableEvent[];
  showNotableLabels?: boolean;
  tooltipTransparent?: boolean;
  selectedEventId?: string | null;
  unstackBars?: boolean;
}

export function Timeline({ events, activeRegions, onEventClick, onEventDoubleClick, onGroupClick, windowStart, windowEnd, onWidthChange, showOngoingTail = true, notableEvents = [], showNotableLabels = true, tooltipTransparent = false, selectedEventId = null, unstackBars = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef       = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [dims, setDims] = useState({ width: 800, height: 500 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!tooltip || !tooltipRef.current) return;
    const el = tooltipRef.current;
    const left = tooltip.x + 14 + el.offsetWidth <= dims.width - 8
      ? tooltip.x + 14 : tooltip.x - el.offsetWidth - 14;
    el.style.left = `${Math.max(8, Math.min(left, dims.width - el.offsetWidth - 8))}px`;
    el.style.top = `${Math.max(8, Math.min(tooltip.y - 8, dims.height - el.offsetHeight - 8))}px`;
  }, [tooltip, dims]);

  const onClickRef = useRef(onEventClick);
  useEffect(() => { onClickRef.current = onEventClick; }, [onEventClick]);

  const onDblClickRef = useRef(onEventDoubleClick);
  useEffect(() => { onDblClickRef.current = onEventDoubleClick; }, [onEventDoubleClick]);

  const onGroupClickRef = useRef(onGroupClick);
  useEffect(() => { onGroupClickRef.current = onGroupClick; }, [onGroupClick]);

  const onWidthChangeRef = useRef(onWidthChange);
  useEffect(() => { onWidthChangeRef.current = onWidthChange; }, [onWidthChange]);

  // Track previous filter/data state to detect window-only changes (panning),
  // which should not trigger the enter animation.
  const prevEventIdsRef = useRef<Set<string>>(new Set());
  const prevBarDimsRef = useRef<Map<string, { barY: number; barH: number }>>(new Map());

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

  // Memoize the layout computation so it only reruns when events/regions change,
  // not on every window pan/zoom.
  const layout = useMemo(() => {
    const visibleRegions = ALL_REGIONS.filter(r => activeRegions.has(r));
    const dedupedEvents = unstackBars ? events : deduplicateEvents(events);
    const byRegion = new Map<Region, DeduplicatedEvent[]>();
    visibleRegions.forEach(r => byRegion.set(r, []));
    dedupedEvents.forEach(e => { byRegion.get(e.region as Region)?.push(e); });

    const lanesPerRegion = new Map<Region, Map<string, number>>();
    const laneCountPerRegion = new Map<Region, number>();
    visibleRegions.forEach(region => {
      const rowEvents = byRegion.get(region) ?? [];
      const lanes = assignLanes(rowEvents);
      lanesPerRegion.set(region, lanes);
      const maxLane = lanes.size > 0 ? Math.max(0, ...lanes.values()) : 0;
      laneCountPerRegion.set(region, Math.max(maxLane + 1, 1));
    });

    return { visibleRegions, dedupedEvents, byRegion, lanesPerRegion, laneCountPerRegion };
  }, [events, activeRegions, unstackBars]);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const oldBarDims = new Map(prevBarDimsRef.current);
    prevBarDimsRef.current = new Map();

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    const { width, height } = dims;
    const innerW = width  - MARGIN.left - MARGIN.right;
    const innerH = height - MARGIN.top  - MARGIN.bottom;
    if (innerW <= 0 || innerH <= 0) return;

    const xScale = d3.scaleTime()
      .domain([windowStart, windowEnd])
      .range([MARGIN.left, MARGIN.left + innerW]);

    const { visibleRegions, byRegion, lanesPerRegion, laneCountPerRegion } = layout;

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

    // Track which event IDs are visible this render (for grow-in animation)
    const currentEventIds = new Set(layout.dedupedEvents.map(e => e.id));

    // ── Defs: stripe patterns (one per region colour) ─────────────────────────
    const defs = svg.append("defs");
    defs.append("clipPath").attr("id", "timeline-viewport").append("rect")
      .attr("x", MARGIN.left).attr("y", MARGIN.top)
      .attr("width", innerW).attr("height", innerH);

    // Glow filter for selected bars
    const glowFilter = defs.append("filter").attr("id", "bar-glow").attr("x", "-40%").attr("y", "-40%").attr("width", "180%").attr("height", "180%");
    glowFilter.append("feDropShadow").attr("dx", 0).attr("dy", 0).attr("stdDeviation", 6).attr("flood-color", "currentColor").attr("flood-opacity", 1);

    // Subtle drop shadow for label text
    const textShadowFilter = defs.append("filter").attr("id", "text-shadow").attr("x", "-5%").attr("y", "-5%").attr("width", "110%").attr("height", "110%");
    textShadowFilter.append("feDropShadow").attr("dx", 0).attr("dy", 1).attr("stdDeviation", 1.5).attr("flood-color", "#000").attr("flood-opacity", 0.35);
    ALL_REGIONS.forEach(r => {
      const col = REGION_COLOR[r];
      const pid = `stripe-${r}`;
      const pat = defs.append("pattern")
        .attr("id", pid)
        .attr("patternUnits", "userSpaceOnUse")
        .attr("width", 8).attr("height", 8)
        .attr("patternTransform", "rotate(45)");
      pat.append("rect").attr("width", 8).attr("height", 8).attr("fill", "white").attr("fill-opacity", 0.92);
      pat.append("line")
        .attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 8)
        .attr("stroke", col).attr("stroke-width", 3).attr("stroke-opacity", 0.7);

      const boosterPid = `booster-${r}`;
      const boosterPat = defs.append("pattern")
        .attr("id", boosterPid)
        .attr("patternUnits", "userSpaceOnUse")
        .attr("width", 6).attr("height", 6)
        .attr("patternTransform", "rotate(-45)");
      boosterPat.append("rect").attr("width", 6).attr("height", 6).attr("fill", d3.color(col)!.darker(1.25).toString());
      boosterPat.append("line")
        .attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 6)
        .attr("stroke", "white").attr("stroke-width", 1.5).attr("stroke-opacity", 0.7);
    });

    // ── Ongoing tail gradient (fade to white at right viewport edge) ──────────
    const tailGradId = "ongoing-tail";
    const tailGrad = defs.append("linearGradient")
      .attr("id", tailGradId)
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", MARGIN.left + innerW - 64)
      .attr("y1", 0)
      .attr("x2", MARGIN.left + innerW)
      .attr("y2", 0);
    tailGrad.append("stop").attr("offset", "0%").attr("stop-color", "white").attr("stop-opacity", 0);
    tailGrad.append("stop").attr("offset", "100%").attr("stop-color", "white").attr("stop-opacity", 0.82);

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

    const dur  = 380;
    const ease = d3.easeCubicOut;

    // Badges are collected here and rendered after all bars so they always sit on top
    type BadgeData = { x: number; newY: number; oldY: number; count: number; isNew: boolean; isResizing: boolean };
    const pendingBadges: BadgeData[] = [];

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

      const barLayer = svg.append("g").attr("clip-path", "url(#timeline-viewport)");
      rowEvents.forEach(ev => {
          if (!ev.start_date) return;

          const startD = parseDate(ev.start_date);
          if (startD.getTime() === 0) return;

          const endD = ev.end_date
            ? parseDate(ev.end_date)
            : new Date(startD.getTime() + 14 * 24 * 60 * 60 * 1000);

          const x1 = xScale(startD);
          // Ongoing mandates extend to the right edge of the viewport
          const x2raw = xScale(endD);
          const x2 = ev.ongoing ? MARGIN.left + innerW : x2raw;
          const w  = Math.max(x2 - x1, 3);
          const visualStartD = parseDate(visualStartDate(ev));
          const visualX1 = Math.min(xScale(visualStartD), x1);
          const boosterEndD = ev.booster?.end_date ? parseDate(ev.booster.end_date) : null;
          const visualX2raw = hasOngoingSegment(ev) ? MARGIN.left + innerW : boosterEndD && boosterEndD.getTime() > endD.getTime()
            ? xScale(boosterEndD)
            : x2raw;

          if ((ev.ongoing ? MARGIN.left + innerW : visualX2raw) < MARGIN.left || visualX1 > MARGIN.left + innerW) return;

          const lane  = lanes.get(ev.id) ?? 0;
          const barY  = y + rowH - (lane + 1) * laneH + LANE_GAP / 2;
          const rx    = barH / 2;
          const barColor = eventColor(region, ev.type);
          const outlineColor = REGION_COLOR[region];
          const isSelected = selectedEventId !== null && (
            ev.id === selectedEventId ||
            (ev.mergedIds?.includes(selectedEventId) ?? false)
          );

          const isNew = prevEventIdsRef.current.size > 0
            && !prevEventIdsRef.current.has(ev.id);

          const prevDims = oldBarDims.get(ev.id);
          const isResizing = !isNew && !!prevDims
            && (prevDims.barY !== barY || prevDims.barH !== barH);

          const midY = barY + barH / 2;

          prevBarDimsRef.current.set(ev.id, { barY, barH });

          if (ev.announcement_date && visualStartD.getTime() < startD.getTime()) {
            const announcementW = Math.max(x1 - visualX1, 2);
            const announcementY = barY + Math.max(barH * 0.24, 1);
            const announcementH = Math.max(barH * 0.52, 2);
            barLayer.append("rect")
              .attr("x", visualX1).attr("y", announcementY)
              .attr("width", announcementW).attr("height", announcementH)
              .attr("rx", announcementH / 2)
              .attr("fill", REGION_COLOR[region])
              .attr("fill-opacity", 0.12)
              .attr("stroke", REGION_COLOR[region])
              .attr("stroke-width", 1)
              .attr("stroke-opacity", 0.85)
              .attr("stroke-dasharray", "3,3")
              .attr("pointer-events", "none");
          }

          // ── Clip path ──────────────────────────────────────────────────────
          // Controls the visible pill area; animates for grow (new) and resize.
          // For ongoing bars extend the clip past the right edge so the rounded
          // corner is outside the viewport → flat right end appearance.
          const clipId = `clip-${ev.id.replace(/\W/g, "_")}`;
          const clipRect = defs.append("clipPath").attr("id", clipId)
            .append("rect").attr("x", x1).attr("width", ev.ongoing ? w + rx : w).attr("rx", rx);

          if (isNew) {
            clipRect.attr("y", midY).attr("height", 0)
              .transition().duration(dur).ease(ease)
              .attr("y", barY).attr("height", barH);
          } else if (isResizing && prevDims) {
            clipRect.attr("y", prevDims.barY).attr("height", prevDims.barH)
              .transition().duration(dur).ease(ease)
              .attr("y", barY).attr("height", barH);
          } else {
            clipRect.attr("y", barY).attr("height", barH);
          }

          // ── Fill group ─────────────────────────────────────────────────────
          const g = barLayer.append("g")
            .attr("clip-path", `url(#${clipId})`)
            .attr("opacity", isNew ? 0 : 1);

          if (isNew) g.transition().duration(dur).ease(ease).attr("opacity", 1);

          // Draw all fill rects at NEW dimensions
          g.append("rect")
            .attr("x", x1).attr("y", barY)
            .attr("width", w).attr("height", barH)
            .attr("fill", "white");

          g.append("rect")
            .attr("x", x1).attr("y", barY)
            .attr("width", w).attr("height", barH)
            .attr("fill", barColor).attr("fill-opacity", isSelected ? 1 : 0.75);

          if (ev.enforcement_date) {
            const enfD = parseDate(ev.enforcement_date);
            if (enfD.getTime() > startD.getTime()) {
              const xe = xScale(enfD);
              const leadW = xe - x1;
              if (leadW > 0) {
                g.append("rect")
                  .attr("x", x1).attr("y", barY)
                  .attr("width", leadW).attr("height", barH)
                  .attr("fill", `url(#stripe-${region})`);
              }
            }
          }

          if (ev.booster) {
            const boosterStartD = parseDate(ev.booster.start_date);
            const boosterEndD = ev.booster.ongoing ? windowEnd : parseDate(ev.booster.end_date!);
            if (boosterEndD.getTime() > boosterStartD.getTime()) {
              const xb1 = xScale(boosterStartD);
              const xb2 = xScale(boosterEndD);
              const boosterX = Math.max(xb1, MARGIN.left);
              const boosterW = Math.max(Math.min(xb2, MARGIN.left + innerW) - boosterX, 0);
              if (boosterW > 0) {
                // The booster can outlast the original mandate; do not clip it to the base pill.
                barLayer.append("rect")
                  .attr("data-booster-id", ev.booster.id)
                  .attr("x", boosterX).attr("y", barY + barH * 0.2)
                  .attr("width", boosterW).attr("height", barH * 0.6)
                  .attr("rx", Math.min(barH * 0.3, 3))
                  .attr("fill", `url(#booster-${region})`)
                  .attr("stroke", "white").attr("stroke-width", 0.8)
                  .attr("fill-opacity", isSelected ? 1 : 0.92);
              }
            }
          }

          // ── Ongoing tail fade overlay ───────────────────────────────────────
          if (hasOngoingSegment(ev) && showOngoingTail) {
            const tailStart = ev.ongoing ? x1 : xScale(parseDate(ev.booster!.start_date));
            const tailX = Math.max(tailStart, MARGIN.left + innerW - 64);
            barLayer.append("rect")
              .attr("data-ongoing-tail", ev.id)
              .attr("x", tailX).attr("y", ev.ongoing ? barY : barY + barH * 0.2)
              .attr("width", Math.max(MARGIN.left + innerW - tailX, 0)).attr("height", ev.ongoing ? barH : barH * 0.6)
              .attr("fill", `url(#${tailGradId})`).attr("pointer-events", "none");
          }

          // Slide all fill rects from old position to new so they move with the clip
          if (isResizing && prevDims) {
            g.selectAll("rect")
              .attr("y", prevDims.barY)
              .attr("height", prevDims.barH)
              .transition().duration(dur).ease(ease)
              .attr("y", barY)
              .attr("height", barH);
          }

          // ── Outline ────────────────────────────────────────────────────────
          // Ongoing bars extend past the viewport so the right rounded corner is
          // not visible → flat right end. Extend outline width similarly.
          const outline = barLayer.append("rect")
            .attr("x", x1).attr("width", ev.ongoing ? w + rx : w).attr("rx", rx)
            .attr("fill", "none")
            .attr("stroke", outlineColor)
            .attr("stroke-width", isSelected ? 5 : ev.date_uncertain ? 1.5 : 1)
            .attr("stroke-opacity", isSelected ? 1 : 0.5)
            .attr("stroke-dasharray", ev.date_uncertain && !isSelected ? "4,3" : null)
            .attr("pointer-events", "none")
            .attr("color", outlineColor)
            .attr("filter", isSelected ? "url(#bar-glow)" : null);

          if (isNew) {
            outline.attr("y", midY).attr("height", 0)
              .transition().duration(dur).ease(ease)
              .attr("y", barY).attr("height", barH);
          } else if (isResizing && prevDims) {
            outline.attr("y", prevDims.barY).attr("height", prevDims.barH)
              .transition().duration(dur).ease(ease)
              .attr("y", barY).attr("height", barH);
          } else {
            outline.attr("y", barY).attr("height", barH);
          }

          // ── Ongoing chevron marker ─────────────────────────────────────────
          if (hasOngoingSegment(ev) && showOngoingTail) {
            const cx  = MARGIN.left + innerW - 5;
            const cy  = barY + barH / 2;
            const ch  = Math.min(barH * 0.38, 7);
            const cw  = Math.min(4, Math.max(2, barH * 0.28));
            barLayer.append("path")
              .attr("d", `M${cx - cw},${cy - ch} L${cx},${cy} L${cx - cw},${cy + ch}`)
              .attr("fill", "none")
              .attr("stroke", outlineColor)
              .attr("stroke-width", 1.5)
              .attr("stroke-linecap", "round")
              .attr("stroke-linejoin", "round")
              .attr("opacity", 0.75)
              .attr("pointer-events", "none");
          }

          // Date boundaries: hollow circle = announced/effective, filled = enforced,
          // diamond = booster, double circle = removed. Same-day dates share one marker.
          const milestones = [
            { label: "Announced", date: ev.announcement_date, kind: "open" },
            { label: "Effective / start", date: ev.start_date, kind: "open" },
            { label: "Enforcement", date: ev.enforcement_date, kind: "filled" },
            { label: "Removal", date: ev.ongoing ? null : ev.end_date, kind: "end" },
            { label: "Booster starts", date: ev.booster?.start_date, kind: "diamond" },
            { label: "Booster ends", date: ev.booster?.ongoing ? null : ev.booster?.end_date, kind: "end" },
          ];
          const byDate = new Map<string, typeof milestones>();
          milestones.forEach(point => {
            if (point.date) byDate.set(point.date, [...(byDate.get(point.date) ?? []), point]);
          });
          byDate.forEach((points, date) => {
            const px = xScale(parseDate(date));
            if (px < MARGIN.left || px > MARGIN.left + innerW) return;
            const radius = Math.min(4, Math.max(1.5, barH * 0.23));
            const point = points.find(p => p.kind === "diamond") ?? points[points.length - 1];
            const marker = barLayer.append("g").attr("data-milestone", date)
              .attr("transform", `translate(${px},${midY})`).attr("pointer-events", "none");
            marker.append("title").text(`${points.map(p => p.label).join(" / ")}: ${date}`);
            if (point.kind === "diamond") {
              marker.append("path").attr("d", `M0,${-radius - 1} L${radius + 1},0 L0,${radius + 1} L${-radius - 1},0 Z`)
                .attr("fill", d3.color(outlineColor)!.darker(1.5).toString())
                .attr("stroke", "white").attr("stroke-width", 1.2);
            } else {
              marker.append("circle").attr("r", radius).attr("fill", point.kind === "filled" ? outlineColor : "white")
                .attr("stroke", point.kind === "filled" ? "white" : outlineColor).attr("stroke-width", 1.2);
              if (point.kind === "end") marker.append("circle").attr("r", radius * 0.4).attr("fill", outlineColor);
            }
          });

          // ── Hit rect ───────────────────────────────────────────────────────
          barLayer.append("rect")
            .attr("data-event-id", ev.id)
            .attr("x", visualX1).attr("y", barY)
            .attr("width", Math.max((ev.ongoing ? MARGIN.left + innerW : visualX2raw) - visualX1, 3)).attr("height", barH)
            .attr("rx", rx).attr("fill", "transparent").attr("cursor", "pointer")
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
            })
            .on("dblclick", (e: MouseEvent) => {
              e.stopPropagation();
              if (onDblClickRef.current) {
                const id = ev.mergedIds ? ev.mergedIds[0] : ev.id;
                onDblClickRef.current(id);
              }
            });

          // ── Badge (deferred — rendered after all bars) ─────────────────────
          if (ev.mergedIds && ev.mergedIds.length > 1 && w > 20) {
            const badgeW  = 16;
            const badgeX  = Math.min(x1 + w - badgeW - 3, MARGIN.left + innerW - badgeW - 3);
            const newBadgeY = barY + 3;
            const oldBadgeY = prevDims ? prevDims.barY + 3 : newBadgeY;
            pendingBadges.push({ x: badgeX, newY: newBadgeY, oldY: oldBadgeY, count: ev.mergedIds.length, isNew, isResizing });
          }

          // ── Label ──────────────────────────────────────────────────────────
          const visibleX1 = Math.max(x1, MARGIN.left);
          const visibleX2 = Math.min(x2, MARGIN.left + innerW);
          const visibleW  = visibleX2 - visibleX1;
          const fontSize  = Math.min(Math.max(Math.round(barH * 0.45), 10), 22);
          if (barH >= 14 && visibleW > 50) {
            const newLabelY = barY + barH / 2;
            const oldLabelY = prevDims ? prevDims.barY + prevDims.barH / 2 : newLabelY;

            const txt = barLayer.append("text")
              .attr("x", visibleX1 + rx + 4)
              .attr("dominant-baseline", "middle")
              .attr("fill", "#fff").attr("font-size", `${fontSize}px`)
              .attr("filter", "url(#text-shadow)")
              .attr("pointer-events", "none")
              .text(ev.title);

            const node = txt.node();
            if (node) {
              let label = ev.title;
              while (node.getComputedTextLength() > visibleW - rx * 2 - 8 && label.length > 3) {
                label = label.slice(0, -1);
                txt.text(label + "…");
              }
              if (label.length <= 3) {
                txt.remove();
              } else if (isNew) {
                txt.attr("y", newLabelY).attr("opacity", 0)
                  .transition().duration(dur).attr("opacity", 1);
              } else if (isResizing) {
                txt.attr("y", oldLabelY)
                  .transition().duration(dur).ease(ease).attr("y", newLabelY);
              } else {
                txt.attr("y", newLabelY);
              }
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

    // ── Badges (rendered on top of all bars) ─────────────────────────────────
    const badgeW = 16;
    const badgeH = 11;
    pendingBadges.forEach(({ x, newY, oldY, count, isNew, isResizing }) => {
      const badgeRect = svg.append("rect")
        .attr("x", x).attr("width", badgeW).attr("height", badgeH)
        .attr("rx", 3).attr("fill", "#1F2937").attr("pointer-events", "none");
      const badgeTxt = svg.append("text")
        .attr("x", x + badgeW / 2)
        .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
        .attr("fill", "#fff").attr("font-size", "8px").attr("font-weight", "700")
        .attr("pointer-events", "none").text(`×${count}`);

      if (isNew) {
        badgeRect.attr("y", newY).attr("opacity", 0)
          .transition().duration(dur).attr("opacity", 1);
        badgeTxt.attr("y", newY + badgeH / 2).attr("opacity", 0)
          .transition().duration(dur).attr("opacity", 1);
      } else if (isResizing) {
        badgeRect.attr("y", oldY)
          .transition().duration(dur).ease(ease).attr("y", newY);
        badgeTxt.attr("y", oldY + badgeH / 2)
          .transition().duration(dur).ease(ease).attr("y", newY + badgeH / 2);
      } else {
        badgeRect.attr("y", newY);
        badgeTxt.attr("y", newY + badgeH / 2);
      }
    });

    // ── Notable event lines ───────────────────────────────────────────────────
    // Filter to events visible in the current viewport
    const visibleNotable = notableEvents
      .map(ev => ({ ev, lineX: xScale(parseDate(ev.display_date)) }))
      .filter(({ lineX }) => lineX >= MARGIN.left && lineX <= MARGIN.left + innerW);

    // Draw vertical lines
    visibleNotable.forEach(({ lineX }) => {
      svg.append("line")
        .attr("x1", lineX).attr("x2", lineX)
        .attr("y1", MARGIN.top).attr("y2", MARGIN.top + innerH)
        .attr("stroke", "#EF4444")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "4,3")
        .attr("pointer-events", "none");
    });

    // Draw non-overlapping labels
    if (showNotableLabels && visibleNotable.length > 0) {
      const fontSize = 11;
      const padX = 5, padY = 3;
      const tagH = fontSize + padY * 2;
      const tagY = MARGIN.top + 4;
      const GAP = 4;

      // Build items sorted by line position
      const items = visibleNotable
        .map(({ ev, lineX }) => {
          const label = ev.title + (ev.date_approximate ? " ~" : "");
          const tagW = Math.round(label.length * fontSize * 0.57) + padX * 2;
          const tagX = Math.max(Math.min(lineX + 1, MARGIN.left + innerW - tagW - 2), MARGIN.left);
          return { lineX, label, tagW, tagX, row: 0 };
        })
        .sort((a, b) => a.tagX - b.tagX);

      // Assign rows: place each tag on the first row where it doesn't overlap
      const rowEnds: number[] = []; // rightmost x used so far per row
      items.forEach(item => {
        let row = rowEnds.findIndex(end => end + GAP <= item.tagX);
        if (row === -1) row = rowEnds.length;
        item.row = row;
        rowEnds[row] = item.tagX + item.tagW;
      });

      // Draw each tag on its assigned row
      items.forEach(({ label, tagW, tagX, row }) => {
        const rowY = tagY + row * (tagH + 2);

        svg.append("rect")
          .attr("x", tagX).attr("y", rowY)
          .attr("width", tagW).attr("height", tagH)
          .attr("rx", 3)
          .attr("fill", "#EF4444")
          .attr("pointer-events", "none");

        svg.append("text")
          .attr("x", tagX + padX)
          .attr("y", rowY + padY)
          .attr("dominant-baseline", "hanging")
          .attr("fill", "#fff")
          .attr("font-size", `${fontSize}px`)
          .attr("font-weight", "700")
          .attr("pointer-events", "none")
          .text(label);
      });
    }

    // ── Stripe legend ─────────────────────────────────────────────────────────
    const legendRightX = MARGIN.left + innerW - 8;
    const legendTopY   = 24;
    const swatchH = 10;
    const swatchW = 14;
    const textGap = 4; // gap between swatch and label
    const itemGap = 14; // gap between the two items

    const legendGroup = svg.append("g").attr("pointer-events", "none");
    legendGroup.append("rect")
      .attr("x", MARGIN.left).attr("y", 5).attr("width", 18).attr("height", 7).attr("rx", 3)
      .attr("fill", REGION_COLOR.WA).attr("fill-opacity", 0.12)
      .attr("stroke", REGION_COLOR.WA).attr("stroke-dasharray", "3,3");
    legendGroup.append("text")
      .attr("x", MARGIN.left + 24).attr("y", 12).attr("fill", "#6B7280").attr("font-size", "9px")
      .text("Announced → effective   ○ Start   ● Enforced   ◆ Booster   ⊙ End");

    // Item 2 (rightmost): solid swatch = "Active mandate"
    const item2TextX = legendRightX;
    legendGroup.append("text")
      .attr("x", item2TextX).attr("y", legendTopY + swatchH / 2)
      .attr("text-anchor", "end").attr("dominant-baseline", "middle")
      .attr("fill", "#6B7280").attr("font-size", "9px").text("Active mandate");
    // Measure approx text width (9px * ~0.55 char width)
    const activeTextW = "Active mandate".length * 5.2;
    const item2SwatchX = item2TextX - activeTextW - textGap - swatchW;
    legendGroup.append("rect")
      .attr("x", item2SwatchX).attr("y", legendTopY)
      .attr("width", swatchW).attr("height", swatchH).attr("rx", 3)
      .attr("fill", REGION_COLOR.WA).attr("fill-opacity", 0.8);
    legendGroup.append("rect")
      .attr("x", item2SwatchX).attr("y", legendTopY)
      .attr("width", swatchW).attr("height", swatchH).attr("rx", 3)
      .attr("fill", "none").attr("stroke", "#9CA3AF").attr("stroke-width", 0.5);

    // Item 1 (left of item 2): striped swatch = "Pending enforcement"
    const item1RightX = item2SwatchX - itemGap;
    legendGroup.append("text")
      .attr("x", item1RightX).attr("y", legendTopY + swatchH / 2)
      .attr("text-anchor", "end").attr("dominant-baseline", "middle")
      .attr("fill", "#6B7280").attr("font-size", "9px").text("Pending enforcement");
    const pendingTextW = "Pending enforcement".length * 5.2;
    const item1SwatchX = item1RightX - pendingTextW - textGap - swatchW;
    legendGroup.append("rect")
      .attr("x", item1SwatchX).attr("y", legendTopY)
      .attr("width", swatchW).attr("height", swatchH).attr("rx", 3)
      .attr("fill", "url(#stripe-WA)").attr("opacity", 0.85);
    legendGroup.append("rect")
      .attr("x", item1SwatchX).attr("y", legendTopY)
      .attr("width", swatchW).attr("height", swatchH).attr("rx", 3)
      .attr("fill", "none").attr("stroke", "#9CA3AF").attr("stroke-width", 0.5);

    const item0RightX = item1SwatchX - itemGap;
    legendGroup.append("text")
      .attr("x", item0RightX).attr("y", legendTopY + swatchH / 2)
      .attr("text-anchor", "end").attr("dominant-baseline", "middle")
      .attr("fill", "#6B7280").attr("font-size", "9px").text("Booster overlay");
    const boosterTextW = "Booster overlay".length * 5.2;
    const item0SwatchX = item0RightX - boosterTextW - textGap - swatchW;
    legendGroup.append("rect")
      .attr("x", item0SwatchX).attr("y", legendTopY)
      .attr("width", swatchW).attr("height", swatchH).attr("rx", 3)
      .attr("fill", "url(#booster-WA)").attr("opacity", 0.9);
    legendGroup.append("rect")
      .attr("x", item0SwatchX).attr("y", legendTopY)
      .attr("width", swatchW).attr("height", swatchH).attr("rx", 3)
      .attr("fill", "none").attr("stroke", "#9CA3AF").attr("stroke-width", 0.5);

    prevEventIdsRef.current = currentEventIds;
  }, [layout, windowStart, windowEnd, dims, isDetail, notableEvents, showNotableLabels, showOngoingTail, selectedEventId]);

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden relative bg-white">
      <svg ref={svgRef} style={{ width: dims.width, height: dims.height }} />

      {tooltip && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className={`absolute z-10 pointer-events-none border rounded-lg p-3 text-xs max-w-xs transition-colors ${
            tooltipTransparent
              ? "bg-white/50 backdrop-blur-sm border-gray-200/60 shadow-sm"
              : "bg-white border-gray-200 shadow-lg"
          }`}
          style={{
            width: Math.min(320, dims.width - 16),
            left: tooltip.x + 14,
            top:  tooltip.y - 8,
          }}
        >
          <p className={`font-semibold mb-1 ${tooltipTransparent ? "text-gray-900" : "text-gray-800"}`}>{tooltip.event.title}</p>
          <p className={tooltipTransparent ? "text-gray-600" : "text-gray-500"}>{tooltip.event.region} · {tooltip.event.type}</p>
          <TooltipPeriods event={tooltip.event} />
          {tooltip.event.short_description && (
            <ul className="mt-1 space-y-0.5 list-none">
              {tooltip.event.short_description.split("\n").map((line, i) => (
                <li key={i} className={`leading-snug ${tooltipTransparent ? "text-gray-600" : "text-gray-600"}`}>· {line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
