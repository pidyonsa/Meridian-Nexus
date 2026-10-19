'use strict';
// The Google scheduled functions run on Azure: which deployed code set each comes from, and the secrets Google
// mounts for it (the Azure runner loads exactly these from Key Vault).
const GEO_API = ['GEO_REP_OPEN_API_ID', 'GEO_REP_OPEN_API_KEY'];
exports.FUNCTIONS = {
  runScheduledExtractions: { set: 'scheduler', secrets: [] },
  detectStalledExtractionRuns: { set: 'core', secrets: [] },
  retryLockedGeoRepBlueprintUpdates: { set: 'core', secrets: [] },
  retryFailedGeoRepBlueprintUpdates: { set: 'core', secrets: [] },
  retryLockedGeoRepCampaignDetails: { set: 'core', secrets: [] },
  runScheduledGeoRepOpenApiSync: { set: 'core', secrets: GEO_API },
  runScheduledGeoRepSalesDashboardApiImport: { set: 'core', secrets: GEO_API },
  deliverMeridianChatReminders: { set: 'chat', secrets: [] },
  cleanupMeridianSupportUploads: { set: 'support', secrets: [] }
};
