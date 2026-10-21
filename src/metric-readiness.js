const identity = ["solutionId", "agentId", "environment"];
const contracts = {
  runs: {
    id: "runId", text: ["runId", ...identity, "status"], dates: ["startedAtUtc", "updatedAtUtc"],
    nullableDates: ["completedAtUtc"]
  },
  costs: {
    id: "costId", text: ["costId", ...identity, "currency", "basis"],
    dates: ["periodStartUtc", "periodEndUtc", "asOfUtc"], numbers: ["amount"]
  },
  waits: {
    id: "waitId", text: ["waitId", "runId", ...identity, "slaPolicyId"],
    dates: ["startedAtUtc"], nullableDates: ["endedAtUtc"]
  },
  safetyIncidents: {
    id: "incidentId", text: ["incidentId", ...identity, "classification"], dates: ["occurredAtUtc"]
  },
  safetyCoverage: {
    id: "coverageId", text: ["coverageId", ...identity],
    dates: ["periodStartUtc", "periodEndUtc"], booleans: ["monitoringActive"]
  }
};

export const metricRequirements = {
  businessRuns: { label: "Business runs", datasets: ["runs"] },
  costPerOutcome: { label: "Cost per outcome", datasets: ["runs", "costs"] },
  totalCost: { label: "Total cost", datasets: ["costs"] },
  successRate: { label: "Success rate", datasets: ["runs"] },
  customerWaitSla: { label: "Customer wait / SLA", datasets: ["runs", "waits"] },
  responsibleAi: { label: "Responsible AI", datasets: ["safetyIncidents", "safetyCoverage"] }
};

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function isUtcTimestamp(value) {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 19) === value.slice(0, 19);
}

function validPath(path, allowRoot = false) {
  return Array.isArray(path) && (allowRoot || path.length > 0)
    && path.every((part) => text(part) && !["__proto__", "prototype", "constructor"].includes(part));
}

export function readPath(record, path) {
  if (!validPath(path, true)) throw new Error("Field paths must be arrays of literal property names.");
  return path.reduce((value, part) => object(value) && Object.hasOwn(value, part) ? value[part] : undefined, record);
}

function fieldsFor(contract) {
  return ["text", "dates", "nullableDates", "numbers", "booleans"].flatMap((type) => contract[type] || []);
}

function validateRows(name, rows, scope, issues) {
  const contract = contracts[name];
  const ids = new Set();
  rows.forEach((row, index) => {
    const prefix = `${name} row ${index + 1}`;
    const fail = (message) => issues.push({ kind: "invalid", message: `${prefix}: ${message}` });
    for (const field of contract.text || []) if (!text(row[field])) fail(`${field} must be non-empty text.`);
    for (const field of contract.dates || []) if (!isUtcTimestamp(row[field])) fail(`${field} must be an ISO UTC timestamp ending in Z.`);
    for (const field of contract.nullableDates || []) {
      if (row[field] !== null && !isUtcTimestamp(row[field])) fail(`${field} must be an ISO UTC timestamp or explicit null for unfinished work.`);
    }
    for (const field of contract.numbers || []) {
      if (typeof row[field] !== "number" || !Number.isFinite(row[field]) || row[field] < 0) fail(`${field} must be a finite non-negative number; strings and missing values are not zero.`);
    }
    for (const field of contract.booleans || []) if (typeof row[field] !== "boolean") fail(`${field} must be a boolean.`);
    for (const field of identity) if (row[field] !== scope[field]) fail(`${field} does not match the selected scope.`);
    if (text(row[contract.id])) {
      if (ids.has(row[contract.id])) fail(`duplicate ${contract.id}; resolve retries, snapshots or duplicate delivery before reporting.`);
      ids.add(row[contract.id]);
    }
    for (const [start, end] of [["startedAtUtc", "updatedAtUtc"], ["startedAtUtc", "completedAtUtc"], ["completedAtUtc", "updatedAtUtc"], ["startedAtUtc", "endedAtUtc"], ["periodStartUtc", "periodEndUtc"]]) {
      if (isUtcTimestamp(row[start]) && isUtcTimestamp(row[end]) && Date.parse(row[end]) < Date.parse(row[start])) fail(`${end} precedes ${start}.`);
    }
    if (row.periodStartUtc === row.periodEndUtc && isUtcTimestamp(row.periodStartUtc)) fail("period must have positive duration.");
    if (name === "costs") {
      if (!/^[A-Z]{3}$/.test(row.currency || "")) fail("currency must be a three-letter uppercase code.");
      if (!["actual", "estimated"].includes(row.basis)) fail("basis must be actual or estimated.");
    }
  });
  if (name === "costs" && new Set(rows.map((row) => row.currency)).size > 1) {
    issues.push({ kind: "invalid", message: "costs: mixed currencies require an approved conversion upstream; do not sum them." });
  }
}

/**
 * This is an offline, sample-only gate. It never queries sources or certifies live coverage.
 * loadSample is injected so the CLI can read local files and tests need no customer data.
 */
