targetScope = 'resourceGroup'

@description('Use a new, dedicated resource group. This deployment does not migrate the existing portal automatically.')
@minLength(3)
@maxLength(16)
param prefix string = 'meridian-nexus'
@allowed(['southafricanorth'])
param location string = 'southafricanorth'
param tenantId string = tenant().tenantId
@description('Single-tenant Entra app registration with Nexus.Reader and Nexus.Admin app roles.')
param entraClientId string
@description('Operator allowed to set the three integration secrets. Public Entra object ID, not a secret or application ID.')
#disable-next-line secure-secrets-in-params
param secretsOfficerObjectId string
param planSku string = 'B1'

var suffix = uniqueString(resourceGroup().id)
var appName = '${prefix}-${suffix}'
var storageName = 'nexus${suffix}'
var vaultName = 'nx-${suffix}'

resource network 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: '${prefix}-vnet'
  location: location
  properties: {
    addressSpace: { addressPrefixes: ['10.42.0.0/16'] }
    subnets: [
      {name: 'web', properties: {addressPrefix: '10.42.1.0/24', delegations: [{name:'web',properties:{serviceName:'Microsoft.Web/serverFarms'}}]}}
      {name: 'data', properties: {addressPrefix: '10.42.2.0/24', privateEndpointNetworkPolicies:'Disabled'}}
    ]
  }
}
resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: '${prefix}-plan'
  location: location
  kind: 'linux'
  sku: {name:planSku}
  properties: {reserved:true}
}
resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-11-15' = {
  name: 'nexus-${suffix}'
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType:'Standard'
    locations:[{locationName:location,failoverPriority:0,isZoneRedundant:false}]
    capabilities:[{name:'EnableServerless'}]
    consistencyPolicy:{defaultConsistencyLevel:'Session'}
    disableLocalAuth:true
    publicNetworkAccess:'Disabled'
    minimalTlsVersion:'Tls12'
    backupPolicy:{type:'Continuous',continuousModeProperties:{tier:'Continuous7Days'}}
  }
}
resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-11-15' = {
  parent:cosmos
  name:'nexus'
  properties:{resource:{id:'nexus'}}
}
resource container 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-11-15' = {
  parent:database
  name:'snapshots'
  properties:{resource:{id:'snapshots',partitionKey:{paths:['/dataset'],kind:'Hash'},indexingPolicy:{automatic:true,indexingMode:'consistent',includedPaths:[{path:'/*'}],excludedPaths:[{path:'/rows/*'},{path:'/metadata/*'}]}}}
}
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name:storageName
  location:location
  kind:'StorageV2'
  sku:{name:'Standard_LRS'}
  properties:{supportsHttpsTrafficOnly:true,minimumTlsVersion:'TLS1_2',allowBlobPublicAccess:false,allowSharedKeyAccess:false,publicNetworkAccess:'Disabled'}
}
resource blobs 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent:storage
  name:'default'
  properties:{isVersioningEnabled:true,deleteRetentionPolicy:{enabled:true,days:30},containerDeleteRetentionPolicy:{enabled:true,days:30}}
}
resource sources 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent:blobs
  name:'sources'
  properties:{publicAccess:'None'}
}
resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name:vaultName
  location:location
  properties:{tenantId:tenantId,sku:{family:'A',name:'standard'},enableRbacAuthorization:true,enablePurgeProtection:true,enableSoftDelete:true,softDeleteRetentionInDays:90,publicNetworkAccess:'Enabled'}
}
// Key Vault's public control/data endpoint is authenticated with Entra RBAC; no anonymous access.
// Data and raw sources use private endpoints. Harden Vault networking after secret provisioning.
resource app 'Microsoft.Web/sites@2024-04-01' = {
  name:appName
  location:location
  kind:'app,linux'
  identity:{type:'SystemAssigned'}
  properties:{
    serverFarmId:plan.id
    httpsOnly:true
    virtualNetworkSubnetId:resourceId('Microsoft.Network/virtualNetworks/subnets',network.name,'web')
    siteConfig:{
      linuxFxVersion:'NODE|24-lts'
      alwaysOn:true
      minTlsVersion:'1.2'
      scmMinTlsVersion:'1.2'
      ftpsState:'Disabled'
      http20Enabled:true
      appCommandLine:'npm start'
      vnetRouteAllEnabled:true
      appSettings:[
        {name:'NODE_ENV',value:'production'}
        {name:'ENTRA_TENANT_ID',value:tenantId}
        {name:'ENTRA_CLIENT_ID',value:entraClientId}
        {name:'PUBLIC_ORIGIN',value:'https://${appName}.azurewebsites.net'}
        {name:'COSMOS_ENDPOINT',value:cosmos.properties.documentEndpoint}
        {name:'COSMOS_DATABASE',value:'nexus'}
        {name:'COSMOS_CONTAINER',value:'snapshots'}
        {name:'STORAGE_ACCOUNT_URL',value:storage.properties.primaryEndpoints.blob}
        {name:'STORAGE_CONTAINER',value:'sources'}
        {name:'ENTRA_CLIENT_SECRET',value:'@Microsoft.KeyVault(SecretUri=https://${vault.name}.vault.azure.net/secrets/entra-client-secret/)'}
        {name:'GEO_REP_OPEN_API_ID',value:'@Microsoft.KeyVault(SecretUri=https://${vault.name}.vault.azure.net/secrets/geo-api-id/)'}
        {name:'GEO_REP_OPEN_API_KEY',value:'@Microsoft.KeyVault(SecretUri=https://${vault.name}.vault.azure.net/secrets/geo-api-key/)'}
        {name:'GEO_ORDERS_ENABLED',value:'false'}
        {name:'ATTENDANCE_INBOX_ENABLED',value:'false'}
        {name:'WEBJOBS_DISABLE_SCHEDULE',value:'1'}
        {name:'SCM_DO_BUILD_DURING_DEPLOYMENT',value:'true'}
      ]
    }
  }
}
resource auth 'Microsoft.Web/sites/config@2024-04-01' = {
  parent:app
  name:'authsettingsV2'
  properties:{
    platform:{enabled:true,runtimeVersion:'~1'}
    globalValidation:{requireAuthentication:true,unauthenticatedClientAction:'Return401',excludedPaths:['/healthz','/','/index.html','/shell.js','/shell.css','/attendance.js','/attendance.css','/attendance-base.css','/orders.js','/orders.css','/assets/*','/vendor/*']}
    identityProviders:{azureActiveDirectory:{enabled:true,registration:{clientId:entraClientId,clientSecretSettingName:'ENTRA_CLIENT_SECRET',openIdIssuer:'${environment().authentication.loginEndpoint}${tenantId}/v2.0'},validation:{allowedAudiences:[entraClientId]},login:{loginParameters:['scope=openid profile email offline_access']}}}
    login:{tokenStore:{enabled:true},cookieExpiration:{convention:'FixedTime',timeToExpiration:'08:00:00'}}
    httpSettings:{requireHttps:true}
  }
}
resource noScmPassword 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2024-04-01' = {parent:app,name:'scm',properties:{allow:false}}
resource noFtpPassword 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2024-04-01' = {parent:app,name:'ftp',properties:{allow:false}}
resource cosmosAccess 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-11-15' = {
  parent:cosmos
  name:guid(cosmos.id,app.id,'data')
  properties:{principalId:app.identity.principalId,roleDefinitionId:'${cosmos.id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002',scope:'${cosmos.id}/dbs/nexus/colls/snapshots'}
  dependsOn:[container]
}
resource blobAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name:guid(sources.id,app.id,'blob')
  scope:sources
  properties:{principalId:app.identity.principalId,principalType:'ServicePrincipal',roleDefinitionId:subscriptionResourceId('Microsoft.Authorization/roleDefinitions','ba92f5b4-2d11-453d-a403-e96b0029c9fe')}
}
resource secretRead 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name:guid(vault.id,app.id,'read')
  scope:vault
  properties:{principalId:app.identity.principalId,principalType:'ServicePrincipal',roleDefinitionId:subscriptionResourceId('Microsoft.Authorization/roleDefinitions','4633458b-17de-408a-b874-0445c86b69e6')}
}
resource secretWrite 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name:guid(vault.id,secretsOfficerObjectId,'write')
  scope:vault
  properties:{principalId:secretsOfficerObjectId,principalType:'User',roleDefinitionId:subscriptionResourceId('Microsoft.Authorization/roleDefinitions','b86a8fe4-44ce-4948-aee5-eccb2c155cd7')}
}
var connections=[{name:'cosmos',resourceId:cosmos.id,group:'Sql',zone:'privatelink.documents.azure.com'},{name:'blob',resourceId:storage.id,group:'blob',zone:'privatelink.blob.${environment().suffixes.storage}'}]
resource dns 'Microsoft.Network/privateDnsZones@2024-06-01' = [for connection in connections:{name:connection.zone,location:'global'}]
resource dnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = [for (connection,i) in connections:{parent:dns[i],name:'nexus-vnet',location:'global',properties:{registrationEnabled:false,virtualNetwork:{id:network.id}}}]
resource endpoints 'Microsoft.Network/privateEndpoints@2024-05-01' = [for connection in connections:{
  name:'${prefix}-${connection.name}-private'
  location:location
  properties:{subnet:{id:resourceId('Microsoft.Network/virtualNetworks/subnets',network.name,'data')},privateLinkServiceConnections:[{name:connection.name,properties:{privateLinkServiceId:connection.resourceId,groupIds:[connection.group]}}]}
}]
resource zoneGroups 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = [for (connection,i) in connections:{parent:endpoints[i],name:'default',properties:{privateDnsZoneConfigs:[{name:connection.name,properties:{privateDnsZoneId:dns[i].id}}]}}]

output webAppName string = app.name
output url string = 'https://${app.name}.azurewebsites.net'
output vaultName string = vault.name
output storageAccount string = storage.name
output cosmosAccount string = cosmos.name
output managedIdentityObjectId string = app.identity.principalId
