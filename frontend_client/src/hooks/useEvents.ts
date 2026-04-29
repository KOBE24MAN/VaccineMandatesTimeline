import { useState, useEffect } from "react";
import type { EventIndex, EventDetail, Region, EventType } from "../types/event";

interface UseEventsReturn {
  events: EventIndex[];
  loading: boolean;
  error: string | null;
  fetchDetail: (id: string) => Promise<EventDetail>;
}

interface ApiMandate {
  id: string;
  jurisdiction: string;
  name: string | null;
  type: string | null;
  target: string | null;
  target_category: string | null;
  effective_date: string | null;
  enforcement_date: string | null;
  removal_date: string | null;
  duration_days: number | null;
  date_uncertain: boolean;
  visibility_level: number | null;
}

interface ApiMandateDetail extends ApiMandate {
  target: string | null;
  compliance: string | null;
  exemptions: string | null;
  enforcement_measures: string | null;
  executive_orders: string | null;
  removal_method: string | null;
  removal_details: string | null;
  authority: string | null;
  mandate_communications: string | null;
  ref_code: string | null;
}

function mapToIndex(m: ApiMandate): EventIndex {
  return {
    id: m.id,
    title: m.name ?? m.id,
    start_date: m.effective_date ?? "",
    end_date: m.removal_date ?? null,
    enforcement_date: m.enforcement_date ?? null,
    region: m.jurisdiction as Region,
    type: (m.type as EventType) ?? "Employment",
    short_description: m.target_category,
    target: m.target ?? null,
    visibility_level: m.visibility_level ?? 6,
  };
}

function mapToDetail(m: ApiMandateDetail): EventDetail {
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
 * Fetches the full mandate list once on mount and caches it in memory.
 * All filtering happens client-side on this cached list — no re-fetching
 * when filters change.
 */
export function useEvents(): UseEventsReturn {
  const [events, setEvents] = useState<EventIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/mandates")
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json() as Promise<{ count: number; mandates: ApiMandate[] }>;
      })
      .then(({ mandates }) => {
        if (!cancelled) {
          setEvents(mandates.filter(m => m.effective_date).map(mapToIndex));
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
    const res = await fetch(`/api/mandates/${id}`);
    if (!res.ok) throw new Error(`Failed to load mandate ${id}`);
    const data = await res.json() as ApiMandateDetail;
    return mapToDetail(data);
  }

  return { events, loading, error, fetchDetail };
}
