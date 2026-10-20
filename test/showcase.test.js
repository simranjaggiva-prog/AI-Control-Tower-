import { test } from "node:test";
import assert from "node:assert/strict";
import { illustrativeSolutions, dailyVolumes, dashboardMetrics, agentMetrics, filterSolutions } from "../public/showcase.js";

test("default dashboard never substitutes example figures for missing telemetry", () => {
  const metrics = dashboardMetrics(false);
  assert.equal(metrics.length, 6);
  assert.ok(metrics.every((metric) => metric[1] === "Not available"));
  assert.ok(agentMetrics(false, "preview-noc").every((metric) => metric[1] === "Not available"));
});

test("illustrative portfolio and daily chart reconcile to the PDF totals", () => {
  assert.equal(illustrativeSolutions.reduce((sum, solution) => sum + solution.runs, 0), 12480);
  assert.equal(illustrativeSolutions.reduce((sum, solution) => sum + solution.breaches, 0), 3);
  assert.equal(dailyVolumes.reduce((sum, value) => sum + value, 0), 12480);
  assert.equal(12000 + 180 + 300, 12480);
  assert.equal((12000 / 12480 * 100).toFixed(1), "96.2");
  assert.equal((23712 / 12000).toFixed(2), "1.98");
  assert.equal(dashboardMetrics(true)[0][1], "12,480");
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
