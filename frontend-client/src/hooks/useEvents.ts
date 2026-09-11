import { useState, useEffect } from "react";
import type { EventIndex, EventDetail, Region, EventType } from "../types/event";
import { loadMandates, loadMandate } from "../data/store";
import type { Mandate } from "../data/dataset";

interface UseEventsReturn {
  events: EventIndex[];
  totalRecords: number;
  loading: boolean;
  error: string | null;
  fetchDetail: (id: string) => Promise<EventDetail>;
}

function mapToIndex(m: Mandate): EventIndex {
  return {
    id: m.id,
    title: m.name ?? m.id,
    start_date: m.effective_date ?? m.enforcement_date ?? "",
    end_date: m.removal_date ?? null,
    enforcement_date: m.enforcement_date ?? null,
    region: m.jurisdiction as Region,
    type: (m.type as EventType) ?? "Employment",
    short_description: m.target_category,
    target: m.target ?? null,
    visibility_level: m.visibility_level ?? 6,
    date_uncertain: m.date_uncertain,
    ongoing: m.ongoing,
  };
}

function mapToDetail(m: Mandate): EventDetail {
  return {
    ...mapToIndex(m),
    target: m.target,
    authority: m.authority,
    compliance: m.compliance,
    exemptions: m.exemptions,
    enforcement_measures: m.enforcement_measures,
    executive_orders: m.executive_orders,
    removal_method: m.removal_method,
    removal_details: m.removal_details,
    mandate_communications: m.mandate_communications,
    ref_code: m.ref_code,
    enforcement_date: m.enforcement_date,
    date_uncertain: m.date_uncertain,
  };
}

/**
 * Reads the bundled CSV data once and preserves the existing timeline mapping.
 * Filtering, search and detail lookup all run in the browser.
 */
export function useEvents(): UseEventsReturn {
  const [events, setEvents] = useState<EventIndex[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadMandates()
      .then((mandates) => {
        if (!cancelled) {
          setEvents(mandates.filter(m => m.effective_date || m.enforcement_date).map(mapToIndex));
          setTotalRecords(mandates.length);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function fetchDetail(id: string): Promise<EventDetail> {
    const data = await loadMandate(id);
    return mapToDetail(data);
  }

  return { events, totalRecords, loading, error, fetchDetail };
}
