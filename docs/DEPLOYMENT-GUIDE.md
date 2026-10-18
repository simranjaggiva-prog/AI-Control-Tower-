# Install the foundation in Azure

**For:** the customer's Azure platform/deployment owner.

**Outcome:** users can sign in, view your registered agents and check Azure connections.
**Not included:** live agent monitoring or a working kill switch. Keep `ENABLE_CONTROLS=false`.

Want only a laptop preview? Use the [README](../README.md).
For the big picture, see the [customer guide](CUSTOMER-GUIDE.md).

## 1. Get approval first

You need Node.js 24, npm, PowerShell 7, Azure CLI and Bicep support.
Run all commands from the **package root**, not this `docs` folder.
Run commands one at a time and stop if one fails.

Ask the customer platform and identity owners to approve:

- A dedicated non-production environment, region, names and ongoing Azure costs.
- Permission for subscription-level deployments and resource role assignments.
- An Entra app registration, user assignments and a managed sign-in secret.
- The network design below. Use approved temporary deployment privileges.

### What the template creates

| Resource | Purpose |
| --- | --- |
| Resource group and Linux B1 App Service | Hosts the Node.js 24 website |
| Microsoft Entra authentication | Protects sign-in |
| VNet, private endpoints and DNS | Connects the app to private data services |
| Standard App Configuration, serverless Cosmos DB, Blob Storage | Foundation services with read-only app access |
| Application Insights and Log Analytics | Monitoring resources only; app telemetry is not wired up |

**Network review:** the web and deployment (SCM) endpoints are public and
sign-in protected. Private data connections do not make web access private.
If private web access is mandatory, adapt the templates and use an in-network runner first.

Default network ranges are `10.20.0.0/16`, `10.20.1.0/24` and `10.20.2.0/24`.
Check overlap, DNS, routing, egress and customer policy before deployment.

This creates separate resources; shared-service reuse needs reviewed template changes.
It does not create or change Foundry agents, models, APIM or Fabric.
Cosmos read access covers the new isolated account. No command/audit writes or
locked immutable evidence retention are configured.

## 2. Check the application locally

```powershell
npm ci
npm test
npm run build
npm run check-config
```

