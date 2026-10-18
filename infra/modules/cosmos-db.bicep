param location string
param cosmosAccountName string
param tags object

var databaseName = 'command-db'

resource cosmosDbAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: cosmosAccountName
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    publicNetworkAccess: 'Disabled'
    disableLocalAuth: true
    capabilities: [
      {
        name: 'EnableServerless'
      }
    ]
  }
}

// SQL Database
resource sqlDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  name: databaseName
  parent: cosmosDbAccount
  properties: {
    resource: {
      id: databaseName
    }
  }
}

// Configuration container
resource configContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  name: 'configuration'
  parent: sqlDatabase
  properties: {
    resource: {
      id: 'configuration'
      partitionKey: {
        paths: [
          '/configId'
        ]
        kind: 'Hash'
      }
      defaultTtl: -1
    }
  }
}

// Commands container
resource commandsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  name: 'commands'
  parent: sqlDatabase
  properties: {
    resource: {
      id: 'commands'
      partitionKey: {
        paths: [
          '/solutionId'
        ]
        kind: 'Hash'
      }
      defaultTtl: -1
      uniqueKeyPolicy: {
        uniqueKeys: [
          {
            paths: [
              '/idempotencyKey'
            ]
          }
        ]
      }
    }
  }
}

// Acknowledgements container
resource acknowledgementsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  name: 'acknowledgements'
  parent: sqlDatabase
  properties: {
    resource: {
      id: 'acknowledgements'
      partitionKey: {
        paths: [
          '/commandId'
        ]
        kind: 'Hash'
      }
      defaultTtl: -1
    }
  }
}

output id string = cosmosDbAccount.id
output name string = cosmosDbAccount.name
output uri string = cosmosDbAccount.properties.documentEndpoint
