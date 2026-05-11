export type Region = "WA" | "NT" | "QLD" | "NSW" | "VIC" | "TAS" | "SA" | "ACT";

export type EventType = "Employment" | "Public Space";

/** Slim record returned by /api/mandates — used for timeline rendering */
export interface EventIndex {
  id: string;
  title: string;
  start_date: string; // ISO date string: "YYYY-MM-DD"
  end_date: string | null;
  enforcement_date: string | null;
  region: Region;
  type: EventType;
  short_description: string | null;
  target: string | null;
  visibility_level: number; // 1 (most prominent) – 6 (most detailed)
  date_uncertain: boolean;
  ongoing: boolean;
}

/** Full record returned by /api/mandates/:id — shown in EventDetail panel */
export interface EventDetail extends EventIndex {
  ref_code: string | null;
  target: string | null;
  authority: string | null;
  compliance: string | null;
  exemptions: string | null;
  enforcement_measures: string | null;
  executive_orders: string | null;
  removal_method: string | null;
  removal_details: string | null;
  mandate_communications: string | null;
  enforcement_date: string | null;
  date_uncertain: boolean;
}

export const ALL_REGIONS: Region[] = [
  "WA", "NT", "QLD", "NSW", "VIC", "TAS", "SA", "ACT",
];

export const ALL_EVENT_TYPES: EventType[] = [
  "Employment",
  "Public Space",
];

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

export type Category = typeof ALL_CATEGORIES[number];
