import type { Mandate } from "../data/dataset";
import { isMandateDisplayable, mapToIndex } from "../hooks/useEvents";
import type { EventIndex } from "../types/event";

/** Keep linked boosters combined, but make a booster-only match visible too. */
export function searchTimelineEvents(matches: readonly Mandate[], allRecords: readonly Mandate[]): EventIndex[] {
  const byId = new Map(allRecords.map(record => [record.id, record]));
  const boosterIds = new Set(allRecords.map(record => record.booster_id).filter(Boolean));
  const displayableMatches = matches.filter(isMandateDisplayable);
  const embeddedIds = new Set(displayableMatches.map(record => record.booster_id).filter(Boolean));
  return displayableMatches.filter(record => !embeddedIds.has(record.id)).map(record => {
    const event = mapToIndex(record, byId);
    if (!boosterIds.has(record.id)) return event;
    // A booster search result represents its enforcement interval, not an original mandate phase.
    return { ...event, start_date: record.enforcement_date ?? "",
      effective_date: null, announcement_date: null, enforcement_date: null };
  });
}