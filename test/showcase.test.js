import { test } from "node:test";
import assert from "node:assert/strict";
import {
  illustrativeSolutions, dashboardRecords, dashboardOptions, defaultDashboardFilters,
  previewDashboard, dashboardMetrics, agentMetrics, filterSolutions
} from "../public/showcase.js";

test("default dashboard never substitutes example figures for missing telemetry", () => {
  const metrics = dashboardMetrics(false);
  assert.equal(metrics.length, 6);
  assert.ok(metrics.every((metric) => metric[1] === "Not available"));
  assert.ok(agentMetrics(false, "preview-noc").every((metric) => metric[1] === "Not available"));
});

test("original Solutions portfolio remains a separate seven-day illustrative view", () => {
  assert.equal(illustrativeSolutions.reduce((sum, solution) => sum + solution.runs, 0), 12480);
  assert.equal(illustrativeSolutions.reduce((sum, solution) => sum + solution.breaches, 0), 3);
});

test("Paul's default selection is All business units, Day and NOC", () => {
  assert.deepEqual(defaultDashboardFilters, { businessUnit: "All", period: "Day", agent: "preview-noc" });
  assert.deepEqual(dashboardMetrics(true), previewDashboard().metrics);
  assert.ok(Object.isFrozen(dashboardRecords));
  assert.ok(dashboardRecords.every(Object.isFrozen));
});

test("periods use chronological UTC hours, dates or months with explicit coverage", () => {
  const expected = {
    Day: [24, "Hours (UTC)", "2026-10-20T00", "2026-10-20T23", "00:00", "23:00"],
    Week: [7, "Dates (UTC)", "2026-10-14", "2026-10-20", "10-14", "10-20"],
    Month: [20, "Dates (UTC)", "2026-10-01", "2026-10-20", "10-01", "10-20"],
    Year: [10, "Months (UTC)", "2026-01", "2026-10", "2026-01", "2026-10"],
    All: [13, "Months (UTC)", "2025-10", "2026-10", "2025-10", "2026-10"]
  };
  for (const [period, [count, unit, first, last, firstLabel, lastLabel]] of Object.entries(expected)) {
    const view = previewDashboard({ ...defaultDashboardFilters, period });
    assert.equal(view.points.length, count, period);
    assert.equal(view.bucketUnit, unit, period);
    assert.equal(view.points[0].key, first, period);
    assert.equal(view.points.at(-1).key, last, period);
    assert.equal(view.points[0].label, firstLabel, period);
    assert.equal(view.points.at(-1).label, lastLabel, period);
    assert.deepEqual(view.points.map((point) => point.key), view.points.map((point) => point.key).sort(), period);
    assert.match(view.coverage, /to 2026-10-20 \(UTC\)$/);
  }
});

test("every filter combination reconciles chart, KPIs and mutually exclusive outcomes", () => {
  for (const businessUnit of dashboardOptions.businessUnit) {
    for (const period of dashboardOptions.period) {
      for (const agent of dashboardOptions.agent) {
        const filters = { businessUnit, period, agent };
        const view = previewDashboard(filters);
        const totals = view.totals;
        const context = JSON.stringify(filters);
        assert.equal(view.points.reduce((sum, point) => sum + point.runs, 0), totals.runs, context);
        assert.equal(totals.completed + totals.failed + totals.human, totals.runs, context);
        assert.equal(view.metrics[0][1], totals.runs.toLocaleString("en-US"), context);
        assert.equal(view.metrics[3][1], `${(totals.completed / totals.runs * 100).toFixed(1)}%`, context);
        assert.equal(view.metrics[4][1], `${(totals.inSla / totals.runs * 100).toFixed(1)}% in SLA`, context);
        assert.equal(view.metrics[5][1], `${totals.breaches.toLocaleString("en-US")} ${totals.breaches === 1 ? "breach" : "breaches"}`, context);
      }
    }
  }
});

