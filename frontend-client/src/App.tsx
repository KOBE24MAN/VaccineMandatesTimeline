import { useState, useMemo, useEffect, useRef, useCallback } from "react";
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
import { hasOngoingSegment, timelineGroupKey, visualStartDate, visualEndDate } from "./utils/timeline";
import { filterMandates } from "./data/dataset";
import { searchTimelineEvents } from "./utils/search";

const VISIBILITY_ANCHORS = [
  { days: 1460, percent: 35 },
  { days: 912, percent: 45 },
  { days: 549, percent: 60 },
  { days: 270, percent: 75 },
  { days: 135, percent: 90 },
  { days: 60, percent: 100 },
] as const;

function continuousVisibilityPercent(windowDays: number): number {
  if (windowDays >= VISIBILITY_ANCHORS[0].days) return VISIBILITY_ANCHORS[0].percent;
  if (windowDays <= VISIBILITY_ANCHORS[VISIBILITY_ANCHORS.length - 1].days) return 100;
  for (let index = 0; index < VISIBILITY_ANCHORS.length - 1; index += 1) {
    const wider = VISIBILITY_ANCHORS[index];
    const narrower = VISIBILITY_ANCHORS[index + 1];
    if (windowDays <= wider.days && windowDays >= narrower.days) {
      const progress = (Math.log(wider.days) - Math.log(windowDays)) /
        (Math.log(wider.days) - Math.log(narrower.days));
      return wider.percent + progress * (narrower.percent - wider.percent);
    }
  }
  return 100;
}