export function assessMetricReadiness(config, loadSample) {
  if (!object(config) || config.schemaVersion !== 1 || !object(config.datasets) || !object(config.metrics) || !object(config.scope)) {
    throw new Error("Expected schemaVersion 1 with scope, datasets and metrics objects.");
  }
  const scopeIssues = [];
  for (const field of [...identity, "businessUnit"]) {
    if (!text(config.scope[field])) scopeIssues.push({ kind: "mapping", message: `scope.${field}: supply the approved scope.` });
  }
  for (const field of ["periodStartUtc", "periodEndUtc"]) {
    if (!isUtcTimestamp(config.scope[field])) scopeIssues.push({ kind: "mapping", message: `scope.${field}: supply an ISO UTC timestamp.` });
  }
  if (isUtcTimestamp(config.scope.periodStartUtc) && isUtcTimestamp(config.scope.periodEndUtc)
    && Date.parse(config.scope.periodEndUtc) <= Date.parse(config.scope.periodStartUtc)) {
    scopeIssues.push({ kind: "invalid", message: "scope: period end must be after period start." });
  }

  const datasets = {};
  for (const [name, contract] of Object.entries(contracts)) {
    const definition = config.datasets[name];
    const issues = [];
    const rows = [];
    datasets[name] = { issues, rows };
    if (!object(definition) || !text(definition.source)) {
      issues.push({ kind: "signal", message: `${name}: identify the exact system and table/event/export; blank means unknown, not proven absent.` });
      continue;
    }
    if (!text(definition.owner)) issues.push({ kind: "mapping", message: `${name}: nominate the technical source owner.` });
    const fields = fieldsFor(contract);
    for (const field of fields) {
      if (!validPath(definition.fields?.[field])) issues.push({ kind: "mapping", message: `${name}.${field}: map an array of exact JSON property names.` });
    }
    if (!validPath(definition.recordsPath, true)) issues.push({ kind: "mapping", message: `${name}.recordsPath: use [] for a root array or an array of wrapper property names.` });
    if (!text(definition.sampleFile)) {
      issues.push({ kind: "sample", message: `${name}: provide an approved redacted local JSON sample.` });
      continue;
    }
    if (issues.some((issue) => issue.kind === "mapping")) continue;
    let raw;
    try {
      raw = readPath(loadSample(definition.sampleFile), definition.recordsPath);
    } catch (error) {
      issues.push({ kind: "invalid", message: `${name}: cannot read sample: ${error.message}` });
      continue;
    }
    if (!Array.isArray(raw)) {
      issues.push({ kind: "invalid", message: `${name}: recordsPath must resolve to an array.` });
      continue;
    }
    if (raw.length === 0 && name !== "safetyIncidents") {
      issues.push({ kind: "sample", message: `${name}: empty sample cannot demonstrate field quality.` });
    }
    raw.forEach((record, index) => {
      if (!object(record)) issues.push({ kind: "invalid", message: `${name} row ${index + 1}: expected a JSON object.` });
      rows.push(Object.fromEntries(fields.map((field) => [field, readPath(record, definition.fields[field])])));
    });
    validateRows(name, rows, config.scope, issues);
  }

  if (datasets.runs.issues.length === 0 && datasets.waits.issues.length === 0) {
    const runIds = new Set(datasets.runs.rows.map((row) => row.runId));
    for (const row of datasets.waits.rows) {
      if (!runIds.has(row.runId)) datasets.waits.issues.push({ kind: "invalid", message: "waits: referenced run is absent from the supplied run sample; provide matching samples." });
    }
  }
  const results = Object.entries(metricRequirements).map(([id, requirement]) => {
    const issues = [...scopeIssues, ...requirement.datasets.flatMap((name) => datasets[name].issues)];
    const metric = config.metrics[id];
    for (const field of ["definition", "rules", "target"]) {
      if (!text(metric?.[field])) issues.push({ kind: "approval", message: `${id}.${field}: record the agreed definition/rules/target (or explicit approved not-applicable rationale).` });
    }
    if (!text(metric?.approvedBy) || !isUtcTimestamp(metric?.approvedAtUtc)) {
      issues.push({ kind: "approval", message: `${id}: record approver and approval timestamp; this is a declaration, not verified sign-off.` });
    }
    if (id === "responsibleAi") {
      const coverage = datasets.safetyCoverage.rows;
      if (coverage.length && !coverage.some((row) => row.monitoringActive === true
        && Date.parse(row.periodStartUtc) <= Date.parse(config.scope.periodStartUtc)
        && Date.parse(row.periodEndUtc) >= Date.parse(config.scope.periodEndUtc))) {
        issues.push({ kind: "invalid", message: "safetyCoverage: no active coverage record spans the selected period; absence of incidents is not zero breaches." });
      }
    }
    const status = issues.some((issue) => issue.kind === "signal") ? "Source not identified"
      : issues.some((issue) => issue.kind === "mapping") ? "Needs mapping"
        : issues.some((issue) => issue.kind === "invalid") ? "Sample invalid"
          : issues.some((issue) => issue.kind === "sample") ? "Needs sample"
            : issues.length ? "Needs approval" : "Sample checks passed";
    return { id, label: requirement.label, status, issues };
  });
  return {
    schemaVersion: 1,
    assessment: "Offline sample checks only. Not live metric readiness, calculation approval or proof of full coverage.",
    passed: results.every((result) => result.issues.length === 0),
    metrics: results
  };
}
