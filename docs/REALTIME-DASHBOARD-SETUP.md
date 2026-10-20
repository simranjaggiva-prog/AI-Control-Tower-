# MUFG AI Control Tower: near-real-time dashboard setup

Date: 20 October 2026

## Purpose and scope

Build the four-screen Dashboard experience using continuously arriving telemetry, a Power BI report, and secure embedding in the AI Control Tower app. The review PDF is a local design reference and is not distributed with this repository.

This is an instruction guide, not a record of completed deployment. It does not create resources, enable control actions, or establish that telemetry is connected. The PDF is a design reference; all its sample figures and targets are illustrative, not actual MUFG results.

"Real time" in this guide means automatically updating, near-real-time reporting. Measure actual event-to-screen delay before making a latency commitment.

## Current starting point

| Item | Status |
| --- | --- |
| Log Analytics | Receiving fresh telemetry, as reported by the user |
| Source tables | Selected by the team; exact names and schemas are not recorded in this guide |
| Azure Event Hubs resource | User supplied `csaueaisevhnp001`; confirm whether it is the namespace or individual hub |
| Fabric database | Last shared screenshot showed `AI-CT-Telemetry` |
| Destination table | Last shared screenshot showed `Foundry_Metrics` |
| Connection | Last shared screenshot showed the Event Hubs connection being configured |
| Actual payload and ingestion | Must be inspected and validated |
| Business metrics and targets | Must be mapped and approved; do not reuse PDF sample numbers |

## Intended architecture

```text
Existing agent telemetry
        |
        v
Application Insights / linked Log Analytics workspace
        |
        | Continuous export of selected supported tables
        v
Azure Event Hubs
        |
        | Continuous ingestion
        v
Fabric Eventhouse / KQL database
        |
        | Reporting queries
        v
Power BI DirectQuery + automatic page refresh
        |
        | Secure embedding
        v
MUFG AI Control Tower application
```

Eventstream is not mandatory for the direct Event Hubs-to-KQL route described here. Add it only when its capabilities are needed and its connectivity is validated.

## Delivery sequence

1. Complete and validate the Azure-to-Fabric connection.
2. Define trustworthy reporting data and targets.
3. Build the six-card Power BI report.
4. Enable and measure automatic updates.
5. Embed the report and align the app shell.
6. Validate the complete experience with an intended viewer account.

---

## Part 1: prerequisites and connection details

### Step 1: confirm permissions, capacity, networking and cost

Have the Azure/Fabric platform owner confirm:

- Access to the source Application Insights resource and Log Analytics workspace.
- Permission to inspect/configure the export rule.
- Access to the intended Event Hubs namespace and individual hub.
- Permission to provision an appropriate consumer group and connection credentials.
- A Fabric workspace backed by Fabric capacity, with permission to edit the KQL database.
- Power BI Desktop, report-publishing rights, and appropriate viewer licensing.
- Capacity-admin approval for the desired automatic page-refresh interval.
- Approved resource costs, retention, data scope, tenant access and networking.

**Networking gate:** Microsoft's direct Event Hubs-to-Fabric KQL ingestion guide currently states that a firewalled Event Hub/private-link ingestion is not supported by that documented route. Do not open a restricted Event Hub to work around this. If private-only connectivity is required, have the platform team validate a supported alternative before proceeding.

PPU can support short Power BI page-refresh intervals under its settings, but PPU alone does not supply Fabric capacity to host Eventhouse.

### Step 2: record the actual connection values

Complete this checklist internally. Never put keys or connection strings in this document.

| Setting | Actual value |
| --- | --- |
| Log Analytics workspace | To record |
| Selected source tables | To record |
| Workspace Azure region | To record |
| Event Hubs namespace | Confirm supplied name `csaueaisevhnp001` |
| Namespace hostname | To confirm; ends in `.servicebus.windows.net` |
| Individual event hub name(s) | To record |
| Source-table-to-hub mapping | To record |
| Dedicated consumer group | Suggested: `fabric-control-tower` |
| Approved credential reference | Reference only; no secret values |
| Fabric workspace | To record |
| Eventhouse | To record |
| KQL database | Screenshot showed `AI-CT-Telemetry`; confirm |
| Raw table(s) | Screenshot showed `Foundry_Metrics`; confirm suitability |
| Reporting timezone and currency | To agree |
| Proposed freshness objective | To agree and measure |

---

## Part 2: complete Azure-to-Fabric ingestion

### Step 3: confirm the individual event hub

In Azure portal:

