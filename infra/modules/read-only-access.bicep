param principalId string
param configurationName string
param storageAccountName string
param cosmosAccountName string

resource configuration 'Microsoft.AppConfiguration/configurationStores@2024-06-01' existing = {
  name: configurationName
}
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}
resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = {
  name: cosmosAccountName
}
var configurationReader = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '516239f1-63e1-4d78-a4de-a74fb236a071')
var blobReader = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '2a2b9908-6ea1-4ae2-8e65-a410df84e7d1')
resource configurationAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(configuration.id, principalId, configurationReader)
  scope: configuration
  properties: { principalId: principalId, principalType: 'ServicePrincipal', roleDefinitionId: configurationReader }
}
resource blobAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, principalId, blobReader)
  scope: storage
  properties: { principalId: principalId, principalType: 'ServicePrincipal', roleDefinitionId: blobReader }
}
resource cosmosAccess 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-05-15' = {
  parent: cosmos
  name: guid(cosmos.id, principalId, 'foundation-reader')
  properties: {
    principalId: principalId
    roleDefinitionId: '${cosmos.id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000001'
    scope: cosmos.id
  }
}
