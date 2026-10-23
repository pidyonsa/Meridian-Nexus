'use strict';
// What the Firestore -> SQL sync copies, and how.
//   hot:         small and changing all the time -> full copy every run.
//   incremental: larger and mostly appended -> hourly copy of documents newer than the checkpoint on `field`,
//                full copy (updates and deletions) in the nightly run.
//   group:       subcollections (collection-group queries), full copy every run; `parent` keeps names apart.
// Not copied: the Geo Rep Open API mirrors (geoRepApi*, ~1.4M records; the new back end loads them from Geo Rep
// directly), retailerSecrets (encrypted passwords belong in Key Vault), and data of features removed in October.
const COLLECTIONS = [
  ...['adminUsers', 'retailers', 'extractionProfiles', 'extractionRuns', 'automationPrompts', 'automationLocks',
    'portalResources', 'etlRuns', 'etlReferenceSets', 'etlApprovals', 'etlPipelineSetups', 'etlPipelineSetupAudit',
    'integrationHealth', 'geoRepOpenApiConfig', 'geoRepOpenApiSyncRuns', 'salesDashboardConfig', 'salesDashboardSnapshots',
    'salesStoreMasters', 'salesTransactionImports', 'attendanceStoreMasters', 'geoRepAttendanceConfig',
    'geoRepMerchandiserAttendanceConfig', 'geoRepAttendanceDashboard', 'geoRepStoreMasters', 'geoRepFormIntakes',
    'geoRepFormReportImports', 'geoRepFormHistoryRuns', 'geoRepCampaignTemplateRebuilds', 'dataorbisMonthlyTemplates',
    'dataorbisMonthlyBatches', 'meridianChatRooms', 'meridianChatTasks', 'meridianChatLimits', 'meridianChatAudit',
    'supportTickets', 'supportOperations', 'nexusAssistantTasks', 'geminiUsage', 'publicDashboardSources',
    'publicDashboardRefresh', 'publicDashboardRefreshAudit', 'sharePointIntegrationInventory', 'sharePointIntegrationScans'
  ].map(id => ({id, mode: 'hot'})),
  {id: 'accessAuditLogs', mode: 'incremental', field: 'createdAt'},
  {id: 'automationAlerts', mode: 'incremental', field: 'createdAt'},
  {id: 'files', mode: 'incremental', field: 'uploadedAt'},
  {id: 'reportDeliveries', mode: 'incremental', field: 'updatedAt'},
  {id: 'salesTransactions', mode: 'incremental', field: 'importedAt'},
  {id: 'sharePointWorkbookBackups', mode: 'incremental', field: 'createdAt'},
  {id: 'geoRepCampaignRuns', mode: 'incremental', field: 'createdAt'},
  {id: 'geoRepDerivedRedeliveryRuns', mode: 'incremental', field: 'createdAt'},
  {id: 'messages', parent: 'meridianChatRooms', mode: 'group'},
  {id: 'receipts', parent: 'meridianChatRooms', mode: 'group'},
  {id: 'messages', parent: 'supportTickets', mode: 'group'},
  {id: 'exclusionAudit', parent: 'geoRepAttendanceConfig', mode: 'group'},
  {id: 'items', parent: 'sharePointIntegrationInventory', mode: 'group'}
];

// The name rows are stored under in dbo.documents.collection.
const tableName = c => (c.parent ? `${c.parent}/${c.id}` : c.id);

module.exports = {COLLECTIONS, tableName};
