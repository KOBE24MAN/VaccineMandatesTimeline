import { useState, useMemo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useEvents } from "./hooks/useEvents";
import { useFilters } from "./hooks/useFilters";
import { FilterBar } from "./components/FilterBar";
import { Timeline } from "./components/Timeline";
import { Minimap } from "./components/Minimap";
import { EventDetail } from "./components/EventDetail";
import { GroupPanel } from "./components/GroupPanel";
import { parseDate } from "./utils/dates";

export default function App() {
  const { events, loading, error, fetchDetail } = useEvents();
  const {
    activeRegions,
    activeTypes,
    activeCategories,
    filteredEvents,
    toggleRegion,
    toggleType,
    toggleCategory,
    selectAllRegions,
    clearAllRegions,
    selectAllTypes,
    clearAllTypes,
    selectAllCategories,
    clearAllCategories,
    isolateRegion,
  } = useFilters(events);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [groupedEventIds, setGroupedEventIds] = useState<string[] | null>(null);
  const [showFilter, setShowFilter] = useState(true);
  const [showDetail, setShowDetail] = useState(true);
  const [manualVisibilityLevel, setManualVisibilityLevel] = useState<number | null>(null);
  const firstClick = useRef(true);

  // Used to preserve zoom level when the timeline container resizes (panel open/close)
  const prevTimelineWidthRef = useRef(0);
  const effectiveWindowRef = useRef<{ start: Date; end: Date } | null>(null);

  function handleEventClick(id: string) {
    setGroupedEventIds(null);
    setSelectedEventId(id);
    setShowDetail(true);
    const ev = events.find(e => e.id === id);
    if (!ev) return;
    if (firstClick.current) {
      firstClick.current = false;
      isolateRegion(ev.region);
    }
    const center = parseDate(ev.start_date);
    const threeMonths = 90 * 24 * 60 * 60 * 1000;
    setWindowStart(new Date(center.getTime() - threeMonths));
    setWindowEnd(new Date(center.getTime() + threeMonths));
  }

  function handleGroupClick(ids: string[]) {
    setSelectedEventId(null);
    setGroupedEventIds(ids);
    setShowDetail(true);
  }

  function handleSelectFromGroup(id: string) {
    setGroupedEventIds(null);
    handleEventClick(id);
  }

  // Derive the full date extent from all loaded events
  const { fullStart, fullEnd } = useMemo(() => {
    if (events.length === 0) {
      return { fullStart: new Date(), fullEnd: new Date() };
    }
    const dates = events.flatMap((e) =>
      [e.start_date, e.end_date].filter(Boolean).map((d) => parseDate(d!))
    );
    return {
      fullStart: new Date(Math.min(...dates.map((d) => d.getTime()))),
      fullEnd: new Date(Math.max(...dates.map((d) => d.getTime()))),
    };
  }, [events]);

  // Viewport window — starts as the full extent, user narrows via Minimap
  const [windowStart, setWindowStart] = useState<Date | null>(null);
  const [windowEnd, setWindowEnd] = useState<Date | null>(null);

  // Intro zoom: once events load, animate from full extent → 1-year target window
  const hasAnimated = useRef(false);
  useEffect(() => {
    if (hasAnimated.current || events.length === 0) return;
    hasAnimated.current = true;

    const targetStart = new Date("2021-08-20");
    const targetEnd   = new Date("2022-08-20");
    const duration    = 1800; // ms
    const startTime   = performance.now();
    const fromStart   = fullStart.getTime();
    const fromEnd     = fullEnd.getTime();

    function easeInOutCubic(t: number) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function frame(now: number) {
      const t = Math.min((now - startTime) / duration, 1);
      const e = easeInOutCubic(t);
      setWindowStart(new Date(fromStart + e * (targetStart.getTime() - fromStart)));
      setWindowEnd  (new Date(fromEnd   + e * (targetEnd.getTime()   - fromEnd)));
      if (t < 1) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }, [events.length, fullStart, fullEnd]);

  const effectiveWindowStart = windowStart ?? fullStart;
  const effectiveWindowEnd = windowEnd ?? fullEnd;

  // Keep ref in sync so the width-change handler always reads the latest window
  effectiveWindowRef.current = { start: effectiveWindowStart, end: effectiveWindowEnd };

  function handleTimelineWidthChange(newWidth: number) {
    const prev = prevTimelineWidthRef.current;
    prevTimelineWidthRef.current = newWidth;
    if (prev === 0 || newWidth === 0 || prev === newWidth) return;
    const win = effectiveWindowRef.current;
    if (!win) return;
    const ratio = newWidth / prev;
    const center = (win.start.getTime() + win.end.getTime()) / 2;
    const halfDuration = ((win.end.getTime() - win.start.getTime()) / 2) * ratio;
    setWindowStart(new Date(center - halfDuration));
    setWindowEnd(new Date(center + halfDuration));
  }

  // Auto visibility level: fewer levels shown when window is wide (zoomed out)
  const windowDays = (effectiveWindowEnd.getTime() - effectiveWindowStart.getTime()) / 86_400_000;
  const autoVisibilityLevel =
    windowDays > 1095 ? 1 :
    windowDays > 730  ? 2 :
    windowDays > 365  ? 3 :
    windowDays > 180  ? 4 :
    windowDays > 90   ? 5 : 6;

  const effectiveVisibilityLevel = manualVisibilityLevel ?? autoVisibilityLevel;
  const visibleEvents = filteredEvents.filter(e => e.visibility_level <= effectiveVisibilityLevel);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        Loading timeline…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen text-red-500">
        Error: {error}
      </div>
    );
  }

  const panelSpring = { type: "spring", stiffness: 280, damping: 28 } as const;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-100">
      {/* Top bar */}
      <header className="flex items-center px-5 py-2.5 bg-white border-b border-gray-200 flex-shrink-0 z-20">
        <div className="flex flex-col">
          <span className="text-xl font-bold tracking-tight text-gray-900">MandEval</span>
          <span className="text-xs text-gray-400 leading-tight">COVID-19 Vaccine Mandates Timeline</span>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left filter panel + tab */}
        <div className="relative flex-shrink-0 h-full">
          <motion.aside
            animate={{ width: showFilter ? 256 : 0 }}
            transition={panelSpring}
            className="h-full overflow-hidden bg-white border-r border-gray-200"
            style={{ minWidth: 0 }}
          >
            <div className="w-64 h-full overflow-y-auto">
              <FilterBar
                activeRegions={activeRegions}
                activeTypes={activeTypes}
                onToggleRegion={toggleRegion}
                onToggleType={toggleType}
                onSelectAllRegions={selectAllRegions}
                onClearAllRegions={clearAllRegions}
                onSelectAllTypes={selectAllTypes}
                onClearAllTypes={clearAllTypes}
                activeCategories={activeCategories}
                onToggleCategory={toggleCategory}
                onSelectAllCategories={selectAllCategories}
                onClearAllCategories={clearAllCategories}
                windowStart={effectiveWindowStart}
                windowEnd={effectiveWindowEnd}
                fullStart={fullStart}
                fullEnd={fullEnd}
                onWindowChange={(start, end) => { setWindowStart(start); setWindowEnd(end); }}
                autoVisibilityLevel={autoVisibilityLevel}
                manualVisibilityLevel={manualVisibilityLevel}
                onVisibilityLevelChange={setManualVisibilityLevel}
              />
            </div>
          </motion.aside>
          <button
            onClick={() => setShowFilter(f => !f)}
            className="absolute top-1/2 right-0 translate-x-full -translate-y-1/2 z-10 w-5 h-16 flex items-center justify-center bg-gray-800/75 text-white rounded-r hover:bg-gray-800/90 transition-colors"
            title={showFilter ? "Hide filters" : "Show filters"}
          >
            <span className="text-base leading-none">{showFilter ? "‹" : "›"}</span>
          </button>
        </div>

        {/* Centre — timeline + minimap */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Timeline
            events={visibleEvents}
            activeRegions={activeRegions}
            activeTypes={activeTypes}
            onEventClick={handleEventClick}
            onGroupClick={handleGroupClick}
            windowStart={effectiveWindowStart}
            windowEnd={effectiveWindowEnd}
            onWidthChange={handleTimelineWidthChange}
          />
          <Minimap
            events={events}
            fullStart={fullStart}
            fullEnd={fullEnd}
            windowStart={effectiveWindowStart}
            windowEnd={effectiveWindowEnd}
            onWindowChange={(start, end) => { setWindowStart(start); setWindowEnd(end); }}
          />
        </div>

        {/* Right detail panel + tab */}
        <div className="relative flex-shrink-0 h-full">
          <motion.aside
            animate={{ width: showDetail ? 320 : 0 }}
            transition={panelSpring}
            className="h-full overflow-hidden bg-white border-l border-gray-200"
            style={{ minWidth: 0 }}
          >
            <div className="w-80 h-full overflow-y-auto">
              <EventDetail
                eventId={selectedEventId}
                groupIds={groupedEventIds}
                events={events}
                fetchDetail={fetchDetail}
                onClose={() => { setSelectedEventId(null); setGroupedEventIds(null); }}
                onSelectFromGroup={handleSelectFromGroup}
              />
            </div>
          </motion.aside>
          <button
            onClick={() => setShowDetail(d => !d)}
            className="absolute top-1/2 left-0 -translate-x-full -translate-y-1/2 z-10 w-5 h-16 flex items-center justify-center bg-gray-800/75 text-white rounded-l hover:bg-gray-800/90 transition-colors"
            title={showDetail ? "Hide details" : "Show details"}
          >
            <span className="text-base leading-none">{showDetail ? "›" : "‹"}</span>
          </button>
        </div>

      </div>

      {/* GroupPanel is only shown as an overlay when the detail panel is hidden */}
      {!showDetail && (
        <GroupPanel
          ids={groupedEventIds}
          events={events}
          onSelectEvent={handleSelectFromGroup}
          onClose={() => setGroupedEventIds(null)}
        />
      )}
    </div>
  );
}
