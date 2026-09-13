import mandateCsv from "../../vaccine_mandates.csv?raw";
import notableCsv from "../../data/notable_events.csv?raw";
import { parseMandates, parseNotableEvents, searchDataset, type Mandate } from "./dataset";

// Vite bundles these CSV files into the static site. No API or database is used.
let mandates: Mandate[] | undefined;
function getMandates(): Mandate[] {
  return mandates ??= parseMandates(mandateCsv);
}

export async function loadMandates() {
  return getMandates();
}

export async function loadMandate(id: string) {
  const mandate = getMandates().find(row => row.id === id);
  if (!mandate) throw new Error(`Mandate ${id} not found.`);
  return mandate;
}

export async function searchMandates(query: string) {
  return searchDataset(getMandates(), query);
}

export async function loadNotableEvents() {
  return parseNotableEvents(notableCsv);
}
