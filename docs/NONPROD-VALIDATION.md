# Check your non-production installation

**For:** the customer deployment owner and tester.

**Goal:** prove sign-in, customer inventory and foundation connections work.
This is not a test of stopping agents: no kill-switch adapter is included.

## What has already been checked locally?

| Check | Release result |
| --- | --- |
| Application tests | 15 passed, 0 failed, 0 skipped |
| JavaScript syntax and inventory checks | Passed |
| Bicep template compilation | Passed |
| Desktop and mobile preview | Empty inventory, disabled stop/resume, working Refresh |
| Runtime ZIP | 11 files matched source; excluded secrets and local dependencies |
| Parameter checker | Valid test input passed; uppercase prefix, production and inline secret rejected |
| Real Azure deployment, sign-in and private connections | **Not tested** |
| Customer Power BI report | **Not tested** |
| Real agent monitoring or stopping | **Not implemented** |

These are local release results from 18 October 2026, not proof of your Azure installation.

## 1. Before deployment

- [ ] Non-production scope, costs, network and identity design are approved.
- [ ] The public, sign-in-protected website meets customer policy; otherwise adapt it first.
- [ ] The customer settings pass the deployment guide's parameter check.
- [ ] What-if shows only approved changes to the dedicated environment.
- [ ] Local config checks, tests and build pass before packaging.
- [ ] Release ZIP has root `package.json` and no secrets, `.env`, `node_modules` or test fixtures.
- [ ] The previous approved release and non-secret settings are saved for rollback.

Follow the [deployment guide](DEPLOYMENT-GUIDE.md) for commands. Stop when a check fails.

## 2. Check access

Use separate browser sessions for each user. Sign in at:
`https://<actual-app-host>/.auth/login/aad?post_login_redirect_uri=/`

| User | Expected result |
| --- | --- |
| Not signed in | HTTP 401; no customer inventory |
| Assigned Viewer | Can read the app; controls disabled |
| Assigned Operator | Can read the app; controls still disabled |
| Signed in without an accepted role | API returns 403 `ROLE_REQUIRED`, or tenant assignment policy blocks sign-in first |
| Outside the approved tenant | No unauthorised access |

Set enterprise application **Assignment required? = Yes**.
Role values must be `AIControlRoom.Viewer` or `AIControlRoom.Operator`.
If tenant policy blocks the no-role scenario before sign-in, record that result;
use local tests for the API role guard. Do not weaken cloud authentication.

## 3. Check the screen and connections

| Check | Expected result |
| --- | --- |
| Inventory | Empty, or only your approved non-production entries |
| Agent status | `unknown`; never assumed running or stopped |
| Metrics/history | No invented metrics; no runtime command history |
| `/healthz` | `status: "ok"`; only proves the website process is alive |
| `/readyz` in Azure | `mode: "azure"`, `dependencies: "reachable-read-only"`, `enforcementReady: false` |
| Optional Power BI report | Real authorised report; a user without report access is denied |

Azure readiness checks App Configuration settings filtered to `foundation/*`,
metadata for all three Cosmos containers in `command-db`, and properties of
the `audit-evidence` Blob container. It makes no Foundry calls or writes.

A failure, or a stalled check after 15 seconds, returns HTTP 503.
In laptop preview, `mode: "local-preview"` with `dependencies: "not-configured"`
does **not** prove Azure connectivity.

The platform owner should also confirm private DNS/endpoints, outbound VNet
integration and read-only identity roles. Cosmos read access covers the new
isolated account; shared-account reuse needs a separate access review.

Do not claim monitoring is connected just because Application Insights exists:
the app has no telemetry SDK instrumentation. The evidence container receives no
application audit writes and has no locked immutable retention policy.

## 4. Prove controls are blocked

1. Sign in as an assigned **Operator**.
2. Confirm Stop and Resume are disabled.
3. Use an approved authenticated test client to send `POST /api/solutions` with `{}`.
4. Expect HTTP **403** and **`ENFORCEMENT_NOT_AVAILABLE`**. Check PUT/PATCH/DELETE too if required.
5. Confirm no inventory, commands or runtime work changed.

The application blocks writes before its own identity checks. Azure sign-in
protection may return 401 first for an unauthenticated request, so use an
authenticated session for the cloud write test.

Local tests also check that `ENABLE_CONTROLS=true` prevents startup.
Do not change the deployed setting to test this. Keep it `false`.

## 5. Save the results

Record **pass / fail / not run / not applicable** for each check, with:

- Release, date, tester, approver and confirmed non-production environment.
- Expected result, actual result, HTTP status and restricted evidence location.
- Any failure, its owner and the next action.

Never include secrets, tokens, session cookies or customer payloads.
Missing evidence is not a pass.

Sign off as: **"Foundation validated; real agent enforcement is not implemented."**

## If something fails

| Problem | Next action |
| --- | --- |
| Local startup fails | Use `npm run preview` with `.env`; `npm start` does not load it |
| Inventory rejected | Run `npm run check-config`; check the [field rules](DEPLOYMENT-GUIDE.md#3-register-your-own-non-production-solutions) |
| Sign-in fails | Check callback URL, tenant, client ID, secret expiry and role assignments |
| Readiness fails | Check identity roles, propagation, endpoints, private DNS and routing |
| ZIP deployment fails | Check Entra-capable CLI/runner and deployment rights; never enable basic auth |
| App cannot find dependencies | Check deployment logs for npm dependency restoration |
| Report fails | Check secure URL, report permissions, licensing and browser policy; never use Publish to web |
| Operator cannot stop an agent | Expected: no adapter is included |

Do not open private data services or grant write roles to hide a failure.

## Roll back or remove the foundation

- **App update:** redeploy the previous approved ZIP to the same confirmed non-production app.
  Restore approved settings, handle secrets through the approved store, then repeat these checks.
- **Infrastructure update:** ask the platform owner to review a corrective what-if/deployment.
  An app ZIP rollback does not undo infrastructure, DNS, roles or data changes.
- **Stop the website:** stopping this App Service does **not** stop Foundry agents.
  Use the customer's existing runtime incident process for real containment.
- **Remove resources:** obtain explicit approval, retain required evidence, verify the
  exact dedicated resource group, then remove it. Review the separate Entra registration
  and credentials with their owner. Do not run broad cleanup.

For a future real-stop test plan, use [Foundry onboarding](FOUNDRY-ONBOARDING.md).
