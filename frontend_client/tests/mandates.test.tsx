import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { tsvFormatRows } from "d3";
import {
  parseMandates,
  buildEvents,
  searchMandates,
  validDate,
  eventMatches,
  matchesDateWindow,
} from "../src/utils/mandates";
import { MANDATE_FIELDS } from "../src/types/event";
import { EventDetail } from "../src/components/EventDetail";
import { Timeline } from "../src/components/Timeline";
import { NOTABLE_EVENTS } from "../src/data/notableEvents";
const records = parseMandates(readFileSync("../vaccine_mandates.csv", "utf8"));
const data = buildEvents(records);
const event = (id: string) => data.allEvents.find((item) => item.id === id)!;
const header = MANDATE_FIELDS.map(([field]) => field);
const serialize = (rows) =>
  tsvFormatRows([
    header,
    ...rows.map((row) => header.map((field) => row[field])),
  ]);

test("real dataset retains all records and suppresses linked boosters as standalone rows", () => {
  assert.equal(records.length, 54);
  assert.equal(data.allEvents.length, 54);
  assert.equal(data.events.length, 48);
  assert.deepEqual(
    data.allEvents
      .filter((item) => item.isBooster)
      .map((item) => item.id)
      .sort(),
    ["37", "38", "43", "46", "48", "52"],
  );
  assert.equal(data.warnings.length, 0);
});
test("quoted TSV preserves tabs, physical newlines, escaped quotes, literal newlines and BOM", () => {
  const record = {
    ...records[0],
    name: 'Policy "A"\twith a tab',
    notes: "Physical\nnewline and literal\\nnewline",
  };
  const parsed = parseMandates("\uFEFF" + serialize([record]))[0];
  assert.equal(parsed.name, record.name);
  assert.equal(parsed.notes, "Physical\nnewline and literal\nnewline");
  assert.ok(records[0].exemptions.includes("\n"));
  assert.ok(!records[0].exemptions.includes("\\n"));
});
test("malformed schema, duplicate IDs and empty data produce useful errors", () => {
  assert.throws(
    () => parseMandates("id\tname\n1\tTest"),
    /Missing data columns/,
  );
  assert.throws(
    () => parseMandates(serialize([records[0], records[0]])),
    /duplicate mandate ID/,
  );
  assert.throws(() => parseMandates(header.join("\t")), /no records/);
  assert.throws(() => parseMandates(header.join("\t") + "\n1\tWA"), /columns/);
});
test("booster extension contributes to original bounds without replacing its recorded removal", () => {
  assert.equal(event("1").end_date, "2022-06-10");
  assert.equal(event("1").record.removal_date, "2022-02-05");
  assert.deepEqual(
    event("1").segments.find((segment) => segment.kind === "booster"),
    { kind: "booster", start: "2022-02-05", end: "2022-06-10", recordId: "43" },
  );
});
test("shared boosters overlay every linked original; original continues after a shorter booster", () => {
  assert.equal(
    data.events.filter((item) => item.boosterIds.includes("48")).length,
    13,
  );
  for (const id of ["6", "36"]) {
    assert.equal(
      event(id).segments.find((segment) => segment.kind === "active")?.end,
      "2022-11-04",
    );
    assert.equal(
      event(id).segments.find((segment) => segment.kind === "booster")?.end,
      "2022-06-10",
    );
  }
});
test("missing dates never fall back to enforcement or fabricate open-ended intervals", () => {
  assert.deepEqual(
    event("7").segments.map((segment) => segment.kind),
    ["announcement", "booster"],
  );
  for (const id of ["16", "54"]) {
    assert.equal(event(id).segments.length, 0);
    assert.equal(event(id).start_date, "");
    assert.ok(
      searchMandates(data.allEvents, id).some((item) => item.id === id),
    );
  }
  const changed = { ...records[0], removal_date: "", booster_id: "" };
  assert.deepEqual(
    buildEvents([changed]).events[0].segments.map((segment) => segment.kind),
    ["announcement"],
  );
});
test("late announcement is an independent marker rather than a negative interval", () => {
  const segments = event("6").segments;
  assert.equal(
    segments.find((segment) => segment.kind === "announcement")?.start,
    "2021-09-21",
  );
  assert.equal(
    segments.find((segment) => segment.kind === "active")?.start,
    "2021-09-20",
  );
});
test("similar policies remain distinct when boosters differ", () => {
  assert.equal(
    data.events.filter((item) => ["20", "27", "7", "24"].includes(item.id))
      .length,
    4,
  );
  assert.equal(event("20").boosterIds.length, 0);
  assert.deepEqual(event("27").boosterIds, ["43"]);
  assert.deepEqual(event("7").boosterIds, ["52"]);
  assert.deepEqual(event("24").boosterIds, ["46"]);
});
test("multi-valued types use membership, and clearing a filter returns no records", () => {
  const wa = new Set(["WA"]);
  assert.equal(
    data.allEvents.filter((item) => eventMatches(item, wa, new Set(["Travel"])))
      .length,
    9,
  );
  assert.equal(
    data.allEvents.filter((item) =>
      eventMatches(item, wa, new Set(["Public Space"])),
    ).length,
    17,
  );
  assert.equal(
    data.allEvents.filter((item) => eventMatches(item, wa, new Set())).length,
    0,
  );
  assert.equal(
    data.allEvents.filter((item) =>
      eventMatches(item, new Set(), new Set(["Employment"])),
    ).length,
    0,
  );
});
test("name search handles case, partial names, typos and all booster records", () => {
  assert.ok(
    searchMandates(data.allEvents, "VACCINATION policy").some(
      (item) => item.id === "1",
    ),
  );
  assert.ok(
    searchMandates(data.allEvents, "vaccinatoin polic").some(
      (item) => item.id === "1",
    ),
  );
  assert.ok(
    searchMandates(data.allEvents, "43").some((item) => item.isBooster),
  );
  assert.deepEqual(searchMandates(data.allEvents, "zzzzxxxyy"), []);
  assert.deepEqual(searchMandates(data.allEvents, "   "), []);
});
test("event-date filter uses the exact requested field and inclusive dates", () => {
  assert.equal(
    matchesDateWindow(
      event("1"),
      "announcement_date",
      "2021-04-20",
      "2021-04-20",
    ),
    true,
  );
  assert.equal(
    matchesDateWindow(event("1"), "effective_date", "2021-04-20", "2021-04-20"),
    false,
  );
  assert.equal(
    matchesDateWindow(event("7"), "effective_date", "2021-01-01", "2023-01-01"),
    false,
  );
  assert.equal(
    matchesDateWindow(event("7"), "", "2021-01-01", "2023-01-01"),
    true,
  );
});
test("invalid dates and links are handled without silently losing originals", () => {
  assert.equal(validDate("2022-02-30"), false);
  assert.equal(validDate(""), false);
  assert.throws(
    () =>
      buildEvents([
        { ...records[0], id: "a", booster_id: "b" },
        { ...records[0], id: "b", booster_id: "a" },
      ]),
    /Cyclic/,
  );
  const missing = buildEvents([{ ...records[0], booster_id: "missing" }]);
  assert.equal(missing.events.length, 1);
  assert.equal(missing.warnings.length, 1);
});
test("details render all 28 fields when present, omit blanks and escape untrusted text", () => {
  const populated = {
    ...event("1"),
    record: Object.fromEntries(
      MANDATE_FIELDS.map(([field]) => [
        field,
        `<script>bad</script> ${field}\nsecond line`,
      ]),
    ),
  };
  const html = renderToStaticMarkup(
    <EventDetail
      event={populated}
      events={data.allEvents}
      onClose={() => {}}
      onSelect={() => {}}
    />,
  );
  for (const [field] of MANDATE_FIELDS)
    assert.ok(html.includes(`data-field="${field}"`), field);
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
  const actual = renderToStaticMarkup(
    <EventDetail
      event={event("1")}
      events={data.allEvents}
      onClose={() => {}}
      onSelect={() => {}}
    />,
  );
  assert.ok(!actual.includes('data-field="popu_info"'));
});
test("timeline DOM draws boosters after originals, keeps undated records and no booster-only rows", () => {
  const html = renderToStaticMarkup(
    <Timeline
      events={data.events}
      windowStart={new Date("2021-01-01")}
      windowEnd={new Date("2023-01-01")}
      selectedEventId={null}
      onEventClick={() => {}}
      onEventDoubleClick={() => {}}
      notableEvents={[]}
      showNotableLabels={true}
    />,
  );
  assert.equal((html.match(/data-mandate-id=/g) ?? []).length, 48);
  assert.ok(!html.includes('data-mandate-id="43"'));
  assert.equal((html.match(/data-segment="booster"/g) ?? []).length, 24);
  const first = html.slice(
    html.indexOf('data-mandate-id="1"'),
    html.indexOf('data-mandate-id="2"'),
  );
  assert.ok(
    first.indexOf('data-segment="active"') <
      first.indexOf('data-segment="booster"'),
  );
  assert.ok(html.includes("Dates incomplete"));
});
test("notable events preserve five existing client records and midpoint dates", () => {
  assert.equal(NOTABLE_EVENTS.length, 5);
  assert.equal(NOTABLE_EVENTS[0].display_date, "2021-08-08");
  assert.equal(NOTABLE_EVENTS[4].display_date, "2022-03-03");
});
