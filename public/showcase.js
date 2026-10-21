export const illustrativeSolutions = Object.freeze([
  Object.freeze({ id: "preview-noc", name: "NOC", runs: 4800, breaches: 1 }),
  Object.freeze({ id: "preview-devops", name: "DevOps", runs: 4200, breaches: 2 }),
  Object.freeze({ id: "preview-access", name: "Grant Client User Access", runs: 3480, breaches: 0 })
]);

export const defaultDashboardFilters = Object.freeze({ businessUnit: "All", period: "Day", agent: "preview-noc" });
export const dashboardOptions = Object.freeze({
  businessUnit: Object.freeze(["All", "Group", "RS", "CM"]),
  period: Object.freeze(["Day", "Week", "Month", "Year", "All"]),
  agent: Object.freeze(["All", "preview-noc", "preview-devops", "preview-access"])
});
const dayMs = 86400000;
const sampleStart = Date.UTC(2025, 9, 21);
const sampleEnd = Date.UTC(2026, 9, 21);
const waitMinutes = [1, 2, 4.2, 6];

function createDashboardRecords() {
  const records = [];
  for (let date = sampleStart, day = 0; date < sampleEnd; date += dayMs, day++) {
    for (let hour = 0; hour < 24; hour++) {
      illustrativeSolutions.forEach((solution, agent) => {
        const seed = day * 31 + hour * 7 + agent * 13;
        const runs = 20 + agent * 7 + seed % 27;
        const failed = seed % 3;
        const human = seed % 4;
        const completed = runs - failed - human;
        records.push(Object.freeze({
          timestamp: date + hour * 3600000,
          businessUnit: dashboardOptions.businessUnit[1 + seed % 3],
          agent: solution.id,
          runs, failed, human, completed,
          expected: runs - 1,
          costCents: completed * (185 + seed % 36),
          budgetCents: (runs - 1) * 210,
          inSla: runs - (seed % 5 === 0 ? 1 : 0),
          breaches: seed % 97 === 0 ? 1 : 0,
          waitCounts: Object.freeze([runs - 5, 2, 2, 1])
        }));
      });
    }
  }
  return Object.freeze(records);
}

// Fixed UTC fixtures make every preview selection reproducible, never apparently live.
export const dashboardRecords = createDashboardRecords();

