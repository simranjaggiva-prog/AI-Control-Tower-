# Dan's six-card metric onboarding kit

Keep the executive dashboard design. Use this kit to identify what can populate
each card and what needs mapping, ingestion or application instrumentation.

**Implemented:** an editable source-mapping template and an offline checker for
approved redacted JSON samples. It reports each card's gaps with specific next
actions. No customer cloud access or new dependencies are required.

**Not implemented:** live source discovery, ingestion, KQL generation, business
KPI calculation, Power BI modelling or native-card wiring. Passing these checks
does not populate the dashboard or certify a production metric. The checker
validates structure and selected consistency rules, not the truth of approvals
or the semantics of a written calculation.

## 1. Start with one agent and one reporting period

From the accelerator root, using PowerShell:

```powershell
New-Item -ItemType Directory -Path .\metric-onboarding.local
Copy-Item .\config\metric-onboarding.example.json .\metric-onboarding.local\mapping.json
```

If the directory or mapping already exists, keep it; do not overwrite your work.
The local directory is ignored by git. Still use only approved redacted samples:
no prompts, responses, customer details, credentials or authentication headers.
Do not send samples to external services. The checker reads files locally and
makes no network requests. File paths are resolved relative to the mapping file.

Fill `scope` with the actual solution, agent, environment, business unit and
reporting period. Use UTC timestamps, for example `2026-10-20T00:00:00Z`.
Use one approved scope per mapping file. Business-unit membership is declared
here, not independently verified against an inventory by the checker.

## 2. Find the source for each card

These are places to investigate, **not claims about existing MUFG data**.
Record exact system/table/event/export names, not just "Azure".

| Card | Where Dan should look | What to identify |
| --- | --- | --- |
| Business runs | Workflow/case database, orchestration history, application custom events | Stable business-run ID; solution/agent/environment; start, completion and update time; final/in-progress status |
| Success rate | Same run source and business outcome/case history | Which statuses mean completed, failed, escalated and in progress; whether a handoff can later complete |
| Total cost | FinOps/Cost Management exports, billing records, approved usage/pricing estimate | Unique allocated cost line, amount, currency, period, actual/estimated basis and as-of time |
| Cost per outcome | Cost source plus business runs | Matching cost/outcome scope, included cost components and period attribution |
| Customer wait / SLA | Application/queue/customer workflow history and SLA configuration | Wait episode ID, business-run ID, start/end, applicable SLA policy, pauses and business-calendar rules |
| Responsible AI | Guardrail/evaluation logs, incident records and monitoring configuration/history | Incident ID/time/classification and separate evidence of monitoring coverage |

For each dataset set:

- `source`: exact location and how to obtain it.
- `owner`: technical contact who can explain it.
- `sampleFile`: approved local JSON export filename.
- `recordsPath`: `[]` if the JSON file is an array; `["records"]` for
  `{ "records": [...] }`.
- `fields`: an array of literal, case-sensitive JSON property names for each
  required field. For example `["payload", "businessExecutionId"]`.

Paths do not execute expressions or parse embedded JSON strings. If a telemetry
property contains JSON text, parse it in the approved upstream extraction before
exporting the sample. For a literal property named `a.b`, use `["a.b"]`, not
`["a", "b"]`.

The field names in the template are a **proposed reporting contract**, not
discovered source fields. Existing equivalent fields should be mapped, not
renamed in customer applications merely to satisfy this template.

### Example mapping, not a MUFG schema

Given a synthetic record:

```json
{
  "payload": {
    "businessExecutionId": "synthetic-run-1"
  }
}
```

Set the run mapping's `runId` to `["payload", "businessExecutionId"]`.
This example only illustrates a path; a complete run needs every run-contract
field. Do not use an HTTP request ID as a business-run ID without validating the
relationship.

## 3. Prepare sample records at the right grain

| Dataset | Required grain and special rules |
| --- | --- |
| `runs` | One current record per business run within this scope. Stable `runId`; completion is an explicit timestamp or `null` for unfinished work. Preserve the customer's status names and document their interpretation. |
| `costs` | One allocated cost line per `costId`, with numeric non-negative `amount`, uppercase three-letter `currency`, `basis` of `actual` or `estimated`, period and as-of timestamp. |
| `waits` | One episode per `waitId`; `runId` must occur in the supplied run sample. `endedAtUtc` is a timestamp or explicit `null` for an open wait. |
| `safetyIncidents` | One record per incident ID and classification. An empty array is allowed only alongside separate valid coverage evidence; it does not establish zero live breaches. |
| `safetyCoverage` | Identified monitoring interval, scoped to the agent, with a real boolean `monitoringActive`. At least one active interval must span the selected reporting period. |

All records must match the declared solution, agent and environment. Timestamps
use ISO UTC `Z` with up to three fractional-second digits. Missing timestamps
are not zero. JSON numbers/booleans must be typed values, not strings.

Duplicate IDs are flagged, not silently dropped. If the source contains retry
events or status snapshots, agree an extraction that produces one current
business-run record (including deterministic tie-breaking) and retain raw data.
Likewise, deduplicate cost lines and incidents by their approved identities.