1. Open `csaueaisevhnp001`.
2. Check its resource type.
3. If it is an **Event Hubs Namespace**, open **Entities > Event Hubs**.
4. Open the individual hub receiving the selected telemetry.
5. Record the exact namespace hostname and hub name.
6. Check **Metrics > Incoming Messages** over a recent time range.

Fabric needs two separate values:

| Fabric field | Required value |
| --- | --- |
| Namespace/server | Confirmed namespace hostname |
| Event Hub | Individual hub name inside the namespace |

The names may be identical, but do not assume they are.

### Step 4: verify Log Analytics continuous export

In the Log Analytics workspace:

1. Open **Settings > Rules > Data export rules**.
2. Open the relevant export rule.
3. Confirm your selected tables are included and support export.
4. Confirm the destination points to the intended Event Hubs resource.
5. If no rule exists, select **New export rule** and configure the approved destination and tables.
6. Review data scope and cost before creating or changing the rule.

Important constraints:

- The Event Hubs export destination must be in the same Azure region as the workspace.
- Initial rule provisioning can take approximately 30 minutes.
- Continuous export sends newly arriving data, not records already stored in Log Analytics.
- Export operates on whole selected tables, not arbitrary agent-filter queries.
- Other applications' records may be exported if they share a selected table.
- An unsupported table may be accepted in a rule without exporting data; verify actual flow.
- Export retries may introduce duplicates.
- Historical backfill is a separate activity and can overlap with live data.

If no individual hub name is supplied, export can create table-specific hubs. Check namespace limits and the actual resulting hub names. For a simple first proof, separate hubs per source table make schemas easier to inspect.

Do not modify shared workspace ingestion transformations just to filter this prototype without evaluating the effect on existing monitoring.

**Checkpoint:** generate approved activity and confirm the intended hub receives messages. A rule marked created is not sufficient.

### Step 5: create the Fabric destination if needed

Skip creation if the approved Eventhouse/database already exists.

