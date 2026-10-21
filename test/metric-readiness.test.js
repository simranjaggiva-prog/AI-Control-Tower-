import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assessMetricReadiness, isUtcTimestamp, readPath } from "../src/metric-readiness.js";

const template = JSON.parse(readFileSync(new URL("../config/metric-onboarding.example.json", import.meta.url), "utf8"));
const start = "2026-10-20T00:00:00Z";
const end = "2026-10-21T00:00:00Z";
function fixture() {
  const config = structuredClone(template);
  config.scope = { solutionId: "synthetic", agentId: "test-agent", environment: "nonprod", businessUnit: "test-unit", periodStartUtc: start, periodEndUtc: end };
  const identity = { solutionId: "synthetic", agentId: "test-agent", environment: "nonprod" };
  const samples = {
    runs: [{ ...identity, runId: "run-1", status: "completed", startedAtUtc: start, completedAtUtc: end, updatedAtUtc: end }],
    costs: [{ ...identity, costId: "cost-1", periodStartUtc: start, periodEndUtc: end, amount: 12, currency: "GBP", basis: "estimated", asOfUtc: end }],
    waits: [{ ...identity, waitId: "wait-1", runId: "run-1", startedAtUtc: start, endedAtUtc: null, slaPolicyId: "synthetic-policy" }],
    safetyIncidents: [],
    safetyCoverage: [{ ...identity, coverageId: "coverage-1", periodStartUtc: start, periodEndUtc: end, monitoringActive: true }]
  };
  for (const [name, dataset] of Object.entries(config.datasets)) {
    dataset.source = "Synthetic test fixture, not a customer source";
    dataset.owner = "Test owner";
    dataset.sampleFile = name;
    for (const field of Object.keys(dataset.fields)) dataset.fields[field] = [field];
  }
  for (const metric of Object.values(config.metrics)) {
    Object.assign(metric, { definition: "Synthetic definition", rules: "Synthetic rules", target: "Synthetic target", approvedBy: "Test approver", approvedAtUtc: end });
  }
  return { config, samples };
}
const run = ({ config, samples }) => assessMetricReadiness(config, (file) => samples[file]);
const card = (report, id) => report.metrics.find((metric) => metric.id === id);

