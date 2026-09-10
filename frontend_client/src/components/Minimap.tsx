import { useRef, useEffect, useState } from "react";
import * as d3 from "d3";
import type { EventIndex, Region } from "../types/event";
import { ALL_REGIONS } from "../types/event";
import { parseDate } from "../utils/dates";

const MARGIN_LEFT = 56;
const MARGIN_RIGHT = 16;

const REGION_COLOR: Record<Region, string> = {
  WA: "#2563EB",
  NT: "#EA580C",
  QLD: "#DC2626",
  NSW: "#16A34A",
  VIC: "#7C3AED",
  TAS: "#0D9488",
  SA: "#DB2777",
  ACT: "#CA8A04",
};

interface Props {
  events: EventIndex[];
  fullStart: Date;
  fullEnd: Date;
  windowStart: Date;
  windowEnd: Date;
  onWindowChange: (start: Date, end: Date) => void;
}

export function Minimap({
  events,
  fullStart,
  fullEnd,
  windowStart,
  windowEnd,
  onWindowChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(800);

  const innerW = Math.max(width - MARGIN_LEFT - MARGIN_RIGHT, 1);

  // Track container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Draw static event bars (only re-runs when data or width changes)
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const totalH = 48;
    const rowH = totalH / ALL_REGIONS.length;
    const barH = Math.max(rowH * 0.4, 2);

    const xScale = d3
      .scaleTime()
      .domain([fullStart, fullEnd])
      .range([0, innerW]);

    const g = svg.append("g").attr("transform", `translate(${MARGIN_LEFT},0)`);

    // Compressed event bars
    events.forEach((e) => {
      const ri = ALL_REGIONS.indexOf(e.region as Region);
      if (ri === -1 || !e.start_date || !e.end_date) return;

      const y = ri * rowH + (rowH - barH) / 2;
      // Draw only supplied segments, leaving unknown original intervals blank.
      e.segments.forEach((segment) => {
        const x = xScale(parseDate(segment.start));
        const w = Math.max(xScale(parseDate(segment.end)) - x, 1);
        g.append("rect")
          .attr("x", x)
          .attr("y", y)
          .attr("width", w)
          .attr("height", barH)
          .attr(
            "fill",
            segment.kind === "booster" ? "#143454" : REGION_COLOR[e.region],
          )
          .attr("opacity", 0.55);
      });
    });

    // Date axis
    g.append("g")
      .attr("transform", `translate(0,${totalH})`)
      .call(d3.axisBottom(xScale).ticks(5).tickSize(0))
      .call((ax) => ax.select(".domain").remove())
      .call((ax) =>
        ax
          .selectAll("text")
          .attr("fill", "#9CA3AF")
          .attr("font-size", "9px")
          .attr("y", 4),
      );

    // Region labels
    ALL_REGIONS.forEach((region, ri) => {
      const y = ri * rowH + rowH / 2;
      svg
        .append("text")
        .attr("x", MARGIN_LEFT - 4)
        .attr("y", y)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .attr("fill", REGION_COLOR[region])
        .attr("font-size", "8px")
        .attr("font-weight", "700")
        .text(region);
    });
  }, [events, fullStart, fullEnd, innerW]);

  // Window indicator — calculated from React state, not D3
  const xScale = d3.scaleTime().domain([fullStart, fullEnd]).range([0, innerW]);
  const winX = MARGIN_LEFT + Math.max(xScale(windowStart), 0);
  const winW = Math.max(xScale(windowEnd) - xScale(windowStart), 8);

  // Drag state tracked via refs (no re-render during drag)
  const dragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWindow = useRef({ start: windowStart, end: windowEnd });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWindow.current = { start: windowStart, end: windowEnd };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    e.stopPropagation();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragStartX.current;
    const totalMs = fullEnd.getTime() - fullStart.getTime();
    const dtMs = (dx / innerW) * totalMs;
    const duration =
      dragStartWindow.current.end.getTime() -
      dragStartWindow.current.start.getTime();
    let newStart = new Date(dragStartWindow.current.start.getTime() + dtMs);
    let newEnd = new Date(dragStartWindow.current.end.getTime() + dtMs);
    // Clamp to full range
    if (newStart < fullStart) {
      newStart = fullStart;
      newEnd = new Date(fullStart.getTime() + duration);
    }
    if (newEnd > fullEnd) {
      newEnd = fullEnd;
      newStart = new Date(fullEnd.getTime() - duration);
    }
    onWindowChange(newStart, newEnd);
  };

  const handlePointerUp = () => {
    dragging.current = false;
  };

  // Click outside window indicator → center window at click point
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const clickX = e.clientX - rect.left - MARGIN_LEFT;
    if (clickX < 0 || clickX > innerW) return;

    const clickDate = xScale.invert(clickX);
    const duration = windowEnd.getTime() - windowStart.getTime();
    const half = duration / 2;
    let newStart = new Date(clickDate.getTime() - half);
    let newEnd = new Date(clickDate.getTime() + half);
    if (newStart < fullStart) {
      newStart = fullStart;
      newEnd = new Date(fullStart.getTime() + duration);
    }
    if (newEnd > fullEnd) {
      newEnd = fullEnd;
      newStart = new Date(fullEnd.getTime() - duration);
    }
    onWindowChange(newStart, newEnd);
  };

  return (
    <div
      ref={containerRef}
      className="relative bg-gray-50 border-t border-gray-200 select-none"
      style={{ height: 64, flexShrink: 0 }}
    >
      {/* Static event bars */}
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full"
        onClick={handleSvgClick}
      />

      {/* Draggable window indicator */}
      <div
        className="absolute top-0 h-12 rounded border border-blue-400 bg-blue-300 opacity-30 cursor-grab active:cursor-grabbing"
        style={{ left: winX, width: winW, touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="slider"
        tabIndex={0}
        aria-label="Timeline overview window"
        aria-valuemin={fullStart.getTime()}
        aria-valuemax={fullEnd.getTime()}
        aria-valuenow={windowStart.getTime()}
        aria-valuetext={`${windowStart.toISOString().slice(0, 10)} to ${windowEnd.toISOString().slice(0, 10)}`}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          const delta =
            (windowEnd.getTime() - windowStart.getTime()) *
            (event.key === "ArrowLeft" ? -0.1 : 0.1);
          onWindowChange(
            new Date(windowStart.getTime() + delta),
            new Date(windowEnd.getTime() + delta),
          );
        }}
      />
    </div>
  );
}