`build` checks JavaScript syntax only. It does not generate assets or a `dist` folder.
To preview the screen, follow the [README](../README.md#1-try-it-on-your-laptop).

## 3. Register your own non-production solutions

Edit [config/solutions.json](../config/solutions.json).
It starts as `{"solutions":[]}`. You can leave it empty or replace it with your real entries.

This is a template only. Replace every placeholder before adding it:

```json
{
  "solutions": [
    {
      "id": "<customer-solution-slug>",
      "name": "<customer-solution-name>",
      "owner": "<customer-owner-or-team>",
      "environment": "nonprod",
      "foundryProjectEndpoint": "https://<account>.services.ai.azure.com/api/projects/<project>",
      "apiType": "unknown"
    }
  ]
}
```

| Field | Rule |
| --- | --- |
| `id` | Unique lowercase letters/digits with hyphens between words |
| `name`, `owner` | Actual customer solution and accountable owner |
| `environment` | Exactly `nonprod` |
| `foundryProjectEndpoint` | Actual HTTPS project endpoint in the format above |
| `apiType` | `unknown` until verified; otherwise `classic` or `response` |
| `agentId` | Required for `classic` |
| `agentName`, `agentVersion` | Both required for `response`; version must be a string, such as `"1"` |

Only these metadata fields are accepted, with only `solutions` at the JSON root.
Never include keys, passwords, prompts or business data.
See [Foundry onboarding](FOUNDRY-ONBOARDING.md) to identify the API.

After each edit, run `npm run check-config`. Then test, package and redeploy.
Tests use temporary fixtures; do not clear your real inventory to run them.
Registration is not automatic discovery, live monitoring or permission to stop an agent.

## 4. Set up Microsoft Entra sign-in

In the approved customer tenant:

1. Create a **single-tenant app registration**. Save its Application (client) ID.
2. Add a **Web** redirect URI: `https://app-<resourcePrefix>.azurewebsites.net/.auth/login/aad/callback`.
3. Add enabled app roles `AIControlRoom.Viewer` and `AIControlRoom.Operator`.
   Use Users/Groups as member types (`["User"]` in the manifest).
4. In the **Enterprise application**, set **Assignment required? = Yes**.
   Assign intended users/groups to one of the roles.
5. Create a client secret through the approved process. Save its **value** securely;
   name an owner for expiry and rotation.

Neither role enables controls. Users without an accepted role cannot read the APIs.
This is a website sign-in credential, not a Foundry credential.
The baseline stores it in the restricted App Service setting `AAD_CLIENT_SECRET`,
not a Key Vault reference. No Key Vault is created.

## 5. Fill in your Azure settings

```powershell
Copy-Item .\infra\main.parameters.example.json .\infra\main.parameters.local.json
```

Edit the local copy. Keep it out of source control.

| Setting | Your value |
| --- | --- |
| `environmentName` | `nonprod` |
| `location` | Approved Azure region |
| `resourcePrefix` | Unique lowercase slug, 3-16 characters; starts with a letter, ends with letter/digit |
| `storageAccountName` | Globally unique; 3-24 lowercase letters/digits |
| `cosmosAccountName` | Globally unique; 3-44 lowercase letters/digits, optional interior hyphens |
| `entraClientId` | Your app registration's client ID |
| `organizationName` | Customer display name |
| `powerBiReportUrl`, `powerBiOpenUrl` | Optional; otherwise leave empty |

Report URLs must be HTTPS on `app.powerbi.com`. The embed path must be `/reportEmbed`.
Never use Publish to web (`/view`). Report permissions and licensing are separate.
No report or data pipeline is created.

**Do not put a secret value in the parameter file.** Run the local check:

```powershell
.\scripts\Test-DeploymentParameters.ps1 -ParametersPath .\infra\main.parameters.local.json
```

This checks formats only, not real resource availability, policy, quotas or permissions.
The prefix creates names such as `rg-<prefix>`, `app-<prefix>` and `appcs-<prefix>`.
Have the platform owner check their availability.

## 6. Review and deploy the infrastructure

**Prefer an approved pipeline with protected secret injection.**
The interactive example below avoids writing the secret into files/history,
but its resolved value may be visible in process arguments. Use it only if policy permits.
Do not capture secrets in logs or transcripts.

```powershell
az login
$subscriptionId = '<customer-nonprod-subscription-id>'
$location = '<approved-region>'
$deploymentName = 'ai-control-tower-foundation-nonprod'
az account set --subscription $subscriptionId
az account show --query '{name:name,id:id,tenantId:tenantId}' --output table
$credential = Get-Credential -UserName 'entra-client-secret' -Message 'Enter the approved app secret as the password'
az deployment sub what-if --name $deploymentName --location $location --template-file '.\infra\main.bicep' --parameters '@.\infra\main.parameters.local.json' --parameters "entraClientSecret=$($credential.GetNetworkCredential().Password)"
```

Have the platform owner review the proposed changes. Stop for unexpected resources,
network conflicts, policy failures or unapproved costs. What-if is not a connectivity test.

Only after approval:

```powershell
az deployment sub create --name $deploymentName --location $location --template-file '.\infra\main.bicep' --parameters '@.\infra\main.parameters.local.json' --parameters "entraClientSecret=$($credential.GetNetworkCredential().Password)"
Remove-Variable credential
```

An existing approved ARM Key Vault **parameter reference** is also supported by the
parameter checker. Use your pipeline's matching procedure instead of the interactive
secret above; do not mix methods. It does not make the App Service setting a Key Vault reference.

Read the non-secret outputs:

```powershell
$outputs = az deployment sub show --name $deploymentName --query properties.outputs --output json | ConvertFrom-Json
$resourceGroup = $outputs.resourceGroupName.value
$appName = $outputs.appServiceName.value
$appUrl = $outputs.appServiceUrl.value
$outputs
```

Confirm the subscription, resource group and app before continuing.
Allow time for identity roles to propagate. Do not add write roles to bypass a failure.

## 7. Package and deploy the application

Save your approved inventory first. Choose a **new ZIP path outside the package**
in an existing approved folder:

```powershell
$releaseZip = '<absolute-path-outside-this-package>\ai-control-tower-foundation.zip'
.\scripts\New-Release.ps1 -OutputPath $releaseZip
az webapp deploy --resource-group $resourceGroup --name $appName --src-path $releaseZip --type zip
```

The script reruns tests, syntax and inventory checks. It refuses to overwrite a ZIP.
Only application source, public assets, inventory and npm manifests are packaged,
with `package.json` at the ZIP root. Secrets, `.env`, tests and `node_modules` are excluded.
Unexpected files are rejected; do not broaden the allowlist casually.

Use a current Entra-capable CLI/runner. **Do not enable basic publishing authentication**
or use publishing profiles to work around deployment failure.
The template enables Oryx dependency installation and sets startup to `npm start`.
Check deployment logs to confirm npm dependencies were restored.
`npm start` does not load `.env`; Azure settings are supplied by the template.

## 8. Sign in and check the result

Open `https://<actual-app-host>/.auth/login/aad?post_login_redirect_uri=/`.
Check the hostname matches the registered callback.
The app returns 401 rather than automatically redirecting an unsigned-in browser.

Follow the [validation checklist](NONPROD-VALIDATION.md). Expect:

- Assigned Viewer/Operator access; no-role access denied.
- Empty or approved customer inventory, runtime status `unknown`.
- Azure readiness passes; controls remain disabled.
- Authenticated write requests return 403 `ENFORCEMENT_NOT_AVAILABLE`.

`/healthz` checks the process; `/readyz` checks configuration and foundation connections.
Neither checks Foundry or proves an agent stopped. A stalled readiness check returns
503 after 15 seconds. Both health routes are accessible without sign-in.

**Complete means foundation installed and checked, not kill switch delivered.**
For updates: edit inventory -> validate -> test -> package -> redeploy -> check.
For rollback or removal, use the [validation guide](NONPROD-VALIDATION.md#roll-back-or-remove-the-foundation).

## References

- [App Service ZIP deployment](https://learn.microsoft.com/en-us/azure/app-service/deploy-zip)
- [App Service Entra sign-in](https://learn.microsoft.com/en-us/azure/app-service/configure-authentication-provider-aad)
- [Azure subscription deployment CLI](https://learn.microsoft.com/en-us/cli/azure/deployment/sub)
