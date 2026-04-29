import { useState, useMemo } from "react";
import type { EventIndex, Region, EventType, Category } from "../types/event";
import { ALL_REGIONS, ALL_EVENT_TYPES, ALL_CATEGORIES } from "../types/event";

interface UseFiltersReturn {
  activeRegions: Set<Region>;
  activeTypes: Set<EventType>;
  activeCategories: Set<Category>;
  filteredEvents: EventIndex[];
  toggleRegion: (region: Region) => void;
  toggleType: (type: EventType) => void;
  toggleCategory: (cat: Category) => void;
  selectAllRegions: () => void;
  clearAllRegions: () => void;
  selectAllTypes: () => void;
  clearAllTypes: () => void;
  selectAllCategories: () => void;
  clearAllCategories: () => void;
  isolateRegion: (region: Region) => void;
}

/**
 * Manages filter pill state and derives the filtered event list.
 * Uses useMemo so filteredEvents only recalculates when events or
 * filter state actually changes — no backend requests involved.
 */
export function useFilters(events: EventIndex[]): UseFiltersReturn {
  const [activeRegions, setActiveRegions] = useState<Set<Region>>(
    new Set(ALL_REGIONS)
  );
  const [activeTypes, setActiveTypes] = useState<Set<EventType>>(
    new Set(ALL_EVENT_TYPES)
  );
  const [activeCategories, setActiveCategories] = useState<Set<Category>>(
    new Set(ALL_CATEGORIES)
  );

  const filteredEvents = useMemo(() => {
    const allCatsActive = activeCategories.size === ALL_CATEGORIES.length;
    return events.filter(e => {
      if (!activeRegions.has(e.region)) return false;
      const cats = (e.short_description ?? "").split(",").map(s => s.trim()) as Category[];
      const matchesCategory = allCatsActive || cats.some(c => activeCategories.has(c));
      return activeTypes.has(e.type) || matchesCategory;
    });
  }, [events, activeRegions, activeTypes, activeCategories]);

  function toggleRegion(region: Region) {
    setActiveRegions((prev) => {
      const next = new Set(prev);
      next.has(region) ? next.delete(region) : next.add(region);
      return next;
    });
  }

  function toggleType(type: EventType) {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  }

  function toggleCategory(cat: Category) {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  return {
    activeRegions,
    activeTypes,
    activeCategories,
    filteredEvents,
    toggleRegion,
    toggleType,
    toggleCategory,
    selectAllRegions: () => setActiveRegions(new Set(ALL_REGIONS)),
    clearAllRegions: () => setActiveRegions(new Set()),
    selectAllTypes: () => setActiveTypes(new Set(ALL_EVENT_TYPES)),
    clearAllTypes: () => setActiveTypes(new Set()),
    selectAllCategories: () => setActiveCategories(new Set(ALL_CATEGORIES)),
    clearAllCategories: () => setActiveCategories(new Set()),
    isolateRegion: (region: Region) => setActiveRegions(new Set([region])),
  };
}