test("blank template lists all six source gaps and does not load samples", () => {
  const report = assessMetricReadiness(template, () => { throw new Error("must not load"); });
  assert.equal(report.passed, false);
  assert.equal(report.metrics.length, 6);
  assert.ok(report.metrics.every((metric) => metric.status === "Source not identified"));
});
test("complete synthetic mappings pass sample checks, never claim live readiness", () => {
  const report = run(fixture());
  assert.equal(report.passed, true);
  assert.ok(report.metrics.every((metric) => metric.status === "Sample checks passed"));
  assert.match(report.assessment, /Not live metric readiness/);
});
test("exact property paths support nested records and literal dotted names", () => {
  const data = fixture();
  data.samples.runs = { records: data.samples.runs.map((row) => ({ payload: { "literal.name": row } })) };
  data.config.datasets.runs.recordsPath = ["records"];
  for (const field of Object.keys(data.config.datasets.runs.fields)) data.config.datasets.runs.fields[field] = ["payload", "literal.name", field];
  assert.equal(run(data).passed, true);
  assert.equal(readPath({ Case: 1 }, ["case"]), undefined);
  assert.throws(() => readPath({}, ["__proto__"]));
});
test("mapping, missing sample and approval produce distinct actions", () => {
  const data = fixture();
  data.config.datasets.costs.fields.amount = [];
  assert.equal(card(run(data), "totalCost").status, "Needs mapping");
  data.config.datasets.costs.fields.amount = ["amount"];
  data.config.datasets.costs.sampleFile = "";
  assert.equal(card(run(data), "totalCost").status, "Needs sample");
  data.config.datasets.costs.sampleFile = "costs";
  data.config.metrics.totalCost.approvedBy = "";
  assert.equal(card(run(data), "totalCost").status, "Needs approval");
});
test("duplicates block every dependent card without affecting unrelated cards", () => {
  const data = fixture();
  data.samples.runs.push({ ...data.samples.runs[0] });
  const report = run(data);
  for (const id of ["businessRuns", "successRate", "costPerOutcome", "customerWaitSla"]) assert.equal(card(report, id).status, "Sample invalid");
  assert.equal(card(report, "totalCost").status, "Sample checks passed");
});
test("missing numeric values, coercion, negative costs and mixed currency fail", () => {
  for (const amount of [null, undefined, "12", -1, Infinity]) {
    const data = fixture();
    data.samples.costs[0].amount = amount;
    assert.equal(card(run(data), "totalCost").status, "Sample invalid");
  }
  const data = fixture();
  data.samples.costs.push({ ...data.samples.costs[0], costId: "cost-2", currency: "USD" });
  assert.equal(card(run(data), "costPerOutcome").status, "Sample invalid");
});
test("UTC timestamps reject impossible dates, offsets and reversed intervals", () => {
  for (const value of ["2026-02-30T00:00:00Z", "2026-10-20", "2026-10-20T01:00:00+01:00", null]) assert.equal(isUtcTimestamp(value), false);
  assert.equal(isUtcTimestamp("2026-10-20T01:00:00.123Z"), true);
  const data = fixture();
  data.samples.waits[0].endedAtUtc = "2026-10-19T00:00:00Z";
  assert.equal(card(run(data), "customerWaitSla").status, "Sample invalid");
});
test("scope mismatch and unmatched wait run are explicit failures", () => {
  const data = fixture();
  data.samples.runs[0].environment = "another-environment";
  assert.equal(card(run(data), "businessRuns").status, "Sample invalid");
  data.samples.runs[0].environment = "nonprod";
  data.samples.waits[0].runId = "missing-run";
  assert.match(card(run(data), "customerWaitSla").issues[0].message, /matching samples/);
});
test("empty incidents need active full-period coverage, not just no incident rows", () => {
  for (const mutation of [
    { monitoringActive: false }, { monitoringActive: "true" },
    { periodStartUtc: "2026-10-20T12:00:00Z" }, { periodEndUtc: start }
  ]) {
    const data = fixture();
    Object.assign(data.samples.safetyCoverage[0], mutation);
    assert.equal(card(run(data), "responsibleAi").status, "Sample invalid");
  }
  const data = fixture();
  data.samples.safetyCoverage = [];
  assert.equal(card(run(data), "responsibleAi").status, "Needs sample");
});
test("sample read errors, non-object rows and missing arrays never pass", () => {
  const data = fixture();
  for (const sample of [null, {}, [null], []]) {
    data.samples.runs = sample;
    assert.notEqual(card(run(data), "businessRuns").status, "Sample checks passed");
  }
  const report = assessMetricReadiness(data.config, () => { throw new Error("file unavailable"); });
  assert.match(card(report, "businessRuns").issues[0].message, /file unavailable/);
  assert.throws(() => assessMetricReadiness({}, () => []), /schemaVersion/);
});
test("CLI returns JSON, uses paths relative to config and distinguishes exit codes", () => {
  const directory = mkdtempSync(join(tmpdir(), "ct-metrics-test-"));
  const cli = new URL("../scripts/Check-MetricReadiness.js", import.meta.url);
  const invoke = (...args) => spawnSync(process.execPath, [fileURLToPath(cli), ...args], { encoding: "utf8" });
  try {
    const data = fixture();
    for (const [name, sample] of Object.entries(data.samples)) {
      data.config.datasets[name].sampleFile = `${name}.json`;
      writeFileSync(join(directory, `${name}.json`), JSON.stringify(sample));
    }
    const path = join(directory, "mapping.json");
    writeFileSync(path, JSON.stringify(data.config));
    const passed = invoke(path, "--json");
    assert.equal(passed.status, 0, passed.stderr);
    assert.equal(JSON.parse(passed.stdout).passed, true);
    writeFileSync(path, JSON.stringify(template));
    assert.equal(invoke(path).status, 2);
    writeFileSync(path, "not JSON");
    assert.equal(invoke(path).status, 1);
    assert.equal(invoke(path, "--unexpected").status, 1);
  } finally {
    rmSync(directory, { recursive: true });
  }
});
