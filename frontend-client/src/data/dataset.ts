import { csvParse } from "d3";
import { nameMatchScore } from "./nameSearch";
import type { NotableEvent } from "../types/event";

export interface Mandate {
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
  ref_code: string | null;
}

export interface SearchResult {
  id: string;
  jurisdiction: string;
  name: string | null;
  type: string | null;
  snippet: string | null;
}

const textFields = [
  "name", "type", "target", "target_category", "effective_date",
  "enforcement_date", "removal_date", "compliance", "exemptions",
  "enforcement_measures", "executive_orders", "removal_method",
  "removal_details", "authority", "mandate_communications", "ref_code",
] as const;

function clean(value: string | undefined): string | null {
  return value?.replace(/\r\n?/g, "\n").trim() || null;
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

function readRows(csv: string, required: readonly string[]) {
  const rows = csvParse(csv.replace(/^\uFEFF+/, ""));
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
  const rows = readRows(csv, ["id", "jurisdiction", ...textFields,
    "duration_days", "date_uncertain", "ongoing", "visibility_level"]);
  for (const row of rows) {
    const id = clean(row.id);
    if (!id) continue;
    if (seen.has(id)) throw new Error(`Duplicate mandate ID: ${id}.`);
    seen.add(id);
    const jurisdiction = clean(row.jurisdiction);
    if (!jurisdiction) throw new Error(`Missing jurisdiction for ${id}.`);
    const text = Object.fromEntries(textFields.map(field => [field, clean(row[field])])) as
      Record<typeof textFields[number], string | null>;
    mandates.push({
      ...text, id, jurisdiction,
      duration_days: integer(row.duration_days, `${id}: duration_days`),
      visibility_level: integer(row.visibility_level, `${id}: visibility_level`),
      ongoing: boolean(row.ongoing),
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
