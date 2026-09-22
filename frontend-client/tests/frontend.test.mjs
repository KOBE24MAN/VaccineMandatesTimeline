import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { after, test } from "node:test";
import { createServer } from "vite";

const server = await createServer({ server: { host: "127.0.0.1", port: 0 }, appType: "custom" });
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}/`;
const nativeFetch = globalThis.fetch;
globalThis.fetch = (input, options) => nativeFetch(typeof input === "string" ? new URL(input, origin) : input, options);
after(async () => { globalThis.fetch = nativeFetch; await server.close(); });

const store = await server.ssrLoadModule("/src/data/store.ts");
const { parseMandates, parseNotableEvents, searchDataset, filterMandates } = await server.ssrLoadModule("/src/data/dataset.ts");
const { mapToIndex, mapToDetail } = await server.ssrLoadModule("/src/hooks/useEvents.ts");
const { timelineGroupKey, visualEndDate, hasOngoingSegment } = await server.ssrLoadModule("/src/utils/timeline.ts");

test("root tab-delimited mandate CSV loads all 186 records across three jurisdictions", async () => {
  const records = await store.loadMandates();
  assert.equal(records.length, 186);
  assert.deepEqual([...new Set(records.map(row => row.jurisdiction))].sort(), ["NSW", "VIC", "WA"]);
  assert.equal(records.filter(row => row.announcement_date).length, 88);
  assert.equal(records.filter(row => row.effective_date).length, 136);
  assert.equal(records.filter(row => row.enforcement_date).length, 162);
  assert.equal(records.filter(row => row.removal_date).length, 186);
  assert.equal(records.filter(row => row.booster_id).length, 38);
  for (const record of records) assert.deepEqual(await store.loadMandate(record.id), record);
  await assert.rejects(store.loadMandate("not-a-mandate"), /not found/);
});

test("missing levels use original duration rules and show progressively more records", async () => {
  const records = await store.loadMandates();
  const byId = new Map(records.map(row => [row.id, row]));
  const boosterIds = new Set(records.map(row => row.booster_id).filter(Boolean));
  const events = records.filter(row => !boosterIds.has(row.id)).map(row => mapToIndex(row, byId));
  const counts = [1, 2, 3, 4, 5, 6].map(level => events.filter(row => row.visibility_level <= level).length);
  assert.ok(counts[0] > 0);
  assert.ok(counts[2] > counts[0]);
  assert.ok(counts[5] > counts[2]);
  assert.equal(counts[5], events.length);
  assert.equal(records.find(row => row.id === "1").visibility_level, 2);
});

const header = "id,jurisdiction,name,type,target,effective_date,enforcement_date,removal_date,duration_days,visibility_level,ongoing";
test("CSV level overrides, thresholds, missing duration, and invalid levels", () => {
  for (const [days, expected] of [[365, 1], [364, 2], [270, 2], [269, 3], [180, 3], [179, 4], [90, 4], [89, 5], [30, 5], [29, 6]]) {
    const [row] = parseMandates(`${header}\n1,WA,Test,Employment,Test,2021-01-01,2021-01-01,2022-01-01,${days},,`);
    assert.equal(row.visibility_level, expected);
  }
  const [override] = parseMandates(`${header}\n1,WA,Test,Employment,Test,2021-01-01,2021-01-01,2022-01-01,365,5,`);
  assert.equal(override.visibility_level, 5);
  const [calculated] = parseMandates(`${header}\n1,WA,Test,Employment,Test,2021-01-01,2021-01-01,2022-01-01,,,`);
  assert.equal(calculated.visibility_level, 1);
  for (const value of [0, 7, 2.5, "oops"]) assert.throws(() => parseMandates(`${header}\n1,WA,Test,Employment,Test,2021-01-01,2021-01-01,2022-01-01,,${value},`), /visibility_level/);
});

test("ongoing inference and explicit flags do not turn ended mandates into ongoing ones", async () => {
  const records = await store.loadMandates();
  assert.ok(records.every(row => !row.ongoing));
  const rows = parseMandates(`${header}\n1,WA,Open,Employment,Test,2021-01-01,2021-01-01,,,,\n2,WA,Explicit off,Employment,Test,2021-01-01,2021-01-01,,,,false\n3,WA,Explicit on,Employment,Test,2021-01-01,2021-01-01,2022-01-01,,,true`);
  assert.equal(rows.find(row => row.id === "1").ongoing, true);
  assert.equal(rows.find(row => row.id === "2").ongoing, false);
  assert.equal(rows.find(row => row.id === "3").ongoing, true);
});

test("booster extends past original removal and different phases stay separate", async () => {
  const records = await store.loadMandates();
  const byId = new Map(records.map(row => [row.id, row]));
  const event = mapToIndex(byId.get("1"), byId);
  assert.ok(event.booster.end_date > event.end_date);
  assert.equal(visualEndDate(event), event.booster.end_date);
  assert.notEqual(timelineGroupKey(event), timelineGroupKey({ ...event, announcement_date: "2020-01-01" }));
  assert.notEqual(timelineGroupKey(event), timelineGroupKey({ ...event, booster: null }));
  const booster = byId.get("43");
  byId.set("43", { ...booster, removal_date: null, ongoing: true });
  const openEvent = mapToIndex(byId.get("1"), byId);
  assert.ok(openEvent.booster);
  assert.equal(hasOngoingSegment(openEvent), true);
  assert.equal(visualEndDate(openEvent), null);
});

test("booster IDs point to reusable booster rows", async () => {
  const records = await store.loadMandates();
  const ids = new Set(records.map(row => row.id));
  const boosterIds = [...new Set(records.map(row => row.booster_id).filter(Boolean))].sort();
  assert.deepEqual(boosterIds, ["115", "118", "159", "160", "161", "162", "163", "183", "37", "38", "43", "46", "48", "52", "84", "85", "86", "87"]);
  assert.ok(boosterIds.every(id => ids.has(id)));
  const booster37 = records.find(row => row.id === "37");
  assert.equal(booster37?.enforcement_date, "2022-01-13");
  assert.equal(booster37?.removal_date, "2022-11-04");
});

test("tab parsing preserves literal newlines and new fields", async () => {
  const source = await readFile(new URL("../../vaccine_mandates.csv", import.meta.url), "utf8");
  const records = parseMandates("\uFEFF" + source);
  const record = records.find(row => row.id === "2");
  assert.ok(record);
  assert.equal(record?.communications?.includes("\\n"), false);
  assert.equal(record?.ref_no, "1237\n1157\n233\n1158\n4645");
  assert.equal(record?.booster_id, "38");
  assert.ok(record?.vaccine_eligibility_info);
});

test("search keeps exact matching and fuzzy policy-name matching", async () => {
  const exact = await store.searchMandates("Residential aged care");
  assert.ok(exact.some(row => row.id === "2"));
  const fuzzy = await store.searchMandates("boostr vaccinaton");
  assert.ok(fuzzy.some(row => /booster/i.test(row.name ?? "")));
  assert.deepEqual(await store.searchMandates("  "), []);
  const records = await store.loadMandates();
  const synthetic = { ...records[0], id: "TEST-NAME", name: "School Worker Vaccination Direction", target: null, compliance: null, executive_orders: null };
  assert.equal(searchDataset([synthetic], "vaccinaton school")[0].id, "TEST-NAME");
});

test("notable events still load from the bundled local data", async () => {
  const notable = await store.loadNotableEvents();
  assert.equal(notable.length, 5);
  assert.throws(() => parseNotableEvents("id\ttitle\n1\ttest"), /missing columns/);
});


test("development runtime CSV endpoint returns the authoritative root file", async () => {
  const response = await fetch("vaccine_mandates.csv?runtime-check=1");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-cache");
  assert.equal(await response.text(), await readFile(new URL("../../vaccine_mandates.csv", import.meta.url), "utf8"));
});

test("name and target fuzzy filters stay field-specific, combine with AND, and clear", async () => {
  const records = await store.loadMandates();
  const base = records[0];
  const rows = [
    { ...base, id: "A", name: "School Worker Vaccination Direction", target: "Airport drivers", compliance: "nurses" },
    { ...base, id: "B", name: "Airport Worker Direction", target: "School teachers" },
    { ...base, id: "C", name: "School Vaccination", target: "Airport security" },
  ];
  assert.deepEqual(filterMandates(rows, { name: "school" }).map(row => row.id), ["A", "C"]);
  assert.deepEqual(filterMandates(rows, { target: "school" }).map(row => row.id), ["B"]);
  assert.deepEqual(filterMandates(rows, { name: "school", target: "drivrs" }).map(row => row.id), ["A"]);
  assert.deepEqual(filterMandates(rows, { target: "nurses" }), []);
  assert.deepEqual(filterMandates(rows, { name: "   ", target: "" }), rows);
  assert.deepEqual(filterMandates(rows, { name: "zxqvnoresult" }), []);
  const fuzzy = filterMandates(records, { name: "boostr" });
  for (const id of ["37", "38", "43", "46", "48", "52"]) assert.ok(fuzzy.some(row => row.id === id), `booster ${id} included`);
  const mixed = [{...base, id:"1", name:"Vaccination"}, {...base, id:"2", name:"Vaccinaton"}];
  assert.equal(filterMandates(mixed, {name:"Vaccination"}).length, 2);
});

test("matching booster policies are visible and shared overlays avoid duplicate rows", async () => {
  const { searchTimelineEvents } = await server.ssrLoadModule("/src/utils/search.ts");
  const records = await store.loadMandates();
  const booster = records.find(row => row.id === "43");
  const standalone = searchTimelineEvents([booster], records);
  assert.equal(standalone.length, 1);
  assert.equal(standalone[0].id, "43");
  assert.equal(standalone[0].start_date, booster.enforcement_date);
  const original = records.find(row => row.id === "1");
  const merged = searchTimelineEvents([original, booster], records);
  assert.deepEqual(merged.map(event => event.id), ["1"]);
  assert.equal(merged[0].booster.id, "43");
  assert.deepEqual(searchTimelineEvents([], records), []);
});

test("information cards show original then full booster with IDs and preserved newlines", async () => {
  const { MandateDetails } = await server.ssrLoadModule("/src/components/MandateDetails.tsx");
  const { mandateFields } = await server.ssrLoadModule("/src/utils/mandateDetails.ts");
  const records = await store.loadMandates();
  const byId = new Map(records.map(row => [row.id, row]));
  const original = byId.get("2");
  const booster = byId.get(original.booster_id);
  const html = renderToStaticMarkup(React.createElement(MandateDetails, {event: mapToDetail(original, byId), color:"#2563EB"}));
  assert.ok(html.indexOf('data-mandate-detail-id="2"') < html.indexOf('data-mandate-detail-id="38"'));
  assert.ok(html.includes("(ID:2)"));
  assert.ok(html.includes("(ID:38)"));
  const split = html.split('data-mandate-detail-id="38"');
  for (const [record, section] of [[original, split[0]], [booster, split[1]]]) {
    for (const field of mandateFields(record)) assert.ok(section.includes(`data-mandate-field="${field.key}"`), `${record.id} field ${field.key}`);
  }
  assert.ok(html.includes("whitespace-pre-wrap"));
  assert.ok(html.includes("1237\n1157\n233\n1158\n4645"));
  const noDates = new Map(byId);
  noDates.set(booster.id, {...booster, enforcement_date:null});
  assert.equal(mapToIndex(original, noDates).booster, null);
  assert.equal(mapToIndex(original, noDates).boosterRecord.id, booster.id);
});

test("hover summary keeps the original phases and only adds a linked booster summary", async () => {
  const { MandateTooltip } = await server.ssrLoadModule("/src/components/MandateTooltip.tsx");
  const records = await store.loadMandates();
  const byId = new Map(records.map(record => [record.id, record]));
  const event = mapToIndex(byId.get("2"), byId);
  const withDetails = { ...event,
    record: { ...event.record, compliance: "FULL_ORIGINAL_COMPLIANCE", notes: "FULL_ORIGINAL_NOTES" },
    boosterRecord: { ...event.boosterRecord, compliance: "FULL_BOOSTER_COMPLIANCE" },
  };
  const html = renderToStaticMarkup(React.createElement(MandateTooltip, {events:[withDetails], color:"#2563EB"}));
  assert.ok(html.indexOf("(ID:2)") < html.indexOf("(ID:38)"));
  for (const text of ["Announced → effective", "Effective → enforcement", "Enforcement → removal", "2022-01-13", "2022-11-04"]) assert.ok(html.includes(text), text);
  for (const text of ["FULL_ORIGINAL_COMPLIANCE", "FULL_ORIGINAL_NOTES", "FULL_BOOSTER_COMPLIANCE", "data-mandate-detail-id", "Scroll for all details"]) assert.ok(!html.includes(text), text);
  const noBooster = renderToStaticMarkup(React.createElement(MandateTooltip, {events:[{ ...withDetails, booster:null, boosterRecord:undefined }], color:"#2563EB"}));
  assert.ok(!noBooster.includes("data-tooltip-booster-id"));
});

test("information sections follow the previous layout and groups keep compact summaries", async () => {
  const { MandateDetails, MandateSummary } = await server.ssrLoadModule("/src/components/MandateDetails.tsx");
  const records = await store.loadMandates();
  const byId = new Map(records.map(record => [record.id, record]));
  const event = mapToDetail(byId.get("2"), byId);
  const html = renderToStaticMarkup(React.createElement(MandateDetails, {event, color:"#2563EB"}));
  const first = html.split('data-mandate-detail-id="38"')[0];
  let previous = -1;
  for (const field of ["id", "name", "jurisdiction", "type", "announcement_date", "effective_date", "enforcement_date", "removal_date", "target", "compliance", "exemptions", "enforcement_measures", "executive_orders", "removal_method", "removal_details", "communications", "vaccine_eligibility_info", "vaccine_availability_info", "ATAGI", "uptake", "popu_info", "notes", "source", "authority", "ref_code", "ref_no"]) {
    const position = first.indexOf(`data-mandate-field="${field}"`);
    if (position < 0) continue; // Empty source fields are omitted.
    assert.ok(position > previous, `${field} in the original display order`);
    previous = position;
  }
  assert.ok(!html.includes("Name/Version"));
  const summary = renderToStaticMarkup(React.createElement(MandateSummary, {event,color:"#2563EB",onSelect:()=>{}}));
  assert.ok(summary.indexOf('data-mandate-summary-id="2"') < summary.indexOf('data-mandate-summary-id="38"'));
  assert.ok(summary.includes("View full details"));
  assert.ok(!summary.includes('data-mandate-field="compliance"'));
});
