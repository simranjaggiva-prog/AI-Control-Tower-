# Before connecting a real kill switch

**For:** the person who owns the customer's Foundry agent application.

**Goal:** identify how that application runs agents. Different APIs need different
ways to stop work. Do not guess from the Foundry portal name.

This package does not call Foundry or include stop code.
Keep `ENABLE_CONTROLS=false`. Changing the inventory API type does not enable controls.

## 1. Collect these details

Use your actual non-production application and approved, redacted diagnostics.

| Ask the agent owner for | Why it matters |
| --- | --- |
| Foundry project endpoint | Identifies the correct project |
| SDK package and version, or REST API version | Identifies the supported operations |
| The code/request used to start an agent | Shows which API the application actually uses |
| Agent ID, or agent name and version | Identifies the agent definition |
| How the app records each execution ID | Needed to target active work, not just an agent definition |
| Callers, schedules, queues, retries and tools | Finds other paths that could keep work running |
| Named application and platform owners | Establishes who approves and tests the change |

Do not collect tokens, passwords, prompts, responses or business records.
No Foundry credentials are needed to register inventory in this release.

## 2. Choose the inventory API type

| Evidence from the actual application | Set `apiType` to | Required inventory identifiers |
| --- | --- | --- |
| Not enough evidence yet | `unknown` | None |
| Confirmed classic threads/runs API | `classic` | `agentId` |
| Confirmed Responses-based API | `response` | `agentName` and `agentVersion` |

All identifier values must be non-empty strings. Use `"1"`, not `1`, for a version.
Check the Microsoft documentation for the **exact API and SDK version**.
A portal screenshot or an ID prefix alone is not enough.

Update [the customer inventory](../config/solutions.json), then run from the package root:

```powershell
npm run check-config
```

If the API is still unclear, leave it `unknown`. The foundation can still be demonstrated.

## 3. Agree what "stop" must do

A real kill switch needs more than a configuration flag:

```text
Block new requests -> Deal with active executions -> Contain tool/queue work
                   -> Check the actual outcome -> Report it honestly
```

- **Block new work:** enforce the block at every real entry point.
- **Handle active work:** use the confirmed API's supported cancellation operation, if available.
- **Contain external work:** tools and queued jobs may continue independently.
- **Verify:** a cancellation request being accepted is not proof that work stopped.

Some actions cannot be undone. Document those limits before implementation.

## 4. Implement and test separately

An **adapter** is the code that connects a Control Tower action to the customer's
specific runtime API. It is future work, not included in this package.

Before releasing one, require these tests:

| Test | Must prove |
| --- | --- |
| Access and approval | Unauthorised, expired or unapproved commands are rejected |
| Correct target | Wrong tenant, project, agent or execution cannot be affected |
| New work | Requests are blocked at real entry points; bypass paths are covered |
| Active work | The target execution's documented final state is independently checked |
| Tools and queues | External work meets the agreed containment rules |
| Retries and restarts | Duplicate commands are safe; blocked work does not silently restart |
| Failures and timeouts | Results show failed, partial or unknown, never false success |
| Resume | Only authorised recovery can restore work |
| Evidence | Request, approval, action and observed outcome can be traced safely |

Use approved, low-impact customer non-production workloads. Approve any failure
testing first. Define timeouts, least-privilege access and evidence retention.
The foundation's read-only roles do not permit the future control or audit writes.

**Release gate:** implementation review, security approval, real test evidence and
customer sign-off. Never label a flag update, mock response or readiness check "agent stopped".

For today's demo, prove controls are **denied**: [validation checklist](NONPROD-VALIDATION.md).

Reference: [Microsoft Foundry documentation](https://learn.microsoft.com/en-us/azure/ai-foundry/).
