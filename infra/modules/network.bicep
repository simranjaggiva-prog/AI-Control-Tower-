param location string
param resourcePrefix string
param tags object

var vnetName = 'vnet-${resourcePrefix}'

resource virtualNetwork 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: vnetName
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.20.0.0/16'
      ]
    }
  }
}

resource appIntegrationSubnet 'Microsoft.Network/virtualNetworks/subnets@2024-05-01' = {
  name: 'app-integration'
  parent: virtualNetwork
  properties: {
    addressPrefix: '10.20.1.0/24'
    delegations: [
      {
        name: 'app-service-delegation'
        properties: {
          serviceName: 'Microsoft.Web/serverFarms'
        }
      }
    ]
  }
}

resource privateEndpointSubnet 'Microsoft.Network/virtualNetworks/subnets@2024-05-01' = {
  name: 'private-endpoints'
  parent: virtualNetwork
  properties: {
    addressPrefix: '10.20.2.0/24'
    privateEndpointNetworkPolicies: 'Disabled'
  }
}

resource cosmosPrivateDnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: 'privatelink.documents.azure.com'
  location: 'global'
  tags: tags
}

resource cosmosPrivateDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  name: 'cosmos-vnet-link'
  parent: cosmosPrivateDnsZone
  location: 'global'
  tags: tags
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: virtualNetwork.id
    }
  }
}

resource blobPrivateDnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: 'privatelink.blob.${environment().suffixes.storage}'
  location: 'global'
  tags: tags
}

resource blobPrivateDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  name: 'blob-vnet-link'
  parent: blobPrivateDnsZone
  location: 'global'
  tags: tags
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: virtualNetwork.id
    }
  }
}

output vnetId string = virtualNetwork.id
output appIntegrationSubnetId string = appIntegrationSubnet.id
output privateEndpointSubnetId string = privateEndpointSubnet.id
output cosmosPrivateDnsZoneId string = cosmosPrivateDnsZone.id
output blobPrivateDnsZoneId string = blobPrivateDnsZone.id