1. Open [Microsoft Fabric](https://app.fabric.microsoft.com).
2. Open the approved capacity-backed workspace.
3. Select **New item** and search for **Eventhouse**.
4. Enter an approved name and select **Create**.
5. Open the default KQL database created with the Eventhouse.

An additional database is not required just because an Eventhouse was created. Reuse the approved database shown in your current workflow.

### Step 6: complete the New connection popup

In the KQL database, select **Get data > Event Hubs**.

On the configuration screen, select/create the intended raw destination table and create the connection:

| Field | Instruction |
| --- | --- |
| Namespace/server | Enter the confirmed namespace hostname |
| Event Hub | Enter the actual individual hub name |
| Connection | Select **Create new connection** |
| Connection name | Suggested: `ControlTower-Telemetry-Connection` |
| Data gateway | Leave **none** for the approved direct-cloud route |
| Authentication kind | Use the connector-supported, approved method |
| Shared Access Key Name | Approved SAS policy name |
| Shared Access Key | Policy key, not the entire connection string |

For the Shared Access Key method shown in the screenshot:

1. Open the approved shared access policy in Azure.
2. Copy its policy name into **Shared Access Key Name**.
3. Copy its primary or secondary key into **Shared Access Key**.
4. Select **Save**.

Microsoft's current direct connector guide documents a policy with **Manage** permissions. Have the platform owner approve the policy and scope; do not use a root namespace key by default.

Keep keys in the managed Fabric connection. Use the **Use Azure Key Vault** option if required by organisational policy. Never paste secrets into chat, source code, the report, or this guide.

If saving fails, resolve the reported hub-name, credential, permission or networking problem. Do not bypass security restrictions.

### Step 7: create a dedicated consumer group

A consumer group gives Fabric an independent view/reading position in the event stream. It is not a user/security group and does not grant access.

In Azure:

1. Open the Event Hubs namespace.
2. Open **Entities > Event Hubs**.
3. Select the individual hub.
4. Open **Consumer groups**.
5. Select **+ Consumer group**.
6. Enter `fabric-control-tower`, or an approved name.
7. Select **Create**.

The hierarchy is:

```text
Event Hubs namespace
  > Event Hubs
    > Individual event hub
      > Consumer groups
        > + Consumer group
```

Azure also creates `$Default`. Prefer a dedicated group rather than sharing another consumer application's group. If creation is unavailable, check permissions and the tier's consumer-group limits.

Return to Fabric:

1. Save/close the New connection popup.
2. Find **Consumer group**, directly below the Event Hub field.
3. Refresh/reopen the dropdown if necessary.
4. Select the dedicated group.
5. Enter a descriptive **Data connection name**.
6. Review additional settings.
7. Set retrieval start time to include your test events within Event Hubs retention, if needed. The documented setting uses UTC.
8. Select **Next** to inspect data.

### Step 8: inspect the payload and mapping

On **Inspect**:

1. Confirm actual records appear.
2. Generate fresh approved agent activity if necessary.
3. Use fetch-more/refresh-preview options where available.
4. Inspect the actual message structure.
5. Confirm the detected data format.
6. Review inferred columns and mapping.

Verify, where present:

| Information | Check |
| --- | --- |
| Event timestamp | Correct field, datetime type and timezone interpretation |
| Agent/application identity | Reliable identifier, not an assumed display label |
| Execution ID | Meaning and uniqueness understood |
| Correlation ID | Related events can be connected |
| Status | Actual lifecycle semantics understood |
| Duration | Numeric type and units known |
| Cost | Currency, scope and estimate/reconciled status known |
| Custom properties | Useful nested properties retained |
| Source/type | Preserved when multiple sources share a hub |

One Event Hubs message may contain an envelope or multiple records. Ensure the mapping produces the intended telemetry rows, not one opaque envelope with empty metric columns.

The name `Foundry_Metrics` does not prove that records are metrics or that all required business signals exist.

If multiple incompatible sources share a hub, preserve their type and design appropriate mappings/reporting logic. Do not assume a schema or force all records into a single incorrect structure.

Select **Finish** only after reviewing the preview.

### Step 9: prove ingestion works

In the KQL database:

1. Open the table preview or a KQL Queryset.
2. Generate a known approved agent execution.
3. Locate it in Fabric.
4. Match identifiers and timestamps against the source.
5. Verify further activity keeps arriving automatically.
6. Inspect ingestion failures and missing fields.
7. Measure source-event-to-queryable delay.

Record event time, Event Hubs enqueue time and Fabric ingestion/queryable time where available.

Do not assume the connector is delivering subsecond ingestion. If latency is too high, investigate source delay, export and ingestion behaviour before changing policies.

Repeat connection and mapping steps for other table/hub pairs.

**Checkpoint:** a newly generated event appears automatically in the correct Fabric table with valid fields.

---

## Part 3: create trustworthy reporting data

### Step 10: preserve raw data and create a reporting layer

Keep raw telemetry separate from reporting calculations.

Create KQL functions, views or suitable reporting tables that:

- Identify the approved solutions and agents.
- Correlate execution events.
- Handle duplicate records and overlapping backfill.
- Separate retries and agent steps from distinct business runs.
- Resolve agreed lifecycle statuses.
- Calculate durations using known units.
- Apply consistent reporting periods and scope.
- Query efficiently for Power BI.

Use time filters and query only necessary fields. Avoid unrestricted raw-trace queries for every visual.

Exact queries must be based on the inspected schema. This guide deliberately does not provide executable queries against guessed customer field names.

Check source sampling. Application Insights records can represent multiple telemetry items, but sampling weights are not a substitute for a reliable unique business-execution record. Exact distinct business-outcome counts may require an unsampled outcome signal.

### Step 11: agree the six executive measures

#### Business runs

Agree:

- Definition of one business execution.
- Unique identifier.
- Treatment of retries and multi-agent steps.
- Reporting-period attribution.
- Handling of in-progress executions.
- Expected-volume reference source.

Do not label generic request counts as business runs without validating the relationship.

#### Cost per outcome

Agree:

- Meaning of completed outcome.
- Included cost components.
- Attribution of costs to outcomes and periods.
- Estimate versus reconciled status.

Use compatible cost and outcome scope. Model-call cost alone is not full business-outcome cost.

#### Total cost

Identify cost source, currency, coverage, reporting delay and comparable budget. Label estimated or partial costs explicitly.

#### Success rate

Agree the denominator and lifecycle categories:

- Completed.
- Failed.
- Escalated to a human.
- In progress, if applicable.

Decide whether escalation is a final, mutually exclusive outcome or an event that can precede completion. Do not force the PDF's sample breakdown onto a different lifecycle.

#### Customer wait / SLA

Agree:

- Wait-start and wait-end events.
- SLA threshold.
- Eligible execution population.
- Treatment of still-open executions.
- P95 calculation and units.

#### Responsible AI

Require explicit instrumented events. Define breach categories, deduplication, actionable cases and coverage.

No records does not prove zero breaches when the guardrail signal is missing.

### Step 12: configure targets, period and missing-data behaviour

Use an approved reference source for:

- Expected run volume.
- Cost-per-outcome target.
- Total budget.
- SLA target.
- Responsible AI threshold.
- Currency, scope and effective dates.

Choose a reporting convention, such as a rolling seven days or seven calendar days in an agreed timezone. Apply it consistently to cards, targets and the chart.

If ingestion started today, show actual coverage or backfill history separately. Do not imply seven complete days exist.

Use **Not available** for missing measures. Do not silently display zero, 100%, within target, or all clear.

**Checkpoint:** metric owners approve definitions, coverage, reference values and source mappings.

---

## Part 4: build the Power BI Dashboard page

### Step 13: connect Power BI Desktop

1. Open Power BI Desktop.
2. Select **Get data**.
3. Search for **Azure Data Explorer (Kusto)**.
4. In Fabric, open the KQL database details and copy its **Query URI**.
5. Enter that URI and database name.
6. Choose **DirectQuery**.
7. Sign in with an authorised account.
8. Select approved reporting tables/functions.
9. Validate one measure against Fabric before adding the remaining visuals.

Verify live telemetry tables are DirectQuery, not Import.

### Step 14: separate the application shell from the report

| In the application | In Power BI |
| --- | --- |
| MUFG branding and AI Control Tower header | Six KPI cards |
| Dashboard / Solutions / Agent detail / Controls navigation | Daily-volume chart |
| Dashboard heading | Attention-required summary |
| Open in Power BI button | Reporting-period controls/context |
| Report container | Freshness and data-coverage indicators |

Do not duplicate headers/navigation inside the report.

Build a Power BI **report page**, not a pinned service dashboard, for this DirectQuery page-refresh experience.

### Step 15: lay out the analytical canvas

Use a custom landscape canvas, initially around **1200 x 620 pixels**, then adjust to the app container.

Suggested structure:

```text
Reporting period / currency / coverage

+--------------------+--------------------+--------------------+
| Business runs      | Cost per outcome   | Total cost         |
+--------------------+--------------------+--------------------+
| Success rate       | Customer wait/SLA  | Responsible AI     |
+--------------------+--------------------+--------------------+
| Daily run volume                         Attention required |
+------------------------------------------------------------+

Latest event / ingestion / report check
```

Use equal card sizes, aligned edges, consistent gaps and generous padding. Use native visuals rather than a screenshot background with overlaid sample numbers.

### Step 16: match the PDF styling

Suggested palette:

| Element | Colour |
| --- | --- |
| Main text | `#172A3B` |
| Secondary text | `#536575` |
| MUFG red | `#D6001C` |
| Business runs blue | `#285EA8` |
| Positive green | `#16734B` |
| Total cost teal | `#007C83` |
| Warning amber | `#9A5B00` |

Use pale tinted card backgrounds, subtle borders and rounded corners. Match the report's background to the app.

Suggested font: Segoe UI.

- Card titles: 13-15 pt.
- Main values: 28-34 pt.
- Supporting text: 10-12 pt.

Each card should contain:

1. Small coloured vertical accent.
2. Clear metric title.
3. Large value.
4. Supporting target/breakdown text.

Use measures for changing supporting text. Do not hard-code the sample figures.

Number formatting:

- Runs: thousands separator.
- Percentages: suitable precision, typically one decimal place.
- Currency: approved currency and precision.
- Wait: explicit time unit.
- Missing data: **Not available**.

Status colours must follow actual conditions. A card must not remain green when data is missing or a target is breached.

### Step 17: build daily run volume

1. Add a clustered column chart.
2. Use the agreed reporting date as the X-axis.
3. Use the approved business-run measure as the Y-axis.
4. Sort chronologically.
5. Use the same scope and period as the Business runs card.
6. Apply the blue accent.
7. Remove unnecessary gridlines.
8. Add exact date/count tooltips.
9. Clarify partial-day coverage.

Daily buckets must reconcile with the card under equivalent filters.

### Step 18: build attention required

Use data-driven text or a status table for:

- SLA below target.
- Responsible AI cases requiring review.
- Cost/budget exceptions.
- Missing or stale data.

Define precedence so missing telemetry cannot produce **All clear**.

Do not hard-code the sample "3 safety breaches" message.

### Step 19: configure reporting-period filters

Start with the agreed last-seven-days view if sufficient data exists.

Use an appropriate relative date/time filter for a moving window and test its behaviour after refresh and across day boundaries. Align the timezone and period definition with targets and chart buckets.

Optional approved filters:

- Solution.
- Agent.
- Environment.
- Reporting period.

Filters are usability features, not access controls. Use security rules for access restrictions.

---

## Part 5: enable and validate continuous updates

### Step 20: enable automatic page refresh

In Power BI Desktop:

1. Select a blank part of the report page.
2. Open page formatting.
3. Expand **Page refresh**.
4. Enable it.
5. Choose **Fixed interval**.
6. Start with **60 seconds**, subject to approved capacity settings.

| Workspace type | Constraint |
| --- | --- |
| Shared/ordinary Pro capacity | Minimum automatic page-refresh interval is 30 minutes |
| Fabric/Premium capacity or PPU | Shorter intervals depend on feature availability and administrator settings |

Publishing can change the effective interval if capacity settings impose a higher minimum. Confirm the service configuration.

Frequent refresh increases query load. Measure query duration, concurrent viewers and capacity utilisation before shortening intervals.

A 60-second visual refresh is not a 60-second end-to-end delivery guarantee.

### Step 21: expose freshness honestly

Where available, distinguish:

- **Latest event:** newest source-event time.
- **Latest ingestion:** newest ingestion time.
- **Report checked:** latest query/evaluation time.
- **Coverage since:** actual start of available history.

Do not use a static text box or Import-only timestamp that appears live.

Differentiate idle agents, delayed source data, broken ingestion and failed queries. A reliable pipeline-health indicator may require a separate heartbeat or monitoring signal.

### Step 22: publish and configure credentials

1. Save the report.
2. Select **Publish**.
3. Choose the approved workspace.
4. Open Power BI Service.
5. Open semantic model settings.
6. Configure the data-source credentials/cloud connection.
7. Verify the report can query Fabric.
8. Confirm the effective page-refresh interval.
9. Grant intended viewers access.
10. Configure row-level security where required.

Whether viewers require source access depends on stored-credential versus viewer-identity/SSO configuration. Decide deliberately.

### Step 23: test the published report

Leave the report page active:

1. Generate a known approved execution.
2. Confirm it reaches Fabric.
3. Watch the appropriate visual change without manual browser reload.
4. Record event-to-screen latency.
5. Check related measures remain consistent.
6. Verify query errors and missing data are visible.

Use approved test procedures or controlled test data for failure, escalation and breach scenarios. Do not create unsafe real events merely to populate a chart.

**Checkpoint:** the published report updates automatically with measured freshness and correct values.

---

## Part 6: embed and match the application

### Step 24: obtain secure report links

In Power BI Service:

1. Open the published report.
2. Select **File > Embed report > Website or portal**.
3. Copy the secure report URL, not the full iframe HTML.
4. Copy the normal authorised report link separately.

The embed URL uses `https://app.powerbi.com/reportEmbed`.

**Never use Publish to web for customer data.**

### Step 25: configure the foundation

The foundation supports these settings; see [.env.sample](../.env.sample):

| Setting | Value |
| --- | --- |
| `ORGANIZATION_NAME` | `MUFG` |
| `APPLICATION_NAME` | `AI Control Tower` |
| `POWERBI_REPORT_URL` | Secure report-embed URL |
| `POWERBI_OPEN_URL` | Normal authorised report link |

For local setup, follow the [README](../README.md). Preserve an existing environment file rather than replacing it.

For hosted deployment:

- Configure the application settings.
- Serve the app over HTTPS.
- Restart the app after configuration changes.
- Validate the actual hosted experience.

The existing [configuration validation](../src/config.js) rejects public Publish-to-web URLs. Do not weaken it.

App sign-in does not grant Power BI permissions. Viewers need appropriate report access and licensing/capacity entitlement. Secure iframe embedding may require a separate Power BI sign-in and popup/browser settings.

### Step 26: align the application shell with the PDF

The foundation now includes the top branding bar, horizontal navigation and four-screen layout. Its optional **Illustrative preview** reproduces the populated PDF design using fictitious examples. The default view uses real registered inventory, unavailable metrics and the configured Power BI report. Configuration alone does not build the Power BI visuals.

When integrating the report, verify these existing surfaces:

| File | Required work |
| --- | --- |
| [public/index.html](../public/index.html) | Top branding, horizontal navigation, Dashboard heading and report placement |
| [public/styles.css](../public/styles.css) | Match the actual report aspect ratio to the responsive container |
| [public/app.js](../public/app.js) | Secure iframe and report link; preview hides the report rather than mixing sample figures with it |

Acceptance requirements:

- Approved MUFG branding appears once.
- Horizontal navigation matches the design.
- Analytical canvas does not repeat the header.
- Report aspect ratio matches its container.
- No unnecessary nested scrollbars.
- Cards remain legible at the demonstration resolution.
- **Open in Power BI** opens the authorised report.
- Sample-data labels remain wherever illustrative data is used.
- Missing telemetry is not presented as healthy.

Do not recreate the iframe every minute. Let Power BI refresh its visuals. The app's connection refresh preserves the iframe when its URL is unchanged; it is not the continuous-reporting mechanism.

Solutions and Agent detail show registered metadata and explicit telemetry gaps in foundation mode. The preview supplies separate design examples. Styling or preview actions do not connect telemetry adapters or enable controls.

### Step 27: decide whether SDK embedding is necessary

Start with the existing secure iframe.

If requirements include precise report-chrome control, app-driven filters, report-page navigation, integrated sign-in or token renewal, design a **Power BI JavaScript SDK / embed-for-your-organisation** integration separately.

Do not assume the iframe's automatic authentication can simply be reused with SDK embedding.

Keep real pause acknowledgement in the application's verified control-status path. A refreshed report is not evidence that an agent has paused; this foundation still has controls disabled.

---

## Part 7: final acceptance checklist

| Test | Pass condition |
| --- | --- |
| Export | Correct selected tables flow to the intended hub |
| Ingestion | New records appear automatically in Fabric |
| Schema | IDs, timestamps, types and source fields are populated correctly |
| Business runs | Steps and retries do not inflate outcomes |
| Outcomes | Approved lifecycle categories and denominator |
| Cost | Scope, currency, completeness and delay disclosed |
| SLA | Correct timestamps, eligible population and target |
| Responsible AI | Explicit signal and verified coverage |
| Chart totals | Daily buckets reconcile with the card |
| Targets | Approved values use compatible scope and period |
| Coverage | Available historical range is honestly stated |
| Refresh | Published embedded visuals update without manual reload |
| Latency | Event-to-screen delay measured against an agreed objective |
| Freshness | Source/ingestion age distinguished from report checks |
| Missing data | No silent zero, 100%, healthy or all-clear defaults |
| Viewer access | Intended viewers succeed; unauthorised viewers are denied |
| Appearance | App and report together match the Dashboard design |
| Control boundary | No implication that analytics enables pause/kill |

Final test:

```text
Trigger known execution
  -> Find source record
  -> Confirm Event Hubs receipt
  -> Find Fabric record
  -> Confirm Power BI measure
  -> Observe embedded app update
  -> Record latency and reconcile totals
```

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Connection cannot save | Namespace versus hub name, approved policy/key, access and networking |
| Consumer group not listed | Group created on correct individual hub, permissions, tier limits and dropdown refresh |
| No preview records | Export provisioning, incoming messages, retrieval start time, retention and actual source activity |
| Rows arrive with empty fields | Payload envelope, data format, mapping paths and column types |
| KQL updates but Power BI does not | DirectQuery mode, effective page-refresh settings, active page and credentials |
| Desktop refreshes quickly but service does not | Published workspace capacity and administrator minimum interval |
| Embedded report prompts for sign-in | Expected secure-embed authentication, report permissions, browser/popup settings |
| Cards disagree | Period/cohort mismatch, duplicates, sampling, retries or inconsistent lifecycle definitions |
| Report is fresh but source is old | Upstream delay or inactivity; inspect independent pipeline-health signals |
| First seven-day view is incomplete | Continuous export is new-data-only; disclose coverage or backfill separately |

## Official references

Product UI and capabilities can change. Recheck these documents during implementation:

- [Log Analytics continuous export](https://learn.microsoft.com/azure/azure-monitor/logs/logs-data-export)
- [Create an Eventhouse](https://learn.microsoft.com/fabric/real-time-intelligence/create-eventhouse)
- [Ingest Event Hubs data into Fabric KQL](https://learn.microsoft.com/fabric/real-time-intelligence/get-data-event-hub)
- [Azure Data Explorer and KQL Database connector](https://learn.microsoft.com/power-query/connectors/azure-data-explorer)
- [Power BI automatic page refresh](https://learn.microsoft.com/power-bi/create-reports/desktop-automatic-page-refresh)
- [Relative time slicers and filters](https://learn.microsoft.com/power-bi/create-reports/slicer-filter-relative-time)
- [Secure report embedding](https://learn.microsoft.com/power-bi/collaborate-share/service-embed-secure)
