import { useState, useMemo } from "react";
import type { EventIndex, Region, EventType } from "../types/event";
import { ALL_REGIONS, ALL_EVENT_TYPES } from "../types/event";

/** Normal browsing filters are preserved while a full-dataset search is active. */
export function useFilters(events: EventIndex[]) {
  const [activeRegions, setActiveRegions] = useState<Set<Region>>(new Set(ALL_REGIONS));
  const [activeTypes, setActiveTypes] = useState<Set<EventType>>(new Set(ALL_EVENT_TYPES));
  const filteredEvents = useMemo(() => events.filter(event =>
    activeRegions.has(event.region) && event.type.split(",").some(type => activeTypes.has(type.trim()))
  ), [events, activeRegions, activeTypes]);
  function toggleRegion(region: Region) {
    setActiveRegions(previous => {
      const next = new Set(previous);
      next.has(region) ? next.delete(region) : next.add(region);
      return next;
    });
  }
  function toggleType(type: EventType) {
    setActiveTypes(previous => {
      const next = new Set(previous);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  }
  return {
    activeRegions, activeTypes, filteredEvents, toggleRegion, toggleType,
    selectAllRegions: () => setActiveRegions(new Set(ALL_REGIONS)),
    clearAllRegions: () => setActiveRegions(new Set()),
    selectAllTypes: () => setActiveTypes(new Set(ALL_EVENT_TYPES)),
    clearAllTypes: () => setActiveTypes(new Set()),
    isolateRegion: (region: Region) => setActiveRegions(new Set([region])),
  };
}
