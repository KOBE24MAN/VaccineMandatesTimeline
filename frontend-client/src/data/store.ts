import notableCsv from "../../data/notable_events.csv?raw";
import { parseMandates, parseNotableEvents, searchDataset, type Mandate } from "./dataset";

// Timeline, search and details share one runtime read of the root CSV.
// Failed requests may be retried without retaining a rejected promise.
let mandates: Promise<Mandate[]> | undefined;
export function loadMandates(): Promise<Mandate[]> {
  return mandates ??= fetch(`${import.meta.env.BASE_URL}vaccine_mandates.csv`, { cache: "no-cache" })
    .then(async response => {
      if (!response.ok) throw new Error(`Could not load mandate data (HTTP ${response.status}).`);
      return parseMandates(await response.text());
    })
    .catch((error: unknown) => {
      mandates = undefined;
      throw error;
    });
}

export async function loadMandate(id: string) {
  const mandate = (await loadMandates()).find(row => row.id === id);
  if (!mandate) throw new Error(`Mandate ${id} not found.`);
  return mandate;
}

export async function searchMandates(query: string) {
  return searchDataset(await loadMandates(), query);
}

export async function loadNotableEvents() {
  return parseNotableEvents(notableCsv);
}