test("business-unit and agent filters intersect; totals equal the sum of disjoint scopes", () => {
  const fields = ["runs", "completed", "failed", "human", "expected", "costCents", "budgetCents", "inSla", "breaches"];
  for (const period of dashboardOptions.period) {
    const all = previewDashboard({ businessUnit: "All", period, agent: "All" });
    for (const key of ["businessUnit", "agent"]) {
      const children = dashboardOptions[key].filter((value) => value !== "All")
        .map((value) => previewDashboard({ businessUnit: "All", period, agent: "All", [key]: value }));
      for (const field of fields) assert.equal(children.reduce((sum, view) => sum + view.totals[field], 0), all.totals[field], `${period}/${key}/${field}`);
    }
  }
  const selected = previewDashboard({ businessUnit: "CM", period: "Day", agent: "preview-devops" });
  const records = dashboardRecords.filter((record) => record.businessUnit === "CM"
    && record.agent === "preview-devops" && record.timestamp >= Date.UTC(2026, 9, 20));
  for (const field of fields) assert.equal(selected.totals[field], records.reduce((sum, record) => sum + record[field], 0), field);
  assert.notEqual(selected.totals.runs, previewDashboard().totals.runs);
  for (const businessUnit of dashboardOptions.businessUnit) {
    const runs = dashboardOptions.agent.filter((agent) => agent !== "All")
      .map((agent) => previewDashboard({ businessUnit, period: "Day", agent }).totals.runs);
    assert.equal(new Set(runs).size, runs.length, `${businessUnit}: agent selections must have distinct sample run volumes`);
  }
});

test("sample aggregation calculates weighted cost, success, wait percentile and attention", () => {
  const records = [
    { timestamp: Date.UTC(2026, 9, 20, 0), businessUnit: "Group", agent: "preview-noc", runs: 90, completed: 80, failed: 5, human: 5, expected: 85, costCents: 16000, budgetCents: 17000, inSla: 89, breaches: 1, waitCounts: [80, 5, 3, 2] },
    { timestamp: Date.UTC(2026, 9, 20, 23), businessUnit: "CM", agent: "preview-noc", runs: 10, completed: 5, failed: 2, human: 3, expected: 10, costCents: 1500, budgetCents: 2000, inSla: 9, breaches: 2, waitCounts: [5, 2, 2, 1] },
    { timestamp: Date.UTC(2026, 9, 21), businessUnit: "Group", agent: "preview-noc", runs: 999 }
  ];
  const view = previewDashboard(defaultDashboardFilters, records);
  assert.equal(view.totals.runs, 100);
  assert.equal(view.metrics[1][1], "$2.06");
  assert.equal(view.metrics[2][1], "$175.00");
  assert.equal(view.metrics[3][1], "85.0%");
  assert.equal(view.metrics[4][1], "98.0% in SLA");
  assert.match(view.metrics[4][2], /Wait P95: 4.2 min/);
  assert.equal(view.points[0].runs, 90);
  assert.equal(view.points.at(-1).runs, 10);
  assert.equal(view.attention, "SLA below sample target / 3 safety breaches");
  const cm = previewDashboard({ ...defaultDashboardFilters, businessUnit: "CM" }, records);
  assert.equal(cm.metrics[1][1], "$3.00");
  assert.equal(cm.metrics[1][3], "amber");
  assert.match(cm.attention, /Cost above sample target/);
});

test("empty sample selection has no fabricated rates or healthy state; invalid filters fail explicitly", () => {
  const view = previewDashboard(defaultDashboardFilters, []);
  assert.equal(view.totals.runs, 0);
  assert.ok(view.points.every((point) => point.runs === 0));
  for (const index of [1, 3, 4]) assert.equal(view.metrics[index][1], "Not available");
  assert.equal(view.metrics[5][3], "neutral");
  assert.equal(view.attention, "No sample records for this selection");
  assert.throws(() => previewDashboard({ ...defaultDashboardFilters, period: "Quarter" }), /Unsupported dashboard period/);
  assert.throws(() => previewDashboard({ ...defaultDashboardFilters, businessUnit: "Unconfirmed" }), /Unsupported dashboard businessUnit/);
  assert.throws(() => previewDashboard({ ...defaultDashboardFilters, agent: "real-agent" }), /Unsupported dashboard agent/);
  assert.ok(dashboardMetrics(false, { period: "Unconfirmed" }).every((metric) => metric[1] === "Not available"));
});

test("example operational metrics apply only to NOC and never leak across selections", () => {
  assert.equal(agentMetrics(true, "preview-noc")[0][1], "12 RPM");
  for (const id of ["preview-devops", "preview-access", "", "real-customer-id"]) {
    assert.ok(agentMetrics(true, id).every((metric) => metric[1] === "Not available"));
  }
});

test("solution search is case insensitive and handles empty results", () => {
  assert.deepEqual(filterSolutions(illustrativeSolutions, "  nOc ").map((solution) => solution.name), ["NOC"]);
  assert.equal(filterSolutions(illustrativeSolutions, "").length, 3);
  assert.deepEqual(filterSolutions(illustrativeSolutions, "unknown"), []);
  assert.deepEqual(filterSolutions([], "NOC"), []);
});
