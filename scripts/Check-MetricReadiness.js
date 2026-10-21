import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { assessMetricReadiness } from "../src/metric-readiness.js";

const args = process.argv.slice(2);
try {
  if (args.length < 1 || args.length > 2 || (args.length === 2 && args[1] !== "--json")) {
    throw new Error("Usage: npm run check-metrics -- <mapping.json> [--json]");
  }
  const configPath = resolve(args[0]);
  const readJson = (path) => JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
  const report = assessMetricReadiness(readJson(configPath), (file) => readJson(resolve(dirname(configPath), file)));
  if (args[1] === "--json") console.log(JSON.stringify(report, null, 2));
  else {
    console.log(report.assessment);
    for (const metric of report.metrics) {
      console.log(`\n${metric.label}: ${metric.status}`);
      for (const issue of metric.issues) console.log(`  - ${issue.message}`);
    }
  }
  process.exitCode = report.passed ? 0 : 2;
} catch (error) {
  console.error(`Metric readiness failed: ${error.message}`);
  process.exitCode = 1;
}