The checker deliberately rejects mixed currencies and negative cost lines in
this initial contract. If credits/refunds or multiple currencies are needed,
agree a netting/conversion approach upstream or extend the contract and tests.
Do not discard those records simply to make the check pass.

Samples may require more extraction than a raw telemetry export. This is not
proof that fields are absent in the source. Empty non-incident samples cannot
demonstrate field quality. Coverage split across multiple intervals needs an
approved consolidated coverage record or an extension to the checker; it does
not automatically prove a gap in the real monitoring system.

## 4. Record the calculation decision for each card

Fill the six `metrics` entries:

- `definition`: exactly what the measure counts.
- `rules`: extraction, deduplication, denominator, reporting-period attribution,
  missing data and relevant edge cases.
- `target`: approved value, unit, currency, scope and effective dates, or an
  explicit approved not-applicable rationale.
- `approvedBy` and `approvedAtUtc`: the recorded metric approver and UTC date.
  These are declarations; the checker does not authenticate the approver.

Use these card-specific prompts:

| Card | Rules the metric owner must approve |
| --- | --- |
| Business runs | Run identity; retries versus new runs; multi-agent steps; inclusion of in-progress runs; expected volume |
| Success rate | Explicit numerator/denominator and status mapping; human handoffs; unfinished work |
| Total cost | Included services; shared-resource allocation; currency; actual versus estimate; reporting delay; comparable budget |
| Cost per outcome | Definition of completed outcome; same scope/period as costs; zero completed outcomes must be unavailable, not divide-by-zero or zero cost |
| Customer wait / SLA | Episode versus run measurement; open waits; wall-clock/business time; pauses; units; P95 algorithm; SLA boundary and eligibility |
| Responsible AI | Breach categories; incident deduplication; actionable cases; monitoring coverage; threshold |

Written rules are a handoff to implementation, not executable formulas. Do not
interpret a non-empty text field as approval of an arbitrary calculation.

## 5. Run the check and resolve the gaps

```powershell
npm run check-metrics -- .\metric-onboarding.local\mapping.json
```

For a machine-readable report, use Node directly so npm's command banner is not
included in the JSON:

```powershell
node .\scripts\Check-MetricReadiness.js .\metric-onboarding.local\mapping.json --json
```

| Result | Action |
| --- | --- |
| Source not identified | Find the source with the application/platform owner. Unknown does not mean absent. |
| Needs mapping | Supply scope, owner and exact field paths. |
| Needs sample | Obtain an approved redacted sample with enough matching records. |
| Sample invalid | Correct extraction/data types, duplicates, scope, timing or coverage. |
| Needs approval | Complete definitions/rules/targets and recorded sign-off. |
| Sample checks passed | Proceed to reporting implementation and live validation; not a live-ready badge. |

Each card lists all observed issues even when its headline shows the highest
priority category. Exit codes: `0` all sample checks passed; `2` actionable
readiness gaps; `1` invalid command, unreadable mapping or invalid top-level
configuration. Individual sample-file failures appear as explicit card issues
and return `2`.

## 6. Handoff to reporting implementation

Dan can share the redacted mapping and checker output through the approved
customer collaboration channel. A developer then:

1. Implements source-specific extraction against the actual inspected schema.
2. Implements the approved calculations and targets, with tests below.
3. Validates live completeness, sampling, historical coverage and freshness.
4. Connects the results to Power BI or the native dashboard cards as agreed.
5. Checks that every filter uses the same identities, period and scope.

Do not require every source to use Event Hubs. Existing Eventhouse fields may
only need extraction; billing/reference data may use scheduled ingestion;
missing business signals require application instrumentation. This kit enables
none of those routes automatically.

### Calculation acceptance cases for the implementation

These are synthetic expected results, not customer KPI decisions. Adapt them
after metric-owner approval. They are not executed by the readiness checker.

| Case | Expected result |
| --- | --- |
| One run, three steps and two retries, all carrying the same approved run identity | One business run, not six |
| Three completed, one failed, one escalated; denominator approved as all five terminal runs | Success rate 3/5 = 60%; do not count an interim handoff twice |
| Costs 10 + 20 GBP and three completed outcomes in the same approved scope | Total 30 GBP; 10 GBP per completed outcome |
| Cost exists, no completed outcomes | Cost per outcome unavailable, not zero |
| Two waits of 10 and 30 seconds; approved SLA is <= 20 seconds | One of two compliant (50%); P95 depends on the approved percentile algorithm |
| Open wait or pause interval | Follow approved open/pause policy; do not silently omit |
| No incident rows and no coverage evidence | Responsible AI unavailable, not zero or all clear |
| Same cost line or incident delivered twice | Count once after approved identity-based deduplication |
| Month selected but ingestion began yesterday | Show partial coverage; do not imply a complete month |

Keep missing values as **Not available**. Preserve raw records and do not join
cost lines directly to multiple run/step records in a way that multiplies costs.

The executive dashboard and kill-switch implementation remain separate. This
kit does not send control commands or enable runtime enforcement.
