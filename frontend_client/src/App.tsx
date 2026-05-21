import { useState, useMemo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useEvents } from "./hooks/useEvents";
import { useFilters } from "./hooks/useFilters";
import { useNotableEvents } from "./hooks/useNotableEvents";
import { FilterBar } from "./components/FilterBar";
import { Timeline } from "./components/Timeline";
import { Minimap } from "./components/Minimap";
import { EventDetail } from "./components/EventDetail";
import { GroupPanel } from "./components/GroupPanel";
import { parseDate } from "./utils/dates";

export default function App() {
  const { events, loading, error, fetchDetail } = useEvents();
  const notableEvents = useNotableEvents();
  const [activeNotableEventIds, setActiveNotableEventIds] = useState<Set<number>>(new Set());
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
    enterCategoryMode,
  } = useFilters(events);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [groupedEventIds, setGroupedEventIds] = useState<string[] | null>(null);
  const [showFilter, setShowFilter] = useState(true);
  const [showDetail, setShowDetail] = useState(true);
  const [manualVisibilityLevel, setManualVisibilityLevel] = useState<number | null>(null);
  const [showOngoingTail, setShowOngoingTail] = useState(true);
  const [showNotableLabels, setShowNotableLabels] = useState(true);
  const [tooltipTransparent, setTooltipTransparent] = useState(false);
  const [multiNotableSelect, setMultiNotableSelect] = useState(false);
  const [unstackBars, setUnstackBars] = useState(false);
  const [autoUnstackEnabled, setAutoUnstackEnabled] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setShowInfo(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);


  // Used to preserve zoom level when the timeline container resizes (panel open/close)
  const prevTimelineWidthRef = useRef(0);
  const effectiveWindowRef = useRef<{ start: Date; end: Date } | null>(null);

  function handleEventClick(id: string) {
    setGroupedEventIds(null);
    setSelectedEventId(id);
    setShowDetail(true);
  }

  function handleEventDoubleClick(id: string) {
    const ev = events.find(e => e.id === id);
    if (ev) isolateRegion(ev.region);
  }

  function handleSearchResultClick(id: string) {
    const ev = events.find(e => e.id === id);
    if (!ev) return;

    // Isolate region (same as double-tap)
    isolateRegion(ev.region);

    // Position start date ~15% from the left over a 180-day window
    const DAY = 24 * 60 * 60 * 1000;
    const startMs = parseDate(ev.start_date).getTime();
    setWindowStart(new Date(startMs - 25 * DAY));
    setWindowEnd(new Date(startMs + 155 * DAY));

    // Select and open detail
    setGroupedEventIds(null);
    setSelectedEventId(id);
    setShowDetail(true);
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

  function easeInOutCubic(t: number) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function runIntroAnimation(fromStart: number, fromEnd: number) {
    const targetStart = new Date("2021-06-01");
    const targetEnd   = new Date("2022-12-01");
    const duration    = 1800;
    const startTime   = performance.now();

    function frame(now: number) {
      const t = Math.min((now - startTime) / duration, 1);
      const e = easeInOutCubic(t);
      setWindowStart(new Date(fromStart + e * (targetStart.getTime() - fromStart)));
      setWindowEnd  (new Date(fromEnd   + e * (targetEnd.getTime()   - fromEnd)));
      if (t < 1) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  // Intro zoom: once events load, animate from full extent → 1-year target window
  const hasAnimated = useRef(false);
  useEffect(() => {
    if (hasAnimated.current || events.length === 0) return;
    hasAnimated.current = true;
    runIntroAnimation(fullStart.getTime(), fullEnd.getTime());
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
  // Bonus levels when fewer jurisdictions are active (log2: 8→+0, 4→+1, 2→+2, 1→+3)
  const regionBonus = Math.floor(Math.log2(8 / Math.max(activeRegions.size, 1)));
  const autoVisibilityLevel = Math.min(
    (windowDays > 1095 ? 1 :
     windowDays > 730  ? 2 :
     windowDays > 365  ? 3 :
     windowDays > 180  ? 4 :
     windowDays > 90   ? 5 : 6) + regionBonus,
    6
  );

  const effectiveUnstackBars = unstackBars || (autoUnstackEnabled && windowDays < 180);

  const effectiveVisibilityLevel = manualVisibilityLevel ?? autoVisibilityLevel;

  // Group filteredEvents by their deduplication key (same key used in Timeline).
  // If any member of a group is visible at the current level, include ALL members
  // so the stacked badge count stays stable as you zoom in.
  const visibleEvents = useMemo(() => {
    const dedupKey = (e: typeof filteredEvents[0]) =>
      `${e.title}||${e.region}||${e.start_date ?? ""}||${e.end_date ?? ""}`;
    const groups = new Map<string, typeof filteredEvents>();
    for (const e of filteredEvents) {
      const k = dedupKey(e);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(e);
    }
    const result: typeof filteredEvents = [];
    for (const group of groups.values()) {
      if (group.some(e => e.visibility_level <= effectiveVisibilityLevel)) {
        result.push(...group);
      }
    }
    return result;
  }, [filteredEvents, effectiveVisibilityLevel]);

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
      <header className="flex items-center justify-between px-5 py-2.5 bg-white border-b border-gray-200 flex-shrink-0 z-20">
        <div className="flex items-center gap-2.5">
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-gray-900">MandEval</span>
            <span className="text-xs text-gray-400 leading-tight">COVID-19 Vaccine Mandates Timeline</span>
          </div>
          <button
            onClick={() => setShowInfo(true)}
            className="w-6 h-6 rounded-full border border-gray-300 text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors flex items-center justify-center text-xs font-bold leading-none flex-shrink-0"
            title="About MandEval"
          >
            ?
          </button>
        </div>
        <span className="text-xs text-gray-400">
          Showing <span className="font-semibold text-gray-600">{visibleEvents.length}</span> of{" "}
          <span className="font-semibold text-gray-600">{events.length}</span> mandates
        </span>
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
                onEnterCategoryMode={enterCategoryMode}
                windowStart={effectiveWindowStart}
                windowEnd={effectiveWindowEnd}
                fullStart={fullStart}
                fullEnd={fullEnd}
                onWindowChange={(start, end) => { setWindowStart(start); setWindowEnd(end); }}
                autoVisibilityLevel={autoVisibilityLevel}
                manualVisibilityLevel={manualVisibilityLevel}
                onVisibilityLevelChange={setManualVisibilityLevel}
                showOngoingTail={showOngoingTail}
                onToggleOngoingTail={() => setShowOngoingTail(v => !v)}
                tooltipTransparent={tooltipTransparent}
                onToggleTooltipTransparent={() => setTooltipTransparent(v => !v)}
                unstackBars={unstackBars}
                onToggleUnstackBars={() => setUnstackBars(v => !v)}
                autoUnstackEnabled={autoUnstackEnabled}
                onToggleAutoUnstack={() => setAutoUnstackEnabled(v => !v)}
                onResetWindow={() => runIntroAnimation(fullStart.getTime(), fullEnd.getTime())}
                notableEvents={notableEvents}
                activeNotableEventIds={activeNotableEventIds}
                onToggleNotableEvent={id => {
                  if (multiNotableSelect) {
                    setActiveNotableEventIds(prev => {
                      const next = new Set(prev);
                      next.has(id) ? next.delete(id) : next.add(id);
                      return next;
                    });
                  } else {
                    // Single-select: select only this one, or deselect if already the only one
                    setActiveNotableEventIds(prev =>
                      prev.size === 1 && prev.has(id) ? new Set() : new Set([id])
                    );
                  }
                }}
                onSelectAllNotableEvents={() => setActiveNotableEventIds(new Set(notableEvents.map(e => e.id)))}
                onClearAllNotableEvents={() => setActiveNotableEventIds(new Set())}
                multiNotableSelect={multiNotableSelect}
                onSearchResultClick={handleSearchResultClick}
                onToggleMultiNotableSelect={() => {
                  setMultiNotableSelect(v => !v);
                  // When switching back to single-select, keep at most one active
                  if (multiNotableSelect) {
                    setActiveNotableEventIds(prev => {
                      const first = [...prev][0];
                      return first !== undefined ? new Set([first]) : new Set();
                    });
                  }
                }}
                showNotableLabels={showNotableLabels}
                onToggleNotableLabels={() => setShowNotableLabels(v => !v)}
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
            onEventDoubleClick={handleEventDoubleClick}
            onGroupClick={handleGroupClick}
            windowStart={effectiveWindowStart}
            windowEnd={effectiveWindowEnd}
            onWidthChange={handleTimelineWidthChange}
            selectedEventId={selectedEventId}
            unstackBars={effectiveUnstackBars}
            showOngoingTail={showOngoingTail}
            tooltipTransparent={tooltipTransparent}
            notableEvents={notableEvents.filter(e => activeNotableEventIds.has(e.id))}
            showNotableLabels={showNotableLabels}
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

      {/* Info modal */}
      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowInfo(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-xl mx-4 max-h-[80vh] overflow-y-auto p-6">
            <button
              onClick={() => setShowInfo(false)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors flex items-center justify-center text-gray-500 text-lg leading-none"
              aria-label="Close"
            >
              ×
            </button>
            <h2 className="text-2xl font-bold text-gray-900 mb-1 pr-8">About this timeline</h2>

            <div className="mt-4">
              <h3 className="text-sm font-bold text-gray-800 mb-1.5">MandEval</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                MandEval collected a structured dataset of COVID-19 vaccine mandate events so that researchers can compare how different policies developed across time and jurisdictions. This website turns that dataset into an interactive public timeline, making key dates, jurisdictions, mandate types, and policy details easier to explore.
              </p>
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-bold text-gray-800 mb-1.5">How to use</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Use the minimap at the bottom to pan and zoom the timeline window. Click any mandate bar to open its detail panel on the right. Use the +/− buttons in the filter bar to control how many events are shown at once. The filter bar also lets you narrow by jurisdiction, mandate type, and category. Double-click a bar to isolate that jurisdiction, and use the search in the Experimental section to find specific mandates by name.
              </p>
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-bold text-gray-800 mb-1.5">Reading the bars</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                The striped portion of a bar represents the announcement-to-enforcement lead period. The solid portion is the active enforcement period. A dashed outline indicates an uncertain date. Bars that fade at the right edge are ongoing mandates with no confirmed end date. A ×N badge means multiple overlapping mandates have been grouped — click to expand them.
              </p>
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-bold text-gray-800 mb-1.5">Project team</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                This interactive tool was built as part of a CITS5551 engineering design project at The University of Western Australia by Zhiheng Zhou, Zijun Zhou, Joel Fitzpatrick, Jiaren Zhu, and Yupeng Sun. It was designed for public access and long-term hosting.
              </p>
            </div>

            <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 p-3">
              <h3 className="text-sm font-bold text-gray-700 mb-1.5">A note on the data</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                The underlying dataset was collected from publicly available sources by the MandEval research team. Some end dates are estimated where an exact date wasn't recorded, and mandates still active at the time of collection appear as ongoing. As with any research dataset, some entries may be incomplete or approximate.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
