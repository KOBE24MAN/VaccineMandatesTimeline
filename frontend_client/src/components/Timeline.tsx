import { useRef, useEffect, useState, useMemo } from "react";
import * as d3 from "d3";
import type { EventIndex, Region, EventType, NotableEvent } from "../types/event";
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
    const end   = (ev as EventIndex).ongoing
      ? Number.MAX_SAFE_INTEGER
      : ev.end_date
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
  onEventDoubleClick?: (id: string) => void;
  onGroupClick: (ids: string[]) => void;
  windowStart: Date;
  windowEnd: Date;
  onWidthChange?: (width: number) => void;
  showOngoingTail?: boolean;
  notableEvents?: NotableEvent[];
  showNotableLabels?: boolean;
  tooltipTransparent?: boolean;
}

export function Timeline({ events, activeRegions, activeTypes, onEventClick, onEventDoubleClick, onGroupClick, windowStart, windowEnd, onWidthChange, showOngoingTail = true, notableEvents = [], showNotableLabels = true, tooltipTransparent = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef       = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [dims, setDims] = useState({ width: 800, height: 500 });

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
    const dedupedEvents = deduplicateEvents(events);
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
  }, [events, activeRegions]);

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

    const { visibleRegions, dedupedEvents, byRegion, lanesPerRegion, laneCountPerRegion } = layout;

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
          // Ongoing mandates extend to the right edge of the viewport
          const x2raw = xScale(endD);
          const x2 = ev.ongoing ? MARGIN.left + innerW : x2raw;
          const w  = Math.max(x2 - x1, 3);

          if ((ev.ongoing ? MARGIN.left + innerW : x2raw) < MARGIN.left || x1 > MARGIN.left + innerW) return;

          const lane  = lanes.get(ev.id) ?? 0;
          const barY  = y + rowH - (lane + 1) * laneH + LANE_GAP / 2;
          const rx    = barH / 2;
          const barColor = eventColor(region, ev.type);
          const outlineColor = REGION_COLOR[region];

          const isNew = prevEventIdsRef.current.size > 0
            && !prevEventIdsRef.current.has(ev.id);

          const prevDims = oldBarDims.get(ev.id);
          const isResizing = !isNew && !!prevDims
            && (prevDims.barY !== barY || prevDims.barH !== barH);

          const dur  = 380;
          const ease = d3.easeCubicOut;
          const midY = barY + barH / 2;

          prevBarDimsRef.current.set(ev.id, { barY, barH });

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
          const g = svg.append("g")
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
            .attr("fill", barColor).attr("fill-opacity", 0.85);

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

          // ── Ongoing tail fade overlay ───────────────────────────────────────
          if (ev.ongoing && showOngoingTail) {
            const tailX = Math.max(x1, MARGIN.left + innerW - 64);
            g.append("rect")
              .attr("x", tailX).attr("y", barY)
              .attr("width", MARGIN.left + innerW - tailX).attr("height", barH)
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
          const outline = svg.append("rect")
            .attr("x", x1).attr("width", ev.ongoing ? w + rx : w).attr("rx", rx)
            .attr("fill", "none")
            .attr("stroke", outlineColor)
            .attr("stroke-width", ev.date_uncertain ? 1.5 : 1)
            .attr("stroke-opacity", 0.5)
            .attr("stroke-dasharray", ev.date_uncertain ? "4,3" : null)
            .attr("pointer-events", "none");

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
          if (ev.ongoing && showOngoingTail && barH >= 8) {
            const cx  = MARGIN.left + innerW - 5;
            const cy  = barY + barH / 2;
            const ch  = Math.min(barH * 0.38, 7);
            const cw  = Math.min(4, barH * 0.28);
            svg.append("path")
              .attr("d", `M${cx - cw},${cy - ch} L${cx},${cy} L${cx - cw},${cy + ch}`)
              .attr("fill", "none")
              .attr("stroke", outlineColor)
              .attr("stroke-width", 1.5)
              .attr("stroke-linecap", "round")
              .attr("stroke-linejoin", "round")
              .attr("opacity", 0.75)
              .attr("pointer-events", "none");
          }

          // ── Hit rect ───────────────────────────────────────────────────────
          svg.append("rect")
            .attr("x", x1).attr("y", barY)
            .attr("width", w).attr("height", barH)
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

          // ── Badge ──────────────────────────────────────────────────────────
          if (ev.mergedIds && ev.mergedIds.length > 1 && w > 20) {
            const badgeW  = 16;
            const badgeH  = 11;
            const badgeX  = Math.min(x1 + w - badgeW - 3, MARGIN.left + innerW - badgeW - 3);
            const newBadgeY = barY + 3;
            const oldBadgeY = prevDims ? prevDims.barY + 3 : newBadgeY;

            const badgeRect = svg.append("rect")
              .attr("x", badgeX).attr("width", badgeW).attr("height", badgeH)
              .attr("rx", 3).attr("fill", "#1F2937").attr("pointer-events", "none");
            const badgeTxt = svg.append("text")
              .attr("x", badgeX + badgeW / 2)
              .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
              .attr("fill", "#fff").attr("font-size", "8px").attr("font-weight", "700")
              .attr("pointer-events", "none").text(`×${ev.mergedIds.length}`);

            if (isNew) {
              badgeRect.attr("y", newBadgeY).attr("opacity", 0)
                .transition().duration(dur).attr("opacity", 1);
              badgeTxt.attr("y", newBadgeY + badgeH / 2).attr("opacity", 0)
                .transition().duration(dur).attr("opacity", 1);
            } else if (isResizing) {
              badgeRect.attr("y", oldBadgeY)
                .transition().duration(dur).ease(ease).attr("y", newBadgeY);
              badgeTxt.attr("y", oldBadgeY + badgeH / 2)
                .transition().duration(dur).ease(ease).attr("y", newBadgeY + badgeH / 2);
            } else {
              badgeRect.attr("y", newBadgeY);
              badgeTxt.attr("y", newBadgeY + badgeH / 2);
            }
          }

          // ── Label ──────────────────────────────────────────────────────────
          const visibleX1 = Math.max(x1, MARGIN.left);
          const visibleX2 = Math.min(x2, MARGIN.left + innerW);
          const visibleW  = visibleX2 - visibleX1;
          const fontSize  = Math.min(Math.max(Math.round(barH * 0.45), 10), 22);
          if (barH >= 14 && visibleW > 50) {
            const newLabelY = barY + barH / 2;
            const oldLabelY = prevDims ? prevDims.barY + prevDims.barH / 2 : newLabelY;

            const txt = svg.append("text")
              .attr("x", visibleX1 + rx + 4)
              .attr("dominant-baseline", "middle")
              .attr("fill", "#fff").attr("font-size", `${fontSize}px`)
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

    // ── Notable event lines ───────────────────────────────────────────────────
    notableEvents.forEach(ev => {
      const d = parseDate(ev.display_date);
      const x = xScale(d);
      if (x < MARGIN.left || x > MARGIN.left + innerW) return;

      svg.append("line")
        .attr("x1", x).attr("x2", x)
        .attr("y1", MARGIN.top).attr("y2", MARGIN.top + innerH)
        .attr("stroke", "#EF4444")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "4,3")
        .attr("pointer-events", "none");

      if (showNotableLabels) {
        const label = ev.title + (ev.date_approximate ? " ~" : "");
        const fontSize = 11;
        const padX = 5, padY = 3;
        // Measure approximate text width (11px * ~0.57 char width)
        const approxTextW = label.length * fontSize * 0.57;
        const tagH = fontSize + padY * 2;
        const tagY = MARGIN.top + 4;
        // Keep tag inside the viewport
        const tagX = Math.min(x + 1, MARGIN.left + innerW - approxTextW - padX * 2 - 2);

        svg.append("rect")
          .attr("x", tagX).attr("y", tagY)
          .attr("width", approxTextW + padX * 2).attr("height", tagH)
          .attr("rx", 3)
          .attr("fill", "#EF4444")
          .attr("pointer-events", "none");

        svg.append("text")
          .attr("x", tagX + padX)
          .attr("y", tagY + padY)
          .attr("dominant-baseline", "hanging")
          .attr("fill", "#fff")
          .attr("font-size", `${fontSize}px`)
          .attr("font-weight", "700")
          .attr("pointer-events", "none")
          .text(label);
      }
    });

    // ── Stripe legend ─────────────────────────────────────────────────────────
    // Two items right-aligned: [swatch] Label   [swatch] Label
    const legendRightX = MARGIN.left + innerW - 8;
    const legendTopY   = MARGIN.top / 2;
    const swatchH = 10;
    const swatchW = 14;
    const textGap = 4; // gap between swatch and label
    const itemGap = 14; // gap between the two items

    const legendGroup = svg.append("g").attr("pointer-events", "none");

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

    // Item 1 (left of item 2): striped swatch = "Announcement period"
    const item1RightX = item2SwatchX - itemGap;
    legendGroup.append("text")
      .attr("x", item1RightX).attr("y", legendTopY + swatchH / 2)
      .attr("text-anchor", "end").attr("dominant-baseline", "middle")
      .attr("fill", "#6B7280").attr("font-size", "9px").text("Announcement period");
    const annoTextW = "Announcement period".length * 5.2;
    const item1SwatchX = item1RightX - annoTextW - textGap - swatchW;
    legendGroup.append("rect")
      .attr("x", item1SwatchX).attr("y", legendTopY)
      .attr("width", swatchW).attr("height", swatchH).attr("rx", 3)
      .attr("fill", "url(#stripe-WA)").attr("opacity", 0.85);
    legendGroup.append("rect")
      .attr("x", item1SwatchX).attr("y", legendTopY)
      .attr("width", swatchW).attr("height", swatchH).attr("rx", 3)
      .attr("fill", "none").attr("stroke", "#9CA3AF").attr("stroke-width", 0.5);

    prevEventIdsRef.current = currentEventIds;
  }, [layout, windowStart, windowEnd, dims, isDetail]);

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden relative bg-white">
      <svg ref={svgRef} style={{ width: dims.width, height: dims.height }} />

      {tooltip && (
        <div
          className={`absolute z-10 pointer-events-none border rounded-lg p-3 text-xs max-w-xs transition-colors ${
            tooltipTransparent
              ? "bg-white/50 backdrop-blur-sm border-gray-200/60 shadow-sm"
              : "bg-white border-gray-200 shadow-lg"
          }`}
          style={{
            left: tooltip.x + 14,
            top:  tooltip.y - 8,
            transform: tooltip.x > dims.width * 0.65 ? "translateX(-110%)" : undefined,
          }}
        >
          <p className={`font-semibold mb-1 ${tooltipTransparent ? "text-gray-900" : "text-gray-800"}`}>{tooltip.event.title}</p>
          <p className={tooltipTransparent ? "text-gray-600" : "text-gray-500"}>{tooltip.event.region} · {tooltip.event.type}</p>
          <p className={tooltipTransparent ? "text-gray-600" : "text-gray-500"}>
            {tooltip.event.start_date}
            {tooltip.event.end_date ? ` — ${tooltip.event.end_date}` : " (ongoing)"}
          </p>
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
