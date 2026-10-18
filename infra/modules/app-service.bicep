param location string
param resourcePrefix string
param planId string
param subnetId string
param configurationEndpoint string
param cosmosEndpoint string
param blobEndpoint string
param entraClientId string
@secure()
param entraClientSecret string
param organizationName string
param powerBiReportUrl string
param powerBiOpenUrl string
param tags object

resource app 'Microsoft.Web/sites@2023-12-01' = {
  name: 'app-${resourcePrefix}'
  location: location
  tags: tags
  kind: 'app,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: planId
    httpsOnly: true
    publicNetworkAccess: 'Enabled'
    virtualNetworkSubnetId: subnetId
    siteConfig: {
      linuxFxVersion: 'NODE|24-lts'
      appCommandLine: 'npm start'
      alwaysOn: true
      minTlsVersion: '1.2'
      scmMinTlsVersion: '1.2'
      ftpsState: 'Disabled'
      healthCheckPath: '/healthz'
      vnetRouteAllEnabled: true
      appSettings: [
        { name: 'NODE_ENV', value: 'production' }
        { name: 'HOST', value: '0.0.0.0' }
        { name: 'PORT', value: '3000' }
        { name: 'REQUIRE_AUTH', value: 'true' }
        { name: 'ENABLE_CONTROLS', value: 'false' }
        { name: 'SOLUTION_CONFIG_FILE', value: './config/solutions.json' }
        { name: 'ORGANIZATION_NAME', value: organizationName }
        { name: 'APPLICATION_NAME', value: 'AI Control Tower' }
        { name: 'APP_CONFIG_ENDPOINT', value: configurationEndpoint }
        { name: 'COSMOS_ENDPOINT', value: cosmosEndpoint }
        { name: 'STORAGE_BLOB_ENDPOINT', value: blobEndpoint }
        { name: 'AAD_CLIENT_SECRET', value: entraClientSecret }
        { name: 'POWERBI_REPORT_URL', value: powerBiReportUrl }
        { name: 'POWERBI_OPEN_URL', value: powerBiOpenUrl }
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'true' }
        { name: 'ENABLE_ORYX_BUILD', value: 'true' }
      ]
    }
  }
}
resource authentication 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: app
  name: 'authsettingsV2'
  properties: {
    platform: { enabled: true, runtimeVersion: '~1' }
    globalValidation: {
      requireAuthentication: true
      unauthenticatedClientAction: 'Return401'
      excludedPaths: ['/healthz', '/readyz']
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          clientId: entraClientId
          clientSecretSettingName: 'AAD_CLIENT_SECRET'
          openIdIssuer: '${environment().authentication.loginEndpoint}${tenant().tenantId}/v2.0'
        }
        validation: { allowedAudiences: [entraClientId, 'api://${entraClientId}'] }
      }
    }
    login: { tokenStore: { enabled: false } }
    httpSettings: { requireHttps: true }
  }
}
resource scmPolicy 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2023-12-01' = {
  parent: app
  name: 'scm'
  properties: { allow: false }
}
resource ftpPolicy 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2023-12-01' = {
  parent: app
  name: 'ftp'
  properties: { allow: false }
}

output name string = app.name
output url string = 'https://${app.properties.defaultHostName}'
output principalId string = app.identity.principalId
