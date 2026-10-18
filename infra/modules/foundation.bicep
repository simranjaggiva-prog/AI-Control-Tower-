param location string
param resourcePrefix string
param storageAccountName string
param cosmosAccountName string
param entraClientId string
@secure()
param entraClientSecret string
param organizationName string
param powerBiReportUrl string
param powerBiOpenUrl string

var tags = { environment: 'nonprod', purpose: 'ai-control-tower-foundation' }

module network 'network.bicep' = {
  name: 'network'
  params: { location: location, resourcePrefix: resourcePrefix, tags: tags }
}
module plan 'app-service-plan.bicep' = {
  name: 'plan'
  params: { location: location, resourcePrefix: resourcePrefix, tags: tags }
}
module cosmos 'cosmos-db.bicep' = {
  name: 'cosmos'
  params: { location: location, cosmosAccountName: cosmosAccountName, tags: tags }
}
module storage 'storage.bicep' = {
  name: 'storage'
  params: { location: location, storageAccountName: storageAccountName, tags: tags }
}
module cosmosEndpoint 'cosmos-private-endpoint.bicep' = {
  name: 'cosmos-private-endpoint'
  params: {
    location: location
    resourcePrefix: resourcePrefix
    cosmosDbId: cosmos.outputs.id
    subnetId: network.outputs.privateEndpointSubnetId
    privateDnsZoneId: network.outputs.cosmosPrivateDnsZoneId
    tags: tags
  }
}
module storageEndpoint 'storage-private-endpoint.bicep' = {
  name: 'storage-private-endpoint'
  params: {
    location: location
    resourcePrefix: resourcePrefix
    storageAccountId: storage.outputs.id
    subnetId: network.outputs.privateEndpointSubnetId
    privateDnsZoneId: network.outputs.blobPrivateDnsZoneId
    tags: tags
  }
}
module logs 'log-analytics.bicep' = {
  name: 'logging'
  params: { location: location, resourcePrefix: resourcePrefix, tags: tags }
}
module insights 'app-insights.bicep' = {
  name: 'insights'
  params: { location: location, resourcePrefix: resourcePrefix, workspaceId: logs.outputs.id, tags: tags }
}
resource configuration 'Microsoft.AppConfiguration/configurationStores@2024-06-01' = {
  name: 'appcs-${resourcePrefix}'
  location: location
  tags: tags
  sku: { name: 'Standard' }
  properties: { disableLocalAuth: true, publicNetworkAccess: 'Disabled' }
}
resource configurationDns 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: 'privatelink.azconfig.io'
  location: 'global'
  tags: tags
}
resource configurationDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: configurationDns
  name: 'configuration-vnet'
  location: 'global'
  properties: { registrationEnabled: false, virtualNetwork: { id: network.outputs.vnetId } }
}
resource configurationEndpoint 'Microsoft.Network/privateEndpoints@2024-05-01' = {
  name: 'pep-appcs-${resourcePrefix}'
  location: location
  tags: tags
  properties: {
    subnet: { id: network.outputs.privateEndpointSubnetId }
    privateLinkServiceConnections: [{
      name: 'configuration'
      properties: { privateLinkServiceId: configuration.id, groupIds: ['configurationStores'] }
    }]
  }
}
resource configurationDnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = {
  parent: configurationEndpoint
  name: 'default'
  properties: { privateDnsZoneConfigs: [{ name: 'configuration', properties: { privateDnsZoneId: configurationDns.id } }] }
}
module app 'app-service.bicep' = {
  name: 'application'
  params: {
    location: location
    resourcePrefix: resourcePrefix
    planId: plan.outputs.id
    subnetId: network.outputs.appIntegrationSubnetId
    configurationEndpoint: configuration.properties.endpoint
    cosmosEndpoint: cosmos.outputs.uri
    blobEndpoint: storage.outputs.primaryBlobEndpoint
    entraClientId: entraClientId
    entraClientSecret: entraClientSecret
    organizationName: organizationName
    powerBiReportUrl: powerBiReportUrl
    powerBiOpenUrl: powerBiOpenUrl
    tags: tags
  }
}
module access 'read-only-access.bicep' = {
  name: 'read-only-access'
  params: {
    principalId: app.outputs.principalId
    configurationName: configuration.name
    storageAccountName: storage.outputs.name
    cosmosAccountName: cosmos.outputs.name
  }
}

output appServiceName string = app.outputs.name
output appServiceUrl string = app.outputs.url
output appServicePrincipalId string = app.outputs.principalId
output appConfigurationEndpoint string = configuration.properties.endpoint
