import { useState, useEffect, useCallback } from "react";
import type { EventIndex, EventDetail, Region, EventType } from "../types/event";
import { loadMandates, loadMandate } from "../data/store";
import type { Mandate } from "../data/dataset";

export interface DateIssueRecord {
  record: Mandate;
  reason: string;
}

interface UseEventsReturn {
  events: EventIndex[];
  allRecords: Mandate[];
  dateIssueRecords: DateIssueRecord[];
  totalRecords: number;
  loading: boolean;
  error: string | null;
  fetchDetail: (id: string) => Promise<EventDetail>;
}

function validDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export function mandateDateIssueReason(m: Mandate): string | null {
  const startDate = m.effective_date ?? m.enforcement_date;
  const start = validDate(startDate);
  const removal = validDate(m.removal_date);

  if (!startDate) return "Missing effective or enforcement date";
  if (start === null) return "Invalid effective or enforcement date";
  if (m.removal_date && removal === null) return "Invalid removal date";
  if (m.duration_days === null) return "Duration days is empty";
  if (m.duration_days < 0) return "Duration days is negative";
  if (removal !== null && removal < start) return "Removal date is before effective/enforcement date";
  return null;
}

export function isMandateDisplayable(m: Mandate): boolean {
  return [m.effective_date, m.enforcement_date, m.announcement_date, m.removal_date]
    .some(value => validDate(value) !== null);
}

export function mapToIndex(m: Mandate, mandatesById: Map<string, Mandate>): EventIndex {
  const booster = m.booster_id ? mandatesById.get(m.booster_id) : undefined;
  const displayableBooster = booster && isMandateDisplayable(booster) ? booster : undefined;
  const boosterOverlay = displayableBooster?.enforcement_date && (displayableBooster.removal_date || displayableBooster.ongoing)
    ? {
        id: displayableBooster.id,
        title: displayableBooster.name ?? displayableBooster.id,
        start_date: displayableBooster.enforcement_date,
        end_date: displayableBooster.removal_date,
        ongoing: displayableBooster.ongoing,
      }
    : null;

  return {
    id: m.id,
    title: m.name ?? m.id,
    // Records with only a removal date remain visible as a minimum-width point bar.
    start_date: m.effective_date ?? m.enforcement_date ?? m.announcement_date ?? m.removal_date ?? "",
    effective_date: m.effective_date,
    end_date: m.removal_date ?? null,
    announcement_date: m.announcement_date ?? null,
    enforcement_date: m.enforcement_date ?? null,
    booster: boosterOverlay,
    record: m,
    boosterRecord: displayableBooster,
    region: m.jurisdiction as Region,
    type: (m.type as EventType) ?? "Employment",
    short_description: m.target_category,
    target: m.target ?? null,
    visibility_level: m.visibility_level ?? 6,
    date_uncertain: m.date_uncertain,
    ongoing: m.ongoing,
  };
}

export function mapToDetail(m: Mandate, mandatesById: Map<string, Mandate>): EventDetail {
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
 * Loads CSV records once and preserves the existing timeline mapping.
 * Filtering, search and detail lookup all run in the browser.
 */
export function useEvents(): UseEventsReturn {
  const [events, setEvents] = useState<EventIndex[]>([]);
  const [allRecords, setAllRecords] = useState<Mandate[]>([]);
  const [dateIssueRecords, setDateIssueRecords] = useState<DateIssueRecord[]>([]);
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
          setAllRecords(mandates);
          setDateIssueRecords(mandates.flatMap(record => {
            const reason = mandateDateIssueReason(record);
            return reason ? [{ record, reason }] : [];
          }));
          setEvents(mandates
            .filter(m => !boosterIds.has(m.id))
            .filter(isMandateDisplayable)
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

  const fetchDetail = useCallback(async (id: string): Promise<EventDetail> => {
    const mandates = await loadMandates();
    const mandatesById = new Map(mandates.map(m => [m.id, m]));
    const data = mandatesById.get(id) ?? await loadMandate(id);
    return mapToDetail(data, mandatesById);
  }, []);

  return { events, allRecords, dateIssueRecords, totalRecords, loading, error, fetchDetail };
}