export default function App() {
  const { events, allRecords, dateIssueRecords, totalRecords, loading, error, fetchDetail } = useEvents();
  const notableEvents = useNotableEvents();
  const [activeNotableEventIds, setActiveNotableEventIds] = useState<Set<number>>(new Set());
  const {
    activeRegions,
    activeTypes,
    filteredEvents,
    toggleRegion,
    toggleType,
    selectAllRegions,
    clearAllRegions,
    selectAllTypes,
    clearAllTypes,
    isolateRegion,
  } = useFilters(events);

  const [nameQuery, setNameQuery] = useState("");
  const [targetQuery, setTargetQuery] = useState("");
  const isSearching = Boolean(nameQuery.trim() || targetQuery.trim());
  const searchResults = useMemo(() => filterMandates(allRecords, { name: nameQuery, target: targetQuery }),
    [allRecords, nameQuery, targetQuery]);
  const searchEvents = useMemo(() => searchTimelineEvents(searchResults, allRecords), [searchResults, allRecords]);
  const timelineRegions = useMemo(() => isSearching
    ? new Set(searchEvents.map(event => event.region)) : activeRegions, [isSearching, searchEvents, activeRegions]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [groupedEventIds, setGroupedEventIds] = useState<string[] | null>(null);
  const [returnGroupIds, setReturnGroupIds] = useState<string[] | null>(null);
  const [showFilter, setShowFilter] = useState(true);
  const [showDetail, setShowDetail] = useState(() => window.innerWidth >= 960);
  const [manualVisibilityPercent, setManualVisibilityPercent] = useState<number | null>(null);
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
    setReturnGroupIds(null);
    setGroupedEventIds(null);
    setSelectedEventId(id);
    setShowDetail(true);
  }

  function handleEventDoubleClick(id: string) {
    const ev = (isSearching ? searchEvents : events).find(e => e.id === id);
    if (ev && !isSearching) isolateRegion(ev.region);
  }

  function handleSearchResultClick(id: string) {
    setReturnGroupIds(null);
    const ev = searchEvents.find(event => event.id === id || event.booster?.id === id);
    if (ev) {
      const first = visualStartDate(ev);
      const last = visualEndDate(ev) ?? first;
      if (first && last) {
        const start = parseDate(first).getTime();
        const end = parseDate(last).getTime();
        const padding = Math.max((end - start) * 0.1, 14 * 86_400_000);
        setWindowStart(new Date(start - padding));
        setWindowEnd(new Date(end + padding));
      }
    }
    setGroupedEventIds(null);
    setSelectedEventId(id);
    setShowDetail(true);
  }

  function handleGroupClick(ids: string[]) {
    setReturnGroupIds(null);
    setSelectedEventId(null);
    setGroupedEventIds(ids);
    setShowDetail(true);
  }

  function handleSelectFromGroup(id: string) {
    setReturnGroupIds(groupedEventIds ? [...groupedEventIds] : null);
    setGroupedEventIds(null);
    setSelectedEventId(id);
    setShowDetail(true);
  }

  function handleBackToGroup() {
    if (!returnGroupIds) return;
    setSelectedEventId(null);
    setGroupedEventIds(returnGroupIds);
    setReturnGroupIds(null);
    setShowDetail(true);
  }

  // Derive the full date extent from all loaded events
  const { fullStart, fullEnd } = useMemo(() => {
    if (events.length === 0) {
      return { fullStart: new Date(), fullEnd: new Date() };
    }
    const dates = events.flatMap((e) =>
      [e.announcement_date, e.start_date, e.end_date, e.booster?.start_date, e.booster?.end_date]
        .filter(Boolean)
        .map((d) => parseDate(d!))
    );
    if (events.some(hasOngoingSegment)) dates.push(new Date());
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

  const introFrame = useRef<number | null>(null);
  useEffect(() => () => { if (introFrame.current !== null) cancelAnimationFrame(introFrame.current); }, []);

  const runIntroAnimation = useCallback((fromStart: number, fromEnd: number) => {
    if (introFrame.current !== null) cancelAnimationFrame(introFrame.current);
    const targetStart = new Date("2021-06-01");
    const targetEnd   = new Date("2022-12-01");
    const duration    = 1800;
    const startTime   = performance.now();

    function frame(now: number) {
      const t = Math.min((now - startTime) / duration, 1);
      const e = easeInOutCubic(t);
      setWindowStart(new Date(fromStart + e * (targetStart.getTime() - fromStart)));
      setWindowEnd  (new Date(fromEnd   + e * (targetEnd.getTime()   - fromEnd)));
      introFrame.current = t < 1 ? requestAnimationFrame(frame) : null;
    }

    introFrame.current = requestAnimationFrame(frame);
  }, []);

  // Intro zoom: once events load, animate from full extent → 1-year target window
  const hasAnimated = useRef(false);
  useEffect(() => {
    if (hasAnimated.current || events.length === 0) return;
    hasAnimated.current = true;
    runIntroAnimation(fullStart.getTime(), fullEnd.getTime());
  }, [events.length, fullStart, fullEnd, runIntroAnimation]);

  const effectiveWindowStart = windowStart ?? fullStart;
  const effectiveWindowEnd = windowEnd ?? fullEnd;

  const preSearchWindow = useRef<{ start: Date | null; end: Date | null } | null>(null);
  const currentWindow = useRef({ start: windowStart, end: windowEnd });
  currentWindow.current = { start: windowStart, end: windowEnd };
  useEffect(() => {
    setSelectedEventId(null);
    setGroupedEventIds(null);
    setReturnGroupIds(null);
    if (!isSearching) {
      if (preSearchWindow.current) {
        setWindowStart(preSearchWindow.current.start);
        setWindowEnd(preSearchWindow.current.end);
        preSearchWindow.current = null;
      }
      return;
    }
    if (introFrame.current !== null) { cancelAnimationFrame(introFrame.current); introFrame.current = null; }
    preSearchWindow.current ??= currentWindow.current;
    const dates = searchEvents.flatMap(event => [visualStartDate(event), visualEndDate(event)])
      .filter((date): date is string => Boolean(date))
      .map(date => parseDate(date).getTime()).filter(Number.isFinite);
    if (dates.length) {
      const start = Math.min(...dates), end = Math.max(...dates);
      const padding = Math.max((end - start) * 0.06, 14 * 86_400_000);
      setWindowStart(new Date(start - padding));
      setWindowEnd(new Date(end + padding));
    }
  }, [isSearching, searchEvents]);

  // Keep ref in sync so the width-change handler always reads the latest window
  effectiveWindowRef.current = { start: effectiveWindowStart, end: effectiveWindowEnd };

  function handleTimelineWidthChange(newWidth: number) {
    const prev = prevTimelineWidthRef.current;
    prevTimelineWidthRef.current = newWidth;
    if (isSearching || prev < 160 || newWidth < 160 || prev === newWidth) return;
    const win = effectiveWindowRef.current;
    if (!win) return;
    const ratio = newWidth / prev;
    const center = (win.start.getTime() + win.end.getTime()) / 2;
    const halfDuration = ((win.end.getTime() - win.start.getTime()) / 2) * ratio;
    setWindowStart(new Date(center - halfDuration));
    setWindowEnd(new Date(center + halfDuration));
  }

  // Auto visibility percentage changes continuously as the date window changes.
  const windowDays = (effectiveWindowEnd.getTime() - effectiveWindowStart.getTime()) / 86_400_000;
  // Show a little more detail when fewer jurisdictions are active.
  const regionBonus = Math.floor(Math.log2(8 / Math.max(activeRegions.size, 1)));
  const autoVisibilityPercent = Math.min(continuousVisibilityPercent(windowDays) + regionBonus * 10, 100);

  const effectiveUnstackBars = unstackBars || (autoUnstackEnabled && windowDays < 180);

  const effectiveVisibilityPercent = manualVisibilityPercent ?? autoVisibilityPercent;

  // Group filteredEvents by their deduplication key (same key used in Timeline).
  // Source visibility levels still define priority, while the percentage slider
  // selects a gradual share of records. Stacked records remain together.
  const visibleEvents = useMemo(() => {
    if (isSearching) return searchEvents;
    const groups = new Map<string, typeof filteredEvents>();
    for (const e of filteredEvents) {
      const k = timelineGroupKey(e);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(e);
    }
    const groupRows = [...groups.entries()].map(([key, group]) => ({
      key,
      group,
      priority: Math.min(...group.map(event => event.visibility_level)),
      longestSpan: Math.max(...group.map(event => {
        const start = parseDate(visualStartDate(event)).getTime();
        const endValue = visualEndDate(event);
        const end = endValue ? parseDate(endValue).getTime() : start;
        return Number.isFinite(start) && Number.isFinite(end) ? Math.max(end - start, 0) : 0;
      })),
    })).sort((a, b) =>
      a.priority - b.priority || b.longestSpan - a.longestSpan || a.key.localeCompare(b.key));

    const targetCount = Math.max(1, Math.round(
      filteredEvents.length * Math.max(10, Math.min(100, effectiveVisibilityPercent)) / 100,
    ));
    const selectedKeys = new Set<string>();
    let selectedCount = 0;
    for (const row of groupRows) {
      if (selectedCount >= targetCount) break;
      selectedKeys.add(row.key);
      selectedCount += row.group.length;
    }
    return filteredEvents.filter(event => selectedKeys.has(timelineGroupKey(event)));
  }, [filteredEvents, effectiveVisibilityPercent, isSearching, searchEvents]);

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
          {isSearching ? <><span className="font-semibold text-gray-600">{searchResults.length}</span> matching records</> : <>
            Showing <span className="font-semibold text-gray-600">{visibleEvents.length}</span> of{" "}
            <span className="font-semibold text-gray-600">{events.length}</span> dated mandates
          </>} · <span className="font-semibold text-gray-600">{totalRecords}</span> records total
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
                nameQuery={nameQuery}
                targetQuery={targetQuery}
                onNameQueryChange={setNameQuery}
                onTargetQueryChange={setTargetQuery}
                searchResults={searchResults}
                isSearching={isSearching}
                windowStart={effectiveWindowStart}
                windowEnd={effectiveWindowEnd}
                fullStart={fullStart}
                fullEnd={fullEnd}
                onWindowChange={(start, end) => { setWindowStart(start); setWindowEnd(end); }}
                autoVisibilityPercent={autoVisibilityPercent}
                manualVisibilityPercent={manualVisibilityPercent}
                onVisibilityPercentChange={setManualVisibilityPercent}
                showOngoingTail={showOngoingTail}
                ongoingCount={events.filter(hasOngoingSegment).length}
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
            activeRegions={timelineRegions}
            onEventClick={handleEventClick}
            onEventDoubleClick={handleEventDoubleClick}
            onGroupClick={handleGroupClick}
            windowStart={effectiveWindowStart}
            windowEnd={effectiveWindowEnd}
            fullStart={fullStart}
            fullEnd={fullEnd}
            onWindowChange={(start, end) => { setWindowStart(start); setWindowEnd(end); }}
            onWidthChange={handleTimelineWidthChange}
            selectedEventId={selectedEventId}
            unstackBars={effectiveUnstackBars}
            showOngoingTail={showOngoingTail}
            tooltipTransparent={tooltipTransparent}
            notableEvents={notableEvents.filter(e => activeNotableEventIds.has(e.id))}
            showNotableLabels={showNotableLabels}
          />
          <Minimap
            events={isSearching ? searchEvents : events}
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
                events={isSearching ? searchEvents : events}
                fetchDetail={fetchDetail}
                onClose={() => { setSelectedEventId(null); setGroupedEventIds(null); setReturnGroupIds(null); }}
                onSelectFromGroup={handleSelectFromGroup}
                onBackToGroup={returnGroupIds ? handleBackToGroup : undefined}
                dateNotice={{
                  hiddenRecords: dateIssueRecords,
                }}
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
          events={isSearching ? searchEvents : events}
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
                Scroll up over the timeline to zoom in and scroll down to zoom out; when a mandate is selected, zooming stays centred on it. Hold the middle mouse button and drag left or right to pan the timeline directly, or use the minimap at the bottom. Click any mandate bar to open its detail panel on the right. The filter bar lets you narrow by jurisdiction and mandate type. Double-click a bar to isolate that jurisdiction. Search by Name or Target to find matching policies across the full dataset, including boosters. Both search fields support partial words and small spelling errors; when both are filled, a record must match both. Clear both fields to restore your previous view.
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
