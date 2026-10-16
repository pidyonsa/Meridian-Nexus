targetScope = 'resourceGroup'
param location string = 'southafricanorth'
param appName string
param planName string = 'meridian-field-dashboards-plan'
param publicAccessEnabled bool = false
@allowed(['azure-snapshot', 'google-proxy'])
param dataMode string = 'azure-snapshot'
param dashboardContainerUrl string = 'https://meridianfield730011.blob.core.windows.net/dashboard-data/'
var tags = { application: 'Meridian Field Dashboards', edition: 'public-reports', owner: 'Meridian', dataMigration: 'verified-snapshot' }
resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: planName
  location: location
  tags: tags
  kind: 'linux'
  sku: { name: 'B2', capacity: 1 }
  properties: { reserved: true }
}
resource app 'Microsoft.Web/sites@2024-04-01' = {
  name: appName
  location: location
  tags: tags
  kind: 'app,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    publicNetworkAccess: 'Enabled'
    siteConfig: {
      linuxFxVersion: 'NODE|24-lts'
      appCommandLine: 'npm start'
      alwaysOn: true
      minTlsVersion: '1.2'
      scmMinTlsVersion: '1.2'
      ftpsState: 'Disabled'
      http20Enabled: true
      healthCheckPath: '/healthz'
      appSettings: [
        {name: 'NODE_ENV', value: 'production'}
        {name: 'PUBLIC_DASHBOARDS_ENABLED', value: publicAccessEnabled ? 'true' : 'false'}
        {name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'true'}
        {name: 'WEBSITE_NODE_DEFAULT_VERSION', value: '~24'}
        {name: 'DASHBOARD_DATA_MODE', value: dataMode}
        {name: 'AZURE_DASHBOARD_CONTAINER_URL', value: dashboardContainerUrl}
      ]
    }
  }
}
resource auth 'Microsoft.Web/sites/config@2024-04-01' = {
  parent: app
  name: 'authsettingsV2'
  properties: { platform: {enabled: false}, globalValidation: {requireAuthentication: false} }
}
resource noScmPassword 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2024-04-01' = {parent: app, name: 'scm', properties: {allow: false}}
resource noFtpPassword 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2024-04-01' = {parent: app, name: 'ftp', properties: {allow: false}}
output webAppName string = app.name
output attendanceUrl string = 'https://${app.properties.defaultHostName}/attendance'
output ordersUrl string = 'https://${app.properties.defaultHostName}/franchise-orders'
