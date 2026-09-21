import type { EventIndex } from "../types/event";

export function visualStartDate(event: EventIndex): string {
  return [event.start_date, event.announcement_date, event.booster?.start_date]
    .filter((date): date is string => Boolean(date)).sort()[0];
}

export function hasOngoingSegment(event: EventIndex): boolean {
  return event.ongoing || Boolean(event.booster?.ongoing);
}

export function visualEndDate(event: EventIndex): string | null {
  if (hasOngoingSegment(event)) return null;
  const dates = [event.end_date, event.booster?.end_date]
    .filter((date): date is string => Boolean(date)).sort();
  return dates[dates.length - 1] ?? null;
}

// Merge only records whose displayed phases are identical.
export function timelineGroupKey(event: EventIndex): string {
  return JSON.stringify([event.title, event.region, event.type, event.start_date,
    event.end_date, event.announcement_date, event.enforcement_date, event.ongoing,
    event.booster?.start_date, event.booster?.end_date, event.booster?.ongoing]);
}
