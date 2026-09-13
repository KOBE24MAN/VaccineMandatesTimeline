import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, test } from "node:test";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
after(() => server.close());

const store = await server.ssrLoadModule("/src/data/store.ts");
const { parseMandates, parseNotableEvents, searchDataset } = await server.ssrLoadModule("/src/data/dataset.ts");
const { mapToIndex } = await server.ssrLoadModule("/src/hooks/useEvents.ts");
const { timelineGroupKey, visualEndDate, hasOngoingSegment } = await server.ssrLoadModule("/src/utils/timeline.ts");

test("new tab-delimited mandate CSV loads all WA records", async () => {
  const records = await store.loadMandates();
  assert.equal(records.length, 54);
  assert.equal(new Set(records.map(row => row.jurisdiction)).size, 1);
  assert.equal(records[0].jurisdiction, "WA");
  assert.equal(records.filter(row => row.announcement_date).length, 36);
  assert.equal(records.filter(row => row.effective_date).length, 31);
  assert.equal(records.filter(row => row.enforcement_date).length, 54);
  assert.equal(records.filter(row => row.removal_date).length, 54);
  assert.equal(records.filter(row => row.booster_id).length, 24);
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
  assert.deepEqual(boosterIds, ["37", "38", "43", "46", "48", "52"]);
  assert.ok(boosterIds.every(id => ids.has(id)));
  const booster37 = records.find(row => row.id === "37");
  assert.equal(booster37?.enforcement_date, "2022-01-13");
  assert.equal(booster37?.removal_date, "2022-11-04");
});

test("tab parsing preserves literal newlines and new fields", async () => {
  const source = await readFile(new URL("../vaccine_mandates.csv", import.meta.url), "utf8");
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
