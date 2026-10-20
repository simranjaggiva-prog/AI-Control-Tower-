export const illustrativeSolutions = Object.freeze([
  Object.freeze({ id: "preview-noc", name: "NOC", runs: 4800, breaches: 1 }),
  Object.freeze({ id: "preview-devops", name: "DevOps", runs: 4200, breaches: 2 }),
  Object.freeze({ id: "preview-access", name: "Grant Client User Access", runs: 3480, breaches: 0 })
]);

export const dailyVolumes = Object.freeze([1600, 1750, 1800, 1680, 1900, 1820, 1930]);

export function dashboardMetrics(preview) {
  if (!preview) return [
    ["Business runs", "Not available", "Connect verified business-outcome telemetry", "blue"],
    ["Cost per outcome", "Not available", "Full outcome cost and target not connected", "green"],
    ["Total cost", "Not available", "Cost coverage, currency and budget to confirm", "teal"],
    ["Success rate", "Not available", "Completed, failed and escalated outcomes required", "green"],
    ["Customer wait / SLA", "Not available", "Wait timestamps and SLA targets required", "amber"],
    ["Responsible AI", "Not available", "Guardrail coverage and breach events required", "red"]
  ];
  return [
    ["Business runs", "12,480", "Expected 12,000 | 104% of plan", "blue"],
    ["Cost per outcome", "$1.98", "Target <= $2.10 | Within target", "green"],
    ["Total cost", "$23,712", "Budget $25,200 | 94% used", "teal"],
    ["Success rate", "96.2%", "12,000 done / 180 failed / 300 human", "green"],
    ["Customer wait / SLA", "98.4% in SLA", "Target 99.5% | Wait P95: 4.2 min", "amber"],
    ["Responsible AI", "3 breaches", "Needs review | Target: 0", "red"]
  ];
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
