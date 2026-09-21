import type { Mandate } from "../data/dataset";
import type { EventIndex } from "../types/event";

export type MandateRecord = Partial<Mandate> & Pick<Mandate, "id">;

export const MANDATE_FIELDS = [
  ["id", "Mandates ID"],
  ["jurisdiction", "Jurisdiction"],
  ["name", "Name/Version"],
  ["type", "Type"],
  ["target", "Policy Target"],
  ["announcement_date", "Announcement Date"],
  ["effective_date", "Publish/Effective Date"],
  ["enforcement_date", "Enforcement Date"],
  ["removal_date", "Removal Date"],
  ["removal_method", "Removal Method"],
  ["removal_details", "Removal Details"],
  ["booster_id", "Booster ID"],
  ["duration_days", "Duration Days"],
  ["compliance", "Mandate Compliance Requirements"],
  ["exemptions", "Exemptions and Conditions"],
  ["executive_orders", "Executive Orders"],
  ["enforcement_measures", "Enforcement/Noncompliance Measures"],
  ["authority", "Authority Issuing the Mandate"],
  ["communications", "Mandate Communications"],
  ["vaccine_eligibility_info", "Vaccine Eligibility Info"],
  ["vaccine_availability_info", "Vaccine Availability Info"],
  ["ATAGI", "ATAGI Recommendations"],
  ["uptake", "Vaccine Uptake"],
  ["popu_info", "Population Affected"],
  ["notes", "Additional Notes"],
  ["source", "Type of Source"],
  ["ref_code", "Ref. Code"],
  ["ref_no", "Ref. No."],
] as const satisfies readonly (readonly [keyof Mandate, string])[];

export function mandateHeading(id: string, name: string | null | undefined): string {
  return `(ID:${id}) ${name || "Unnamed mandate"}`;
}

export function mandateFields(record: MandateRecord) {
  return MANDATE_FIELDS.flatMap(([key, label]) => {
    const value = key === "communications"
      ? record.communications ?? record.mandate_communications
      : record[key];
    if (value === null || value === undefined || String(value).trim() === "") return [];
    return [{ key, label, value: String(value).replace(/\\n/g, "\n") }];
  });
}

// Source records retain every CSV field. The fallback also supports older callers
// that have only the timeline index, without substituting enforcement for effective.
export function eventRecord(event: EventIndex): MandateRecord {
  return event.record ?? {
    ...event,
    name: event.title,
    jurisdiction: event.region,
    effective_date: event.effective_date === undefined ? event.start_date : event.effective_date,
    removal_date: event.end_date,
    booster_id: event.booster?.id ?? null,
  };
}

export function linkedBoosterRecord(event: EventIndex): MandateRecord | null {
  if (event.boosterRecord) return event.boosterRecord;
  if (!event.booster) return null;
  return {
    id: event.booster.id,
    name: event.booster.title,
    jurisdiction: event.region,
    enforcement_date: event.booster.start_date,
    removal_date: event.booster.end_date,
  };
}
