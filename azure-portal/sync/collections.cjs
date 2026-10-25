'use strict';
// What the Firestore -> SQL sync copies, and how.
//   hot:         small and changing all the time -> full copy every run.
//   incremental: larger and mostly appended -> hourly copy of documents newer than the checkpoint on `field`,
//                full copy (updates and deletions) in the nightly run.
//   recent:      run/log collections whose rows change only while fresh -> hourly copy of documents whose `field`
//                (a Firestore timestamp) is within the last `days` days, full copy (updates and deletions) nightly.
//   nightly:     rarely changing and large -> full copy in the nightly run only.
//   group:       subcollections (collection-group queries), full copy every run.
// A collection with a `parent` is a subcollection read with a collection-group query; `parent` keeps names apart.
// Not copied: the Geo Rep Open API mirrors (geoRepApi*, ~1.4M records; the new back end loads them from Geo Rep
// directly), retailerSecrets (encrypted passwords belong in Key Vault), and data of features removed in October.
const COLLECTIONS = [
  ...['adminUsers', 'retailers', 'extractionProfiles', 'automationLocks',
    'portalResources', 'etlRuns', 'etlReferenceSets', 'etlApprovals', 'etlPipelineSetups', 'etlPipelineSetupAudit',
    'integrationHealth', 'geoRepOpenApiConfig', 'salesDashboardConfig', 'salesDashboardSnapshots',
    'salesStoreMasters', 'attendanceStoreMasters', 'geoRepAttendanceConfig',
    'geoRepMerchandiserAttendanceConfig', 'geoRepAttendanceDashboard', 'geoRepStoreMasters', 'geoRepFormIntakes',
    'geoRepFormReportImports', 'geoRepFormHistoryRuns', 'dataorbisMonthlyTemplates',
    'dataorbisMonthlyBatches', 'meridianChatRooms', 'meridianChatTasks', 'meridianChatLimits', 'meridianChatAudit',
    'supportTickets', 'supportOperations', 'nexusAssistantTasks', 'geminiUsage', 'publicDashboardSources',
    'publicDashboardRefresh', 'publicDashboardRefreshAudit', 'sharePointIntegrationInventory', 'sharePointIntegrationScans'
  ].map(id => ({id, mode: 'hot'})),
  // 25 Oct 2026: these four were ~7,800 of ~8,500 hourly reads while only a few dozen rows changed a day.
  {id: 'extractionRuns', mode: 'recent', field: 'createdAt', days: 7},
  {id: 'geoRepOpenApiSyncRuns', mode: 'recent', field: 'startedAt', days: 7},
  {id: 'automationPrompts', mode: 'recent', field: 'createdAt', days: 7},
  {id: 'salesTransactionImports', mode: 'recent', field: 'createdAt', days: 7},
  {id: 'geoRepCampaignTemplateRebuilds', mode: 'recent', field: 'requestedAt', days: 7},
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
  {id: 'items', parent: 'sharePointIntegrationInventory', mode: 'nightly'}
];

// The name rows are stored under in dbo.documents.collection.
const tableName = c => (c.parent ? `${c.parent}/${c.id}` : c.id);

module.exports = {COLLECTIONS, tableName};
