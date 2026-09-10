export type Region = "WA" | "NT" | "QLD" | "NSW" | "VIC" | "TAS" | "SA" | "ACT";
export type EventType = string;
export const ALL_REGIONS: Region[] = [
  "WA",
  "NT",
  "QLD",
  "NSW",
  "VIC",
  "TAS",
  "SA",
  "ACT",
];
export const ALL_EVENT_TYPES = ["Employment", "Public Space", "Travel"];
export const ALL_CATEGORIES = [
  "aged_care",
  "construction",
  "education",
  "emergency",
  "healthcare",
  "mining",
  "public_service",
  "public_space",
  "quarantine",
  "transport",
  "travel",
  "other",
] as const;
export type Category = (typeof ALL_CATEGORIES)[number];

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
] as const;
export type MandateField = (typeof MANDATE_FIELDS)[number][0];
export type MandateRecord = Record<MandateField, string>;
export interface TimelineSegment {
  kind: "announcement" | "active" | "booster";
  start: string;
  end: string;
  recordId: string;
}
export interface EventIndex {
  id: string;
  title: string;
  region: Region;
  type: string;
  target: string | null;
  short_description: string | null;
  /** Extent of actual rendered segments, including linked boosters. Empty if none. */
  start_date: string;
  end_date: string | null;
  enforcement_date: string | null;
  visibility_level: number;
  ongoing: boolean;
  date_uncertain: boolean;
  record: MandateRecord;
  types: string[];
  segments: TimelineSegment[];
  boosterIds: string[];
  parentIds: string[];
  isBooster: boolean;
}
export type EventDetail = EventIndex;
export interface NotableEvent {
  id: number;
  event_date: string;
  date_end: string | null;
  date_approximate: boolean;
  title: string;
  description: string | null;
  source: string | null;
  display_date: string;
}

export type DateField =
  | ""
  | "announcement_date"
  | "effective_date"
  | "enforcement_date"
  | "removal_date";
