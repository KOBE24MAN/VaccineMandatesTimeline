import { tsvParseRows } from "d3";
import { ALL_REGIONS, MANDATE_FIELDS } from "../types/event";
import type {
  DateField,
  EventIndex,
  MandateRecord,
  Region,
  TimelineSegment,
} from "../types/event";

export function validDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

/** RFC-style quoted TSV, including escaped quotes, tabs and physical newlines. */
export function parseMandates(text: string): MandateRecord[] {
  const rows = tsvParseRows(text.replace(/^\uFEFF/, ""));
  if (!rows.length) throw new Error("The mandate data file is empty.");
  const headers = rows[0].map((header) => header.trim());
  const missing = MANDATE_FIELDS.filter(([field]) => !headers.includes(field));
  if (missing.length)
    throw new Error(
      `Missing data columns: ${missing.map(([field]) => field).join(", ")}.`,
    );
  if (new Set(headers).size !== headers.length)
    throw new Error("The data file contains duplicate column names.");
  const seen = new Set<string>();
  const records = rows
    .slice(1)
    .filter((row) => row.some((value) => value.trim()))
    .map((row, index) => {
      if (row.length !== headers.length)
        throw new Error(
          `Data row ${index + 2} has ${row.length} columns; expected ${headers.length}.`,
        );
      const record = Object.fromEntries(
        MANDATE_FIELDS.map(([field]) => [
          field,
          row[headers.indexOf(field)].replace(/\\r\\n|\\n|\\r/g, "\n").trim(),
        ]),
      ) as MandateRecord;
      if (!record.id || seen.has(record.id))
        throw new Error(`Missing or duplicate mandate ID in row ${index + 2}.`);
      if (!(ALL_REGIONS as string[]).includes(record.jurisdiction))
        throw new Error(
          `Unknown jurisdiction for mandate ${record.id}: ${record.jurisdiction}.`,
        );
      seen.add(record.id);
      return record;
    });
  if (!records.length)
    throw new Error("The mandate data file contains no records.");
  return records;
}

export function originalSegments(record: MandateRecord): TimelineSegment[] {
  const result: TimelineSegment[] = [];
  // An announcement is an independent point: it must never replace the effective date.
  if (validDate(record.announcement_date))
    result.push({
      kind: "announcement",
      start: record.announcement_date,
      end: record.announcement_date,
      recordId: record.id,
    });
  if (
    validDate(record.effective_date) &&
    validDate(record.removal_date) &&
    record.effective_date <= record.removal_date
  ) {
    result.push({
      kind: "active",
      start: record.effective_date,
      end: record.removal_date,
      recordId: record.id,
    });
  }
  return result;
}

export function buildEvents(records: MandateRecord[]): {
  events: EventIndex[];
  allEvents: EventIndex[];
  warnings: string[];
} {
  const byId = new Map(records.map((record) => [record.id, record]));
  const parents = new Map<string, string[]>();
  const warnings: string[] = [];
  for (const record of records) {
    if (!record.booster_id) continue;
    if (record.booster_id === record.id || !byId.has(record.booster_id)) {
      warnings.push(
        `Mandate ${record.id} refers to unavailable booster ${record.booster_id}.`,
      );
      continue;
    }
    parents.set(record.booster_id, [
      ...(parents.get(record.booster_id) ?? []),
      record.id,
    ]);
  }
  // Reject cycles rather than silently removing an entire linked group.
  for (const record of records) {
    const visited = new Set<string>();
    let current: MandateRecord | undefined = record;
    while (
      current?.booster_id &&
      byId.has(current.booster_id) &&
      current.booster_id !== current.id
    ) {
      if (visited.has(current.id))
        throw new Error(`Cyclic booster link involving mandate ${current.id}.`);
      visited.add(current.id);
      current = byId.get(current.booster_id);
    }
  }
  const allEvents = records.map((record) => {
    const isBooster = parents.has(record.id);
    const segments = isBooster ? [] : originalSegments(record);
    const linked =
      record.booster_id !== record.id ? byId.get(record.booster_id) : undefined;
    const boosterIds: string[] = [];
    let booster = isBooster ? record : linked;
    while (booster) {
      if (booster.id !== record.id) boosterIds.push(booster.id);
      if (
        validDate(booster.enforcement_date) &&
        validDate(booster.removal_date) &&
        booster.enforcement_date <= booster.removal_date
      ) {
        segments.push({
          kind: "booster",
          start: booster.enforcement_date,
          end: booster.removal_date,
          recordId: booster.id,
        });
      }
      booster =
        booster.booster_id && booster.booster_id !== booster.id
          ? byId.get(booster.booster_id)
          : undefined;
    }
    for (const field of [
      "announcement_date",
      "effective_date",
      "enforcement_date",
      "removal_date",
    ] as const) {
      if (record[field] && !validDate(record[field]))
        warnings.push(
          `Mandate ${record.id} has an invalid ${field}; that date is not drawn.`,
        );
    }
    const intervalStart = isBooster
      ? record.enforcement_date
      : record.effective_date;
    if (
      validDate(intervalStart) &&
      validDate(record.removal_date) &&
      intervalStart > record.removal_date
    )
      warnings.push(
        `Mandate ${record.id} ends before its start; that interval is not drawn.`,
      );
    const dates = segments
      .flatMap((segment) => [segment.start, segment.end])
      .sort();
    return {
      id: record.id,
      title: record.name || record.id,
      region: record.jurisdiction as Region,
      type: record.type,
      types: record.type
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      target: record.target || null,
      short_description: null,
      record,
      start_date: dates[0] ?? "",
      end_date: dates[dates.length - 1] ?? null,
      enforcement_date: record.enforcement_date || null,
      visibility_level: 1,
      ongoing: false,
      date_uncertain: false,
      isBooster,
      parentIds: parents.get(record.id) ?? [],
      boosterIds,
      segments,
    };
  });
  return {
    events: allEvents.filter((event) => !event.isBooster),
    allEvents,
    warnings,
  };
}

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
function editDistance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        next[j - 1] + 1,
        row[j] + 1,
        row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    row = next;
  }
  return row[b.length];
}
/** Case-insensitive partial name matching, ranked with a small typo tolerance. */
export function searchMandates(
  events: EventIndex[],
  query: string,
): EventIndex[] {
  const normalized = normalize(query);
  if (!normalized) return [];
  const terms = normalized.split(" ");
  return events
    .map((event) => {
      const title = normalize(event.title);
      if (event.id === query.trim()) return { event, score: -2 };
      if (title.includes(normalized)) return { event, score: -1 };
      const words = title.split(" ");
      const scores = terms.map((term) => {
        if (words.some((word) => word.includes(term))) return 0;
        if (term.length < 4) return Infinity;
        const distance = Math.min(
          ...words.map((word) => editDistance(term, word)),
        );
        return distance <= (term.length >= 8 ? 2 : 1) ? distance : Infinity;
      });
      return { event, score: scores.reduce((sum, score) => sum + score, 0) };
    })
    .filter((result) => Number.isFinite(result.score))
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.event.title.localeCompare(b.event.title) ||
        a.event.id.localeCompare(b.event.id, undefined, { numeric: true }),
    )
    .map((result) => result.event);
}

export function eventMatches(
  event: EventIndex,
  regions: Set<Region>,
  types: Set<string>,
): boolean {
  return (
    regions.has(event.region) && event.types.some((type) => types.has(type))
  );
}

export function matchesDateWindow(
  event: EventIndex,
  field: DateField,
  start: string,
  end: string,
): boolean {
  if (!field) return true;
  const date = event.record[field];
  return validDate(date) && date >= start && date <= end;
}
