import { useState, useEffect } from "react";
import type { NotableEvent } from "../types/event";

function resolveDisplayDate(event_date: string, date_end: string | null, date_approximate: boolean): string {
  if (!date_approximate || !date_end) return event_date;
  const start = new Date(event_date + "T12:00:00Z").getTime();
  const end = new Date(date_end + "T12:00:00Z").getTime();
  return new Date((start + end) / 2).toISOString().slice(0, 10);
}

export function useNotableEvents(): NotableEvent[] {
  const [events, setEvents] = useState<NotableEvent[]>([]);

  useEffect(() => {
    fetch("/api/notable-events")
      .then(res => res.json())
      .then((data: Omit<NotableEvent, "display_date">[]) => {
        setEvents(data.map(e => ({
          ...e,
          display_date: resolveDisplayDate(e.event_date, e.date_end, e.date_approximate),
        })));
      })
      .catch(() => {});
  }, []);

  return events;
}
