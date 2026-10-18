[CmdletBinding()]
param([Parameter(Mandatory = $true)][string] $ParametersPath)
$ErrorActionPreference = 'Stop'
$parameters = (Get-Content -LiteralPath $ParametersPath -Raw | ConvertFrom-Json).parameters
if ($null -eq $parameters) { throw 'Expected an ARM deployment parameters file' }
if ($parameters.environmentName.value -ne 'nonprod') { throw 'environmentName must be nonprod' }
if ($parameters.resourcePrefix.value -cnotmatch '^[a-z][a-z0-9-]{1,14}[a-z0-9]$') { throw 'resourcePrefix must be a 3-16 character lowercase slug starting with a letter' }
if ($parameters.storageAccountName.value -cnotmatch '^[a-z0-9]{3,24}$') { throw 'storageAccountName must contain 3-24 lowercase letters or digits' }
if ($parameters.cosmosAccountName.value -cnotmatch '^[a-z0-9][a-z0-9-]{1,42}[a-z0-9]$') { throw 'cosmosAccountName must contain 3-44 lowercase letters, digits or interior hyphens' }
$clientId = [Guid]::Empty
if (-not [Guid]::TryParse($parameters.entraClientId.value, [ref]$clientId) -or $clientId -eq [Guid]::Empty) { throw 'entraClientId must be a real non-empty GUID' }
if ($parameters.location.value -cnotmatch '^[a-z]+[a-z0-9]*$') { throw 'location must be an Azure region identifier' }
if ($null -ne $parameters.entraClientSecret -and $null -eq $parameters.entraClientSecret.reference) {
  throw 'Do not put a client secret value in this file. Supply it securely at deployment or use a Key Vault parameter reference.'
}
Write-Host 'Local naming and non-production parameter checks passed. Availability, policy, RBAC, quotas and Azure deployment have NOT been checked.'
