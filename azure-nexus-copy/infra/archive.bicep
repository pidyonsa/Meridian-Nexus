targetScope = 'resourceGroup'

@allowed(['southafricanorth'])
param location string = 'southafricanorth'

@description('Existing Meridian subscription operator object ID; scoped only to this new archive.')
param migrationOperatorObjectId string

@description('Explicit trusted migration IPv4 address. No 0.0.0.0/0 rule is allowed by the deployment preflight.')
param migrationIpv4 string

var suffix = uniqueString(subscription().id, resourceGroup().id)
var storageName = 'nxcopy${suffix}'
var vaultName = 'nxcopy-${suffix}'
var commonTags = { application: 'Meridian Nexus', purpose: 'isolated-copy', productionWriter: 'false' }

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  tags: commonTags
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    defaultToOAuthAuthentication: true
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'None'
      ipRules: [{ value: migrationIpv4, action: 'Allow' }]
    }
    encryption: { keySource: 'Microsoft.Storage', services: { blob: { enabled: true } } }
  }
}
resource blobs 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: {
    isVersioningEnabled: true
    deleteRetentionPolicy: { enabled: true, days: 30 }
    containerDeleteRetentionPolicy: { enabled: true, days: 30 }
  }
}
resource containers 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = [for name in ['records', 'files', 'artifacts', 'manifests']: {
  parent: blobs
  name: name
  properties: { publicAccess: 'None' }
}]
resource archiveWriter 'Microsoft.Authorization/roleDefinitions@2022-04-01' = {
  name: guid(resourceGroup().id, 'archive-copy-verifier')
  properties: {
    roleName: 'Nexus isolated archive copy verifier ${suffix}'
    description: 'Read and create archive blobs; cannot delete blobs or grant access.'
    type: 'CustomRole'
    assignableScopes: [resourceGroup().id]
    permissions: [{
      actions: []
      notActions: []
      dataActions: [
        'Microsoft.Storage/storageAccounts/blobServices/containers/blobs/read'
        'Microsoft.Storage/storageAccounts/blobServices/containers/blobs/write'
      ]
      notDataActions: []
    }]
  }
}
resource archiveGrants 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (name, i) in ['records', 'files', 'artifacts', 'manifests']: {
  name: guid(containers[i].id, migrationOperatorObjectId, 'copy')
  scope: containers[i]
  properties: {
    roleDefinitionId: archiveWriter.id
    principalId: migrationOperatorObjectId
    principalType: 'User'
  }
}]
resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: vaultName
  location: location
  tags: commonTags
  properties: {
    tenantId: tenant().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    enablePurgeProtection: true
    softDeleteRetentionInDays: 90
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'None'
      ipRules: [{ value: migrationIpv4 }]
    }
  }
}
// No secret permissions, executable code, triggers or production identities are deployed here.
output storageAccount string = storage.name
output vaultUri string = vault.properties.vaultUri
output archiveContainerIds array = [for (name, i) in ['records', 'files', 'artifacts', 'manifests']: containers[i].id]
output temporaryGrantIds array = [for (name, i) in ['records', 'files', 'artifacts', 'manifests']: archiveGrants[i].id]
