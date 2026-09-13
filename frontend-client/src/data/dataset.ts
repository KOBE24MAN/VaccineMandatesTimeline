import { csvParse, dsvFormat } from "d3";
import { nameMatchScore } from "./nameSearch";
import type { NotableEvent } from "../types/event";

export interface Mandate {
  id: string;
  jurisdiction: string;
  name: string | null;
  type: string | null;
  target: string | null;
  target_category: string | null;
  announcement_date: string | null;
  effective_date: string | null;
  enforcement_date: string | null;
  removal_date: string | null;
  booster_id: string | null;
  duration_days: number | null;
  date_uncertain: boolean;
  ongoing: boolean;
  visibility_level: number | null;
  compliance: string | null;
  exemptions: string | null;
  enforcement_measures: string | null;
  executive_orders: string | null;
  removal_method: string | null;
  removal_details: string | null;
  authority: string | null;
  mandate_communications: string | null;
  communications: string | null;
  vaccine_eligibility_info: string | null;
  vaccine_availability_info: string | null;
  ATAGI: string | null;
  uptake: string | null;
  popu_info: string | null;
  notes: string | null;
  source: string | null;
  ref_code: string | null;
  ref_no: string | null;
}

export interface SearchResult {
  id: string;
  jurisdiction: string;
  name: string | null;
  type: string | null;
  snippet: string | null;
}

const textFields = [
  "name", "type", "target", "target_category", "announcement_date",
  "effective_date", "enforcement_date", "removal_date", "booster_id",
  "compliance", "exemptions",
  "enforcement_measures", "executive_orders", "removal_method",
  "removal_details", "authority", "mandate_communications", "communications",
  "vaccine_eligibility_info", "vaccine_availability_info", "ATAGI", "uptake",
  "popu_info", "notes", "source", "ref_code", "ref_no",
] as const;

function clean(value: string | undefined): string | null {
  return value?.replace(/\r\n?/g, "\n").replace(/\\n/g, "\n").trim() || null;
}

function boolean(value: string | undefined): boolean {
  return ["1", "TRUE", "YES", "Y"].includes((clean(value) ?? "").toUpperCase());
}

function integer(value: string | undefined, field: string): number | null {
  const cleaned = clean(value);
  if (cleaned === null) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid number in ${field}.`);
  return Math.trunc(parsed);
}

// Same duration thresholds as the original backend's derive_visibility.
export function deriveVisibility(duration: number | null): number {
  if (duration === null) return 6;
  return duration >= 365 ? 1 : duration >= 270 ? 2 : duration >= 180 ? 3 :
    duration >= 90 ? 4 : duration >= 30 ? 5 : 6;
}

function readRows(csv: string, required: readonly string[]) {
  const source = csv.replace(/^\uFEFF+/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const rows = firstLine.includes("\t") ? dsvFormat("\t").parse(source) : csvParse(source);
  const missing = required.filter(column => !rows.columns.includes(column));
  if (missing.length) throw new Error(`Data file is missing columns: ${missing.join(", ")}.`);
  return rows;
}

// Match the original SQLite ordering, including records with no start date.
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function parseMandates(csv: string): Mandate[] {
  const seen = new Set<string>();
  const mandates: Mandate[] = [];
  const rows = readRows(csv, ["id", "jurisdiction", "name", "type", "target",
    "effective_date", "enforcement_date", "removal_date", "duration_days"]);
  for (const row of rows) {
    const id = clean(row.id);
    if (!id) continue;
    if (seen.has(id)) throw new Error(`Duplicate mandate ID: ${id}.`);
    seen.add(id);
    const jurisdiction = clean(row.jurisdiction);
    if (!jurisdiction) throw new Error(`Missing jurisdiction for ${id}.`);
    const text = Object.fromEntries(textFields.map(field => [field, clean(row[field])])) as
      Record<typeof textFields[number], string | null>;
    const suppliedLevel = clean(row.visibility_level);
    const level = suppliedLevel === null ? null : Number(suppliedLevel);
    if (level !== null && (!Number.isInteger(level) || level < 1 || level > 6)) {
      throw new Error(`Invalid visibility_level for ${id}: expected 1–6.`);
    }
    const start = text.effective_date ?? text.enforcement_date;
    const calculatedDays = start && text.removal_date
      ? (Date.parse(text.removal_date) - Date.parse(start)) / 86_400_000 : null;
    const duration = integer(row.duration_days, `${id}: duration_days`) ??
      (calculatedDays !== null && Number.isFinite(calculatedDays) ? calculatedDays : null);
    mandates.push({
      ...text, id, jurisdiction,
      duration_days: duration,
      visibility_level: level ?? deriveVisibility(duration),
      ongoing: clean(row.ongoing) === null ? !text.removal_date : boolean(row.ongoing),
      date_uncertain: boolean(row.date_uncertain),
    });
  }
  if (!mandates.length) throw new Error("The mandate data file contains no records.");
  return mandates.sort((a, b) =>
    compare(a.effective_date ?? a.enforcement_date ?? "", b.effective_date ?? b.enforcement_date ?? "") ||
    compare(a.jurisdiction, b.jurisdiction) || compare(a.id, b.id));
}

export function parseNotableEvents(csv: string): Omit<NotableEvent, "display_date">[] {
  const rows = readRows(csv, ["id", "event_date", "date_end", "date_approximate", "title", "description", "source"]);
  const seen = new Set<number>();
  return rows.filter(row => clean(row.id)).map(row => {
    const id = integer(row.id, "notable event ID");
    const event_date = clean(row.event_date);
    const title = clean(row.title);
    if (id === null || !event_date || !title) throw new Error("Incomplete notable event.");
    if (seen.has(id)) throw new Error(`Duplicate notable event ID: ${id}.`);
    seen.add(id);
    return {
      id, event_date, title, date_end: clean(row.date_end),
      date_approximate: boolean(row.date_approximate),
      description: clean(row.description), source: clean(row.source),
    };
  }).sort((a, b) => compare(a.event_date, b.event_date) || a.id - b.id);
}

export function searchDataset(mandates: readonly Mandate[], query: string): SearchResult[] {
  const term = query.trim().toLowerCase();
  if (!term) return [];
  const results: SearchResult[] = [];
  const ranks = new Map<string, number>();
  for (const mandate of mandates) {
    let matched = false;
    for (const field of ["name", "target", "compliance", "executive_orders"] as const) {
      const value = mandate[field];
      const index = value?.toLowerCase().indexOf(term) ?? -1;
      if (value === null || index < 0) continue;
      const start = Math.max(0, index - 40);
      const end = Math.min(value.length, index + term.length + 40);
      results.push({
        id: mandate.id, jurisdiction: mandate.jurisdiction,
        name: mandate.name, type: mandate.type,
        snippet: (start ? "..." : "") + value.slice(start, end) + (end < value.length ? "..." : ""),
      });
      ranks.set(mandate.id, 0);
      matched = true;
      break;
    }
    if (!matched) {
      const score = mandate.id.toLowerCase() === term ? 0 : nameMatchScore(mandate.name ?? "", term);
      if (Number.isFinite(score)) {
        results.push({ id: mandate.id, jurisdiction: mandate.jurisdiction, name: mandate.name,
          type: mandate.type, snippet: mandate.name });
        ranks.set(mandate.id, score + 1);
      }
    }
  }
  const exact = results.filter(result => ranks.get(result.id) === 0);
  const ranked = exact.length ? exact : results;
  return ranked.sort((a, b) => (ranks.get(a.id)! - ranks.get(b.id)!) || compare(a.jurisdiction, b.jurisdiction) || compare(a.id, b.id));
}
