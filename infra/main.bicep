targetScope = 'subscription'

@allowed(['nonprod'])
param environmentName string = 'nonprod'
param location string
@minLength(3)
@maxLength(16)
param resourcePrefix string
@minLength(3)
@maxLength(24)
param storageAccountName string
@minLength(3)
@maxLength(44)
param cosmosAccountName string
@minLength(36)
@maxLength(36)
param entraClientId string
@secure()
param entraClientSecret string
param organizationName string = 'Customer'
param powerBiReportUrl string = ''
param powerBiOpenUrl string = ''

resource group 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: 'rg-${resourcePrefix}'
  location: location
  tags: {
    environment: environmentName
    purpose: 'ai-control-tower-foundation'
  }
}

module foundation 'modules/foundation.bicep' = {
  name: 'customer-foundation'
  scope: group
  params: {
    location: location
    resourcePrefix: resourcePrefix
    storageAccountName: storageAccountName
    cosmosAccountName: cosmosAccountName
    entraClientId: entraClientId
    entraClientSecret: entraClientSecret
    organizationName: organizationName
    powerBiReportUrl: powerBiReportUrl
    powerBiOpenUrl: powerBiOpenUrl
  }
}

output resourceGroupName string = group.name
output appServiceName string = foundation.outputs.appServiceName
output appServiceUrl string = foundation.outputs.appServiceUrl
output appServicePrincipalId string = foundation.outputs.appServicePrincipalId
output appConfigurationEndpoint string = foundation.outputs.appConfigurationEndpoint
