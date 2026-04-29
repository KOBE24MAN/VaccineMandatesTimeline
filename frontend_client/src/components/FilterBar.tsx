import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Region, EventType, Category } from "../types/event";
import { ALL_REGIONS, ALL_EVENT_TYPES, ALL_CATEGORIES } from "../types/event";
import { REGION_COLOR } from "./Timeline";

interface Props {
  activeRegions: Set<Region>;
  activeTypes: Set<EventType>;
  onToggleRegion: (region: Region) => void;
  onToggleType: (type: EventType) => void;
  onSelectAllRegions: () => void;
  onClearAllRegions: () => void;
  onSelectAllTypes: () => void;
  onClearAllTypes: () => void;
  activeCategories: Set<Category>;
  onToggleCategory: (cat: Category) => void;
  onSelectAllCategories: () => void;
  onClearAllCategories: () => void;
  windowStart: Date;
  windowEnd: Date;
  fullStart: Date;
  fullEnd: Date;
  onWindowChange: (start: Date, end: Date) => void;
  autoVisibilityLevel: number;
  manualVisibilityLevel: number | null;
  onVisibilityLevelChange: (level: number | null) => void;
}

function toInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function FilterBar({
  activeRegions,
  activeTypes,
  onToggleRegion,
  onToggleType,
  onSelectAllRegions,
  onClearAllRegions,
  onSelectAllTypes,
  onClearAllTypes,
  activeCategories,
  onToggleCategory,
  onSelectAllCategories,
  onClearAllCategories,
  windowStart,
  windowEnd,
  fullStart,
  fullEnd,
  onWindowChange,
  autoVisibilityLevel,
  manualVisibilityLevel,
  onVisibilityLevelChange,
}: Props) {
  const [categoryMode, setCategoryMode] = useState(false);

  function enterCategoryMode() {
    onClearAllTypes();
    setCategoryMode(true);
  }

  function exitCategoryMode() {
    onSelectAllTypes();
    onSelectAllCategories();
    setCategoryMode(false);
  }

  const slideVariants = {
    hidden: { height: 0, opacity: 0 },
    visible: { height: "auto", opacity: 1, transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] } },
    exit:   { height: 0, opacity: 0,    transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } },
  };

  return (
    <div className="flex flex-col gap-5 p-4">
      <p className="text-center text-base font-bold text-gray-800 mt-1">Filter bar</p>

      {/* Date window */}
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Timeline window</p>
        <div className="flex flex-col gap-1.5">
          <input
            type="date"
            value={toInputValue(windowStart)}
            min={toInputValue(fullStart)}
            max={toInputValue(windowEnd)}
            onChange={e => {
              const d = new Date(e.target.value + "T12:00:00Z");
              if (!isNaN(d.getTime()) && d < windowEnd) onWindowChange(d, windowEnd);
            }}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-gray-700"
          />
          <span className="text-center text-xs text-gray-400">to</span>
          <input
            type="date"
            value={toInputValue(windowEnd)}
            min={toInputValue(windowStart)}
            max={toInputValue(fullEnd)}
            onChange={e => {
              const d = new Date(e.target.value + "T12:00:00Z");
              if (!isNaN(d.getTime()) && d > windowStart) onWindowChange(windowStart, d);
            }}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-gray-700"
          />
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2 items-center">
          <button
            onClick={() => onWindowChange(fullStart, fullEnd)}
            className="text-xs text-blue-500 hover:underline"
          >
            Reset
          </button>
          <span className="text-gray-300">|</span>
          {([["3M", 3], ["6M", 6], ["1Y", 12], ["2Y", 24], ["3Y", 36]] as [string, number][]).map(([label, months]) => (
            <button
              key={label}
              onClick={() => {
                const center = new Date((windowStart.getTime() + windowEnd.getTime()) / 2);
                const half = (months / 12) * 365.25 * 24 * 60 * 60 * 1000 / 2;
                onWindowChange(new Date(center.getTime() - half), new Date(center.getTime() + half));
              }}
              className="px-2 py-0.5 rounded text-xs border border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Jurisdiction */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Jurisdiction</p>
          <div className="flex gap-2">
            <button onClick={onSelectAllRegions} className="text-xs text-blue-500 hover:underline">All</button>
            <button onClick={onClearAllRegions} className="text-xs text-blue-500 hover:underline">Clear</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ALL_REGIONS.map((region) => {
            const color = REGION_COLOR[region];
            const active = activeRegions.has(region);
            return (
              <button
                key={region}
                onClick={() => onToggleRegion(region)}
                className="px-3 py-1 rounded-full text-sm border transition-colors"
                style={active
                  ? { backgroundColor: color, borderColor: color, color: "#fff" }
                  : { backgroundColor: "#fff", borderColor: "#D1D5DB", color: "#6B7280" }
                }
              >
                {region}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mandate type + category toggle */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Mandate type</p>
          <AnimatePresence initial={false}>
            {!categoryMode && (
              <motion.div
                className="flex gap-2"
                variants={slideVariants} initial="hidden" animate="visible" exit="exit"
              >
                <button onClick={onSelectAllTypes} className="text-xs text-blue-500 hover:underline">All</button>
                <button onClick={onClearAllTypes} className="text-xs text-blue-500 hover:underline">Clear</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Type buttons — hidden in category mode */}
        <AnimatePresence initial={false}>
          {!categoryMode && (
            <motion.div
              className="flex flex-col gap-1.5 overflow-hidden"
              variants={slideVariants} initial="hidden" animate="visible" exit="exit"
            >
              {ALL_EVENT_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => onToggleType(type)}
                  className={`px-3 py-1.5 rounded text-sm border text-left transition-colors ${
                    activeTypes.has(type)
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-500 border-gray-300 hover:border-indigo-400 hover:text-indigo-600"
                  }`}
                >
                  {type}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toggle button */}
        <button
          onClick={categoryMode ? exitCategoryMode : enterCategoryMode}
          className={`mt-2 w-full px-3 py-1.5 rounded text-sm border text-left transition-colors flex items-center justify-between ${
            categoryMode
              ? "bg-indigo-600 text-white border-indigo-600"
              : "bg-white text-gray-500 border-gray-300 hover:border-indigo-400 hover:text-indigo-600"
          }`}
        >
          <span>Filter by category</span>
          <span className="text-xs opacity-70">{categoryMode ? "▲" : "▼"}</span>
        </button>

        {/* Category pills — shown in category mode */}
        <AnimatePresence initial={false}>
          {categoryMode && (
            <motion.div
              className="overflow-hidden"
              variants={slideVariants} initial="hidden" animate="visible" exit="exit"
            >
              <div className="flex items-center justify-between mt-3 mb-2">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Categories</p>
                <div className="flex gap-2">
                  <button onClick={onSelectAllCategories} className="text-xs text-blue-500 hover:underline">All</button>
                  <button onClick={onClearAllCategories} className="text-xs text-blue-500 hover:underline">Clear</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ALL_CATEGORIES.map(cat => {
                  const active = activeCategories.has(cat);
                  const label = cat.replace(/_/g, " ");
                  return (
                    <button
                      key={cat}
                      onClick={() => onToggleCategory(cat)}
                      className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors ${
                        active
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-gray-500 border-gray-300 hover:border-indigo-400 hover:text-indigo-600"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Visibility level */}
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Visibility level</p>
        <select
          value={manualVisibilityLevel ?? "auto"}
          onChange={e => {
            const v = e.target.value;
            onVisibilityLevelChange(v === "auto" ? null : Number(v));
          }}
          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-700 bg-white"
        >
          <option value="auto">Auto (Level {autoVisibilityLevel})</option>
          {[1, 2, 3, 4, 5, 6].map(n => (
            <option key={n} value={n}>Level {n}{n === 1 ? " — fewest" : n === 6 ? " — all" : ""}</option>
          ))}
        </select>
        {manualVisibilityLevel !== null && (
          <button
            onClick={() => onVisibilityLevelChange(null)}
            className="mt-1.5 text-xs text-blue-500 hover:underline"
          >
            Reset to auto
          </button>
        )}
      </div>

      <p className="text-xs text-gray-400 leading-relaxed mt-auto">
        Jurisdiction colours are consistent across the timeline. Use the top bar to hide either panel for a wider view.
      </p>
    </div>
  );
}
