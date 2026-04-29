import type { EventIndex, Region } from "../types/event";
import { parseDate } from "./dates";

export interface MergedBand {
  region: Region;
  start_date: string;
  end_date: string;
  /** IDs of all events merged into this band */
  eventIds: string[];
}

/**
 * In overview mode (window > 3 years), events in the same region are
 * merged into contiguous bands. Type is ignored when merging — only
 * region matters, per the CLAUDE.md architecture spec.
 *
 * Events must be sorted by start_date before calling this.
 */
export function mergeByRegion(events: EventIndex[]): MergedBand[] {
  const byRegion = new Map<Region, EventIndex[]>();

  for (const event of events) {
    const list = byRegion.get(event.region) ?? [];
    list.push(event);
    byRegion.set(event.region, list);
  }

  const bands: MergedBand[] = [];

  for (const [region, regionEvents] of byRegion.entries()) {
    const sorted = [...regionEvents].sort(
      (a, b) =>
        parseDate(a.start_date).getTime() - parseDate(b.start_date).getTime()
    );

    let currentBand: MergedBand | null = null;

    for (const event of sorted) {
      const eventEnd = event.end_date ?? event.start_date;

      if (!currentBand) {
        currentBand = {
          region,
          start_date: event.start_date,
          end_date: eventEnd,
          eventIds: [event.id],
        };
        continue;
      }

      const bandEnd = parseDate(currentBand.end_date);
      const eventStart = parseDate(event.start_date);

      if (eventStart <= bandEnd) {
        // Overlapping or adjacent — extend the current band
        if (parseDate(eventEnd) > bandEnd) {
          currentBand.end_date = eventEnd;
        }
        currentBand.eventIds.push(event.id);
      } else {
        // Gap — close band and start a new one
        bands.push(currentBand);
        currentBand = {
          region,
          start_date: event.start_date,
          end_date: eventEnd,
          eventIds: [event.id],
        };
      }
    }

    if (currentBand) bands.push(currentBand);
  }

  return bands;
}
