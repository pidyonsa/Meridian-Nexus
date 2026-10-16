// Stage 1 foundations for moving Nexus automations from Google to Azure (approved 2 October 2026).
// Creates no link to Google and holds no secrets yet; workloads are added per family after approval.
targetScope = 'resourceGroup'

param location string = resourceGroup().location
@description('Monthly budget for this resource group, in the billing currency (ZAR).')
param monthlyBudget int = 1500
@description('First day of the budget period (yyyy-MM-01).')
param budgetStart string = '2026-10-01'

var suffix = uniqueString(resourceGroup().id)
var tags = {
  purpose: 'nexus-automations'
  stage: 'stage-1'
  owner: 'meridian-nexus'
}
// One identity per workload family so each gets only its own access.
// Stock Fix and Sales Insights were retired on 4 October 2026 (not moved); their identities and queues were deleted.
var families = [
  'dispatcher'
  'georep'
  'etl'
]
var queues = [
  'georep-api'
  'georep-portal'
  'etl'
]

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-nexus-automations'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
    // Bounds log ingestion cost (~R140/month at the planned 3 GB).
    workspaceCapping: { dailyQuotaGb: json('0.3') }
  }
}

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'cae-nexus-automations'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
    workloadProfiles: [
      { name: 'Consumption', workloadProfileType: 'Consumption' }
    ]
  }
}

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: 'acrnexusauto${suffix}'
  location: location
  tags: tags
  sku: { name: 'Basic' }
  properties: { adminUserEnabled: false }
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: take('stnexusauto${suffix}', 24)
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
  }
}

resource queueService 'Microsoft.Storage/storageAccounts/queueServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource workQueues 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-05-01' = [for q in queues: {
  parent: queueService
  name: q
}]

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource artifacts 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'run-artifacts'
  properties: { publicAccess: 'None' }
}

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: take('kv-nexusauto-${suffix}', 24)
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 30
    publicNetworkAccess: 'Enabled'
  }
}

resource identities 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = [for f in families: {
  name: 'id-nexus-${f}'
  location: location
  tags: tags
}]

// Built-in role definition IDs.
var acrPull = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
var queueDataContributor = '974c5e8b-45b9-4653-ba55-5f855dd0fb88'
var blobDataContributor = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
var keyVaultSecretsUser = '4633458b-17de-408a-b874-0445c86b69e6'

resource pull 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (f, i) in families: {
  name: guid(registry.id, f, acrPull)
  scope: registry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPull)
    principalId: identities[i].properties.principalId
    principalType: 'ServicePrincipal'
  }
}]

resource queueAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (f, i) in families: {
  name: guid(storage.id, f, queueDataContributor)
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', queueDataContributor)
    principalId: identities[i].properties.principalId
    principalType: 'ServicePrincipal'
  }
}]

resource blobAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (f, i) in families: {
  name: guid(storage.id, f, blobDataContributor)
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', blobDataContributor)
    principalId: identities[i].properties.principalId
    principalType: 'ServicePrincipal'
  }
}]

resource secretsAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for (f, i) in families: {
  name: guid(vault.id, f, keyVaultSecretsUser)
  scope: vault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUser)
    principalId: identities[i].properties.principalId
    principalType: 'ServicePrincipal'
  }
}]

// Alerts subscription Owners (no personal email stored) at 80% actual and 100% forecast.
resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: 'budget-nexus-automations'
  properties: {
    category: 'Cost'
    amount: monthlyBudget
    timeGrain: 'Monthly'
    timePeriod: { startDate: budgetStart }
    notifications: {
      actual80: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 80
        thresholdType: 'Actual'
        contactEmails: []
        contactRoles: [ 'Owner' ]
      }
      forecast100: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 100
        thresholdType: 'Forecasted'
        contactEmails: []
        contactRoles: [ 'Owner' ]
      }
    }
  }
}

output environmentName string = environment.name
output registryLoginServer string = registry.properties.loginServer
output storageAccount string = storage.name
output keyVault string = vault.name
output identityClientIds array = [for (f, i) in families: {
  family: f
  clientId: identities[i].properties.clientId
}]
