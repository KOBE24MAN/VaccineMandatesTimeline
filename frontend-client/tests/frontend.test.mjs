import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, test } from "node:test";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
after(() => server.close());
const store = await server.ssrLoadModule("/src/data/store.ts");
const { parseMandates, parseNotableEvents, searchDataset } = await server.ssrLoadModule("/src/data/dataset.ts");
const baseline = JSON.parse(await readFile(new URL("./migration-baseline.json", import.meta.url), "utf8"));
const normalize = value => typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim() || null : value;
const normalizedRows = rows => rows.map(row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, normalize(v)])));

test("all 279 policies and every detail field match the original database", async () => {
  const records = await store.loadMandates();
  assert.equal(records.length, 279);
  assert.deepEqual(records, normalizedRows(baseline.mandates));
  assert.equal(records.filter(row => row.effective_date || row.enforcement_date).length, 277);
  assert.equal(new Set(records.map(row => row.jurisdiction)).size, 8);
  for (const record of records) assert.deepEqual(await store.loadMandate(record.id), record);
  await assert.rejects(store.loadMandate("not-a-mandate"), /not found/);
});

test("all five notable events match the original database", async () => {
  assert.deepEqual(await store.loadNotableEvents(), normalizedRows(baseline.notableEvents));
});

test("local search preserves original case-insensitive matches and snippets", async () => {
  const rows = normalizedRows(baseline.mandates);
  for (const query of ["health", "HEALTH", "aged care", "vaccination", "school", "police", "exempt", "direction", "worker", "zzz-no-match"] ) {
    const expected = rows.filter(row => ["name", "target", "compliance", "executive_orders"]
      .some(field => (row[field] ?? "").toLowerCase().includes(query.toLowerCase())))
      .sort((a, b) => a.jurisdiction < b.jurisdiction ? -1 : a.jurisdiction > b.jurisdiction ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const results = await store.searchMandates(query);
    assert.deepEqual(results.map(r => r.id), expected.map(r => r.id), query);
    results.forEach(result => assert.ok(result.snippet.toLowerCase().includes(query.toLowerCase())));
  }
  assert.deepEqual(await store.searchMandates("  "), []);
  assert.deepEqual(await store.searchMandates(" health "), await store.searchMandates("health"));
});

test("fuzzy policy-name search tolerates spelling mistakes without changing exact matches", async () => {
  const matches = await store.searchMandates("vaccinaton");
  assert.ok(matches.length > 0);
  assert.ok(matches.every(row => /vaccination/i.test(row.name)));
  assert.deepEqual(await store.searchMandates("VACCINATON"), matches);
  assert.equal((await store.searchMandates("ACT-001"))[0].id, "ACT-001");
  const records = await store.loadMandates();
  const synthetic = { ...records[0], id: "TEST-NAME", name: "School Worker Vaccination Direction", target: null, compliance: null, executive_orders: null };
  assert.equal(searchDataset([synthetic], "vaccinaton school")[0].id, "TEST-NAME");
  assert.equal(searchDataset([synthetic], "direction vaccination school")[0].id, "TEST-NAME");
  assert.deepEqual(searchDataset([synthetic], "zzzzzzzzzzzzzz"), []);
  assert.deepEqual(searchDataset([synthetic], "vx"), []);
  assert.deepEqual(searchDataset([{ ...synthetic, id: "police", name: "Police vaccination" }, { ...synthetic, id: "policy", name: "Policy vaccination" }], "police").map(row => row.id), ["police"]);
});

test("CSV parsing preserves quoted commas, quotes, multiline text, booleans and null dates", async () => {
  const source = await readFile(new URL("../data/All_Mandates.csv", import.meta.url), "utf8");
  assert.deepEqual(parseMandates("\uFEFF" + source), parseMandates(source));
  const columns = source.replace(/^\uFEFF+/, "").split(/\r?\n/)[0].split(",");
  const row = { id: "TEST-1", jurisdiction: "WA", name: 'A, "quoted" title', compliance: "line one\r\nline two", ongoing: "true", date_uncertain: "False", visibility_level: "2", duration_days: "12.0" };
  const encode = value => '"' + String(value ?? "").replaceAll('"', '""') + '"';
  const text = columns.join(",") + "\n" + columns.map(key => encode(row[key])).join(",");
  const [record] = parseMandates(text);
  assert.equal(record.name, row.name);
  assert.equal(record.compliance, "line one\nline two");
  assert.equal(record.effective_date, null);
  assert.equal(record.ongoing, true);
  assert.equal(record.date_uncertain, false);
  assert.equal(record.duration_days, 12);
  assert.equal(searchDataset([record], '"quoted"').length, 1);
  assert.throws(() => parseMandates(text + "\n" + columns.map(key => encode(row[key])).join(",")), /Duplicate/);
  assert.throws(() => parseMandates("id,name\n1,test"), /missing columns/);
  assert.throws(() => parseNotableEvents("id,title\n1,test"), /missing columns/);
});
