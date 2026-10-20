# AI Control Tower: start here

A starting point for customers to set up an AI Control Tower in **non-production**.

**You get:** a web app, customer agent inventory, Azure sign-in, and infrastructure templates.

**You do not get yet:** a working kill switch or live agent monitoring. Pause/stop/resume stay disabled server-side. The default customer inventory is empty and missing metrics are shown as unavailable.

**New UI:** Dashboard, Solutions, Agent detail and Controls follow the four-screen review design. Select **Illustrative preview** to see the fictitious NOC, DevOps and Grant Client User Access mock-ups. Preview figures are not actual MUFG results and never enter the customer inventory or API responses. Preview pause actions are local simulations, not runtime commands. Branding remains subject to approval. The design PDF remains local and is not distributed with this repository.

## 1. Try it on your laptop

You need **Node.js 24** and **PowerShell 7**.

Open PowerShell in this folder, then run these commands one at a time. Stop if any command fails.

```powershell
npm ci
npm test
Copy-Item .\.env.sample .\.env
npm run preview
```

If `.env` already exists, keep it rather than copying over it.

Open **http://127.0.0.1:3000**.

You should see an empty inventory and disabled controls. That is expected.
The Dashboard displays connection-readiness cards until an authorised Power BI report is configured. Use the top navigation to explore all four screens, or enable **Illustrative preview** for the populated mock-up.
This laptop preview has no sign-in: do not share it over a network. Press `Ctrl+C` to stop.

## 2. Add your own agents

Edit [config/solutions.json](config/solutions.json) with your approved non-production agent details.

Keep `apiType` as `unknown` until confirmed. Do not add passwords, keys or business data.

Use the [inventory example and field rules](docs/DEPLOYMENT-GUIDE.md#3-register-your-own-non-production-solutions), then check your changes:

```powershell
npm run check-config
```

**Adding an agent lists it in the app. It does not connect to, monitor or stop it.**

## 3. Put it in Azure

Ask your Azure platform owner to follow the [deployment guide](docs/DEPLOYMENT-GUIDE.md).

They will:

1. Approve the non-production environment, network design and costs.
2. Set up Microsoft Entra sign-in and assign users.
3. Fill in the customer settings and deploy the infrastructure.
4. Package and deploy the app with your inventory.
5. Check sign-in, dependency access and disabled controls.

The default web endpoint is **public and sign-in protected**, not private.
The templates create separate resources; they do not automatically reuse your existing services.

## 4. Demo the foundation

- Sign in and show your registered customer agents.
- Optionally show your existing authorised Power BI report.
- Explain that runtime status is unknown and stop/resume are not connected.
- For a design walkthrough, enable **Illustrative preview**. NOC's pause walkthrough requires a reason, then an explicit simulated acknowledgement before its simulated state reads Paused. No network command is sent. Disable preview to return to real inventory and the configured Power BI report; preview state resets.

Configure `POWERBI_REPORT_URL` with a secure `/reportEmbed` URL and `POWERBI_OPEN_URL` with the authorised report link. Preview mode temporarily hides the embedded report so example figures cannot be confused with its data. Connection refresh preserves an unchanged report iframe; Power BI owns its own data-refresh cadence.

**To demo a real kill switch next:** [identify your Foundry API](docs/FOUNDRY-ONBOARDING.md), then implement and test the matching enforcement adapter.

## Only read more when needed

| Need | Open |
| --- | --- |
| A simple explanation with diagrams | [Customer guide](docs/CUSTOMER-GUIDE.md) |
| Exact Azure setup commands | [Deployment guide](docs/DEPLOYMENT-GUIDE.md) |
| Checks and troubleshooting | [Validation checklist](docs/NONPROD-VALIDATION.md) |
| Event Hubs to Fabric, DirectQuery and embedding | [Real-time dashboard setup](docs/REALTIME-DASHBOARD-SETUP.md) |

**Validation so far:** local tests and Bicep compilation passed. Azure deployment and real agent enforcement have not been tested.
