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

export function mapToIndex(m: Mandate, mandatesById: Map<string, Mandate>): EventIndex {
  const booster = m.booster_id ? mandatesById.get(m.booster_id) : undefined;
  const boosterOverlay = booster?.enforcement_date && (booster.removal_date || booster.ongoing)
    ? {
        id: booster.id,
        title: booster.name ?? booster.id,
        start_date: booster.enforcement_date,
        end_date: booster.removal_date,
        ongoing: booster.ongoing,
      }
    : null;

  return {
    id: m.id,
    title: m.name ?? m.id,
    start_date: m.effective_date ?? m.enforcement_date ?? "",
    effective_date: m.effective_date,
    end_date: m.removal_date ?? null,
    announcement_date: m.announcement_date ?? null,
    enforcement_date: m.enforcement_date ?? null,
    booster: boosterOverlay,
    region: m.jurisdiction as Region,
    type: (m.type as EventType) ?? "Employment",
    short_description: m.target_category,
    target: m.target ?? null,
    visibility_level: m.visibility_level ?? 6,
    date_uncertain: m.date_uncertain,
    ongoing: m.ongoing,
  };
}

function mapToDetail(m: Mandate, mandatesById: Map<string, Mandate>): EventDetail {
  return {
    ...mapToIndex(m, mandatesById),
    target: m.target,
    authority: m.authority,
    compliance: m.compliance,
    exemptions: m.exemptions,
    enforcement_measures: m.enforcement_measures,
    executive_orders: m.executive_orders,
    removal_method: m.removal_method,
    removal_details: m.removal_details,
    mandate_communications: m.mandate_communications,
    communications: m.communications,
    vaccine_eligibility_info: m.vaccine_eligibility_info,
    vaccine_availability_info: m.vaccine_availability_info,
    ATAGI: m.ATAGI,
    uptake: m.uptake,
    popu_info: m.popu_info,
    notes: m.notes,
    source: m.source,
    ref_code: m.ref_code,
    ref_no: m.ref_no,
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
          const mandatesById = new Map(mandates.map(m => [m.id, m]));
          const boosterIds = new Set(mandates.map(m => m.booster_id).filter(Boolean));
          setEvents(mandates
            .filter(m => !boosterIds.has(m.id))
            .filter(m => m.effective_date || m.enforcement_date)
            .map(m => mapToIndex(m, mandatesById)));
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
    const mandates = await loadMandates();
    const mandatesById = new Map(mandates.map(m => [m.id, m]));
    const data = mandatesById.get(id) ?? await loadMandate(id);
    return mapToDetail(data, mandatesById);
  }

  return { events, totalRecords, loading, error, fetchDetail };
}
