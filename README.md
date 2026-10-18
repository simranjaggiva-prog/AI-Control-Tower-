# AI Control Tower: start here

A starting point for customers to set up an AI Control Tower in **non-production**.

**You get:** a web app, customer agent inventory, Azure sign-in, and infrastructure templates.

**You do not get yet:** a working kill switch or live agent monitoring. Stop/resume stay disabled. No sample agents or made-up metrics are included.

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

**To demo a real kill switch next:** [identify your Foundry API](docs/FOUNDRY-ONBOARDING.md), then implement and test the matching enforcement adapter.

## Only read more when needed

| Need | Open |
| --- | --- |
| A simple explanation with diagrams | [Customer guide](docs/CUSTOMER-GUIDE.md) |
| Exact Azure setup commands | [Deployment guide](docs/DEPLOYMENT-GUIDE.md) |
| Checks and troubleshooting | [Validation checklist](docs/NONPROD-VALIDATION.md) |

**Validation so far:** local tests and Bicep compilation passed. Azure deployment and real agent enforcement have not been tested.