export function previewDashboard(filters = defaultDashboardFilters, records = dashboardRecords) {
  for (const key of Object.keys(dashboardOptions)) {
    if (!dashboardOptions[key].includes(filters[key])) throw new RangeError(`Unsupported dashboard ${key}: ${filters[key]}`);
  }
  const starts = {
    Day: Date.UTC(2026, 9, 20),
    Week: Date.UTC(2026, 9, 14),
    Month: Date.UTC(2026, 9, 1),
    Year: Date.UTC(2026, 0, 1),
    All: sampleStart
  };
  const start = starts[filters.period];
  const hourly = filters.period === "Day";
  const monthly = filters.period === "Year" || filters.period === "All";
  const bucketKey = (timestamp) => new Date(timestamp).toISOString().slice(0, hourly ? 13 : monthly ? 7 : 10);
  const buckets = new Map();
  for (let timestamp = start; timestamp < sampleEnd; timestamp += hourly ? 3600000 : dayMs) {
    const key = bucketKey(timestamp);
    if (!buckets.has(key)) buckets.set(key, {
      key,
      label: hourly ? `${key.slice(11)}:00` : monthly ? key : key.slice(5),
      runs: 0
    });
  }
  const totals = { runs: 0, completed: 0, failed: 0, human: 0, expected: 0, costCents: 0, budgetCents: 0, inSla: 0, breaches: 0 };
  const waits = waitMinutes.map(() => 0);
  for (const record of records) {
    if (record.timestamp < start || record.timestamp >= sampleEnd
      || (filters.businessUnit !== "All" && record.businessUnit !== filters.businessUnit)
      || (filters.agent !== "All" && record.agent !== filters.agent)) continue;
    for (const key of Object.keys(totals)) totals[key] += record[key];
    record.waitCounts.forEach((count, index) => { waits[index] += count; });
    buckets.get(bucketKey(record.timestamp)).runs += record.runs;
  }
  let cumulative = 0;
  const p95 = totals.runs ? waitMinutes.find((_, index) => {
    cumulative += waits[index];
    return cumulative >= Math.ceil(totals.runs * .95);
  }) : null;
  const number = (value) => value.toLocaleString("en-US");
  const money = (cents) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  const sla = totals.runs ? totals.inSla / totals.runs * 100 : null;
  const outcomeCost = totals.completed ? totals.costCents / totals.completed : null;
  const metrics = [
    ["Business runs", number(totals.runs), `Expected ${number(totals.expected)} | ${totals.expected ? (totals.runs / totals.expected * 100).toFixed(0) + "% of plan" : "No sample target"}`, "blue"],
    ["Cost per outcome", outcomeCost === null ? "Not available" : money(outcomeCost), "Sample target <= $2.10 | Completed outcomes only", outcomeCost === null ? "neutral" : outcomeCost <= 210 ? "green" : "amber"],
    ["Total cost", money(totals.costCents), `Sample budget ${money(totals.budgetCents)}`, totals.costCents <= totals.budgetCents ? "teal" : "amber"],
    ["Success rate", totals.runs ? `${(totals.completed / totals.runs * 100).toFixed(1)}%` : "Not available", `${number(totals.completed)} done / ${number(totals.failed)} failed / ${number(totals.human)} human`, totals.runs ? "green" : "neutral"],
    ["Customer wait / SLA", sla === null ? "Not available" : `${sla.toFixed(1)}% in SLA`, `Sample target 99.5% | Wait P95: ${p95 === null ? "Not available" : p95 + " min"}`, sla === null ? "neutral" : sla >= 99.5 ? "green" : "amber"],
    ["Responsible AI", `${number(totals.breaches)} ${totals.breaches === 1 ? "breach" : "breaches"}`, totals.runs ? "Sample target: 0" : "No sample records in this selection", totals.runs ? totals.breaches ? "red" : "green" : "neutral"]
  ];
  const attention = [];
  if (!totals.runs) attention.push("No sample records for this selection");
  else {
    if (sla < 99.5) attention.push("SLA below sample target");
    if (totals.breaches) attention.push(`${number(totals.breaches)} safety ${totals.breaches === 1 ? "breach" : "breaches"}`);
    if (outcomeCost > 210 || totals.costCents > totals.budgetCents) attention.push("Cost above sample target");
    if (!attention.length) attention.push("No exceptions in the selected sample records");
  }
  return {
    totals, metrics, attention: attention.join(" / "),
    points: [...buckets.values()],
    bucketUnit: hourly ? "Hours (UTC)" : monthly ? "Months (UTC)" : "Dates (UTC)",
    coverage: `${new Date(start).toISOString().slice(0, 10)} to ${new Date(sampleEnd - dayMs).toISOString().slice(0, 10)} (UTC)`
  };
}

export function dashboardMetrics(preview, filters = defaultDashboardFilters) {
  if (!preview) return [
    ["Business runs", "Not available", "Connect verified business-outcome telemetry", "blue"],
    ["Cost per outcome", "Not available", "Full outcome cost and target not connected", "green"],
    ["Total cost", "Not available", "Cost coverage, currency and budget to confirm", "teal"],
    ["Success rate", "Not available", "Completed, failed and escalated outcomes required", "green"],
    ["Customer wait / SLA", "Not available", "Wait timestamps and SLA targets required", "amber"],
    ["Responsible AI", "Not available", "Guardrail coverage and breach events required", "red"]
  ];
  return previewDashboard(filters).metrics;
}

export function agentMetrics(preview, id) {
  if (!preview || id !== "preview-noc") return [
    ["Requests / min", "Not available", "Verified request telemetry required", "blue"],
    ["Tokens / model cost", "Not available", "Model usage and cost not connected", "teal"],
    ["Availability", "Not available", "Availability signal not connected", "green"],
    ["Latency P50 / P95", "Not available", "Latency telemetry not connected", "amber"]
  ];
  return [
    ["Requests / min", "12 RPM", "Last 5 min | Illustrative trend below", "blue"],
    ["Tokens / model cost", "2.4M / $240", "Last 7 days | Model only", "teal"],
    ["Availability", "99.9%", "Target >= 99.5%", "green"],
    ["Latency P50 / P95", "1.2s / 3.8s", "P95 target <= 3.0s", "amber"]
  ];
}

export function filterSolutions(solutions, query) {
  const normalized = query.trim().toLowerCase();
  return solutions.filter((solution) => solution.name.toLowerCase().includes(normalized));
}
