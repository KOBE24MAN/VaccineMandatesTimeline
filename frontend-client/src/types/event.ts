export type Region = "WA" | "NT" | "QLD" | "NSW" | "VIC" | "TAS" | "SA" | "ACT";

export type EventType = string;

export interface BoosterOverlay {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  ongoing: boolean;
}

/** Slim record derived from the bundled CSV — used for timeline rendering */
export interface EventIndex {
  id: string;
  title: string;
  start_date: string; // ISO date string: "YYYY-MM-DD"
  effective_date?: string | null; // Preserve missing effective dates instead of inventing one from enforcement.
  end_date: string | null;
  announcement_date: string | null;
  enforcement_date: string | null;
  booster: BoosterOverlay | null;
  region: Region;
  type: EventType;
  short_description: string | null;
  target: string | null;
  visibility_level: number; // 1 (most prominent) – 6 (most detailed)
  date_uncertain: boolean;
  ongoing: boolean;
}

/** Full local record — shown in EventDetail panel */
export interface EventDetail extends EventIndex {
  ref_code: string | null;
  ref_no: string | null;
  target: string | null;
  authority: string | null;
  compliance: string | null;
  exemptions: string | null;
  enforcement_measures: string | null;
  executive_orders: string | null;
  removal_method: string | null;
  removal_details: string | null;
  mandate_communications: string | null;
  communications: string | null;
  vaccine_eligibility_info: string | null;
  vaccine_availability_info: string | null;
  ATAGI: string | null;
  uptake: string | null;
  popu_info: string | null;
  notes: string | null;
  source: string | null;
  enforcement_date: string | null;
  date_uncertain: boolean;
}

export const ALL_REGIONS: Region[] = [
  "WA", "NT", "QLD", "NSW", "VIC", "TAS", "SA", "ACT",
];

export const ALL_EVENT_TYPES: EventType[] = [
  "Employment",
  "Public Space",
  "Travel",
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

export interface NotableEvent {
  id: number;
  event_date: string;
  date_end: string | null;
  date_approximate: boolean;
  title: string;
  description: string | null;
  source: string | null;
  /** Resolved display date — midpoint for approximate ranged events */
  display_date: string;
}
