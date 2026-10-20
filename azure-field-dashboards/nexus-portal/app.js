const elements = {
  skipLink: document.querySelector(".skip-link"),
  stockFixAdoptionWeek: document.querySelector("#stockFixAdoptionWeek"), stockFixAdoptionResourceType: document.querySelector("#stockFixAdoptionResourceType"), stockFixAdoptionRegion: document.querySelector("#stockFixAdoptionRegion"), stockFixAdoptionManager: document.querySelector("#stockFixAdoptionManager"), stockFixAdoptionSearch: document.querySelector("#stockFixAdoptionSearch"), stockFixAdoptionClear: document.querySelector("#stockFixAdoptionClear"), stockFixAdoptionStatus: document.querySelector("#stockFixAdoptionStatus"), stockFixAdoptionRate: document.querySelector("#stockFixAdoptionRate"), stockFixAdoptionSub: document.querySelector("#stockFixAdoptionSub"), stockFixAdoptionBar: document.querySelector("#stockFixAdoptionBar"), stockFixAdoptionRep: document.querySelector("#stockFixAdoptionRep"), stockFixAdoptionRepSub: document.querySelector("#stockFixAdoptionRepSub"), stockFixAdoptionMerch: document.querySelector("#stockFixAdoptionMerch"), stockFixAdoptionMerchSub: document.querySelector("#stockFixAdoptionMerchSub"), stockFixAdoptionActive: document.querySelector("#stockFixAdoptionActive"), stockFixAdoptionActiveSub: document.querySelector("#stockFixAdoptionActiveSub"), stockFixAdoptionCaptures: document.querySelector("#stockFixAdoptionCaptures"), stockFixAdoptionTypes: document.querySelector("#stockFixAdoptionTypes"), stockFixAdoptionRegions: document.querySelector("#stockFixAdoptionRegions"), stockFixAdoptionManagers: document.querySelector("#stockFixAdoptionManagers"), stockFixAdoptionRowsCount: document.querySelector("#stockFixAdoptionRowsCount"), stockFixAdoptionRows: document.querySelector("#stockFixAdoptionRows"), stockFixAdoptionPublishForm: document.querySelector("#stockFixAdoptionPublishForm"), stockFixAdoptionPublishWeek: document.querySelector("#stockFixAdoptionPublishWeek"), stockFixAdoptionSource: document.querySelector("#stockFixAdoptionSource"), stockFixAdoptionPublish: document.querySelector("#stockFixAdoptionPublish"), stockFixAdoptionPublishStatus: document.querySelector("#stockFixAdoptionPublishStatus"),
  nexusLoginDialog: document.querySelector("#nexusLoginDialog"), nexusLoginForm: document.querySelector("#nexusLoginForm"), nexusLoginEmail: document.querySelector("#nexusLoginEmail"), nexusLoginPassword: document.querySelector("#nexusLoginPassword"), nexusLoginClose: document.querySelector("#nexusLoginClose"), nexusForgotPassword: document.querySelector("#nexusForgotPassword"), nexusLoginStatus: document.querySelector("#nexusLoginStatus"),
  nexusAccountDialog: document.querySelector("#nexusAccountDialog"), nexusPasswordForm: document.querySelector("#nexusPasswordForm"), nexusAccountEmail: document.querySelector("#nexusAccountEmail"), nexusCurrentPassword: document.querySelector("#nexusCurrentPassword"), nexusNewPassword: document.querySelector("#nexusNewPassword"), nexusConfirmPassword: document.querySelector("#nexusConfirmPassword"), nexusAccountClose: document.querySelector("#nexusAccountClose"), nexusAccountSignOut: document.querySelector("#nexusAccountSignOut"),
  nexusAssistantToggle: document.querySelector("#nexusAssistantToggle"), nexusAssistantDialog: document.querySelector("#nexusAssistantDialog"), nexusAssistantClose: document.querySelector("#nexusAssistantClose"), nexusAssistantBack: document.querySelector("#nexusAssistantBack"), nexusAssistantMessages: document.querySelector("#nexusAssistantMessages"), nexusAssistantAskView: document.querySelector("#nexusAssistantAskView"), nexusAssistantResponseView: document.querySelector("#nexusAssistantResponseView"), nexusAssistantTaskView: document.querySelector("#nexusAssistantTaskView"), nexusAssistantTitle: document.querySelector("#nexusAssistantTitle"), nexusAssistantSubtitle: document.querySelector("#nexusAssistantSubtitle"), nexusAssistantPromptList: document.querySelector("#nexusAssistantPromptList"), nexusAssistantResponsePrompt: document.querySelector("#nexusAssistantResponsePrompt"), nexusAssistantResponseContext: document.querySelector("#nexusAssistantResponseContext"), nexusAssistantAnswerText: document.querySelector("#nexusAssistantAnswerText"), nexusAssistantActionList: document.querySelector("#nexusAssistantActionList"), nexusAssistantSuggestedStep: document.querySelector("#nexusAssistantSuggestedStep"), nexusAssistantOpenTask: document.querySelector("#nexusAssistantOpenTask"), nexusAssistantCreateTask: document.querySelector("#nexusAssistantCreateTask"), nexusAssistantCancelTask: document.querySelector("#nexusAssistantCancelTask"), nexusAssistantTaskTitle: document.querySelector("#nexusAssistantTaskTitle"), nexusAssistantTaskLocation: document.querySelector("#nexusAssistantTaskLocation"), nexusAssistantTaskProduct: document.querySelector("#nexusAssistantTaskProduct"), nexusAssistantTaskAssignee: document.querySelector("#nexusAssistantTaskAssignee"), nexusAssistantTaskDue: document.querySelector("#nexusAssistantTaskDue"), nexusAssistantTaskPriority: document.querySelector("#nexusAssistantTaskPriority"), nexusAssistantTaskNote: document.querySelector("#nexusAssistantTaskNote"), nexusAssistantForm: document.querySelector("#nexusAssistantForm"), nexusAssistantQuestion: document.querySelector("#nexusAssistantQuestion"), nexusAssistantSubmit: document.querySelector("#nexusAssistantSubmit"), nexusAssistantScope: document.querySelector("#nexusAssistantScope"),
  homeView: document.querySelector("#homeView"),
  salesDashboardView: document.querySelector("#salesDashboardView"),
  insightsView: document.querySelector("#insightsView"),
  trainingView: document.querySelector("#trainingView"),
  attendanceDashboardView: document.querySelector("#attendanceDashboardView"),
  stockFixView: document.querySelector("#stockFixView"),
  automationView: document.querySelector("#automationView"),
  adminPage: document.querySelector("#adminPage"),
  filesView: document.querySelector("#filesView"),
  homeNav: document.querySelector("#homeNav"),
  automationNav: document.querySelector("#automationNav"),
  openAdminReports: document.querySelector("#openAdminReports"),
  filesNav: document.querySelector("#filesNav"),
  adminNav: document.querySelector("#adminNav"),
  closeFilesDialog: document.querySelector("#closeFilesDialog"),
  closeAdminPage: document.querySelector("#closeAdminPage"),
  openAdminAction: document.querySelector("#openAdminAction"),
  overviewSearch: document.querySelector("#overviewSearch"),
  nexusHomeAutomationCount: document.querySelector("#nexusHomeAutomationCount"),
  nexusHomeAutomationList: document.querySelector("#nexusHomeAutomationList"),
  installButton: document.querySelector("#installButton"),
  fileInput: document.querySelector("#fileInput"),
  dropZone: document.querySelector("#dropZone"),
  dropZoneTitle: document.querySelector("#dropZoneTitle"),
  uploadQueue: document.querySelector("#uploadQueue"),
  fileList: document.querySelector("#fileList"),
  fileSummary: document.querySelector("#fileSummary"),
  emptyState: document.querySelector("#emptyState"),
  emptyStateTitle: document.querySelector("#emptyStateTitle"), emptyStateCopy: document.querySelector("#emptyStateCopy"),
  listHeader: document.querySelector("#listHeader"),
  selectAll: document.querySelector("#selectAll"),
  fileSearch: document.querySelector("#fileSearch"), fileTypeFilter: document.querySelector("#fileTypeFilter"), fileSort: document.querySelector("#fileSort"), filePageSize: document.querySelector("#filePageSize"), filePagination: document.querySelector("#filePagination"), filePrev: document.querySelector("#filePrev"), fileNext: document.querySelector("#fileNext"), filePageInfo: document.querySelector("#filePageInfo"),
  filesReportRunner: document.querySelector("#filesReportRunner"), filesRunRetailer: document.querySelector("#filesRunRetailer"), filesRunRetailerDetails: document.querySelector("#filesRunRetailerDetails"), filesRunStartDate: document.querySelector("#filesRunStartDate"), filesRunEndDate: document.querySelector("#filesRunEndDate"), filesRunScheduleDateMode: document.querySelector("#filesRunScheduleDateMode"), filesRunScheduleTime: document.querySelector("#filesRunScheduleTime"), filesRunScheduleDays: document.querySelectorAll("#filesRunScheduleDays input"), filesRunScheduleEnabled: document.querySelector("#filesRunScheduleEnabled"), filesScheduleSummary: document.querySelector("#filesScheduleSummary"), filesScheduleScopeNote: document.querySelector("#filesScheduleScopeNote"), filesScheduleComposer: document.querySelector("#filesScheduleComposer"), filesSaveRunSchedule: document.querySelector("#filesSaveRunSchedule"), filesRunExtraction: document.querySelector("#filesRunExtraction"),
  downloadSelected: document.querySelector("#downloadSelected"),
  deleteSelected: document.querySelector("#deleteSelected"),
  deleteDialog: document.querySelector("#deleteDialog"),
  deleteDialogCopy: document.querySelector("#deleteDialogCopy"),
  automationPromptDialog: document.querySelector("#automationPromptDialog"), automationPromptForm: document.querySelector("#automationPromptForm"), automationPromptTitle: document.querySelector("#automationPromptTitle"), automationPromptMessage: document.querySelector("#automationPromptMessage"), automationPromptLabel: document.querySelector("#automationPromptLabel"), automationPromptValue: document.querySelector("#automationPromptValue"), automationPromptAbort: document.querySelector("#automationPromptAbort"),
  automationLogDialog: document.querySelector("#automationLogDialog"), automationLogClose: document.querySelector("#automationLogClose"), automationLogTitle: document.querySelector("#automationLogTitle"), automationLogSubtitle: document.querySelector("#automationLogSubtitle"), automationLogDetail: document.querySelector("#automationLogDetail"),
  toast: document.querySelector("#toast"),
  clientFilter: document.querySelector("#clientFilter"),
  dashboardTypeFilter: document.querySelector("#dashboardTypeFilter"),
  dataStatus: document.querySelector("#dataStatus"),
  dataStatusCopy: document.querySelector("#dataStatusCopy"),
  metricStock: document.querySelector("#metricStock"),
  metricStores: document.querySelector("#metricStores"),
  metricSkus: document.querySelector("#metricSkus"),
  metricAvailability: document.querySelector("#metricAvailability"),
  trendChart: document.querySelector("#trendChart"),
  stockDonut: document.querySelector("#stockDonut"),
  healthScore: document.querySelector("#healthScore"),
  healthyCount: document.querySelector("#healthyCount"),
  lowCount: document.querySelector("#lowCount"),
  outCount: document.querySelector("#outCount"),
  clientBars: document.querySelector("#clientBars"),
  riskTable: document.querySelector("#riskTable"),
  riskCount: document.querySelector("#riskCount"),
  adminClient: document.querySelector("#adminClient"),
  customClientField: document.querySelector("#customClientField"),
  customClient: document.querySelector("#customClient"),
  sourceType: document.querySelector("#sourceType"),
  adminFileInput: document.querySelector("#adminFileInput"),
  adminDropZone: document.querySelector("#adminDropZone"),
  adminDropTitle: document.querySelector("#adminDropTitle"),
  sourcePreview: document.querySelector("#sourcePreview"),
  publishDataset: document.querySelector("#publishDataset"),
  adminHistory: document.querySelector("#adminHistory"),
  extractionStatus: document.querySelector("#extractionStatus"), extractionStatusTitle: document.querySelector("#extractionStatusTitle"), extractionStatusCopy: document.querySelector("#extractionStatusCopy"), extractionStatusMeta: document.querySelector("#extractionStatusMeta"), extractionStatusStep: document.querySelector("#extractionStatusStep"), extractionStatusElapsed: document.querySelector("#extractionStatusElapsed"), extractionStatusProgress: document.querySelector("#extractionStatusProgress"), extractionStatusAbort: document.querySelector("#extractionStatusAbort"), extractionStatusAlert: document.querySelector("#extractionStatusAlert"),
  adminLogin: document.querySelector("#adminLogin"), adminLoginForm: document.querySelector("#adminLoginForm"), adminLoginEmail: document.querySelector("#adminLoginEmail"), adminLoginPassword: document.querySelector("#adminLoginPassword"),
  operationsLogin: document.querySelector("#operationsLogin"), operationsLoginForm: document.querySelector("#operationsLoginForm"), operationsLoginEmail: document.querySelector("#operationsLoginEmail"), operationsLoginPassword: document.querySelector("#operationsLoginPassword"), operationsWorkspace: document.querySelector("#operationsWorkspace"), operationsRetailer: document.querySelector("#operationsRetailer"), operationsRetailerDetails: document.querySelector("#operationsRetailerDetails"), operationsMonthlyRunFields: document.querySelector("#operationsMonthlyRunFields"), operationsRunMonthlyActualWeek: document.querySelector("#operationsRunMonthlyActualWeek"), operationsStartDate: document.querySelector("#operationsStartDate"), operationsEndDate: document.querySelector("#operationsEndDate"), operationsStartDateLabel: document.querySelector("#operationsStartDateLabel"), operationsEndDateLabel: document.querySelector("#operationsEndDateLabel"), operationsRunRangeNote: document.querySelector("#operationsRunRangeNote"), operationsDailySmartSellWeekField: document.querySelector("#operationsDailySmartSellWeekField"), operationsDailySmartSellWeek: document.querySelector("#operationsDailySmartSellWeek"), operationsDailySmartSellWeekNote: document.querySelector("#operationsDailySmartSellWeekNote"), operationsRunExtraction: document.querySelector("#operationsRunExtraction"), operationsSessionName: document.querySelector("#operationsSessionName"), operationsSessionCopy: document.querySelector("#operationsSessionCopy"), operationsRunOrb: document.querySelector("#operationsRunOrb"), operationsLogout: document.querySelector("#operationsLogout"), operationsSmartSellMasterPanel: document.querySelector("#operationsSmartSellMasterPanel"), operationsSmartSellMasterForm: document.querySelector("#operationsSmartSellMasterForm"), operationsSmartSellMasterId: document.querySelector("#operationsSmartSellMasterId"), operationsSmartSellMasterFile: document.querySelector("#operationsSmartSellMasterFile"), operationsSmartSellMasterWeek: document.querySelector("#operationsSmartSellMasterWeek"), operationsSmartSellMasterAssignments: document.querySelector("#operationsSmartSellMasterAssignments"), operationsSmartSellMasterState: document.querySelector("#operationsSmartSellMasterState"), operationsSmartSellMasterStatus: document.querySelector("#operationsSmartSellMasterStatus"), operationsSaveSmartSellMaster: document.querySelector("#operationsSaveSmartSellMaster"), operationsSchedulePanel: document.querySelector("#operationsSchedulePanel"), operationsScheduleState: document.querySelector("#operationsScheduleState"), operationsScheduleEnabled: document.querySelector("#operationsScheduleEnabled"), operationsScheduleTime: document.querySelector("#operationsScheduleTime"), operationsScheduleDateMode: document.querySelector("#operationsScheduleDateMode"), operationsScheduleDateModeField: document.querySelector("#operationsScheduleDateModeField"), operationsScheduleStartDate: document.querySelector("#operationsScheduleStartDate"), operationsScheduleEndDate: document.querySelector("#operationsScheduleEndDate"), operationsScheduleStartDateLabel: document.querySelector("#operationsScheduleStartDateLabel"), operationsScheduleEndDateLabel: document.querySelector("#operationsScheduleEndDateLabel"), operationsMonthlyAttendanceFields: document.querySelector("#operationsMonthlyAttendanceFields"), operationsMonthlyActualWeek: document.querySelector("#operationsMonthlyActualWeek"), operationsMonthlyScheduleDay: document.querySelector("#operationsMonthlyScheduleDay"), operationsScheduleDaysField: document.querySelector("#operationsScheduleDaysField"), operationsScheduleDays: document.querySelectorAll("#operationsScheduleDays input"), operationsScheduleSummary: document.querySelector("#operationsScheduleSummary"), operationsSaveSchedule: document.querySelector("#operationsSaveSchedule"), operationsRunSummary: document.querySelector("#operationsRunSummary"), operationsRunHistory: document.querySelector("#operationsRunHistory"), operationsRunDetail: document.querySelector("#operationsRunDetail"), operationsPermissionList: document.querySelector("#operationsPermissionList"), operationsAuditPanel: document.querySelector("#operationsAuditPanel"), operationsAuditHistory: document.querySelector("#operationsAuditHistory"), operationsPromptPanel: document.querySelector("#operationsPromptPanel"), operationsPromptList: document.querySelector("#operationsPromptList"), operationsAlertsPanel: document.querySelector("#operationsAlertsPanel"), operationsAlertsCount: document.querySelector("#operationsAlertsCount"), operationsAlertsList: document.querySelector("#operationsAlertsList"),
  adminWorkspace: document.querySelector("#adminWorkspace"), adminSessionName: document.querySelector("#adminSessionName"), adminLogout: document.querySelector("#adminLogout"),
  retailerForm: document.querySelector("#retailerForm"), retailerId: document.querySelector("#retailerId"), retailerName: document.querySelector("#retailerName"), retailerWebAddress: document.querySelector("#retailerWebAddress"), retailerUsername: document.querySelector("#retailerUsername"), retailerPassword: document.querySelector("#retailerPassword"), retailerFormTitle: document.querySelector("#retailerFormTitle"), retailerExtractionProfile: document.querySelector("#retailerExtractionProfile"), openLinkedExtractionProfile: document.querySelector("#openLinkedExtractionProfile"), retailerList: document.querySelector("#retailerList"), newRetailer: document.querySelector("#newRetailer"), deleteRetailer: document.querySelector("#deleteRetailer"), salesforceConnectedAppFields: document.querySelector("#salesforceConnectedAppFields"), retailerSalesforceClientId: document.querySelector("#retailerSalesforceClientId"), retailerSalesforceApiUsername: document.querySelector("#retailerSalesforceApiUsername"), retailerSalesforceLoginUrl: document.querySelector("#retailerSalesforceLoginUrl"), retailerSalesforcePrivateKey: document.querySelector("#retailerSalesforcePrivateKey"), salesforceConnectedAppBadge: document.querySelector("#salesforceConnectedAppBadge"), salesforceConnectedAppStatus: document.querySelector("#salesforceConnectedAppStatus"), testRetailerSalesforceConnectedApp: document.querySelector("#testRetailerSalesforceConnectedApp"),
  extractionProfileForm: document.querySelector("#extractionProfileForm"), extractionProfileId: document.querySelector("#extractionProfileId"), extractionProfileName: document.querySelector("#extractionProfileName"), extractionProfileFormTitle: document.querySelector("#extractionProfileFormTitle"), extractionProfileList: document.querySelector("#extractionProfileList"), newExtractionProfile: document.querySelector("#newExtractionProfile"), deleteExtractionProfile: document.querySelector("#deleteExtractionProfile"),
  geoRepStoreMasterForm: document.querySelector("#geoRepStoreMasterForm"), geoRepStoreMasterId: document.querySelector("#geoRepStoreMasterId"), geoRepStoreMasterName: document.querySelector("#geoRepStoreMasterName"), geoRepStoreMasterClient: document.querySelector("#geoRepStoreMasterClient"), geoRepStoreMasterSheetMatch: document.querySelector("#geoRepStoreMasterSheetMatch"), geoRepStoreMasterDisplayType: document.querySelector("#geoRepStoreMasterDisplayType"), geoRepStoreMasterBrand: document.querySelector("#geoRepStoreMasterBrand"), geoRepStoreMasterBanner: document.querySelector("#geoRepStoreMasterBanner"), geoRepStoreMasterFormNamePrefix: document.querySelector("#geoRepStoreMasterFormNamePrefix"), geoRepStoreMasterFile: document.querySelector("#geoRepStoreMasterFile"), geoRepStoreMasterLookupFile: document.querySelector("#geoRepStoreMasterLookupFile"), geoRepStoreMasterFormTitle: document.querySelector("#geoRepStoreMasterFormTitle"), geoRepStoreMasterStatus: document.querySelector("#geoRepStoreMasterStatus"), geoRepStoreMasterList: document.querySelector("#geoRepStoreMasterList"), geoRepStoreMasterCount: document.querySelector("#geoRepStoreMasterCount"), newGeoRepStoreMaster: document.querySelector("#newGeoRepStoreMaster"),
  salesStoreMasterForm: document.querySelector("#salesStoreMasterForm"), salesStoreMasterId: document.querySelector("#salesStoreMasterId"), salesStoreMasterName: document.querySelector("#salesStoreMasterName"), salesStoreMasterFile: document.querySelector("#salesStoreMasterFile"), salesStoreMasterStatus: document.querySelector("#salesStoreMasterStatus"), setupGeoRepSalesDashboard: document.querySelector("#setupGeoRepSalesDashboard"), runGeoRepSalesApiImport: document.querySelector("#runGeoRepSalesApiImport"), salesDashboardSetupState: document.querySelector("#salesDashboardSetupState"), salesDashboardSetupDetails: document.querySelector("#salesDashboardSetupDetails"), geoRepOpenApiCredentialsForm: document.querySelector("#geoRepOpenApiCredentialsForm"), geoRepOpenApiIdInput: document.querySelector("#geoRepOpenApiIdInput"), geoRepOpenApiKeyInput: document.querySelector("#geoRepOpenApiKeyInput"), geoRepOpenApiCredentialsStatus: document.querySelector("#geoRepOpenApiCredentialsStatus"), geoRepOpenApiSettingsForm: document.querySelector("#geoRepOpenApiSettingsForm"), geoRepOpenApiHistoryDays: document.querySelector("#geoRepOpenApiHistoryDays"), geoRepOpenApiOverlapHours: document.querySelector("#geoRepOpenApiOverlapHours"), geoRepOpenApiGroups: document.querySelectorAll("#geoRepOpenApiGroups input"), geoRepOpenApiEnabled: document.querySelector("#geoRepOpenApiEnabled"), geoRepOpenApiSettingsStatus: document.querySelector("#geoRepOpenApiSettingsStatus"), geoRepOpenApiState: document.querySelector("#geoRepOpenApiState"), geoRepOpenApiDetails: document.querySelector("#geoRepOpenApiDetails"), geoRepOpenApiEntityList: document.querySelector("#geoRepOpenApiEntityList"), testGeoRepOpenApiConnection: document.querySelector("#testGeoRepOpenApiConnection"), runGeoRepOpenApiReferenceSync: document.querySelector("#runGeoRepOpenApiReferenceSync"), runGeoRepOpenApiFullSync: document.querySelector("#runGeoRepOpenApiFullSync"),
  geoRepAttendanceTrackerForm: document.querySelector("#geoRepAttendanceTrackerForm"), geoRepAttendanceTrackerUrl: document.querySelector("#geoRepAttendanceTrackerUrl"), geoRepAttendanceTrackerStatus: document.querySelector("#geoRepAttendanceTrackerStatus"), geoRepAttendanceTrackerState: document.querySelector("#geoRepAttendanceTrackerState"), geoRepAttendanceTrackerDetails: document.querySelector("#geoRepAttendanceTrackerDetails"), geoRepAttendanceOperationalWeekForm: document.querySelector("#geoRepAttendanceOperationalWeekForm"), geoRepAttendanceOperationalWeek: document.querySelector("#geoRepAttendanceOperationalWeek"), geoRepAttendanceOperationalWeekStatus: document.querySelector("#geoRepAttendanceOperationalWeekStatus"), geoRepAttendanceOperationalWeekState: document.querySelector("#geoRepAttendanceOperationalWeekState"), geoRepAttendanceOperationalWeekDetails: document.querySelector("#geoRepAttendanceOperationalWeekDetails"), geoRepAttendanceScheduleForm: document.querySelector("#geoRepAttendanceScheduleForm"), geoRepAttendanceScheduleEnabled: document.querySelector("#geoRepAttendanceScheduleEnabled"), geoRepAttendanceScheduleTime: document.querySelector("#geoRepAttendanceScheduleTime"), geoRepAttendanceScheduleDays: document.querySelectorAll("#geoRepAttendanceScheduleDays input"), geoRepAttendanceScheduleStatus: document.querySelector("#geoRepAttendanceScheduleStatus"), geoRepAttendanceScheduleState: document.querySelector("#geoRepAttendanceScheduleState"), geoRepAttendanceScheduleDetails: document.querySelector("#geoRepAttendanceScheduleDetails"), geoRepAttendanceStoreMasterForm: document.querySelector("#geoRepAttendanceStoreMasterForm"), geoRepAttendanceStoreMasterId: document.querySelector("#geoRepAttendanceStoreMasterId"), geoRepAttendanceStoreMasterName: document.querySelector("#geoRepAttendanceStoreMasterName"), geoRepAttendanceStoreMasterFile: document.querySelector("#geoRepAttendanceStoreMasterFile"), geoRepAttendanceStoreMasterStatus: document.querySelector("#geoRepAttendanceStoreMasterStatus"), geoRepAttendanceStoreMasterState: document.querySelector("#geoRepAttendanceStoreMasterState"), geoRepAttendanceStoreMasterDetails: document.querySelector("#geoRepAttendanceStoreMasterDetails"), rebuildGeoRepAttendanceStoreCoverage: document.querySelector("#rebuildGeoRepAttendanceStoreCoverage"),
  salesforceAttendanceMasterForm: document.querySelector("#salesforceAttendanceMasterForm"), salesforceAttendanceMasterId: document.querySelector("#salesforceAttendanceMasterId"), salesforceAttendanceMasterFile: document.querySelector("#salesforceAttendanceMasterFile"), salesforceAttendanceWeek: document.querySelector("#salesforceAttendanceWeek"), salesforceAttendanceAssignments: document.querySelector("#salesforceAttendanceAssignments"), salesforceAttendanceMasterStatus: document.querySelector("#salesforceAttendanceMasterStatus"), salesforceAttendanceMonthlyMasterForm: document.querySelector("#salesforceAttendanceMonthlyMasterForm"), salesforceAttendanceMonthlyMasterId: document.querySelector("#salesforceAttendanceMonthlyMasterId"), salesforceAttendanceMonthlyMasterFile: document.querySelector("#salesforceAttendanceMonthlyMasterFile"), salesforceAttendanceMonthlyMasterStatus: document.querySelector("#salesforceAttendanceMonthlyMasterStatus"), salesforceAttendanceMasterCount: document.querySelector("#salesforceAttendanceMasterCount"), salesforceAttendanceMasterDetails: document.querySelector("#salesforceAttendanceMasterDetails"), salesforceAttendanceBlueprintForm: document.querySelector("#salesforceAttendanceBlueprintForm"), salesforceAttendanceBlueprintUrl: document.querySelector("#salesforceAttendanceBlueprintUrl"), salesforceAttendanceBlueprintStatus: document.querySelector("#salesforceAttendanceBlueprintStatus"), salesforceAttendanceMonthlyPlanSetupForm: document.querySelector("#salesforceAttendanceMonthlyPlanSetupForm"), salesforceAttendanceMonthlyPlanTargetUrl: document.querySelector("#salesforceAttendanceMonthlyPlanTargetUrl"), salesforceAttendanceMonthlyPlanMasterUrl: document.querySelector("#salesforceAttendanceMonthlyPlanMasterUrl"), salesforceAttendanceMonthlyPlanEnabled: document.querySelector("#salesforceAttendanceMonthlyPlanEnabled"), salesforceAttendanceMonthlyPlanTime: document.querySelector("#salesforceAttendanceMonthlyPlanTime"), salesforceAttendanceMonthlyPlanStatus: document.querySelector("#salesforceAttendanceMonthlyPlanStatus"), runSalesforceAttendanceMonthlyPlanSetup: document.querySelector("#runSalesforceAttendanceMonthlyPlanSetup"), salesforceAttendanceMonthlyBlueprintProvisionForm: document.querySelector("#salesforceAttendanceMonthlyBlueprintProvisionForm"), salesforceAttendanceMonthlyBlueprintTemplateUrl: document.querySelector("#salesforceAttendanceMonthlyBlueprintTemplateUrl"), salesforceAttendanceMonthlyBlueprintFolderUrl: document.querySelector("#salesforceAttendanceMonthlyBlueprintFolderUrl"), salesforceAttendanceMonthlyBlueprintPrefix: document.querySelector("#salesforceAttendanceMonthlyBlueprintPrefix"), salesforceAttendanceMonthlyBlueprintMonth: document.querySelector("#salesforceAttendanceMonthlyBlueprintMonth"), salesforceAttendanceMonthlyBlueprintEnabled: document.querySelector("#salesforceAttendanceMonthlyBlueprintEnabled"), salesforceAttendanceMonthlyBlueprintTime: document.querySelector("#salesforceAttendanceMonthlyBlueprintTime"), salesforceAttendanceMonthlyBlueprintStatus: document.querySelector("#salesforceAttendanceMonthlyBlueprintStatus"), createSalesforceAttendanceMonthlyBlueprint: document.querySelector("#createSalesforceAttendanceMonthlyBlueprint"),
  displayComplianceChannelsForm: document.querySelector("#displayComplianceChannelsForm"), displayComplianceChannelName: document.querySelector("#displayComplianceChannelName"), displayComplianceChannelsCount: document.querySelector("#displayComplianceChannelsCount"), displayComplianceChannelsStatus: document.querySelector("#displayComplianceChannelsStatus"), displayComplianceChannelsList: document.querySelector("#displayComplianceChannelsList"), displayComplianceSmartSellMasterForm: document.querySelector("#displayComplianceSmartSellMasterForm"), displayComplianceSmartSellMasterId: document.querySelector("#displayComplianceSmartSellMasterId"), displayComplianceSmartSellMasterFile: document.querySelector("#displayComplianceSmartSellMasterFile"), displayComplianceSmartSellMasterStatus: document.querySelector("#displayComplianceSmartSellMasterStatus"), displayComplianceTemplateFolderForm: document.querySelector("#displayComplianceTemplateFolderForm"), displayComplianceTemplateFolderUrl: document.querySelector("#displayComplianceTemplateFolderUrl"), displayComplianceTemplateFolderStatus: document.querySelector("#displayComplianceTemplateFolderStatus"), displayComplianceReferenceTemplate: document.querySelector("#displayComplianceReferenceTemplate"), displayCompliancePhaseTwoAutoRun: document.querySelector("#displayCompliancePhaseTwoAutoRun"), displayCompliancePhaseTwoAutomationStatus: document.querySelector("#displayCompliancePhaseTwoAutomationStatus"), scanDisplayCompliancePhaseTwoInputs: document.querySelector("#scanDisplayCompliancePhaseTwoInputs"), runDisplayCompliancePhaseTwoTest: document.querySelector("#runDisplayCompliancePhaseTwoTest"), displayComplianceReadinessCount: document.querySelector("#displayComplianceReadinessCount"), displayComplianceReadinessList: document.querySelector("#displayComplianceReadinessList"), displayComplianceSourceCount: document.querySelector("#displayComplianceSourceCount"), displayComplianceSourceList: document.querySelector("#displayComplianceSourceList"),
  geoRepFormIntakeForm: document.querySelector("#geoRepFormIntakeForm"), geoRepFormIntakeName: document.querySelector("#geoRepFormIntakeName"), geoRepFormIntakeFile: document.querySelector("#geoRepFormIntakeFile"), geoRepFormIntakeStatus: document.querySelector("#geoRepFormIntakeStatus"), geoRepFormIntakeList: document.querySelector("#geoRepFormIntakeList"), geoRepFormIntakeCount: document.querySelector("#geoRepFormIntakeCount"),
  geoRepBlueprintForm: document.querySelector("#geoRepBlueprintForm"), geoRepBlueprintId: document.querySelector("#geoRepBlueprintId"), geoRepBlueprintName: document.querySelector("#geoRepBlueprintName"), geoRepBlueprintFormIntake: document.querySelector("#geoRepBlueprintFormIntake"), geoRepBlueprintFormName: document.querySelector("#geoRepBlueprintFormName"), geoRepBlueprintSharePointUrl: document.querySelector("#geoRepBlueprintSharePointUrl"), geoRepBlueprintActive: document.querySelector("#geoRepBlueprintActive"), geoRepBlueprintStatus: document.querySelector("#geoRepBlueprintStatus"), geoRepBlueprintFormTitle: document.querySelector("#geoRepBlueprintFormTitle"), geoRepBlueprintList: document.querySelector("#geoRepBlueprintList"), geoRepBlueprintCount: document.querySelector("#geoRepBlueprintCount"), newGeoRepBlueprint: document.querySelector("#newGeoRepBlueprint"), geoRepBlueprintFolderForm: document.querySelector("#geoRepBlueprintFolderForm"), geoRepBlueprintFolderUrl: document.querySelector("#geoRepBlueprintFolderUrl"), geoRepBlueprintFolderStatus: document.querySelector("#geoRepBlueprintFolderStatus"), geoRepBlueprintExceptionPanel: document.querySelector("#geoRepBlueprintExceptionPanel"), geoRepBlueprintExceptionCount: document.querySelector("#geoRepBlueprintExceptionCount"), geoRepBlueprintExceptionList: document.querySelector("#geoRepBlueprintExceptionList"), geoRepFormReportImportForm: document.querySelector("#geoRepFormReportImportForm"), geoRepFormReportImportUrl: document.querySelector("#geoRepFormReportImportUrl"), geoRepFormReportImportStatus: document.querySelector("#geoRepFormReportImportStatus"),
  extractionSteps: document.querySelector("#extractionSteps"), addExtractionStep: document.querySelector("#addExtractionStep"), runRetailer: document.querySelector("#runRetailer"), runExtraction: document.querySelector("#runExtraction"), runRetailerDetails: document.querySelector("#runRetailerDetails"), runStartDate: document.querySelector("#runStartDate"), runEndDate: document.querySelector("#runEndDate"), runStartDateLabel: document.querySelector("#runStartDateLabel"), runEndDateLabel: document.querySelector("#runEndDateLabel"), runRangeNote: document.querySelector("#runRangeNote"), runMonthlyAttendanceFields: document.querySelector("#runMonthlyAttendanceFields"), runMonthlyActualWeek: document.querySelector("#runMonthlyActualWeek"), runMonthlyScheduleDay: document.querySelector("#runMonthlyScheduleDay"), runScheduleDateMode: document.querySelector("#runScheduleDateMode"), runScheduleDateModeField: document.querySelector("#runScheduleDateModeField"), runScheduleTime: document.querySelector("#runScheduleTime"), runScheduleDays: document.querySelectorAll("#runScheduleDays input"), runScheduleDaysField: document.querySelector("#runScheduleDaysField"), runScheduleComposer: document.querySelector("#runScheduleComposer"), runScheduleScopeNote: document.querySelector("#runScheduleScopeNote"), runScheduleSummary: document.querySelector("#runScheduleSummary"), runScheduleEnabled: document.querySelector("#runScheduleEnabled"), saveRunSchedule: document.querySelector("#saveRunSchedule"), retailerCount: document.querySelector("#retailerCount"), stepSetCount: document.querySelector("#stepSetCount"), adminRunState: document.querySelector("#adminRunState"), adminRunStateTitle: document.querySelector("#adminRunStateTitle"), adminRunStateCopy: document.querySelector("#adminRunStateCopy"), adminRunProgress: document.querySelector("#adminRunProgress"), adminRunStep: document.querySelector("#adminRunStep"), adminRunElapsed: document.querySelector("#adminRunElapsed"), adminRunProgressBar: document.querySelector("#adminRunProgressBar"), adminRunHealth: document.querySelector("#adminRunHealth"), abortExtraction: document.querySelector("#abortExtraction"), runStallActions: document.querySelector("#runStallActions"), runStallProblem: document.querySelector("#runStallProblem"), continueWaitingExtraction: document.querySelector("#continueWaitingExtraction"), restartStalledExtraction: document.querySelector("#restartStalledExtraction"), endStalledExtraction: document.querySelector("#endStalledExtraction"), openFilesFromAdmin: document.querySelector("#openFilesFromAdmin"),
  automationProfileCount: document.querySelector("#automationProfileCount"), automationProfileCaption: document.querySelector("#automationProfileCaption"), automationScheduleCount: document.querySelector("#automationScheduleCount"), automationScheduleCaption: document.querySelector("#automationScheduleCaption"), automationDeliveryState: document.querySelector("#automationDeliveryState"), automationDeliveryCaption: document.querySelector("#automationDeliveryCaption"), automationRunCount: document.querySelector("#automationRunCount"), automationRunCaption: document.querySelector("#automationRunCaption"), automationRunSummary: document.querySelector("#automationRunSummary"), automationRunHistory: document.querySelector("#automationRunHistory"), automationDeliveryHistory: document.querySelector("#automationDeliveryHistory"),
  adminReadyProfileCount: document.querySelector("#adminReadyProfileCount"), adminReadyProfileCaption: document.querySelector("#adminReadyProfileCaption"), adminScheduleCount: document.querySelector("#adminScheduleCount"), adminScheduleCaption: document.querySelector("#adminScheduleCaption"), adminDeliveryState: document.querySelector("#adminDeliveryState"), adminDeliveryCaption: document.querySelector("#adminDeliveryCaption"), adminUserCount: document.querySelector("#adminUserCount"), adminUserCaption: document.querySelector("#adminUserCaption"), adminProfileHealth: document.querySelector("#adminProfileHealth"), adminScheduleList: document.querySelector("#adminScheduleList"), adminRunSummary: document.querySelector("#adminRunSummary"), adminRunHistory: document.querySelector("#adminRunHistory"), adminRunDetail: document.querySelector("#adminRunDetail"), adminJobSearch: document.querySelector("#adminJobSearch"), adminJobStatus: document.querySelector("#adminJobStatus"), adminJobOwner: document.querySelector("#adminJobOwner"), adminJobSummary: document.querySelector("#adminJobSummary"), adminJobSummaryLabel: document.querySelector("#adminJobSummaryLabel"), adminJobAuditState: document.querySelector("#adminJobAuditState"), adminJobList: document.querySelector("#adminJobList"), adminJobDetail: document.querySelector("#adminJobDetail"), adminJobDetailEmpty: document.querySelector("#adminJobDetailEmpty"), adminClearJobFilters: document.querySelector("#adminClearJobFilters"), adminRefreshJobLogs: document.querySelector("#adminRefreshJobLogs"), adminEndAllActiveJobs: document.querySelector("#adminEndAllActiveJobs"), adminDeliverySummary: document.querySelector("#adminDeliverySummary"), adminDeliveryList: document.querySelector("#adminDeliveryList"),
  sharePointInventoryStatus: document.querySelector("#sharePointInventoryStatus"), sharePointInventoryTotal: document.querySelector("#sharePointInventoryTotal"), sharePointInventoryCode: document.querySelector("#sharePointInventoryCode"), sharePointInventoryWorkbooks: document.querySelector("#sharePointInventoryWorkbooks"), sharePointInventoryOutput: document.querySelector("#sharePointInventoryOutput"), sharePointIntegrationTrackCount: document.querySelector("#sharePointIntegrationTrackCount"), sharePointIntegrationTrackList: document.querySelector("#sharePointIntegrationTrackList"), localCodeReferenceCount: document.querySelector("#localCodeReferenceCount"), localCodeReferenceList: document.querySelector("#localCodeReferenceList"), prepareLocalCodeContracts: document.querySelector("#prepareLocalCodeContracts"), sharePointInventoryModuleCount: document.querySelector("#sharePointInventoryModuleCount"), sharePointInventoryCodeCount: document.querySelector("#sharePointInventoryCodeCount"), sharePointInventoryWorkbookCount: document.querySelector("#sharePointInventoryWorkbookCount"), sharePointInventoryOutputCount: document.querySelector("#sharePointInventoryOutputCount"), sharePointInventoryModules: document.querySelector("#sharePointInventoryModules"), sharePointInventoryCodeList: document.querySelector("#sharePointInventoryCodeList"), sharePointInventoryWorkbookList: document.querySelector("#sharePointInventoryWorkbookList"), sharePointInventoryOutputList: document.querySelector("#sharePointInventoryOutputList"), sharePointInventoryScanCount: document.querySelector("#sharePointInventoryScanCount"), sharePointInventoryScanList: document.querySelector("#sharePointInventoryScanList"), refreshSharePointInventory: document.querySelector("#refreshSharePointInventory"), scanSharePointInventory: document.querySelector("#scanSharePointInventory"),
  adminUserForm: document.querySelector("#adminUserForm"), adminUserId: document.querySelector("#adminUserId"), adminUserName: document.querySelector("#adminUserName"), adminUserSurname: document.querySelector("#adminUserSurname"), adminUserEmail: document.querySelector("#adminUserEmail"), adminUserRole: document.querySelector("#adminUserRole"), adminUserPassword: document.querySelector("#adminUserPassword"), adminUserDisabled: document.querySelector("#adminUserDisabled"), adminUserAllowedRetailers: document.querySelector("#adminUserAllowedRetailers"), adminUserNavigation: document.querySelectorAll("#adminUserNavigation input[type='checkbox']"), adminUserFormTitle: document.querySelector("#adminUserFormTitle"), adminUserList: document.querySelector("#adminUserList"), adminUserSearch: document.querySelector("#adminUserSearch"), adminUserTotal: document.querySelector("#adminUserTotal"), adminUserAdminCount: document.querySelector("#adminUserAdminCount"), adminUserNormalCount: document.querySelector("#adminUserNormalCount"), adminUserDisabledCount: document.querySelector("#adminUserDisabledCount"), adminUserListCount: document.querySelector("#adminUserListCount"), newAdminUser: document.querySelector("#newAdminUser"), deleteAdminUser: document.querySelector("#deleteAdminUser"),
  salesDashboardRefresh: document.querySelector("#salesDashboardRefresh"), salesDashboardPeriod: document.querySelector("#salesDashboardPeriod"), salesDashboardRegion: document.querySelector("#salesDashboardRegion"), salesDashboardRep: document.querySelector("#salesDashboardRep"), salesDashboardManager: document.querySelector("#salesDashboardManager"), salesDashboardStore: document.querySelector("#salesDashboardStore"), salesDashboardSku: document.querySelector("#salesDashboardSku"), salesDashboardProduct: document.querySelector("#salesDashboardProduct"), salesDashboardStatusFilter: document.querySelector("#salesDashboardStatusFilter"), salesDashboardClearFilters: document.querySelector("#salesDashboardClearFilters"), salesDashboardStatus: document.querySelector("#salesDashboardStatus"), salesDashboardMetrics: document.querySelector("#salesDashboardMetrics"), salesDashboardValue: document.querySelector("#salesDashboardValue"), salesDashboardValueNote: document.querySelector("#salesDashboardValueNote"), salesDashboardOrders: document.querySelector("#salesDashboardOrders"), salesDashboardOrdersNote: document.querySelector("#salesDashboardOrdersNote"), salesDashboardUnits: document.querySelector("#salesDashboardUnits"), salesDashboardUnitsNote: document.querySelector("#salesDashboardUnitsNote"), salesDashboardAverageOrder: document.querySelector("#salesDashboardAverageOrder"), salesDashboardAverageOrderNote: document.querySelector("#salesDashboardAverageOrderNote"), salesDashboardStoresMetric: document.querySelector("#salesDashboardStoresMetric"), salesDashboardStoresMetricNote: document.querySelector("#salesDashboardStoresMetricNote"), salesDashboardRepsMetric: document.querySelector("#salesDashboardRepsMetric"), salesDashboardRepsMetricNote: document.querySelector("#salesDashboardRepsMetricNote"), salesDashboardMapped: document.querySelector("#salesDashboardMapped"), salesDashboardMappedNote: document.querySelector("#salesDashboardMappedNote"), salesDashboardNewLines: document.querySelector("#salesDashboardNewLines"), salesDashboardNewLinesNote: document.querySelector("#salesDashboardNewLinesNote"), salesDashboardImportLabel: document.querySelector("#salesDashboardImportLabel"), salesDashboardDaily: document.querySelector("#salesDashboardDaily"), salesDashboardRegions: document.querySelector("#salesDashboardRegions"), salesDashboardReps: document.querySelector("#salesDashboardReps"), salesDashboardManagers: document.querySelector("#salesDashboardManagers"), salesDashboardStores: document.querySelector("#salesDashboardStores"), salesDashboardProducts: document.querySelector("#salesDashboardProducts"), salesDashboardSkus: document.querySelector("#salesDashboardSkus"), salesDashboardStatuses: document.querySelector("#salesDashboardStatuses"), salesDashboardUnmappedCount: document.querySelector("#salesDashboardUnmappedCount"), salesDashboardUnmapped: document.querySelector("#salesDashboardUnmapped"), salesDashboardQualityState: document.querySelector("#salesDashboardQualityState"), salesDashboardQuality: document.querySelector("#salesDashboardQuality"), salesDashboardRecentOrdersCount: document.querySelector("#salesDashboardRecentOrdersCount"), salesDashboardRecentOrders: document.querySelector("#salesDashboardRecentOrders"), salesDrilldownDialog: document.querySelector("#salesDrilldownDialog"), salesDrilldownClose: document.querySelector("#salesDrilldownClose"), salesDrilldownTitle: document.querySelector("#salesDrilldownTitle"), salesDrilldownSubtitle: document.querySelector("#salesDrilldownSubtitle"), salesDrilldownPrimaryLabel: document.querySelector("#salesDrilldownPrimaryLabel"), salesDrilldownPrimaryValue: document.querySelector("#salesDrilldownPrimaryValue"), salesDrilldownPrimaryNote: document.querySelector("#salesDrilldownPrimaryNote"), salesDrilldownInsights: document.querySelector("#salesDrilldownInsights"), salesDrilldownChartEyebrow: document.querySelector("#salesDrilldownChartEyebrow"), salesDrilldownChartTitle: document.querySelector("#salesDrilldownChartTitle"), salesDrilldownBars: document.querySelector("#salesDrilldownBars"), salesDrilldownRecordsTitle: document.querySelector("#salesDrilldownRecordsTitle"), salesDrilldownRecordCount: document.querySelector("#salesDrilldownRecordCount"), salesDrilldownRows: document.querySelector("#salesDrilldownRows"), salesDrilldownPrevious: document.querySelector("#salesDrilldownPrevious"), salesDrilldownNext: document.querySelector("#salesDrilldownNext"), salesDrilldownPage: document.querySelector("#salesDrilldownPage"),
  insightsRefresh: document.querySelector("#insightsRefresh"), insightsPeriod: document.querySelector("#insightsPeriod"), insightsPageTitle: document.querySelector("#insightsPageTitle"), insightsPageNote: document.querySelector("#insightsPageNote"), insightsModulePages: document.querySelectorAll("[data-insights-page]"), insightsOverviewPage: document.querySelector("#insightsOverviewPage"), insightsPanels: document.querySelectorAll("[data-insights-panel]"), insightsRegion: document.querySelector("#insightsRegion"), insightsRep: document.querySelector("#insightsRep"), insightsManager: document.querySelector("#insightsManager"), insightsStatusFilter: document.querySelector("#insightsStatusFilter"), insightsClearFilters: document.querySelector("#insightsClearFilters"), insightsStatus: document.querySelector("#insightsStatus"), insightsSourceLine: document.querySelector("#insightsSourceLine"), insightsValue: document.querySelector("#insightsValue"), insightsValueNote: document.querySelector("#insightsValueNote"), insightsUnits: document.querySelector("#insightsUnits"), insightsUnitsNote: document.querySelector("#insightsUnitsNote"), insightsOrders: document.querySelector("#insightsOrders"), insightsOrdersNote: document.querySelector("#insightsOrdersNote"), insightsStores: document.querySelector("#insightsStores"), insightsStoresNote: document.querySelector("#insightsStoresNote"), insightsReps: document.querySelector("#insightsReps"), insightsRepsLabel: document.querySelector("#insightsRepsLabel"), insightsRepsNote: document.querySelector("#insightsRepsNote"), insightsAverageOrder: document.querySelector("#insightsAverageOrder"), insightsAverageOrderLabel: document.querySelector("#insightsAverageOrderLabel"), insightsAverageOrderNote: document.querySelector("#insightsAverageOrderNote"), insightsNarrativeScope: document.querySelector("#insightsNarrativeScope"), insightsNarrativeValue: document.querySelector("#insightsNarrativeValue"), insightsNarrativePeriod: document.querySelector("#insightsNarrativePeriod"), insightsNarrativeUnits: document.querySelector("#insightsNarrativeUnits"), insightsNarrativeStores: document.querySelector("#insightsNarrativeStores"), insightsLeadingRegion: document.querySelector("#insightsLeadingRegion"), insightsLeadingRegionNote: document.querySelector("#insightsLeadingRegionNote"), insightsLeadingProduct: document.querySelector("#insightsLeadingProduct"), insightsLeadingProductNote: document.querySelector("#insightsLeadingProductNote"), insightsLeadingRep: document.querySelector("#insightsLeadingRep"), insightsLeadingRepNote: document.querySelector("#insightsLeadingRepNote"), insightsImportState: document.querySelector("#insightsImportState"), insightsDaily: document.querySelector("#insightsDaily"), insightsSignals: document.querySelector("#insightsSignals"), insightsRegions: document.querySelector("#insightsRegions"), insightsProducts: document.querySelector("#insightsProducts"), insightsRepsChart: document.querySelector("#insightsRepsChart"), insightsManagersChart: document.querySelector("#insightsManagersChart"), insightsStoresChart: document.querySelector("#insightsStoresChart"), insightsStatusesChart: document.querySelector("#insightsStatusesChart"), insightsRecentCount: document.querySelector("#insightsRecentCount"), insightsRecentRows: document.querySelector("#insightsRecentRows")
  , stockFixFirebasePublishForm: document.querySelector("#stockFixFirebasePublishForm"), stockFixFirebaseWeek: document.querySelector("#stockFixFirebaseWeek"), stockFixFirebaseSource: document.querySelector("#stockFixFirebaseSource"), stockFixFirebasePublish: document.querySelector("#stockFixFirebasePublish"), stockFixFirebasePublishStatus: document.querySelector("#stockFixFirebasePublishStatus"), stockFixFirebasePublishedWeeks: document.querySelector("#stockFixFirebasePublishedWeeks"), stockFixPipelineRunForm: document.querySelector("#stockFixPipelineRunForm"), stockFixPipelineWeek: document.querySelector("#stockFixPipelineWeek"), stockFixPipelineSources: document.querySelector("#stockFixPipelineSources"), stockFixPipelineMappings: document.querySelector("#stockFixPipelineMappings"), stockFixPipelineStart: document.querySelector("#stockFixPipelineStart"), stockFixPipelineStatus: document.querySelector("#stockFixPipelineStatus"), stockFixRefresh: document.querySelector("#stockFixRefresh"), stockFixSourceLink: document.querySelector("#stockFixSourceLink"), stockFixSubtitle: document.querySelector("#stockFixSubtitle"), stockFixClient: document.querySelector("#stockFixClient"), stockFixBanner: document.querySelector("#stockFixBanner"), stockFixRegion: document.querySelector("#stockFixRegion"), stockFixClassification: document.querySelector("#stockFixClassification"), stockFixResourceType: document.querySelector("#stockFixResourceType"), stockFixActionStatus: document.querySelector("#stockFixActionStatus"), stockFixSearch: document.querySelector("#stockFixSearch"), stockFixWeek: document.querySelector("#stockFixWeek"), stockFixLatestWeek: document.querySelector("#stockFixLatestWeek"), stockFixStatus: document.querySelector("#stockFixStatus"), stockFixTasks: document.querySelector("#stockFixTasks"), stockFixTasksDelta: document.querySelector("#stockFixTasksDelta"), stockFixCaptured: document.querySelector("#stockFixCaptured"), stockFixCapturedDelta: document.querySelector("#stockFixCapturedDelta"), stockFixCaptureRate: document.querySelector("#stockFixCaptureRate"), stockFixCaptureRateDelta: document.querySelector("#stockFixCaptureRateDelta"), stockFixPending: document.querySelector("#stockFixPending"), stockFixPendingDelta: document.querySelector("#stockFixPendingDelta"), stockFixStores: document.querySelector("#stockFixStores"), stockFixSkus: document.querySelector("#stockFixSkus"), stockFixReps: document.querySelector("#stockFixReps"), stockFixClients: document.querySelector("#stockFixClients"), stockFixMissedSales: document.querySelector("#stockFixMissedSales"), stockFixFocus: document.querySelector("#stockFixFocus"), stockFixClassificationCards: document.querySelector("#stockFixClassificationCards"), stockFixReasonDonut: document.querySelector("#stockFixReasonDonut"), stockFixClassificationSummary: document.querySelector("#stockFixClassificationSummary"), stockFixClientsChart: document.querySelector("#stockFixClientsChart"), stockFixManagerChart: document.querySelector("#stockFixManagerChart"), stockFixRepChart: document.querySelector("#stockFixRepChart"), stockFixRegionChart: document.querySelector("#stockFixRegionChart"), stockFixResourceTypeChart: document.querySelector("#stockFixResourceTypeChart"), stockFixStatusChart: document.querySelector("#stockFixStatusChart"), stockFixRowsCount: document.querySelector("#stockFixRowsCount"), stockFixRowsTable: document.querySelector("#stockFixRowsTable"),
  attendanceDashboardRefresh: document.querySelector("#attendanceDashboardRefresh"), attendanceDashboardOperationalWeek: document.querySelector("#attendanceDashboardOperationalWeek"), attendanceDashboardPeriod: document.querySelector("#attendanceDashboardPeriod"), attendanceWorkspaceKicker: document.querySelector("#attendanceWorkspaceKicker"), attendanceCallcyclePageTitle: document.querySelector("#attendanceCallcyclePageTitle"), attendanceHeaderMetricLabel: document.querySelector("#attendanceHeaderMetricLabel"), attendanceHeaderStoreCount: document.querySelector("#attendanceHeaderStoreCount"), attendanceProductPanel: document.querySelector("#attendanceProductPanel"), attendanceCallCyclePanel: document.querySelector("#attendanceCallCyclePanel"), attendanceNavRegionCount: document.querySelector("#attendanceNavRegionCount"), attendanceNavResourceCount: document.querySelector("#attendanceNavResourceCount"), attendanceNavStoreCount: document.querySelector("#attendanceNavStoreCount"), attendanceSidebarDataDate: document.querySelector("#attendanceSidebarDataDate"), attendanceSidebarDataNote: document.querySelector("#attendanceSidebarDataNote"), attendanceGeoPanel: document.querySelector("#attendanceGeoPanel"), attendanceSalesforceDailyPanel: document.querySelector("#attendanceSalesforceDailyPanel"), attendanceSalesforceMonthlyPanel: document.querySelector("#attendanceSalesforceMonthlyPanel"), attendanceDashboardRole: document.querySelector("#attendanceDashboardRole"), attendanceDashboardRegion: document.querySelector("#attendanceDashboardRegion"), attendanceDashboardManager: document.querySelector("#attendanceDashboardManager"), attendanceDashboardClearFilters: document.querySelector("#attendanceDashboardClearFilters"), attendanceDashboardStatus: document.querySelector("#attendanceDashboardStatus"), attendanceDashboardUsers: document.querySelector("#attendanceDashboardUsers"), attendanceDashboardScheduled: document.querySelector("#attendanceDashboardScheduled"), attendanceDashboardOnSchedule: document.querySelector("#attendanceDashboardOnSchedule"), attendanceDashboardStrikeRate: document.querySelector("#attendanceDashboardStrikeRate"), attendanceDashboardLeave: document.querySelector("#attendanceDashboardLeave"), attendanceDashboardCheckins: document.querySelector("#attendanceDashboardCheckins"), attendanceDashboardAdditional: document.querySelector("#attendanceDashboardAdditional"), attendanceDashboardSourceRows: document.querySelector("#attendanceDashboardSourceRows"), attendanceDashboardSourceNote: document.querySelector("#attendanceDashboardSourceNote"), attendanceCoverageHeroCount: document.querySelector("#attendanceCoverageHeroCount"), attendanceCoverageHeroSub: document.querySelector("#attendanceCoverageHeroSub"), attendanceCoverageHeroBar: document.querySelector("#attendanceCoverageHeroBar"), attendanceCoverageHeroRate: document.querySelector("#attendanceCoverageHeroRate"), attendanceCoverageInsights: document.querySelector("#attendanceCoverageInsights"), attendanceCallCycleTiles: document.querySelector("#attendanceCallCycleTiles"), attendanceCoverageRegionCount: document.querySelector("#attendanceCoverageRegionCount"), attendanceCoverageRegionScorecard: document.querySelector("#attendanceCoverageRegionScorecard"), attendanceRegionalFootprint: document.querySelector("#attendanceRegionalFootprint"), attendanceCoverageStoreCount: document.querySelector("#attendanceCoverageStoreCount"), attendanceCoverageStoreRows: document.querySelector("#attendanceCoverageStoreRows"), attendanceCoverageResourceCount: document.querySelector("#attendanceCoverageResourceCount"), attendanceCoverageResourceRows: document.querySelector("#attendanceCoverageResourceRows"), attendanceCoverageDailyCount: document.querySelector("#attendanceCoverageDailyCount"), attendanceCoverageDailyRows: document.querySelector("#attendanceCoverageDailyRows"), attendanceCoverageUserCount: document.querySelector("#attendanceCoverageUserCount"), attendanceCoverageUserRows: document.querySelector("#attendanceCoverageUserRows"), attendanceDashboardRegions: document.querySelector("#attendanceDashboardRegions"), attendanceDashboardManagers: document.querySelector("#attendanceDashboardManagers"), attendanceDashboardWeekly: document.querySelector("#attendanceDashboardWeekly"), attendanceDashboardDaily: document.querySelector("#attendanceDashboardDaily"), attendanceDashboardRoles: document.querySelector("#attendanceDashboardRoles"), attendanceDashboardRowsCount: document.querySelector("#attendanceDashboardRowsCount"), attendanceDashboardRows: document.querySelector("#attendanceDashboardRows"), attendanceAudienceTabs: document.querySelectorAll("[data-attendance-audience]"), attendancePageTabs: document.querySelectorAll("[data-attendance-page]"), attendanceCoveragePages: document.querySelectorAll(".attendance-coverage-page"), attendanceWorkbookTabs: document.querySelectorAll("[data-attendance-workbook-tab]"), attendanceGeoOverview: document.querySelector("#attendanceGeoOverview"), attendanceGeoWorksheetPanel: document.querySelector("#attendanceGeoWorksheetPanel"), attendanceWorksheetTitle: document.querySelector("#attendanceWorksheetTitle"), attendanceWorksheetStatus: document.querySelector("#attendanceWorksheetStatus"), attendanceWorksheetHead: document.querySelector("#attendanceWorksheetHead"), attendanceWorksheetRows: document.querySelector("#attendanceWorksheetRows"), attendanceWorksheetPrevious: document.querySelector("#attendanceWorksheetPrevious"), attendanceWorksheetNext: document.querySelector("#attendanceWorksheetNext"), attendanceWorksheetPage: document.querySelector("#attendanceWorksheetPage")
};

Object.assign(elements, {
  insightsClient: document.querySelector("#insightsClient"),
  insightsWindow: document.querySelector("#insightsWindow"),
  insightsCategory: document.querySelector("#insightsCategory"),
  insightsBrand: document.querySelector("#insightsBrand"),
  insightsChannel: document.querySelector("#insightsChannel"),
  insightsRetailerFilter: document.querySelector("#insightsRetailerFilter"),
  insightsRetailer: document.querySelector("#insightsRetailer"),
  insightsDivision: document.querySelector("#insightsDivision"),
  insightsProduct: document.querySelector("#insightsProduct")
});

Object.assign(elements, {
  stockFixFieldRefresh: document.querySelector("#stockFixFieldRefresh"), stockFixFieldWeek: document.querySelector("#stockFixFieldWeek"), stockFixFieldRep: document.querySelector("#stockFixFieldRep"), stockFixFieldStore: document.querySelector("#stockFixFieldStore"), stockFixFieldStatus: document.querySelector("#stockFixFieldStatus"), stockFixFieldSearch: document.querySelector("#stockFixFieldSearch"), stockFixFieldStatusCopy: document.querySelector("#stockFixFieldStatusCopy"), stockFixFieldKpis: document.querySelector("#stockFixFieldKpis"), stockFixFieldListTitle: document.querySelector("#stockFixFieldListTitle"), stockFixFieldTaskCount: document.querySelector("#stockFixFieldTaskCount"), stockFixFieldTaskList: document.querySelector("#stockFixFieldTaskList"), stockFixFieldDetail: document.querySelector("#stockFixFieldDetail"), stockFixFieldEmpty: document.querySelector("#stockFixFieldEmpty"), stockFixFieldBack: document.querySelector("#stockFixFieldBack"), stockFixFieldTaskState: document.querySelector("#stockFixFieldTaskState"), stockFixFieldTaskSummary: document.querySelector("#stockFixFieldTaskSummary"), stockFixFieldCaptureForm: document.querySelector("#stockFixFieldCaptureForm"), stockFixFieldTaskId: document.querySelector("#stockFixFieldTaskId"), stockFixFieldStoreSoh: document.querySelector("#stockFixFieldStoreSoh"), stockFixFieldDcSoh: document.querySelector("#stockFixFieldDcSoh"), stockFixFieldP4Sales: document.querySelector("#stockFixFieldP4Sales"), stockFixFieldWfc: document.querySelector("#stockFixFieldWfc"), stockFixFieldPhysicalCount: document.querySelector("#stockFixFieldPhysicalCount"), stockFixFieldVariance: document.querySelector("#stockFixFieldVariance"), stockFixFieldSystemAdjusted: document.querySelector("#stockFixFieldSystemAdjusted"), stockFixFieldReason: document.querySelector("#stockFixFieldReason"), stockFixFieldActionTaken: document.querySelector("#stockFixFieldActionTaken"), stockFixFieldFeedback: document.querySelector("#stockFixFieldFeedback"), stockFixFieldEvidence: document.querySelector("#stockFixFieldEvidence"), stockFixFieldEvidencePreview: document.querySelector("#stockFixFieldEvidencePreview"), stockFixFieldComplete: document.querySelector("#stockFixFieldComplete")
});

Object.assign(elements, {
  stockFixRosterForm: document.querySelector("#stockFixRosterForm"),
  stockFixRosterUser: document.querySelector("#stockFixRosterUser"),
  stockFixRosterRepNames: document.querySelector("#stockFixRosterRepNames"),
  stockFixRosterSave: document.querySelector("#stockFixRosterSave"),
  stockFixRosterStatus: document.querySelector("#stockFixRosterStatus"),
  stockFixRosterList: document.querySelector("#stockFixRosterList")
});

Object.assign(elements, {
  stockFixSharePointSyncNow: document.querySelector("#stockFixSharePointSyncNow"),
  stockFixSharePointSyncStatus: document.querySelector("#stockFixSharePointSyncStatus")
});

Object.assign(elements, {
  resourcesView: document.querySelector("#resourcesView"),
  resourceRefresh: document.querySelector("#resourceRefresh"),
  newPortalResource: document.querySelector("#newPortalResource"),
  resourceAccessStatus: document.querySelector("#resourceAccessStatus"),
  resourceTotal: document.querySelector("#resourceTotal"),
  resourceActiveTotal: document.querySelector("#resourceActiveTotal"),
  resourceMasterTotal: document.querySelector("#resourceMasterTotal"),
  resourceStorageTotal: document.querySelector("#resourceStorageTotal"),
  resourceListCount: document.querySelector("#resourceListCount"),
  resourceSearch: document.querySelector("#resourceSearch"),
  resourceCategoryFilter: document.querySelector("#resourceCategoryFilter"),
  resourceActiveFilter: document.querySelector("#resourceActiveFilter"),
  resourceRows: document.querySelector("#resourceRows"),
  resourceEditorForm: document.querySelector("#resourceEditorForm"),
  resourceEditorTitle: document.querySelector("#resourceEditorTitle"),
  resourceEditorState: document.querySelector("#resourceEditorState"),
  resourceId: document.querySelector("#resourceId"),
  resourceTitle: document.querySelector("#resourceTitle"),
  resourceCategory: document.querySelector("#resourceCategory"),
  resourceTags: document.querySelector("#resourceTags"),
  resourceDescription: document.querySelector("#resourceDescription"),
  resourceFile: document.querySelector("#resourceFile"),
  resourceFileHint: document.querySelector("#resourceFileHint"),
  resourceActive: document.querySelector("#resourceActive"),
  deletePortalResource: document.querySelector("#deletePortalResource"),
  downloadPortalResource: document.querySelector("#downloadPortalResource"),
  savePortalResource: document.querySelector("#savePortalResource")
});

const state = {
  stockFixAdoptionData: null,
  stockFixAdoptionLoading: false,
  files: [],
  portalResources: [],
  portalResourceCategories: [],
  portalResourcesLoading: false,
  portalResourcesLoaded: false,
  selected: new Set(),
  visibleFileIds: [],
  fileQuery: "",
  fileType: "all",
  fileSort: "newest",
  filePage: 1,
  filePageSize: 25,
  busy: false,
  extractionRunning: false,
  isAdmin: false,
  isOperator: false,
  authResolved: false,
  userRole: "",
  operationsWorkspace: null,
  operationsPrompt: null,
  operationsRunDetail: null,
  operationsSmartSellMasterDirty: false,
  operationsScheduleProfileId: "",
  operationsScheduleDirty: false,
  operationsManualProfileId: "",
  selectedAdminJobRunId: "",
  adminJobDetail: null, adminJobRuns: [], adminJobHistoryLoaded: false, adminJobHistoryError: "", adminJobFiltersInitialised: false, adminLiveJobSummary: document.querySelector("#adminLiveJobSummary"), adminLiveJobList: document.querySelector("#adminLiveJobList"),
  uploadCount: 0,
  dashboardClients: [],
  dashboardUploads: [],
  retailers: [],
  retailerLoadStatus: "idle",
  retailerLoadError: "",
  extractionProfiles: [],
  geoRepStoreMasters: [],
  geoRepFormIntakes: [],
  geoRepBlueprints: [],
  geoRepBlueprintFolder: null,
  salesStoreMasters: [],
  salesDashboardConfig: null,
  geoRepOpenApiIntegration: null,
  salesTransactionImports: [],
  salesDashboardData: null,
  salesDashboardLoading: false,
  insightsData: null,
  insightsLoading: false,
  insightsPage: "overview",
  trainingHubData: null,
  trainingHubLoading: false,
  salesDrilldownMetric: "",
  salesDrilldownPage: 1,
  salesDrilldownLoading: false,
  salesDrilldownData: null,
  geoRepAttendanceConfig: null,
  attendanceStoreMasters: [],
  attendanceDashboardData: null,
  attendanceDashboardLoading: false,
  attendanceProduct: "attendance",
  callCycleSource: "dedicated",
  callCyclePage: "overview",
  callCycleStoreSort: "name",
  callCycleStorePage: 1,
  callCycleSelectedRep: "",
  callCycleSyndicatedData: null,
  callCycleLoading: false,
  attendanceDashboardSource: "geo",
  attendanceDashboardAudience: "rep",
  attendanceCoveragePage: "overview",
  attendanceWorkbookTab: "overview",
  attendanceWorksheetPage: 1,
  attendanceWorksheetLoading: false,
  attendanceWorksheetData: null,
  stockFixDashboardData: null,
  stockFixDashboardLoading: false,
  stockFixOperationalData: null,
  stockFixOperationalLoading: false,
  stockFixOperationalSelectedTask: null,
  stockFixOperationalRoster: [],
  stockFixFirebaseStatusLoading: false,
  stockFixAutomationStatusLoading: false,
  sharePointInventoryData: null,
  sharePointInventoryLoading: false,
  sharePointInventoryScanning: false,
  localCodeContractsPreparing: false,
  salesforceAttendanceDashboardData: null,
  salesforceAttendanceDashboardLoading: false,
  nexusAssistantBusy: false,
  nexusAssistantMessages: [],
  nexusAssistantView: "ask",
  nexusAssistantPromptTab: "saved",
  nexusAssistantLastPrompt: "",
  nexusAssistantLastAnswer: "",
  salesforceAttendanceConfig: null,
  displayCompliancePhaseTwoConfig: null,
  adminUsers: [],
  extractionRuns: [],
  activeExtractionRunId: "",
  activeExtractionRun: null,
  selectedExecutionRunId: "",
  handledPromptIds: new Set(),
  activeAutomationPrompt: null,
  extractionSteps: [],
  pendingDataset: null
};


let toastTimer = null;
let database = null;
let storage = null;
let operationsRefreshTimer = null;
let stockFixSearchTimer = null;
let stockFixFieldSearchTimer = null;
let auditedSessionUid = "";
let auth = null;
let cloudFunctions = null;
let adminUnsubscribers = [];
let ownerPromptUnsubscribe = null;
let dragDepth = 0;
let adminDragDepth = 0;
let extractionStatusTimer = null;

const CLIENTS = ["Agroserve","Alpen","Anchor","Aquelle","Aspen","Butterfly","Cape Cookies","Davidoff","Duracell","Dynamic Brands","Ethica","Lindt","Magalies","Penflex","PMI","Racefoods","SCJ","Sir Fruit","Sodastream","SOIL","Wilmar"];
const DASHBOARD_TYPES = { inventory: "Inventory", sales: "Sales" };
const GEO_REP_ATTENDANCE_PROFILE_ID = "geo-rep-attendance-for-reps";
const NAVIGATION_OPTIONS = {
  automation: "Report automation",
  attendance: "Time & Attendance",
  sales: "Sales dashboard",
  insights: "Insights",
  franchiseorder: "Franchise orders",
  training: "Training hub",
  stockfix: "Stock Fix",
  adoption: "Adoption",
  chat: "Meridian Chat",
  support: "Support"
};
const NORMAL_USER_DEFAULT_NAVIGATION = ["automation", "chat"];

function showToast(message, isError = false) {
  elements.toast.textContent = message;
  elements.toast.classList.toggle("error", isError);
  elements.toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("visible"), 4400);
}

function escapeHtml(value) {
  const label = String(value).replace(/\bgeo rep\b(?!\s+capture\b)/gi, "Geo Rep Capture");
  return label.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;"
  })[character]);
}

function compareText(left, right, ...fields) {
  const read = (item) => fields.map((field) => item?.[field]).find((value) => value !== undefined && value !== null && String(value).trim()) || "";
  return String(read(left)).localeCompare(String(read(right)));
}

function operatorCanAccessProfile(profileId) {
  if (!state.isOperator) return false;
  if (state.isAdmin) return true;
  if (!state.operationsWorkspace) return true;
  const profiles = Array.isArray(state.operationsWorkspace.profiles) ? state.operationsWorkspace.profiles : [];
  if (profiles.some((profile) => profile.id === profileId)) return true;
  const allowed = state.operationsWorkspace.account?.permissions?.allowedRetailerIds;
  return Array.isArray(allowed) && (!allowed.length || allowed.includes(profileId));
}

function normalUserNavigationIds(permissions = state.operationsWorkspace?.account?.permissions || {}) {
  if (state.userRole === "client") return [];
  const configured = Array.isArray(permissions.allowedNavigationIds) ? permissions.allowedNavigationIds : NORMAL_USER_DEFAULT_NAVIGATION;
  return [...new Set([...configured.filter((id) => id !== "chat" && Object.hasOwn(NAVIGATION_OPTIONS, id)), ...(permissions.chatEnabled === false ? [] : ["chat"]), "support"])];
}

function operatorCanAccessNavigation(menuId) {
  if (!state.isOperator) return false;
  if (menuId === "support") return state.userRole !== "client";
  if (menuId === "chat") return state.userRole !== "client" && state.operationsWorkspace?.account?.permissions?.chatEnabled !== false;
  if (state.isAdmin) return true;
  return normalUserNavigationIds().includes(menuId);
}

function normalUserLandingHash() {
  const firstAllowed = normalUserNavigationIds().find((id) => Object.hasOwn(NAVIGATION_OPTIONS, id));
  return firstAllowed ? `#${firstAllowed}` : "#home";
}

function operatorCanAccessGeoAttendance() {
  return operatorCanAccessNavigation("attendance");
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 1) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** unit);
  return `${value.toFixed(unit === 0 || value >= 10 ? 0 : 1)} ${units[unit]}`;
}

function formatDate(timestamp) {
  if (!timestamp) return "Just now";
  let date;
  try {
    if (typeof timestamp.toDate === "function") date = timestamp.toDate();
    else if (typeof timestamp.toMillis === "function") date = new Date(timestamp.toMillis());
    else if (typeof timestamp === "object" && Number.isFinite(Number(timestamp.seconds ?? timestamp._seconds))) date = new Date(Number(timestamp.seconds ?? timestamp._seconds) * 1000);
    else date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "Date unavailable";
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
  } catch {
    return "Date unavailable";
  }
}

function fileLabel(file) {
  const extension = file.name.includes(".") ? file.name.split(".").pop() : "file";
  return extension.slice(0, 4).toUpperCase();
}

function fileType(file) {
  return file.type || "Unknown file type";
}

function fileTimestamp(file) {
  const timestamp = file.uploadedAt || file.createdAt;
  if (typeof timestamp?.toMillis === "function") return timestamp.toMillis();
  const parsed = timestamp ? new Date(timestamp).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortFilesNewestFirst(left, right) {
  return fileTimestamp(right) - fileTimestamp(left) || String(right.id).localeCompare(String(left.id));
}

function openNexusLogin() {
  if (elements.nexusLoginStatus) elements.nexusLoginStatus.hidden = true;
  if (!elements.nexusLoginDialog?.open) elements.nexusLoginDialog?.showModal();
}

function setNexusLoginStatus(message, isError = false) {
  if (!elements.nexusLoginStatus) return;
  elements.nexusLoginStatus.textContent = message;
  elements.nexusLoginStatus.classList.toggle("error", isError);
  elements.nexusLoginStatus.hidden = !message;
}

function openNexusAccount() {
  const user = auth?.currentUser;
  if (!user || !state.isOperator) {
    openNexusLogin();
    return;
  }
  elements.nexusAccountEmail.textContent = user.email || "your Nexus account";
  elements.nexusPasswordForm.reset();
  if (!elements.nexusAccountDialog?.open) elements.nexusAccountDialog?.showModal();
}

function openNexusSession() {
  if (state.isOperator && auth?.currentUser) openNexusAccount();
  else openNexusLogin();
}

const NEXUS_ASSISTANT_PROMPTS = {
  saved: [
    { title: "What needs attention right now?", meta: "Nexus operations", prompt: "Summarise the current operational health and anything needing attention. State the source and period for each measure." },
    { title: "Which sales signals changed?", meta: "Geo sales", prompt: "Using the Geo Rep sales data, what is the current sales position, trend, and the leading products and regions?" },
    { title: "Compare attendance and call cycle", meta: "Time & Attendance", prompt: "Compare the current Geo attendance, Salesforce attendance, and Call Cycle signals. What gaps or risks should we act on?" }
  ],
  recent: [
    { title: "Check workbook readiness", meta: "Automation", prompt: "Check recent workbook contracts for schema changes, missing validation, or blueprint readiness issues." },
    { title: "Review Stock Fix status", meta: "Stock Fix", prompt: "Summarise latest Stock Fix performance, adoption, action backlog, and any data freshness risk." },
    { title: "Draft support update", meta: "Operations", prompt: "Draft a concise support update for failed, stalled, or no-data jobs, with evidence and next action." }
  ],
  suggested: [
    { title: "Cross-workspace review", meta: "All authorised data", prompt: "Compare the current Geo sales, Geo attendance, Salesforce attendance, Call Cycle, Stock Fix, and Training Hub operational signals. State the source and period for each measure." },
    { title: "Schedule advice", meta: "Automation", prompt: "Recommend schedule improvements from the recent run history and identify which jobs need owner attention." },
    { title: "Mapping proposal evidence", meta: "Data quality", prompt: "What evidence is required before proposing or approving a store, resource, or blueprint mapping change?" }
  ]
};

function nexusAssistantWorkspaceName() {
  const hash = String(window.location.hash || "#home").replace(/^#/, "") || "home";
  const labels = { home: "Meridian Nexus", insights: "Sales Insights", attendance: "Time & Attendance", callcycle: "Call Cycle", stockfix: "Stock Fix", resources: "Resources", automation: "Report Automation", admin: "Admin", training: "Training Hub" };
  return labels[hash] || "Meridian Nexus";
}

function nexusAssistantMessage(role, text) {
  state.nexusAssistantMessages.push({ role, text: String(text || "").slice(0, 9000) });
  renderNexusAssistantMessages();
}

function nexusAssistantInlineText(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function formatNexusAssistantAnswer(value) {
  const lines = String(value || "").replace(/\r/g, "").split("\n");
  const blocks = [];
  let listItems = [];
  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(`<ul>${listItems.map((item) => `<li>${nexusAssistantInlineText(item)}</li>`).join("")}</ul>`);
    listItems = [];
  };
  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      return;
    }
    const heading = /^(?:#{1,3}\s*)?(Answer|Evidence|Recommended action|Approval required)\s*:\s*(.*)$/i.exec(line);
    if (heading) {
      flushList();
      blocks.push(`<h3>${nexusAssistantInlineText(heading[1])}</h3>${heading[2] ? `<p>${nexusAssistantInlineText(heading[2])}</p>` : ""}`);
      return;
    }
    const bullet = /^(?:[-*]|\d+\.)\s+(.+)$/.exec(line);
    if (bullet) {
      listItems.push(bullet[1]);
      return;
    }
    flushList();
    blocks.push(`<p>${nexusAssistantInlineText(line)}</p>`);
  });
  flushList();
  return blocks.join("") || "<p>No analysis was returned.</p>";
}

function plainNexusAssistantAnswer(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/^(?:#{1,3}\s*)/, "").trim())
    .filter(Boolean);
}

function renderNexusAssistantPromptList() {
  if (!elements.nexusAssistantPromptList) return;
  const items = NEXUS_ASSISTANT_PROMPTS[state.nexusAssistantPromptTab] || NEXUS_ASSISTANT_PROMPTS.saved;
  elements.nexusAssistantPromptList.innerHTML = items.map((item) => `
    <button type="button" data-assistant-prompt="${escapeHtml(item.prompt)}">
      <span class="nexus-assistant-prompt-star">★</span>
      <span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.meta)}</small></span>
      <span class="nexus-assistant-prompt-menu">⋮</span>
    </button>
  `).join("");
  document.querySelectorAll("[data-assistant-prompt-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.assistantPromptTab === state.nexusAssistantPromptTab);
  });
}

function setNexusAssistantView(view) {
  const nextView = ["ask", "response", "task"].includes(view) ? view : "ask";
  state.nexusAssistantView = nextView;
  document.querySelectorAll("[data-assistant-view]").forEach((section) => {
    section.classList.toggle("is-active", section.dataset.assistantView === nextView);
  });
  const titles = { ask: "Ask AI", response: "Ask AI", task: "Create Task" };
  const subtitles = { ask: nexusAssistantWorkspaceName(), response: nexusAssistantWorkspaceName(), task: "From AI insight" };
  if (elements.nexusAssistantTitle) elements.nexusAssistantTitle.textContent = titles[nextView];
  if (elements.nexusAssistantSubtitle) elements.nexusAssistantSubtitle.textContent = subtitles[nextView];
  if (elements.nexusAssistantBack) elements.nexusAssistantBack.hidden = nextView === "ask";
  elements.nexusAssistantForm?.classList.toggle("is-hidden", nextView === "task");
}

function renderNexusAssistantResponse(answer, loading = false) {
  if (elements.nexusAssistantResponsePrompt) elements.nexusAssistantResponsePrompt.textContent = state.nexusAssistantLastPrompt || "Ask Nexus Assistant anything about your data.";
  if (elements.nexusAssistantResponseContext) elements.nexusAssistantResponseContext.textContent = `${nexusAssistantWorkspaceName()} + Gemini Flash`;
  if (elements.nexusAssistantAnswerText) {
    elements.nexusAssistantAnswerText.innerHTML = loading
      ? `<p class="nexus-assistant-loading">Analysing your authorised operational data...</p>`
      : formatNexusAssistantAnswer(answer);
  }
  const lines = plainNexusAssistantAnswer(answer).filter((line) => !/^(Answer|Evidence|Recommended action|Approval required)\s*:?$/i.test(line));
  const actionLines = lines.filter((line) => /risk|gap|behind|missing|failed|attention|declin|action|approval|required|stock|store|region|sales|attendance/i.test(line)).slice(0, 3);
  if (elements.nexusAssistantActionList) {
    elements.nexusAssistantActionList.innerHTML = loading || !actionLines.length ? "" : actionLines.map((line) => `
      <article><strong>${nexusAssistantInlineText(line.slice(0, 82))}${line.length > 82 ? "..." : ""}</strong><span>Review required</span></article>
    `).join("");
  }
  if (elements.nexusAssistantSuggestedStep) {
    elements.nexusAssistantSuggestedStep.textContent = loading
      ? "The assistant is checking the workspace context and source periods."
      : "Suggested next step: confirm the source period, assign the owner, then create a task or raise the relevant Stock Fix/action follow-up.";
  }
}

function renderNexusAssistantMessages() {
  renderNexusAssistantPromptList();
  const loading = state.nexusAssistantMessages.some((message) => message.role === "loading");
  const latestAnswer = [...state.nexusAssistantMessages].reverse().find((message) => message.role === "assistant");
  renderNexusAssistantResponse(loading ? "Analysing your authorised operational data..." : (latestAnswer?.text || state.nexusAssistantLastAnswer), loading);
  elements.nexusAssistantMessages?.scrollTo?.({ top: 0 });
}

function openNexusAssistant() {
  if (!state.isOperator || !auth?.currentUser) {
    openNexusLogin();
    return;
  }
  renderNexusAssistantMessages();
  setNexusAssistantView(state.nexusAssistantLastAnswer ? "response" : "ask");
  if (!elements.nexusAssistantDialog?.open) elements.nexusAssistantDialog?.showModal();
  window.setTimeout(() => elements.nexusAssistantQuestion?.focus(), 0);
}

async function askNexusAssistant(question) {
  const prompt = String(question || "").trim();
  if (!prompt) return;
  if (!state.isOperator || !cloudFunctions) {
    openNexusLogin();
    return;
  }
  if (state.nexusAssistantBusy) return;
  state.nexusAssistantBusy = true;
  elements.nexusAssistantSubmit.disabled = true;
  state.nexusAssistantLastPrompt = prompt;
  setNexusAssistantView("response");
  nexusAssistantMessage("user", prompt);
  nexusAssistantMessage("loading", "Analysing your authorised operational data...");
  try {
    const result = await callFunction("askNexusAssistant", {
      question: prompt,
      model: "gemini-3.5-flash"
    });
    state.nexusAssistantMessages = state.nexusAssistantMessages.filter((message) => message.role !== "loading");
    state.nexusAssistantLastAnswer = result.answer || "No analysis was returned.";
    nexusAssistantMessage("assistant", state.nexusAssistantLastAnswer);
    elements.nexusAssistantScope.textContent = result.scope || "Role-filtered Nexus operations data.";
  } catch (error) {
    state.nexusAssistantMessages = state.nexusAssistantMessages.filter((message) => message.role !== "loading");
    state.nexusAssistantLastAnswer = `I could not complete that analysis: ${friendlyError(error)}`;
    nexusAssistantMessage("assistant", state.nexusAssistantLastAnswer);
  } finally {
    state.nexusAssistantBusy = false;
    elements.nexusAssistantSubmit.disabled = false;
    renderNexusAssistantMessages();
  }
}

function prefillNexusAssistantTask() {
  const prompt = state.nexusAssistantLastPrompt || "Follow up on AI insight";
  const answer = plainNexusAssistantAnswer(state.nexusAssistantLastAnswer).slice(0, 4).join(" ");
  if (elements.nexusAssistantTaskTitle) elements.nexusAssistantTaskTitle.value = prompt.length > 80 ? `${prompt.slice(0, 77)}...` : prompt;
  if (elements.nexusAssistantTaskLocation) elements.nexusAssistantTaskLocation.value = nexusAssistantWorkspaceName();
  if (elements.nexusAssistantTaskProduct) elements.nexusAssistantTaskProduct.value = "Nexus insight";
  if (elements.nexusAssistantTaskAssignee) elements.nexusAssistantTaskAssignee.value = auth?.currentUser?.email || "Current user";
  if (elements.nexusAssistantTaskDue) elements.nexusAssistantTaskDue.value = "Today, before close of business";
  if (elements.nexusAssistantTaskPriority) elements.nexusAssistantTaskPriority.value = /failed|risk|urgent|missing|behind/i.test(`${prompt} ${answer}`) ? "High" : "Medium";
  if (elements.nexusAssistantTaskNote) elements.nexusAssistantTaskNote.value = answer || "Use the AI response as evidence, confirm the source period, and update the responsible owner.";
  setNexusAssistantView("task");
}

function syncNexusNavigationAccess() {
  nexusReadCache.sync();
  const signedIn = state.isOperator === true;
  document.querySelectorAll("[data-nexus-session]").forEach((button) => {
    button.hidden = false;
    button.textContent = signedIn ? "Account" : "Sign in";
    button.setAttribute("aria-label", signedIn ? "Manage account security" : "Sign in to Nexus");
  });
  const hasAdminAccess = state.isAdmin === true || state.userRole === "admin";
  const normalOperator = signedIn && !hasAdminAccess;
  document.querySelectorAll('[data-open-view="admin"]').forEach((button) => { button.hidden = !hasAdminAccess; });
  document.querySelectorAll('[data-open-view="resources"]').forEach((button) => { button.hidden = !hasAdminAccess; });
  document.querySelectorAll('[data-open-view="etls"]').forEach((button) => { button.hidden = !hasAdminAccess; });
  Object.keys(NAVIGATION_OPTIONS).forEach((view) => {
    const allowed = view === "chat" ? operatorCanAccessNavigation(view) : hasAdminAccess || operatorCanAccessNavigation(view);
    document.querySelectorAll(`[data-open-view="${view}"]`).forEach((button) => { button.hidden = !allowed; });
    document.querySelectorAll(`.nexus-home-destination.${view}`).forEach((card) => { card.hidden = !allowed; });
  });
  document.querySelectorAll('.nexus-home-nav [data-open-view="home"], .nexus-workspace-nav [data-open-view="home"]').forEach((button) => { button.hidden = normalOperator; });
  const requestedMenu = window.location.hash === "#attendance-jobs" ? "attendance" : String(window.location.hash || "").replace(/^#/, "");
  if (normalOperator && (state.operationsWorkspace || state.userRole === "client") && Object.hasOwn(NAVIGATION_OPTIONS, requestedMenu) && !operatorCanAccessNavigation(requestedMenu)) {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${normalUserLandingHash()}`);
    window.setTimeout(setViewFromHash, 0);
  }
  if (elements.openAdminReports) elements.openAdminReports.hidden = !hasAdminAccess;
  if (elements.stockFixAdoptionPublishForm) elements.stockFixAdoptionPublishForm.hidden = !hasAdminAccess;
  if (elements.nexusAssistantToggle) elements.nexusAssistantToggle.hidden = !signedIn || state.userRole === "client" || window.location.hash === "#chat";
  if (elements.nexusAssistantScope) {
    elements.nexusAssistantScope.textContent = signedIn
      ? (state.userRole === "admin" ? "Using administrator-scoped Nexus and Geo Rep aggregate data." : "Using your own jobs and aggregate data from the Nexus workspaces assigned to you.")
      : "Sign in to ask Nexus Assistant.";
  }
  if (!signedIn) elements.nexusAssistantDialog?.close();
  syncMeridianChat();
  syncFranchiseOrders();
  syncAttendanceJobSummaries();
  syncMeridianEtls();
  syncMeridianSupport();
  syncAttendanceExclusions();
  window.NexusJobStatus?.identity(state.isOperator && state.userRole !== "client" ? auth?.currentUser?.uid : null);
}

let attendanceJobSummarySession = null;
let attendanceJobSummaryRequest = 0;
let attendanceJobSummaryTab = "daily";
let attendanceJobSummaryData = null;

function setAttendanceJobSummaryTab(tab) {
  attendanceJobSummaryTab = tab === "monthly" ? "monthly" : "daily";
  document.querySelectorAll("[data-job-summary-tab]").forEach(button => {
    const active = button.dataset.jobSummaryTab === attendanceJobSummaryTab;
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
    document.getElementById(button.getAttribute("aria-controls")).hidden = !active;
  });
  const report = attendanceJobSummaryData?.[attendanceJobSummaryTab];
  document.getElementById("attendanceJobSummaryPeriod").textContent = report?.month
    ? `${attendanceJobSummaryTab === "monthly" ? "Monthly" : "Daily"} workbook updates | ${report.month}` : "Completed workbook updates";
}

function renderAttendanceJobSummaries(data) {
  attendanceJobSummaryData = data;
  renderSalesforceAttendanceLegacy(data);
  const values = {
    salesforceDailyPlanned: data?.daily?.metrics?.plannedRows,
    salesforceDailySourceRows: data?.daily?.metrics?.sourceRows,
    salesforceMonthlyUpdatedCells: data?.monthly?.latest?.monthlyPlan?.updatedCells,
    salesforceMonthlyPlannedRows: data?.monthly?.latest?.monthlyPlan?.plannedRows
  };
  Object.entries(values).forEach(([id, value]) => { document.getElementById(id).textContent = value == null ? "-" : attendanceDashboardNumber(value); });
  renderSalesforceWorkbookSnapshot("#salesforceDailySnapshotStatus", "#salesforceDailySnapshot", data?.daily?.workbookSnapshot, "No saved Daily workbook is available.");
  setAttendanceJobSummaryTab(attendanceJobSummaryTab);
}

function syncAttendanceJobSummaries() {
  if (window.location.hash === "#attendance-jobs" && state.authResolved && !state.isOperator) openNexusLogin();
  const active = window.location.hash === "#attendance-jobs" && state.authResolved && state.isOperator && cloudFunctions
    && (state.isAdmin || state.operationsWorkspace) && operatorCanAccessNavigation("attendance");
  const identity = active ? `${auth?.currentUser?.uid}:${nexusSessionGeneration}` : null;
  if (attendanceJobSummarySession === identity) return;
  attendanceJobSummarySession = identity;
  attendanceJobSummaryRequest += 1;
  renderAttendanceJobSummaries(null);
  document.getElementById("attendanceJobSummaryResults").hidden = true;
  document.getElementById("attendanceJobSummaryRefresh").disabled = !active;
  document.getElementById("attendanceJobSummaryAssistant").disabled = !active;
  document.getElementById("attendanceJobSummaryStatus").textContent = state.isOperator ? "Attendance access is required to view job summaries." : "Sign in to view completed attendance jobs.";
  if (active) loadAttendanceJobSummaries();
}

async function loadAttendanceJobSummaries() {
  if (!attendanceJobSummarySession || window.location.hash !== "#attendance-jobs") return;
  const request = ++attendanceJobSummaryRequest;
  const session = attendanceJobSummarySession;
  const status = document.getElementById("attendanceJobSummaryStatus");
  const refresh = document.getElementById("attendanceJobSummaryRefresh");
  refresh.disabled = true;
  document.getElementById("attendanceJobSummaryResults").hidden = true;
  status.textContent = "Loading completed Daily and Monthly workbook updates...";
  try {
    const data = await callFunction("getSalesforceAttendanceDashboard", {}, cachedDashboard(data => {
      if (request !== attendanceJobSummaryRequest || session !== attendanceJobSummarySession) return;
      renderAttendanceJobSummaries(data);
      document.getElementById("attendanceJobSummaryResults").hidden = false;
    }, status));
    if (request !== attendanceJobSummaryRequest || session !== attendanceJobSummarySession) return;
    renderAttendanceJobSummaries(data);
    document.getElementById("attendanceJobSummaryResults").hidden = false;
    status.textContent = data.daily?.history?.length || data.monthly?.history?.length
      ? "Completed workbook updates | Latest available reporting month | Up to 20 history entries per report"
      : "No completed attendance workbook updates have been recorded yet.";
  } catch (error) {
    if (request !== attendanceJobSummaryRequest || session !== attendanceJobSummarySession) return;
    renderAttendanceJobSummaries(null);
    status.textContent = `Could not load job summaries: ${friendlyError(error)} Use Refresh to retry.`;
  } finally {
    if (request === attendanceJobSummaryRequest && session === attendanceJobSummarySession) refresh.disabled = false;
  }
}

let attendanceExclusionsSession = null;
function syncAttendanceExclusions() {
  const active = window.location.hash === "#admin" && state.authResolved && state.isAdmin && document.querySelector('[data-admin-tab="geo-attendance"]')?.classList.contains("active");
  const identity = active ? `${auth?.currentUser?.uid}:${nexusSessionGeneration}` : null;
  if (attendanceExclusionsSession?.identity === identity) return;
  attendanceExclusionsSession?.stop(); attendanceExclusionsSession = null;
  const root = document.getElementById("attendanceExclusionsAdmin");
  if (active && root && window.NexusAttendanceExclusions) attendanceExclusionsSession = {identity, ...window.NexusAttendanceExclusions.mount(root, {
    call: data => callFunction("manageSyndicatedAttendanceExclusions", data),
    changed: () => nexusReadCache.clear()
  })};
}

let supportSession = null;
function syncMeridianSupport() {
  if (window.location.hash === "#support" && state.authResolved && !state.isOperator) openNexusLogin();
  const adminMode = window.location.hash === "#admin" && state.isAdmin && document.querySelector('[data-admin-tab="support"]')?.classList.contains("active");
  const staffMode = window.location.hash === "#support" && operatorCanAccessNavigation("support");
  const uid = state.authResolved && state.isOperator && (adminMode || staffMode) ? auth?.currentUser?.uid : null;
  const key = uid ? `${uid}:${adminMode ? "admin" : "mine"}:${state.isAdmin}` : null;
  if (supportSession?.key === key) return;
  supportSession?.stop(); supportSession = null;
  for (const id of ["adminSupport", "meridianSupport"]) document.getElementById(id)?.replaceChildren();
  if (uid && window.MeridianSupport) {
    supportSession = {key, ...window.MeridianSupport.mount(document.getElementById(adminMode ? "adminSupport" : "meridianSupport"), {
      admin: !!adminMode,
      call: data => callFunction("meridianSupport", data),
      onMine: () => { window.location.hash = "support"; setViewFromHash(); },
      onAdmin: state.isAdmin ? () => { openAdminWorkspace(); activateAdminTab("support"); } : null
    })};
  } else if (window.location.hash === "#support") document.getElementById("meridianSupport").textContent = "Sign in with your Meridian staff account to open Support.";
}

let franchiseOrderSession = null;
let franchiseOrderPage = "overview";
function syncFranchiseOrders() {
  const active = window.location.hash === "#franchiseorder" && state.authResolved && state.isOperator && operatorCanAccessNavigation("franchiseorder");
  const uid = active ? auth?.currentUser?.uid : null;
  if (franchiseOrderSession?.uid === uid) return;
  franchiseOrderSession?.stop();
  franchiseOrderSession = null;
  const root = document.getElementById("franchiseOrders");
  if (uid && window.FranchiseOrders) {
    franchiseOrderSession = {uid, ...window.FranchiseOrders.mount(root, data => callFunction("getFranchiseOrderDashboard", data), franchiseOrderPage)};
  } else if (root) {
    root.innerHTML = '<header class="fo-heading"><div><p>FRANCHISE ORDER</p><h1>Franchise Order</h1></div></header>';
    const message = document.createElement("p");
    message.className = "fo-message";
    message.textContent = uid ? "Franchise Order could not start. Reload Nexus to try again." : state.isOperator ? "Franchise Order access is not assigned to this account." : "Sign in to view Franchise Order.";
    root.append(message);
  }
  if (window.location.hash === "#franchiseorder" && state.authResolved && !state.isOperator) openNexusLogin();
}

let meridianChatSession = null;

function syncMeridianChat() {
  if (state.authResolved) window.MeridianChatTools?.identity(state.isOperator && operatorCanAccessNavigation("chat") ? auth?.currentUser?.uid || null : null).catch(() => {});
  const permitted = state.authResolved && state.isOperator && operatorCanAccessNavigation("chat");
  const visible = window.location.hash === "#chat";
  const uid = permitted ? auth?.currentUser?.uid : null;
  window.NexusComms?.sync({uid:database ? uid : null,database,call:callFunction,toast:showToast});
  if (meridianChatSession?.uid === uid && uid) {
    meridianChatSession.setVisible?.(visible);
    return;
  }
  meridianChatSession?.stop();
  meridianChatSession = null;
  const root = document.getElementById("meridianChat");
  if (uid && database && window.MeridianChat) {
    meridianChatSession = window.MeridianChat.mount(root, window.MeridianChat.firebaseAdapter(database, callFunction), uid);
    meridianChatSession.setVisible?.(visible);
  } else if (root) root.textContent = state.isOperator ? "Chat is switched off for this account." : "Sign in with your Meridian staff account.";
}

let meridianEtlSession = null;
let etlReferenceSession = null;
function syncEtlReferenceFiles() {
  const uid = window.location.hash === "#resources" && state.authResolved && state.isAdmin ? auth?.currentUser?.uid : null;
  if (etlReferenceSession?.uid === uid) return;
  etlReferenceSession?.stop(); etlReferenceSession = null;
  const root = document.getElementById("etlReferenceFiles");
  if (uid && root && window.MeridianEtlReferences) {
    etlReferenceSession = { uid, ...window.MeridianEtlReferences.mount(root, {
      call: async data => (await cloudFunctions.httpsCallable("meridianEtl", { timeout: 180000 })(data)).data,
      edit: async (role, id) => {
        if (id) { await loadPortalResources(true); editPortalResource(id); return; }
        resetPortalResourceEditor();
        elements.resourceTitle.value = window.MeridianEtlReferences.roles[role];
        elements.resourceCategory.value = role === "products" ? "Meridian Product Master" : role === "staffing" ? "Meridian Store Master" : role === "template" ? "Template" : "Reference";
        elements.resourceTags.value = `etl, anchor, etl-anchor-${role}`;
        elements.resourceFileHint.textContent = role === "template" ? "Blank XLSX inventory template: one Template sheet with the approved 17 columns." : "Choose the approved XLSX master file, up to 25 MB.";
        elements.resourceEditorForm.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }) };
  } else if (root) root.textContent = "";
}
function syncMeridianEtls() {
  syncEtlReferenceFiles();
  const uid = window.location.hash === "#etls" && state.authResolved && state.isAdmin ? auth?.currentUser?.uid : null;
  if (meridianEtlSession?.uid === uid) return;
  meridianEtlSession?.stop();
  meridianEtlSession = null;
  const root = document.getElementById("meridianEtls");
  if (uid && storage && window.MeridianEtls) {
    const generation = nexusSessionGeneration;
    const assertSession = () => {
      if (generation !== nexusSessionGeneration || auth.currentUser?.uid !== uid || !state.isAdmin) throw new Error("Sign in again to manage ETLs.");
    };
    const session = window.MeridianEtls.mount(root, {
      call: async data => (await cloudFunctions.httpsCallable("meridianEtl", { timeout: 180000 })(data)).data,
      portals: {
        load: async () => {
          assertSession();
          const workspace = await callFunction("getOperationsWorkspace", {});
          assertSession();
          state.operationsWorkspace = workspace;
          renderOperationsWorkspace();
          return { ...workspace, profiles: operationsProfiles(workspace) };
        },
        start: async data => {
          assertSession();
          if (!window.MeridianEtlPortals?.isProfile(data.retailerId) || state.operationsRunPending) throw new Error("A portal run is already being queued or this profile is unavailable.");
          state.operationsRunPending = true;
          try { return await callFunction("startExtraction", data); }
          finally { state.operationsRunPending = false; }
        },
        configure: id => {
          assertSession();
          if (!state.retailers.some(p => p.id === id)) throw new Error("Extraction profiles are still loading. Refresh and try again.");
          openAdminWorkspace(); activateAdminTab("retailers"); editRetailer(id);
          elements.retailerForm.scrollIntoView({ block: "start" });
        },
        verify: prompt => { assertSession(); handleAutomationPrompt(prompt); },
        abort: runId => { assertSession(); return callFunction("abortExtraction", { runId }); },
        download: async file => {
          assertSession();
          const blob = await getDownloadUrl(file);
          assertSession();
          triggerDownload(blob, file.originalName || file.name);
        }
      },
      upload: async (role, file, pipeline = { id: "anchor-pnp-v1", customer: "Anchor", channel: "Pick n Pay", channelId: "pnp" }) => {
        const id = `resource-${uniqueId()}`;
        const storagePath = `portal-resources/${id}/${Date.now()}_${safeStorageName(file.name)}`;
        const contentType = /\.txt$/i.test(file.name) ? "text/plain" : /\.csv$/i.test(file.name) ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        const upload = await storage.ref(storagePath).put(file, { contentType, contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`, customMetadata: { resourceId: id, source: "nexus-etls" } });
        if (Number(upload.metadata.size) !== file.size) throw new Error("The workbook upload did not pass size verification.");
        const result = await callFunction("savePortalResource", { id, title: `${pipeline.customer} / ${pipeline.channel} / ${role} / ${file.name}`, category: role === "products" ? "Meridian Product Master" : role === "staffing" ? "Meridian Store Master" : "Reference", tags: ["etl", pipeline.id, pipeline.channelId, ...(pipeline.id === "anchor-pnp-v1" ? ["anchor", `etl-anchor-${role}`] : [])], description: `${pipeline.customer} / ${pipeline.channel}: ${role} input for Nexus ETLs`, active: true, storagePath, sourceName: file.name });
        return result.resource;
      }
    });
    meridianEtlSession = { uid, stop: session.stop, updatePortal: session.updatePortal };
  } else if (root) root.textContent = "Administrator access is required to manage ETLs.";
  if (window.location.hash === "#etls" && state.authResolved && !state.isOperator) openNexusLogin();
}

function setViewFromHash() {
  if (window.location.hash === "#files") window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#home`);
  if (window.location.hash === "#portal") window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#home`);
  const showAutomation = window.location.hash === "#automation";
  const showAdmin = window.location.hash === "#admin";
  const showResources = window.location.hash === "#resources";
  const showEtls = window.location.hash === "#etls";
  const showChat = window.location.hash === "#chat";
  const showSupport = window.location.hash === "#support";
  const showFranchiseOrder = window.location.hash === "#franchiseorder";
  const showSalesDashboard = window.location.hash === "#sales";
  const showInsights = window.location.hash === "#insights";
  const showTraining = window.location.hash === "#training";
  const showAttendanceDashboard = window.location.hash === "#attendance";
  const showAttendanceJobs = window.location.hash === "#attendance-jobs";
  const showCallCycleDashboard = window.location.hash === "#callcycle";
  const showAttendanceWorkspace = showAttendanceDashboard || showCallCycleDashboard || showAttendanceJobs;
  const showStockFixDashboard = window.location.hash === "#stockfix" || window.location.hash === "#adoption";
  const showStockFixAdoption = window.location.hash === "#adoption";
  const requestedMenu = showSupport ? "support" : showFranchiseOrder ? "franchiseorder" : showChat ? "chat" : showAutomation ? "automation" : showSalesDashboard ? "sales" : showInsights ? "insights" : showTraining ? "training" : showAttendanceWorkspace ? "attendance" : showStockFixAdoption ? "adoption" : showStockFixDashboard ? "stockfix" : "";
  if (requestedMenu && state.authResolved && state.isOperator && !state.isAdmin && (state.operationsWorkspace || state.userRole === "client") && !operatorCanAccessNavigation(requestedMenu)) {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${normalUserLandingHash()}`);
    showToast("Your Nexus account is not permitted to open that workspace.", true);
    setViewFromHash();
    return;
  }
  if (showAttendanceWorkspace && !showAttendanceJobs && state.authResolved && state.isOperator && state.operationsWorkspace && !operatorCanAccessGeoAttendance()) {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${normalUserLandingHash()}`);
    showToast("Geo Rep Capture Attendance is not assigned to your Nexus account.", true);
    setViewFromHash();
    return;
  }
  if (showAdmin && state.authResolved && state.isOperator && !state.isAdmin) {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#automation`);
    setViewFromHash();
    return;
  }
  if ((showResources || showEtls) && state.authResolved && state.isOperator && !state.isAdmin) {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#automation`);
    showToast("Administrator access is required to manage controlled resources.", true);
    setViewFromHash();
    return;
  }
  if ((showSupport || showEtls || showFranchiseOrder || showChat || showAdmin || showResources || showAutomation || showSalesDashboard || showInsights || showTraining || showAttendanceWorkspace || showStockFixDashboard) && state.authResolved && !state.isOperator) window.setTimeout(openNexusLogin, 0);
  if (showSalesDashboard) loadSalesDashboard();
  if (showInsights) loadSalesInsights();
  if (showTraining) loadTrainingHub();
  if (showResources) loadPortalResources();
  if (showCallCycleDashboard) {
    setAttendanceProduct("callcycle", true);
    loadCallCycleDashboard();
  } else if (showAttendanceDashboard) {
    setAttendanceProduct("attendance", true);
    loadAttendanceDashboard();
  }
  if (showStockFixDashboard) {
    if (!showStockFixAdoption || operatorCanAccessNavigation("stockfix")) loadStockFixDashboard();
    activateStockFixTab(showStockFixAdoption ? "adoption" : "overview");
  }
  elements.homeView.hidden = showSupport || showEtls || showFranchiseOrder || showChat || showAdmin || showResources || showAutomation || showSalesDashboard || showInsights || showTraining || showAttendanceWorkspace || showStockFixDashboard;
  document.getElementById("supportView").hidden = !showSupport;
  syncMeridianSupport();
  document.getElementById("etlsView").hidden = !showEtls;
  syncMeridianEtls();
  document.getElementById("franchiseOrderView").hidden = !showFranchiseOrder;
  syncFranchiseOrders();
  document.getElementById("chatView").hidden = !showChat;
  if (elements.nexusAssistantToggle) elements.nexusAssistantToggle.hidden = showChat || !state.isOperator || state.userRole === "client";
  if (showChat) elements.nexusAssistantDialog?.close();
  syncMeridianChat();
  elements.salesDashboardView.hidden = !showSalesDashboard;
  if (elements.insightsView) elements.insightsView.hidden = !showInsights;
  if (elements.trainingView) elements.trainingView.hidden = !showTraining;
  elements.attendanceDashboardView.hidden = !showAttendanceWorkspace;
  elements.attendanceDashboardView.classList.toggle("attendance-jobs-active", showAttendanceJobs);
  document.getElementById("attendanceStandardHeader").hidden = showAttendanceJobs;
  document.getElementById("attendanceStandardControls").hidden = showAttendanceJobs;
  document.getElementById("attendanceJobSummaries").hidden = !showAttendanceJobs;
  syncAttendanceJobSummaries();
  syncAttendanceExclusions();
  if (elements.stockFixView) elements.stockFixView.hidden = !showStockFixDashboard;
  elements.automationView.hidden = !showAutomation;
  elements.adminPage.hidden = !showAdmin;
  if (elements.resourcesView) elements.resourcesView.hidden = !showResources;
  elements.filesView.hidden = true;
  elements.automationNav?.classList.toggle("active", showAutomation);
  elements.automationNav?.setAttribute("aria-current", showAutomation ? "page" : "false");
  elements.adminNav?.classList.toggle("active", showAdmin);
  elements.adminNav?.setAttribute("aria-current", showAdmin ? "page" : "false");
  elements.homeNav?.classList.toggle("active", !showAutomation && !showAdmin && !showResources && !showSalesDashboard && !showInsights && !showTraining && !showAttendanceWorkspace && !showStockFixDashboard);
  elements.homeNav?.setAttribute("aria-current", !showAutomation && !showAdmin && !showResources && !showSalesDashboard && !showInsights && !showTraining && !showAttendanceWorkspace && !showStockFixDashboard ? "page" : "false");
  const activeView = showSupport ? "support" : showEtls ? "etls" : showFranchiseOrder ? "franchiseorder" : showChat ? "chat" : showAutomation ? "automation" : showAdmin ? "admin" : showResources ? "resources" : showSalesDashboard ? "sales" : showInsights ? "insights" : showTraining ? "training" : showAttendanceWorkspace ? "attendance" : showStockFixAdoption ? "adoption" : showStockFixDashboard ? "stockfix" : "home";
  document.querySelectorAll(".nexus-home-nav [data-open-view], .nexus-workspace-nav [data-open-view]").forEach((button) => {
    const isCallCycleLink = button.dataset.attendanceProductLink === "callcycle";
    const source = button.dataset.attendanceSource;
    const attendanceMatch = showAttendanceJobs
      ? button.dataset.attendanceJobs === "true" || button.dataset.treeToggle === "attendance"
      : !button.dataset.attendanceJobs;
    const active = button.dataset.openView === activeView && attendanceMatch && (!isCallCycleLink || state.attendanceProduct === "callcycle") && (!source || (state.attendanceProduct === "attendance" && source === state.attendanceDashboardSource));
    button.classList.toggle("active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
  elements.skipLink.href = showAutomation ? "#automationView" : showAdmin ? "#adminPage" : showResources ? "#resourcesView" : showSalesDashboard ? "#salesDashboardView" : showInsights ? "#insightsView" : showTraining ? "#trainingView" : showAttendanceWorkspace ? "#attendanceDashboardView" : showStockFixDashboard ? "#stockFixView" : "#homeView";
  document.title = showAutomation ? "Report automation | Meridian Nexus" : showAdmin ? "Admin | Meridian Nexus" : showResources ? "Resources | Meridian Nexus" : showSalesDashboard ? "Sales dashboard | Meridian Nexus" : showInsights ? "Insights | Meridian Nexus" : showTraining ? "Training hub | Meridian Nexus" : showCallCycleDashboard ? "Call Cycle | Meridian Nexus" : showAttendanceDashboard ? "Time & Attendance | Meridian Nexus" : showStockFixAdoption ? "Stock Fix Adoption | Meridian Nexus" : showStockFixDashboard ? "Stock Fix dashboard | Meridian Nexus" : "Meridian Nexus";
  if (showAttendanceJobs) { document.title = "Job Summaries | Meridian Nexus"; elements.skipLink.href = "#attendanceJobSummaries"; }
  if (showSupport) { document.title = "Support | Meridian Nexus"; elements.skipLink.href = "#meridianSupport"; elements.homeNav?.classList.remove("active"); elements.homeNav?.setAttribute("aria-current", "false"); }
  if (showEtls) {
    document.title = "ETLs | Meridian Nexus";
    elements.skipLink.href = "#meridianEtls";
    elements.homeNav?.classList.remove("active");
    elements.homeNav?.setAttribute("aria-current", "false");
  }
  if (showFranchiseOrder) {
    document.title = "Franchise Order | Meridian Nexus";
    elements.skipLink.href = "#franchiseOrders";
    elements.homeNav?.classList.remove("active");
    elements.homeNav?.setAttribute("aria-current", "false");
    franchiseOrderSession?.setPage(franchiseOrderPage);
  }
  if (showChat) {
    document.title = "Meridian Chat | Meridian Nexus";
    elements.skipLink.href = "#meridianChat";
    elements.homeNav?.classList.remove("active");
    elements.homeNav?.setAttribute("aria-current", "false");
  }
}

function openFilesWorkspace() {
  openAutomationWorkspace();
}

function closeFilesWorkspace() {
  if (window.location.hash === "#files") {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#home`);
  }
  setViewFromHash();
}

function openAdminWorkspace() {
  if (!state.isAdmin) {
    if (state.isOperator) {
      showToast("Admin access is required for this workspace.", true);
      openAutomationWorkspace();
    } else {
      if (window.location.hash !== "#admin") window.location.hash = "admin";
      openNexusLogin();
    }
    return;
  }
  if (window.location.hash !== "#admin") window.location.hash = "admin";
  else setViewFromHash();
}

function closeAdminWorkspace() {
  if (window.location.hash === "#admin") window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#home`);
  setViewFromHash();
}

function openResourcesWorkspace() {
  if (!state.isAdmin) {
    if (state.isOperator) {
      showToast("Administrator access is required to manage controlled resources.", true);
      openAutomationWorkspace();
    } else {
      if (window.location.hash !== "#resources") window.location.hash = "resources";
      openNexusLogin();
    }
    return;
  }
  if (window.location.hash !== "#resources") window.location.hash = "resources";
  else setViewFromHash();
}

function fileCategory(file) {
  if (file.source === "retailer-extraction" || file.extractionRunId) return "reports";
  const extension = String(file.name || "").split(".").pop().toLowerCase();
  if (["xlsx", "xls", "xlsb", "csv", "ods"].includes(extension)) return "spreadsheets";
  if (["pdf", "doc", "docx", "txt", "rtf", "ppt", "pptx"].includes(extension)) return "documents";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension)) return "images";
  if (["zip", "rar", "7z", "tar", "gz"].includes(extension)) return "archives";
  return "other";
}

function filteredFiles() {
  const query = state.fileQuery.trim().toLowerCase();
  const filtered = state.files.filter((file) => {
    const matchesType = state.fileType === "all" || fileCategory(file) === state.fileType;
    const searchable = [file.name, file.originalName, file.retailerName, file.actualReportPeriod].filter(Boolean).join(" ").toLowerCase();
    return matchesType && (!query || searchable.includes(query));
  });
  return filtered.sort((left, right) => {
    if (state.fileSort === "oldest") return fileTimestamp(left) - fileTimestamp(right);
    if (state.fileSort === "name") return String(left.name).localeCompare(String(right.name));
    if (state.fileSort === "size") return Number(right.size || 0) - Number(left.size || 0);
    return sortFilesNewestFirst(left, right);
  });
}

function renderFiles() {
  const existingIds = new Set(state.files.map((file) => file.id));
  state.selected.forEach((id) => { if (!existingIds.has(id)) state.selected.delete(id); });
  const matchingFiles = filteredFiles();
  const pageCount = Math.max(1, Math.ceil(matchingFiles.length / state.filePageSize));
  state.filePage = Math.min(Math.max(1, state.filePage), pageCount);
  const start = (state.filePage - 1) * state.filePageSize;
  const pageFiles = matchingFiles.slice(start, start + state.filePageSize);
  state.visibleFileIds = pageFiles.map((file) => file.id);

  elements.fileList.innerHTML = pageFiles.map((file) => `
    <article class="file-row" data-file-id="${file.id}">
      <label class="checkbox-wrap">
        <input class="file-checkbox" type="checkbox" data-id="${file.id}" ${state.selected.has(file.id) ? "checked" : ""} />
        <span class="checkmark"></span><span class="sr-only">Select ${escapeHtml(file.name)}</span>
      </label>
      <div class="file-name-cell">
        <span class="file-type-icon">${escapeHtml(fileLabel(file))}</span>
        <span><strong title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</strong><small>${escapeHtml(fileType(file))}</small></span>
      </div>
      <span class="file-size">${formatBytes(file.size)}</span>
      <time class="file-date">${formatDate(file.uploadedAt || file.createdAt)}</time>
      <button class="icon-button download-one" type="button" data-id="${file.id}" aria-label="Download ${escapeHtml(file.name)}" title="Download">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v12m0 0 5-5m-5 5-5-5M5 20h14" /></svg>
      </button>
    </article>
  `).join("");

  const total = state.files.length;
  const matchCount = matchingFiles.length;
  const sortLabels = { newest: "Newest first", oldest: "Oldest first", name: "Name Aâ€“Z", size: "Largest first" };
  elements.fileSummary.textContent = matchCount === total ? `${total === 1 ? "1 file" : `${total} files`} Â· ${sortLabels[state.fileSort]}` : `${matchCount} of ${total} files Â· ${sortLabels[state.fileSort]}`;
  elements.emptyState.hidden = pageFiles.length > 0;
  elements.emptyStateTitle.textContent = total ? "No matching files" : "No files uploaded yet";
  elements.emptyStateCopy.textContent = total ? "Adjust the search or file type filter to see more results." : "Choose Upload files to add your first document.";
  elements.listHeader.hidden = pageFiles.length === 0;
  elements.filePagination.hidden = matchingFiles.length <= state.filePageSize;
  elements.filePageInfo.textContent = `Page ${state.filePage} of ${pageCount} Â· ${matchCount} files`;
  elements.filePrev.disabled = state.filePage <= 1;
  elements.fileNext.disabled = state.filePage >= pageCount;
  updateSelectionControls();
}

function updateSelectionControls() {
  const selectedCount = state.selected.size;
  const selectedVisible = state.visibleFileIds.filter((id) => state.selected.has(id)).length;
  const allSelected = state.visibleFileIds.length > 0 && selectedVisible === state.visibleFileIds.length;
  elements.selectAll.checked = allSelected;
  elements.selectAll.indeterminate = selectedVisible > 0 && !allSelected;
  elements.downloadSelected.disabled = selectedCount === 0 || state.busy;
  elements.deleteSelected.disabled = selectedCount === 0 || state.busy;
  elements.downloadSelected.querySelector("span").textContent = selectedCount ? `Download (${selectedCount})` : "Download selected";
  elements.deleteSelected.querySelector("span").textContent = selectedCount ? `Delete (${selectedCount})` : "Delete selected";
}

function createUploadItem(file) {
  const item = document.createElement("div");
  item.className = "upload-item";
  item.innerHTML = `<strong>${escapeHtml(file.name)}</strong><span>Preparing...</span><div class="progress-track"><div class="progress-bar"></div></div>`;
  elements.uploadQueue.append(item);
  elements.uploadQueue.hidden = false;
  state.uploadCount += 1;
  return item;
}

function finishUploadItem(item, message, failed = false) {
  const status = item.querySelector("span");
  status.textContent = message;
  if (failed) status.style.color = "#ff9d90";
  window.setTimeout(() => {
    item.remove();
    state.uploadCount -= 1;
    if (state.uploadCount === 0) elements.uploadQueue.hidden = true;
  }, failed ? 5000 : 1800);
}

function uniqueId() {
  return window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeStorageName(name) {
  const cleaned = name.replace(/[\\/]/g, "_").replace(/[\u0000-\u001f]/g, "").trim();
  return (cleaned || "unnamed-file").slice(-240);
}

function resourceTagsFromInput(value) {
  return [...new Set(String(value || "").split(",").map((tag) => tag.trim()).filter(Boolean))].slice(0, 16);
}

function portalResourceMatchesFilters(resource) {
  const search = String(elements.resourceSearch?.value || "").trim().toLowerCase();
  const category = elements.resourceCategoryFilter?.value || "";
  const activeOnly = elements.resourceActiveFilter?.checked === true;
  if (category && resource.category !== category) return false;
  if (activeOnly && resource.active === false) return false;
  if (!search) return true;
  return [resource.title, resource.category, resource.sourceName, resource.description, ...(resource.tags || [])]
    .join(" ").toLowerCase().includes(search);
}

function renderPortalResourceCategoryOptions() {
  if (!elements.resourceCategoryFilter) return;
  const selected = elements.resourceCategoryFilter.value;
  const categories = state.portalResourceCategories.length
    ? state.portalResourceCategories
    : [...new Set(state.portalResources.map((resource) => resource.category).filter(Boolean))];
  elements.resourceCategoryFilter.innerHTML = `<option value="">All categories</option>${categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}`;
  elements.resourceCategoryFilter.value = categories.includes(selected) ? selected : "";
}

function renderPortalResources() {
  if (!elements.resourceRows) return;
  etlReferenceSession?.refresh();
  renderPortalResourceCategoryOptions();
  const resources = state.portalResources.filter(portalResourceMatchesFilters);
  const active = state.portalResources.filter((resource) => resource.active !== false);
  const masterCount = state.portalResources.filter((resource) => /master/i.test(resource.category || "")).length;
  const storageBytes = state.portalResources.reduce((total, resource) => total + (Number(resource.size) || 0), 0);
  if (elements.resourceTotal) elements.resourceTotal.textContent = String(state.portalResources.length);
  if (elements.resourceActiveTotal) elements.resourceActiveTotal.textContent = String(active.length);
  if (elements.resourceMasterTotal) elements.resourceMasterTotal.textContent = String(masterCount);
  if (elements.resourceStorageTotal) elements.resourceStorageTotal.textContent = formatBytes(storageBytes);
  if (elements.resourceListCount) elements.resourceListCount.textContent = `${resources.length} resource${resources.length === 1 ? "" : "s"}`;
  if (!resources.length) {
    elements.resourceRows.innerHTML = `<tr><td colspan="6">${state.portalResources.length ? "No resources match the selected filters." : "No controlled source files have been added yet."}</td></tr>`;
    return;
  }
  elements.resourceRows.innerHTML = resources.map((resource) => {
    const tags = Array.isArray(resource.tags) && resource.tags.length ? `<small>${escapeHtml(resource.tags.join(", "))}</small>` : "";
    const stateLabel = resource.active === false ? `<span class="resource-state archived">Archived</span>` : `<span class="resource-state active">Active</span>`;
    return `<tr>
      <td><strong>${escapeHtml(resource.title)}</strong>${tags}</td>
      <td>${escapeHtml(resource.category)}${stateLabel}</td>
      <td><strong>${escapeHtml(resource.sourceName || "No file")}</strong><small>${formatBytes(Number(resource.size) || 0)}</small></td>
      <td>v${Number(resource.versionCount || 1)}</td>
      <td>${escapeHtml(formatDate(resource.updatedAt))}</td>
      <td><div class="resource-row-actions"><button type="button" class="icon-button" data-resource-download="${escapeHtml(resource.id)}" aria-label="Download ${escapeHtml(resource.title)}" title="Download"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"></path></svg></button><button type="button" class="icon-button" data-resource-edit="${escapeHtml(resource.id)}" aria-label="Edit ${escapeHtml(resource.title)}" title="Edit"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"></path></svg></button></div></td>
    </tr>`;
  }).join("");
}

function resetPortalResourceEditor() {
  if (!elements.resourceEditorForm) return;
  elements.resourceEditorForm.reset();
  elements.resourceId.value = "";
  elements.resourceCategory.value = "Meridian Store Master";
  elements.resourceActive.checked = true;
  elements.resourceEditorTitle.textContent = "New resource";
  elements.resourceEditorState.textContent = "Draft";
  elements.resourceEditorState.className = "entity-state";
  elements.resourceFileHint.textContent = "Choose the approved source file. Files up to 100 MB are accepted.";
  elements.deletePortalResource.hidden = true;
  elements.downloadPortalResource.hidden = true;
}

function editPortalResource(id) {
  const resource = state.portalResources.find((item) => item.id === id);
  if (!resource || !elements.resourceEditorForm) return;
  elements.resourceId.value = resource.id;
  elements.resourceTitle.value = resource.title || "";
  elements.resourceCategory.value = resource.category || "Other";
  elements.resourceTags.value = (resource.tags || []).join(", ");
  elements.resourceDescription.value = resource.description || "";
  elements.resourceActive.checked = resource.active !== false;
  elements.resourceFile.value = "";
  elements.resourceEditorTitle.textContent = resource.title || "Edit resource";
  elements.resourceEditorState.textContent = resource.active === false ? "Archived" : "Active";
  elements.resourceEditorState.className = `entity-state ${resource.active === false ? "" : "active"}`;
  elements.resourceFileHint.textContent = `${resource.sourceName || "No file"} - ${formatBytes(Number(resource.size) || 0)} - v${Number(resource.versionCount || 1)}. Choose a file only to replace the current version.`;
  elements.deletePortalResource.hidden = false;
  elements.downloadPortalResource.hidden = false;
  elements.resourceEditorForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadPortalResources(force = false) {
  const generation = nexusSessionGeneration;
  if (!elements.resourceAccessStatus) return;
  if (!state.isAdmin) {
    elements.resourceAccessStatus.textContent = "Administrator access is required to manage controlled resources.";
    return;
  }
  if (state.portalResourcesLoading) return;
  state.portalResourcesLoading = true;
  elements.resourceAccessStatus.textContent = "Loading controlled resource records...";
  try {
    const result = await callFunction("getPortalResources", {}, { force });
    state.portalResources = Array.isArray(result.resources) ? result.resources : [];
    state.portalResourceCategories = Array.isArray(result.categories) ? result.categories : [];
    state.portalResourcesLoaded = true;
    renderPortalResources();
    elements.resourceAccessStatus.textContent = state.portalResources.length
      ? `${state.portalResources.length} controlled resource${state.portalResources.length === 1 ? " is" : "s are"} available.`
      : "No controlled resources have been added yet.";
  } catch (error) {
    if (generation !== nexusSessionGeneration || error.code === "cancelled") return;
    elements.resourceAccessStatus.textContent = `Resources could not be loaded: ${friendlyError(error)}`;
    showToast(`Resources could not be loaded: ${friendlyError(error)}`, true);
  } finally {
    if (generation === nexusSessionGeneration) state.portalResourcesLoading = false;
  }
}

async function savePortalResource(event) {
  event.preventDefault();
  if (!state.isAdmin || !storage) return;
  const submit = event.submitter || elements.savePortalResource;
  const existingId = elements.resourceId.value.trim();
  const id = existingId || `resource-${uniqueId()}`;
  const file = elements.resourceFile.files?.[0] || null;
  const existing = state.portalResources.find((resource) => resource.id === id);
  if (!file && !existing) {
    showToast("Choose a resource file before saving a new resource.", true);
    return;
  }
  if (file && file.size > 100 * 1024 * 1024) {
    showToast("Resource files must be 100 MB or smaller.", true);
    return;
  }
  submit.disabled = true;
  let uploadedPath = "";
  try {
    let storagePath = "";
    let sourceName = existing?.sourceName || "";
    if (file) {
      const versionName = `${Date.now()}_${safeStorageName(file.name)}`;
      storagePath = `portal-resources/${id}/${versionName}`;
      uploadedPath = storagePath;
      elements.resourceEditorState.textContent = "Uploading";
      const upload = await storage.ref(storagePath).put(file, {
        contentType: file.type || "application/octet-stream",
        contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        customMetadata: { resourceId: id, source: "nexus-resources" }
      });
      if (Number(upload.metadata.size) !== file.size) throw new Error("The resource upload did not pass size verification.");
      sourceName = file.name;
    } else {
      storagePath = `portal-resources/${id}/`;
    }
    const result = await callFunction("savePortalResource", {
      id,
      title: elements.resourceTitle.value,
      category: elements.resourceCategory.value,
      tags: resourceTagsFromInput(elements.resourceTags.value),
      description: elements.resourceDescription.value,
      active: elements.resourceActive.checked,
      storagePath: uploadedPath || existing?.storagePath || storagePath,
      sourceName
    });
    const saved = result.resource;
    state.portalResources = [...state.portalResources.filter((resource) => resource.id !== saved.id), saved]
      .sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0));
    state.portalResourcesLoaded = true;
    renderPortalResources();
    editPortalResource(saved.id);
    elements.resourceAccessStatus.textContent = `${saved.title} was saved to the controlled resource catalogue.`;
    showToast("Resource saved.");
  } catch (error) {
    if (uploadedPath) await storage.ref(uploadedPath).delete().catch(() => {});
    elements.resourceEditorState.textContent = "Needs attention";
    elements.resourceEditorState.className = "entity-state warning";
    showToast(friendlyError(error), true);
  } finally {
    submit.disabled = false;
  }
}

async function downloadPortalResource(id = elements.resourceId?.value) {
  if (!id) return;
  try {
    const result = await callFunction("getPortalResourceDownload", { id });
    window.open(result.url, "_blank", "noopener,noreferrer");
  } catch (error) {
    showToast(friendlyError(error), true);
  }
}

async function deletePortalResource() {
  const id = elements.resourceId?.value;
  const resource = state.portalResources.find((item) => item.id === id);
  if (!id || !resource) return;
  if (!window.confirm(`Delete ${resource.title} and every stored version? This cannot be undone.`)) return;
  elements.deletePortalResource.disabled = true;
  try {
    await callFunction("deletePortalResource", { id });
    state.portalResources = state.portalResources.filter((item) => item.id !== id);
    renderPortalResources();
    resetPortalResourceEditor();
    elements.resourceAccessStatus.textContent = `${resource.title} was deleted from the controlled resource catalogue.`;
    showToast("Resource deleted.");
  } catch (error) {
    showToast(friendlyError(error), true);
  } finally {
    elements.deletePortalResource.disabled = false;
  }
}

function uploadFile(file) {
  return new Promise((resolve) => {
    const item = createUploadItem(file);
    const status = item.querySelector("span");
    const progress = item.querySelector(".progress-bar");
    const fileId = uniqueId();
    const storagePath = `uploads/${fileId}/${safeStorageName(file.name)}`;
    const reference = storage.ref(storagePath);
    const metadata = {
      contentType: file.type || "application/octet-stream",
      contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      customMetadata: { originalName: file.name, fileId }
    };
    const task = reference.put(file, metadata);

    task.on("state_changed", (snapshot) => {
      const percent = snapshot.totalBytes ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) : 0;
      progress.style.width = `${percent}%`;
      status.textContent = `${percent}% - ${formatBytes(snapshot.bytesTransferred)} of ${formatBytes(snapshot.totalBytes)}`;
    }, (error) => {
      finishUploadItem(item, "Upload failed", true);
      showToast(`${file.name}: ${friendlyError(error)}`, true);
      resolve(false);
    }, async () => {
      try {
        const uploadedSize = Number(task.snapshot.metadata.size);
        if (!Number.isFinite(uploadedSize) || uploadedSize !== file.size) {
          throw new Error(`Upload verification failed: expected ${file.size} bytes, Storage received ${uploadedSize} bytes.`);
        }
        await database.collection("files").doc(fileId).set({
          name: file.name,
          size: uploadedSize,
          type: file.type || "application/octet-stream",
          storagePath,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        progress.style.width = "100%";
        finishUploadItem(item, "Uploaded");
        resolve(true);
      } catch (error) {
        await reference.delete().catch(() => {});
        finishUploadItem(item, "Upload verification failed", true);
        showToast(`${file.name}: ${friendlyError(error)}`, true);
        resolve(false);
      }
    });
  });
}

async function uploadFiles(files) {
  if (!storage || !database) {
    showToast("File storage is not available. Refresh and try again.", true);
    return;
  }
  if (!files.length) return;
  const uploadableFiles = files.filter((file) => file instanceof File && file.size > 0);
  const skippedCount = files.length - uploadableFiles.length;
  if (!uploadableFiles.length) {
    showToast("No file content was found. Drop a folder again to upload the files inside it.", true);
    return;
  }
  if (skippedCount) showToast(`${skippedCount} empty folder placeholder${skippedCount === 1 ? " was" : "s were"} skipped.`);
  elements.fileInput.disabled = true;
  const results = new Array(uploadableFiles.length);
  let nextFileIndex = 0;
  const workerCount = Math.min(3, uploadableFiles.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextFileIndex < uploadableFiles.length) {
      const index = nextFileIndex;
      nextFileIndex += 1;
      results[index] = await uploadFile(uploadableFiles[index]);
    }
  }));
  elements.fileInput.disabled = false;
  elements.fileInput.value = "";
  const completed = results.filter(Boolean).length;
  if (completed) showToast(completed === 1 ? "File uploaded." : `${completed} files uploaded.`);
}

function containsFiles(event) {
  return [...(event.dataTransfer?.types || [])].includes("Files");
}

function setDropZoneActive(active) {
  elements.dropZone.classList.toggle("is-dragging", active);
  elements.dropZoneTitle.textContent = active ? "Release to upload files" : "Drag and drop files or folders here";
}

function fileFromEntry(entry) {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

function entriesFromReader(reader) {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

async function filesFromEntry(entry) {
  if (entry.isFile) return [await fileFromEntry(entry)];
  if (!entry.isDirectory) return [];
  const reader = entry.createReader();
  const entries = [];
  let batch = [];
  do {
    batch = await entriesFromReader(reader);
    entries.push(...batch);
  } while (batch.length);
  const nestedFiles = await Promise.all(entries.map(filesFromEntry));
  return nestedFiles.flat();
}

async function filesFromDrop(dataTransfer) {
  const items = [...(dataTransfer?.items || [])].filter((item) => item.kind === "file");
  const entries = items.map((item) => item.webkitGetAsEntry?.()).filter(Boolean);
  if (entries.length) {
    const nestedFiles = await Promise.all(entries.map(filesFromEntry));
    return nestedFiles.flat();
  }
  return [...(dataTransfer?.files || [])];
}

function openFilePicker() {
  if (!elements.fileInput.disabled) elements.fileInput.click();
}

function friendlyError(error) {
  const code = error?.code || "";
  if (code.includes("wrong-password") || code.includes("invalid-credential")) return "the email or password is incorrect";
  if (code.includes("user-not-found")) return "no Nexus account exists for that email";
  if (code.includes("user-disabled")) return "this Nexus account is disabled";
  if (code.includes("too-many-requests")) return "too many attempts; please wait before trying again";
  if (code.includes("weak-password")) return "use a stronger password of at least eight characters";
  if (code.includes("requires-recent-login")) return "enter your current password and try again";
  if (code.includes("unauthorized") || code.includes("permission-denied")) return "access is not permitted";
  if (code.includes("canceled")) return "upload cancelled";
  if (code.includes("quota")) return "storage quota exceeded";
  if (code.includes("network")) return "network connection lost";
  return error?.message || "an unexpected error occurred";
}

async function getDownloadUrl(file) {
  if (file.downloadKind === "extraction-report" || file.source === "retailer-extraction") {
    const chunks = [];
    let start = 0, generation, size;
    for (;;) {
      const result = await callFunction("getPortalResourceDownload", { kind: "extraction-report", id: file.id, start, ...(generation ? { generation } : {}) });
      if (!Number.isSafeInteger(result.size) || result.size <= 0 || result.size > 512 * 1024 * 1024
        || (size && size !== result.size) || (generation && generation !== result.generation)) throw new Error("The report changed during download. Please retry.");
      const bytes = Uint8Array.from(atob(result.chunk), character => character.charCodeAt(0));
      if (!bytes.length || result.nextOffset !== start + bytes.length || result.nextOffset > result.size) throw new Error("The report download was incomplete. Please retry.");
      chunks.push(bytes); start = result.nextOffset; size = result.size; generation = result.generation;
      if (result.complete) {
        if (start !== size) throw new Error("The report download was incomplete. Please retry.");
        return URL.createObjectURL(new Blob(chunks, { type: result.contentType || "application/octet-stream" }));
      }
      if (start >= size) throw new Error("The report download was incomplete. Please retry.");
    }
  }
  return storage.ref(file.storagePath).getDownloadURL();
}

function triggerDownload(url, index = 0, name = "") {
  window.setTimeout(() => {
    if (url.startsWith("blob:")) {
      const link = document.createElement("a");
      link.href = url; link.download = name || "Report"; document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 120000);
      return;
    }
    const frame = document.createElement("iframe");
    frame.hidden = true;
    frame.src = url;
    document.body.append(frame);
    window.setTimeout(() => frame.remove(), 120000);
  }, index * 350);
}

async function downloadFiles(files) {
  if (!files.length) return;
  state.busy = true;
  updateSelectionControls();
  try {
    const results = await Promise.allSettled(files.map(getDownloadUrl));
    const urls = results.flatMap((result, index) => result.status === "fulfilled" ? [{ url: result.value, name: files[index].name || files[index].originalName }] : []);
    urls.forEach((item, index) => triggerDownload(item.url, index, item.name));
    if (urls.length) showToast(urls.length === 1 ? "Download started." : `${urls.length} downloads started.`);
    if (urls.length !== files.length) showToast(`${files.length - urls.length} file downloads failed.`, true);
  } finally {
    state.busy = false;
    updateSelectionControls();
  }
}

async function deleteFiles(files) {
  state.busy = true;
  updateSelectionControls();
  const results = await Promise.allSettled(files.map(async (file) => {
    try {
      await storage.ref(file.storagePath).delete();
    } catch (error) {
      if (error?.code !== "storage/object-not-found") throw error;
    }
    await database.collection("files").doc(file.id).delete();
    state.selected.delete(file.id);
  }));
  const deleted = results.filter((result) => result.status === "fulfilled").length;
  const failed = results.length - deleted;
  state.busy = false;
  updateSelectionControls();
  if (deleted) showToast(deleted === 1 ? "File deleted." : `${deleted} files deleted.`);
  if (failed) showToast(`${failed} file${failed === 1 ? "" : "s"} could not be deleted.`, true);
}

function selectedFiles() {
  return state.files.filter((file) => state.selected.has(file.id));
}

function slugify(value) {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "client";
}

function numberValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function compactNumber(value) {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(Number(value) || 0);
}

function normalHeader(value) {
  return String(value).toLowerCase().replace(/[_\-/]+/g, " ").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

const FIELD_ALIASES = {
  date: ["date","week","period","report date","inventory date","sales date","week ending","month"],
  store: ["store","store name","site","outlet","branch","customer name","location"],
  sku: ["sku","product","product code","item","item code","barcode","material","description","product name"],
  stock: ["stock","inventory","soh","stock on hand","quantity","qty","units","closing stock","current stock"],
  sales: ["sales","sales value","revenue","turnover","net sales","sales units","units sold"],
  cover: ["days cover","weeks cover","cover","woc","stock cover"]
};

function detectColumns(headers) {
  const normalized = headers.map((header) => ({ original: header, value: normalHeader(header) }));
  return Object.fromEntries(Object.entries(FIELD_ALIASES).map(([field, aliases]) => {
    const exact = normalized.find((header) => aliases.includes(header.value));
    const partial = normalized.find((header) => aliases.some((alias) => header.value.includes(alias) || alias.includes(header.value)));
    return [field, (exact || partial)?.original || null];
  }));
}

function parseDateValue(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value;
  if (typeof value === "number" && window.XLSX?.SSF) {
    const parts = XLSX.SSF.parse_date_code(value);
    if (parts) return new Date(parts.y, parts.m - 1, parts.d);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function periodLabel(value, index) {
  const date = parseDateValue(value);
  if (!date) return `Period ${index + 1}`;
  return new Intl.DateTimeFormat(undefined, { month: "short", year: "2-digit" }).format(date);
}

function buildSnapshot(rows, mapping, clientName, sourceName, dashboardType = "inventory") {
  const stores = new Set();
  const skus = new Set();
  const periodTotals = new Map();
  const risks = new Map();
  let totalStock = 0;
  let totalSales = 0;
  let healthy = 0;
  let low = 0;
  let out = 0;
  rows.forEach((row, index) => {
    const store = (String(row[mapping.store] ?? "Unknown store").trim() || "Unknown store").slice(0, 160);
    const sku = (String(row[mapping.sku] ?? "Unknown product").trim() || "Unknown product").slice(0, 200);
    const stock = mapping.stock ? numberValue(row[mapping.stock]) : 0;
    const sales = mapping.sales ? numberValue(row[mapping.sales]) : 0;
    const cover = mapping.cover ? numberValue(row[mapping.cover]) : null;
    const date = mapping.date ? parseDateValue(row[mapping.date]) : null;
    const periodKey = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` : `row-${Math.floor(index / Math.max(1, Math.ceil(rows.length / 8)))}`;
    stores.add(store);
    skus.add(sku);
    totalStock += stock;
    totalSales += sales;
    periodTotals.set(periodKey, (periodTotals.get(periodKey) || 0) + (mapping.stock ? stock : sales));
    let status = "healthy";
    if (stock <= 0 && mapping.stock) { out += 1; status = "out"; }
    else if (mapping.stock && ((cover !== null && cover > 0 && cover <= 2) || stock <= 10)) { low += 1; status = "low"; }
    else healthy += 1;
    if (status !== "healthy") {
      const key = `${store}||${sku}`;
      const existing = risks.get(key) || { store, sku, stock: 0, status };
      existing.stock += stock;
      if (status === "out") existing.status = "out";
      risks.set(key, existing);
    }
  });
  const observations = Math.max(1, healthy + low + out);
  const trend = [...periodTotals.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([key, value], index) => ({ label: key.startsWith("row-") ? periodLabel(null, index) : periodLabel(`${key}-01`, index), value: Math.round(value * 100) / 100 }));
  const topRisks = [...risks.values()].sort((a, b) => (a.status === b.status ? a.stock - b.stock : a.status === "out" ? -1 : 1)).slice(0, 20).map((risk) => ({ ...risk, stock: Math.round(risk.stock * 100) / 100 }));
  return {
    clientId: slugify(clientName), clientName, dashboardType, sourceName, rowCount: rows.length,
    totalStock: Math.round(totalStock * 100) / 100, totalSales: Math.round(totalSales * 100) / 100,
    stores: stores.size, skus: skus.size, availabilityRate: Math.round(((healthy + low) / observations) * 1000) / 10,
    stockHealth: { healthy, low, out }, trend, topRisks
  };
}

let spreadsheetReaderPromise;
function ensureSpreadsheetReader() {
  if (window.XLSX) return Promise.resolve();
  if (!spreadsheetReaderPromise) spreadsheetReaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
    script.onload = () => window.XLSX ? resolve() : reject(new Error("Spreadsheet reader is unavailable."));
    script.onerror = () => reject(new Error("Could not load the spreadsheet reader. Check the connection and try again."));
    document.head.append(script);
  }).catch(error => { spreadsheetReaderPromise = null; throw error; });
  return spreadsheetReaderPromise;
}
async function parseSourceFile(file) {
  await ensureSpreadsheetReader();
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!["xlsx","xls","xlsb","csv"].includes(extension)) throw new Error("Admin accepts Excel or CSV source files.");
  if (file.size > 250 * 1024 * 1024) throw new Error("This browser-based dashboard source is limited to 250 MB. Split larger datasets into client periods.");
  elements.adminDropTitle.textContent = "Reading and validating source...";
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("The workbook has no worksheets.");
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null, raw: true });
  if (!rows.length) throw new Error("The first worksheet contains no data rows.");
  const headers = Object.keys(rows[0]);
  const mapping = detectColumns(headers);
  if (!mapping.stock && !mapping.sales) throw new Error("No stock, quantity, sales or revenue column could be identified.");
  return { file, rows, mapping, sheetName };
}

function selectedClientName() {
  return elements.adminClient.value === "__new" ? elements.customClient.value.trim() : elements.adminClient.value;
}

function dashboardTypeFor(dataset) {
  if (elements.sourceType.value !== "auto") return elements.sourceType.value;
  return dataset?.mapping.stock ? "inventory" : "sales";
}

function dashboardTypeOf(snapshot) {
  return DASHBOARD_TYPES[snapshot.dashboardType] ? snapshot.dashboardType : "inventory";
}

function dashboardDocumentId(clientId, dashboardType) {
  return dashboardType === "inventory" ? clientId : `${clientId}--${dashboardType}`;
}

function renderSourcePreview() {
  const pending = state.pendingDataset;
  if (!pending) { elements.sourcePreview.hidden = true; elements.publishDataset.disabled = true; return; }
  const mappings = Object.entries(pending.mapping).filter(([, value]) => value);
  const dashboardType = dashboardTypeFor(pending);
  elements.sourcePreview.innerHTML = `<div class="preview-title"><strong>${escapeHtml(pending.file.name)}</strong><span>${pending.rows.length.toLocaleString()} rows - ${escapeHtml(pending.sheetName)} - ${DASHBOARD_TYPES[dashboardType]} dashboard</span></div><div class="mapping-grid">${mappings.map(([field, column]) => `<span>${escapeHtml(field)}<strong>${escapeHtml(column)}</strong></span>`).join("")}</div>${!pending.mapping.store || !pending.mapping.sku ? `<p class="preview-warning">Some location or product fields were not detected. The dashboard will group missing values as unknown.</p>` : ""}`;
  elements.sourcePreview.hidden = false;
  elements.publishDataset.disabled = !selectedClientName();
}

async function chooseAdminFile(file) {
  if (!file) return;
  state.pendingDataset = null;
  renderSourcePreview();
  try {
    state.pendingDataset = await parseSourceFile(file);
    elements.adminDropTitle.textContent = "Source ready to publish";
    renderSourcePreview();
  } catch (error) {
    elements.adminDropTitle.textContent = "Drop a source file here";
    showToast(friendlyError(error), true);
  }
}

function aggregateSnapshots(snapshots) {
  const combined = { totalStock: 0, totalSales: 0, stores: 0, skus: 0, availabilityRate: 0, stockHealth: { healthy: 0, low: 0, out: 0 }, trend: [], topRisks: [] };
  const periods = new Map();
  let weightedAvailability = 0;
  let totalRows = 0;
  snapshots.forEach((item) => {
    combined.totalStock += numberValue(item.totalStock); combined.totalSales += numberValue(item.totalSales); combined.stores += numberValue(item.stores); combined.skus += numberValue(item.skus);
    const rows = numberValue(item.rowCount); totalRows += rows; weightedAvailability += numberValue(item.availabilityRate) * rows;
    ["healthy","low","out"].forEach((key) => { combined.stockHealth[key] += numberValue(item.stockHealth?.[key]); });
    (item.trend || []).forEach((point) => periods.set(point.label, (periods.get(point.label) || 0) + numberValue(point.value)));
    combined.topRisks.push(...(item.topRisks || []).map((risk) => ({ ...risk, clientName: item.clientName })));
  });
  combined.availabilityRate = totalRows ? weightedAvailability / totalRows : 0;
  combined.trend = [...periods.entries()].slice(-12).map(([label, value]) => ({ label, value }));
  combined.topRisks = combined.topRisks.slice(0, 20);
  return combined;
}

function renderTrend(points) {
  if (!points?.length) { elements.trendChart.innerHTML = `<div class="chart-empty">Upload source data to build the trend.</div>`; return; }
  const width = 760, height = 240, padX = 36, padY = 22;
  const values = points.map((point) => numberValue(point.value));
  const max = Math.max(...values, 1), min = Math.min(...values, 0), range = Math.max(1, max - min);
  const coords = points.map((point, index) => ({ x: padX + (index * (width - padX * 2) / Math.max(1, points.length - 1)), y: padY + ((max - numberValue(point.value)) / range) * (height - padY * 2), ...point }));
  const line = coords.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${padX},${height - padY} ${line} ${coords.at(-1).x},${height - padY}`;
  elements.trendChart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Stock trend"><defs><linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8a18" stop-opacity=".28"/><stop offset="1" stop-color="#ff8a18" stop-opacity="0"/></linearGradient></defs>${[0,1,2,3].map((lineIndex) => `<line class="chart-grid" x1="${padX}" y1="${padY + lineIndex * 60}" x2="${width - padX}" y2="${padY + lineIndex * 60}"/>`).join("")}<polygon class="chart-area" points="${area}"/><polyline class="chart-line" points="${line}"/>${coords.map((point, index) => `<circle class="chart-point" cx="${point.x}" cy="${point.y}" r="4"><title>${escapeHtml(point.label)}: ${numberValue(point.value).toLocaleString()}</title></circle>${(index === 0 || index === coords.length - 1 || coords.length < 7) ? `<text class="chart-label" x="${point.x}" y="${height - 4}" text-anchor="middle">${escapeHtml(point.label)}</text>` : ""}`).join("")}</svg>`;
}

function renderDashboard() {
  const selectedClient = elements.clientFilter.value || "all";
  const selectedType = elements.dashboardTypeFilter.value || "all";
  const visible = state.dashboardClients.filter((dashboard) =>
    (selectedClient === "all" || dashboard.clientId === selectedClient)
    && (selectedType === "all" || dashboardTypeOf(dashboard) === selectedType)
  );
  const data = aggregateSnapshots(visible);
  const hasData = visible.length > 0;
  elements.metricStock.textContent = hasData ? compactNumber(data.totalStock) : "--";
  elements.metricStores.textContent = hasData ? data.stores.toLocaleString() : "--";
  elements.metricSkus.textContent = hasData ? data.skus.toLocaleString() : "--";
  elements.metricAvailability.textContent = hasData ? `${data.availabilityRate.toFixed(1)}%` : "--";
  elements.dataStatus.className = `data-status ${hasData ? "ready" : "empty"}`;
  elements.dataStatus.querySelector("strong").textContent = hasData ? `${visible.length} client dashboard${visible.length === 1 ? "" : "s"} live` : "No dashboard data yet";
  elements.dataStatusCopy.textContent = hasData ? `Updated from ${visible.reduce((sum, item) => sum + numberValue(item.rowCount), 0).toLocaleString()} source rows` : "Open Admin to publish the first Excel or CSV source.";
  renderTrend(data.trend);
  const healthTotal = data.stockHealth.healthy + data.stockHealth.low + data.stockHealth.out;
  const healthyPercent = healthTotal ? (data.stockHealth.healthy / healthTotal) * 100 : 0;
  const lowPercent = healthTotal ? (data.stockHealth.low / healthTotal) * 100 : 0;
  elements.stockDonut.style.background = healthTotal ? `conic-gradient(#37c983 0 ${healthyPercent}%,#ffad26 ${healthyPercent}% ${healthyPercent + lowPercent}%,#f15e55 ${healthyPercent + lowPercent}% 100%)` : "conic-gradient(#284b69 0 100%)";
  elements.healthScore.textContent = healthTotal ? `${Math.round(healthyPercent)}%` : "--";
  elements.healthyCount.textContent = data.stockHealth.healthy.toLocaleString(); elements.lowCount.textContent = data.stockHealth.low.toLocaleString(); elements.outCount.textContent = data.stockHealth.out.toLocaleString();
  elements.clientBars.innerHTML = visible.length ? visible.slice().sort((a,b) => numberValue(b.availabilityRate) - numberValue(a.availabilityRate)).slice(0,8).map((client) => `<div class="client-bar"><span title="${escapeHtml(client.clientName)} - ${DASHBOARD_TYPES[dashboardTypeOf(client)]}">${escapeHtml(client.clientName)}</span><div class="client-bar-track"><i style="width:${Math.max(2,Math.min(100,numberValue(client.availabilityRate)))}%"></i></div><strong>${numberValue(client.availabilityRate).toFixed(0)}%</strong></div>`).join("") : `<div class="chart-empty">No client dashboards match these filters.</div>`;
  elements.riskCount.textContent = `${data.topRisks.length} item${data.topRisks.length === 1 ? "" : "s"}`;
  elements.riskTable.innerHTML = data.topRisks.length ? data.topRisks.slice(0,8).map((risk) => `<tr><td>${escapeHtml(risk.store)}</td><td title="${escapeHtml(risk.sku)}">${escapeHtml(risk.sku)}</td><td>${numberValue(risk.stock).toLocaleString()}</td><td><span class="status-pill ${risk.status === "low" ? "low" : ""}">${risk.status === "low" ? "Low stock" : "Out of stock"}</span></td></tr>`).join("") : `<tr><td colspan="4" class="table-empty">${hasData ? "No priority exceptions in this view." : "No source data published."}</td></tr>`;
}

function renderClientOptions() {
  const current = elements.clientFilter.value;
  const clients = [...new Map(state.dashboardClients.map((client) => [client.clientId, client.clientName])).entries()];
  elements.clientFilter.innerHTML = `<option value="all">All clients</option>${clients.map(([clientId, clientName]) => `<option value="${escapeHtml(clientId)}">${escapeHtml(clientName)}</option>`).join("")}`;
  if ([...elements.clientFilter.options].some((option) => option.value === current)) elements.clientFilter.value = current;
  const names = [...new Set([...CLIENTS, ...state.dashboardClients.map((client) => client.clientName)])].sort((a,b) => a.localeCompare(b));
  const adminCurrent = elements.adminClient.value;
  elements.adminClient.innerHTML = `${names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}<option value="__new">+ Add a new client</option>`;
  if ([...elements.adminClient.options].some((option) => option.value === adminCurrent)) elements.adminClient.value = adminCurrent;
  renderDashboard();
}

function renderAdminHistory() {
  elements.adminHistory.innerHTML = state.dashboardUploads.length ? state.dashboardUploads.slice(0,12).map((upload) => `<article class="history-item"><strong title="${escapeHtml(upload.sourceName)}">${escapeHtml(upload.sourceName)}</strong><span class="history-client">${escapeHtml(upload.clientName)} - ${DASHBOARD_TYPES[upload.dashboardType || upload.sourceType] || "Inventory"}</span><span>${numberValue(upload.rowCount).toLocaleString()} rows - ${formatBytes(numberValue(upload.size))} - ${formatDate(upload.createdAt)}</span></article>`).join("") : `<p class="history-empty">No dashboard sources published yet.</p>`;
}

async function publishPendingDataset() {
  const pending = state.pendingDataset;
  const clientName = selectedClientName();
  if (!pending || !clientName || !database || !storage) return;
  elements.publishDataset.disabled = true;
  elements.publishDataset.querySelector("span").textContent = "Publishing dashboard...";
  const uploadId = uniqueId();
  const clientId = slugify(clientName);
  const dashboardType = dashboardTypeFor(pending);
  const dashboardId = dashboardDocumentId(clientId, dashboardType);
  const storagePath = `dashboard-source/${clientId}/${uploadId}/${safeStorageName(pending.file.name)}`;
  const reference = storage.ref(storagePath);
  try {
    const snapshot = buildSnapshot(pending.rows, pending.mapping, clientName, pending.file.name, dashboardType);
    const uploadTask = reference.put(pending.file, { contentType: pending.file.type || "application/octet-stream", customMetadata: { clientId, dashboardType } });
    await new Promise((resolve, reject) => uploadTask.on("state_changed", (progress) => {
      const percent = progress.totalBytes ? Math.round(progress.bytesTransferred / progress.totalBytes * 100) : 0;
      elements.publishDataset.querySelector("small").textContent = `Uploading source - ${percent}%`;
    }, reject, resolve));
    if (Number(uploadTask.snapshot.metadata.size) !== pending.file.size) throw new Error("The uploaded source size could not be verified.");
    const batch = database.batch();
    batch.set(database.collection("dashboardClients").doc(dashboardId), { ...snapshot, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    batch.set(database.collection("dashboardUploads").doc(uploadId), { clientId, clientName, dashboardType, sourceName: pending.file.name, size: pending.file.size, rowCount: pending.rows.length, storagePath, status: "published", createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    await batch.commit();
    state.pendingDataset = null; elements.adminFileInput.value = ""; elements.adminDropTitle.textContent = "Drop another source file here"; renderSourcePreview();
    showToast(`${clientName} dashboard published from ${pending.rows.length.toLocaleString()} rows.`);
  } catch (error) {
    await reference.delete().catch(() => {});
    showToast(`Dashboard publish failed: ${friendlyError(error)}`, true);
  } finally {
    elements.publishDataset.querySelector("span").textContent = "Publish client dashboard";
    elements.publishDataset.querySelector("small").textContent = "Source and calculated snapshot will be saved";
    elements.publishDataset.disabled = !state.pendingDataset || !selectedClientName();
  }
}

const STEP_ACTIONS = {
  navigate: "Open web address", fill: "Enter custom value", fillUsername: "Enter username", fillPassword: "Enter password",
  click: "Click CSS selector", clickText: "Click visible text", clickInSection: "Click text inside section",
  waitFor: "Wait for CSS selector", waitText: "Wait for visible text", waitUrlContains: "Wait for URL to contain",
  waitNetworkIdle: "Wait for network idle", wait: "Wait seconds", select: "Select option",
  setDateRange: "Set report date range", fillOtp: "Enter OTP from portal prompt",
  salesforceOpenReport: "Salesforce open report", salesforceOpenWorkspace: "Salesforce open workspace", salesforceInspectWorkspace: "Salesforce inspect workspace controls", salesforceSetVisitDateFilter: "Salesforce set Visit Date", salesforceExportReport: "Salesforce export report",
  powerBiLogin: "Power BI sign in", powerBiEnterOtp: "Power BI enter SMS OTP", powerBiAcknowledgeSecurity: "Power BI acknowledge security notice", powerBiOpenSosOverview: "Power BI open SOS Overview", powerBiSetCurrentMonth: "Power BI clear filters and select current month", powerBiExportSosOverview: "Power BI export Share Of Shelf visual",
  geoRepDownloadComplianceAuditSummary: "Geo Rep Capture compliance dashboard export", geoRepDownloadFormReportViaApi: "Geo Rep Capture Form Report via Open API", geoRepDownloadTransactionReport: "Geo Rep Capture Transaction Report - Orders", geoRepDownloadRepAttendanceReport: "Geo Rep Capture Rep Attendance report", export: "Export and await download", download: "Click to download"
};

function dismissAppLoader() {
  const loader = document.getElementById("appLoader");
  if (!loader) return;
  window.setTimeout(() => loader.classList.add("is-ready"), 1450);
}

function newStep(action = "click") {
  return { id: uniqueId(), action, selector: "", value: "" };
}

function defaultExtractionSteps() {
  return [newStep("navigate"), newStep("fillUsername"), newStep("fillPassword"), newStep("click"), newStep("download")];
}

function renderExtractionSteps() {
  elements.extractionSteps.innerHTML = state.extractionSteps.length ? state.extractionSteps.map((step, index) => `<div class="extraction-step" draggable="true" data-step-id="${escapeHtml(step.id)}"><span class="step-number">${String(index + 1).padStart(2,"0")}</span><span class="drag-handle" title="Drag to reorder">&#8942;&#8942;</span><select class="step-action" aria-label="Step ${index + 1} action">${Object.entries(STEP_ACTIONS).map(([value,label]) => `<option value="${value}" ${step.action === value ? "selected" : ""}>${label}</option>`).join("")}</select><input class="step-selector" value="${escapeHtml(step.selector)}" placeholder="CSS selector or section name" aria-label="Step ${index + 1} selector or section"/><input class="step-value" value="${escapeHtml(step.value)}" placeholder="URL, text, seconds or option" aria-label="Step ${index + 1} value"/><button class="remove-step" type="button" title="Delete step" aria-label="Delete step ${index + 1}">&times;</button></div>`).join("") : `<p class="history-empty">Add the first step for this extraction.</p>`;
}

function readStepsFromEditor() {
  state.extractionSteps = [...elements.extractionSteps.querySelectorAll(".extraction-step")].map((row) => ({ id: row.dataset.stepId, action: row.querySelector(".step-action").value, selector: row.querySelector(".step-selector").value.trim(), value: row.querySelector(".step-value").value.trim() }));
  return state.extractionSteps;
}

function extractionProfileName(profileId, fallback = "No step set linked") {
  const profile = state.extractionProfiles.find((item) => item.id === profileId);
  return profile?.name || fallback;
}

function syncExtractionProfileOptions() {
  const current = elements.retailerExtractionProfile.value;
  const retailer = state.retailers.find(item => item.id === elements.retailerId.value);
  const profiles = [...state.extractionProfiles];
  if (retailer?.extractionProfileId && !profiles.some(item => item.id === retailer.extractionProfileId)) {
    profiles.push({ id: retailer.extractionProfileId, name: retailer.extractionName || "Saved extraction steps" });
  }
  elements.retailerExtractionProfile.innerHTML = `<option value="">No extraction step set linked</option>${profiles.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("")}`;
  if ([...elements.retailerExtractionProfile.options].some((option) => option.value === current)) elements.retailerExtractionProfile.value = current;
  elements.openLinkedExtractionProfile.disabled = !elements.retailerExtractionProfile.value;
}

function isSalesforceProfileForm(retailer = null) {
  const id = String(retailer?.id || elements.retailerId.value || "");
  const address = String(retailer?.webAddress || elements.retailerWebAddress.value || "");
  const name = String(retailer?.name || elements.retailerName.value || "");
  return /^salesforce-/i.test(id) || /salesforce\.com|force\.com/i.test(address) || /salesforce/i.test(name);
}

function syncSalesforceConnectedAppFields(retailer = null) {
  const visible = isSalesforceProfileForm(retailer);
  elements.salesforceConnectedAppFields.hidden = !visible;
  // A disabled fieldset is skipped by form validation, so hidden Salesforce-only fields cannot block other profiles from saving.
  elements.salesforceConnectedAppFields.disabled = !visible;
  if (!visible) return;

  const config = retailer?.salesforceConnectedApp || null;
  const health = config?.health || null;
  const configured = config?.configured === true;
  elements.retailerSalesforceClientId.value = "";
  elements.retailerSalesforceClientId.placeholder = configured && config.clientIdSuffix
    ? `Saved Consumer Key ending ${config.clientIdSuffix}`
    : "Connected App Consumer Key";
  elements.retailerSalesforceApiUsername.value = config?.username || retailer?.username || elements.retailerUsername.value || "";
  elements.retailerSalesforceLoginUrl.value = config?.loginUrl || "https://login.salesforce.com";
  elements.retailerSalesforcePrivateKey.value = "";
  elements.testRetailerSalesforceConnectedApp.disabled = !elements.retailerId.value || !configured;
  elements.salesforceConnectedAppBadge.className = `entity-state ${health?.status === "verified" ? "selected" : "excluded"}`;
  elements.salesforceConnectedAppBadge.textContent = health?.status === "verified" ? "Verified" : configured ? "Test required" : "Not configured";
  if (health?.status === "verified") {
    elements.salesforceConnectedAppStatus.textContent = `${health.reportName || "Attendance report"} verified on ${health.instanceHost || "Salesforce"}${health.verifiedAt ? `, ${formatDate(health.verifiedAt)}` : ""}. Scheduled Attendance runs will not request MFA.`;
  } else if (health?.status === "failed") {
    elements.salesforceConnectedAppStatus.textContent = `Connection check failed: ${health.message || "review the Salesforce Connected App assignment"}`;
  } else if (configured) {
    elements.salesforceConnectedAppStatus.textContent = `Certificate settings are stored for ${config.username || "this Salesforce identity"}. Run the connection test before relying on unattended schedules.`;
  } else {
    elements.salesforceConnectedAppStatus.textContent = "No certificate settings are stored for this profile.";
  }
}

function renderRetailerSetupStatus(retailer = null) {
  const notice = document.getElementById("retailerSetupStatus");
  if (!notice) return;
  const procedure = retailer?.salesProcedure;
  const details = document.getElementById("retailerSalesProcedure");
  if (details) {
    details.hidden = !procedure;
    const list = details.querySelector("ol");
    list.replaceChildren();
    for (const rule of procedure?.rules || []) {
      const item = document.createElement("li");
      item.textContent = rule;
      list.append(item);
    }
  }
  const pending = retailer?.restoration?.status === "awaiting-connection-verification";
  if (retailer?.salesProcedure?.automationReady === true) {
    notice.hidden = false;
    notice.textContent = `${retailer.name}: monthly workflow connected. Manual runs; OTP in Nexus. Output: Nexus Files.`;
    return;
  }
  notice.hidden = !pending;
  if (pending && retailer.restoration.family === "dataorbis-monthly-sales") {
    const credentials = retailer.username && retailer.credentialsUpdatedAt ? "Credentials saved; login not yet verified." : "Login credentials are not configured.";
    notice.textContent = `${retailer.name}: ${credentials} Monthly sales extraction and template mapping are not yet validated. Scheduling and publication are off.`;
    return;
  }
  notice.textContent = !pending ? "" : retailer.username && retailer.credentialsUpdatedAt
    ? "Pick n Pay: credentials saved. Client selection, email verification and full-month export still require testing before activation."
    : "Pick n Pay setup required: login credentials are missing. Client selection, email verification and full-month export remain unverified. Scheduling is off.";
}

function resetRetailerForm() {
  elements.retailerForm.reset(); elements.retailerId.value = ""; elements.retailerFormTitle.textContent = "Create extraction profile"; elements.deleteRetailer.hidden = true;
  syncExtractionProfileOptions();
  syncSalesforceConnectedAppFields();
  renderRetailerSetupStatus();
}

function editRetailer(id) {
  const retailer = state.retailers.find((item) => item.id === id); if (!retailer) return;
  elements.retailerId.value = retailer.id; elements.retailerName.value = retailer.name; elements.retailerWebAddress.value = retailer.webAddress; elements.retailerUsername.value = retailer.username; elements.retailerPassword.value = ""; elements.retailerFormTitle.textContent = retailer.name; elements.deleteRetailer.hidden = false;
  syncExtractionProfileOptions();
  elements.retailerExtractionProfile.value = retailer.extractionProfileId || "";
  elements.openLinkedExtractionProfile.disabled = !elements.retailerExtractionProfile.value;
  syncSalesforceConnectedAppFields(retailer);
  renderRetailerSetupStatus(retailer);
  elements.retailerList.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.id === id));
}

function openAutomationWorkspace() {
  if (window.location.hash !== "#automation") window.location.hash = "automation";
  else setViewFromHash();
  if (!state.isOperator) openNexusLogin();
}

function hasExtractionSteps(retailer) {
  return !!(retailer?.salesProcedure?.automationReady === true || retailer?.extractionProfileId || (Array.isArray(retailer?.steps) && retailer.steps.length));
}

function isDataOrbisSalesProfile(profile) {
  return ["dataorbis-game-sales", "dataorbis-makro-sales"].includes(profile?.id);
}

function openSalesDashboard() {
  if (!state.isAdmin) {
    if (state.isOperator) {
      showToast("Admin access is required for the Sales dashboard.", true);
      openAutomationWorkspace();
    } else {
      if (window.location.hash !== "#sales") window.location.hash = "sales";
      openNexusLogin();
    }
    return;
  }
  if (window.location.hash !== "#sales") window.location.hash = "sales";
  else setViewFromHash();
}

function openSalesInsights() {
  if (!state.isOperator) {
    openNexusLogin();
    return;
  }
  if (!operatorCanAccessNavigation("insights")) {
    showToast("Your Nexus account is not permitted to open Insights.", true);
    return;
  }
  if (window.location.hash !== "#insights") window.location.hash = "insights";
  else setViewFromHash();
}

function openTrainingHub() {
  if (!state.isAdmin) {
    if (state.isOperator) showToast("Admin access is required for Training Hub.", true);
    else openNexusLogin();
    return;
  }
  if (window.location.hash !== "#training") window.location.hash = "training";
  else setViewFromHash();
}

function openAttendanceDashboard() {
  if (!state.isOperator) {
    if (window.location.hash !== "#attendance") window.location.hash = "attendance";
    openNexusLogin();
    return;
  }
  if (!operatorCanAccessNavigation("attendance")) {
    showToast("Time & Attendance is not assigned to your Nexus account.", true);
    return;
  }
  if (window.location.hash !== "#attendance") window.location.hash = "attendance";
  else setViewFromHash();
}

function openCallCycleDashboard() {
  if (!state.isOperator) {
    if (window.location.hash !== "#callcycle") window.location.hash = "callcycle";
    openNexusLogin();
    return;
  }
  if (!operatorCanAccessNavigation("attendance")) {
    showToast("Call Cycle is not assigned to your Nexus account.", true);
    return;
  }
  if (window.location.hash !== "#callcycle") window.location.hash = "callcycle";
  else setViewFromHash();
}

function openStockFixDashboard() {
  if (!state.isAdmin) {
    if (state.isOperator) showToast("Admin access is required for Stock Fix.", true);
    else openNexusLogin();
    return;
  }
  if (window.location.hash !== "#stockfix") window.location.hash = "stockfix";
  else setViewFromHash();
}

function openStockFixAdoption() {
  if (!state.isAdmin) {
    if (state.isOperator) showToast("Admin access is required for Stock Fix Adoption.", true);
    else openNexusLogin();
    return;
  }
  if (window.location.hash !== "#adoption") window.location.hash = "adoption";
  else setViewFromHash();
}

function jumpToOperationsPanel(targetId, trigger) {
  const target = document.getElementById(targetId);
  if (!target || target.hidden) {
    showToast("That operation is not available for your current access or selected profile.", true);
    return;
  }
  document.querySelectorAll("[data-operations-jump]").forEach((button) => button.classList.toggle("active", button === trigger));
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

const scheduleDayOrder = [1, 2, 3, 4, 5, 6, 0];
const scheduleDayLabels = { 0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat" };
const weekdayScheduleDays = [1, 2, 3, 4, 5];

function scheduleDaysForDisplay(schedule = {}) {
  const configured = Array.isArray(schedule.daysOfWeek) ? [...new Set(schedule.daysOfWeek.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))] : [];
  if (configured.length) return scheduleDayOrder.filter((day) => configured.includes(day));
  return schedule.businessDaysOnly === true ? [1, 2, 3, 4, 5] : scheduleDayOrder;
}

function selectedScheduleDays(inputs) {
  return [...inputs].filter((input) => input.checked).map((input) => Number(input.value));
}

function sameScheduleDays(left, right) {
  return left.length === right.length && left.every((day) => right.includes(day));
}

function scheduleDaysDescription(days) {
  const ordered = scheduleDayOrder.filter((day) => days.includes(day));
  if (sameScheduleDays(ordered, scheduleDayOrder)) return "every day";
  if (sameScheduleDays(ordered, weekdayScheduleDays)) return "Monday to Friday";
  return ordered.map((day) => scheduleDayLabels[day]).join(", ");
}

function scheduleTimeDescription(value) {
  if (!/^\d{2}:\d{2}$/.test(value || "")) return "a time you choose";
  const [hours, minutes] = value.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour = hours % 12 || 12;
  return `${hour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function scheduleDateDescription(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return "";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

function runScheduleRefs() {
  return {
    startDate: elements.runStartDate,
    endDate: elements.runEndDate,
    dateMode: elements.runScheduleDateMode,
    time: elements.runScheduleTime,
    days: elements.runScheduleDays,
    enabled: elements.runScheduleEnabled,
    save: elements.saveRunSchedule,
    summary: elements.runScheduleSummary,
    scopeNote: elements.runScheduleScopeNote
  };
}

function filesScheduleRefs() {
  return {
    startDate: elements.filesRunStartDate,
    endDate: elements.filesRunEndDate,
    dateMode: elements.filesRunScheduleDateMode,
    time: elements.filesRunScheduleTime,
    days: elements.filesRunScheduleDays,
    enabled: elements.filesRunScheduleEnabled,
    save: elements.filesSaveRunSchedule,
    summary: elements.filesScheduleSummary,
    scopeNote: elements.filesScheduleScopeNote
  };
}

function operationsScheduleRefs() {
  return {
    startDate: elements.operationsScheduleStartDate,
    endDate: elements.operationsScheduleEndDate,
    dateMode: elements.operationsScheduleDateMode,
    time: elements.operationsScheduleTime,
    days: elements.operationsScheduleDays,
    enabled: elements.operationsScheduleEnabled,
    save: elements.operationsSaveSchedule
  };
}

function isDailySalesforceAttendanceProfile(profile) {
  return profile?.id === "sales-force-p-g" || (profile?.reportVariant === "daily" && /attendance/i.test(profile?.extractionName || ""));
}

function monthlyAttendanceSelectionOptions({ selection, startDate, endDate, dayOfMonth, required = true }) {
  const reconcileAllWeeks = selection === "all";
  const actualWeek = Number(selection);
  if (reconcileAllWeeks) {
    return {
      monthlyActualWeek: "all",
      monthlyReconcileAllWeeks: true,
      dayOfMonth
    };
  }
  if (!Number.isInteger(actualWeek) || actualWeek < 1 || actualWeek > 5 || !startDate || !endDate) {
    if (!required) return { dayOfMonth };
    throw new Error("Choose an Actual Week or All Actual Weeks, plus its start and end dates, before running or scheduling Monthly Attendance.");
  }
  if (endDate < startDate) throw new Error("Actual Week end date cannot be before its start date.");
  if (startDate.slice(0, 7) !== endDate.slice(0, 7)) throw new Error("Monthly Attendance can reconcile one calendar month at a time.");
  return {
    monthlyActualWeek: reconcileAllWeeks ? "all" : actualWeek,
    monthlyReconcileAllWeeks: reconcileAllWeeks,
    dayOfMonth
  };
}

function monthlyRunDayDescription(value) {
  if (value === "daily") return "every day";
  if (value === "weekdays") return "every weekday";
  if (value === "last") return "the last day of each month";
  return `the ${value || "selected"}${value === "1" ? "st" : value === "2" ? "nd" : value === "3" ? "rd" : "th"} of each month`;
}

function toggleDateInputLabel(input, hidden) {
  const label = input?.closest?.("label");
  if (label) label.hidden = hidden;
  else if (input) input.hidden = hidden;
}

function operationsMonthlyAttendanceRunOptions(profile, { required = true } = {}) {
  if (!isMonthlyAttendanceRetailer(profile)) return {};
  return monthlyAttendanceSelectionOptions({
    selection: elements.operationsRunMonthlyActualWeek.value,
    startDate: elements.operationsStartDate.value,
    endDate: elements.operationsEndDate.value,
    dayOfMonth: "",
    required
  });
}

function operationsMonthlyAttendanceScheduleOptions(profile, { required = true } = {}) {
  if (!isMonthlyAttendanceRetailer(profile)) return {};
  return monthlyAttendanceSelectionOptions({
    selection: elements.operationsMonthlyActualWeek.value,
    startDate: elements.operationsScheduleStartDate.value,
    endDate: elements.operationsScheduleEndDate.value,
    dayOfMonth: elements.operationsMonthlyScheduleDay.value,
    required
  });
}

function renderOperationsScheduleSummary(profile) {
  if (!profile) {
    elements.operationsScheduleSummary.textContent = "Select an approved report to set its schedule.";
    return;
  }
  const enabled = elements.operationsScheduleEnabled.checked;
  const time = elements.operationsScheduleTime.value;
  const monthly = isMonthlyAttendanceRetailer(profile);
  if (monthly) {
    const selection = elements.operationsMonthlyActualWeek.value;
    const startDate = elements.operationsScheduleStartDate.value;
    const endDate = elements.operationsScheduleEndDate.value;
    const scope = selection === "all" ? "reconcile all Actual Weeks" : selection ? `update Actual Week ${selection}` : "choose an Actual Week";
    const runDay = monthlyRunDayDescription(elements.operationsMonthlyScheduleDay.value);
    if (!enabled) elements.operationsScheduleSummary.textContent = `Automatic monthly runs are off. When enabled, Nexus will ${scope} on ${runDay}.`;
    else if (!time || !selection || (selection !== "all" && (!startDate || !endDate))) elements.operationsScheduleSummary.textContent = selection === "all" ? "Complete the run time before saving this monthly schedule." : "Complete the Actual Week, dates and run time before saving this monthly schedule.";
    else if (selection === "all") elements.operationsScheduleSummary.textContent = `Automatic monthly run: ${scope} on ${runDay} at ${scheduleTimeDescription(time)} using the 1st of the current month through the run date.`;
    else elements.operationsScheduleSummary.textContent = `Automatic monthly run: ${scope} on ${runDay} at ${scheduleTimeDescription(time)} for ${scheduleDateDescription(startDate)} to ${scheduleDateDescription(endDate)}.`;
    return;
  }
  const days = selectedScheduleDays(elements.operationsScheduleDays);
  const dateMode = elements.operationsScheduleDateMode.value === "fixed" ? "fixed" : "daily";
  if (!enabled) elements.operationsScheduleSummary.textContent = "Automatic runs are off. You can still run this report manually.";
  else if (!time || !days.length) elements.operationsScheduleSummary.textContent = "Choose a run time and at least one day before saving an automated schedule.";
  else if (dateMode === "fixed" && (!elements.operationsScheduleStartDate.value || !elements.operationsScheduleEndDate.value)) elements.operationsScheduleSummary.textContent = "Choose both report dates before saving a fixed-range schedule.";
  else {
    const range = dateMode === "fixed"
      ? ` Uses ${scheduleDateDescription(elements.operationsScheduleStartDate.value)} to ${scheduleDateDescription(elements.operationsScheduleEndDate.value)} each time.`
      : " Uses the report date for each run.";
    const smartSell = isDailySalesforceAttendanceProfile(profile) && elements.operationsDailySmartSellWeek.value
      ? ` Daily Attendance will use SmartSell Week ${elements.operationsDailySmartSellWeek.value}.`
      : "";
    elements.operationsScheduleSummary.textContent = `Automatic run: ${scheduleDaysDescription(days)} at ${scheduleTimeDescription(time)}.${range}${smartSell}`;
  }
}

function renderOperationsSchedule(profile, account = {}) {
  if (isDataOrbisSalesProfile(profile)) { elements.operationsSchedulePanel.hidden = true; return; }
  const canManageSchedules = account.permissions?.manageSchedules === true;
  elements.operationsSchedulePanel.hidden = !canManageSchedules || !profile || profile.setupRequired === true;
  if (!canManageSchedules || !profile || profile.setupRequired === true) return;

  const schedule = profile.reportSchedule || {};
  const monthly = isMonthlyAttendanceRetailer(profile);
  const dateMode = schedule.dateMode === "fixed" ? "fixed" : "daily";
  const profileChanged = state.operationsScheduleProfileId !== profile.id;
  const refreshScheduleFields = profileChanged || !state.operationsScheduleDirty;
  state.operationsScheduleProfileId = profile.id;
  if (refreshScheduleFields) {
    elements.operationsScheduleEnabled.checked = schedule.enabled === true;
    elements.operationsScheduleTime.value = schedule.time || "";
    elements.operationsScheduleDateMode.value = monthly ? "fixed" : dateMode;
    elements.operationsScheduleStartDate.value = monthly ? (schedule.monthlyWeekStartDate || schedule.startDate || "") : (dateMode === "fixed" ? (schedule.startDate || "") : "");
    elements.operationsScheduleEndDate.value = monthly ? (schedule.monthlyWeekEndDate || schedule.endDate || schedule.startDate || "") : (dateMode === "fixed" ? (schedule.endDate || schedule.startDate || "") : "");
    const days = new Set(scheduleDaysForDisplay(schedule));
    elements.operationsScheduleDays.forEach((input) => { input.checked = days.has(Number(input.value)); });
    elements.operationsMonthlyActualWeek.value = schedule.monthlyReconcileAllWeeks === false && schedule.monthlyActualWeek ? String(schedule.monthlyActualWeek) : "all";
    elements.operationsMonthlyScheduleDay.value = schedule.monthlyRunCadence === "daily" || schedule.dayOfMonth === "daily" ? "daily" : schedule.monthlyRunCadence === "weekdays" || schedule.dayOfMonth === "weekdays" ? "weekdays" : String(schedule.dayOfMonth || "daily");
  }
  elements.operationsScheduleDateModeField.hidden = monthly;
  elements.operationsScheduleDaysField.hidden = monthly;
  elements.operationsMonthlyAttendanceFields.hidden = !monthly;
  elements.operationsScheduleDays.forEach((input) => { input.disabled = monthly; });
  const reconcileAllWeeks = monthly && elements.operationsMonthlyActualWeek.value === "all";
  toggleDateInputLabel(elements.operationsScheduleStartDate, reconcileAllWeeks);
  toggleDateInputLabel(elements.operationsScheduleEndDate, reconcileAllWeeks);
  if (reconcileAllWeeks) {
    elements.operationsScheduleStartDate.value = "";
    elements.operationsScheduleEndDate.value = "";
  }
  elements.operationsScheduleStartDateLabel.textContent = monthly ? "Actual Week start date" : "Scheduled start date";
  elements.operationsScheduleEndDateLabel.textContent = monthly ? "Actual Week end date" : "Scheduled end date";
  const dailyAttendance = isDailySalesforceAttendanceProfile(profile);
  elements.operationsDailySmartSellWeekField.hidden = !dailyAttendance;
  elements.operationsDailySmartSellWeekNote.hidden = !dailyAttendance;
  if (dailyAttendance && document.activeElement !== elements.operationsDailySmartSellWeek) elements.operationsDailySmartSellWeek.value = schedule.dailySmartSellWeekOverride ? String(schedule.dailySmartSellWeekOverride) : "";
  elements.operationsScheduleState.textContent = schedule.enabled ? `Scheduled ${scheduleTimeDescription(schedule.time || "")}` : "Manual only";
  elements.operationsSaveSchedule.disabled = false;
  renderOperationsScheduleSummary(profile);
}

function renderOperationsManualRunControls(profile) {
  const monthly = isMonthlyAttendanceRetailer(profile);
  const deliveryLabel = elements.operationsRunExtraction.querySelector("small");
  if (deliveryLabel) deliveryLabel.textContent = isDataOrbisSalesProfile(profile) ? "Verified monthly workbook in Nexus Files" : "Downloads are verified and delivered to SharePoint";
  const profileChanged = state.operationsManualProfileId !== (profile?.id || "");
  state.operationsManualProfileId = profile?.id || "";
  elements.operationsMonthlyRunFields.hidden = !monthly;
  if (profileChanged) {
    elements.operationsStartDate.value = "";
    elements.operationsEndDate.value = "";
    elements.operationsRunMonthlyActualWeek.value = monthly ? "all" : "";
  }
  const reconcileAllWeeks = elements.operationsRunMonthlyActualWeek.value === "all";
  toggleDateInputLabel(elements.operationsStartDate, monthly && reconcileAllWeeks);
  toggleDateInputLabel(elements.operationsEndDate, monthly && reconcileAllWeeks);
  if (monthly && reconcileAllWeeks) {
    elements.operationsStartDate.value = "";
    elements.operationsEndDate.value = "";
  }
  elements.operationsStartDateLabel.textContent = monthly ? "Actual Week start date" : "Report start date";
  elements.operationsEndDateLabel.textContent = monthly ? "Actual Week end date" : "Report end date";
  elements.operationsRunRangeNote.textContent = monthly
    ? (reconcileAllWeeks ? "Nexus will update every Actual Week from the 1st of this month through today. No date range is needed." : "Choose dates only for this specific Actual Week run. These values do not change the saved automated schedule.")
    : "Leave dates blank when the approved workflow uses its default reporting period.";
  if (isDataOrbisSalesProfile(profile)) {
    if (profileChanged) {
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit" }).formatToParts(new Date());
      const year = Number(parts.find(p => p.type === "year").value), month = Number(parts.find(p => p.type === "month").value);
      elements.operationsStartDate.value = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 10);
      elements.operationsEndDate.value = new Date(Date.UTC(year, month - 1, 0)).toISOString().slice(0, 10);
    }
    elements.operationsStartDateLabel.textContent = "Month start";
    elements.operationsEndDateLabel.textContent = "Month end";
    elements.operationsRunRangeNote.textContent = "Monthly sales | OTP required | Nexus Files";
  }
}

function renderScheduleSummary(retailer, refs, { monthly = false } = {}) {
  if (!refs.summary || !refs.scopeNote) return;
  if (!retailer) {
    refs.summary.textContent = "Select an extraction profile to review its schedule.";
    refs.scopeNote.textContent = "The automated run will use the date it runs.";
    return;
  }
  const enabled = refs.enabled.checked;
  const time = refs.time.value;
  const startDate = refs.startDate.value;
  const endDate = refs.endDate.value;
  const dateMode = refs.dateMode.value === "fixed" ? "fixed" : "daily";
  const days = selectedScheduleDays(refs.days);

  if (monthly) {
    const selection = elements.runMonthlyActualWeek.value;
    const scope = selection === "all" ? "reconcile all Actual Weeks" : selection ? `update Actual Week ${selection}` : "choose an Actual Week";
    const runDay = monthlyRunDayDescription(elements.runMonthlyScheduleDay.value);
    refs.scopeNote.textContent = selection === "all"
      ? "All Actual Weeks uses the 1st of the current month through the run date."
      : `Monthly Attendance uses the selected Actual Week date range and runs ${runDay}.`;
    if (!enabled) {
      refs.summary.textContent = `Automatic monthly runs are off. When enabled, Nexus will ${scope} on ${runDay}.`;
    } else if (!time || !selection || (selection !== "all" && (!startDate || !endDate))) {
      refs.summary.textContent = selection === "all" ? "Complete the run time before saving this monthly schedule." : "Complete the Actual Week, dates, and run time before saving this monthly schedule.";
    } else if (selection === "all") {
      refs.summary.textContent = `Automatic monthly run: ${scope} on ${runDay} at ${scheduleTimeDescription(time)} using the 1st of the current month through the run date.`;
    } else {
      refs.summary.textContent = `Automatic monthly run: ${scope} on ${runDay} at ${scheduleTimeDescription(time)} for ${scheduleDateDescription(startDate)} to ${scheduleDateDescription(endDate)}.`;
    }
    return;
  }

  refs.scopeNote.textContent = dateMode === "fixed"
    ? "Automated runs will reuse the dates above until you change them."
    : "Automated runs use the date they run. The manual date fields do not change the scheduled range.";
  if (!enabled) {
    refs.summary.textContent = "Automatic runs are off. You can still extract this report manually.";
  } else if (!time || !days.length) {
    refs.summary.textContent = "Choose a run time and at least one day before saving an automated schedule.";
  } else if (dateMode === "fixed" && (!startDate || !endDate)) {
    refs.summary.textContent = "Choose both report dates before saving a fixed-range schedule.";
  } else {
    const range = dateMode === "fixed"
      ? ` Uses ${scheduleDateDescription(startDate)} to ${scheduleDateDescription(endDate)} each time.`
      : " Uses the report date for each run.";
    refs.summary.textContent = `Automatic run: ${scheduleDaysDescription(days)} at ${scheduleTimeDescription(time)}.${range}`;
  }
}

function validateScheduleControls(retailer, refs, { monthly = false } = {}) {
  const enabled = refs.enabled.checked;
  const days = monthly ? scheduleDayOrder : selectedScheduleDays(refs.days);
  if (enabled && !refs.time.value) throw new Error("Choose a run time before enabling an automated schedule.");
  if (enabled && !monthly && !days.length) throw new Error("Choose at least one day before enabling an automated schedule.");
  if (enabled && !monthly && refs.dateMode.value === "fixed" && (!refs.startDate.value || !refs.endDate.value)) {
    throw new Error("Choose both report dates for a fixed-range automated schedule.");
  }
  return { daysOfWeek: days, enabled };
}

function isMonthlyAttendanceRetailer(retailer) {
  return retailer?.id === "sales-force-p-g-monthly" || retailer?.reportVariant === "monthly";
}

function syncMonthlyAttendanceRunControls(retailer) {
  const monthly = isMonthlyAttendanceRetailer(retailer);
  elements.runMonthlyAttendanceFields.hidden = !monthly;
  elements.runStartDateLabel.textContent = monthly ? "Actual Week start date" : "Report start date";
  elements.runEndDateLabel.textContent = monthly ? "Actual Week end date" : "Report end date";
  elements.runScheduleDateMode.disabled = monthly;
  elements.runScheduleDateModeField.hidden = monthly;
  elements.runScheduleDaysField.hidden = monthly;
  document.querySelector("#runSchedulePresets").hidden = monthly;
  elements.runScheduleDays.forEach((input) => {
    input.disabled = monthly;
    if (monthly) input.checked = true;
  });
  if (!monthly) {
    toggleDateInputLabel(elements.runStartDate, false);
    toggleDateInputLabel(elements.runEndDate, false);
    elements.runRangeNote.textContent = "Leave both dates blank to use the portal's default report period when you run a report manually.";
    renderScheduleSummary(retailer, runScheduleRefs());
    return;
  }

  const schedule = retailer?.reportSchedule || {};
  elements.runScheduleDateMode.value = "fixed";
  if (document.activeElement !== elements.runMonthlyActualWeek) {
    elements.runMonthlyActualWeek.value = schedule.monthlyReconcileAllWeeks === false && schedule.monthlyActualWeek ? String(schedule.monthlyActualWeek) : "all";
  }
  if (document.activeElement !== elements.runMonthlyScheduleDay) {
    elements.runMonthlyScheduleDay.value = schedule.monthlyRunCadence === "daily" || schedule.dayOfMonth === "daily" ? "daily" : schedule.monthlyRunCadence === "weekdays" || schedule.dayOfMonth === "weekdays" ? "weekdays" : String(schedule.dayOfMonth || "daily");
  }
  const reconcileAllWeeks = elements.runMonthlyActualWeek.value === "all";
  toggleDateInputLabel(elements.runStartDate, reconcileAllWeeks);
  toggleDateInputLabel(elements.runEndDate, reconcileAllWeeks);
  if (reconcileAllWeeks) {
    elements.runStartDate.value = "";
    elements.runEndDate.value = "";
  }
  elements.runStartDateLabel.textContent = "Actual Week start date";
  elements.runEndDateLabel.textContent = "Actual Week end date";
  elements.runRangeNote.textContent = reconcileAllWeeks
    ? "Nexus will update every Actual Week from the 1st of this month through today. No date range is needed."
    : "Both dates are required. Keep them within one calendar month so the selected Actual Week can be reconciled safely.";
  renderScheduleSummary(retailer, runScheduleRefs(), { monthly: true });
}

function monthlyAttendanceRunOptions(retailer, { required = true } = {}) {
  if (!isMonthlyAttendanceRetailer(retailer)) return {};
  const selection = elements.runMonthlyActualWeek.value;
  const reconcileAllWeeks = selection === "all";
  const actualWeek = Number(selection);
  if (reconcileAllWeeks) {
    return { monthlyActualWeek: "all", monthlyReconcileAllWeeks: true, dayOfMonth: elements.runMonthlyScheduleDay.value };
  }
  const startDate = elements.runStartDate.value;
  const endDate = elements.runEndDate.value;
  if (!Number.isInteger(actualWeek) || actualWeek < 1 || actualWeek > 5 || !startDate || !endDate) {
    if (!required) return { dayOfMonth: elements.runMonthlyScheduleDay.value };
    throw new Error("Choose an Actual Week or All Actual Weeks, plus its start and end dates, before running or scheduling Monthly Attendance.");
  }
  if (endDate < startDate) throw new Error("Actual Week end date cannot be before its start date.");
  if (startDate.slice(0, 7) !== endDate.slice(0, 7)) throw new Error("Monthly Attendance can reconcile one calendar month at a time.");
  return { monthlyActualWeek: reconcileAllWeeks ? "all" : actualWeek, monthlyReconcileAllWeeks: reconcileAllWeeks, dayOfMonth: elements.runMonthlyScheduleDay.value };
}

function renderScheduleControls(retailer, refs) {
  const schedule = retailer?.reportSchedule || {};
  const dateMode = schedule.dateMode === "fixed" ? "fixed" : "daily";
  refs.dateMode.value = dateMode;
  refs.startDate.value = dateMode === "fixed" ? (schedule.startDate || "") : "";
  refs.endDate.value = dateMode === "fixed" ? (schedule.endDate || schedule.startDate || "") : "";
  refs.time.value = schedule.time || refs.time.value || "";
  const days = new Set(scheduleDaysForDisplay(schedule));
  refs.days.forEach((input) => { input.checked = days.has(Number(input.value)); });
  refs.enabled.checked = schedule.enabled === true;
  refs.save.disabled = !retailer || state.isAdmin !== true;
  renderScheduleSummary(retailer, refs);
}

function renderRunSchedule(retailer) {
  // Schedules are an Admin-only configuration surface. Normal Operations
  // users can run approved jobs but must not be able to alter future runs.
  const canManageSchedules = state.isAdmin === true;
  elements.runScheduleComposer.hidden = !canManageSchedules;
  if (!canManageSchedules) return;
  renderScheduleControls(retailer, runScheduleRefs());
  syncMonthlyAttendanceRunControls(retailer);
}

function renderFilesRunSchedule(retailer) {
  renderScheduleControls(retailer, filesScheduleRefs());
}

function renderRetailerRunDetails(retailer, refs) {
  if (!retailer) {
    refs.details.innerHTML = `<p>${escapeHtml(refs.emptyCopy)}</p>`;
    refs.run.disabled = true;
    refs.renderSchedule(null);
    return;
  }
  let portal = retailer.webAddress || "Portal address unavailable";
  try { portal = new URL(retailer.webAddress).hostname; } catch (error) { /* Keep the stored address. */ }
  if (retailer.salesProcedure?.version === "dataorbis-client-sales-20260923" && !hasExtractionSteps(retailer)) {
    refs.details.innerHTML = `<div><span>Portal</span><strong>${escapeHtml(portal)}</strong></div><div><span>Workflow</span><strong>Setup required</strong></div><div><span>Publication</span><strong>Off - no template update</strong></div><p>Portal extraction and OTP steps are not connected.</p>`;
    refs.run.disabled = true;
    refs.renderSchedule(null);
    return;
  }
  const linkedSteps = extractionProfileName(retailer.extractionProfileId, retailer.extractionName || "No reusable step set linked");
  refs.details.innerHTML = `<div><span>Portal</span><strong>${escapeHtml(portal)}</strong></div><div><span>Extraction steps</span><strong>${escapeHtml(linkedSteps)}</strong></div><div><span>Destination</span><strong>SharePoint delivery</strong></div>`;
  refs.run.disabled = state.extractionRunning || !hasExtractionSteps(retailer);
  refs.renderSchedule(retailer);
}

function renderRunRetailerDetails() {
  const retailer = state.retailers.find((item) => item.id === elements.runRetailer.value);
  if (!retailer) {
    elements.runRetailerDetails.innerHTML = `<p>Select an extraction profile to review its connection and linked extraction steps.</p>`;
    elements.runExtraction.disabled = true;
    renderRunSchedule(null);
    return;
  }
  let portal = retailer.webAddress || "Portal address unavailable";
  try { portal = new URL(retailer.webAddress).hostname; } catch (error) { /* Keep the stored address. */ }
  const linkedSteps = extractionProfileName(retailer.extractionProfileId, retailer.extractionName || "No reusable step set linked");
  elements.runRetailerDetails.innerHTML = `<div><span>Portal</span><strong>${escapeHtml(portal)}</strong></div><div><span>Extraction steps</span><strong>${escapeHtml(linkedSteps)}</strong></div><div><span>Destination</span><strong>SharePoint delivery</strong></div>`;
  elements.runExtraction.disabled = state.extractionRunning || (!retailer.extractionProfileId && !(Array.isArray(retailer.steps) && retailer.steps.length));
  renderRunSchedule(retailer);
}

function renderRetailers() {
  renderRetailerList();
  const current = elements.runRetailer.value;
  elements.runRetailer.innerHTML = state.retailers.length ? state.retailers.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("") : `<option value="">No extraction profile available</option>`;
  if (state.retailers.some((item) => item.id === current)) elements.runRetailer.value = current;
  elements.runExtraction.disabled = !state.retailers.length;
  renderRunRetailerDetails();
}

function renderRunRetailerDetails() {
  const retailer = state.retailers.find((item) => item.id === elements.runRetailer.value);
  renderRetailerRunDetails(retailer, { details: elements.runRetailerDetails, run: elements.runExtraction, renderSchedule: renderRunSchedule, emptyCopy: "Select an extraction profile to review its connection and linked extraction steps." });
}

function renderFilesRunRetailerDetails() {
  elements.filesReportRunner.hidden = state.isAdmin !== true;
  if (!state.isAdmin) return;
  const retailer = state.retailers.find((item) => item.id === elements.filesRunRetailer.value);
  renderRetailerRunDetails(retailer, { details: elements.filesRunRetailerDetails, run: elements.filesRunExtraction, renderSchedule: renderFilesRunSchedule, emptyCopy: "Select an extraction profile to extract a report." });
}

function renderRetailers() {
  renderRetailerList();
  const options = state.retailers.length ? state.retailers.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("") : `<option value="">No extraction profile available</option>`;
  const current = elements.runRetailer.value;
  elements.runRetailer.innerHTML = options;
  if (state.retailers.some((item) => item.id === current)) elements.runRetailer.value = current;
  const filesCurrent = elements.filesRunRetailer.value;
  elements.filesRunRetailer.innerHTML = options;
  if (state.retailers.some((item) => item.id === filesCurrent)) elements.filesRunRetailer.value = filesCurrent;
  renderRunRetailerDetails();
  renderFilesRunRetailerDetails();
  renderOperations();
}

function resetExtractionProfileForm() {
  elements.extractionProfileForm.reset(); elements.extractionProfileId.value = ""; elements.extractionProfileFormTitle.textContent = "Create extraction step set"; elements.deleteExtractionProfile.hidden = true;
  state.extractionSteps = defaultExtractionSteps();
  renderExtractionSteps();
}

function editExtractionProfile(id) {
  const profile = state.extractionProfiles.find((item) => item.id === id); if (!profile) return;
  const profileName = profile.name || profile.id || "Unnamed step set";
  elements.extractionProfileId.value = profile.id; elements.extractionProfileName.value = profileName; elements.extractionProfileFormTitle.textContent = profileName; elements.deleteExtractionProfile.hidden = false;
  state.extractionSteps = (profile.steps || []).map((step) => ({ ...step }));
  renderExtractionSteps();
  elements.extractionProfileList.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.id === id));
}

function renderExtractionProfiles() {
  elements.extractionProfileList.innerHTML = state.extractionProfiles.length ? state.extractionProfiles.map((item) => `<button type="button" data-id="${escapeHtml(item.id)}"><strong>${escapeHtml(item.name || item.id || "Unnamed step set")}</strong><small>${(item.steps || []).length} steps</small></button>`).join("") : `<p class="history-empty">No extraction step sets configured.</p>`;
  elements.stepSetCount.textContent = `${state.extractionProfiles.length} set${state.extractionProfiles.length === 1 ? "" : "s"}`;
  syncExtractionProfileOptions();
  renderRunRetailerDetails();
  renderStockFixOperationalRoster();
  renderOperations();
}

function resetGeoRepStoreMasterForm() {
  elements.geoRepStoreMasterForm.reset();
  elements.geoRepStoreMasterId.value = "";
  elements.geoRepStoreMasterForm.dataset.storagePath = "";
  elements.geoRepStoreMasterForm.dataset.masterStoragePath = "";
  elements.geoRepStoreMasterFile.required = true;
  elements.geoRepStoreMasterFormTitle.textContent = "Add Geo Rep Capture store master";
  elements.geoRepStoreMasterStatus.textContent = "The target mapping limits the stores in the final report. The optional Meridian lookup updates store, region, rep and manager details without adding unrelated stores.";
}

function renderGeoRepFormIntakes() {
  const intakes = state.geoRepFormIntakes;
  elements.geoRepFormIntakeCount.textContent = `${intakes.length} intake${intakes.length === 1 ? "" : "s"}`;
  elements.geoRepFormIntakeList.innerHTML = intakes.length ? intakes.map((intake) => {
    const forms = (intake.formNames || []).join("; ") || "No forms";
    return `<article class="management-list-item"><button type="button" data-intake-id="${escapeHtml(intake.id)}"><strong>${escapeHtml(intake.name || intake.sourceName || intake.id)}</strong><small>${escapeHtml(forms)} - ${Number(intake.questionCount || 0)} questions</small></button></article>`;
  }).join("") : `<p class="history-empty">No Form Intake uploaded.</p>`;
  const current = elements.geoRepBlueprintFormIntake.value;
  const options = [`<option value="">No linked Form Intake</option>`].concat(intakes.map((intake) => `<option value="${escapeHtml(intake.id)}">${escapeHtml(intake.name || intake.sourceName || intake.id)}</option>`));
  elements.geoRepBlueprintFormIntake.innerHTML = options.join("");
  if (intakes.some((intake) => intake.id === current)) elements.geoRepBlueprintFormIntake.value = current;
}

function applyGeoRepFormIntakeToBlueprint(intakeId) {
  const intake = state.geoRepFormIntakes.find((item) => item.id === intakeId);
  if (!intake) return;
  const formNames = (intake.formNames || []).filter(Boolean);
  if (formNames.length) elements.geoRepBlueprintFormName.value = formNames.join("; ");
  elements.geoRepBlueprintStatus.textContent = `${formNames.length} configured form${formNames.length === 1 ? "" : "s"} and ${Number(intake.questionCount || 0)} questions loaded from ${intake.name || intake.sourceName || "the Form Intake"}.`;
}

async function saveGeoRepFormIntake(event) {
  event.preventDefault();
  const submit = event.submitter;
  const file = elements.geoRepFormIntakeFile.files[0];
  submit.disabled = true;
  try {
    if (!file) throw new Error("Choose the completed Form Intake workbook.");
    if (file.size > 25 * 1024 * 1024) throw new Error("Form Intake workbook must be 25 MB or smaller.");
    if (!/\.xlsx$/i.test(file.name)) throw new Error("Upload the Form Intake as an .xlsx workbook.");
    const intakeId = `intake-${uniqueId()}`;
    const storagePath = `geo-rep-form-intakes/${intakeId}/${safeStorageName(file.name)}`;
    elements.geoRepFormIntakeStatus.textContent = "Uploading and validating the Form Intake...";
    const upload = await storage.ref(storagePath).put(file, {
      contentType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      customMetadata: { intakeId, source: "geo-rep-form-intake" }
    });
    if (Number(upload.metadata.size) !== file.size) throw new Error("Form Intake upload verification failed.");
    const result = await callFunction("saveGeoRepFormIntake", {
      id: intakeId,
      name: elements.geoRepFormIntakeName.value,
      storagePath,
      sourceName: file.name,
      active: true
    });
    elements.geoRepFormIntakeForm.reset();
    elements.geoRepBlueprintFormIntake.value = result.id;
    if (Array.isArray(result.formNames) && result.formNames.length) elements.geoRepBlueprintFormName.value = result.formNames.join("; ");
    elements.geoRepFormIntakeStatus.textContent = `${result.formCount} forms and ${result.questionCount} questions validated. Select this intake when saving the Blueprint.`;
    showToast("Geo Rep Capture Form Intake saved.");
  } catch (error) {
    elements.geoRepFormIntakeStatus.textContent = friendlyError(error);
    showToast(friendlyError(error), true);
  } finally {
    submit.disabled = false;
  }
}

function editGeoRepStoreMaster(id) {
  const master = state.geoRepStoreMasters.find((item) => item.id === id);
  if (!master) return;
  elements.geoRepStoreMasterId.value = master.id;
  elements.geoRepStoreMasterForm.dataset.storagePath = master.storagePath || "";
  elements.geoRepStoreMasterForm.dataset.masterStoragePath = master.masterStoragePath || "";
  elements.geoRepStoreMasterName.value = master.name || "";
  elements.geoRepStoreMasterClient.value = master.client || "";
  elements.geoRepStoreMasterSheetMatch.value = master.sheetMatch || "";
  elements.geoRepStoreMasterDisplayType.value = master.displayType || "Grab & Go";
  elements.geoRepStoreMasterBrand.value = master.brand || "";
  elements.geoRepStoreMasterBanner.value = master.banner || "";
  elements.geoRepStoreMasterFormNamePrefix.value = master.formNamePrefix || "";
  elements.geoRepStoreMasterFile.value = "";
  elements.geoRepStoreMasterLookupFile.value = "";
  elements.geoRepStoreMasterFile.required = false;
  elements.geoRepStoreMasterFormTitle.textContent = master.name || "Geo Rep Capture store master";
  elements.geoRepStoreMasterStatus.textContent = `${master.storeCount || 0} target stores from ${master.sourceName || "the saved workbook"}.${master.masterSourceName ? ` Meridian lookup: ${master.masterSourceName}.` : ""} Choose a new workbook only to replace it.`;
  elements.geoRepStoreMasterList.querySelectorAll("button[data-id]").forEach((button) => button.classList.toggle("active", button.dataset.id === id));
}

function renderGeoRepStoreMasters() {
  const masters = state.geoRepStoreMasters;
  elements.geoRepStoreMasterCount.textContent = `${masters.length} master${masters.length === 1 ? "" : "s"}`;
  elements.geoRepStoreMasterList.innerHTML = masters.length ? masters.map((master) => `<article class="management-list-item"><button type="button" data-id="${escapeHtml(master.id)}"><strong>${escapeHtml(master.name || master.id)}</strong><small>${master.storeCount || 0} stores Â· ${escapeHtml(master.client || "Geo Rep Capture")}</small></button><button class="text-action" type="button" data-rebuild-master="${escapeHtml(master.id)}">Build latest</button></article>`).join("") : `<p class="history-empty">No store master uploaded.</p>`;
}

const smartSellAutomationOptions = [
  { id: "sales-force-p-g", label: "Attendance Daily" },
  { id: "sales-force-p-g-monthly", label: "Attendance Monthly" },
  { id: "salesforce-display-compliance-automation", label: "Display Compliance" }
];

function renderSalesforceAttendanceMaster() {
  const config = state.salesforceAttendanceConfig || {};
  const sharedMaster = config.sharedSmartSellMaster || null;
  const displayMaster = state.displayCompliancePhaseTwoConfig?.smartSellMaster || null;
  const effectiveMaster = sharedMaster || (config.activeMasterId ? config : null) || displayMaster;
  const masterConfigured = Boolean(effectiveMaster?.storagePath && (effectiveMaster?.id || config.activeMasterId));
  const monthlyMaster = config.monthlySmartSellMaster || null;
  const monthlyMasterConfigured = Boolean(monthlyMaster?.storagePath && monthlyMaster?.id);
  const configuredAssignments = Array.isArray(sharedMaster?.assignments) && sharedMaster.assignments.length
    ? sharedMaster.assignments
    : [
      ...(masterConfigured ? ["sales-force-p-g"] : []),
      ...(monthlyMasterConfigured ? ["sales-force-p-g-monthly"] : []),
      ...(displayMaster?.storagePath ? ["salesforce-display-compliance-automation"] : [])
    ];
  const blueprint = config?.attendanceBlueprint || null;
  const blueprintConfigured = Boolean(blueprint?.driveId && blueprint?.itemId && blueprint?.dailyWorksheet);
  if (document.activeElement !== elements.salesforceAttendanceBlueprintUrl) {
    elements.salesforceAttendanceBlueprintUrl.value = blueprint?.sourceUrl || "";
  }
  elements.salesforceAttendanceBlueprintStatus.textContent = blueprintConfigured
    ? `${blueprint.name || "Attendance Blueprint.xlsx"} is connected. Daily updates write to ${blueprint.dailyWorksheet}; ${blueprint.monthlyWorksheet || "South Africa Visit Plan"} and all other tabs are preserved.`
    : "The workbook must contain a Daily worksheet and a South Africa Visit Plan worksheet. Update this link whenever a new monthly workbook is created.";
  const monthlyPlanSetup = config.monthlyPlanSetup || null;
  const monthlyPlanConfigured = Boolean(monthlyPlanSetup?.master?.driveId && monthlyPlanSetup?.target?.driveId);
  if (document.activeElement !== elements.salesforceAttendanceMonthlyPlanTargetUrl) {
    elements.salesforceAttendanceMonthlyPlanTargetUrl.value = monthlyPlanSetup?.target?.sourceUrl || "";
  }
  if (document.activeElement !== elements.salesforceAttendanceMonthlyPlanMasterUrl) {
    elements.salesforceAttendanceMonthlyPlanMasterUrl.value = monthlyPlanSetup?.master?.sourceUrl || "";
  }
  elements.salesforceAttendanceMonthlyPlanEnabled.checked = monthlyPlanSetup?.schedule?.enabled === true;
  elements.salesforceAttendanceMonthlyPlanTime.value = monthlyPlanSetup?.schedule?.time || "06:00";
  const lastPlanRun = monthlyPlanSetup?.lastRun || null;
  elements.salesforceAttendanceMonthlyPlanStatus.textContent = monthlyPlanConfigured
    ? `${monthlyPlanSetup.master.name || "SmartSell Master"} will populate ${monthlyPlanSetup.target.name || "South Africa Visit Plan"} on the 1st of every month at ${monthlyPlanSetup.schedule?.time || "06:00"}. ${lastPlanRun?.verified ? `${Number(lastPlanRun.targetRows || 0).toLocaleString()} rows last verified for ${lastPlanRun.planDate || lastPlanRun.reportMonth || "the current month"}.` : "Run Setup Now to validate the first monthly plan."}`
    : "On the 1st of every month, Nexus will rebuild the South Africa Visit Plan from SmartSell. Every row is dated to the first day of that month; formulas, pivots, and Actual Week values are preserved.";
  const monthlyBlueprintProvisioning = config.monthlyBlueprintProvisioning || null;
  const monthlyBlueprintConfigured = Boolean(monthlyBlueprintProvisioning?.template?.driveId && monthlyBlueprintProvisioning?.destination?.driveId);
  if (document.activeElement !== elements.salesforceAttendanceMonthlyBlueprintTemplateUrl) {
    elements.salesforceAttendanceMonthlyBlueprintTemplateUrl.value = monthlyBlueprintProvisioning?.template?.sourceUrl || "";
  }
  if (document.activeElement !== elements.salesforceAttendanceMonthlyBlueprintFolderUrl) {
    elements.salesforceAttendanceMonthlyBlueprintFolderUrl.value = monthlyBlueprintProvisioning?.destination?.sourceUrl || "";
  }
  if (document.activeElement !== elements.salesforceAttendanceMonthlyBlueprintPrefix) {
    elements.salesforceAttendanceMonthlyBlueprintPrefix.value = monthlyBlueprintProvisioning?.filePrefix || "Rep Attendance";
  }
  elements.salesforceAttendanceMonthlyBlueprintEnabled.checked = monthlyBlueprintProvisioning?.schedule?.enabled === true;
  elements.salesforceAttendanceMonthlyBlueprintTime.value = monthlyBlueprintProvisioning?.schedule?.time || "05:45";
  const lastBlueprintRun = monthlyBlueprintProvisioning?.lastRun || null;
  elements.salesforceAttendanceMonthlyBlueprintStatus.textContent = monthlyBlueprintConfigured
    ? `${monthlyBlueprintProvisioning.template?.name || "Protected template"} will create ${monthlyBlueprintProvisioning.filePrefix || "Rep Attendance"} - Month Year.xlsx in ${monthlyBlueprintProvisioning.destination?.name || "the selected folder"} on the 1st at ${monthlyBlueprintProvisioning.schedule?.time || "05:45"}. ${lastBlueprintRun?.verified ? `${lastBlueprintRun.fileName || "The latest workbook"} was verified and linked for ${lastBlueprintRun.reportMonth || "the latest month"}.` : "Choose a month and select Create Monthly Blueprint Now to test it."}`
    : "Save a protected template and destination folder. Nexus will create the monthly workbook, make it active, and populate its SmartSell plan before Monthly reconciliation.";
  elements.salesforceAttendanceMasterFile.required = !masterConfigured;
  elements.salesforceAttendanceMonthlyMasterFile.required = !monthlyMasterConfigured;
  if (!masterConfigured) {
    elements.salesforceAttendanceMasterId.value = "";
  } else {
    elements.salesforceAttendanceMasterId.value = effectiveMaster?.id || config.activeMasterId;
    elements.salesforceAttendanceWeek.value = String(effectiveMaster?.selectedWeek || config.selectedWeek || 1);
  }
  if (!monthlyMasterConfigured) {
    elements.salesforceAttendanceMonthlyMasterId.value = "";
  } else {
    elements.salesforceAttendanceMonthlyMasterId.value = monthlyMaster.id;
  }
  elements.salesforceAttendanceAssignments.innerHTML = `<div class="schedule-day-options smart-sell-assignment-options">${smartSellAutomationOptions.map((automation) => `<label><input type="checkbox" value="${automation.id}" ${configuredAssignments.includes(automation.id) ? "checked" : ""} /><span>${escapeHtml(automation.label)}</span></label>`).join("")}</div>`;
  const assignedCount = smartSellAutomationOptions.filter((automation) => configuredAssignments.includes(automation.id)).length;
  elements.salesforceAttendanceMasterCount.textContent = `${assignedCount}/3 assigned`;
  const details = [];
  if (blueprintConfigured) {
    details.push(`<article class="operation-row"><span class="operation-indicator good"></span><div><strong>${escapeHtml(blueprint.name || "Combined Attendance Blueprint")}</strong><small>Daily: ${escapeHtml(blueprint.dailyWorksheet)} - Monthly planning: ${escapeHtml(blueprint.monthlyWorksheet || "South Africa Visit Plan")}</small></div></article>`);
  } else {
    details.push(`<article class="operation-row"><span class="operation-indicator muted"></span><div><strong>Combined Blueprint link</strong><small>Paste the current month&apos;s SharePoint workbook link to enable the Daily worksheet update.</small></div></article>`);
  }
  if (masterConfigured) {
    const source = effectiveMaster;
    details.push(`<article class="operation-row"><span class="operation-indicator good"></span><div><strong>${escapeHtml(source.sourceName || "SmartSell Master")}</strong><small>${escapeHtml(source.worksheet || "Workbook validated")} - ${Number(source.sourceRows || 0).toLocaleString()} source rows - assigned to ${assignedCount || 0} automation${assignedCount === 1 ? "" : "s"}.</small></div></article>`);
    const weekChangedAt = source.weekUpdatedAt || config.smartSellWeekUpdatedAt || source.updatedAt || config.updatedAt;
    const weekChangedBy = source.weekUpdatedByEmail || config.smartSellWeekUpdatedByEmail || source.updatedByEmail || config.updatedByEmail || "Unknown user";
    details.push(`<article class="operation-row"><span class="operation-indicator muted"></span><div><strong>Week ${Number(source.selectedWeek || config.selectedWeek || 0) || "not selected"} assignment</strong><small>Last confirmed by ${escapeHtml(weekChangedBy)} on ${escapeHtml(formatDate(weekChangedAt))}. Every future upload, week change, and assignment change is recorded in Admin activity.</small></div></article>`);
  } else {
    details.push(`<article class="operation-row"><span class="operation-indicator muted"></span><div><strong>Shared SmartSell Master</strong><small>Upload the current master and choose the automations that should use it.</small></div></article>`);
  }
  details.push(`<article class="operation-row"><span class="operation-indicator muted"></span><div><strong>Daily logic</strong><small>Prior business day + selected SmartSell week + matching weekday. Only the Daily worksheet is changed; all other workbook tabs are retained.</small></div></article>`);
  details.push(`<article class="operation-row"><span class="operation-indicator ${monthlyPlanConfigured ? "good" : "muted"}"></span><div><strong>Monthly Plan setup</strong><small>${monthlyPlanConfigured ? `On the 1st of every month at ${escapeHtml(monthlyPlanSetup.schedule?.time || "06:00")}, SmartSell refreshes ${escapeHtml(monthlyPlanSetup.target.name || "South Africa Visit Plan")} with the month dated from the 1st.` : "Configure the SmartSell source and Monthly Plan workbook to prepare the plan before Monthly Actual Week reconciliation."}</small></div></article>`);
  details.push(`<article class="operation-row"><span class="operation-indicator ${monthlyBlueprintConfigured ? "good" : "muted"}"></span><div><strong>Monthly Blueprint Automation</strong><small>${monthlyBlueprintConfigured ? `On the 1st at ${escapeHtml(monthlyBlueprintProvisioning.schedule?.time || "05:45")}, Nexus creates and links the new monthly workbook before SmartSell planning runs.` : "Add a protected template and destination folder before enabling automatic monthly workbook creation."}</small></div></article>`);
  elements.salesforceAttendanceMasterDetails.innerHTML = details.join("");
}

async function saveSalesforceAttendanceSmartSellMaster(event) {
  event.preventDefault();
  const submit = event.submitter;
  const selectedFile = elements.salesforceAttendanceMasterFile.files[0];
  const existing = state.salesforceAttendanceConfig || {};
  const existingMaster = existing.sharedSmartSellMaster || (existing.activeMasterId ? existing : null) || state.displayCompliancePhaseTwoConfig?.smartSellMaster || null;
  const assignments = [...elements.salesforceAttendanceAssignments.querySelectorAll("input:checked")].map((input) => input.value);
  let masterId = existingMaster?.id || existing?.activeMasterId || elements.salesforceAttendanceMasterId.value || "";
  let storagePath = existingMaster?.storagePath || existing?.storagePath || "";
  submit.disabled = true;
  try {
    if (!assignments.length) throw new Error("Select at least one automation to use this SmartSell Master.");
    if (selectedFile) {
      if (selectedFile.size > 25 * 1024 * 1024) throw new Error("SmartSell Master must be 25 MB or smaller.");
      if (!/\.xlsx$/i.test(selectedFile.name)) throw new Error("Upload the SmartSell Master as an .xlsx workbook.");
      masterId = `smartsell-${uniqueId()}`;
      storagePath = `salesforce-attendance-masters/${masterId}/${safeStorageName(selectedFile.name)}`;
      elements.salesforceAttendanceMasterStatus.textContent = "Uploading and validating the SmartSell Master...";
      const upload = await storage.ref(storagePath).put(selectedFile, {
        contentType: selectedFile.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        customMetadata: { masterId, source: "smartsell-attendance" }
      });
      if (Number(upload.metadata.size) !== selectedFile.size) throw new Error("SmartSell Master upload verification failed.");
    }
    if (!masterId || !storagePath) throw new Error("Choose the current SmartSell Master workbook.");
    const sourceName = selectedFile?.name || existingMaster?.sourceName || "SmartSell Master.xlsx";
    const result = await callFunction("saveSharedSmartSellMaster", {
      id: masterId,
      storagePath,
      sourceName,
      selectedWeek: Number(elements.salesforceAttendanceWeek.value),
      assignments
    });
    elements.salesforceAttendanceMasterId.value = result.id;
    elements.salesforceAttendanceMasterFile.value = "";
    elements.salesforceAttendanceMasterFile.required = false;
    elements.salesforceAttendanceMasterStatus.textContent = `${result.sourceRows.toLocaleString()} source rows validated in ${result.worksheet}. Assigned to ${result.assignments.length} automation${result.assignments.length === 1 ? "" : "s"}.`;
    showToast("SmartSell Master saved and assigned.");
  } catch (error) {
    elements.salesforceAttendanceMasterStatus.textContent = friendlyError(error);
    showToast(friendlyError(error), true);
  } finally {
    submit.disabled = false;
  }
}

async function saveSalesforceAttendanceMonthlySmartSellMaster(event) {
  event.preventDefault();
  const submit = event.submitter;
  const selectedFile = elements.salesforceAttendanceMonthlyMasterFile.files[0];
  const existing = state.salesforceAttendanceConfig?.monthlySmartSellMaster || null;
  let masterId = existing?.id || elements.salesforceAttendanceMonthlyMasterId.value || "";
  let storagePath = existing?.storagePath || "";
  submit.disabled = true;
  try {
    if (selectedFile) {
      if (selectedFile.size > 25 * 1024 * 1024) throw new Error("Monthly SmartSell Master must be 25 MB or smaller.");
      if (!/\.xlsx$/i.test(selectedFile.name)) throw new Error("Upload the Monthly SmartSell Master as an .xlsx workbook.");
      masterId = `monthly-smartsell-${uniqueId()}`;
      storagePath = `salesforce-attendance-monthly-masters/${masterId}/${safeStorageName(selectedFile.name)}`;
      elements.salesforceAttendanceMonthlyMasterStatus.textContent = "Uploading and validating the Monthly SmartSell Master...";
      const upload = await storage.ref(storagePath).put(selectedFile, {
        contentType: selectedFile.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        customMetadata: { masterId, source: "smartsell-attendance-monthly" }
      });
      if (Number(upload.metadata.size) !== selectedFile.size) throw new Error("Monthly SmartSell Master upload verification failed.");
    }
    if (!masterId || !storagePath) throw new Error("Choose the Monthly SmartSell Master workbook.");
    const sourceName = selectedFile?.name || existing?.sourceName || "Monthly SmartSell Master.xlsx";
    const result = await callFunction("saveSalesforceAttendanceMonthlySmartSellMaster", { id: masterId, storagePath, sourceName });
    elements.salesforceAttendanceMonthlyMasterId.value = result.id;
    elements.salesforceAttendanceMonthlyMasterFile.value = "";
    elements.salesforceAttendanceMonthlyMasterFile.required = false;
    elements.salesforceAttendanceMonthlyMasterStatus.textContent = `${result.sourceRows.toLocaleString()} source rows validated in ${result.worksheet}. Monthly runs will use its Salesforce Store Codes to scope the selected Actual Week.`;
    showToast("Monthly SmartSell Master saved.");
  } catch (error) {
    elements.salesforceAttendanceMonthlyMasterStatus.textContent = friendlyError(error);
    showToast(friendlyError(error), true);
  } finally {
    submit.disabled = false;
  }
}

async function saveSalesforceAttendanceBlueprint(event) {
  event.preventDefault();
  const submit = event.submitter;
  const sharePointUrl = elements.salesforceAttendanceBlueprintUrl.value.trim();
  submit.disabled = true;
  try {
    elements.salesforceAttendanceBlueprintStatus.textContent = "Resolving and validating the combined Attendance Blueprint...";
    const result = await callFunction("saveSalesforceAttendanceBlueprint", { sharePointUrl });
    const blueprint = result.attendanceBlueprint || {};
    elements.salesforceAttendanceBlueprintStatus.textContent = `${blueprint.name || "Attendance Blueprint.xlsx"} is ready. Daily writes to ${blueprint.dailyWorksheet}; ${blueprint.monthlyWorksheet || "South Africa Visit Plan"} remains intact.`;
    showToast("Combined Attendance Blueprint link saved.");
  } catch (error) {
    elements.salesforceAttendanceBlueprintStatus.textContent = friendlyError(error);
    showToast(friendlyError(error), true);
  } finally {
    submit.disabled = false;
  }
}

async function saveSalesforceAttendanceMonthlyPlanSetup(event) {
  event.preventDefault();
  const submit = event.submitter;
  const targetUrl = elements.salesforceAttendanceMonthlyPlanTargetUrl.value.trim();
  const masterUrl = elements.salesforceAttendanceMonthlyPlanMasterUrl.value.trim();
  const enabled = elements.salesforceAttendanceMonthlyPlanEnabled.checked;
  const time = elements.salesforceAttendanceMonthlyPlanTime.value || "06:00";
  submit.disabled = true;
  try {
    elements.salesforceAttendanceMonthlyPlanStatus.textContent = "Resolving and validating the SmartSell Master and Monthly Plan workbook...";
    const result = await callFunction("saveSalesforceMonthlyAttendancePlanSetup", { targetUrl, masterUrl, enabled, time });
    const setup = result.monthlyPlanSetup || {};
    elements.salesforceAttendanceMonthlyPlanStatus.textContent = `${setup.master?.name || "SmartSell Master"} and ${setup.target?.name || "South Africa Visit Plan"} are verified. ${enabled ? `Monthly setup is enabled for the 1st at ${time}.` : "Monthly setup is saved but currently disabled."}`;
    showToast("Monthly SmartSell Plan setup saved.");
  } catch (error) {
    elements.salesforceAttendanceMonthlyPlanStatus.textContent = friendlyError(error);
    showToast(friendlyError(error), true);
  } finally {
    submit.disabled = false;
  }
}

async function runSalesforceAttendanceMonthlyPlanSetup() {
  const button = elements.runSalesforceAttendanceMonthlyPlanSetup;
  button.disabled = true;
  try {
    const result = await callFunction("runSalesforceMonthlyAttendancePlanSetup", {});
    elements.salesforceAttendanceMonthlyPlanStatus.textContent = `Monthly Plan setup queued for ${result.reportMonth}-01. Open Job runs to follow the verified SharePoint update.`;
    showToast("Monthly Plan setup queued.");
  } catch (error) {
    elements.salesforceAttendanceMonthlyPlanStatus.textContent = friendlyError(error);
    showToast(friendlyError(error), true);
  } finally {
    button.disabled = false;
  }
}

async function saveSalesforceAttendanceMonthlyBlueprintProvisioning(event) {
  event.preventDefault();
  const submit = event.submitter;
  const templateUrl = elements.salesforceAttendanceMonthlyBlueprintTemplateUrl.value.trim();
  const folderUrl = elements.salesforceAttendanceMonthlyBlueprintFolderUrl.value.trim();
  const filePrefix = elements.salesforceAttendanceMonthlyBlueprintPrefix.value.trim() || "Rep Attendance";
  const enabled = elements.salesforceAttendanceMonthlyBlueprintEnabled.checked;
  const time = elements.salesforceAttendanceMonthlyBlueprintTime.value || "05:45";
  submit.disabled = true;
  try {
    elements.salesforceAttendanceMonthlyBlueprintStatus.textContent = "Checking the protected template, destination folder, and SmartSell setup...";
    const result = await callFunction("saveSalesforceMonthlyAttendanceBlueprintProvisioning", { templateUrl, folderUrl, filePrefix, enabled, time });
    const setup = result.monthlyBlueprintProvisioning || {};
    elements.salesforceAttendanceMonthlyBlueprintStatus.textContent = `${setup.template?.name || "Template"} is verified. ${enabled ? `Nexus will create the new monthly workbook on the 1st at ${time}.` : "The monthly workbook automation is saved but currently disabled."}`;
    showToast("Monthly Blueprint Automation saved.");
  } catch (error) {
    elements.salesforceAttendanceMonthlyBlueprintStatus.textContent = friendlyError(error);
    showToast(friendlyError(error), true);
  } finally {
    submit.disabled = false;
  }
}

async function createSalesforceAttendanceMonthlyBlueprint() {
  const button = elements.createSalesforceAttendanceMonthlyBlueprint;
  button.disabled = true;
  try {
    const result = await callFunction("createSalesforceMonthlyAttendanceBlueprint", {
      reportMonth: elements.salesforceAttendanceMonthlyBlueprintMonth.value || ""
    });
    elements.salesforceAttendanceMonthlyBlueprintStatus.textContent = `Monthly Blueprint preparation queued for ${result.reportMonth}-01. Nexus will create, verify, link, and populate the workbook before Monthly reconciliation.`;
    showToast("Monthly Blueprint preparation queued.");
  } catch (error) {
    elements.salesforceAttendanceMonthlyBlueprintStatus.textContent = friendlyError(error);
    showToast(friendlyError(error), true);
  } finally {
    button.disabled = false;
  }
}

function renderDisplayCompliancePhaseTwoConfig() {
  const config = state.displayCompliancePhaseTwoConfig || {};
  const channelScope = Array.isArray(config.channelScope?.channels) ? config.channelScope.channels : [];
  const channels = [...new Map(channelScope.map((value) => {
    const label = String(value || "").trim();
    return [label.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim(), label];
  }).filter(([key, label]) => key && label)).values()];
  const master = config.smartSellMaster || null;
  const templateFolder = config.templateFolder || null;
  const templates = Array.isArray(templateFolder?.templates) ? templateFolder.templates : [];
  const sources = config.sources || {};
  const automation = config.phaseTwoAutomation || {};
  const masterReady = Boolean(master?.id && master?.storagePath);
  const templatesReady = Boolean(templateFolder?.driveId && templateFolder?.itemId && templates.length);
  const file2Ready = Boolean(sources.file2?.workspace && sources.file2?.dateRule === "report-range-with-next-month-overlap");
  const issueReady = Boolean(sources.issueTracking?.reportName && sources.issueTracking?.createdDateRule === "one-month-before-report-start");
  const readyCount = Number(masterReady) + Number(templatesReady) + Number(file2Ready) + Number(issueReady);

  elements.displayComplianceChannelsCount.textContent = `${channels.length} channel${channels.length === 1 ? "" : "s"}`;
  elements.displayComplianceChannelsStatus.textContent = channels.length
    ? `${channels.length} channels are saved for future File 1 batches. A running batch keeps the channel queue captured when it started.`
    : "No channel scope is saved. A future File 1 batch would download every Salesforce customer.";
  elements.displayComplianceChannelsList.innerHTML = channels.length
    ? channels.map((channel, index) => `<article class="operation-row"><span class="operation-indicator good"></span><div><strong>${escapeHtml(channel)}</strong><small>Included in future Display Compliance File 1 runs.</small></div><button class="text-action" type="button" data-display-compliance-remove-channel="${index}">Remove</button></article>`).join("")
    : '<p class="history-empty">Add the channels that File 1 is allowed to download.</p>';

  if (document.activeElement !== elements.displayComplianceTemplateFolderUrl) {
    elements.displayComplianceTemplateFolderUrl.value = templateFolder?.sourceUrl || "";
  }
  if (document.activeElement !== elements.displayComplianceReferenceTemplate) {
    const selected = elements.displayComplianceReferenceTemplate.value;
    elements.displayComplianceReferenceTemplate.innerHTML = templates.length
      ? templates.map((template) => `<option value="${escapeHtml(template.id)}">${escapeHtml(template.relativePath ? `${template.relativePath} - ${template.name}` : template.name)}</option>`).join("")
      : '<option value="">Save the workspace first</option>';
    if (templates.some((template) => template.id === selected)) elements.displayComplianceReferenceTemplate.value = selected;
  }
  elements.displayComplianceReferenceTemplate.disabled = !templatesReady;
  if (document.activeElement !== elements.displayCompliancePhaseTwoAutoRun) {
    elements.displayCompliancePhaseTwoAutoRun.checked = automation.enabled === true;
  }
  elements.displayCompliancePhaseTwoAutoRun.disabled = !(masterReady && templatesReady);
  elements.scanDisplayCompliancePhaseTwoInputs.disabled = !(masterReady && templatesReady);
  elements.runDisplayCompliancePhaseTwoTest.disabled = !(masterReady && templatesReady && file2Ready && issueReady);
  elements.displayComplianceSmartSellMasterFile.required = !masterReady;
  elements.displayComplianceSmartSellMasterId.value = master?.id || "";
  elements.displayComplianceSmartSellMasterStatus.textContent = masterReady
    ? `${master.sourceName || "SmartSell Master.xlsx"} is validated (${Number(master.size || 0).toLocaleString()} bytes; ${master.worksheetCount || 0} worksheets). This version is retained with each Phase Two run.`
    : "Upload the current approved SmartSell Master. Nexus records the workbook version used by each Phase Two run.";
  elements.displayComplianceTemplateFolderStatus.textContent = templatesReady
    ? `${templates.length} customer template${templates.length === 1 ? "" : "s"} registered from ${templateFolder.name || "the SharePoint folder"}. New approved channel templates are discovered automatically during the readiness scan.`
    : "Paste the SharePoint folder containing the approved per-customer templates, then scan it before a Phase Two run.";
  const lastResult = automation.lastScanResult || {};
  const lastScanDetail = automation.lastScanAt
    ? ` Last checked ${formatDate(automation.lastScanAt)}.`
    : "";
  if (automation.enabled === true) {
    elements.displayCompliancePhaseTwoAutomationStatus.textContent = `Automatic Phase Two is on. Nexus checks every 15 minutes and after File 1 completes, then updates each ready customer workbook from File 1, File 2, Issue Tracking and SmartSell. A timestamped BOT audit workbook and matching report are retained; no local script is required.${lastResult.queued ? ` ${lastResult.queued} workbook${lastResult.queued === 1 ? "" : "s"} queued on the last scan.` : ""}${lastScanDetail}`;
  } else {
    elements.displayCompliancePhaseTwoAutomationStatus.textContent = `Automatic Phase Two is off. Use Check inputs and queue ready workbooks to validate now; source templates are never overwritten.${lastScanDetail}`;
  }
  elements.displayComplianceReadinessCount.textContent = `${readyCount}/4 ready`;
  const readiness = [
    [masterReady, "SmartSell Master", masterReady ? `${master.sourceName || "Workbook"} is versioned for the run.` : "Upload the current approved workbook."],
    [templatesReady, "Customer templates", templatesReady ? `${templates.length} workbook${templates.length === 1 ? "" : "s"} registered without altering formulas.` : "Save the SharePoint template folder."],
    [file2Ready, "File 2: ZA POP Topsheet", file2Ready ? "Uses the File 1 Siebel ID and reporting range, retaining overlapping priorities into the next month." : "The ZA POP Topsheet rule is not configured."],
    [issueReady, "Issue Tracking", issueReady ? "Starts one month before the reporting start date so late-running priorities are retained." : "The Issue Tracking rule is not configured."]
  ];
  elements.displayComplianceReadinessList.innerHTML = readiness.map(([ready, title, detail]) => `<article class="operation-row"><span class="operation-indicator ${ready ? "good" : "muted"}"></span><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></div></article>`).join("");
  elements.displayComplianceSourceCount.textContent = "5 controls";
  elements.displayComplianceSourceList.innerHTML = [
    ["File 1", "Display Compliance Summary. Every customer, Display and Visibility priority is already handled by the existing batch."],
    ["File 2", "ZA POP Topsheet. Uses each File 1 Siebel ID and the reporting range, including overlap into the following month."],
    ["Issue Tracking", "Issue Tracking Report - Meridian. Created Date begins one month before the reporting start date."],
    ["SmartSell Master", "Maps the rep, supervisor, rep type and region to each store in the customer workbook."],
    ["Final workbook", "Nexus updates the approved customer workbook in place, retains SharePoint version history, and saves a timestamped BOT audit copy plus update and exceptions reports. Manual scripts are not required."]
  ].map(([title, detail]) => `<article class="operation-row"><span class="operation-indicator muted"></span><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></div></article>`).join("");
}

async function saveDisplayComplianceChannels(channels) {
  return callFunction("saveSalesforceDisplayComplianceChannels", { channels });
}

async function addDisplayComplianceChannel(event) {
  event.preventDefault();
  const submit = event.submitter;
  const channel = elements.displayComplianceChannelName.value.trim();
  if (!channel) {
    showToast("Enter a Salesforce channel name first.", true);
    elements.displayComplianceChannelName.focus();
    return;
  }
  const existing = Array.isArray(state.displayCompliancePhaseTwoConfig?.channelScope?.channels)
    ? state.displayCompliancePhaseTwoConfig.channelScope.channels
    : [];
  const key = channel.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
  if (existing.some((value) => String(value || "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim() === key)) {
    showToast("That Display Compliance channel is already included.", true);
    return;
  }
  submit.disabled = true;
  try {
    const result = await saveDisplayComplianceChannels([...existing, channel]);
    elements.displayComplianceChannelName.value = "";
    elements.displayComplianceChannelsStatus.textContent = `${result.count} channels saved for future File 1 batches.`;
    showToast("Display Compliance channel added.");
  } catch (error) {
    elements.displayComplianceChannelsStatus.textContent = friendlyError(error);
    showToast(friendlyError(error), true);
  } finally {
    submit.disabled = false;
  }
}

async function removeDisplayComplianceChannel(event) {
  const button = event.target.closest("[data-display-compliance-remove-channel]");
  if (!button) return;
  const index = Number(button.dataset.displayComplianceRemoveChannel);
  const existing = Array.isArray(state.displayCompliancePhaseTwoConfig?.channelScope?.channels)
    ? state.displayCompliancePhaseTwoConfig.channelScope.channels
    : [];
  if (!Number.isInteger(index) || !existing[index]) return;
  if (existing.length === 1) {
    showToast("Keep at least one channel in the File 1 download scope.", true);
    return;
  }
  button.disabled = true;
  try {
    const result = await saveDisplayComplianceChannels(existing.filter((_, itemIndex) => itemIndex !== index));
    elements.displayComplianceChannelsStatus.textContent = `${result.count} channels saved for future File 1 batches.`;
    showToast("Display Compliance channel removed.");
  } catch (error) {
    elements.displayComplianceChannelsStatus.textContent = friendlyError(error);
    showToast(friendlyError(error), true);
  } finally {
    button.disabled = false;
  }
}

async function saveDisplayComplianceSmartSellMaster(event) {
  event.preventDefault();
  const submit = event.submitter;
  const selectedFile = elements.displayComplianceSmartSellMasterFile.files[0];
  const existing = state.displayCompliancePhaseTwoConfig?.smartSellMaster || null;
  let id = existing?.id || elements.displayComplianceSmartSellMasterId.value || "";
  let storagePath = existing?.storagePath || "";
  submit.disabled = true;
  try {
    if (selectedFile) {
      if (selectedFile.size > 25 * 1024 * 1024) throw new Error("SmartSell Master must be 25 MB or smaller.");
      if (!/\.xlsx$/i.test(selectedFile.name)) throw new Error("Upload the SmartSell Master as an .xlsx workbook.");
      id = `display-compliance-smartsell-${uniqueId()}`;
      storagePath = `salesforce-display-compliance-masters/${id}/${safeStorageName(selectedFile.name)}`;
      elements.displayComplianceSmartSellMasterStatus.textContent = "Uploading and validating the Display Compliance SmartSell Master...";
      const upload = await storage.ref(storagePath).put(selectedFile, {
        contentType: selectedFile.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        customMetadata: { masterId: id, source: "salesforce-display-compliance" }
      });
      if (Number(upload.metadata.size) !== selectedFile.size) throw new Error("SmartSell Master upload verification failed.");
    }
    if (!id || !storagePath) throw new Error("Choose the current SmartSell Master workbook.");
    const result = await callFunction("saveSalesforceDisplayComplianceSmartSellMaster", {
      id,
      storagePath,
      sourceName: selectedFile?.name || existing?.sourceName || "SmartSell Master.xlsx"
    });
    elements.displayComplianceSmartSellMasterId.value = result.id;
    elements.displayComplianceSmartSellMasterFile.value = "";
    elements.displayComplianceSmartSellMasterFile.required = false;
    elements.displayComplianceSmartSellMasterStatus.textContent = `${result.sourceName} is validated with ${result.worksheetCount} worksheet${result.worksheetCount === 1 ? "" : "s"}.`;
    showToast("Display Compliance SmartSell Master saved.");
  } catch (error) {
    elements.displayComplianceSmartSellMasterStatus.textContent = friendlyError(error);
    showToast(friendlyError(error), true);
  } finally {
    submit.disabled = false;
  }
}

async function saveDisplayComplianceTemplateFolder(event) {
  event.preventDefault();
  const submit = event.submitter;
  submit.disabled = true;
  try {
    elements.displayComplianceTemplateFolderStatus.textContent = "Resolving the workspace and registering approved customer templates...";
    const result = await callFunction("saveSalesforceDisplayComplianceTemplateFolder", {
      sharePointUrl: elements.displayComplianceTemplateFolderUrl.value.trim()
    });
    const count = Array.isArray(result.templates) ? result.templates.length : 0;
    elements.displayComplianceTemplateFolderStatus.textContent = `${count} customer template${count === 1 ? "" : "s"} registered. Raw source files and existing outputs were excluded.`;
    showToast("Display Compliance template folder saved.");
  } catch (error) {
    elements.displayComplianceTemplateFolderStatus.textContent = friendlyError(error);
    showToast(friendlyError(error), true);
  } finally {
    submit.disabled = false;
  }
}

async function startDisplayCompliancePhaseTwoReferenceValidation() {
  const templateId = elements.displayComplianceReferenceTemplate.value;
  if (!templateId) {
    showToast("Save the Phase Two workspace and choose a reference template first.", true);
    return;
  }
  const button = elements.runDisplayCompliancePhaseTwoTest;
  button.disabled = true;
  try {
    elements.displayComplianceTemplateFolderStatus.textContent = "Queueing the controlled Phase Two reference validation...";
    const result = await callFunction("startSalesforceDisplayCompliancePhaseTwoReferenceValidation", { templateId });
    elements.displayComplianceTemplateFolderStatus.textContent = `Reference validation queued for ${result.templateName}. Nexus will write new files under BOT and will not alter the source template.`;
    showToast("Display Compliance Phase Two validation queued.");
  } catch (error) {
    elements.displayComplianceTemplateFolderStatus.textContent = friendlyError(error);
    showToast(friendlyError(error), true);
  } finally {
    renderDisplayCompliancePhaseTwoConfig();
  }
}

async function setDisplayCompliancePhaseTwoAutomation() {
  const checkbox = elements.displayCompliancePhaseTwoAutoRun;
  const enabled = checkbox.checked;
  checkbox.disabled = true;
  try {
    elements.displayCompliancePhaseTwoAutomationStatus.textContent = enabled
      ? "Enabling automatic Phase Two and checking the registered customer workspaces..."
      : "Disabling automatic Phase Two...";
    const result = await callFunction("saveSalesforceDisplayCompliancePhaseTwoAutomation", { enabled });
    elements.displayCompliancePhaseTwoAutomationStatus.textContent = enabled
      ? `Automatic Phase Two is on. ${result.queued || 0} final workbook${Number(result.queued || 0) === 1 ? "" : "s"} queued; ${result.waiting || 0} customer workspace${Number(result.waiting || 0) === 1 ? " is" : "s are"} waiting for required sources.`
      : "Automatic Phase Two is off. Existing final workbooks remain unchanged.";
    showToast(enabled ? "Automatic Display Compliance Phase Two enabled." : "Automatic Display Compliance Phase Two disabled.");
  } catch (error) {
    checkbox.checked = !enabled;
    elements.displayCompliancePhaseTwoAutomationStatus.textContent = friendlyError(error);
    showToast(friendlyError(error), true);
  } finally {
    checkbox.disabled = false;
  }
}

async function scanDisplayCompliancePhaseTwoInputs() {
  const button = elements.scanDisplayCompliancePhaseTwoInputs;
  button.disabled = true;
  try {
    elements.displayCompliancePhaseTwoAutomationStatus.textContent = "Checking each customer workspace for File 1, File 2 and Issue Tracking...";
    const result = await callFunction("scanSalesforceDisplayCompliancePhaseTwoInputs", {});
    const summary = `${result.queued || 0} queued, ${result.waiting || 0} waiting, ${result.skipped || 0} unchanged.`;
    elements.displayCompliancePhaseTwoAutomationStatus.textContent = `Input check complete: ${summary} Only new source versions are queued.`;
    showToast(`Display Compliance input check complete: ${summary}`);
  } catch (error) {
    elements.displayCompliancePhaseTwoAutomationStatus.textContent = friendlyError(error);
    showToast(friendlyError(error), true);
  } finally {
    button.disabled = false;
  }
}

function resetGeoRepBlueprintForm() {
  elements.geoRepBlueprintForm.reset();
  elements.geoRepBlueprintId.value = "";
  elements.geoRepBlueprintFormIntake.value = "";
  elements.geoRepBlueprintActive.checked = true;
  elements.geoRepBlueprintFormTitle.textContent = "Add Geo Rep Capture Blueprint";
  elements.geoRepBlueprintStatus.textContent = "No separate Form Intake is required. New source workbooks use Survey Name plus Form report. Older blueprints can still use Survey Setup and Generated Report Blueprint.";
  elements.geoRepBlueprintList.querySelectorAll("button[data-id]").forEach((button) => button.classList.remove("active"));
}

function editGeoRepBlueprint(id) {
  const blueprint = state.geoRepBlueprints.find((item) => item.id === id);
  if (!blueprint) return;
  elements.geoRepBlueprintId.value = blueprint.id;
  elements.geoRepBlueprintName.value = blueprint.name || "";
  elements.geoRepBlueprintFormIntake.value = blueprint.formIntakeId || "";
  elements.geoRepBlueprintFormName.value = (blueprint.sourceFormNames || []).join("; ");
  elements.geoRepBlueprintSharePointUrl.value = blueprint.sharePoint?.sourceUrl || blueprint.sharePoint?.webUrl || "";
  elements.geoRepBlueprintActive.checked = blueprint.active !== false;
  elements.geoRepBlueprintFormTitle.textContent = blueprint.name || "Geo Rep Capture Blueprint";
  const updated = formatDate(blueprint.updatedAt || blueprint.createdAt);
  const sourceMode = blueprint.sourceFormMode === "blueprint-survey-setup" ? "all forms from Survey Setup" : `${(blueprint.sourceFormNames || []).length} selected form${(blueprint.sourceFormNames || []).length === 1 ? "" : "s"}`;
  elements.geoRepBlueprintStatus.textContent = `${blueprint.blueprintRowCount || 0} Blueprint rows verified - Answer column ${blueprint.answerColumn || "V"} - ${sourceMode} - ${blueprint.active === false ? "Paused" : "Active"}${updated ? ` - ${updated}` : ""}.`;
  elements.geoRepBlueprintList.querySelectorAll("button[data-id]").forEach((button) => button.classList.toggle("active", button.dataset.id === id));
}

function renderGeoRepBlueprints() {
  const blueprints = state.geoRepBlueprints;
  elements.geoRepBlueprintCount.textContent = `${blueprints.length} Blueprint${blueprints.length === 1 ? "" : "s"}`;
  elements.geoRepBlueprintList.innerHTML = blueprints.length ? blueprints.map((blueprint) => {
    const formNames = (blueprint.sourceFormNames || []).join("; ") || "No Form name";
    const status = blueprint.active === false ? "Paused" : "Active";
    const source = blueprint.managedFolderId ? "Folder" : "Individual";
    return `<article class="management-list-item"><button type="button" data-id="${escapeHtml(blueprint.id)}"><strong>${escapeHtml(blueprint.name || blueprint.id)}</strong><small>${escapeHtml(status)} - ${escapeHtml(source)} - ${escapeHtml(formNames)}</small></button></article>`;
  }).join("") : `<p class="history-empty">No Geo Rep Capture Blueprint configured.</p>`;
}

function renderGeoRepBlueprintFolder() {
  const folder = state.geoRepBlueprintFolder;
  if (document.activeElement !== elements.geoRepBlueprintFolderUrl) elements.geoRepBlueprintFolderUrl.value = folder?.sourceUrl || "";
  elements.geoRepBlueprintFolderStatus.textContent = folder?.active
    ? `${folder.name || "Blueprint folder"}: ${Number(folder.validBlueprintCount || 0)} valid of ${Number(folder.workbookCount || 0)} workbook${Number(folder.workbookCount || 0) === 1 ? "" : "s"} active. Last scanned ${formatDate(folder.lastSyncedAt || folder.updatedAt)}.`
    : "Every source Blueprint workbook in this folder is checked before each Geo Rep Capture run. Nexus reads Survey Name, pulls that exact form from its start date to today, and overwrites Form report.";
  const invalid = Array.isArray(folder?.invalidWorkbooks) ? folder.invalidWorkbooks : [];
  elements.geoRepBlueprintExceptionCount.textContent = `${invalid.length} file${invalid.length === 1 ? "" : "s"}`;
  elements.geoRepBlueprintExceptionList.innerHTML = invalid.length ? invalid.map((workbook) => {
    const fileName = workbook.name || "Unnamed workbook";
    const reason = workbook.message || "This workbook could not be validated.";
    const modified = formatDate(workbook.lastModifiedDateTime);
    const link = workbook.webUrl ? `<a class="text-action" href="${escapeHtml(workbook.webUrl)}" target="_blank" rel="noopener">Open in SharePoint</a>` : "";
    return `<article class="management-list-item exception-list-item"><div><strong>${escapeHtml(fileName)}</strong><small>${escapeHtml(reason)}${modified ? ` - Modified ${escapeHtml(modified)}` : ""}</small></div>${link}</article>`;
  }).join("") : `<p class="history-empty">No skipped Blueprint files.</p>`;
  elements.geoRepBlueprintExceptionPanel.hidden = !folder?.active;
}

async function saveGeoRepBlueprintFolder(event) {
  event.preventDefault();
  const submit = event.submitter;
  submit.disabled = true;
  elements.geoRepBlueprintFolderStatus.textContent = "Resolving the folder and validating every Blueprint workbook...";
  try {
    const result = await callFunction("saveGeoRepBlueprint", { folderMode: true, sharePointUrl: elements.geoRepBlueprintFolderUrl.value });
    const invalid = Array.isArray(result.invalidWorkbooks) && result.invalidWorkbooks.length ? ` ${result.invalidWorkbooks.length} workbook${result.invalidWorkbooks.length === 1 ? "" : "s"} needs attention.` : "";
    elements.geoRepBlueprintFolderStatus.textContent = `${result.blueprints.length} Blueprint workbook${result.blueprints.length === 1 ? "" : "s"} validated and active.${invalid}`;
    showToast("Geo Rep Capture Blueprint folder saved.");
  } catch (error) {
    elements.geoRepBlueprintFolderStatus.textContent = friendlyError(error);
    showToast(friendlyError(error), true);
  } finally {
    submit.disabled = false;
  }
}

async function saveGeoRepBlueprint(event) {
  event.preventDefault();
  const submit = event.submitter;
  submit.disabled = true;
  elements.geoRepBlueprintStatus.textContent = "Resolving SharePoint and validating the Blueprint workbook...";
  try {
    const result = await callFunction("saveGeoRepBlueprint", {
      id: elements.geoRepBlueprintId.value,
      name: elements.geoRepBlueprintName.value,
      formIntakeId: elements.geoRepBlueprintFormIntake.value,
      sourceFormNames: elements.geoRepBlueprintFormName.value,
      sharePointUrl: elements.geoRepBlueprintSharePointUrl.value,
      active: elements.geoRepBlueprintActive.checked
    });
    elements.geoRepBlueprintId.value = result.id;
    elements.geoRepBlueprintFormTitle.textContent = elements.geoRepBlueprintName.value.trim() || "Geo Rep Capture Blueprint";
    elements.geoRepBlueprintStatus.textContent = result.workflowContract === "form-report-tab"
      ? `${(result.sourceFormNames || []).join("; ")} verified from Survey Name. Future runs overwrite the ${result.worksheet} tab from ${result.formStartDate || "the configured start date"} to today.`
      : `${result.blueprintRowCount} rows verified in ${result.worksheet}; ${(result.sourceFormNames || []).length} forms were read from ${result.sourceFormMode === "blueprint-survey-setup" ? "Survey Setup" : "the selected filter"}. Future raw Form Reports update Answer column ${result.answerColumn} and deliver Detail/Summary reporting to SharePoint.`;
    showToast("Geo Rep Capture Blueprint validated and saved.");
  } catch (error) {
    elements.geoRepBlueprintStatus.textContent = friendlyError(error);
    showToast(friendlyError(error), true);
  } finally {
    submit.disabled = false;
  }
}

async function importGeoRepFormReport(event) {
  event.preventDefault();
  const submit = event.submitter;
  submit.disabled = true;
  elements.geoRepFormReportImportStatus.textContent = "Validating the SharePoint Form Report and queueing its Blueprint updates...";
  try {
    const result = await callFunction("importGeoRepFormReport", { sharePointUrl: elements.geoRepFormReportImportUrl.value });
    elements.geoRepFormReportImportStatus.textContent = "Import queued. Nexus will validate the source report and update every matching active Blueprint.";
    showToast("Geo Rep Capture Form Report import queued.");
    state.selectedExecutionRunId = result.runId || state.selectedExecutionRunId;
  } catch (error) {
    elements.geoRepFormReportImportStatus.textContent = friendlyError(error);
    showToast(friendlyError(error), true);
  } finally {
    submit.disabled = false;
  }
}

async function saveGeoRepStoreMaster(event) {
  event.preventDefault();
  const submit = event.submitter;
  const name = elements.geoRepStoreMasterName.value.trim();
  const masterId = elements.geoRepStoreMasterId.value || slugify(name);
  const selectedFile = elements.geoRepStoreMasterFile.files[0];
  const selectedLookupFile = elements.geoRepStoreMasterLookupFile.files[0];
  let storagePath = elements.geoRepStoreMasterForm.dataset.storagePath || "";
  let masterStoragePath = elements.geoRepStoreMasterForm.dataset.masterStoragePath || "";
  submit.disabled = true;
  try {
    if (selectedFile) {
      if (selectedFile.size > 25 * 1024 * 1024) throw new Error("Store master workbook must be 25 MB or smaller.");
      if (!/\.xlsx$/i.test(selectedFile.name)) throw new Error("Upload the store master as an .xlsx workbook.");
      storagePath = `geo-rep-store-masters/${masterId}/${safeStorageName(selectedFile.name)}`;
      elements.geoRepStoreMasterStatus.textContent = "Uploading and validating store master...";
      const upload = await storage.ref(storagePath).put(selectedFile, { contentType: selectedFile.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", customMetadata: { masterId } });
      if (Number(upload.metadata.size) !== selectedFile.size) throw new Error("Store master upload verification failed.");
    }
    if (selectedLookupFile) {
      if (selectedLookupFile.size > 25 * 1024 * 1024) throw new Error("Meridian store master workbook must be 25 MB or smaller.");
      if (!/\.xlsx$/i.test(selectedLookupFile.name)) throw new Error("Upload the Meridian store master as an .xlsx workbook.");
      masterStoragePath = `geo-rep-store-masters/${masterId}/lookup-${safeStorageName(selectedLookupFile.name)}`;
      elements.geoRepStoreMasterStatus.textContent = "Uploading and validating store master...";
      const upload = await storage.ref(masterStoragePath).put(selectedLookupFile, { contentType: selectedLookupFile.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", customMetadata: { masterId, role: "meridian-store-master" } });
      if (Number(upload.metadata.size) !== selectedLookupFile.size) throw new Error("Meridian store master upload verification failed.");
    }
    if (!storagePath) throw new Error("Choose the approved store master workbook.");
    const result = await callFunction("saveGeoRepStoreMaster", {
      id: masterId, name, storagePath, sourceName: selectedFile?.name || state.geoRepStoreMasters.find((item) => item.id === masterId)?.sourceName || "",
      masterStoragePath, masterSourceName: selectedLookupFile?.name || state.geoRepStoreMasters.find((item) => item.id === masterId)?.masterSourceName || "",
      client: elements.geoRepStoreMasterClient.value, sheetMatch: elements.geoRepStoreMasterSheetMatch.value,
      displayType: elements.geoRepStoreMasterDisplayType.value, brand: elements.geoRepStoreMasterBrand.value,
      banner: elements.geoRepStoreMasterBanner.value, formNamePrefix: elements.geoRepStoreMasterFormNamePrefix.value, active: true
    });
    elements.geoRepStoreMasterId.value = result.id;
    elements.geoRepStoreMasterForm.dataset.storagePath = storagePath;
    elements.geoRepStoreMasterForm.dataset.masterStoragePath = masterStoragePath;
    elements.geoRepStoreMasterFile.value = "";
    elements.geoRepStoreMasterLookupFile.value = "";
    elements.geoRepStoreMasterFile.required = false;
    elements.geoRepStoreMasterStatus.textContent = `${result.storeCount} stores validated. Future Form By Sheet downloads will automatically create the Power BI report.`;
    showToast(`Geo Rep Capture store master saved with ${result.storeCount} stores.`);
  } catch (error) {
    elements.geoRepStoreMasterStatus.textContent = friendlyError(error);
    showToast(friendlyError(error), true);
  } finally {
    submit.disabled = false;
  }
}

async function buildLatestGeoRepPowerBiReport() {
  const source = state.files.find((file) => file.retailerId === "geo-rep" && file.geoRepReportType === "Form By Sheet");
  if (!source) { showToast("No saved Geo Rep Capture Form By Sheet report is available yet.", true); return; }
  try {
    showToast("Building the latest Geo Rep Capture Power BI report...");
    const result = await callFunction("processGeoRepPowerBiReport", { sourceFileId: source.id });
    const generated = result.results?.filter((item) => !item.inProgress).length || 0;
    showToast(generated ? "Geo Rep Capture Power BI report created and delivered to SharePoint." : "The latest Geo Rep Capture Power BI report is already being built.");
  } catch (error) {
    showToast(friendlyError(error), true);
  }
}

function renderAdminUserAllowedRetailers(selected = []) {
  if (!elements.adminUserAllowedRetailers) return;
  const selectedIds = new Set(Array.isArray(selected) ? selected : []);
  const profiles = (state.retailers || []).slice().sort((left, right) => String(left.name || left.id).localeCompare(String(right.name || right.id)));
  elements.adminUserAllowedRetailers.innerHTML = profiles.length
    ? profiles.map((profile) => `<option value="${escapeHtml(profile.id)}"${selectedIds.has(profile.id) ? " selected" : ""}>${escapeHtml(profile.name || profile.id)}</option>`).join("")
    : `<option disabled>No extraction profiles loaded</option>`;
}

function renderAdminUserNavigation(selected = NORMAL_USER_DEFAULT_NAVIGATION, role = "normal", chatEnabled = true) {
  const selectedIds = new Set(Array.isArray(selected) ? selected : NORMAL_USER_DEFAULT_NAVIGATION);
  const isAdmin = role === "admin";
  elements.adminUserNavigation.forEach((input) => {
    input.checked = input.value === "chat" ? chatEnabled : isAdmin || selectedIds.has(input.value);
    input.disabled = isAdmin && input.value !== "chat";
  });
}

function resetAdminUserForm() {
  if (elements.adminUserForm.dataset.saving === "true") return;
  const status = document.getElementById("adminUserSaveStatus");
  if (status) { status.hidden = true; status.textContent = ""; }
  elements.adminUserForm.reset(); elements.adminUserId.value = ""; elements.adminUserRole.disabled = false; elements.adminUserRole.value = "normal"; renderAdminUserNavigation(); renderAdminUserAllowedRetailers([]); elements.adminUserFormTitle.textContent = "Create user"; elements.deleteAdminUser.hidden = true;
  syncAdminChatFields();
}

function syncAdminChatFields() {
  const external = document.getElementById("adminChatAudience").value === "external";
  const clientKey = document.getElementById("adminChatClientId");
  clientKey.required = false; clientKey.disabled = true;
  if (external) {
    document.getElementById("adminChatWorkRole").value = "Client";
    elements.adminUserNavigation.forEach(input => { input.checked = false; input.disabled = true; });
  } else elements.adminUserNavigation.forEach(input => { input.disabled = elements.adminUserRole.value === "admin" && input.value !== "chat"; });
  elements.adminUserAllowedRetailers.disabled = external;
  for (const key of ["CreateGroups", "AssignTasks", "ModerateMessages"]) {
    const input = document.getElementById(`adminChat${key}`);
    input.disabled = external;
    if (external) input.checked = false;
  }
}

function editAdminUser(uid) {
  if (elements.adminUserForm.dataset.saving === "true") return;
  const status = document.getElementById("adminUserSaveStatus");
  if (status) { status.hidden = true; status.textContent = ""; }
  const user = state.adminUsers.find((item) => item.uid === uid); if (!user) return;
  const role = user.role || "normal";
  const clientAccount = user.accountType === "client" || user.role === "client" || user.chatAccess?.audience === "external" || user.chatAccess?.workRole === "Client";
  elements.adminUserId.value = uid; elements.adminUserName.value = user.name || ""; elements.adminUserSurname.value = user.surname || ""; elements.adminUserEmail.value = user.email || ""; elements.adminUserRole.value = role; elements.adminUserRole.disabled = uid === auth.currentUser?.uid; elements.adminUserPassword.value = ""; elements.adminUserDisabled.checked = user.disabled === true; renderAdminUserNavigation(user.permissions?.allowedNavigationIds, role); renderAdminUserAllowedRetailers(user.permissions?.allowedRetailerIds || []); elements.adminUserFormTitle.textContent = [user.name, user.surname].filter(Boolean).join(" ") || user.email || "Edit user"; elements.deleteAdminUser.hidden = uid === auth.currentUser?.uid;
  for (const key of ["audience", "clientId", "workRole", "region", "department"]) {
    document.getElementById(`adminChat${key[0].toUpperCase()}${key.slice(1)}`).value = key === "audience" ? (clientAccount ? "external" : "internal") : user.chatAccess?.[key] || "";
  }
  renderAdminUserNavigation(user.permissions?.allowedNavigationIds, role, !clientAccount && user.permissions?.chatEnabled !== false);
  for (const key of ["createGroups", "assignTasks", "moderateMessages"]) document.getElementById(`adminChat${key[0].toUpperCase()}${key.slice(1)}`).checked = !clientAccount && (role === "admin" || (user.chatAccess?.[key] ?? key !== "moderateMessages"));
  syncAdminChatFields();
}

function renderAdminUsers() {
  const users = state.adminUsers || [];
  const query = String(elements.adminUserSearch?.value || "").trim().toLowerCase();
  const enrichedUsers = users.map((user) => ({ ...user, resolvedRole: user.role || "normal" }));
  const filteredUsers = query ? enrichedUsers.filter((user) => [user.name, user.surname, user.email, user.uid, user.resolvedRole, user.disabled ? "disabled" : "active"].some((value) => String(value || "").toLowerCase().includes(query))) : enrichedUsers;
  if (elements.adminUserTotal) elements.adminUserTotal.textContent = users.length;
  if (elements.adminUserAdminCount) elements.adminUserAdminCount.textContent = enrichedUsers.filter((user) => user.resolvedRole === "admin" && !user.disabled).length;
  if (elements.adminUserNormalCount) elements.adminUserNormalCount.textContent = enrichedUsers.filter((user) => user.resolvedRole !== "admin" && !user.disabled).length;
  if (elements.adminUserDisabledCount) elements.adminUserDisabledCount.textContent = enrichedUsers.filter((user) => user.disabled).length;
  if (elements.adminUserListCount) elements.adminUserListCount.textContent = `${filteredUsers.length} user${filteredUsers.length === 1 ? "" : "s"}`;
  elements.adminUserList.innerHTML = filteredUsers.length ? filteredUsers.map((user) => {
    const name = [user.name, user.surname].filter(Boolean).join(" ") || "Unnamed user";
    const profileCount = Array.isArray(user.permissions?.allowedRetailerIds) ? user.permissions.allowedRetailerIds.length : 0;
    const navigationCount = normalUserNavigationIds(user.permissions).length;
    const accessText = user.resolvedRole === "admin" ? "Full admin access" : `${navigationCount} menu${navigationCount === 1 ? "" : "s"} - ${profileCount ? `${profileCount} permitted profile${profileCount === 1 ? "" : "s"}` : "All approved profiles"}`;
    return `<button type="button" data-id="${escapeHtml(user.uid)}"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(user.email || user.uid || "No email")} - ${escapeHtml(user.resolvedRole === "admin" ? "Admin" : "Normal")} - ${escapeHtml(accessText)}${user.disabled ? " - Disabled" : ""}</small></button>`;
  }).join("") : `<p class="history-empty">${users.length ? "No users match your search." : "No users found."}</p>`;
  renderOperations();
}

function timestampMillis(value) {
  if (typeof value?.toMillis === "function") return value.toMillis();
  const parsed = value ? new Date(value).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatElapsed(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${minutes}m ${seconds}s`;
}

function latestRunActivityAt(run) {
  const timelineAt = (Array.isArray(run?.executionTimeline) ? run.executionTimeline : []).reduce((latest, entry) => Math.max(latest, timestampMillis(entry?.at)), 0);
  return Math.max(timelineAt, timestampMillis(run?.lastActivityAt), timestampMillis(run?.updatedAt), timestampMillis(run?.startedAt), timestampMillis(run?.createdAt));
}

function sortRunsNewestFirst(left, right) {
  return latestRunActivityAt(right) - latestRunActivityAt(left)
    || timestampMillis(right?.createdAt) - timestampMillis(left?.createdAt)
    || String(right?.id || "").localeCompare(String(left?.id || ""));
}

function johannesburgDateKey(value = Date.now()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dateKeyDaysBefore(days, reference = Date.now()) {
  const key = johannesburgDateKey(reference);
  if (!key) return "";
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day - Number(days || 0)));
  return date.toISOString().slice(0, 10);
}

function runActivityDateKey(run) {
  return johannesburgDateKey(latestRunActivityAt(run) || Date.now());
}

function logPeriodForRun(run, { lifetime = false } = {}) {
  const key = runActivityDateKey(run);
  const today = dateKeyDaysBefore(0);
  const yesterday = dateKeyDaysBefore(1);
  const sevenDaysAgo = dateKeyDaysBefore(7);
  const fourteenDaysAgo = dateKeyDaysBefore(14);
  if (key === today) return { id: "today", label: "Today", open: true, rank: 0 };
  if (key === yesterday) return { id: "yesterday", label: "Yesterday", open: false, rank: 1 };
  if (key >= sevenDaysAgo) return { id: "last-week", label: "Last 7 days", open: false, rank: 2 };
  if (!lifetime || key >= fourteenDaysAgo) return { id: "last-fortnight", label: "Earlier in the last 14 days", open: false, rank: 3 };
  const date = new Date(`${key}T12:00:00Z`);
  const label = Number.isNaN(date.getTime())
    ? "Earlier history"
    : new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", month: "long", year: "numeric" }).format(date);
  return { id: `history-${key.slice(0, 7)}`, label, open: false, rank: 100000 - Number(key.replace(/-/g, "")) };
}

function operationRunLabel(run) {
  return run?.retailerName || run?.extractionName || "Extraction report";
}

function operationRunTiming(run) {
  const trigger = run?.trigger === "scheduled" || run?.trigger === "scheduled-companion"
    ? "Scheduled"
    : ["derived", "automatic-retry"].includes(run?.trigger) ? "Automated" : "Manual";
  const detail = run?.actualReportPeriod || [run?.reportStartDate, run?.reportEndDate].filter(Boolean).join(" to ") || "Report period not recorded";
  return `${trigger} - ${detail} - ${formatDate(run?.completedAt || run?.lastActivityAt || run?.createdAt)}`;
}

function groupedRunHistoryMarkup(runs, { lifetime = false, emptyMessage = "No extraction activity recorded.", admin = false } = {}) {
  if (!runs?.length) return `<p class="history-empty">${escapeHtml(emptyMessage)}</p>`;
  const periods = new Map();
  runs.slice().sort(sortRunsNewestFirst).forEach((run) => {
    const period = logPeriodForRun(run, { lifetime });
    if (!periods.has(period.id)) periods.set(period.id, { ...period, profiles: new Map() });
    const group = periods.get(period.id);
    const profileKey = run?.retailerId || operationRunLabel(run);
    if (!group.profiles.has(profileKey)) group.profiles.set(profileKey, { label: operationRunLabel(run), runs: [] });
    group.profiles.get(profileKey).runs.push(run);
  });
  return [...periods.values()].sort((left, right) => left.rank - right.rank).map((period) => {
    const periodRuns = [...period.profiles.values()].reduce((total, profile) => total + profile.runs.length, 0);
    const profiles = [...period.profiles.values()].map((profile) => ({ ...profile, runs: profile.runs.slice().sort(sortRunsNewestFirst) }))
      .sort((left, right) => sortRunsNewestFirst(left.runs[0], right.runs[0]) || left.label.localeCompare(right.label)).map((profile) => {
      const active = profile.runs.some(isActiveOperationRun);
      const profileRows = profile.runs.map((run) => {
        const status = runStatus(run);
        const owner = operationRunOwnerLabel(run);
        const controls = admin && isActiveOperationRun(run)
          ? `<button class="text-action danger-text-action" type="button" data-admin-job-abort="${escapeHtml(run.id)}">Abort</button>`
          : "";
        const selected = run.id && run.id === state.selectedAdminJobRunId;
        return `<article class="operation-row automation-log-row${selected ? " selected" : ""}"><span class="operation-indicator ${status.className}"></span><div><strong>${escapeHtml(operationRunTiming(run))}</strong><small>${escapeHtml(owner)}${run?.message ? ` - ${escapeHtml(run.message)}` : ""}</small></div><div class="operation-row-actions"><span class="row-status ${status.className}">${status.label}</span><button class="text-action" type="button" data-operations-view="${escapeHtml(run.id)}">${admin ? "Open" : "View log"}</button>${controls}</div></article>`;
      }).join("");
      return `<details class="automation-log-profile"${period.open ? " open" : ""}><summary><span class="operation-indicator ${active ? "running" : "good"}"></span><strong>${escapeHtml(profile.label)}</strong><small>${profile.runs.length} job${profile.runs.length === 1 ? "" : "s"}</small></summary><div class="automation-log-rows">${profileRows}</div></details>`;
    }).join("");
    return `<details class="automation-log-period"${period.open ? " open" : ""}><summary><span><strong>${escapeHtml(period.label)}</strong><small>${periodRuns} job${periodRuns === 1 ? "" : "s"}</small></span><i aria-hidden="true"></i></summary><div class="automation-log-profiles">${profiles}</div></details>`;
  }).join("");
}

function humanizeExtractionAction(action) {
  const actionLabels = {
    navigate: "Opening portal",
    fillUsername: "Entering username",
    fillPassword: "Entering password",
    fillOtp: "Waiting for secure code",
    click: "Selecting portal option",
    select: "Selecting report option",
    submit: "Submitting report request",
    download: "Downloading report",
    wait: "Waiting for portal response"
  };
  if (actionLabels[action]) return actionLabels[action];
  return action ? String(action).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase()) : "Preparing extraction";
}

function totalRunSteps(run) {
  const explicitTotal = Number(run?.totalSteps || 0);
  if (explicitTotal > 0) return explicitTotal;
  const profile = state.extractionProfiles.find((item) => item.id === run?.extractionProfileId);
  if (Array.isArray(profile?.steps) && profile.steps.length) return profile.steps.length;
  const workflowEvent = (Array.isArray(run?.executionTimeline) ? run.executionTimeline : []).find((entry) => entry?.event === "workflow-loaded");
  const timelineTotal = Number(workflowEvent?.stepCount || 0);
  return timelineTotal > 0 ? timelineTotal : Math.max(Number(run?.currentStep || 0), 1);
}

function activeRunAction(run) {
  if (run?.currentStepAction) return run.currentStepAction;
  const step = Number(run?.currentStep || 0);
  const events = Array.isArray(run?.executionTimeline) ? run.executionTimeline : [];
  const currentEvent = events.slice().reverse().find((entry) => Number(entry?.step || 0) === step && entry?.action);
  return currentEvent?.action || "";
}

function describeExtractionProgress(run) {
  const status = run?.status || "queued";
  const isBusy = ["queued", "running", "waiting_otp", "waiting_for_otp", "waiting_approval", "cancelling"].includes(status);
  const currentStep = Math.max(0, Number(run?.currentStep || 0));
  const totalSteps = totalRunSteps(run);
  const action = activeRunAction(run);
  const startedAt = timestampMillis(run?.startedAt) || timestampMillis(run?.createdAt) || Date.now();
  const activityAt = latestRunActivityAt(run) || startedAt;
  const elapsed = Math.max(0, Date.now() - startedAt);
  const inactiveFor = Math.max(0, Date.now() - activityAt);
  const waitingForOtp = status === "waiting_otp" || status === "waiting_for_otp";
  const waitingForApproval = status === "waiting_approval";
  const waitingForPortal = (status === "running" && inactiveFor >= 90000) || (status === "queued" && elapsed >= 90000);
  const stepLabel = currentStep ? `Step ${currentStep} of ${totalSteps} - ${humanizeExtractionAction(action)}` : status === "queued" ? "Queued for a secure browser" : "Preparing extraction";
  const progress = status === "completed" ? 100 : status === "queued" ? 7 : (status === "waiting_otp" || status === "waiting_for_otp" || status === "waiting_approval") ? Math.min(92, Math.max(12, Math.round((currentStep / totalSteps) * 100))) : status === "cancelling" ? Math.min(96, Math.max(12, Math.round((currentStep / totalSteps) * 100))) : Math.min(94, Math.max(12, Math.round(((Math.max(currentStep, 1) - 0.28) / totalSteps) * 100)));
  let title = `Extracting ${run?.retailerName || "report"}`;
  let copy = run?.message || "Nexus is securely retrieving and verifying the report.";
  let health = `Last portal activity ${formatElapsed(inactiveFor)} ago. This panel refreshes at every completed step.`;
  let alert = "";
  if (waitingForApproval) {
    title = "Waiting for Authenticator approval";
    copy = run?.message || "Approve the Salesforce request in Authenticator. Nexus will continue automatically.";
    health = "The browser is monitoring Salesforce for the app approval. You do not need to enter anything here.";
  } else if (status === "running" && /salesforce approval received|authenticator approval confirmed/i.test(String(run?.message || ""))) {
    title = "Approval received, continuing";
    copy = run.message;
    health = "Salesforce accepted the approval. Nexus is continuing the report workflow automatically.";
  } else if (waitingForOtp) {
    title = "Action required to continue";
    copy = run?.message || "Nexus is waiting for a secure code in the approval prompt.";
    health = "The browser is waiting for your secure code or approval. This is not a portal failure.";
  } else if (status === "queued") {
    title = "Extraction queued";
    copy = run?.message || "Nexus is waiting for the secure browser worker to start.";
  } else if (status === "cancelling") {
    title = "Stopping extraction";
    copy = "Nexus is closing the browser session safely. No new report will be delivered.";
    health = "Cancellation has been accepted and the report lock will be released.";
  } else if (waitingForPortal) {
    title = "Waiting for portal response";
    alert = `No new portal activity for ${formatElapsed(inactiveFor)}. The external portal may be slow, unavailable, or waiting on an element that did not load. Continue waiting keeps the session open. Restart ends this session and starts a new attempt. End session stops this run without retrying.`;
    health = alert;
  }
  return { isBusy, waitingForPortal, waitingForOtp, waitingForApproval, currentStep, totalSteps, stepLabel, elapsed, inactiveFor, progress, title, copy, health, alert };
}

function renderRunProgress(run, progress) {
  const show = Boolean(run && progress?.isBusy);
  elements.adminRunProgress.hidden = !show;
  if (!show) {
    elements.adminRunProgress.classList.remove("is-stalled");
    return;
  }
  elements.adminRunProgress.classList.toggle("is-stalled", progress.waitingForPortal);
  elements.adminRunStep.textContent = progress.stepLabel;
  elements.adminRunElapsed.textContent = formatElapsed(progress.elapsed);
  elements.adminRunProgressBar.style.width = `${progress.progress}%`;
  elements.adminRunHealth.textContent = progress.health;
}

function reportFiles() {
  if (Array.isArray(state.operationsWorkspace?.reports)) return state.operationsWorkspace.reports;
  return state.files.filter((file) => file.source === "retailer-extraction" || file.extractionRunId).slice().sort(sortFilesNewestFirst);
}

function profilePortal(profile) {
  try { return new URL(profile.webAddress).hostname; } catch (error) { return profile.webAddress || "Portal address unavailable"; }
}

function profileSchedule(profile) {
  const schedule = profile.reportSchedule || {};
  const monthly = schedule.frequency === "monthly";
  if (!schedule.enabled) return { label: "Manual only", detail: monthly ? "Monthly schedule is not enabled" : "No daily schedule enabled", active: false };
  const days = scheduleDaysForDisplay(schedule);
  const daysLabel = days.length === 7 ? "Every day" : days.length === 5 && [1, 2, 3, 4, 5].every((day) => days.includes(day)) ? "Weekdays" : days.map((day) => scheduleDayLabels[day]).join(", ");
  const dateDetail = schedule.dateMode === "fixed"
    ? `${schedule.startDate || "Current"} to ${schedule.endDate || schedule.startDate || "current"}`
    : monthly ? "Uses the first day of the run month" : "Uses each run day";
  const monthlyActualDetail = monthly
    ? `${schedule.monthlyReconcileAllWeeks === true ? "All Actual Weeks" : `Actual Week ${schedule.monthlyActualWeek || "not set"}`}. ${dateDetail}`
    : dateDetail;
  const monthlyCadence = schedule.monthlyRunCadence === "daily" || schedule.dayOfMonth === "daily"
    ? "daily"
    : schedule.monthlyRunCadence === "weekdays" || schedule.dayOfMonth === "weekdays"
      ? "weekdays"
      : schedule.dayOfMonth || 1;
  return monthly
    ? { label: `Monthly ${monthlyRunDayDescription(monthlyCadence)} at ${schedule.time || "time not set"}`, detail: `${daysLabel}. ${monthlyActualDetail}`, active: true }
    : { label: `Daily at ${schedule.time || "time not set"}`, detail: `${daysLabel}. ${dateDetail}`, active: true };
}

function runStatus(run) {
  if (["queued", "running", "waiting_otp", "waiting_for_otp", "waiting_approval"].includes(run?.status)) return { label: "Running", className: "running" };
  if (run?.status === "cancelling") return { label: "Stopping", className: "running" };
  if (run?.status === "cancelled") return { label: "Aborted", className: "skipped" };
  if (run?.geoRepBlueprint?.noData) return { label: "No matching answers", className: "no-data" };
  if (run?.status === "completed_no_data") return { label: "No data", className: "no-data" };
  if (run?.status === "skipped_duplicate") return { label: "Duplicate skipped", className: "skipped" };
  if (run?.status === "failed") return { label: "Needs attention", className: "failed" };
  return { label: "Delivered", className: "completed" };
}

function runDetailProgressMarkup(run, progress, status, owner) {
  const percent = Math.max(0, Math.min(100, Number(progress?.progress || (run?.status === "completed" ? 100 : 0))));
  const lastActivity = formatDate(run?.lastActivityAt || run?.updatedAt || run?.completedAt || run?.createdAt);
  const startedAt = formatDate(run?.startedAt || run?.createdAt);
  const statusCopy = progress?.isBusy
    ? progress.copy
    : run?.status === "completed"
      ? "The job finished and the report delivery workflow completed."
      : run?.status === "failed"
        ? "The job stopped before a verified report was delivered. Review the timeline and recovery actions below."
        : run?.message || "The job is no longer active.";
  return `<section class="admin-job-status-card ${escapeHtml(status.className)}">
    <div class="admin-job-status-main">
      <span class="operation-indicator ${escapeHtml(status.className)}"></span>
      <div><p class="eyebrow">Job status</p><h4>${escapeHtml(progress?.isBusy ? progress.title : status.label)}</h4><p>${escapeHtml(statusCopy || "Job status loaded.")}</p></div>
      <strong>${Math.round(percent)}%</strong>
    </div>
    <div class="run-progress-track admin-job-status-track" aria-label="${escapeHtml(`${Math.round(percent)}% complete`)}"><span style="width:${Math.max(2, percent)}%"></span></div>
    <div class="admin-job-status-grid">
      <article><span>Current step</span><strong>${escapeHtml(progress?.stepLabel || "No active step")}</strong></article>
      <article><span>Owner</span><strong>${escapeHtml(owner || "System")}</strong></article>
      <article><span>Started</span><strong>${escapeHtml(startedAt)}</strong></article>
      <article><span>Last activity</span><strong>${escapeHtml(lastActivity)}</strong></article>
    </div>
  </section>`;
}

function runDetailMarkup(run, heading = "Run detail") {
  const status = runStatus(run);
  const timeline = Array.isArray(run.executionTimeline) ? run.executionTimeline : [];
  const events = timeline.length ? timeline.map((entry) => `<li><time>${escapeHtml(formatDate(entry.at))}</time><div><strong>${escapeHtml(entry.message || entry.event || "Run update")}</strong>${entry.step ? `<small>Step ${escapeHtml(entry.step)}${entry.action ? ` - ${escapeHtml(entry.action)}` : ""}</small>` : ""}</div></li>`).join("") : `<li><div><strong>${escapeHtml(run.message || "No execution events were saved for this older run.")}</strong></div></li>`;
  const runOrigin = run.trigger === "scheduled" || run.trigger === "scheduled-companion" ? "Scheduled run" : ["derived", "automatic-retry"].includes(run.trigger) ? "Automated follow-up" : "Manual run";
  const progress = describeExtractionProgress(run);
  const summary = run.runSummary?.text ? `<section class="run-summary"><p class="eyebrow">Run summary</p><p>${escapeHtml(run.runSummary.text).replace(/\n/g, "<br>")}</p></section>` : "";
  const salesforceRetry = run.salesforceAutoRetry?.status === "waiting"
    ? `<section class="run-summary"><p class="eyebrow">Automatic retry</p><p>Salesforce did not finish loading the report data. Nexus will retry this scheduled attendance job at ${escapeHtml(formatDate(run.salesforceAutoRetry.nextAttemptAt))}. No workbook was changed.</p></section>`
    : run.salesforceAutoRetry?.status === "exhausted"
      ? `<section class="run-summary run-summary-attention"><p class="eyebrow">Automatic retry exhausted</p><p>Salesforce report-load retries are exhausted for this scheduled attendance job. Start one manual rerun when Salesforce is responding.</p></section>`
      : "";
  const stallActions = progress.waitingForPortal ? `<section class="run-summary run-summary-attention"><p class="eyebrow">Portal response required</p><p>${escapeHtml(progress.alert)}</p><div class="run-summary-actions"><button class="secondary-button" type="button" data-continue-stalled="${escapeHtml(run.id)}">Continue waiting</button><button class="secondary-button" type="button" data-restart-stalled="${escapeHtml(run.id)}">Restart</button><button class="abort-extraction" type="button" data-end-stalled="${escapeHtml(run.id)}">End session</button></div></section>` : "";
  const retryFailedStep = ["failed", "completed_no_data", "waiting_sharepoint_unlock"].includes(String(run.status || ""))
    ? `<section class="run-summary run-summary-attention"><p class="eyebrow">Recovery</p><p>Retry the last failed step. Nexus rebuilds only the secure portal state required for that step and preserves the original run log.</p><div class="run-summary-actions"><button class="secondary-button" type="button" data-retry-failed="${escapeHtml(run.id)}">Retry failed step</button></div></section>`
    : "";
  const owner = run.trigger === "scheduled" ? (run.scheduledByName || run.scheduledByEmail || "Scheduler") : (run.createdByName || run.createdByEmail || "System");
  const progressInfo = runDetailProgressMarkup(run, progress, status, owner);
  return `<header><div><p class="eyebrow">${escapeHtml(heading)}</p><h3>${escapeHtml(run.retailerName || "Extraction profile report")}</h3><p>${escapeHtml(runOrigin)} - ${escapeHtml(run.reportStartDate || "Current")} to ${escapeHtml(run.reportEndDate || run.reportStartDate || "current")} - started by ${escapeHtml(owner)}</p></div><span class="row-status ${status.className}">${status.label}</span></header>${progressInfo}${summary}${salesforceRetry}${stallActions}${retryFailedStep}<ol class="run-timeline">${events}</ol>`;
}

function renderExecutionRunDetail(run) {
  elements.adminRunDetail.hidden = true;
  elements.adminRunDetail.innerHTML = run ? runDetailMarkup(run) : "";
}

function renderOperationsRunDetail(run) {
  elements.operationsRunDetail.hidden = !run;
  elements.operationsRunDetail.innerHTML = run ? runDetailMarkup(run, "Your job log") : "";
}

function renderAdminJobDetail(run) {
  if (!run) {
    elements.adminJobDetail.hidden = true;
    elements.adminJobDetail.innerHTML = "";
    elements.adminJobDetailEmpty.hidden = false;
    return;
  }
  elements.adminJobDetailEmpty.hidden = true;
  elements.adminJobDetail.hidden = false;
  elements.adminJobDetail.innerHTML = runDetailMarkup(run, "Detailed job log");
}

function configureAutomationProfile(profileId) {
  if (!state.retailers.some((profile) => profile.id === profileId)) return;
  elements.runRetailer.value = profileId;
  renderRunRetailerDetails();
  openAdminWorkspace();
  activateAdminTab("reports");
  window.setTimeout(() => elements.runRetailer.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
}

function renderHomeAutomationProfiles(profiles) {
  if (!elements.nexusHomeAutomationCount || !elements.nexusHomeAutomationList) return;
  if (!state.isAdmin) {
    elements.nexusHomeAutomationCount.textContent = "Sign in required";
    elements.nexusHomeAutomationList.innerHTML = `<p class="history-empty">Sign in through Admin to load the configured extraction profiles.</p>`;
    return;
  }
  elements.nexusHomeAutomationCount.textContent = `${profiles.length} profile${profiles.length === 1 ? "" : "s"}`;
  elements.nexusHomeAutomationList.innerHTML = profiles.length ? profiles.map((profile) => {
    const ready = hasExtractionSteps(profile);
    const schedule = profileSchedule(profile);
    return `<article class="nexus-home-profile"><span class="operation-indicator ${ready ? "good" : "warning"}"></span><div><strong>${escapeHtml(profile.name || "Extraction profile")}</strong><small>${escapeHtml(profilePortal(profile))} - ${escapeHtml(schedule.label)}</small></div><button class="text-action" type="button" data-configure-profile="${escapeHtml(profile.id)}">Open</button></article>`;
  }).join("") : `<p class="history-empty">No extraction profiles are configured yet. Create one in Admin to begin.</p>`;
}

function renderOperations() {
  const profiles = state.retailers;
  renderHomeAutomationProfiles(profiles);
  const readyProfiles = profiles.filter(hasExtractionSteps);
  const scheduledProfiles = profiles.filter((profile) => profile.reportSchedule?.enabled === true);
  const deliveries = reportFiles();
  const latestDelivery = deliveries[0];
  const allRuns = state.extractionRuns.slice().sort(sortRunsNewestFirst);
  // Report Automation is an operator workspace. Keep it focused on the
  // signed-in user's work; organisation-wide monitoring belongs in Admin Jobs.
  const runs = state.isOperator ? allRuns.filter(operationRunBelongsToCurrentUser).slice(0, 12) : allRuns.slice(0, 12);
  const deliveryTitle = latestDelivery ? "Delivered" : "Waiting";
  const deliveryCaption = latestDelivery ? `${latestDelivery.retailerName || "Report"} Â· ${formatDate(latestDelivery.completedAt || latestDelivery.uploadedAt || latestDelivery.createdAt)}` : "Waiting for a completed report";

  const activeRuns = runs.filter(isActiveOperationRun);
  elements.automationProfileCount.textContent = activeRuns.length;
  elements.automationProfileCaption.textContent = activeRuns.length ? `${activeRuns.length} extraction${activeRuns.length === 1 ? "" : "s"} in progress` : "No active report runs";
  elements.automationScheduleCount.textContent = scheduledProfiles.length;
  elements.automationScheduleCaption.textContent = scheduledProfiles.length ? `${scheduledProfiles.length} recurring schedule${scheduledProfiles.length === 1 ? "" : "s"} enabled` : "No schedules enabled";
  elements.automationDeliveryState.textContent = deliveryTitle;
  elements.automationDeliveryCaption.textContent = deliveryCaption;
  elements.automationRunCount.textContent = runs.length;
  elements.automationRunCaption.textContent = runs.length ? `${runs.filter((run) => ["queued", "running"].includes(run.status)).length} active or queued` : "No report runs recorded";

  elements.adminReadyProfileCount.textContent = `${readyProfiles.length} / ${profiles.length}`;
  elements.adminReadyProfileCaption.textContent = profiles.length ? `${profiles.length - readyProfiles.length} profile${profiles.length - readyProfiles.length === 1 ? "" : "s"} need workflow attention` : "Create an extraction profile to begin";
  elements.adminScheduleCount.textContent = scheduledProfiles.length;
  elements.adminScheduleCaption.textContent = scheduledProfiles.length ? `${scheduledProfiles.length} recurring report${scheduledProfiles.length === 1 ? "" : "s"} active` : "No automated jobs enabled";
  elements.adminDeliveryState.textContent = deliveryTitle;
  elements.adminDeliveryCaption.textContent = deliveryCaption;
  elements.adminUserCount.textContent = state.adminUsers.filter((user) => !user.disabled).length;
  elements.adminUserCaption.textContent = `${state.adminUsers.length} user${state.adminUsers.length === 1 ? "" : "s"} configured`;

  elements.adminProfileHealth.innerHTML = profiles.length ? profiles.map((profile) => {
    const ready = hasExtractionSteps(profile);
    return `<article class="operation-row"><span class="operation-indicator ${ready ? "good" : "warning"}"></span><div><strong>${escapeHtml(profile.name)}</strong><small>${escapeHtml(ready ? extractionProfileName(profile.extractionProfileId, profile.extractionName || "Linked workflow") : "Link an extraction workflow before running")}</small></div><button class="text-action" type="button" data-open-profile="${escapeHtml(profile.id)}">${ready ? "Review" : "Configure"}</button></article>`;
  }).join("") : `<p class="history-empty">No extraction profiles configured.</p>`;

  elements.adminScheduleList.innerHTML = profiles.length ? profiles.map((profile) => {
    const schedule = profileSchedule(profile);
    return `<article class="operation-row"><span class="operation-indicator ${schedule.active ? "good" : "muted"}"></span><div><strong>${escapeHtml(profile.name)}</strong><small>${escapeHtml(schedule.detail)}</small></div><button class="text-action" type="button" data-configure-profile="${escapeHtml(profile.id)}">${escapeHtml(schedule.label)}</button></article>`;
  }).join("") : `<p class="history-empty">No scheduled reports configured.</p>`;

  const runRows = runs.map((run) => {
    const status = runStatus(run);
    const started = formatDate(run.completedAt || run.updatedAt || run.createdAt);
    const detail = run.actualReportPeriod || [run.reportStartDate, run.reportEndDate].filter(Boolean).join(" to ") || "Report period not recorded";
    return `<article class="operation-row"><span class="operation-indicator ${status.className}"></span><div><strong>${escapeHtml(run.retailerName || "Extraction profile report")}</strong><small>${escapeHtml(detail)} Â· ${escapeHtml(started)}</small></div><span class="row-status ${status.className}">${status.label}</span></article>`;
  }).join("");
  elements.automationRunHistory.innerHTML = groupedRunHistoryMarkup(runs, {
    lifetime: state.isAdmin,
    emptyMessage: "No extraction activity recorded."
  });
  elements.automationRunSummary.textContent = `${runs.length} run${runs.length === 1 ? "" : "s"}`;

  const selectedRun = runs.find((run) => run.id === state.selectedExecutionRunId) || runs[0] || null;
  state.selectedExecutionRunId = selectedRun?.id || "";
  const adminRunRows = runs.map((run) => {
    const status = runStatus(run);
    const date = formatDate(run.completedAt || run.updatedAt || run.createdAt);
    const trigger = run.trigger === "scheduled" || run.trigger === "scheduled-companion" ? "Scheduled" : ["derived", "automatic-retry"].includes(run.trigger) ? "Automated" : "Manual";
    return `<article class="operation-row"><span class="operation-indicator ${status.className}"></span><div><strong>${escapeHtml(run.retailerName || "Extraction profile report")}</strong><small>${escapeHtml(trigger)} - ${escapeHtml(date)} - ${escapeHtml(run.message || "Run recorded")}</small></div><button class="text-action" type="button" data-view-run="${escapeHtml(run.id)}">View steps</button></article>`;
  }).join("");
  elements.adminRunHistory.innerHTML = groupedRunHistoryMarkup(allRuns.slice(0, 12), {
    lifetime: true,
    admin: true,
    emptyMessage: "No extraction activity recorded."
  });
  elements.adminRunSummary.textContent = `${Math.min(allRuns.length, 12)} run${Math.min(allRuns.length, 12) === 1 ? "" : "s"}`;
  renderExecutionRunDetail(selectedRun);

  renderReportDeliveries();
  renderAdminJobs();
}

function renderReportDeliveries() {
  const deliveries = reportFiles();
  const status = state.operationsWorkspace?.reportsStatus || "loading";
  const empty = status === "unavailable" ? "Reports could not be loaded. Retrying shortly."
    : status === "restricted" ? "Report downloads require an active admin account."
    : status === "loading" && !deliveries.length ? "Loading completed reports..."
    : "No completed reports are available.";
  const rows = deliveries.slice(0, 8).map(file => `<article class="operation-row"><span class="operation-indicator good"></span><div><strong>${escapeHtml(file.name || file.originalName || "Report")}</strong><small>${escapeHtml(file.retailerName || "Extraction profile")} - ${escapeHtml(formatDate(file.completedAt || file.uploadedAt || file.createdAt))}</small></div><button class="text-action" type="button" data-download-delivery="${escapeHtml(file.id)}">Download</button></article>`).join("");
  elements.automationDeliveryHistory.innerHTML = rows || `<p class="history-empty">${empty}</p>`;
  elements.adminDeliveryList.innerHTML = rows || `<p class="history-empty">${empty}</p>`;
  elements.adminDeliverySummary.textContent = `${deliveries.length} report${deliveries.length === 1 ? "" : "s"}`;
  const badge = document.getElementById("automationReportsState");
  if (badge) badge.textContent = status === "unavailable" ? "Unavailable" : status === "restricted" ? "Admin only" : deliveries.length ? "Nexus files" : status === "ready" ? "No reports" : "Loading";
}

function isActiveOperationRun(run) {
  return ["queued", "running", "waiting_otp", "waiting_for_otp", "waiting_approval", "cancelling"].includes(run?.status);
}

function operationRunOwnerKey(run) {
  if (run?.trigger === "scheduled" || run?.trigger === "scheduled-companion") return `scheduled:${run?.scheduledBy || run?.scheduledByEmail || "system"}`;
  return run?.createdBy || "system";
}

function operationRunOwnerLabel(run) {
  if (run?.trigger === "scheduled" || run?.trigger === "scheduled-companion") {
    return run?.scheduledByName || run?.scheduledByEmail || "Scheduled system";
  }
  return run?.createdByName || run?.createdByEmail || (run?.createdBy === "system" ? "System" : "Unknown user");
}

function operationRunBelongsToCurrentUser(run) {
  const uid = auth.currentUser?.uid || "";
  if (!uid || !run) return false;
  const ownerUid = run.trigger === "scheduled" || run.trigger === "scheduled-companion"
    ? run.scheduledBy
    : run.createdBy;
  return Boolean(ownerUid && ownerUid === uid);
}

function operationRunFilterStatus(run) {
  if (isActiveOperationRun(run)) return "active";
  if (run?.status === "completed") return "completed";
  if (run?.status === "completed_no_data" || run?.geoRepBlueprint?.noData) return "no-data";
  if (run?.status === "cancelled" || run?.status === "skipped_duplicate") return "aborted";
  return "attention";
}

function mergeRunDetail(summary, detail) {
  if (!summary || !detail || summary.id !== detail.id) return summary;
  const detailTimeline = Array.isArray(detail.executionTimeline) ? detail.executionTimeline : [];
  return { ...detail, ...summary, executionTimeline: detailTimeline.length ? detailTimeline : summary.executionTimeline };
}

function adminLiveJobMarkup(run) {
  const status = runStatus(run);
  const progress = describeExtractionProgress(run);
  const owner = operationRunOwnerLabel(run);
  const elapsed = formatElapsed(progress.elapsed || 0);
  const selected = run.id && run.id === state.selectedAdminJobRunId;
  return `<article class="operation-row admin-live-job${selected ? " selected" : ""}"><span class="operation-indicator ${status.className}"></span><div class="admin-live-job-main"><strong>${escapeHtml(run.retailerName || "Extraction profile report")}</strong><small>${escapeHtml(owner)} - ${escapeHtml(progress.stepLabel)} - ${escapeHtml(elapsed)}</small><div class="run-progress-track" aria-label="${escapeHtml(`${progress.progress}% complete`)}"><span style="width:${Math.max(2, Math.min(100, Number(progress.progress || 0)))}%"></span></div><small>${escapeHtml(progress.copy || run.message || "Working securely in the portal.")}</small></div><button class="text-action" type="button" data-admin-job-view="${escapeHtml(run.id)}">Open</button></article>`;
}

function renderAdminJobs() {
  if (!elements.adminJobList || !state.isAdmin) return;
  const runMap = new Map();
  const baseRuns = state.adminJobHistoryLoaded ? state.adminJobRuns : (state.operationsWorkspace?.runs || []);
  [...baseRuns, ...state.extractionRuns].forEach((run) => {
    if (run?.id) runMap.set(run.id, { ...(runMap.get(run.id) || {}), ...run });
  });
  const runs = [...runMap.values()]
    .sort((left, right) => Number(isActiveOperationRun(right)) - Number(isActiveOperationRun(left)) || latestRunActivityAt(right) - latestRunActivityAt(left));
  const activeRuns = runs.filter(isActiveOperationRun);
  const otherUsersActiveRuns = activeRuns.filter((run) => !operationRunBelongsToCurrentUser(run));
  if (elements.adminLiveJobSummary) {
    elements.adminLiveJobSummary.textContent = `${activeRuns.length} running`;
  }
  if (elements.adminLiveJobList) {
    elements.adminLiveJobList.innerHTML = activeRuns.length
      ? activeRuns.map(adminLiveJobMarkup).join("")
      : `<p class="history-empty">No active jobs are running.</p>`;
  }
  const ownerOptions = new Map();
  runs.forEach((run) => ownerOptions.set(operationRunOwnerKey(run), operationRunOwnerLabel(run)));
  const selectedOwner = elements.adminJobOwner.value;
  elements.adminJobOwner.innerHTML = `<option value="">All users</option>${[...ownerOptions.entries()].sort((left, right) => left[1].localeCompare(right[1])).map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("")}`;
  if (ownerOptions.has(selectedOwner)) elements.adminJobOwner.value = selectedOwner;

  const search = String(elements.adminJobSearch.value || "").trim().toLowerCase();
  const statusFilter = elements.adminJobStatus.value;
  const ownerFilter = elements.adminJobOwner.value;
  const filtered = runs.filter((run) => {
    if (statusFilter && operationRunFilterStatus(run) !== statusFilter) return false;
    if (ownerFilter && operationRunOwnerKey(run) !== ownerFilter) return false;
    if (!search) return true;
    return [run.retailerName, run.extractionName, run.createdByEmail, run.createdByName, run.scheduledByEmail, run.scheduledByName, run.status, run.message]
      .some((value) => String(value || "").toLowerCase().includes(search));
  });
  const activeCount = activeRuns.length;
  if (elements.adminEndAllActiveJobs) {
    elements.adminEndAllActiveJobs.disabled = activeCount === 0;
    elements.adminEndAllActiveJobs.textContent = activeCount ? `End ${activeCount} active job${activeCount === 1 ? "" : "s"}` : "No active jobs";
  }
  elements.adminJobSummary.textContent = `${filtered.length} shown / ${activeCount} active`;
  if (elements.adminJobSummaryLabel) elements.adminJobSummaryLabel.textContent = state.adminJobHistoryLoaded ? "All-user audit" : "Visible jobs";
  if (elements.adminJobAuditState) {
    elements.adminJobAuditState.textContent = state.adminJobHistoryError
      ? `Audit unavailable: ${state.adminJobHistoryError}`
      : state.adminJobHistoryLoaded
        ? `Organisation-wide history loaded: ${runs.length} jobs`
        : "Loading organisation audit...";
  }
  elements.adminJobList.innerHTML = groupedRunHistoryMarkup(filtered, {
    lifetime: true,
    admin: true,
    emptyMessage: "No jobs match the selected filters."
  });

  const selected = filtered.find((run) => run.id === state.selectedAdminJobRunId) || filtered.find(isActiveOperationRun) || filtered[0] || null;
  state.selectedAdminJobRunId = selected?.id || "";
  const detail = mergeRunDetail(selected, state.adminJobDetail);
  renderAdminJobDetail(detail);
}

async function loadOperationRunDetail(runId, target = "operator") {
  try {
    const result = await callFunction("getExtractionRunDetail", { runId });
    const run = result.run || null;
    if (target === "admin") {
      state.selectedAdminJobRunId = runId;
      state.adminJobDetail = run;
      renderAdminJobs();
    } else {
      state.operationsRunDetail = run;
      renderOperationsRunDetail(state.operationsRunDetail);
    }
    if (run && target !== "admin" && elements.automationLogDialog) {
      elements.automationLogTitle.textContent = operationRunLabel(run);
      elements.automationLogSubtitle.textContent = `${operationRunOwnerLabel(run)} - ${operationRunTiming(run)}`;
      elements.automationLogDetail.innerHTML = runDetailMarkup(run, "Execution detail");
      if (!elements.automationLogDialog.open) elements.automationLogDialog.showModal();
    }
  } catch (error) {
    showToast(`Could not load job log: ${friendlyError(error)}`, true);
  }
}

const nexusReadCache = window.NexusLoadCache.create({
  scope: () => state.isOperator && auth?.currentUser
    ? JSON.stringify([auth.currentUser.uid, nexusSessionGeneration, state.userRole, state.isAdmin, state.operationsWorkspace?.account || null])
    : "",
  fetch: async (name, data) => (await cloudFunctions.httpsCallable(name)(data)).data
});
async function callFunction(name, data, options = {}) {
  const result = await nexusReadCache.read(name, data, options);
  if (/^(save|delete|publish|rebuild|import|sync)/.test(name)) nexusReadCache.clear();
  return result;
}
function cachedDashboard(render, status) {
  return { onCached: (data, meta) => {
    render(data);
    if (status) {
      status.hidden = false;
      status.textContent = `Saved at ${new Date(meta.at).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}${meta.refreshing ? " / Checking for updates..." : ""}`;
    }
  } };
}
document.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (button && (/refresh/i.test(button.id) || button.dataset.foAction === "refresh" || button.dataset.command === "refresh")) nexusReadCache.clear();
}, true);

function waitForNexusOperatorSession(timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const check = () => {
      if (cloudFunctions && state.isOperator && auth?.currentUser) {
        resolve();
        return true;
      }
      if (state.authResolved && !auth?.currentUser) {
        reject(new Error("Sign in to Nexus to load Sales Insights."));
        return true;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error("Your Nexus session is still loading. Refresh the page and try again."));
        return true;
      }
      return false;
    };
    if (check()) return;
    const timer = window.setInterval(() => {
      if (check()) window.clearInterval(timer);
    }, 125);
  });
}

// The supplied Sales Insights dashboard runs in a same-origin frame so its
// original layout and page logic remain intact. It can only retrieve data
// through this authenticated Firebase bridge; it has no direct API access.
window.addEventListener("message", async (event) => {
  if (event.origin !== window.location.origin) return;
  const message = event.data || {};
  if (message.type !== "nexus-insights-api") return;
  const frame = salesInsightsSourceFrame();
  if (!frame || event.source !== frame.contentWindow) return;
  const responseTarget = event.source;
  const requestId = String(message.requestId || "").slice(0, 160);
  const route = String(message.route || "").slice(0, 80);
  if (!requestId || !route) return;
  try {
    await waitForNexusOperatorSession();
    const data = await callFunction("getSalesInsightsRoute", {
      route,
      params: message.params && typeof message.params === "object" ? message.params : {}
    });
    responseTarget?.postMessage({ type: "nexus-insights-api-response", requestId, ok: true, data }, event.origin);
  } catch (error) {
    responseTarget?.postMessage({ type: "nexus-insights-api-response", requestId, ok: false, error: friendlyError(error) }, event.origin);
  }
});

function salesDashboardNumber(value) {
  return Number(value || 0).toLocaleString("en-ZA", { maximumFractionDigits: 0 });
}

function salesDashboardCurrency(value) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function renderSalesDashboardOptions(select, values, placeholder) {
  // Source-derived Insights pages do not all expose the same filter controls.
  if (!select) return;
  const selected = select.value;
  select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>${values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
  if (values.includes(selected)) select.value = selected;
}

function renderSalesDashboardBars(container, rows, formatter = salesDashboardCurrency) {
  if (!rows?.length) { container.innerHTML = `<p class="history-empty">No matching sales data.</p>`; return; }
  const max = Math.max(...rows.map((row) => Math.max(Number(row.value || 0), Number(row.quantity || 0))), 1);
  container.innerHTML = rows.map((row) => {
    const amount = Number(row.value || 0) || Number(row.quantity || 0);
    const width = Math.max(3, Math.round((amount / max) * 100));
    return `<div class="sales-bar-row"><div><strong title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</strong><span>${formatter(amount)} Â· ${salesDashboardNumber(row.orders || 0)} orders</span></div><i><b style="width:${width}%"></b></i></div>`;
  }).join("");
}

function stockFixNumber(value, decimals = 0) {
  return Number(value || 0).toLocaleString("en-ZA", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function stockFixPercent(value) {
  return `${Number(value || 0).toLocaleString("en-ZA", { maximumFractionDigits: 1 })}%`;
}

function stockFixDelta(current, previous, { suffix = "", decimals = 0, lowerIsGood = false } = {}) {
  if (!previous && previous !== 0) return "flat vs prior";
  const difference = Number(current || 0) - Number(previous || 0);
  const formatted = Math.abs(difference).toLocaleString("en-ZA", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  if (!difference) return "flat vs prior";
  const direction = difference > 0 ? "up" : "down";
  const good = lowerIsGood ? difference < 0 : difference > 0;
  return `${good ? "" : ""}${direction === "up" ? "+" : "-"}${formatted}${suffix} vs prior`;
}

function setStockFixSelectOptions(select, rows = [], fallbackLabel = "All") {
  if (!select) return;
  const previous = select.value;
  const values = [...new Set(rows.map((row) => row.label).filter(Boolean))].sort((left, right) => String(left).localeCompare(String(right)));
  select.innerHTML = `<option value="">${escapeHtml(fallbackLabel)}</option>${values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
  if (values.includes(previous)) select.value = previous;
}

function refreshStockFixFilterOptions(data) {
  const charts = data?.charts || {};
  setStockFixSelectOptions(elements.stockFixClient, charts.byClient || [], "All clients");
  setStockFixSelectOptions(elements.stockFixBanner, charts.byBanner || [], "All banners");
  setStockFixSelectOptions(elements.stockFixRegion, charts.byRegion || [], "All regions");
  setStockFixSelectOptions(elements.stockFixClassification, charts.byClassification || [], "All classifications");
  setStockFixSelectOptions(elements.stockFixResourceType, charts.byResourceType || [], "All resource types");
  setStockFixSelectOptions(elements.stockFixActionStatus, charts.byActionStatus || [], "All action statuses");
}

function renderStockFixBars(container, rows, suffix = "tasks") {
  if (!container) return;
  if (!rows?.length) { container.innerHTML = `<p class="history-empty">No Stock Fix data for the selected week.</p>`; return; }
  const max = Math.max(...rows.map((row) => Number(row.value || 0)), 1);
  container.innerHTML = rows.map((row) => {
    const value = Number(row.value || 0);
    const width = Math.max(3, Math.round((value / max) * 100));
    return `<div class="sales-bar-row"><div><strong title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</strong><span>${stockFixNumber(value)} ${escapeHtml(suffix)}</span></div><i><b style="width:${width}%"></b></i></div>`;
  }).join("");
}

function stockFixClassificationClass(label = "") {
  const key = String(label || "").toLowerCase();
  if (key.includes("optimal")) return "green";
  if (key.includes("over")) return "amber";
  if (key.includes("under")) return "blue";
  if (key.includes("out") || key.includes("oos")) return "red";
  if (key.includes("negative")) return "purple";
  if (key.includes("not listed") || key.includes("notlisted")) return "violet";
  return "neutral";
}

function renderStockFixClassificationCards(rows = [], total = 0) {
  if (!elements.stockFixClassificationCards) return;
  if (!rows.length) {
    elements.stockFixClassificationCards.innerHTML = `<p class="history-empty">No Stock Fix classification data for the selected week.</p>`;
    return;
  }
  elements.stockFixClassificationCards.innerHTML = rows.slice(0, 8).map((row) => {
    const rowTotal = Number(row.total || 0);
    const share = total ? (rowTotal / total) * 100 : 0;
    const pending = Number(row.pending || 0);
    const rate = Number(row.captureRate || 0);
    const state = rate >= 85 ? "ok" : rate >= 55 ? "warn" : "bad";
    return `<article class="${stockFixClassificationClass(row.label)}"><span>${escapeHtml(row.label || "Unclassified")}</span><strong>${stockFixNumber(rowTotal)}</strong><small>${stockFixPercent(share)} of tasks - ${stockFixNumber(pending)} pending</small><footer><em>${escapeHtml(row.topReasonCode || "Not captured")}</em><b class="${state}">${stockFixPercent(rate)}</b></footer></article>`;
  }).join("");
}

function renderStockFixReasonDonut(rows = []) {
  if (!elements.stockFixReasonDonut) return;
  const selected = rows.filter((row) => Number(row.value || 0) > 0).slice(0, 6);
  if (!selected.length) {
    elements.stockFixReasonDonut.innerHTML = `<p class="history-empty">No reason-code data for the selected week.</p>`;
    return;
  }
  const palette = ["#ff9d32", "#63c5ff", "#77d39d", "#ffcf5c", "#b984ff", "#ff7474"];
  const total = selected.reduce((sum, row) => sum + Number(row.value || 0), 0) || 1;
  let start = 0;
  const stops = selected.map((row, index) => {
    const value = Number(row.value || 0);
    const end = start + (value / total) * 100;
    const stop = `${palette[index % palette.length]} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
    start = end;
    return stop;
  }).join(",");
  const legend = selected.map((row, index) => {
    const value = Number(row.value || 0);
    return `<div><span><i style="background:${palette[index % palette.length]}"></i>${escapeHtml(row.label || "Not captured")}</span><strong>${stockFixPercent((value / total) * 100)}</strong></div>`;
  }).join("");
  elements.stockFixReasonDonut.innerHTML = `<div class="stockfix-donut" style="background:conic-gradient(${stops});"><b>${stockFixNumber(total)}</b><span>tasks</span></div><div class="stockfix-donut-legend">${legend}</div>`;
}

function renderStockFixClassificationSummary(rows = []) {
  if (!elements.stockFixClassificationSummary) return;
  elements.stockFixClassificationSummary.innerHTML = rows.length
    ? rows.slice(0, 12).map((row) => `<tr><td>${escapeHtml(row.label || "Unclassified")}</td><td>${stockFixNumber(row.total)}</td><td>${stockFixNumber(row.captured)}</td><td>${stockFixNumber(row.pending)}</td><td><span class="stockfix-rate ${Number(row.captureRate || 0) >= 85 ? "good" : Number(row.captureRate || 0) >= 55 ? "warn" : "bad"}">${stockFixPercent(row.captureRate)}</span></td><td>${escapeHtml(row.topReasonCode || "Not captured")}</td></tr>`).join("")
    : `<tr><td colspan="6">No Stock Fix classification data for this week.</td></tr>`;
}

function stockFixMiniIcon(name) {
  const icons = {
    tasks: `<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"></path>`,
    check: `<path d="M20 6 9 17l-5-5"></path>`,
    clock: `<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>`,
    percent: `<path d="M19 5 5 19"></path><circle cx="6.5" cy="6.5" r="2"></circle><circle cx="17.5" cy="17.5" r="2"></circle>`,
    store: `<path d="M4 10h16v10H4zM3 10l2-6h14l2 6"></path>`,
    users: `<path d="M16 21v-2a4 4 0 0 0-8 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6 10v-2a3 3 0 0 0-2-2.8"></path>`,
    trend: `<path d="M4 19V5m0 14h16M8 15l3-3 3 2 5-7"></path>`,
    box: `<path d="M21 16V8l-9-5-9 5v8l9 5 9-5Z"></path><path d="m3.3 7.8 8.7 5 8.7-5M12 22V12"></path>`
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.tasks}</svg>`;
}

function renderStockFixKpiCards(container, cards = []) {
  if (!container) return;
  container.innerHTML = cards.map((card) => `<article class="${escapeHtml(card.className || "")}"><i>${stockFixMiniIcon(card.icon)}</i><div><span>${escapeHtml(card.label)}</span><strong title="${escapeHtml(card.value)}">${escapeHtml(card.value)}</strong><small>${escapeHtml(card.note || "")}</small></div></article>`).join("");
}

function stockFixRollupMetrics(rows = []) {
  const tasksAssigned = rows.reduce((sum, row) => sum + Number(row.tasksAssigned || 0), 0);
  const tasksCaptured = rows.reduce((sum, row) => sum + Number(row.tasksCaptured || 0), 0);
  const storesAssigned = rows.reduce((sum, row) => sum + Number(row.storesAssigned || 0), 0);
  const storesCaptured = rows.reduce((sum, row) => sum + Number(row.storesCaptured || 0), 0);
  return {
    tasksAssigned,
    tasksCaptured,
    storesAssigned,
    storesCaptured,
    taskRate: tasksAssigned ? (tasksCaptured / tasksAssigned) * 100 : 0,
    storeRate: storesAssigned ? (storesCaptured / storesAssigned) * 100 : 0
  };
}

function stockFixGroupLeaderboard(rows = [], key) {
  const groups = new Map();
  rows.forEach((row) => {
    const label = row[key] || "Unmapped";
    const current = groups.get(label) || { label, rows: [] };
    current.rows.push(row);
    groups.set(label, current);
  });
  return [...groups.values()].map((group) => ({ label: group.label, ...stockFixRollupMetrics(group.rows) }))
    .sort((left, right) => Number(right.taskRate || 0) - Number(left.taskRate || 0) || Number(right.tasksCaptured || 0) - Number(left.tasksCaptured || 0));
}

function renderStockFixRankList(container, rows = [], metric = "taskRate") {
  if (!container) return;
  if (!rows.length) {
    container.innerHTML = `<p class="history-empty">No leaderboard data yet.</p>`;
    return;
  }
  container.innerHTML = rows.slice(0, 8).map((row, index) => {
    const rate = Number(row[metric] || 0);
    return `<div class="stockfix-rank-row"><b>${index + 1}</b><div><strong title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</strong><span>${stockFixNumber(row.tasksCaptured)} of ${stockFixNumber(row.tasksAssigned)} tasks captured</span></div><em>${stockFixPercent(rate)}</em></div>`;
  }).join("");
}

function renderStockFixLeaderboard(data) {
  const feed = data?.leaderboardFeed || {};
  const rows = Array.isArray(feed.rows) ? feed.rows : [];
  const currentRows = rows.filter((row) => row.week === data.selectedWeek);
  const notice = document.querySelector("#stockFixLeaderboardNotice");
  if (notice) {
    notice.hidden = !!rows.length;
    notice.textContent = rows.length ? "" : `Leaderboard rollup is not published yet.${feed.error ? ` ${feed.error}` : ""}`;
  }
  const kpiContainer = document.querySelector("#stockFixLeaderboardKpis");
  if (!rows.length) {
    renderStockFixKpiCards(kpiContainer, []);
    renderStockFixRankList(document.querySelector("#stockFixTopManagers"), []);
    renderStockFixRankList(document.querySelector("#stockFixTopReps"), []);
    return;
  }
  const metrics = stockFixRollupMetrics(currentRows);
  const managers = stockFixGroupLeaderboard(currentRows, "manager");
  const reps = stockFixGroupLeaderboard(currentRows, "rep");
  const regions = stockFixGroupLeaderboard(currentRows, "region");
  renderStockFixKpiCards(kpiContainer, [
    { icon: "users", className: "blue", label: "Total reps", value: stockFixNumber(new Set(currentRows.map((row) => row.rep).filter(Boolean)).size), note: "Assigned this week" },
    { icon: "users", className: "purple", label: "Managers", value: stockFixNumber(new Set(currentRows.map((row) => row.manager).filter(Boolean)).size), note: "Across selected week" },
    { icon: "store", className: "orange", label: "Store capture", value: stockFixPercent(metrics.storeRate), note: `${stockFixNumber(metrics.storesCaptured)} of ${stockFixNumber(metrics.storesAssigned)} stores` },
    { icon: "percent", className: "green", label: "Task capture", value: stockFixPercent(metrics.taskRate), note: `${stockFixNumber(metrics.tasksCaptured)} of ${stockFixNumber(metrics.tasksAssigned)} tasks` },
    { icon: "trend", className: "amber", label: "Top region", value: regions[0]?.label || "-", note: regions[0] ? `${stockFixPercent(regions[0].taskRate)} tasks captured` : "No region data" },
    { icon: "check", className: "green", label: "Best manager", value: managers[0]?.label || "-", note: managers[0] ? `${stockFixPercent(managers[0].taskRate)} tasks captured` : "No manager data" }
  ]);
  renderStockFixRankList(document.querySelector("#stockFixTopManagers"), managers);
  renderStockFixRankList(document.querySelector("#stockFixTopReps"), reps);
  const weeks = (data.availableWeeks || []).slice(-4);
  const head = document.querySelector("#stockFixRegionHeatmapHead");
  const body = document.querySelector("#stockFixRegionHeatmapRows");
  const label = document.querySelector("#stockFixLeaderboardWeeks");
  if (label) label.textContent = weeks.map((week) => week.week).join(" to ");
  if (!head || !body) return;
  head.innerHTML = `<tr><th>Region</th>${weeks.map((week) => `<th colspan="2">${escapeHtml(week.week)}</th>`).join("")}</tr><tr><th></th>${weeks.map(() => `<th>% Stores</th><th>% Tasks</th>`).join("")}</tr>`;
  const regionNames = [...new Set(rows.map((row) => row.region || "Unmapped"))].sort();
  body.innerHTML = regionNames.length ? regionNames.map((region) => {
    const cells = weeks.map((week) => {
      const values = stockFixRollupMetrics(rows.filter((row) => row.week === week.week && (row.region || "Unmapped") === region));
      const taskClass = values.taskRate >= 20 ? "good" : values.taskRate >= 8 ? "warn" : values.taskRate > 0 ? "bad" : "";
      const storeClass = values.storeRate >= 20 ? "good" : values.storeRate >= 8 ? "warn" : values.storeRate > 0 ? "bad" : "";
      return `<td><span class="stockfix-rate ${storeClass}">${stockFixPercent(values.storeRate)}</span></td><td><span class="stockfix-rate ${taskClass}">${stockFixPercent(values.taskRate)}</span></td>`;
    }).join("");
    return `<tr><td>${escapeHtml(region)}</td>${cells}</tr>`;
  }).join("") : `<tr><td colspan="${1 + weeks.length * 2}">No region leaderboard data yet.</td></tr>`;
}

function renderStockFixActionImpact(data) {
  const impact = data?.actionImpact || {};
  const notice = document.querySelector("#stockFixActionImpactNotice");
  if (notice) {
    notice.hidden = !!impact.available;
    notice.textContent = impact.available ? "" : (impact.reason || "Action Impact data is not available yet.");
  }
  const period = document.querySelector("#stockFixActionImpactPeriod");
  if (period) period.textContent = impact.available ? `${impact.baselineWeek} to ${impact.impactWeek}` : (impact.impactWeek || "Latest week");
  const metrics = impact.metrics || {};
  renderStockFixKpiCards(document.querySelector("#stockFixActionImpactKpis"), impact.available ? [
    { icon: "box", className: "blue", label: "Feedbacked SKUs", value: stockFixNumber(metrics.feedbackSkus), note: "Baseline feedback rows" },
    { icon: "check", className: "green", label: "Recovered", value: stockFixNumber(metrics.recovered), note: "Stock or sales improved" },
    { icon: "trend", className: "green", label: "Stock improved", value: stockFixNumber(metrics.stockImproved), note: `${stockFixNumber(metrics.sohCorrected)} SOH impact` },
    { icon: "trend", className: "orange", label: "Sales improved", value: stockFixNumber(metrics.salesImproved), note: `${stockFixNumber(metrics.salesUplift)} P4W impact` },
    { icon: "clock", className: "red", label: "Open follow-up", value: stockFixNumber(metrics.open), note: "Still not recovered" },
    { icon: "store", className: "purple", label: "Impacted stores", value: stockFixNumber(metrics.impactedStores), note: "Recovered stores" }
  ] : []);
  renderStockFixBars(document.querySelector("#stockFixIssueRecovery"), (impact.issueSummary || []).map((row) => ({ label: row.label, value: row.recovered || 0 })), "recovered");
  const articleRows = (rows = [], suffix = "") => rows.length ? rows.map((row) => `<tr><td title="${escapeHtml(row.article || row.barcode || "-")}">${escapeHtml(row.article || row.barcode || "-")}</td><td>${escapeHtml(row.topIssue || "-")}</td><td>${stockFixNumber(row.storesImproved)}</td><td>${stockFixNumber(row.totalImpact)}${suffix}</td></tr>`).join("") : "";
  const stockBody = document.querySelector("#stockFixStockArticles");
  if (stockBody) stockBody.innerHTML = articleRows(impact.stockArticles || []) || `<tr><td colspan="4">No improved stock articles yet.</td></tr>`;
  const salesBody = document.querySelector("#stockFixSalesArticles");
  if (salesBody) salesBody.innerHTML = articleRows(impact.salesArticles || []) || `<tr><td colspan="4">No improved sales articles yet.</td></tr>`;
  const followups = impact.followups || [];
  const followBody = document.querySelector("#stockFixActionFollowups");
  if (followBody) followBody.innerHTML = followups.length ? followups.slice(0, 30).map((row) => `<tr><td>${escapeHtml(row.store || "-")}</td><td title="${escapeHtml(row.article || row.barcode || "-")}">${escapeHtml(row.article || row.barcode || "-")}</td><td>${escapeHtml(row.issue || "-")}</td><td>${stockFixNumber(row.baseSoh)}</td><td>${stockFixNumber(row.latestSoh)}</td></tr>`).join("") : `<tr><td colspan="5">No open follow-ups yet.</td></tr>`;
}

function renderStockFixFocus(data) {
  if (!elements.stockFixFocus) return;
  const classifications = data?.classificationSummary || [];
  const metrics = data?.metrics || {};
  const top = classifications[0];
  if (!top) {
    elements.stockFixFocus.textContent = "Load Stock Fix data to see the weekly focus area.";
    return;
  }
  const share = Number(metrics.tasks || 0) ? (Number(top.total || 0) / Number(metrics.tasks || 0)) * 100 : 0;
  elements.stockFixFocus.innerHTML = `Focus this week: <b>${escapeHtml(top.label)}</b> accounts for <b>${stockFixPercent(share)}</b> of the selected workload with <b>${stockFixNumber(top.pending)}</b> pending tasks. Top reason: <b>${escapeHtml(top.topReasonCode || "Not captured")}</b>.`;
}

function renderStockFixWeekOptions(weeks = [], selectedWeek = "") {
  if (!elements.stockFixWeek) return;
  const current = elements.stockFixWeek.value || selectedWeek;
  elements.stockFixWeek.innerHTML = `<option value="">Latest week</option>${weeks.map((week) => `<option value="${escapeHtml(week.week)}">${escapeHtml(week.week)} (${stockFixNumber(week.rowCount)} rows)</option>`).join("")}`;
  if (weeks.some((week) => week.week === current)) elements.stockFixWeek.value = current;
}

function renderStockFixDashboard() {
  const data = state.stockFixDashboardData;
  if (!elements.stockFixStatus) return;
  if (!data) {
    elements.stockFixStatus.textContent = "Sign in to Nexus to load Stock Fix reporting data.";
    return;
  }
  const metrics = data.metrics || {};
  const prior = data.priorMetrics || {};
  const charts = data.charts || {};
  renderStockFixWeekOptions(data.availableWeeks || [], data.selectedWeek || "");
  refreshStockFixFilterOptions(data);
  const sourceProvider = data.source?.provider || "SharePoint";
  const isFirebaseStockFix = data.source?.migrationMode === "firebase";
  if (elements.stockFixSubtitle) elements.stockFixSubtitle.textContent = `${isFirebaseStockFix ? "Firebase reporting feed" : "Live SharePoint feed"} - ${stockFixNumber(data.totalWeeks || data.availableWeeks?.length || 0)} weeks tracked`;
  if (elements.stockFixLatestWeek) elements.stockFixLatestWeek.textContent = `Latest: ${data.latestWeek || data.selectedWeek || "unavailable"}`;
  if (elements.stockFixSourceLink) {
    const sourceUrl = data.source?.folderUrl || "";
    elements.stockFixSourceLink.hidden = !sourceUrl;
    if (sourceUrl) {
      elements.stockFixSourceLink.href = sourceUrl;
      elements.stockFixSourceLink.textContent = "Open SharePoint source";
    }
  }
  elements.stockFixStatus.textContent = data.available === false
    ? (data.message || "No Nexus Stock Fix reporting week has been published yet.")
    : `Loaded Stock Fix week ${data.selectedWeek || "latest"} from ${sourceProvider}. ${stockFixNumber(data.sourceRowCount || 0)} rows read.`;
  elements.stockFixTasks.textContent = stockFixNumber(metrics.tasks);
  if (elements.stockFixTasksDelta) elements.stockFixTasksDelta.textContent = stockFixDelta(metrics.tasks, prior.tasks, { lowerIsGood: true });
  elements.stockFixCaptured.textContent = stockFixNumber(metrics.captured);
  if (elements.stockFixCapturedDelta) elements.stockFixCapturedDelta.textContent = stockFixDelta(metrics.captured, prior.captured);
  elements.stockFixCaptureRate.textContent = stockFixPercent(metrics.captureRate);
  if (elements.stockFixCaptureRateDelta) elements.stockFixCaptureRateDelta.textContent = stockFixDelta(metrics.captureRate, prior.captureRate, { suffix: " pts", decimals: 1 });
  elements.stockFixPending.textContent = stockFixNumber(metrics.pending);
  if (elements.stockFixPendingDelta) elements.stockFixPendingDelta.textContent = stockFixDelta(metrics.pending, prior.pending, { lowerIsGood: true });
  elements.stockFixStores.textContent = stockFixNumber(metrics.stores);
  if (elements.stockFixSkus) elements.stockFixSkus.textContent = stockFixNumber(metrics.skus);
  if (elements.stockFixReps) elements.stockFixReps.textContent = stockFixNumber(metrics.reps);
  if (elements.stockFixClients) elements.stockFixClients.textContent = stockFixNumber(metrics.clients);
  if (elements.stockFixMissedSales) elements.stockFixMissedSales.textContent = stockFixNumber(metrics.missedSales, 1);
  renderStockFixFocus(data);
  renderStockFixClassificationCards(data.classificationSummary || [], Number(metrics.tasks || 0));
  renderStockFixReasonDonut(charts.byReasonCode || []);
  renderStockFixClassificationSummary(data.classificationSummary || []);
  renderStockFixBars(elements.stockFixClientsChart, charts.byClient, "tasks");
  renderStockFixBars(elements.stockFixManagerChart, charts.byManager, "tasks");
  renderStockFixBars(elements.stockFixRepChart, charts.byRep, "tasks");
  renderStockFixBars(elements.stockFixRegionChart, charts.byRegion, "tasks");
  renderStockFixBars(elements.stockFixResourceTypeChart, charts.byResourceType, "tasks");
  renderStockFixBars(elements.stockFixStatusChart, charts.byActionStatus, "tasks");
  renderStockFixLeaderboard(data);
  renderStockFixActionImpact(data);
  const rows = data.rows || [];
  if (elements.stockFixRowsCount) elements.stockFixRowsCount.textContent = `${stockFixNumber(rows.length)} shown / ${stockFixNumber(metrics.tasks)} rows`;
  if (elements.stockFixRowsTable) {
    elements.stockFixRowsTable.innerHTML = rows.length ? rows.map((row) => `<tr><td>${escapeHtml(row.client)}</td><td>${escapeHtml(row.banner)}</td><td>${escapeHtml(row.region)}</td><td>${escapeHtml(row.store)}</td><td>${escapeHtml(row.rep)}</td><td>${escapeHtml(row.manager)}</td><td>${escapeHtml(row.resourceType)}</td><td>${escapeHtml(row.article || row.barcode)}</td><td>${escapeHtml(row.classification)}</td><td>${escapeHtml(row.actionStatus)}</td><td>${escapeHtml(row.reasonCode)}</td><td>${stockFixNumber(row.missedSales, 1)}</td></tr>`).join("") : `<tr><td colspan="12">No Stock Fix detail rows for this week.</td></tr>`;
  }
}

async function loadStockFixDashboard() {
  const generation = nexusSessionGeneration;
  if (!state.isOperator || state.stockFixDashboardLoading) return;
  state.stockFixDashboardLoading = true;
  if (elements.stockFixStatus) elements.stockFixStatus.textContent = "Loading Stock Fix reporting data...";
  if (elements.stockFixRefresh) elements.stockFixRefresh.disabled = true;
  try {
    state.stockFixDashboardData = await callFunction("getStockFixDashboard", {
      week: elements.stockFixWeek?.value || "",
      client: elements.stockFixClient?.value || "",
      banner: elements.stockFixBanner?.value || "",
      region: elements.stockFixRegion?.value || "",
      classification: elements.stockFixClassification?.value || "",
      resourceType: elements.stockFixResourceType?.value || "",
      actionStatus: elements.stockFixActionStatus?.value || "",
      search: elements.stockFixSearch?.value || ""
    }, cachedDashboard(data => { state.stockFixDashboardData = data; renderStockFixDashboard(); }, elements.stockFixStatus));
    renderStockFixDashboard();
  } catch (error) {
    if (generation !== nexusSessionGeneration || error.code === "cancelled") return;
    if (window.NexusLoadCache.denied(error)) {
      state.stockFixDashboardData = {}; renderStockFixDashboard(); state.stockFixDashboardData = null;
    }
    if (elements.stockFixStatus) elements.stockFixStatus.textContent = `Could not load Stock Fix data: ${friendlyError(error)}`;
    showToast(`Could not load Stock Fix data: ${friendlyError(error)}`, true);
  } finally {
    if (generation === nexusSessionGeneration) {
      state.stockFixDashboardLoading = false;
      if (elements.stockFixRefresh) elements.stockFixRefresh.disabled = false;
    }
  }
}

function setStockFixFieldOptions(select, values = [], placeholder = "All") {
  if (!select) return;
  const selected = select.value || "";
  select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>${values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
  if (values.includes(selected)) select.value = selected;
}

function stockFixFieldMetric(value, suffix = "") {
  return `${stockFixNumber(value)}${suffix}`;
}

function resetStockFixOperationalDetail() {
  state.stockFixOperationalSelectedTask = null;
  if (elements.stockFixFieldDetail) elements.stockFixFieldDetail.hidden = true;
  if (elements.stockFixFieldEmpty) elements.stockFixFieldEmpty.hidden = false;
  if (elements.stockFixFieldCaptureForm) elements.stockFixFieldCaptureForm.reset();
  if (elements.stockFixFieldEvidencePreview) elements.stockFixFieldEvidencePreview.innerHTML = "";
  document.querySelectorAll(".stockfix-field-task.active").forEach((item) => item.classList.remove("active"));
}

function renderStockFixOperationalWorkspace() {
  const data = state.stockFixOperationalData;
  if (!data) return;
  setStockFixFieldOptions(elements.stockFixFieldWeek, (data.weeks || []).map((item) => item.week), "Latest published week");
  if (elements.stockFixFieldWeek && data.selectedWeek) elements.stockFixFieldWeek.value = data.selectedWeek;
  setStockFixFieldOptions(elements.stockFixFieldRep, data.filters?.reps || [], "All assigned reps");
  setStockFixFieldOptions(elements.stockFixFieldStore, data.filters?.stores || [], "All assigned stores");
  if (elements.stockFixFieldStatus && !["", "Pending", "Completed"].includes(elements.stockFixFieldStatus.value)) elements.stockFixFieldStatus.value = "";
  const summary = data.summary || {};
  if (elements.stockFixFieldKpis) elements.stockFixFieldKpis.innerHTML = [
    ["Tasks", stockFixFieldMetric(summary.tasks)],
    ["Pending", stockFixFieldMetric(summary.pending)],
    ["Completed", stockFixFieldMetric(summary.completed)],
    ["Capture rate", stockFixPercent(summary.captureRate)]
  ].map(([label, value]) => `<article><span>${label}</span><strong>${value}</strong></article>`).join("");
  if (elements.stockFixFieldStatusCopy) {
    elements.stockFixFieldStatusCopy.textContent = data.available
      ? `${data.assigned?.scope || "Nexus Stock Fix tasks"}. ${stockFixNumber(data.shownTasks || 0)} matching tasks shown for ${data.selectedWeek}.`
      : (data.message || "No Nexus Stock Fix task week has been published.");
  }
  if (elements.stockFixFieldListTitle) elements.stockFixFieldListTitle.textContent = data.available ? `Tasks for ${data.selectedWeek}` : "No published task week";
  if (elements.stockFixFieldTaskCount) elements.stockFixFieldTaskCount.textContent = `${stockFixNumber(data.shownTasks || 0)} tasks`;
  const tasks = data.tasks || [];
  if (elements.stockFixFieldTaskList) elements.stockFixFieldTaskList.innerHTML = tasks.length
    ? tasks.map((task) => `<button class="stockfix-field-task ${task.actionStatus === "Completed" ? "completed" : ""}" data-stockfix-field-task="${escapeHtml(task.id)}" type="button"><i></i><div><strong>${escapeHtml(task.store || "Unmapped store")}</strong><span>${escapeHtml(task.article || task.barcode || "Unmapped product")} - ${escapeHtml(task.classification || "Stock Fix")}</span></div><em>${escapeHtml(task.actionStatus || "Pending")}</em></button>`).join("")
    : `<p class="history-empty">${data.available ? "No assigned tasks match these filters." : "Upload and publish a Stock Fix weekly source in Admin to create Nexus tasks."}</p>`;
  if (state.stockFixOperationalSelectedTask && !tasks.some((task) => task.id === state.stockFixOperationalSelectedTask.id)) resetStockFixOperationalDetail();
}

async function loadStockFixOperationalWorkspace({ quiet = false } = {}) {
  if (!elements.stockFixFieldTaskList || state.stockFixOperationalLoading) return;
  state.stockFixOperationalLoading = true;
  if (elements.stockFixFieldRefresh) elements.stockFixFieldRefresh.disabled = true;
  try {
    state.stockFixOperationalData = await callFunction("getStockFixOperationalWorkspace", {
      week: elements.stockFixFieldWeek?.value || "",
      rep: elements.stockFixFieldRep?.value || "",
      store: elements.stockFixFieldStore?.value || "",
      status: elements.stockFixFieldStatus?.value || "",
      search: elements.stockFixFieldSearch?.value || ""
    });
    renderStockFixOperationalWorkspace();
  } catch (error) {
    if (elements.stockFixFieldStatusCopy) elements.stockFixFieldStatusCopy.textContent = `Could not load Nexus Stock Fix tasks: ${friendlyError(error)}`;
    if (!quiet) showToast(`Could not load Nexus Stock Fix tasks: ${friendlyError(error)}`, true);
  } finally {
    state.stockFixOperationalLoading = false;
    if (elements.stockFixFieldRefresh) elements.stockFixFieldRefresh.disabled = false;
  }
}

function renderStockFixOperationalTaskDetail(task, options = {}) {
  if (!task) return;
  state.stockFixOperationalSelectedTask = task;
  if (elements.stockFixFieldDetail) elements.stockFixFieldDetail.hidden = false;
  if (elements.stockFixFieldEmpty) elements.stockFixFieldEmpty.hidden = true;
  if (elements.stockFixFieldTaskId) elements.stockFixFieldTaskId.value = task.id;
  if (elements.stockFixFieldTaskState) elements.stockFixFieldTaskState.textContent = task.actionStatus || "Pending";
  if (elements.stockFixFieldTaskSummary) elements.stockFixFieldTaskSummary.innerHTML = `<p>${escapeHtml(task.client || "STOCK FIX")}</p><h3>${escapeHtml(task.article || task.barcode || "Stock Fix task")}</h3><span>${escapeHtml(task.store || "Unmapped store")} - ${escapeHtml(task.region || "Unmapped region")} - ${escapeHtml(task.action || "Review stock position")}</span>`;
  if (elements.stockFixFieldStoreSoh) elements.stockFixFieldStoreSoh.textContent = stockFixFieldMetric(task.storeSoh);
  if (elements.stockFixFieldDcSoh) elements.stockFixFieldDcSoh.textContent = stockFixFieldMetric(task.dcSoh);
  if (elements.stockFixFieldP4Sales) elements.stockFixFieldP4Sales.textContent = stockFixFieldMetric(task.p4wSales);
  if (elements.stockFixFieldWfc) elements.stockFixFieldWfc.textContent = Number(task.wfc || 0).toFixed(1);
  setStockFixFieldOptions(elements.stockFixFieldReason, options.reasonCodes || state.stockFixOperationalData?.reasonCodes || [], "Choose the reason");
  setStockFixFieldOptions(elements.stockFixFieldActionTaken, options.actionTakenOptions || state.stockFixOperationalData?.actionTakenOptions || [], "Choose the action");
  if (elements.stockFixFieldPhysicalCount) elements.stockFixFieldPhysicalCount.value = task.physicalCount ?? "";
  if (elements.stockFixFieldSystemAdjusted) elements.stockFixFieldSystemAdjusted.value = task.systemAdjusted || "";
  if (elements.stockFixFieldReason) elements.stockFixFieldReason.value = task.reasonCode || "";
  if (elements.stockFixFieldActionTaken) elements.stockFixFieldActionTaken.value = task.actionTaken || "";
  if (elements.stockFixFieldFeedback) elements.stockFixFieldFeedback.value = task.feedback || "";
  if (elements.stockFixFieldEvidence) elements.stockFixFieldEvidence.value = "";
  if (elements.stockFixFieldEvidencePreview) elements.stockFixFieldEvidencePreview.innerHTML = (task.evidence || []).map((path) => `<span>Saved evidence: ${escapeHtml(String(path).split("/").pop() || "image")}</span>`).join("");
  const locked = task.actionStatus === "Completed";
  elements.stockFixFieldCaptureForm?.querySelectorAll("input,select,textarea,button").forEach((field) => { if (field.type !== "hidden") field.disabled = locked; });
  updateStockFixOperationalVariance();
  document.querySelectorAll(".stockfix-field-task").forEach((item) => item.classList.toggle("active", item.dataset.stockfixFieldTask === task.id));
}

function updateStockFixOperationalVariance() {
  const task = state.stockFixOperationalSelectedTask;
  if (!task || !elements.stockFixFieldVariance) return;
  const value = elements.stockFixFieldPhysicalCount?.value;
  if (value === "" || value === undefined) {
    elements.stockFixFieldVariance.classList.remove("warning");
    elements.stockFixFieldVariance.textContent = "Variance will appear after a shelf count is entered.";
    return;
  }
  const variance = Number(value) - Number(task.storeSoh || 0);
  elements.stockFixFieldVariance.classList.toggle("warning", variance !== 0);
  elements.stockFixFieldVariance.textContent = `Physical count variance: ${stockFixFieldMetric(variance)} units against system SOH.`;
}

async function openStockFixOperationalTask(taskId) {
  try {
    const result = await callFunction("getStockFixOperationalTask", { taskId });
    renderStockFixOperationalTaskDetail(result.task, result);
  } catch (error) {
    showToast(`Could not open Stock Fix task: ${friendlyError(error)}`, true);
  }
}

function renderStockFixOperationalEvidencePreview() {
  const files = [...(elements.stockFixFieldEvidence?.files || [])];
  if (elements.stockFixFieldEvidencePreview) elements.stockFixFieldEvidencePreview.innerHTML = files.map((file) => `<span>${escapeHtml(file.name)} (${formatBytes(file.size)})</span>`).join("");
}

async function completeStockFixOperationalTask(event) {
  event.preventDefault();
  const task = state.stockFixOperationalSelectedTask;
  const files = [...(elements.stockFixFieldEvidence?.files || [])];
  if (!task || !storage) return;
  if (!files.length || files.length > 4 || files.some((file) => !/^image\/(?:jpeg|png|webp|heic)$/i.test(file.type || "") || file.size > 12 * 1024 * 1024)) {
    showToast("Add between one and four JPG, PNG, WEBP or HEIC photos, each no larger than 12 MB.", true);
    return;
  }
  const submit = elements.stockFixFieldComplete;
  submit.disabled = true;
  try {
    const evidence = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const storagePath = `stockfix-evidence/${task.id}/${String(index + 1).padStart(2, "0")}-${uniqueId()}-${safeStorageName(file.name)}`;
      const upload = storage.ref(storagePath).put(file, { contentType: file.type, customMetadata: { taskId: task.id, source: "stockfix-field-capture" } });
      await new Promise((resolve, reject) => upload.on("state_changed", null, reject, resolve));
      evidence.push(storagePath);
    }
    const result = await callFunction("completeStockFixOperationalTask", {
      taskId: task.id,
      physicalCount: elements.stockFixFieldPhysicalCount?.value || "",
      systemAdjusted: elements.stockFixFieldSystemAdjusted?.value || "",
      reasonCode: elements.stockFixFieldReason?.value || "",
      actionTaken: elements.stockFixFieldActionTaken?.value || "",
      feedback: elements.stockFixFieldFeedback?.value || "",
      evidence
    });
    renderStockFixOperationalTaskDetail(result.task);
    await loadStockFixOperationalWorkspace({ quiet: true });
    showToast("Stock Fix task completed in Nexus.");
  } catch (error) {
    showToast(`Could not complete Stock Fix task: ${friendlyError(error)}`, true);
  } finally {
    if (state.stockFixOperationalSelectedTask?.actionStatus !== "Completed") submit.disabled = false;
  }
}

function setStockFixAdoptionOptions(select, values = [], placeholder) {
  if (!select) return;
  const current = select.value || "";
  select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>${values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
  if (values.includes(current)) select.value = current;
}

function renderStockFixAdoptionBars(container, rows = []) {
  if (!container) return;
  if (!rows.length) {
    container.innerHTML = `<p class="history-empty">No matching Adoption data.</p>`;
    return;
  }
  const max = Math.max(...rows.map((row) => Number(row.total || 0)), 1);
  container.innerHTML = rows.slice(0, 12).map((row) => {
    const adoption = Number(row.adoption || 0);
    const width = Math.max(2, Math.min(100, Math.round((Number(row.total || 0) / max) * 100)));
    return `<div class="stockfix-adoption-row"><div><strong title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</strong><span>${stockFixNumber(row.active)} of ${stockFixNumber(row.total)} active - ${stockFixNumber(row.captures)} captures</span></div><b>${stockFixPercent(adoption)}</b><i><em style="width:${width}%"></em></i></div>`;
  }).join("");
}

function renderStockFixAdoptionDashboard() {
  const data = state.stockFixAdoptionData;
  if (!data) return;
  const metrics = data.metrics || {};
  const filters = data.filters || {};
  const selectedWeek = data.selectedWeek || "";
  if (elements.stockFixAdoptionWeek) {
    const current = elements.stockFixAdoptionWeek.value || selectedWeek;
    elements.stockFixAdoptionWeek.innerHTML = `<option value="">Latest published snapshot</option>${(data.availableWeeks || []).map((week) => `<option value="${escapeHtml(week.week)}">${escapeHtml(week.week)} (${stockFixNumber(week.rowCount)} resources)</option>`).join("")}`;
    if ((data.availableWeeks || []).some((week) => week.week === current)) elements.stockFixAdoptionWeek.value = current;
  }
  setStockFixAdoptionOptions(elements.stockFixAdoptionResourceType, filters.resourceTypes || [], "All resource types");
  setStockFixAdoptionOptions(elements.stockFixAdoptionRegion, filters.regions || [], "All regions");
  setStockFixAdoptionOptions(elements.stockFixAdoptionManager, filters.managers || [], "All managers");
  if (elements.stockFixAdoptionRate) elements.stockFixAdoptionRate.textContent = stockFixPercent(metrics.adoption);
  if (elements.stockFixAdoptionSub) elements.stockFixAdoptionSub.textContent = `${stockFixNumber(metrics.active)} of ${stockFixNumber(metrics.resources)} resources active`;
  if (elements.stockFixAdoptionBar) elements.stockFixAdoptionBar.style.width = `${Math.max(0, Math.min(100, Number(metrics.adoption || 0)))}%`;
  if (elements.stockFixAdoptionRep) elements.stockFixAdoptionRep.textContent = stockFixPercent(metrics.rep?.adoption);
  if (elements.stockFixAdoptionRepSub) elements.stockFixAdoptionRepSub.textContent = `${stockFixNumber(metrics.rep?.active)} of ${stockFixNumber(metrics.rep?.total)} reps active`;
  if (elements.stockFixAdoptionMerch) elements.stockFixAdoptionMerch.textContent = stockFixPercent(metrics.merchandiser?.adoption);
  if (elements.stockFixAdoptionMerchSub) elements.stockFixAdoptionMerchSub.textContent = `${stockFixNumber(metrics.merchandiser?.active)} of ${stockFixNumber(metrics.merchandiser?.total)} merchandisers active`;
  if (elements.stockFixAdoptionActive) elements.stockFixAdoptionActive.textContent = stockFixNumber(metrics.active);
  if (elements.stockFixAdoptionActiveSub) elements.stockFixAdoptionActiveSub.textContent = `${stockFixNumber(metrics.resources)} resources in view`;
  if (elements.stockFixAdoptionCaptures) elements.stockFixAdoptionCaptures.textContent = stockFixNumber(metrics.captures);
  renderStockFixAdoptionBars(elements.stockFixAdoptionTypes, data.charts?.byResourceType || []);
  renderStockFixAdoptionBars(elements.stockFixAdoptionRegions, data.charts?.byRegion || []);
  renderStockFixAdoptionBars(elements.stockFixAdoptionManagers, data.charts?.byManager || []);
  const rows = data.resources || [];
  if (elements.stockFixAdoptionRowsCount) elements.stockFixAdoptionRowsCount.textContent = `${stockFixNumber(data.shownRows)} resources`;
  if (elements.stockFixAdoptionRows) elements.stockFixAdoptionRows.innerHTML = rows.length ? rows.map((row) => `<tr><td>${escapeHtml(row.resource)}</td><td>${escapeHtml(row.resourceType)}</td><td>${escapeHtml(row.region)}</td><td>${escapeHtml(row.manager)}</td><td>${stockFixNumber(row.captures)}</td><td>${stockFixPercent(row.adoption)}</td></tr>`).join("") : `<tr><td colspan="6">No matching Adoption resources.</td></tr>`;
  if (elements.stockFixAdoptionStatus) elements.stockFixAdoptionStatus.textContent = `Loaded Adoption snapshot ${selectedWeek} from ${data.source?.provider || "Firebase Storage"}: ${stockFixNumber(data.shownRows)} resources in view.`;
}

async function loadStockFixAdoptionDashboard() {
  if (!state.isAdmin || state.stockFixAdoptionLoading) return;
  state.stockFixAdoptionLoading = true;
  if (elements.stockFixAdoptionStatus) elements.stockFixAdoptionStatus.textContent = "Loading Stock Fix Adoption snapshot...";
  try {
    state.stockFixAdoptionData = await callFunction("getStockFixAdoptionDashboard", { week: elements.stockFixAdoptionWeek?.value || "", resourceType: elements.stockFixAdoptionResourceType?.value || "", region: elements.stockFixAdoptionRegion?.value || "", manager: elements.stockFixAdoptionManager?.value || "", search: elements.stockFixAdoptionSearch?.value || "" });
    renderStockFixAdoptionDashboard();
  } catch (error) {
    if (elements.stockFixAdoptionStatus) elements.stockFixAdoptionStatus.textContent = `Could not load Stock Fix Adoption: ${friendlyError(error)}`;
  } finally {
    state.stockFixAdoptionLoading = false;
  }
}

async function publishStockFixAdoptionWorkbook(event) {
  event.preventDefault();
  const file = elements.stockFixAdoptionSource?.files?.[0];
  const week = elements.stockFixAdoptionPublishWeek?.value || "";
  if (!week || !file || !/\.xlsx$/i.test(file.name || "") || !storage) return showToast("Choose a snapshot date and XLSX Adoption workbook.", true);
  if (file.size > 25 * 1024 * 1024) return showToast("The Adoption workbook must be 25 MB or smaller.", true);
  const uploadId = uniqueId();
  const storagePath = `stockfix-adoption-source/${uploadId}/${safeStorageName(file.name)}`;
  const submit = elements.stockFixAdoptionPublish;
  submit.disabled = true;
  if (elements.stockFixAdoptionPublishStatus) elements.stockFixAdoptionPublishStatus.textContent = "Uploading Adoption workbook...";
  try {
    const uploadTask = storage.ref(storagePath).put(file, { contentType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`, customMetadata: { uploadId, source: "stockfix-adoption" } });
    await new Promise((resolve, reject) => uploadTask.on("state_changed", (progress) => {
      const percent = progress.totalBytes ? Math.round(progress.bytesTransferred / progress.totalBytes * 100) : 0;
      if (elements.stockFixAdoptionPublishStatus) elements.stockFixAdoptionPublishStatus.textContent = `Uploading Adoption workbook: ${percent}%`;
    }, reject, resolve));
    if (Number(uploadTask.snapshot.metadata.size || 0) !== Number(file.size || 0)) throw new Error("The Adoption workbook upload could not be verified.");
    if (elements.stockFixAdoptionPublishStatus) elements.stockFixAdoptionPublishStatus.textContent = "Validating workbook and publishing the Adoption snapshot...";
    const result = await callFunction("publishStockFixAdoptionWorkbook", { week, uploadId, storagePath, sourceName: file.name });
    elements.stockFixAdoptionSource.value = "";
    if (elements.stockFixAdoptionPublishStatus) elements.stockFixAdoptionPublishStatus.textContent = `Published ${result.week}: ${stockFixNumber(result.rowCount)} resources ready for Adoption reporting.`;
    showToast(`Stock Fix Adoption snapshot ${result.week} is published.`);
    if (elements.stockFixAdoptionWeek) elements.stockFixAdoptionWeek.value = result.week;
    await loadStockFixAdoptionDashboard();
  } catch (error) {
    if (elements.stockFixAdoptionPublishStatus) elements.stockFixAdoptionPublishStatus.textContent = `Adoption publication failed: ${friendlyError(error)}`;
    showToast(`Adoption publication failed: ${friendlyError(error)}`, true);
  } finally {
    submit.disabled = false;
  }
}

function stockFixUploadSupportsFile(file) {
  return !!file && /\.(?:ndjson|json|jsonl|gz)$/i.test(file.name || "");
}

function renderStockFixFirebasePublishedWeeks(weeks = []) {
  if (!elements.stockFixFirebasePublishedWeeks) return;
  if (!weeks.length) {
    elements.stockFixFirebasePublishedWeeks.innerHTML = `<p class="history-empty">No Nexus Stock Fix reporting week has been published yet. Upload the approved source workbooks and start the Nexus Cloud Run pipeline.</p>`;
    return;
  }
  elements.stockFixFirebasePublishedWeeks.innerHTML = weeks.map((week) => {
    const note = [
      `${stockFixNumber(week.rowCount)} rows`,
      week.malformedRows ? `${stockFixNumber(week.malformedRows)} malformed ignored` : "validated",
      week.publishedAt ? `published ${formatDate(week.publishedAt)}` : "published"
    ].join(" - ");
    return `<article class="operation-row"><span class="operation-indicator good"></span><div><strong>${escapeHtml(week.week)}</strong><small>${escapeHtml(week.sourceName || "Firebase weekly source")}</small><small>${escapeHtml(note)}</small></div><span class="row-status">Published</span></article>`;
  }).join("");
}

async function loadStockFixFirebasePublishStatus({ quiet = false } = {}) {
  if (!state.isAdmin || state.stockFixFirebaseStatusLoading) return;
  state.stockFixFirebaseStatusLoading = true;
  if (elements.stockFixFirebasePublishStatus) elements.stockFixFirebasePublishStatus.textContent = "Loading Firebase Stock Fix publication history...";
  try {
    const result = await callFunction("getStockFixFirebaseStatus", {});
    const weeks = result?.weeks || [];
    renderStockFixFirebasePublishedWeeks(weeks);
    if (elements.stockFixFirebasePublishStatus) {
      elements.stockFixFirebasePublishStatus.textContent = weeks.length
        ? `${weeks.length} Nexus reporting week${weeks.length === 1 ? "" : "s"} available. The Stock Fix dashboard reads this Firebase source only.`
        : "No Nexus Stock Fix reporting week has been loaded yet. The dashboard remains unavailable until the Firebase pipeline publishes one.";
    }
  } catch (error) {
    if (elements.stockFixFirebasePublishStatus) elements.stockFixFirebasePublishStatus.textContent = `Could not load Firebase Stock Fix status: ${friendlyError(error)}`;
    if (!quiet) showToast(`Could not load Firebase Stock Fix status: ${friendlyError(error)}`, true);
  } finally {
    state.stockFixFirebaseStatusLoading = false;
  }
}

function renderStockFixSharePointAutomationStatus(data = {}) {
  if (!elements.stockFixSharePointSyncStatus) return;
  const source = data?.latestSource || {};
  const run = data?.run || {};
  const details = [];
  if (source.name) details.push(`Latest source: ${source.name}${source.week ? ` (${source.week})` : ""}.`);
  if (run.runId) details.push(`Pipeline ${run.runId} is ${run.status || "pending"}${run.week ? ` for ${run.week}` : ""}.`);
  if (data.lastCompletedWeek) details.push(`Last published week: ${data.lastCompletedWeek}${data.lastCompletedAt ? ` on ${formatDate(data.lastCompletedAt)}` : ""}.`);
  if (data.lastCheckedAt) details.push(`Last checked ${formatDate(data.lastCheckedAt)}.`);
  const message = data.message || (data.status === "not-checked"
    ? "The automatic SharePoint check has not run yet."
    : "SharePoint automation status is available.");
  elements.stockFixSharePointSyncStatus.textContent = [message, ...details].join(" ");
}

async function loadStockFixSharePointAutomationStatus({ quiet = false } = {}) {
  if (!state.isAdmin || state.stockFixAutomationStatusLoading || !elements.stockFixSharePointSyncStatus) return;
  state.stockFixAutomationStatusLoading = true;
  elements.stockFixSharePointSyncStatus.textContent = "Loading SharePoint Stock Fix automation status...";
  try {
    const result = await callFunction("getStockFixAutomationStatus", {});
    renderStockFixSharePointAutomationStatus(result || {});
  } catch (error) {
    elements.stockFixSharePointSyncStatus.textContent = `Could not load SharePoint Stock Fix automation status: ${friendlyError(error)}`;
    if (!quiet) showToast(`Could not load Stock Fix automation status: ${friendlyError(error)}`, true);
  } finally {
    state.stockFixAutomationStatusLoading = false;
  }
}

async function syncStockFixSharePointSource() {
  const button = elements.stockFixSharePointSyncNow;
  if (!button || !state.isAdmin) return;
  button.disabled = true;
  if (elements.stockFixSharePointSyncStatus) elements.stockFixSharePointSyncStatus.textContent = "Checking the approved SharePoint Stock Fix task export...";
  try {
    const result = await callFunction("syncStockFixSharePointSource", { force: false });
    renderStockFixSharePointAutomationStatus({
      ...result,
      message: result?.status === "queued"
        ? `Queued ${result.latest?.name || "the latest SharePoint task export"} for Firebase publishing.`
        : result?.status === "unchanged"
          ? `${result.latest?.name || "The latest SharePoint task export"} is already published in Nexus.`
          : result?.status === "waiting-for-pipeline"
            ? "A Stock Fix pipeline run is already in progress."
            : result?.status === "waiting-for-stable-file"
              ? "The latest SharePoint task export is still settling. Nexus will import it automatically after ten minutes."
              : result?.status === "no-source"
                ? "No approved weekly task export was found in SharePoint."
                : result?.message || "SharePoint Stock Fix check completed."
    });
    if (result?.status === "queued") showToast(`Stock Fix week ${result.week} was queued from SharePoint.`);
    await Promise.all([
      loadStockFixSharePointAutomationStatus({ quiet: true }),
      loadStockFixFirebasePublishStatus({ quiet: true })
    ]);
  } catch (error) {
    if (elements.stockFixSharePointSyncStatus) elements.stockFixSharePointSyncStatus.textContent = `SharePoint Stock Fix check failed: ${friendlyError(error)}`;
    showToast(`SharePoint Stock Fix check failed: ${friendlyError(error)}`, true);
  } finally {
    button.disabled = false;
  }
}

function stockFixRosterDisplayName(user = {}) {
  return [user.name, user.surname].filter(Boolean).join(" ") || user.email || user.uid || "Unnamed user";
}

function renderStockFixOperationalRoster() {
  const roster = state.stockFixOperationalRoster || [];
  const users = (state.adminUsers || []).filter((user) => user.disabled !== true);
  if (elements.stockFixRosterUser) {
    const selected = elements.stockFixRosterUser.value;
    elements.stockFixRosterUser.innerHTML = `<option value="">Choose a Nexus user</option>${users.map((user) => `<option value="${escapeHtml(user.uid)}">${escapeHtml(stockFixRosterDisplayName(user))} - ${escapeHtml(user.email || user.uid)}</option>`).join("")}`;
    if (users.some((user) => user.uid === selected)) elements.stockFixRosterUser.value = selected;
  }
  if (!elements.stockFixRosterList) return;
  elements.stockFixRosterList.innerHTML = roster.length
    ? roster.map((entry) => `<article class="operation-row"><span class="operation-indicator good"></span><div><strong>${escapeHtml(entry.displayName || entry.email || entry.uid)}</strong><small>${escapeHtml(entry.email || entry.uid)}</small><small>${escapeHtml((entry.repNames || []).join(" | ") || "No workbook rep names")}</small></div><button class="text-action" type="button" data-stockfix-roster-edit="${escapeHtml(entry.uid)}">Edit</button></article>`).join("")
    : `<p class="history-empty">No task ownership mappings have been saved. Map the users who will complete Stock Fix tasks before importing a live week.</p>`;
}

async function loadStockFixOperationalRoster({ quiet = false } = {}) {
  if (!state.isAdmin || !elements.stockFixRosterList) return;
  if (elements.stockFixRosterStatus) elements.stockFixRosterStatus.textContent = "Loading Nexus task ownership mappings...";
  try {
    const result = await callFunction("getStockFixOperationalRoster", {});
    state.stockFixOperationalRoster = result?.roster || [];
    renderStockFixOperationalRoster();
    if (elements.stockFixRosterStatus) {
      elements.stockFixRosterStatus.textContent = state.stockFixOperationalRoster.length
        ? `${state.stockFixOperationalRoster.length} Nexus user mapping${state.stockFixOperationalRoster.length === 1 ? "" : "s"} active. Imported tasks are assigned by the workbook rep name.`
        : "No task ownership mappings saved yet. Map users before importing a live week.";
    }
  } catch (error) {
    if (elements.stockFixRosterStatus) elements.stockFixRosterStatus.textContent = `Could not load Stock Fix task ownership: ${friendlyError(error)}`;
    if (!quiet) showToast(`Could not load Stock Fix task ownership: ${friendlyError(error)}`, true);
  }
}

async function saveStockFixOperationalRoster(event) {
  event.preventDefault();
  const uid = elements.stockFixRosterUser?.value || "";
  const repNames = String(elements.stockFixRosterRepNames?.value || "").split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean);
  if (!uid || !repNames.length) return showToast("Choose a Nexus user and add at least one exact workbook rep name.", true);
  const user = (state.adminUsers || []).find((item) => item.uid === uid) || {};
  const submit = elements.stockFixRosterSave;
  submit.disabled = true;
  try {
    const result = await callFunction("saveStockFixOperationalRosterMember", {
      uid,
      displayName: stockFixRosterDisplayName(user),
      repNames
    });
    elements.stockFixRosterRepNames.value = "";
    if (elements.stockFixRosterStatus) elements.stockFixRosterStatus.textContent = `Task mapping saved. ${stockFixNumber(result.updatedTasks || 0)} existing task${Number(result.updatedTasks || 0) === 1 ? "" : "s"} assigned to this user.`;
    showToast("Stock Fix task ownership mapping saved.");
    await loadStockFixOperationalRoster({ quiet: true });
  } catch (error) {
    if (elements.stockFixRosterStatus) elements.stockFixRosterStatus.textContent = `Task mapping was not saved: ${friendlyError(error)}`;
    showToast(`Task mapping was not saved: ${friendlyError(error)}`, true);
  } finally {
    submit.disabled = false;
  }
}

async function publishStockFixFirebaseWeek(event) {
  event.preventDefault();
  const file = elements.stockFixFirebaseSource?.files?.[0];
  const week = elements.stockFixFirebaseWeek?.value || "";
  if (!week || !stockFixUploadSupportsFile(file) || !storage) {
    showToast("Choose a reporting week and a JSON, NDJSON, JSONL or GZIP weekly Stock Fix source.", true);
    return;
  }
  if (file.size > 250 * 1024 * 1024) {
    showToast("The Firebase weekly publisher accepts source files up to 250 MB. Use the bulk pipeline for larger source data.", true);
    return;
  }
  const uploadId = uniqueId();
  const storagePath = `stockfix-source/${uploadId}/${safeStorageName(file.name)}`;
  const reference = storage.ref(storagePath);
  const submit = elements.stockFixFirebasePublish;
  submit.disabled = true;
  if (elements.stockFixFirebasePublishStatus) elements.stockFixFirebasePublishStatus.textContent = "Uploading Stock Fix source to Firebase Storage...";
  try {
    const uploadTask = reference.put(file, {
      contentType: file.type || "application/octet-stream",
      contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      customMetadata: { uploadId, source: "stockfix-weekly" }
    });
    await new Promise((resolve, reject) => uploadTask.on("state_changed", (progress) => {
      const percent = progress.totalBytes ? Math.round(progress.bytesTransferred / progress.totalBytes * 100) : 0;
      if (elements.stockFixFirebasePublishStatus) elements.stockFixFirebasePublishStatus.textContent = `Uploading Stock Fix source to Firebase Storage: ${percent}%`;
    }, reject, resolve));
    if (Number(uploadTask.snapshot.metadata.size || 0) !== Number(file.size || 0)) throw new Error("The Storage upload size could not be verified.");
    if (elements.stockFixFirebasePublishStatus) elements.stockFixFirebasePublishStatus.textContent = "Validating source and publishing the Firestore weekly snapshot...";
    const result = await callFunction("publishStockFixFirebaseWeek", { week, uploadId, storagePath, sourceName: file.name });
    elements.stockFixFirebaseSource.value = "";
    if (elements.stockFixFirebasePublishStatus) elements.stockFixFirebasePublishStatus.textContent = `Published ${result.week}: ${stockFixNumber(result.rowCount)} rows validated and ready for the Stock Fix dashboard.`;
    showToast(`Stock Fix week ${result.week} is published to Firebase.`);
    await loadStockFixFirebasePublishStatus({ quiet: true });
    if (window.location.hash === "#stockfix") await loadStockFixDashboard();
  } catch (error) {
    if (elements.stockFixFirebasePublishStatus) elements.stockFixFirebasePublishStatus.textContent = `Stock Fix publication failed: ${friendlyError(error)}`;
    showToast(`Stock Fix publication failed: ${friendlyError(error)}`, true);
  } finally {
    submit.disabled = false;
  }
}

function stockFixPipelineSupportsFile(file) {
  return !!file && /\.(?:csv|xlsx|xls|xlsb)$/i.test(file.name || "");
}

function stockFixPipelineClientHint(name) {
  return String(name || "")
    .replace(/\.(?:csv|xlsx|xls|xlsb)$/i, "")
    .replace(/^(?:inventory|stock[ _-]?fix)[ _-]*/i, "")
    .replace(/[._-]+/g, " ")
    .trim()
    .slice(0, 120);
}

function renderStockFixPipelineMappings() {
  const panel = elements.stockFixPipelineMappings;
  if (!panel) return;
  const files = [...(elements.stockFixPipelineSources?.files || [])];
  panel.hidden = !files.length;
  if (!files.length) {
    panel.innerHTML = "";
    return;
  }
  panel.innerHTML = files.map((file, index) => `<label><span>${escapeHtml(file.name)} (${formatBytes(file.size)})</span><input data-stockfix-pipeline-client="${index}" type="text" value="${escapeHtml(stockFixPipelineClientHint(file.name))}" placeholder="Client name" required /></label>`).join("");
}

async function startStockFixPipelineRun(event) {
  event.preventDefault();
  const files = [...(elements.stockFixPipelineSources?.files || [])];
  const week = elements.stockFixPipelineWeek?.value || "";
  if (!week || !files.length || !storage) {
    showToast("Choose a reporting week and at least one CSV or Excel source workbook.", true);
    return;
  }
  if (files.length > 40 || files.some((file) => !stockFixPipelineSupportsFile(file) || file.size > 250 * 1024 * 1024)) {
    showToast("Upload up to 40 CSV/XLSX/XLS/XLSB workbooks, each no larger than 250 MB.", true);
    return;
  }
  const clientInputs = [...document.querySelectorAll("[data-stockfix-pipeline-client]")];
  const sources = files.map((file, index) => ({ file, client: clientInputs[index]?.value?.trim() || "" }));
  if (sources.some((source) => !source.client)) {
    showToast("Enter the client name for every source workbook.", true);
    return;
  }
  const runId = uniqueId();
  const submit = elements.stockFixPipelineStart;
  submit.disabled = true;
  try {
    for (let index = 0; index < sources.length; index += 1) {
      const source = sources[index];
      const storagePath = `stockfix-pipeline-input/${runId}/sources/${String(index + 1).padStart(2, "0")}-${safeStorageName(source.file.name)}`;
      if (elements.stockFixPipelineStatus) elements.stockFixPipelineStatus.textContent = `Uploading source workbook ${index + 1} of ${sources.length}: ${source.file.name}`;
      const uploadTask = storage.ref(storagePath).put(source.file, {
        contentType: source.file.type || "application/octet-stream",
        contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(source.file.name)}`,
        customMetadata: { runId, source: "stockfix-pipeline" }
      });
      await new Promise((resolve, reject) => uploadTask.on("state_changed", (progress) => {
        const percent = progress.totalBytes ? Math.round(progress.bytesTransferred / progress.totalBytes * 100) : 0;
        if (elements.stockFixPipelineStatus) elements.stockFixPipelineStatus.textContent = `Uploading source workbook ${index + 1} of ${sources.length}: ${percent}%`;
      }, reject, resolve));
      if (Number(uploadTask.snapshot.metadata.size || 0) !== Number(source.file.size || 0)) throw new Error(`Could not verify ${source.file.name} in Storage.`);
      source.storagePath = storagePath;
      source.name = source.file.name;
      delete source.file;
    }
    if (elements.stockFixPipelineStatus) elements.stockFixPipelineStatus.textContent = "Queueing Cloud Run to validate and publish the Stock Fix reporting week...";
    const result = await callFunction("startStockFixPipelineRun", { runId, week, sources });
    elements.stockFixPipelineSources.value = "";
    renderStockFixPipelineMappings();
    if (elements.stockFixPipelineStatus) elements.stockFixPipelineStatus.textContent = `Cloud Run job queued for ${result.week}. Run ${result.runId} will publish only after source validation completes.`;
    showToast(`Stock Fix Cloud Run batch queued for ${result.week}.`);
  } catch (error) {
    if (elements.stockFixPipelineStatus) elements.stockFixPipelineStatus.textContent = `Stock Fix batch could not start: ${friendlyError(error)}`;
    showToast(`Stock Fix batch could not start: ${friendlyError(error)}`, true);
  } finally {
    submit.disabled = false;
  }
}

function activateStockFixTab(tabName = "overview") {
  const selected = ["overview", "adoption", "leaderboard", "detail", "actionimpact", "field"].includes(tabName) ? tabName : "overview";
  document.querySelectorAll("[data-stockfix-tab]").forEach((button) => {
    const active = button.dataset.stockfixTab === selected;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.querySelectorAll("[data-stockfix-panel]").forEach((panel) => {
    const active = panel.dataset.stockfixPanel === selected;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });
  if (selected === "adoption") loadStockFixAdoptionDashboard();
  if (selected === "field") loadStockFixOperationalWorkspace();
}

function sharePointInventoryNumber(value) {
  return Number(value || 0).toLocaleString("en-ZA");
}

function sharePointInventoryRows(items = [], category, fallback = "No matching SharePoint items in the latest scan.") {
  const filtered = items.filter((item) => category === "module" ? item.type === "folder" && Number(item.depth || 0) <= 2 : item.category === category);
  if (!filtered.length) return `<p class="history-empty">${escapeHtml(fallback)}</p>`;
  return filtered.slice(0, 80).map((item) => {
    const size = item.type === "file" ? ` - ${formatBytes(Number(item.size || 0))}` : "";
    const modified = item.lastModifiedDateTime ? ` - ${formatDate(item.lastModifiedDateTime)}` : "";
    const label = item.category === "output-data" ? "Output data" : item.category === "config-data" ? "Config data" : item.category === "knowledge" ? "Reference" : item.category === "workbook" ? "Workbook" : item.category === "code" ? "Code" : item.type === "folder" ? "Folder" : "File";
    const open = item.webUrl ? `<a class="text-action" href="${escapeHtml(item.webUrl)}" target="_blank" rel="noopener">Open</a>` : "";
    return `<article class="operation-row integration-inventory-row"><span class="operation-indicator ${item.integrationCandidate ? "good" : "muted"}"></span><div><strong>${escapeHtml(item.name || item.path || "SharePoint item")}</strong><small>${escapeHtml(item.path || "")}${size}${modified}</small><small>${escapeHtml(item.recommendation || label)}</small></div><span class="row-status">${escapeHtml(label)}</span>${open}</article>`;
  }).join("");
}

function renderSharePointIntegrationTracks(tracks = []) {
  if (!elements.sharePointIntegrationTrackList) return;
  if (!tracks.length) {
    elements.sharePointIntegrationTrackList.innerHTML = `<p class="history-empty">Run a scan to check Call Cycle Coverage, Geo Rep Capture handover, Stock Fix, Sales Insights and Connect notifications.</p>`;
    if (elements.sharePointIntegrationTrackCount) elements.sharePointIntegrationTrackCount.textContent = "0 modules";
    return;
  }
  if (elements.sharePointIntegrationTrackCount) elements.sharePointIntegrationTrackCount.textContent = `${sharePointInventoryNumber(tracks.length)} modules`;
  elements.sharePointIntegrationTrackList.innerHTML = tracks.map((track) => {
    const missing = Number(track.missingRequired || 0);
    const statusLabel = track.status === "read-only-linked" ? "Read-only linked" : track.status === "partial" ? "Needs review" : "Missing";
    const indicator = track.status === "read-only-linked" ? "good" : track.status === "partial" ? "warning" : "danger";
    const counts = track.counts || {};
    const required = Array.isArray(track.requiredFiles) && track.requiredFiles.length
      ? track.requiredFiles.map((file) => {
        const link = file.webUrl ? `<a class="text-action" href="${escapeHtml(file.webUrl)}" target="_blank" rel="noopener">Open</a>` : "";
        return `<span class="${file.found ? "found" : "missing"}">${file.found ? "Found" : "Missing"}: ${escapeHtml(file.name)}${link}</span>`;
      }).join("")
      : `<span>No required file contract set yet.</span>`;
    const source = track.sourceUrl ? `<a class="text-action" href="${escapeHtml(track.sourceUrl)}" target="_blank" rel="noopener">Open folder</a>` : "";
    return `<article class="operation-row integration-track-row"><span class="operation-indicator ${indicator}"></span><div><strong>${escapeHtml(track.label || track.key || "SharePoint module")}</strong><small>${escapeHtml(track.path || "")} - ${sharePointInventoryNumber(track.itemCount || 0)} items - ${sharePointInventoryNumber(counts.code || 0)} scripts - ${sharePointInventoryNumber(counts.workbook || 0)} workbooks - ${sharePointInventoryNumber((counts["output-data"] || 0) + (counts["config-data"] || 0))} data/config files</small><small>${escapeHtml(track.nextStep || (missing ? "Review missing source files." : "Read-only source linked."))}</small><div class="integration-required-files">${required}</div></div><span class="row-status ${missing ? "running" : ""}">${escapeHtml(statusLabel)}</span>${source}</article>`;
  }).join("");
}

function renderLocalCodeReferenceContracts(contracts = []) {
  if (!elements.localCodeReferenceList) return;
  if (!contracts.length) {
    if (elements.localCodeReferenceCount) elements.localCodeReferenceCount.textContent = "0 modules";
    elements.localCodeReferenceList.innerHTML = `<p class="history-empty">No local CODES reference contracts loaded yet.</p>`;
    return;
  }
  if (elements.localCodeReferenceCount) elements.localCodeReferenceCount.textContent = `${sharePointInventoryNumber(contracts.length)} modules`;
  elements.localCodeReferenceList.innerHTML = contracts.map((contract) => {
    const prepared = contract.firestorePrepared === true;
    const statusLabel = prepared ? "Prepared" : "Reference only";
    const technology = Array.isArray(contract.technology) && contract.technology.length ? contract.technology.join(", ") : "Reference module";
    return `<article class="operation-row integration-track-row local-code-reference-row"><span class="operation-indicator ${prepared ? "good" : "warning"}"></span><div><strong>${escapeHtml(contract.label || contract.key || "Local code reference")}</strong><small>${escapeHtml(contract.sourcePath || "")}</small><small>${escapeHtml(technology)}</small><small>${escapeHtml(contract.useFor || "")}</small><div class="integration-reference-notes"><span>Target: ${escapeHtml(contract.recommendedNexusTarget || "Nexus Firestore contract")}</span><span>Do not copy: ${escapeHtml(contract.doNotCopy || "Unreviewed auth or file-write logic")}</span></div></div><span class="row-status ${prepared ? "" : "running"}">${escapeHtml(statusLabel)}</span></article>`;
  }).join("");
}

function renderSharePointInventory() {
  if (!elements.sharePointInventoryStatus) return;
  const data = state.sharePointInventoryData;
  const current = data?.current || null;
  const counts = current?.counts || {};
  const items = data?.items || [];
  const scans = data?.scans || [];
  const status = state.sharePointInventoryScanning
    ? "Scanning SharePoint and updating Firestore..."
    : state.sharePointInventoryLoading
      ? "Loading SharePoint inventory from Firestore..."
      : current?.scanId
        ? `Loaded SharePoint inventory from ${formatDate(current.updatedAt)}. ${sharePointInventoryNumber(counts.total)} items catalogued.`
        : "No SharePoint inventory loaded yet. Run a scan to catalogue Portal, Stock Fix and the Meridian document library.";
  elements.sharePointInventoryStatus.textContent = status;
  if (elements.sharePointInventoryTotal) elements.sharePointInventoryTotal.textContent = sharePointInventoryNumber(counts.total);
  if (elements.sharePointInventoryCode) elements.sharePointInventoryCode.textContent = sharePointInventoryNumber(counts.code);
  if (elements.sharePointInventoryWorkbooks) elements.sharePointInventoryWorkbooks.textContent = sharePointInventoryNumber(counts.workbook);
  if (elements.sharePointInventoryOutput) elements.sharePointInventoryOutput.textContent = sharePointInventoryNumber((counts["output-data"] || 0) + (counts["config-data"] || 0));
  if (elements.sharePointInventoryModuleCount) elements.sharePointInventoryModuleCount.textContent = `${sharePointInventoryNumber((current?.modules || []).length || items.filter((item) => item.type === "folder" && Number(item.depth || 0) <= 2).length)} folders`;
  if (elements.sharePointInventoryCodeCount) elements.sharePointInventoryCodeCount.textContent = `${sharePointInventoryNumber(counts.code)} files`;
  if (elements.sharePointInventoryWorkbookCount) elements.sharePointInventoryWorkbookCount.textContent = `${sharePointInventoryNumber(counts.workbook)} files`;
  if (elements.sharePointInventoryOutputCount) elements.sharePointInventoryOutputCount.textContent = `${sharePointInventoryNumber((counts["output-data"] || 0) + (counts["config-data"] || 0) + (counts.knowledge || 0))} files`;
  renderSharePointIntegrationTracks(current?.integrationTracks || []);
  renderLocalCodeReferenceContracts(data?.localCodeContracts || []);
  if (elements.sharePointInventoryModules) elements.sharePointInventoryModules.innerHTML = sharePointInventoryRows(current?.modules || items, "module", "No SharePoint module folders found.");
  if (elements.sharePointInventoryCodeList) elements.sharePointInventoryCodeList.innerHTML = sharePointInventoryRows(current?.codeFiles || items, "code", "No code or script files found.");
  if (elements.sharePointInventoryWorkbookList) elements.sharePointInventoryWorkbookList.innerHTML = sharePointInventoryRows(current?.workbooks || items, "workbook", "No Excel or CSV files found.");
  if (elements.sharePointInventoryOutputList) {
    const outputItems = [...(current?.outputData || []), ...(current?.configData || []), ...(current?.knowledgeFiles || [])];
    elements.sharePointInventoryOutputList.innerHTML = sharePointInventoryRows(outputItems.length ? outputItems : items, "output-data", "No output data files found.") + sharePointInventoryRows(outputItems.length ? outputItems : items, "config-data", "No configuration data files found.") + sharePointInventoryRows(outputItems.length ? outputItems : items, "knowledge", "No reference files found.");
  }
  if (elements.sharePointInventoryScanCount) elements.sharePointInventoryScanCount.textContent = `${sharePointInventoryNumber(scans.length)} scans`;
  if (elements.sharePointInventoryScanList) {
    elements.sharePointInventoryScanList.innerHTML = scans.length ? scans.map((scan) => `<article class="operation-row"><span class="operation-indicator ${scan.status === "completed" ? "good" : scan.status === "failed" ? "danger" : "warning"}"></span><div><strong>${escapeHtml(scan.status || "scan")}</strong><small>${escapeHtml(scan.id)} - ${formatDate(scan.startedAt)}${scan.startedByEmail ? ` - ${escapeHtml(scan.startedByEmail)}` : ""}</small><small>${escapeHtml(scan.message || `${sharePointInventoryNumber(scan.counts?.total || 0)} items catalogued`)}</small></div></article>`).join("") : `<p class="history-empty">No scans have been recorded yet.</p>`;
  }
  if (elements.scanSharePointInventory) elements.scanSharePointInventory.disabled = state.sharePointInventoryScanning;
  if (elements.refreshSharePointInventory) elements.refreshSharePointInventory.disabled = state.sharePointInventoryLoading || state.sharePointInventoryScanning;
  if (elements.prepareLocalCodeContracts) elements.prepareLocalCodeContracts.disabled = state.localCodeContractsPreparing;
}

async function loadSharePointInventory({ quiet = false } = {}) {
  if (!state.isAdmin || state.sharePointInventoryLoading) return;
  state.sharePointInventoryLoading = true;
  renderSharePointInventory();
  try {
    state.sharePointInventoryData = await callFunction("getMeridianSharePointInventory", { limit: 500 });
    renderSharePointInventory();
  } catch (error) {
    if (!quiet) showToast(`Could not load SharePoint inventory: ${friendlyError(error)}`, true);
    if (elements.sharePointInventoryStatus) elements.sharePointInventoryStatus.textContent = `Could not load SharePoint inventory: ${friendlyError(error)}`;
  } finally {
    state.sharePointInventoryLoading = false;
    renderSharePointInventory();
  }
}

async function scanSharePointInventory() {
  if (!state.isAdmin || state.sharePointInventoryScanning) return;
  state.sharePointInventoryScanning = true;
  renderSharePointInventory();
  try {
    const result = await callFunction("scanMeridianSharePointInventory", { maxItems: 3600 });
    showToast(`SharePoint scan completed. ${sharePointInventoryNumber(result?.counts?.total || 0)} items catalogued.`);
    await loadSharePointInventory({ quiet: true });
  } catch (error) {
    showToast(`SharePoint scan failed: ${friendlyError(error)}`, true);
    if (elements.sharePointInventoryStatus) elements.sharePointInventoryStatus.textContent = `SharePoint scan failed: ${friendlyError(error)}`;
  } finally {
    state.sharePointInventoryScanning = false;
    renderSharePointInventory();
  }
}

async function prepareLocalCodeContracts() {
  if (!state.isAdmin || state.localCodeContractsPreparing) return;
  state.localCodeContractsPreparing = true;
  renderSharePointInventory();
  try {
    const result = await callFunction("prepareLocalCodeReferenceContracts", {});
    showToast(`Prepared ${sharePointInventoryNumber(result?.count || 0)} local code reference contracts in Firestore.`);
    await loadSharePointInventory({ quiet: true });
  } catch (error) {
    showToast(`Could not prepare local code contracts: ${friendlyError(error)}`, true);
    if (elements.sharePointInventoryStatus) elements.sharePointInventoryStatus.textContent = `Could not prepare local code contracts: ${friendlyError(error)}`;
  } finally {
    state.localCodeContractsPreparing = false;
    renderSharePointInventory();
  }
}

function renderSalesDashboardRegionBars(rows, selectedRegion = "") {
  if (!rows?.length) return `<p class="history-empty">No matching sales data.</p>`;
  const max = Math.max(...rows.map((row) => Number(row.value || 0) || Number(row.quantity || 0)), 1);
  return rows.map((row) => {
    const amount = Number(row.value || 0) || Number(row.quantity || 0);
    const width = Math.max(3, Math.round((amount / max) * 100));
    const selected = row.label === selectedRegion;
    return `<button class="sales-bar-row sales-region-row${selected ? " is-selected" : ""}" type="button" data-sales-region="${escapeHtml(row.label)}" aria-pressed="${selected}"><div><strong title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</strong><span>${salesDashboardCurrency(amount)} / ${salesDashboardNumber(row.orders || 0)} orders</span></div><i><b style="width:${width}%"></b></i></button>`;
  }).join("");
}

function salesDashboardCurrentFilters() {
  return {
    region: elements.salesDashboardRegion.value,
    rep: elements.salesDashboardRep.value,
    manager: elements.salesDashboardManager.value,
    store: elements.salesDashboardStore.value,
    sku: elements.salesDashboardSku.value,
    product: elements.salesDashboardProduct.value,
    status: elements.salesDashboardStatusFilter.value
  };
}

function salesDrilldownValue(value, format = "number") {
  if (format === "currency") return salesDashboardCurrency(value);
  if (format === "percent") return `${Number(value || 0).toFixed(0)}%`;
  if (format === "number1") return Number(value || 0).toLocaleString("en-ZA", { maximumFractionDigits: 1 });
  return salesDashboardNumber(value);
}

function renderSalesDrilldownBars(rows, format = "currency") {
  if (!rows?.length) return `<p class="history-empty">No matching sales data.</p>`;
  const isQuantity = format === "number";
  const amountFor = (row) => isQuantity ? Number(row.quantity || 0) : Number(row.value || 0);
  const max = Math.max(...rows.map((row) => amountFor(row)), 1);
  return rows.map((row) => {
    const amount = amountFor(row);
    const width = Math.max(3, Math.round((amount / max) * 100));
    return `<div class="sales-bar-row"><div><strong title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</strong><span>${salesDrilldownValue(amount, format)} / ${salesDashboardNumber(row.orders || 0)} orders</span></div><i><b style="width:${width}%"></b></i></div>`;
  }).join("");
}

function renderSalesDrilldown(data) {
  state.salesDrilldownData = data || null;
  const primary = data?.primary || {};
  elements.salesDrilldownTitle.textContent = data?.title || "Sales analysis";
  elements.salesDrilldownSubtitle.textContent = data?.subtitle || "No matching data is available.";
  elements.salesDrilldownPrimaryLabel.textContent = primary.label || "Selected metric";
  elements.salesDrilldownPrimaryValue.textContent = data ? salesDrilldownValue(primary.value, primary.format) : "-";
  elements.salesDrilldownPrimaryNote.textContent = primary.note || "";
  elements.salesDrilldownInsights.innerHTML = (data?.insights || []).map((item) => `<div><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(salesDrilldownValue(item.value, item.format))}</strong></div>`).join("");
  elements.salesDrilldownChartEyebrow.textContent = data?.chart?.eyebrow || "Comparison";
  elements.salesDrilldownChartTitle.textContent = data?.chart?.title || "Selected detail";
  elements.salesDrilldownBars.innerHTML = renderSalesDrilldownBars(data?.chart?.rows || [], data?.chart?.format || "currency");
  elements.salesDrilldownRecordsTitle.textContent = data?.recordTitle || "Transaction lines";
  elements.salesDrilldownRecordCount.textContent = `${salesDashboardNumber(data?.totalRows || 0)} rows`;
  const rows = data?.recordRows || [];
  elements.salesDrilldownRows.innerHTML = rows.length
    ? rows.map((row) => `<tr><td>${escapeHtml(row.orderDate || "-")}</td><td>${escapeHtml(row.orderNumber || "-")}</td><td title="${escapeHtml(row.storeCode || row.storeName || "-")}">${escapeHtml(row.storeName || "-")}</td><td>${escapeHtml(row.region || "Unmapped")}</td><td>${escapeHtml(row.rep || "-")}</td><td title="${escapeHtml(row.product || row.sku || "-")}">${escapeHtml(row.product || row.sku || "-")}</td><td>${salesDashboardNumber(row.quantity)}</td><td>${salesDashboardCurrency(row.value)}</td><td><span class="sales-mapping-state ${row.mapped ? "mapped" : "unmapped"}">${row.mapped ? "Mapped" : "Review"}</span></td></tr>`).join("")
    : `<tr><td colspan="9">No transaction lines match the selected filters.</td></tr>`;
  elements.salesDrilldownPage.textContent = `Page ${data?.page || 1} of ${data?.pageCount || 1}`;
  elements.salesDrilldownPrevious.disabled = !data || Number(data.page || 1) <= 1 || state.salesDrilldownLoading;
  elements.salesDrilldownNext.disabled = !data || Number(data.page || 1) >= Number(data.pageCount || 1) || state.salesDrilldownLoading;
}

function closeSalesDrilldown() {
  if (elements.salesDrilldownDialog?.open) elements.salesDrilldownDialog.close();
  state.salesDrilldownMetric = "";
  state.salesDrilldownPage = 1;
  state.salesDrilldownData = null;
}

async function openSalesDrilldown(metric, page = 1) {
  if (!state.authResolved || !state.isOperator || state.salesDrilldownLoading) return;
  state.salesDrilldownMetric = metric;
  state.salesDrilldownPage = page;
  state.salesDrilldownLoading = true;
  elements.salesDrilldownPrevious.disabled = true;
  elements.salesDrilldownNext.disabled = true;
  if (!elements.salesDrilldownDialog.open) elements.salesDrilldownDialog.showModal();
  renderSalesDrilldown({ title: "Loading analysis", subtitle: "Preparing the selected transaction detail.", primary: { label: "Selected metric", value: 0, format: "number", note: "" }, chart: { eyebrow: "Comparison", title: "Loading", rows: [] }, recordTitle: "Transaction lines", recordRows: [] });
  try {
    const data = await callFunction("getGeoRepSalesDrilldown", {
      metric,
      page,
      periodKey: state.salesDashboardData?.periodKey || "",
      filters: salesDashboardCurrentFilters()
    });
    state.salesDrilldownPage = data.page || 1;
    renderSalesDrilldown(data);
  } catch (error) {
    renderSalesDrilldown({ title: "Could not load analysis", subtitle: friendlyError(error), primary: { label: "Selected metric", value: 0, format: "number", note: "" }, chart: { eyebrow: "Comparison", title: "No data", rows: [] }, recordTitle: "Transaction lines", recordRows: [] });
  } finally {
    state.salesDrilldownLoading = false;
    renderSalesDrilldown(state.salesDrilldownData);
  }
}

function renderSalesDashboard(data) {
  state.salesDashboardData = data || null;
  const metrics = data?.metrics || {};
  elements.salesDashboardPeriod.textContent = data?.periodKey ? `${data.periodKey} month-to-date` : "Current month";
  elements.salesDashboardValue.textContent = data ? salesDashboardCurrency(metrics.salesValue) : "-";
  elements.salesDashboardValueNote.textContent = data ? `${salesDashboardNumber(metrics.orderLines)} imported line items` : "Transaction detail rows";
  elements.salesDashboardOrders.textContent = data ? salesDashboardNumber(metrics.orders) : "-";
  elements.salesDashboardOrdersNote.textContent = data ? "Unique Geo Rep Capture order numbers" : "Unique order numbers";
  elements.salesDashboardUnits.textContent = data ? salesDashboardNumber(metrics.quantity) : "-";
  elements.salesDashboardUnitsNote.textContent = data ? `${salesDashboardNumber(metrics.stores)} stores in selection` : "Ordered quantity";
  elements.salesDashboardAverageOrder.textContent = data ? salesDashboardCurrency(metrics.averageOrderValue) : "-";
  elements.salesDashboardAverageOrderNote.textContent = data ? `${salesDashboardNumber(metrics.averageUnitsPerOrder)} units per transaction` : "Value per transaction";
  elements.salesDashboardStoresMetric.textContent = data ? salesDashboardNumber(metrics.stores) : "-";
  elements.salesDashboardStoresMetricNote.textContent = "Stores with orders";
  elements.salesDashboardRepsMetric.textContent = data ? salesDashboardNumber(metrics.reps) : "-";
  elements.salesDashboardRepsMetricNote.textContent = "Reps with orders";
  elements.salesDashboardMapped.textContent = data ? `${Number(metrics.mappedPercent || 0).toFixed(0)}%` : "-";
  elements.salesDashboardMappedNote.textContent = data ? `${salesDashboardNumber(metrics.mappedRows)} exact Store Master matches` : "Exact Store Master matches";
  elements.salesDashboardNewLines.textContent = data ? salesDashboardNumber(metrics.latestNewRecords) : "-";
  elements.salesDashboardNewLinesNote.textContent = data?.latestImport?.status === "completed" ? `${salesDashboardNumber(data.latestImport.existingRecords)} already existed` : "New order lines added";
  renderSalesDashboardOptions(elements.salesDashboardRegion, data?.availableFilters?.regions || [], "All regions");
  renderSalesDashboardOptions(elements.salesDashboardRep, data?.availableFilters?.reps || [], "All reps");
  renderSalesDashboardOptions(elements.salesDashboardManager, data?.availableFilters?.managers || [], "All managers");
  renderSalesDashboardOptions(elements.salesDashboardStore, data?.availableFilters?.stores || [], "All stores");
  renderSalesDashboardOptions(elements.salesDashboardSku, data?.availableFilters?.skus || [], "All SKUs");
  renderSalesDashboardOptions(elements.salesDashboardProduct, data?.availableFilters?.products || [], "All products");
  renderSalesDashboardOptions(elements.salesDashboardStatusFilter, data?.availableFilters?.statuses || [], "All statuses");
  const importInfo = data?.latestImport;
  elements.salesDashboardImportLabel.textContent = importInfo?.status === "completed"
    ? `${salesDashboardNumber(importInfo.newRecords)} new lines; ${salesDashboardNumber(importInfo.periodOrderLines)} month-to-date from ${importInfo.detailSheet || "Order Details"}`
    : importInfo?.status === "failed" ? "Latest import needs attention" : "Waiting for the first import";
  renderSalesDashboardBars(elements.salesDashboardDaily, data?.charts?.daily || [], salesDashboardCurrency);
  elements.salesDashboardRegions.innerHTML = renderSalesDashboardRegionBars(data?.charts?.byRegion || [], elements.salesDashboardRegion.value);
  renderSalesDashboardBars(elements.salesDashboardReps, data?.charts?.byRep || [], salesDashboardCurrency);
  renderSalesDashboardBars(elements.salesDashboardManagers, data?.charts?.byManager || [], salesDashboardCurrency);
  renderSalesDashboardBars(elements.salesDashboardStores, data?.charts?.byStore || [], salesDashboardCurrency);
  renderSalesDashboardBars(elements.salesDashboardProducts, data?.charts?.byProduct || [], salesDashboardCurrency);
  renderSalesDashboardBars(elements.salesDashboardSkus, data?.charts?.bySku || [], salesDashboardCurrency);
  renderSalesDashboardBars(elements.salesDashboardStatuses, data?.charts?.byStatus || [], salesDashboardCurrency);
  const unmapped = data?.unmapped || [];
  elements.salesDashboardUnmappedCount.textContent = `${unmapped.length} store${unmapped.length === 1 ? "" : "s"}`;
  elements.salesDashboardUnmapped.innerHTML = unmapped.length
    ? unmapped.map((row) => `<div><strong>${escapeHtml(row.label)}</strong><span>${salesDashboardCurrency(row.value)} Â· ${salesDashboardNumber(row.orders)} orders</span></div>`).join("")
    : `<p class="history-empty">All matching stores have a region.</p>`;
  const quality = data?.quality || {};
  const reconciliation = quality.reconciliation || {};
  const qualityReady = Boolean(data?.latestImport?.status === "completed");
  const qualityIssues = Number(quality.duplicateSourceRows || 0) + Number(quality.missingRegionRows || 0) + Number(quality.missingRepRows || 0) + Number(quality.missingOrderNumberRows || 0);
  elements.salesDashboardQualityState.textContent = !qualityReady ? "Waiting" : qualityIssues ? "Review" : "Reconciled";
  elements.salesDashboardQualityState.className = `row-status ${!qualityReady ? "muted" : qualityIssues ? "failed" : "completed"}`;
  elements.salesDashboardQuality.innerHTML = qualityReady
    ? [
      ["Source rows", quality.sourceRows],
      ["Duplicate rows skipped", quality.duplicateSourceRows],
      ["Already imported", quality.existingRecords],
      ["New lines added", quality.newRecords],
      ["Stale cache rows removed", quality.staleRowsRemoved],
      ["Stores without region", quality.missingRegionRows],
      ["Rows without rep", quality.missingRepRows],
      ["Source reconciliation", reconciliation.reconciled === true ? "Matched" : "Needs review"]
    ].map(([label, value]) => `<div><strong>${escapeHtml(label)}</strong><span>${escapeHtml(typeof value === "number" ? salesDashboardNumber(value) : String(value || "-"))}</span></div>`).join("")
    : `<p class="history-empty">The next Transaction Report import will include duplicate, mapping and source checks.</p>`;
  const recentOrders = data?.recentOrders || [];
  elements.salesDashboardRecentOrdersCount.textContent = `${salesDashboardNumber(recentOrders.length)} latest lines`;
  elements.salesDashboardRecentOrders.innerHTML = recentOrders.length
    ? recentOrders.map((row) => `<tr><td>${escapeHtml(row.orderDate || "-")}</td><td>${escapeHtml(row.orderNumber || "-")}</td><td>${escapeHtml(row.storeName || "-")}</td><td>${escapeHtml(row.region || "Unmapped")}</td><td>${escapeHtml(row.rep || "-")}</td><td title="${escapeHtml(row.product || row.sku || "-")}">${escapeHtml(row.product || row.sku || "-")}</td><td>${salesDashboardNumber(row.quantity)}</td><td>${salesDashboardCurrency(row.value)}</td></tr>`).join("")
    : `<tr><td colspan="8">No transaction data yet.</td></tr>`;
  elements.salesDashboardMetrics?.querySelectorAll("[data-sales-drilldown]").forEach((card) => { card.disabled = !Boolean(data?.metrics?.orderLines); });
}

async function loadSalesDashboard() {
  if (state.salesDashboardLoading) return;
  if (!state.isOperator || !cloudFunctions) {
    elements.salesDashboardStatus.textContent = "Sign in to Nexus to load the controlled sales dashboard.";
    renderSalesDashboard(null);
    return;
  }
  state.salesDashboardLoading = true;
  elements.salesDashboardRefresh.disabled = true;
  elements.salesDashboardStatus.textContent = "Loading the current month of Geo Rep Capture orders...";
  try {
    const data = await callFunction("getGeoRepSalesDashboard", {
      workspace: "sales",
      filters: salesDashboardCurrentFilters()
    });
    renderSalesDashboard(data);
    if (!data.metrics?.orderLines) {
      elements.salesDashboardStatus.textContent = data.config?.setupStatus === "ready"
        ? "The Geo Rep Capture Orders workflow is ready. Run it once to import this monthâ€™s Transaction Report."
        : "Admin must upload the Geo Rep Capture Orders Store Master and set up the dedicated Orders workflow.";
    } else {
      elements.salesDashboardStatus.textContent = `Showing ${salesDashboardNumber(data.metrics.orderLines)} Transaction Report detail rows for ${data.periodKey}.`;
    }
  } catch (error) {
    renderSalesDashboard(null);
    elements.salesDashboardStatus.textContent = friendlyError(error);
  } finally {
    state.salesDashboardLoading = false;
    elements.salesDashboardRefresh.disabled = false;
  }
}

const salesInsightsSourcePageMap = Object.freeze({
  overview: "overview",
  trend: "trend",
  regions: "regions",
  brands: "brands",
  categories: "products",
  products: "productlist",
  channels: "channels",
  pricemix: "pricemix",
  stores: "stores"
});

const salesInsightsSourceUrl = "sales-insights-source/dashboard.dc.html";

function salesInsightsSourceFrame() {
  return document.querySelector("#insightsSourceFrame");
}

function ensureSalesInsightsSourceFrame() {
  const frame = salesInsightsSourceFrame();
  if (!frame) return null;
  if (!state.isOperator) return frame;
  if (!frame.dataset.nexusBound) {
    frame.dataset.nexusBound = "true";
    frame.addEventListener("load", () => {
      if (!state.isOperator) return;
      // The source was previously a standalone Microsoft-authenticated app.
      // Recover the embedded view if a stale browser asset redirects it away
      // from the Nexus-owned Firebase session.
      try {
        if (frame.contentWindow?.location?.origin !== window.location.origin) {
          frame.src = salesInsightsSourceUrl;
          return;
        }
      } catch {
        frame.src = salesInsightsSourceUrl;
        return;
      }
      syncSalesInsightsSourcePage();
    });
  }
  if (!frame.dataset.nexusLoaded) {
    frame.dataset.nexusLoaded = "true";
    frame.src = salesInsightsSourceUrl;
  }
  return frame;
}

function syncSalesInsightsSourcePage() {
  const frame = salesInsightsSourceFrame();
  const sourcePage = salesInsightsSourcePageMap[state.insightsPage] || "overview";
  if (!frame?.contentWindow) return;
  frame.contentWindow.postMessage({ type: "nexus-insights-nav", page: sourcePage }, window.location.origin);
}

function updateSalesInsightsPage(page = state.insightsPage) {
  const pages = {
    overview: { title: "Executive Overview", note: "Revenue and demand performance from verified Nexus data.", panels: [] },
    trend: { title: "Trend Analysis", note: "Daily sales movement and the most recent verified transactions.", panels: ["daily", "orders"] },
    regions: { title: "Regional Performance", note: "Sales value by verified operating region.", panels: [] },
    brands: { title: "Brand Performance", note: "Brand reporting becomes available when the verified Geo sales import includes a Brand dimension.", panels: [] },
    categories: { title: "Category Performance", note: "Category reporting is based on the product classification supplied in the verified Geo sales import.", panels: [] },
    products: { title: "Product Performance", note: "Leading products in the current Nexus selection.", panels: [] },
    channels: { title: "Channel Performance", note: "Channel reporting becomes available when the verified Geo sales import includes a Channel dimension.", panels: [] },
    pricemix: { title: "Price & Mix", note: "Sales value and product demand in the current verified transaction selection.", panels: [] },
    reps: { title: "Rep Performance", note: "Sales execution by representative and manager.", panels: ["reps", "managers"] },
    managers: { title: "Manager Performance", note: "Leadership view of current verified sales activity.", panels: ["managers", "reps"] },
    stores: { title: "Store Performance", note: "Top stores and recent verified order activity.", panels: ["stores", "orders"] },
    status: { title: "Order Status", note: "Status mix for the current verified transaction selection.", panels: ["status", "orders"] }
  };
  const selected = pages[page] || pages.overview;
  state.insightsPage = pages[page] ? page : "overview";
  if (elements.insightsPageTitle) elements.insightsPageTitle.textContent = selected.title;
  if (elements.insightsPageNote) elements.insightsPageNote.textContent = selected.note;
  if (elements.insightsOverviewPage) elements.insightsOverviewPage.hidden = state.insightsPage !== "overview";
  const trendPage = document.querySelector("#insightsTrendPage");
  if (trendPage) trendPage.hidden = state.insightsPage !== "trend";
  const detailPage = document.querySelector("#insightsDetailPage");
  if (detailPage) detailPage.hidden = !["regions", "brands", "categories", "products", "channels", "pricemix", "stores"].includes(state.insightsPage);
  if (elements.insightsRetailerFilter) elements.insightsRetailerFilter.hidden = state.insightsPage !== "channels";
  document.querySelectorAll("[data-insights-page]").forEach((button) => {
    const active = button.dataset.insightsPage === state.insightsPage;
    button.classList.toggle("active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
  elements.insightsPanels.forEach((panel) => {
    panel.hidden = !selected.panels.includes(panel.dataset.insightsPanel);
  });
  syncSalesInsightsSourcePage();
}

function insightsCurrentFilters() {
  return {
    client: elements.insightsClient?.value || "",
    category: elements.insightsCategory?.value || "",
    brand: elements.insightsBrand?.value || "",
    channel: elements.insightsChannel?.value || "",
    retailer: elements.insightsRetailer?.value || "",
    region: elements.insightsRegion?.value || "",
    division: elements.insightsDivision?.value || "",
    product: elements.insightsProduct?.value || ""
  };
}

function renderSalesInsights(data) {
  state.insightsData = data || null;
  const metrics = data?.metrics || {};
  const importInfo = data?.latestImport || null;
  const historicalSource = ["historical-sales-insights", "firebase-sales-insights"].includes(data?.source?.kind);
  const clientCount = (data?.availableFilters?.clients || []).length || data?.charts?.byClient?.length || 0;
  const refreshDate = data?.source?.generatedAt || importInfo?.completedAt || data?.periodKey;
  elements.insightsPeriod.textContent = data?.periodKey ? `${salesDashboardNumber(metrics.orderLines || 0)} rows - ${salesDashboardNumber(clientCount)} clients - refreshed ${refreshDate ? formatDate(refreshDate) : data.periodKey}` : "Current month";
  elements.insightsValue.textContent = data ? salesDashboardCurrency(metrics.salesValue) : "-";
  elements.insightsValueNote.textContent = data ? (historicalSource ? `rolling ${data.windowMonths || 12} months` : `${salesDashboardNumber(metrics.orderLines)} verified order lines`) : "Verified sales value";
  elements.insightsUnits.textContent = data ? salesDashboardNumber(metrics.quantity) : "-";
  elements.insightsUnitsNote.textContent = data ? (historicalSource ? `rolling ${data.windowMonths || 12} months` : `${salesDashboardNumber(metrics.averageUnitsPerOrder)} units per order`) : "Units ordered";
  elements.insightsOrders.textContent = data ? salesDashboardNumber(metrics.orders) : "-";
  elements.insightsOrdersNote.textContent = "Unique transactions";
  elements.insightsStores.textContent = data ? salesDashboardNumber(metrics.stores) : "-";
  elements.insightsStoresNote.textContent = "Stores with sales";
  elements.insightsReps.textContent = data ? (historicalSource ? salesDashboardCurrency(metrics.averageMonthValue) : salesDashboardNumber(metrics.reps)) : "-";
  elements.insightsRepsLabel.textContent = historicalSource ? "Avg per month" : "Active reps";
  elements.insightsRepsNote.textContent = historicalSource ? `average over ${data.windowMonths || 12} months` : "Reps with orders";
  elements.insightsAverageOrder.textContent = data ? salesDashboardCurrency(metrics.averageOrderValue) : "-";
  elements.insightsAverageOrderLabel.textContent = historicalSource ? "Avg unit price" : "Value per order";
  elements.insightsAverageOrderNote.textContent = historicalSource ? "value per sold unit" : "Average transaction value";
  renderSalesDashboardOptions(elements.insightsClient, data?.availableFilters?.clients || [], "All clients");
  renderSalesDashboardOptions(elements.insightsCategory, data?.availableFilters?.categories || [], "All categories");
  renderSalesDashboardOptions(elements.insightsBrand, data?.availableFilters?.brands || [], "All brands");
  renderSalesDashboardOptions(elements.insightsChannel, data?.availableFilters?.channels || [], "All channels");
  renderSalesDashboardOptions(elements.insightsRetailer, data?.availableFilters?.retailers || data?.availableFilters?.banners || [], "All retailers");
  renderSalesDashboardOptions(elements.insightsRegion, data?.availableFilters?.regions || [], "All regions");
  renderSalesDashboardOptions(elements.insightsDivision, data?.availableFilters?.divisions || [], "All divisions");
  renderSalesDashboardOptions(elements.insightsProduct, data?.availableFilters?.products || [], "All products");
  elements.insightsSourceLine.textContent = historicalSource
    ? `Historical Sales Insights snapshot: ${salesDashboardNumber(metrics.orderLines)} source rows from sales.duckdb.`
    : importInfo?.status === "completed"
      ? `Verified ${salesDashboardNumber(importInfo.periodOrderLines || metrics.orderLines)} order lines from ${importInfo.detailSheet || "Order Details"}.`
      : "Verified Geo Rep Capture order imports.";
  elements.insightsImportState.textContent = historicalSource
    ? `Historical snapshot refreshed ${refreshDate ? formatDate(refreshDate) : "recently"}`
    : importInfo?.status === "completed"
      ? `${salesDashboardNumber(importInfo.newRecords)} new lines in the latest import`
      : importInfo?.status === "failed" ? "Latest import needs attention" : "Waiting for a completed import";
  renderSalesDashboardBars(elements.insightsDaily, data?.charts?.daily || [], salesDashboardCurrency);
  renderSalesDashboardBars(elements.insightsRegions, data?.charts?.byRegion?.slice(0, 8) || [], salesDashboardCurrency);
  renderSalesDashboardBars(elements.insightsProducts, data?.charts?.byProduct?.slice(0, 8) || [], salesDashboardCurrency);
  renderSalesDashboardBars(elements.insightsRepsChart, data?.charts?.byRep?.slice(0, 8) || [], salesDashboardCurrency);
  renderSalesDashboardBars(elements.insightsManagersChart, data?.charts?.byManager?.slice(0, 8) || [], salesDashboardCurrency);
  renderSalesDashboardBars(elements.insightsStoresChart, data?.charts?.byStore?.slice(0, 8) || [], salesDashboardCurrency);
  renderSalesDashboardBars(elements.insightsStatusesChart, data?.charts?.byStatus?.slice(0, 8) || [], salesDashboardCurrency);
  const region = data?.charts?.byRegion?.[0];
  const product = data?.charts?.byProduct?.[0];
  const rep = data?.charts?.byRep?.[0];
  const mapped = Number(metrics.mappedPercent || 0);
  elements.insightsNarrativeScope.textContent = data ? "Sales performance" : "Sales performance";
  elements.insightsNarrativeValue.textContent = data ? salesDashboardCurrency(metrics.salesValue) : "No sales value loaded";
  elements.insightsNarrativePeriod.textContent = data?.periodKey || "the current period";
  elements.insightsNarrativeUnits.textContent = data ? `${salesDashboardNumber(metrics.quantity)} units` : "0 units";
  elements.insightsNarrativeStores.textContent = data ? `${salesDashboardNumber(metrics.stores)} trading stores` : "0 trading stores";
  elements.insightsLeadingRegion.textContent = region?.label || "No region data";
  elements.insightsLeadingRegionNote.textContent = region ? `${salesDashboardCurrency(region.value)} in sales value` : "Load verified sales data";
  elements.insightsLeadingProduct.textContent = product?.label || "No product data";
  elements.insightsLeadingProductNote.textContent = product ? `${salesDashboardCurrency(product.value)} in sales value` : "Load verified sales data";
  elements.insightsLeadingRep.textContent = rep?.label || "No rep data";
  elements.insightsLeadingRepNote.textContent = rep ? `${salesDashboardCurrency(rep.value)} in sales value` : "Load verified sales data";
  elements.insightsSignals.innerHTML = data?.metrics?.orderLines
    ? [
      region ? `<li><strong>${escapeHtml(region.label)}</strong> is the leading region at ${salesDashboardCurrency(region.value)}.</li>` : "",
      product ? `<li><strong>${escapeHtml(product.label)}</strong> is the highest-value product in the current selection.</li>` : "",
      rep ? `<li><strong>${escapeHtml(rep.label)}</strong> is leading execution by sales value.</li>` : "",
      historicalSource
        ? `<li><strong>${salesDashboardNumber(clientCount)}</strong> clients are included in the published historical sales snapshot.</li>`
        : `<li><strong>${mapped.toFixed(0)}%</strong> of current order lines match the approved Store Master.</li>`
    ].filter(Boolean).join("")
    : historicalSource ? `<li>Historical Sales Insights data is not available in the current snapshot.</li>` : `<li>Run the Geo Rep Capture Orders import to populate sales insights.</li>`;
  renderSalesInsightsOverview(data);
  renderSalesInsightsTrend(data);
  renderSalesInsightsDetail(data);
  const recent = data?.recentOrders || [];
  elements.insightsRecentCount.textContent = `${salesDashboardNumber(recent.length)} latest lines`;
  elements.insightsRecentRows.innerHTML = recent.length
    ? recent.map((row) => `<tr><td>${escapeHtml(row.orderDate || "-")}</td><td>${escapeHtml(row.orderNumber || "-")}</td><td>${escapeHtml(row.storeName || "-")}</td><td>${escapeHtml(row.region || "Unmapped")}</td><td>${escapeHtml(row.rep || "-")}</td><td title="${escapeHtml(row.product || row.sku || "-")}">${escapeHtml(row.product || row.sku || "-")}</td><td>${salesDashboardNumber(row.quantity)}</td><td>${salesDashboardCurrency(row.value)}</td></tr>`).join("")
    : `<tr><td colspan="8">No transaction data yet.</td></tr>`;
  updateSalesInsightsPage();
}

function salesInsightsCompactCurrency(value) {
  const amount = Number(value || 0);
  const abs = Math.abs(amount);
  if (abs >= 1000000000) return `R${(amount / 1000000000).toFixed(2).replace(/\.00$/, "")}bn`;
  if (abs >= 1000000) return `R${(amount / 1000000).toFixed(1).replace(/\.0$/, "")}m`;
  if (abs >= 1000) return `R${(amount / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return salesDashboardCurrency(amount);
}

function salesInsightsCompactNumber(value) {
  const amount = Number(value || 0);
  const abs = Math.abs(amount);
  if (abs >= 1000000) return `${(amount / 1000000).toFixed(2).replace(/\.00$/, "")}m`;
  if (abs >= 1000) return `${(amount / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return salesDashboardNumber(amount);
}

function salesInsightsPrice(value) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
}

function salesInsightsTitleCase(value) {
  const raw = String(value || "").trim().toUpperCase();
  const names = {
    "GAUTENG": "Gauteng",
    "WESTERN CAPE": "Western Cape",
    "KWAZULU NATAL": "KwaZulu-Natal",
    "KWAZULU-NATAL": "KwaZulu-Natal",
    "MPUMALANGA": "Mpumalanga",
    "FREE STATE": "Free State",
    "LIMPOPO": "Limpopo",
    "NORTH WEST": "North West",
    "NORTHERN CAPE": "Northern Cape",
    "EASTERN CAPE": "Eastern Cape"
  };
  return names[raw] || String(value || "").toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function salesInsightsVsBadge(value = 0, note = "vs prior period") {
  const numeric = Number(value || 0);
  const tone = numeric >= 0 ? "up" : "down";
  const arrow = numeric >= 0 ? "▲" : "▼";
  return `<span class="si-delta ${tone}">${arrow} ${Math.abs(numeric).toFixed(1)}%</span><span class="si-delta-note">${escapeHtml(note)}</span>`;
}

function salesInsightsMetricDelta(rows, metric = "value") {
  const monthly = rows || [];
  if (monthly.length < 2) return 0;
  const current = Number(monthly[monthly.length - 1]?.[metric] || 0);
  const previous = Number(monthly[0]?.[metric] || 0);
  return previous ? ((current / previous) - 1) * 100 : 0;
}

function salesInsightsDriverRows(rows, metric = "value", gain = true) {
  const usable = (rows || []).filter((row) => row.label && row.label !== "Unassigned");
  const sorted = [...usable].sort((left, right) => Number(right[metric] || 0) - Number(left[metric] || 0));
  const max = Math.max(...sorted.map((row) => Number(row[metric] || 0)), 1);
  const selected = gain ? sorted.slice(0, 8) : sorted.slice(-8).reverse();
  return selected.map((row) => {
    const value = Number(row[metric] || 0);
    return `<div class="si-driver-row" data-insights-pick="${escapeHtml(row.label)}"><div><span title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</span><strong>${metric === "quantity" ? salesInsightsCompactNumber(value) : salesInsightsCompactCurrency(value)}</strong></div><i style="width:${Math.max(4, Math.round(value / max * 100))}%"></i></div>`;
  }).join("") || `<p class="insights-detail-empty">No imported dimension values are available for this selection.</p>`;
}

function salesInsightsSourceCard(kicker, body, tone = "orange", icon = "ph-tag") {
  return `<article class="si-source-card ${tone}"><i class="ph ${icon}" aria-hidden="true"></i><div><span>${escapeHtml(kicker)}</span><p>${body}</p></div></article>`;
}

function salesInsightsKpiGrid(kpis, wide = false) {
  return `<section class="si-source-kpis${wide ? " si-source-kpis-wide" : ""}">${kpis.map((kpi, index) => `<article class="${escapeHtml(kpi.tone || ["orange", "blue", "green", "gold", "red", "violet"][index % 6])}"><span>${escapeHtml(kpi.label)}</span><strong>${escapeHtml(kpi.value)}</strong><small>${kpi.note || ""}</small></article>`).join("")}</section>`;
}

function salesInsightsShareRows(rows, total, metric = "value", blue = false, limit = 8) {
  return (rows || []).slice(0, limit).map((row) => {
    const share = total ? Number(row[metric] || 0) / total * 100 : 0;
    return `<div class="si-share-row${blue ? " blue" : ""}"><span title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</span><i><b style="width:${Math.max(3, share)}%"></b></i><em>${share.toFixed(1)}%</em></div>`;
  }).join("") || `<p class="insights-detail-empty">No imported values are available for this selection.</p>`;
}

function salesInsightsLeagueRows(rows, totalValue, totalUnits, metric = "value", limit = 18, dataset = "") {
  const max = Math.max(...(rows || []).map((row) => Number(row[metric] || row.value || 0)), 1);
  return (rows || []).slice(0, limit).map((row, index) => {
    const value = Number(row.value || 0);
    const units = Number(row.quantity || 0);
    const price = units ? value / units : 0;
    const share = totalValue ? value / totalValue * 100 : 0;
    const attr = dataset ? ` ${dataset}="${escapeHtml(row.label)}"` : "";
    return `<tr class="si-row"${attr}><td>${String(index + 1).padStart(2, "0")}</td><td title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</td><td>${salesInsightsCompactCurrency(value)}</td><td>${salesInsightsCompactNumber(units)}</td><td>${salesInsightsPrice(price)}</td><td>${share.toFixed(1)}%</td><td><span class="si-line-pair"><b style="width:${Math.max(3, Math.round(Number(row[metric] || row.value || 0) / max * 100))}%"></b><i style="width:${Math.max(2, Math.round(units / Math.max(1, totalUnits) * 100))}%"></i></span></td></tr>`;
  }).join("") || `<tr><td colspan="7">No verified rows are available for this selection.</td></tr>`;
}

function salesInsightsTablePanel(title, subtitle, rows, dataset = "") {
  return `<section class="si-panel si-source-table-panel"><header><div><h3>${escapeHtml(title)}</h3>${subtitle ? `<span>${escapeHtml(subtitle)}</span>` : ""}</div></header><div class="si-source-table-wrap"><table><thead><tr><th>Rank</th><th>Name</th><th>Value</th><th>Volume</th><th>Avg price</th><th>Share</th><th>Value / volume</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function salesInsightsRowIndex(rows = []) {
  return new Map((rows || []).map((row) => [String(row.label || ""), row]));
}

function salesInsightsPercentChange(current, prior) {
  const before = Number(prior || 0);
  if (!before) return Number(current || 0) ? 100 : 0;
  return ((Number(current || 0) / before) - 1) * 100;
}

function salesInsightsChangeBadge(value, suffix = "%") {
  const numeric = Number(value || 0);
  const tone = numeric >= 0 ? "up" : "down";
  const sign = numeric >= 0 ? "+" : "-";
  return `<strong class="si-channel-change ${tone}">${sign}${Math.abs(numeric).toFixed(1)}${suffix}</strong>`;
}

function salesInsightsMonthLabel(periodKey, compact = false) {
  const match = String(periodKey || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return periodKey || "current period";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  const month = date.toLocaleString("en-ZA", { month: compact ? "short" : "long", timeZone: "UTC" });
  return compact ? `${month} ${String(match[1]).slice(2)}` : `${month} ${match[1]}`;
}

function salesInsightsSparkPath(values, width = 220, height = 40) {
  const series = (values || []).map((value) => Number(value || 0));
  if (!series.length) return "";
  const min = Math.min(...series);
  const max = Math.max(...series);
  return series.map((value, index) => {
    const x = series.length > 1 ? (index / (series.length - 1)) * width : 0;
    const y = height - 4 - ((value - min) / (max - min || 1)) * (height - 8);
    return `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}

function salesInsightsCleanRows(rows = []) {
  return (rows || []).filter((row) => row.label && row.label !== "Unassigned");
}

function salesInsightsRowDelta(rows, priorRows, metric = "value", positive = true) {
  const priorByLabel = salesInsightsRowIndex(priorRows);
  const deltas = salesInsightsCleanRows(rows).map((row) => {
    const delta = Number(row[metric] || 0) - Number(priorByLabel.get(String(row.label || ""))?.[metric] || 0);
    return { row, delta };
  }).filter((item) => positive ? item.delta >= 0 : item.delta < 0);
  return deltas.sort((left, right) => positive ? right.delta - left.delta : left.delta - right.delta)[0] || null;
}

function salesInsightsMonthlyRows(rows = []) {
  return [...(rows || [])].sort((left, right) => String(left.label || "").localeCompare(String(right.label || ""))).map((row) => ({
    label: row.label,
    value: Number(row.value || 0),
    quantity: Number(row.quantity || 0),
    orders: Number(row.orders || 0)
  }));
}

function salesInsightsWindowSummary(rows, months = 12) {
  const windowRows = salesInsightsMonthlyRows(rows).slice(-Math.max(1, Number(months || 1)));
  return {
    rows: windowRows,
    start: windowRows[0]?.label || "",
    end: windowRows[windowRows.length - 1]?.label || "",
    value: windowRows.reduce((total, row) => total + Number(row.value || 0), 0),
    quantity: windowRows.reduce((total, row) => total + Number(row.quantity || 0), 0)
  };
}

function salesInsightsRollingCard(label, windowLabel, currentRows, priorRows, months) {
  const current = salesInsightsWindowSummary(currentRows, months);
  const prior = salesInsightsWindowSummary(priorRows, months);
  const delta = salesInsightsPercentChange(current.value, prior.value);
  const tone = delta >= 0 ? "up" : "down";
  return `<article class="si-exec-period-card">
    <div><span>${escapeHtml(label)}</span><small>${escapeHtml(windowLabel)}</small></div>
    <div><strong>${salesInsightsCompactCurrency(current.value)}</strong><small>${salesInsightsCompactNumber(current.quantity)} units</small></div>
    <div><b class="${tone}">${delta >= 0 ? "+" : "-"}${Math.abs(delta).toFixed(1)}%</b><small>vs prior yr</small></div>
  </article>`;
}

function salesInsightsKpiCard(label, value, delta, note, values, tone = "orange") {
  const showDelta = Number.isFinite(Number(delta));
  const direction = Number(delta || 0) >= 0 ? "up" : "down";
  return `<article class="si-exec-kpi ${escapeHtml(tone)}">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value)}</strong>
    <small>${showDelta ? `<b class="${direction}">${direction === "up" ? "▲" : "▼"} ${Math.abs(Number(delta || 0)).toFixed(1)}%</b>` : ""}<em>${escapeHtml(note)}</em></small>
    <svg viewBox="0 0 220 40" preserveAspectRatio="none" aria-hidden="true"><path d="${salesInsightsSparkPath(values, 220, 40)}"></path></svg>
  </article>`;
}

function salesInsightsOverviewFinding(kicker, body, tone = "neutral") {
  const mark = tone === "up" ? "▲" : tone === "down" ? "▼" : "•";
  return `<article class="si-exec-finding ${tone}"><i>${mark}</i><div><span>${escapeHtml(kicker)}</span><p>${body}</p></div></article>`;
}

function salesInsightsLineChart(title, metric, currentRows, priorRows, shareRows, priorShareRows, total, priorTotal, formatter) {
  const current = salesInsightsMonthlyRows(currentRows).slice(-12);
  const prior = salesInsightsMonthlyRows(priorRows).slice(-12);
  const currentValues = current.map((row) => Number(row[metric] || 0));
  const priorValues = prior.map((row) => Number(row[metric] || 0));
  const all = currentValues.concat(priorValues.length ? priorValues : currentValues);
  const minRaw = Math.min(...all, 0);
  const maxRaw = Math.max(...all, 1);
  const pad = (maxRaw - minRaw) * 0.12 || maxRaw * 0.1 || 1;
  const min = Math.max(0, minRaw - pad);
  const max = maxRaw + pad;
  const x = (index, count) => 6 + (index / Math.max(1, count - 1)) * 568;
  const y = (value) => 8 + (1 - ((value - min) / (max - min || 1))) * 186;
  const path = (values) => {
    const points = values.map((value, index) => [x(index, values.length), y(value)]);
    if (points.length < 2) return "";
    let output = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
    for (let index = 0; index < points.length - 1; index += 1) {
      const p0 = points[index - 1] || points[index];
      const p1 = points[index];
      const p2 = points[index + 1];
      const p3 = points[index + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6;
      const c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6;
      const c2y = p2[1] - (p3[1] - p1[1]) / 6;
      output += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return output;
  };
  const grid = Array.from({ length: 6 }, (_, index) => {
    const value = min + ((5 - index) / 5) * (max - min);
    return { y: y(value).toFixed(1), label: formatter(value) };
  });
  const peakIndex = currentValues.indexOf(Math.max(...currentValues));
  const lowIndex = currentValues.indexOf(Math.min(...currentValues));
  const mark = (index, label, color) => currentValues.length ? `<circle cx="${x(index, currentValues.length).toFixed(1)}" cy="${y(currentValues[index]).toFixed(1)}" r="3.4" fill="${color}"></circle><text x="${x(index, currentValues.length).toFixed(1)}" y="${Math.max(12, y(currentValues[index]) - 9).toFixed(1)}" fill="${color}" text-anchor="${x(index, currentValues.length) > 430 ? "end" : "start"}">${escapeHtml(label)} - ${formatter(currentValues[index])}</text>` : "";
  const shareByLabel = salesInsightsRowIndex(priorShareRows);
  const palette = ["#ec6d25", "#f2955c", "#5b9bd5", "#3b82f6", "#9dc4ec", "#4a6b8a"];
  const shares = salesInsightsCleanRows(shareRows).slice(0, 4).map((row, index) => {
    const value = Number(row[metric] || 0);
    const priorValue = Number(shareByLabel.get(String(row.label || ""))?.[metric] || 0);
    const share = total ? value / total * 100 : 0;
    const priorShare = priorTotal ? priorValue / priorTotal * 100 : 0;
    return `<li><span style="background:${palette[index % palette.length]};width:${Math.max(3, share)}%"></span><b>${escapeHtml(row.label)}</b><em>${share.toFixed(1)}%</em>${salesInsightsChangeBadge(share - priorShare, "pp")}</li>`;
  }).join("");
  return `<section class="si-panel si-exec-chart">
    <header><h3>${escapeHtml(title)}</h3><button type="button" data-insights-page-jump="trend">Open Trend Analysis →</button></header>
    <div class="si-exec-chart-legend"><span><i></i>Current period (${escapeHtml(salesInsightsMonthLabel(current[0]?.label, true))} - ${escapeHtml(salesInsightsMonthLabel(current[current.length - 1]?.label, true))})</span><span><i></i>Prior year (${escapeHtml(salesInsightsMonthLabel(prior[0]?.label, true))} - ${escapeHtml(salesInsightsMonthLabel(prior[prior.length - 1]?.label, true))})</span></div>
    <strong class="si-exec-axis">${metric === "value" ? "Sales value (R)" : "Sales volume (units)"}</strong>
    <div class="si-exec-plot"><aside>${grid.map((row) => `<span>${escapeHtml(row.label)}</span>`).join("")}</aside><svg viewBox="0 0 580 210" preserveAspectRatio="none" aria-hidden="true">${grid.map((row) => `<line x1="0" x2="580" y1="${row.y}" y2="${row.y}"></line>`).join("")}${currentValues.map((value, index) => `<line class="vline" x1="${x(index, currentValues.length).toFixed(1)}" x2="${x(index, currentValues.length).toFixed(1)}" y1="6" y2="196"></line>`).join("")}<path class="prior" d="${path(priorValues)}"></path><path class="current" d="${path(currentValues)}"></path>${mark(peakIndex, "Peak", "#ec6d25")}${lowIndex !== peakIndex ? mark(lowIndex, "Low", "#d94f3a") : ""}</svg></div>
    <div class="si-exec-ticks">${current.map((row) => `<span>${escapeHtml(salesInsightsMonthLabel(row.label, true))}</span>`).join("")}</div>
    <div class="si-exec-share"><h4>${metric === "value" ? "Value Share" : "Volume Share"}</h4><p>Rolling 12-month share of ${metric === "value" ? "value" : "volume"}, and its move on the prior period</p><span>By product bucket</span><ul>${shares || "<li>No product bucket split is available.</li>"}</ul></div>
  </section>`;
}

function renderSalesInsightsOverview(data) {
  const container = elements.insightsOverviewPage || document.querySelector("#insightsOverviewPage");
  if (!container) return;
  if (!data?.metrics?.orderLines) {
    container.className = "sales-insights-overview-page si-exec-overview";
    container.innerHTML = `<section class="si-panel si-exec-empty">Run the Geo sales import to populate the Executive Overview.</section>`;
    return;
  }
  const metrics = data.metrics || {};
  const priorMetrics = data.priorMetrics || {};
  const charts = data.charts || {};
  const priorCharts = data.priorCharts || {};
  const monthly = salesInsightsMonthlyRows(charts.monthly);
  const priorMonthly = salesInsightsMonthlyRows(priorCharts.monthly);
  const current12 = salesInsightsWindowSummary(monthly, 12);
  const prior12 = salesInsightsWindowSummary(priorMonthly, 12);
  const totalValue = Number(metrics.salesValue || current12.value || 0);
  const totalUnits = Number(metrics.quantity || current12.quantity || 0);
  const priorValue = Number(priorMetrics.salesValue || prior12.value || 0);
  const priorUnits = Number(priorMetrics.quantity || prior12.quantity || 0);
  const avgPrice = totalUnits ? totalValue / totalUnits : 0;
  const priorAvgPrice = priorUnits ? priorValue / priorUnits : 0;
  const valueDelta = salesInsightsPercentChange(totalValue, priorValue);
  const unitsDelta = salesInsightsPercentChange(totalUnits, priorUnits);
  const priceDelta = salesInsightsPercentChange(avgPrice, priorAvgPrice);
  const storesDelta = salesInsightsPercentChange(metrics.stores, priorMetrics.stores);
  const months = Number(data.windowMonths || monthly.length || 12) || 12;
  const scope = [
    elements.insightsClient?.value ? elements.insightsClient.options[elements.insightsClient.selectedIndex]?.text : "",
    elements.insightsCategory?.value ? elements.insightsCategory.options[elements.insightsCategory.selectedIndex]?.text : "",
    elements.insightsRegion?.value ? elements.insightsRegion.options[elements.insightsRegion.selectedIndex]?.text : "",
    elements.insightsBrand?.value ? elements.insightsBrand.options[elements.insightsBrand.selectedIndex]?.text : "",
    elements.insightsProduct?.value ? elements.insightsProduct.options[elements.insightsProduct.selectedIndex]?.text : ""
  ].filter(Boolean).join(" - ") || "All clients";
  const categoryGain = salesInsightsRowDelta(charts.byCategory, priorCharts.byCategory, "value", true);
  const categoryDecline = salesInsightsRowDelta(charts.byCategory, priorCharts.byCategory, "value", false);
  const brandGain = salesInsightsRowDelta(charts.byBrand, priorCharts.byBrand, "value", true);
  const brandDecline = salesInsightsRowDelta(charts.byBrand, priorCharts.byBrand, "value", false);
  const regionGain = salesInsightsRowDelta(charts.byRegion, priorCharts.byRegion, "value", true);
  const regionDecline = salesInsightsRowDelta(charts.byRegion, priorCharts.byRegion, "value", false);
  const leaderCategory = salesInsightsCleanRows(charts.byCategory)[0];
  const leaderRegion = salesInsightsCleanRows(charts.byRegion)[0];
  const topStores = salesInsightsCleanRows(charts.byStore);
  const rolling3 = salesInsightsWindowSummary(monthly, 3);
  const priorRolling3 = salesInsightsWindowSummary(priorMonthly, 3);
  const rolling6 = salesInsightsWindowSummary(monthly, 6);
  const priorRolling6 = salesInsightsWindowSummary(priorMonthly, 6);
  const rolling3Delta = salesInsightsPercentChange(rolling3.value, priorRolling3.value);
  const rolling6Delta = salesInsightsPercentChange(rolling6.value, priorRolling6.value);
  const recentMonth = monthly[monthly.length - 1] || {};
  const priorRecentMonth = priorMonthly[priorMonthly.length - 1] || {};
  const recentDelta = salesInsightsPercentChange(recentMonth.value, priorRecentMonth.value);
  const focusItems = [
    categoryGain?.row ? `${escapeHtml(categoryGain.row.label)} is the largest positive category contribution at ${salesInsightsCompactCurrency(categoryGain.delta)} over the last ${salesDashboardNumber(months)} months.` : leaderCategory ? `${escapeHtml(leaderCategory.label)} is the largest category in the selected view.` : "",
    categoryDecline?.row ? `${escapeHtml(categoryDecline.row.label)} is the largest category decline at -${salesInsightsCompactCurrency(Math.abs(categoryDecline.delta)).replace(/^R/, "R")}.` : "",
    recentMonth.label ? `${escapeHtml(salesInsightsMonthLabel(recentMonth.label))} is ${Math.abs(recentDelta).toFixed(1)}% ${recentDelta >= 0 ? "above" : "below"} the same month in the prior period.` : "",
    leaderRegion ? `${escapeHtml(leaderRegion.label)} leads regional sales at ${salesInsightsCompactCurrency(leaderRegion.value)}.` : ""
  ].filter(Boolean);
  const findings = [
    salesInsightsOverviewFinding("Regional movement", regionGain?.row ? `${escapeHtml(regionGain.row.label)} added ${salesInsightsCompactCurrency(regionGain.delta)}, while ${escapeHtml(regionDecline?.row?.label || "the weakest region")} declined ${regionDecline ? salesInsightsCompactCurrency(Math.abs(regionDecline.delta)) : "0"}.` : "Regional prior movement is waiting for comparable rows.", regionGain ? "up" : "neutral"),
    salesInsightsOverviewFinding("Range breadth", `${salesDashboardNumber((charts.byBrand || []).length)} brands across ${salesDashboardNumber((charts.byCategory || []).length)} categories traded in ${salesDashboardNumber(metrics.stores || 0)} stores.`, "neutral"),
    salesInsightsOverviewFinding("Price & mix", `Value moved ${valueDelta.toFixed(1)}% while units moved ${unitsDelta.toFixed(1)}%; average unit price moved ${priceDelta.toFixed(1)}%.`, priceDelta >= 0 ? "up" : "down"),
    salesInsightsOverviewFinding("Brand contribution", brandGain?.row ? `${escapeHtml(brandGain.row.label)} added ${salesInsightsCompactCurrency(brandGain.delta)}; ${escapeHtml(brandDecline?.row?.label || "the weakest brand")} declined ${brandDecline ? salesInsightsCompactCurrency(Math.abs(brandDecline.delta)) : "0"}.` : "Brand movement needs comparable prior rows.", brandGain ? "up" : "neutral"),
    salesInsightsOverviewFinding("Concentration", topStores[0] ? `${escapeHtml(topStores[0].label)} is the largest store contributor in the current selection.` : "No store contribution is available.", "neutral"),
    salesInsightsOverviewFinding("Store health", `${salesDashboardNumber(metrics.stores || 0)} stores traded across ${salesDashboardNumber(metrics.orderLines || 0)} verified lines.`, storesDelta >= 0 ? "up" : "down"),
    salesInsightsOverviewFinding("Momentum", `Rolling 3-month value is ${rolling3Delta.toFixed(1)}% and 6-month value is ${rolling6Delta.toFixed(1)}% against the prior year.`, rolling3Delta >= 0 ? "up" : "down"),
    salesInsightsOverviewFinding("Watch list", categoryDecline?.row ? `${escapeHtml(categoryDecline.row.label)} should be reviewed first because it has the largest value decline.` : "No category decline is visible in this selection.", categoryDecline ? "down" : "neutral")
  ];
  container.className = "sales-insights-overview-page si-exec-overview";
  container.innerHTML = `
    <section class="si-exec-kpis" aria-label="Sales Insights performance indicators">
      ${salesInsightsKpiCard("Net sales", salesInsightsCompactCurrency(totalValue), valueDelta, `vs prior ${months} months`, monthly.map((row) => row.value), "orange")}
      ${salesInsightsKpiCard("Units sold", salesInsightsCompactNumber(totalUnits), unitsDelta, `vs prior ${months} months`, monthly.map((row) => row.quantity), "blue")}
      ${salesInsightsKpiCard("Avg unit price", salesInsightsPrice(avgPrice), priceDelta, `vs prior ${months} months`, monthly.map((row) => row.quantity ? row.value / row.quantity : 0), "green")}
      ${salesInsightsKpiCard("Avg per month", salesInsightsCompactCurrency(totalValue / Math.max(1, months)), NaN, `average over ${months} months`, monthly.map((row) => row.value), "gold")}
      ${salesInsightsKpiCard("Stores Trading", salesDashboardNumber(metrics.stores || 0), storesDelta, `vs prior ${months} months`, monthly.map((row) => row.orders), "red")}
    </section>
    <section class="si-exec-periods" aria-label="Rolling sales periods">
      ${salesInsightsRollingCard("MTD", salesInsightsMonthLabel(recentMonth.label || data.periodKey, true), monthly, priorMonthly, 1)}
      ${salesInsightsRollingCard("3M", "rolling 3 months", monthly, priorMonthly, 3)}
      ${salesInsightsRollingCard("6M", "rolling 6 months", monthly, priorMonthly, 6)}
      ${salesInsightsRollingCard("12M", "rolling 12 months", monthly, priorMonthly, 12)}
    </section>
    <section class="si-panel si-exec-intelligence">
      <header><h3>Executive intelligence</h3><span>Based on current filters</span></header>
      <p class="si-exec-headline"><b>${escapeHtml(scope)}</b><i>-</i><strong>${salesInsightsCompactCurrency(totalValue)}</strong><span>in the ${salesDashboardNumber(months)} months to ${escapeHtml(salesInsightsMonthLabel(data.periodKey || current12.end))}</span><em class="${valueDelta >= 0 ? "up" : "down"}">${valueDelta >= 0 ? "up" : "down"} ${Math.abs(valueDelta).toFixed(1)}%</em><i>-</i><strong>${salesInsightsCompactNumber(totalUnits)}</strong><span>units</span><i>-</i><strong>${salesDashboardNumber(metrics.stores || 0)}</strong><span>trading stores</span></p>
      <div class="si-exec-intel-cards">
        ${salesInsightsSourceCard("Value vs volume", `Value moved ${valueDelta.toFixed(1)}% while units moved ${unitsDelta.toFixed(1)}% - average unit price ${priceDelta >= 0 ? "improved" : "declined"} ${Math.abs(priceDelta).toFixed(1)}% over the selected period.`, "green", "ph-chart-bar")}
        ${salesInsightsSourceCard("Biggest driver", categoryGain?.row ? `${escapeHtml(categoryGain.row.label)} generated the largest positive category movement at ${salesInsightsCompactCurrency(categoryGain.delta)}.` : leaderCategory ? `${escapeHtml(leaderCategory.label)} is the biggest current category.` : "No category driver is available.", "orange", "ph-arrow-up-right")}
        ${salesInsightsSourceCard("Outlook", `Six-month momentum is ${rolling6Delta >= 0 ? "positive" : "negative"} at ${rolling6Delta.toFixed(1)}%; the latest month is ${recentDelta.toFixed(1)}% against its prior comparison.`, rolling6Delta >= 0 ? "blue" : "red", "ph-chart-pie-slice")}
      </div>
      <div class="si-exec-focus"><span>Where to focus</span><div>${focusItems.map((item) => `<p><b>→</b>${item}</p>`).join("") || "<p><b>→</b>Load comparable Geo sales rows to calculate focus areas.</p>"}</div></div>
      <details class="si-exec-findings"><summary>Full insight summary - ${findings.length} findings</summary><div>${findings.join("")}</div></details>
    </section>
    <section class="si-exec-chart-grid">
      ${salesInsightsLineChart("12-Month Sales Value", "value", monthly, priorMonthly, charts.byCategory || charts.byProduct || [], priorCharts.byCategory || priorCharts.byProduct || [], totalValue, priorValue, salesInsightsCompactCurrency)}
      ${salesInsightsLineChart("12-Month Sales Volume", "quantity", monthly, priorMonthly, charts.byCategory || charts.byProduct || [], priorCharts.byCategory || priorCharts.byProduct || [], totalUnits, priorUnits, salesInsightsCompactNumber)}
    </section>`;
  container.querySelectorAll("[data-insights-page-jump]").forEach((button) => button.addEventListener("click", () => updateSalesInsightsPage(button.dataset.insightsPageJump)));
}

function salesInsightsChannelRows(rows, priorRows, totalValue, totalUnits, priorValue, priorUnits) {
  const priorByLabel = salesInsightsRowIndex(priorRows);
  const maxValue = Math.max(...(rows || []).map((row) => Number(row.value || 0)), 1);
  const maxUnits = Math.max(...(rows || []).map((row) => Number(row.quantity || 0)), 1);
  return (rows || []).slice(0, 10).map((row) => {
    const prior = priorByLabel.get(String(row.label || "")) || {};
    const value = Number(row.value || 0);
    const units = Number(row.quantity || 0);
    const valueShare = totalValue ? value / totalValue * 100 : 0;
    const priorValueShare = priorValue ? Number(prior.value || 0) / priorValue * 100 : 0;
    const unitShare = totalUnits ? units / totalUnits * 100 : 0;
    const priorUnitShare = priorUnits ? Number(prior.quantity || 0) / priorUnits * 100 : 0;
    return `<tr class="si-row" data-insights-channel="${escapeHtml(row.label)}">
      <td><span class="si-channel-color"></span>${escapeHtml(row.label)}</td>
      <td>${salesInsightsCompactCurrency(value)}</td>
      <td><span class="si-channel-bar"><b style="width:${Math.max(3, value / maxValue * 100)}%"></b></span><em>${valueShare.toFixed(1)}%</em></td>
      <td>${salesInsightsChangeBadge(salesInsightsPercentChange(value, prior.value))}</td>
      <td>${salesInsightsCompactNumber(units)}</td>
      <td><span class="si-channel-bar blue"><b style="width:${Math.max(3, units / maxUnits * 100)}%"></b></span><em>${unitShare.toFixed(1)}%</em></td>
      <td>${salesInsightsChangeBadge(salesInsightsPercentChange(units, prior.quantity))}</td>
      <td>${salesInsightsChangeBadge(valueShare - priorValueShare || unitShare - priorUnitShare, "pp")}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="8">No channel rows are available for this selection.</td></tr>`;
}

function salesInsightsLargestChange(rows, priorRows, metric = "value", positive = true) {
  const priorByLabel = salesInsightsRowIndex(priorRows);
  const candidates = (rows || []).map((row) => ({ row, delta: Number(row[metric] || 0) - Number(priorByLabel.get(String(row.label || ""))?.[metric] || 0) }));
  const filtered = candidates.filter((item) => positive ? item.delta >= 0 : item.delta < 0);
  const sorted = filtered.sort((left, right) => positive ? right.delta - left.delta : left.delta - right.delta);
  return sorted[0] || null;
}

function salesInsightsChannelWaterfall(rows, priorRows) {
  const priorByLabel = salesInsightsRowIndex(priorRows);
  const deltas = (rows || []).slice(0, 8).map((row) => ({
    label: row.label,
    delta: Number(row.value || 0) - Number(priorByLabel.get(String(row.label || ""))?.value || 0)
  }));
  const totalDelta = deltas.reduce((total, row) => total + row.delta, 0);
  const allRows = [...deltas, { label: "All retailers", delta: totalDelta, total: true }];
  const max = Math.max(...allRows.map((row) => Math.abs(row.delta)), 1);
  return `<div class="si-waterfall-chart">${allRows.map((row) => {
    const height = Math.max(8, Math.abs(row.delta) / max * 150);
    const positive = row.delta >= 0;
    return `<div class="si-waterfall-col ${positive ? "up" : "down"}${row.total ? " total" : ""}">
      <strong>${positive ? "+" : "-"}${salesInsightsCompactCurrency(Math.abs(row.delta)).replace(/^R/, "R")}</strong>
      <i style="height:${height}px"></i>
      <span title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</span>
    </div>`;
  }).join("")}</div>`;
}

function salesInsightsRetailerComparison(rows, priorRows) {
  const priorByLabel = salesInsightsRowIndex(priorRows);
  const max = Math.max(...(rows || []).slice(0, 8).flatMap((row) => [Number(row.value || 0), Number(priorByLabel.get(String(row.label || ""))?.value || 0)]), 1);
  return `<div class="si-retailer-bars">${(rows || []).slice(0, 8).map((row) => {
    const prior = Number(priorByLabel.get(String(row.label || ""))?.value || 0);
    const current = Number(row.value || 0);
    const change = salesInsightsPercentChange(current, prior);
    return `<div class="si-retailer-bar" data-insights-retailer="${escapeHtml(row.label)}">
      <span title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</span>
      <i><b class="prior" style="width:${Math.max(2, prior / max * 100)}%"></b><b class="current" style="width:${Math.max(2, current / max * 100)}%"></b></i>
      <strong>${salesInsightsCompactCurrency(current)}</strong>
      ${salesInsightsChangeBadge(change)}
    </div>`;
  }).join("") || `<p class="insights-detail-empty">No retailer rows are available for this selection.</p>`}</div>`;
}

function salesInsightsMiniLine(title, rows, metric = "value") {
  const usable = (rows || []).slice(0, 8);
  const max = Math.max(...usable.map((row) => Number(row[metric] || 0)), 1);
  const points = usable.map((row, index) => {
    const x = usable.length > 1 ? (index / (usable.length - 1)) * 620 : 0;
    const y = 205 - (Number(row[metric] || 0) / max * 190);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return `<section class="si-panel si-line-panel"><header><h3>${escapeHtml(title)}</h3><span>Current imported window</span></header><svg viewBox="0 0 620 210" preserveAspectRatio="none" aria-hidden="true"><g>${[0, 52.5, 105, 157.5, 210].map((y) => `<line x1="0" x2="620" y1="${y}" y2="${y}"></line>`).join("")}</g><polyline points="${points}" fill="none"></polyline></svg><div>${usable.map((row) => `<span title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</span>`).join("")}</div></section>`;
}

function renderSalesInsightsDimensionPage(data, container, config) {
  const metrics = data?.metrics || {};
  const charts = data?.charts || {};
  const rows = (charts[config.chart] || []).filter((row) => row.label && row.label !== "Unassigned");
  const secondary = (charts[config.secondaryChart] || []).filter((row) => row.label && row.label !== "Unassigned");
  const totalValue = Number(metrics.salesValue || 0);
  const totalUnits = Number(metrics.quantity || 0);
  const avgPrice = totalUnits ? totalValue / totalUnits : 0;
  const leader = rows[0];
  const second = rows[1];
  container.className = `insights-source-page si-source-detail si-${config.slug}-page`;
  container.innerHTML = `
    ${salesInsightsKpiGrid([
      { label: config.totalLabel, value: salesInsightsCompactCurrency(totalValue), note: salesInsightsVsBadge(salesInsightsMetricDelta(charts.monthly, "value"), "vs first loaded month"), tone: "orange" },
      { label: "Units sold", value: salesInsightsCompactNumber(totalUnits), note: salesInsightsVsBadge(salesInsightsMetricDelta(charts.monthly, "quantity"), "vs first loaded month"), tone: "blue" },
      { label: `Active ${config.dimensionPlural}`, value: salesDashboardNumber(rows.length), note: `<span class="si-delta flat">${salesDashboardNumber(secondary.length)}</span><span class="si-delta-note">${escapeHtml(config.secondaryPlural)}</span>`, tone: "green" },
      { label: "Average price", value: salesInsightsPrice(avgPrice), note: `<span class="si-delta up">Live</span><span class="si-delta-note">current selection</span>`, tone: "gold" }
    ])}
    <section class="si-panel si-intel-panel">
      <header><h3>${escapeHtml(config.intelligenceTitle)}</h3><span>${salesDashboardNumber(rows.length)} ${escapeHtml(config.dimensionPlural)} - rolling ${salesDashboardNumber(data?.windowMonths || 12)} months</span></header>
      <p class="si-source-headline"><b>All ${escapeHtml(config.dimensionPlural)}</b><i>-</i><span>${leader ? `${escapeHtml(leader.label)} leads selected value at ${salesInsightsCompactCurrency(leader.value)}, across ${salesInsightsCompactNumber(leader.quantity)} units.` : `No ${escapeHtml(config.dimensionPlural)} are available in the imported Geo sales data yet.`}</span></p>
      <div class="si-source-card-grid">
        ${salesInsightsSourceCard(config.leaderKicker, leader ? `${escapeHtml(leader.label)} is the largest contributor in the current filter.` : "No leader is available.", "orange", config.icon)}
        ${salesInsightsSourceCard("Next opportunity", second ? `${escapeHtml(second.label)} follows at ${salesInsightsCompactCurrency(second.value)}.` : "A second contributor is not available in this filter.", "green", "ph-arrow-up-right")}
        ${salesInsightsSourceCard("Data caution", "Prior rolling-period comparisons need prior-window rows from Firebase; the current view uses verified current-window Geo sales.", "red", "ph-warning")}
      </div>
    </section>
    <section class="si-driver-grid">
      <article class="si-panel"><h3>${escapeHtml(config.valuePanel)}</h3><p>Value contribution by current selection.</p><div class="si-driver-columns"><section><span>Top contributors</span>${salesInsightsDriverRows(rows, "value", true)}</section><section><span>Long tail</span>${salesInsightsDriverRows(rows, "value", false)}</section></div></article>
      <article class="si-panel"><h3>${escapeHtml(config.volumePanel)}</h3><p>Volume contribution by current selection.</p><div class="si-driver-columns"><section><span>Top contributors</span>${salesInsightsDriverRows(rows, "quantity", true)}</section><section><span>Long tail</span>${salesInsightsDriverRows(rows, "quantity", false)}</section></div></article>
    </section>
    <section class="si-driver-grid">
      <article class="si-panel si-share-panel"><h3>Value share</h3>${salesInsightsShareRows(rows, totalValue, "value", false)}</article>
      <article class="si-panel si-share-panel"><h3>Volume share</h3>${salesInsightsShareRows(rows, totalUnits, "quantity", true)}</article>
    </section>
    ${salesInsightsMiniLine(config.trendTitle, rows, "value")}
    ${salesInsightsTablePanel(config.tableTitle, `${salesDashboardNumber(rows.length)} ${config.dimensionPlural}`, salesInsightsLeagueRows(rows, totalValue, totalUnits, "value", 20, config.datasetAttr))}`;
}

function renderSalesInsightsChannels(data, container) {
  const metrics = data?.metrics || {};
  const priorMetrics = data?.priorMetrics || {};
  const charts = data?.charts || {};
  const priorCharts = data?.priorCharts || {};
  const channels = (charts.byChannel || []).filter((row) => row.label && row.label !== "Unassigned");
  const priorChannels = (priorCharts.byChannel || []).filter((row) => row.label && row.label !== "Unassigned");
  const retailers = (charts.byRetailer || charts.byBanner || charts.byStore || []).filter((row) => row.label && row.label !== "Unassigned");
  const priorRetailers = (priorCharts.byRetailer || priorCharts.byBanner || []).filter((row) => row.label && row.label !== "Unassigned");
  const totalValue = Number(metrics.salesValue || 0);
  const totalUnits = Number(metrics.quantity || 0);
  const priorValue = Number(priorMetrics.salesValue || 0);
  const priorUnits = Number(priorMetrics.quantity || 0);
  const leader = retailers[0] || channels[0];
  const gain = salesInsightsLargestChange(retailers, priorRetailers, "value", true);
  const decline = salesInsightsLargestChange(retailers, priorRetailers, "value", false);
  const windowMonths = Number(data?.windowMonths || 12);
  const windowLabel = `rolling ${salesDashboardNumber(windowMonths)} months to ${escapeHtml(data?.periodKey || "current period")} against the prior ${salesDashboardNumber(windowMonths)}`;
  container.className = "insights-source-page si-source-detail si-channel-page";
  container.innerHTML = `
    <section class="si-panel si-intel-panel si-channel-intel">
      <header><h3>Channel Intelligence</h3><span>${salesDashboardNumber(channels.length)} channel types - ${salesDashboardNumber(retailers.length)} retailers - ${windowLabel}</span></header>
      <p class="si-source-headline"><b>All channels</b><i>-</i><span>Retailer value totals ${salesInsightsCompactCurrency(totalValue)} over the selected period, ${salesInsightsChangeBadge(salesInsightsPercentChange(totalValue, priorValue)).replace("strong", "span").replace("/strong", "/span")} versus the prior window, on ${salesInsightsCompactNumber(totalUnits)} units (${salesInsightsChangeBadge(salesInsightsPercentChange(totalUnits, priorUnits)).replace("strong", "span").replace("/strong", "/span")}).</span></p>
      <div class="si-source-card-grid">
        ${salesInsightsSourceCard("Largest retailer", leader ? `${escapeHtml(leader.label)} accounts for ${salesInsightsCompactCurrency(leader.value)} in retailer value.` : "No retailer leader is available.", "orange", "ph-storefront")}
        ${salesInsightsSourceCard("Biggest gain", gain?.row ? `${escapeHtml(gain.row.label)} added ${salesInsightsCompactCurrency(Math.abs(gain.delta))} versus the prior window.` : "No positive retailer movement is available.", "green", "ph-arrow-up-right")}
        ${salesInsightsSourceCard("Biggest decline", decline?.row ? `${escapeHtml(decline.row.label)} declined ${salesInsightsCompactCurrency(Math.abs(decline.delta))} versus the prior window.` : "No retailer decline is available.", "red", "ph-arrow-down-right")}
      </div>
    </section>
    <section class="si-panel si-channel-types-panel">
      <header><div><h3>Channel types</h3><span>Where value and volume sit by retailer type, and how each is moving</span></div><div class="si-segment"><button class="active" type="button">Rolling ${salesDashboardNumber(windowMonths)}m</button><button type="button">Latest 3m</button></div></header>
      <div class="si-source-table-wrap">
        <table class="si-channel-table">
          <thead><tr><th>Channel type</th><th>Value</th><th>Value share</th><th>Vs PP</th><th>Volume</th><th>Volume share</th><th>Vs PP</th><th>Share shift</th></tr></thead>
          <tbody>${salesInsightsChannelRows(channels, priorChannels, totalValue, totalUnits, priorValue, priorUnits)}</tbody>
        </table>
      </div>
    </section>
    <section class="si-panel si-retailer-contribution">
      <header><div><h3>Retailer contribution</h3></div><div class="si-segment"><span>Metric</span><button class="active" type="button">Value</button><button type="button">Volume</button></div></header>
      <div class="si-retailer-grid">
        <article><h4>What moved the value - retailer contribution</h4>${salesInsightsChannelWaterfall(retailers, priorRetailers)}</article>
        <article><h4>Top retailers - value, this year vs last</h4><div class="si-retailer-legend"><span><i></i>Prior window</span><span><i></i>Selected window</span></div>${salesInsightsRetailerComparison(retailers, priorRetailers)}</article>
      </div>
    </section>`;
}

function renderSalesInsightsCategories(data, container) {
  renderSalesInsightsDimensionPage(data, container, {
    slug: "category",
    chart: "byCategory",
    secondaryChart: "byBrand",
    dimensionPlural: "categories",
    secondaryPlural: "brands",
    totalLabel: "Category value",
    intelligenceTitle: "Category Intelligence",
    leaderKicker: "Category leader",
    valuePanel: "Product buckets",
    volumePanel: "Portfolio mix",
    trendTitle: "Category movement",
    tableTitle: "Category league table",
    datasetAttr: "data-insights-category",
    icon: "ph-cube"
  });
}

function renderSalesInsightsProducts(data, container) {
  const metrics = data?.metrics || {};
  const charts = data?.charts || {};
  const products = (charts.byProduct || []).filter((row) => row.label && row.label !== "Unassigned");
  const skus = (charts.bySku || []).filter((row) => row.label && row.label !== "Unassigned");
  const totalValue = Number(metrics.salesValue || 0);
  const totalUnits = Number(metrics.quantity || 0);
  const avgPrice = totalUnits ? totalValue / totalUnits : 0;
  const leader = products[0];
  container.className = "insights-source-page si-source-detail si-product-page";
  container.innerHTML = `
    ${salesInsightsKpiGrid([
      { label: "Product value", value: salesInsightsCompactCurrency(totalValue), note: salesInsightsVsBadge(salesInsightsMetricDelta(charts.monthly, "value"), "vs first loaded month"), tone: "orange" },
      { label: "Units sold", value: salesInsightsCompactNumber(totalUnits), note: salesInsightsVsBadge(salesInsightsMetricDelta(charts.monthly, "quantity"), "vs first loaded month"), tone: "blue" },
      { label: "Active products", value: salesDashboardNumber(products.length), note: `<span class="si-delta flat">${salesDashboardNumber(skus.length)}</span><span class="si-delta-note">SKUs</span>`, tone: "green" },
      { label: "Avg selling price", value: salesInsightsPrice(avgPrice), note: `<span class="si-delta up">Live</span><span class="si-delta-note">current selection</span>`, tone: "gold" }
    ], true)}
    <section class="si-panel si-intel-panel">
      <header><h3>Product Intelligence</h3><span>${salesDashboardNumber(products.length)} products - current filters</span></header>
      <p class="si-source-headline"><b>All products</b><i>-</i><span>${leader ? `${escapeHtml(leader.label)} leads product sales at ${salesInsightsCompactCurrency(leader.value)}.` : "No product records are available in the imported Geo sales data yet."}</span></p>
      <div class="si-source-card-grid">
        ${salesInsightsSourceCard("Product leader", leader ? `${escapeHtml(leader.label)} is the strongest current product.` : "No product leader available.", "orange", "ph-package")}
        ${salesInsightsSourceCard("SKU coverage", `${salesDashboardNumber(skus.length)} SKU values are available in the current import.`, "green", "ph-barcode")}
        ${salesInsightsSourceCard("Price signal", `Current average selling price is ${salesInsightsPrice(avgPrice)}.`, "blue", "ph-trend-up")}
      </div>
    </section>
    <section class="si-driver-grid">
      <article class="si-panel"><h3>Product value drivers</h3><p>Highest value products in the selected filters.</p><div class="si-driver-columns"><section><span>Top contributors</span>${salesInsightsDriverRows(products, "value", true)}</section><section><span>Long tail</span>${salesInsightsDriverRows(products, "value", false)}</section></div></article>
      <article class="si-panel"><h3>SKU demand</h3><p>Demand split at SKU level where available.</p><div class="si-driver-columns"><section><span>Top SKUs</span>${salesInsightsDriverRows(skus, "quantity", true)}</section><section><span>Long tail</span>${salesInsightsDriverRows(skus, "quantity", false)}</section></div></article>
    </section>
    ${salesInsightsMiniLine("Product movement", products, "value")}
    ${salesInsightsTablePanel("Product league table", `${salesDashboardNumber(products.length)} products`, salesInsightsLeagueRows(products, totalValue, totalUnits, "value", 24, "data-insights-product"))}`;
}

function renderSalesInsightsPriceMix(data, container) {
  const metrics = data?.metrics || {};
  const charts = data?.charts || {};
  const categories = (charts.byCategory?.length ? charts.byCategory : charts.byProduct || []).filter((row) => row.label && row.label !== "Unassigned");
  const totalValue = Number(metrics.salesValue || 0);
  const totalUnits = Number(metrics.quantity || 0);
  const avgPrice = totalUnits ? totalValue / totalUnits : 0;
  const monthly = charts.monthly || [];
  const valueDelta = salesInsightsMetricDelta(monthly, "value");
  const volumeDelta = salesInsightsMetricDelta(monthly, "quantity");
  const priceEffect = avgPrice * totalUnits * (valueDelta / 100);
  const volumeEffect = avgPrice * totalUnits * (volumeDelta / 100);
  const bridge = [
    ["Start", totalValue - priceEffect - volumeEffect, "flat"],
    ["Volume", volumeEffect, volumeEffect >= 0 ? "positive" : "negative"],
    ["Price", priceEffect, priceEffect >= 0 ? "positive" : "negative"],
    ["Mix", 0, "flat"],
    ["Net", totalValue, "total"]
  ].map(([name, value, tone]) => `<article class="${tone}"><span>${escapeHtml(name)}</span><strong>${salesInsightsCompactCurrency(value)}</strong></article>`).join("");
  const rows = salesInsightsLeagueRows(categories, totalValue, totalUnits, "value", 18, "data-insights-category");
  container.className = "insights-source-page si-source-detail si-price-page";
  container.innerHTML = `
    ${salesInsightsKpiGrid([
      { label: "Sales value", value: salesInsightsCompactCurrency(totalValue), note: `<span class="si-delta ${valueDelta >= 0 ? "up" : "down"}">${valueDelta >= 0 ? "▲" : "▼"} ${Math.abs(valueDelta).toFixed(1)}%</span><span class="si-delta-note">vs first loaded month</span>`, tone: "orange" },
      { label: "Volume", value: salesInsightsCompactNumber(totalUnits), note: `<span class="si-delta ${volumeDelta >= 0 ? "up" : "down"}">${volumeDelta >= 0 ? "▲" : "▼"} ${Math.abs(volumeDelta).toFixed(1)}%</span><span class="si-delta-note">vs first loaded month</span>`, tone: "blue" },
      { label: "Average price", value: salesInsightsPrice(avgPrice), note: `<span class="si-delta up">Live</span><span class="si-delta-note">current selection</span>`, tone: "gold" },
      { label: "Categories", value: salesDashboardNumber(categories.length), note: `<span class="si-delta flat">${salesDashboardNumber(metrics.orderLines || 0)}</span><span class="si-delta-note">rows</span>`, tone: "green" }
    ])}
    <section class="si-panel si-intel-panel">
      <header><h3>Price &amp; Mix Intelligence</h3><span>Current Geo sales window</span></header>
      <p class="si-source-headline"><b>All categories</b><i>-</i><span>Average price is ${salesInsightsPrice(avgPrice)} across ${salesInsightsCompactNumber(totalUnits)} units and ${salesInsightsCompactCurrency(totalValue)} value.</span></p>
      <div class="si-source-card-grid">
        ${salesInsightsSourceCard("Price effect", `Estimated current price contribution is ${salesInsightsCompactCurrency(priceEffect)}.`, "orange", "ph-currency-circle-dollar")}
        ${salesInsightsSourceCard("Volume effect", `Estimated current volume contribution is ${salesInsightsCompactCurrency(volumeEffect)}.`, "green", "ph-chart-bar")}
        ${salesInsightsSourceCard("Mix note", "True prior-period price/mix decomposition requires prior-window Firebase rows.", "red", "ph-warning")}
      </div>
    </section>
    <section class="si-panel si-bridge-panel"><h3>Price / volume / mix bridge</h3><p>Current-window bridge using available Nexus measures.</p><div>${bridge}</div></section>
    ${salesInsightsMiniLine("Average price trend", monthly.map((row) => ({ label: row.label, value: Number(row.quantity || 0) ? Number(row.value || 0) / Number(row.quantity || 1) : 0 })), "value")}
    ${salesInsightsTablePanel("Category price and volume effects", `${salesDashboardNumber(categories.length)} categories`, rows)}`;
}

function renderSalesInsightsStores(data, container) {
  const metrics = data?.metrics || {};
  const charts = data?.charts || {};
  const stores = (charts.byStore || []).filter((row) => row.label && row.label !== "Unassigned");
  const regions = (charts.byRegion || []).filter((row) => row.label && row.label !== "Unassigned");
  const totalValue = Number(metrics.salesValue || 0);
  const totalUnits = Number(metrics.quantity || 0);
  const leader = stores[0];
  const top = stores.slice(0, 8);
  const low = stores.slice(-8).reverse();
  const topShare = totalValue && leader ? Number(leader.value || 0) / totalValue * 100 : 0;
  container.className = "insights-source-page si-source-detail si-store-page";
  container.innerHTML = `
    ${salesInsightsKpiGrid([
      { label: "Stores trading", value: salesDashboardNumber(stores.length), note: `<span class="si-delta flat">${salesDashboardNumber(metrics.orderLines || 0)}</span><span class="si-delta-note">order lines</span>`, tone: "orange" },
      { label: "Store value", value: salesInsightsCompactCurrency(totalValue), note: salesInsightsVsBadge(salesInsightsMetricDelta(charts.monthly, "value"), "vs first loaded month"), tone: "blue" },
      { label: "Units sold", value: salesInsightsCompactNumber(totalUnits), note: salesInsightsVsBadge(salesInsightsMetricDelta(charts.monthly, "quantity"), "vs first loaded month"), tone: "green" },
      { label: "Regions", value: salesDashboardNumber(regions.length), note: `<span class="si-delta flat">${salesDashboardNumber(metrics.reps || 0)}</span><span class="si-delta-note">active reps</span>`, tone: "gold" }
    ], true)}
    <section class="si-panel si-intel-panel">
      <header><h3>Store Intelligence</h3><span>${salesDashboardNumber(stores.length)} stores - current filters</span></header>
      <p class="si-source-headline"><b>All stores</b><i>-</i><span>${leader ? `${escapeHtml(leader.label)} leads store value at ${salesInsightsCompactCurrency(leader.value)}.` : "No store sales are available in the imported Geo sales data yet."}</span></p>
      <div class="si-source-card-grid">
        ${salesInsightsSourceCard("Store leader", leader ? `${escapeHtml(leader.label)} holds ${topShare.toFixed(1)}% of selected value.` : "No store leader available.", "orange", "ph-storefront")}
        ${salesInsightsSourceCard("Trading footprint", `${salesDashboardNumber(stores.length)} stores across ${salesDashboardNumber(regions.length)} regions have sales in this view.`, "green", "ph-map-trifold")}
        ${salesInsightsSourceCard("Attention list", low[0] ? `${escapeHtml(low[0].label)} is in the lowest current-value group.` : "No attention list is available.", "red", "ph-warning")}
      </div>
    </section>
    <section class="si-driver-grid">
      <article class="si-panel"><h3>Needs attention</h3><p>Lowest current-value stores in the selected view.</p><div class="si-alert-list">${low.map((row) => `<article><i></i><div><strong>${escapeHtml(row.label)}</strong><span>${salesInsightsCompactCurrency(row.value)} - ${salesInsightsCompactNumber(row.quantity)} units</span></div></article>`).join("") || `<p class="insights-detail-empty">No store rows available.</p>`}</div></article>
      <article class="si-panel"><h3>Strongest performers</h3><p>Highest current-value stores in the selected view.</p><div class="si-alert-list good">${top.map((row) => `<article><i></i><div><strong>${escapeHtml(row.label)}</strong><span>${salesInsightsCompactCurrency(row.value)} - ${salesInsightsCompactNumber(row.quantity)} units</span></div></article>`).join("") || `<p class="insights-detail-empty">No store rows available.</p>`}</div></article>
    </section>
    <section class="si-driver-grid">
      <article class="si-panel si-share-panel"><h3>Store segmentation</h3>${salesInsightsShareRows(top, totalValue, "value", false, 8)}</article>
      <article class="si-panel si-share-panel"><h3>Regional footprint</h3>${salesInsightsShareRows(regions, totalValue, "value", true, 8)}</article>
    </section>
    ${salesInsightsTablePanel("Store league table", `${salesDashboardNumber(stores.length)} stores`, salesInsightsLeagueRows(stores, totalValue, totalUnits, "value", 30, "data-insights-store"))}`;
}

function renderSalesInsightsBrands(data, container) {
  const metrics = data?.metrics || {};
  const charts = data?.charts || {};
  const brands = (charts.byBrand || []).filter((row) => row.label && row.label !== "Unassigned");
  const categories = (charts.byCategory || []).filter((row) => row.label && row.label !== "Unassigned");
  const totalValue = Number(metrics.salesValue || 0);
  const totalUnits = Number(metrics.quantity || 0);
  const avgPrice = totalUnits ? totalValue / totalUnits : 0;
  const activeBrands = brands.length;
  const valueDelta = salesInsightsMetricDelta(charts.monthly, "value");
  const volumeDelta = salesInsightsMetricDelta(charts.monthly, "quantity");
  const leader = brands[0];
  const runnerUp = brands[1];
  const brandRows = brands.slice(0, 18);
  const brandMax = Math.max(...brandRows.map((row) => Number(row.value || 0)), 1);
  const topShare = totalValue && leader ? Number(leader.value || 0) / totalValue * 100 : 0;
  const rows = brandRows.map((row, index) => {
    const value = Number(row.value || 0);
    const units = Number(row.quantity || 0);
    const price = units ? value / units : 0;
    const share = totalValue ? value / totalValue * 100 : 0;
    return `<tr class="si-row" data-insights-pick="${escapeHtml(row.label)}"><td>${String(index + 1).padStart(2, "0")}</td><td title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</td><td>${salesInsightsCompactCurrency(value)}</td><td>${salesInsightsCompactNumber(units)}</td><td>${salesDashboardCurrency(price)}</td><td>${share.toFixed(1)}%</td><td><span class="si-line-pair"><b style="width:${Math.max(3, Math.round(value / brandMax * 100))}%"></b><i style="width:${Math.max(2, Math.round(units / Math.max(1, totalUnits) * 100))}%"></i></span></td></tr>`;
  }).join("") || `<tr><td colspan="7">Brand values are not present in the imported Geo sales data yet.</td></tr>`;
  const donutSegs = brands.slice(0, 8).map((row, index) => {
    const share = totalValue ? Number(row.value || 0) / totalValue * 100 : 0;
    return `<li><span style="background:${["#ec6d25", "#5b9bd5", "#22c55e", "#e8a838", "#d94f3a", "#9b8cdb", "#7fc8f8", "#4a6b8a"][index % 8]}"></span><b title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</b><em>${share.toFixed(1)}%</em></li>`;
  }).join("");
  container.className = "insights-source-page si-source-detail si-brand-page";
  container.innerHTML = `
    <section class="si-source-kpis">
      <article class="orange"><span>Total brand value</span><strong>${salesInsightsCompactCurrency(totalValue)}</strong><small>${salesInsightsVsBadge(valueDelta, "vs first loaded month")}</small></article>
      <article class="blue"><span>Units sold</span><strong>${salesInsightsCompactNumber(totalUnits)}</strong><small>${salesInsightsVsBadge(volumeDelta, "vs first loaded month")}</small></article>
      <article class="red"><span>Active brands</span><strong>${salesDashboardNumber(activeBrands)}</strong><small><span class="si-delta flat">${salesDashboardNumber(categories.length)}</span><span class="si-delta-note">categories loaded</span></small></article>
      <article class="gold"><span>Average price</span><strong>${salesDashboardCurrency(avgPrice)}</strong><small><span class="si-delta up">Live</span><span class="si-delta-note">current selection</span></small></article>
    </section>
    <section class="si-panel si-intel-panel">
      <header><h3>Brand Intelligence</h3><span>${salesDashboardNumber(activeBrands)} brands - rolling ${salesDashboardNumber(data?.windowMonths || 12)} months</span></header>
      <p class="si-source-headline"><b>All brands</b><i>-</i><span>Brand value totals ${salesInsightsCompactCurrency(totalValue)} over the selected period, across ${salesInsightsCompactNumber(totalUnits)} units.</span></p>
      <div class="si-source-card-grid">
        ${salesInsightsSourceCard("Brand leader", leader ? `${escapeHtml(leader.label)} leads at ${salesInsightsCompactCurrency(leader.value)} (${topShare.toFixed(1)}% of brand value).` : "No brand leader is available in the imported data.", "orange", "ph-tag")}
        ${salesInsightsSourceCard("Biggest gain", runnerUp ? `${escapeHtml(runnerUp.label)} is the next largest brand contributor at ${salesInsightsCompactCurrency(runnerUp.value)}.` : "Import prior-period brand data to calculate a true gain.", "green", "ph-arrow-up-right")}
        ${salesInsightsSourceCard("Biggest decline", "Prior rolling-period brand values are not loaded in Nexus yet, so decline is not invented.", "red", "ph-arrow-down-right")}
      </div>
    </section>
    <section class="si-driver-grid">
      <article class="si-panel"><h3>Value drivers</h3><p>Leading brands by selected sales value.</p><div class="si-driver-columns"><section><span>Top contributors</span>${salesInsightsDriverRows(brands, "value", true)}</section><section><span>Long tail</span>${salesInsightsDriverRows(brands, "value", false)}</section></div></article>
      <article class="si-panel"><h3>Volume drivers</h3><p>Leading brands by selected sales volume.</p><div class="si-driver-columns"><section><span>Top contributors</span>${salesInsightsDriverRows(brands, "quantity", true)}</section><section><span>Long tail</span>${salesInsightsDriverRows(brands, "quantity", false)}</section></div></article>
    </section>
    <section class="si-panel si-concentration-panel">
      <header><div><h3>Share and concentration</h3><span>Top brand share across the current selection</span></div></header>
      <div class="si-concentration-body"><div class="si-donut" style="--fill:${Math.max(1, Math.round(topShare))}%"><strong>${topShare.toFixed(0)}%</strong><span>Top brand</span></div><ul>${donutSegs || "<li>No brand split loaded</li>"}</ul><aside><span>Concentration</span><strong>${topShare >= 35 ? "High" : topShare >= 18 ? "Moderate" : "Spread"}</strong><p>${leader ? `${escapeHtml(leader.label)} carries the largest share of brand value in this view.` : "Load Brand dimension data to calculate concentration."}</p></aside></div>
    </section>
    <section class="si-panel si-source-table-panel">
      <header><h3>Brand league table</h3><span>${salesDashboardNumber(activeBrands)} brands</span></header>
      <div class="si-source-table-wrap"><table><thead><tr><th>Rank</th><th>Brand</th><th>Value</th><th>Volume</th><th>Avg price</th><th>Share</th><th>Value / volume</th></tr></thead><tbody>${rows}</tbody></table></div>
    </section>`;
}

function renderSalesInsightsRegions(data, container) {
  const metrics = data?.metrics || {};
  const charts = data?.charts || {};
  const regions = (charts.byRegion || []).filter((row) => row.label && row.label !== "Unassigned");
  const divisions = (charts.byDivision || []).filter((row) => row.label && row.label !== "Unassigned");
  const totalValue = Number(metrics.salesValue || 0);
  const totalUnits = Number(metrics.quantity || 0);
  const leader = regions[0];
  const max = Math.max(...regions.map((row) => Number(row.value || 0)), 1);
  const regionRows = regions.slice(0, 14).map((row, index) => {
    const value = Number(row.value || 0);
    const units = Number(row.quantity || 0);
    const price = units ? value / units : 0;
    const share = totalValue ? value / totalValue * 100 : 0;
    return `<tr class="si-row" data-insights-region="${escapeHtml(row.label)}"><td>${String(index + 1).padStart(2, "0")}</td><td>${escapeHtml(row.label)}</td><td>${salesInsightsCompactCurrency(value)}</td><td>${salesInsightsCompactNumber(units)}</td><td>${salesDashboardCurrency(price)}</td><td>${share.toFixed(1)}%</td><td><span class="si-line-pair"><b style="width:${Math.max(3, Math.round(value / max * 100))}%"></b><i style="width:${Math.max(2, Math.round(units / Math.max(1, totalUnits) * 100))}%"></i></span></td></tr>`;
  }).join("") || `<tr><td colspan="7">No regional sales data is available for this selection.</td></tr>`;
  const snapshot = [
    ["Value leader", leader?.label || "No data", leader ? `${salesInsightsCompactCurrency(leader.value)} value` : "Waiting for imported sales", "orange"],
    ["Volume leader", [...regions].sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0))[0]?.label || "No data", `${salesInsightsCompactNumber(Math.max(...regions.map((row) => Number(row.quantity || 0)), 0))} units`, "blue"],
    ["Strongest coverage", regions.length ? `${salesDashboardNumber(regions.length)} regions` : "No data", "Current filter footprint", "green"],
    ["Largest risk", regions[regions.length - 1]?.label || "No data", regions.length ? "Smallest regional value share" : "Waiting for source data", "red"]
  ].map(([kicker, name, note, tone]) => `<article class="${tone}"><span>${escapeHtml(kicker)}</span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(note)}</small></article>`).join("");
  const divisionSnapshot = divisions.slice(0, 3).map((row, index) => {
    const share = totalValue ? Number(row.value || 0) / totalValue * 100 : 0;
    return `<article><span>${escapeHtml(row.label)}</span><strong>${share.toFixed(1)}% value</strong><small>${salesInsightsCompactNumber(row.quantity)} volume</small></article>`;
  }).join("");
  const valueShare = regions.slice(0, 8).map((row) => {
    const share = totalValue ? Number(row.value || 0) / totalValue * 100 : 0;
    return `<div class="si-share-row"><span>${escapeHtml(row.label)}</span><i><b style="width:${Math.max(3, share)}%"></b></i><em>${share.toFixed(1)}%</em></div>`;
  }).join("");
  const volumeShare = regions.slice(0, 8).map((row) => {
    const share = totalUnits ? Number(row.quantity || 0) / totalUnits * 100 : 0;
    return `<div class="si-share-row blue"><span>${escapeHtml(row.label)}</span><i><b style="width:${Math.max(3, share)}%"></b></i><em>${share.toFixed(1)}%</em></div>`;
  }).join("");
  container.className = "insights-source-page si-source-detail si-region-page";
  container.innerHTML = `
    <section class="si-panel si-intel-panel">
      <header><h3>Regional Intelligence</h3><span>${salesDashboardNumber(metrics.orderLines || 0)} rows - current filters</span></header>
      <p class="si-source-headline"><b>All regions</b><i>-</i><span>${leader ? `${escapeHtml(leader.label)} holds the largest regional value at ${salesInsightsCompactCurrency(leader.value)}.` : "No regional sales have been loaded for this filter."}</span></p>
      <div class="si-source-card-grid">
        ${salesInsightsSourceCard("Largest region", leader ? `${escapeHtml(leader.label)} leads the selected regional value.` : "No regional leader available.", "orange", "ph-map-pin")}
        ${salesInsightsSourceCard("Biggest gain", "Prior rolling-period regional values are not loaded in Nexus yet.", "green", "ph-arrow-up-right")}
        ${salesInsightsSourceCard("Biggest decline", regions[regions.length - 1] ? `${escapeHtml(regions[regions.length - 1].label)} is the smallest current contributor.` : "No regional risk available.", "red", "ph-arrow-down-right")}
      </div>
    </section>
    <section class="si-panel si-map-panel">
      <header><div><h3>Sales Performance by Province</h3><span>Rolling ${salesDashboardNumber(data?.windowMonths || 12)} months - click a province to filter the dashboard</span></div><div class="si-seg-static"><button class="active" type="button">Value</button><button type="button">Volume</button></div></header>
      <div class="si-map-layout"><div class="si-map-frame"><iframe id="salesInsightsProvinceMap" src="province-map.html" title="Sales by province"></iframe></div><aside><h4>Regional snapshot</h4><div class="si-snapshot-grid">${snapshot}</div><h4>Divisional snapshot</h4><div class="si-division-snapshot">${divisionSnapshot || "<article><span>No divisions</span><strong>-</strong><small>Load source data</small></article>"}</div><h4>Map legend</h4><div class="si-map-legend"><span><i class="green"></i>Above plan</span><span><i class="blue"></i>Stable</span><span><i class="amber"></i>Soft</span><span><i class="red"></i>Risk</span></div></aside></div>
    </section>
    <section class="si-driver-grid">
      <article class="si-panel si-share-panel"><h3>Value share</h3>${valueShare || `<p class="insights-detail-empty">No regional value share available.</p>`}</article>
      <article class="si-panel si-share-panel"><h3>Volume share</h3>${volumeShare || `<p class="insights-detail-empty">No regional volume share available.</p>`}</article>
    </section>
    <section class="si-panel si-source-table-panel">
      <header><h3>Region league table</h3><div><span><i class="orange-dot"></i>Value</span><span><i class="blue-dot"></i>Volume</span></div></header>
      <div class="si-source-table-wrap"><table><thead><tr><th>Rank</th><th>Region</th><th>Value</th><th>Volume</th><th>Avg price</th><th>Share</th><th>Value / volume</th></tr></thead><tbody>${regionRows}</tbody></table></div>
    </section>`;
  const frame = document.querySelector("#salesInsightsProvinceMap");
  frame?.addEventListener("load", () => salesInsightsPostProvinceMap(regions, totalValue, totalUnits), { once: true });
  setTimeout(() => salesInsightsPostProvinceMap(regions, totalValue, totalUnits), 80);
}

function salesInsightsPostProvinceMap(regions, totalValue, totalUnits) {
  const frame = document.querySelector("#salesInsightsProvinceMap");
  if (!frame?.contentWindow) return;
  const rows = {};
  (regions || []).forEach((row) => {
    const name = salesInsightsTitleCase(row.label);
    const share = totalValue ? Number(row.value || 0) / totalValue * 100 : 0;
    rows[name] = { value: salesInsightsCompactCurrency(row.value), units: salesInsightsCompactNumber(row.quantity), vs: 0, vsLabel: `${share.toFixed(1)}% share`, share: `${share.toFixed(1)}%`, keys: [row.label] };
  });
  frame.contentWindow.postMessage({ type: "province-data", rows, selected: null, measure: "value" }, "*");
}

function renderSalesInsightsDetail(data) {
  const page = state.insightsPage;
  const container = document.querySelector("#insightsDetailPage");
  if (!container) return;
  if (page === "regions") { renderSalesInsightsRegions(data, container); return; }
  if (page === "brands") { renderSalesInsightsBrands(data, container); return; }
  if (page === "channels") { renderSalesInsightsChannels(data, container); return; }
  if (page === "categories") { renderSalesInsightsCategories(data, container); return; }
  if (page === "products") { renderSalesInsightsProducts(data, container); return; }
  if (page === "pricemix") { renderSalesInsightsPriceMix(data, container); return; }
  if (page === "stores") { renderSalesInsightsStores(data, container); return; }
  const metrics = data?.metrics || {};
  const charts = data?.charts || {};
  const definition = {
    categories: { eyebrow: "Category performance", title: "Category contribution", rows: charts.byCategory || [], secondary: charts.byBrand || [], dimension: "Categories", secondaryTitle: "Leading brands", unavailable: "Category", variant: "portfolio" },
    products: { eyebrow: "Product performance", title: "Product leaderboard", rows: charts.byProduct || [], secondary: charts.bySku || [], dimension: "Products", secondaryTitle: "SKU demand", variant: "leaderboard" },
    channels: { eyebrow: "Channel performance", title: "Channel mix", rows: charts.byChannel || [], secondary: charts.byRegion || [], dimension: "Channels", secondaryTitle: "Regional contribution", unavailable: "Channel", variant: "mix" },
    pricemix: { eyebrow: "Price & mix", title: "Value and volume mix", rows: charts.byProduct || [], secondary: charts.byCategory || [], dimension: "Products", secondaryTitle: "Category mix", variant: "price" },
    stores: { eyebrow: "Store performance", title: "Store trading performance", rows: charts.byStore || [], secondary: charts.byRegion || [], dimension: "Stores", secondaryTitle: "Regional coverage", variant: "leaderboard" }
  }[page];
  if (!definition) return;
  const usableRows = definition.rows.filter((row) => row.label && row.label !== "Unassigned");
  const usableSecondary = definition.secondary.filter((row) => row.label && row.label !== "Unassigned");
  const totalValue = Number(metrics.salesValue || 0);
  const totalUnits = Number(metrics.quantity || 0);
  const averageUnitPrice = totalUnits ? totalValue / totalUnits : 0;
  const max = Math.max(...usableRows.map((row) => Number(row.value || 0)), 1);
  const secondaryMax = Math.max(...usableSecondary.map((row) => Number(row.value || 0)), 1);
  const bars = (rows, scale, compact = false) => rows.length ? rows.slice(0, compact ? 6 : 12).map((row, index) => {
    const percent = Math.max(2, Math.round(Number(row.value || 0) / scale * 100));
    const share = totalValue ? (Number(row.value || 0) / totalValue * 100) : 0;
    return `<div class="insights-detail-row"><div><strong><b>${String(index + 1).padStart(2, "0")}</b>${escapeHtml(row.label)}</strong><i><em style="width:${percent}%"></em></i></div><span>${salesDashboardCurrency(row.value)}</span><small>${salesDashboardNumber(row.quantity)} units · ${share.toFixed(1)}%</small></div>`;
  }).join("") : `<p class="insights-detail-empty">${definition.unavailable ? `${definition.unavailable} values are not present in the imported Geo sales data yet.` : "No verified data is available for this selection."}</p>`;
  const leaderboard = usableRows.length ? usableRows.slice(0, 12).map((row, index) => `<tr><td><b>${String(index + 1).padStart(2, "0")}</b> ${escapeHtml(row.label)}</td><td>${salesDashboardNumber(row.quantity)}</td><td>${salesDashboardNumber(row.orders)}</td><td>${salesDashboardCurrency(row.value)}</td><td>${totalUnits ? salesDashboardCurrency(Number(row.value || 0) / Math.max(1, Number(row.quantity || 0))) : "-"}</td></tr>`).join("") : `<tr><td colspan="5">${definition.unavailable ? `${definition.unavailable} values are not present in the imported Geo sales data yet.` : "No verified records are available for this selection."}</td></tr>`;
  const first = usableRows[0];
  const firstShare = totalValue && first ? Math.round(Number(first.value || 0) / totalValue * 100) : 0;
  const mix = usableRows.slice(0, 5).reduce((total, row) => total + Number(row.value || 0), 0);
  const donut = usableRows.length ? `<div class="insights-detail-donut" style="--fill:${Math.max(4, Math.round(mix / Math.max(1, totalValue) * 100))}%"><strong>${Math.round(mix / Math.max(1, totalValue) * 100)}%</strong><span>top 5 mix</span></div>` : "";
  const body = definition.variant === "leaderboard"
    ? `<section class="insights-detail-table insights-detail-leaderboard"><header><div><p>Ranked performance</p><h3>${escapeHtml(definition.title)}</h3></div><span>Current selection</span></header><div class="insights-detail-table-scroll"><table><thead><tr><th>${page === "stores" ? "Store" : "Product"}</th><th>Units</th><th>Orders</th><th>Sales value</th><th>Avg price</th></tr></thead><tbody>${leaderboard}</tbody></table></div></section><section class="insights-detail-table insights-detail-secondary"><header><div><p>Distribution</p><h3>${escapeHtml(definition.secondaryTitle)}</h3></div></header>${bars(usableSecondary, secondaryMax, true)}</section>`
    : `<section class="insights-detail-table insights-detail-primary"><header><div><p>${escapeHtml(definition.eyebrow)}</p><h3>${escapeHtml(definition.title)}</h3></div><span>Current selection</span></header>${bars(usableRows, max)}</section><aside class="insights-detail-side"><section><header><p>Leading contribution</p><h3>${first ? escapeHtml(first.label) : "No source data"}</h3></header><strong>${first ? salesDashboardCurrency(first.value) : "-"}</strong><span>${first ? `${firstShare}% of current sales value` : "Run or extend the Geo sales import."}</span>${donut}</section><section class="insights-detail-mini"><header><p>Cross-section</p><h3>${escapeHtml(definition.secondaryTitle)}</h3></header>${bars(usableSecondary, secondaryMax, true)}</section></aside>`;
  container.className = `insights-source-page insights-detail-page insights-detail-${definition.variant}`;
  container.innerHTML = `<header class="insights-detail-heading"><div><p>${escapeHtml(definition.eyebrow)}</p><h2>${escapeHtml(definition.title)}</h2></div><span>${salesDashboardNumber(metrics.orderLines || 0)} verified order lines</span></header><section class="insights-detail-kpis"><article><span>Net sales</span><strong>${salesDashboardCurrency(totalValue)}</strong><small>Current filtered value</small></article><article><span>Units sold</span><strong>${salesDashboardNumber(totalUnits)}</strong><small>Verified sales volume</small></article><article><span>Avg unit price</span><strong>${salesDashboardCurrency(averageUnitPrice)}</strong><small>Value per sold unit</small></article><article><span>${escapeHtml(definition.dimension)} active</span><strong>${salesDashboardNumber(usableRows.length)}</strong><small>Distinct values in selection</small></article></section><div class="insights-detail-layout">${body}</div>`;
}

function renderSalesInsightsTrend(data) {
  const metrics = data?.metrics || {};
  const daily = data?.charts?.daily || [];
  const totalValue = Number(metrics.salesValue || 0);
  const totalUnits = Number(metrics.quantity || 0);
  const unitPrice = totalUnits ? totalValue / totalUnits : 0;
  const peak = [...daily].sort((left, right) => Number(right.value || 0) - Number(left.value || 0))[0];
  const recentDays = daily.slice(-3);
  const earlierDays = daily.slice(-6, -3);
  const recentValue = recentDays.reduce((total, row) => total + Number(row.value || 0), 0);
  const earlierValue = earlierDays.reduce((total, row) => total + Number(row.value || 0), 0);
  const trajectory = earlierValue ? ((recentValue / earlierValue) - 1) * 100 : 0;
  const kpis = [
    ["Sales units MTD", salesDashboardNumber(totalUnits), "Units in the selected period", "orange"],
    ["Sales value MTD", salesDashboardCurrency(totalValue), "Verified Geo sales value", "blue"],
    ["Avg unit price", salesDashboardCurrency(unitPrice), "Sales value per unit", "green"],
    ["Transactions", salesDashboardNumber(metrics.orders || 0), "Unique order numbers", "gold"],
    ["Stores trading", salesDashboardNumber(metrics.stores || 0), "Stores with sales", "red"],
    ["Active reps", salesDashboardNumber(metrics.reps || 0), "Representatives with sales", "violet"],
    ["Source rows", salesDashboardNumber(metrics.orderLines || 0), "Verified order lines", "orange"]
  ];
  const container = document.querySelector("#insightsTrendKpis");
  if (container) container.innerHTML = kpis.map(([label, value, note, tone]) => `<article class="${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`).join("");
  const setText = (selector, text) => { const element = document.querySelector(selector); if (element) element.textContent = text; };
  setText("#insightsTrendNarrative", data?.metrics?.orderLines ? `Across the current verified period, sales reached ${salesDashboardCurrency(totalValue)} from ${salesDashboardNumber(totalUnits)} units across ${salesDashboardNumber(metrics.stores || 0)} trading stores.` : "Load verified sales data to calculate the selected trend.");
  setText("#insightsTrendValueVolume", data?.metrics?.orderLines ? `${salesDashboardCurrency(unitPrice)} per unit` : "Waiting for data");
  setText("#insightsTrendValueVolumeNote", data?.metrics?.orderLines ? `${salesDashboardCurrency(totalValue)} sales value across ${salesDashboardNumber(totalUnits)} units.` : "Load the verified sales import.");
  setText("#insightsTrendPeakDay", peak?.label || "Waiting for data");
  setText("#insightsTrendPeakDayNote", peak ? `${salesDashboardCurrency(peak.value)} was the strongest reported day.` : "Load the verified sales import.");
  setText("#insightsTrendTrajectory", earlierDays.length ? `${trajectory >= 0 ? "+" : ""}${trajectory.toFixed(1)}% across the last three reported days` : "Waiting for data");
  setText("#insightsTrendTrajectoryNote", earlierDays.length ? `${salesDashboardCurrency(recentValue)} recent value compared with the previous three reported days.` : "Load more reported days to calculate a trajectory.");
  const focus = document.querySelector("#insightsTrendFocus");
  if (focus) focus.innerHTML = data?.metrics?.orderLines
    ? [
      data?.charts?.byProduct?.[0] ? `<li><strong>${escapeHtml(data.charts.byProduct[0].label)}</strong> is the leading product by verified sales value.</li>` : "",
      data?.charts?.byRegion?.[0] ? `<li><strong>${escapeHtml(data.charts.byRegion[0].label)}</strong> is the leading region in the current selection.</li>` : "",
      `<li><strong>${Number(metrics.mappedPercent || 0).toFixed(0)}%</strong> of selected order lines match the approved Store Master.</li>`
    ].filter(Boolean).join("")
    : "<li>Load verified sales data to identify the current focus areas.</li>";
}

async function loadSalesInsights() {
  const sourceFrame = ensureSalesInsightsSourceFrame();
  if (sourceFrame) {
    syncSalesInsightsSourcePage();
    return;
  }
  if (state.insightsLoading) return;
  if (!state.isOperator || !cloudFunctions) {
    elements.insightsStatus.hidden = false;
    elements.insightsStatus.textContent = "Sign in to Nexus to load controlled sales insights.";
    renderSalesInsights(null);
    return;
  }
  state.insightsLoading = true;
  elements.insightsRefresh.disabled = true;
  elements.insightsStatus.hidden = false;
  elements.insightsStatus.textContent = "Loading verified Sales Insights data...";
  try {
    const data = await callFunction("getSalesInsightsDashboard", { windowMonths: Number(elements.insightsWindow?.value || 12), filters: insightsCurrentFilters() });
    renderSalesInsights(data);
    elements.insightsStatus.hidden = !!data.metrics?.orderLines;
    elements.insightsStatus.textContent = data.metrics?.orderLines ? "" : "No historical Sales Insights snapshot is available yet. Ask an administrator to refresh it.";
  } catch (error) {
    renderSalesInsights(null);
    elements.insightsStatus.hidden = false;
    elements.insightsStatus.textContent = friendlyError(error);
  } finally {
    state.insightsLoading = false;
    elements.insightsRefresh.disabled = false;
  }
}

function trainingHubElements() {
  return {
    refresh: document.querySelector("#trainingRefresh"), status: document.querySelector("#trainingStatus"), source: document.querySelector("#trainingSourceLine"),
    module: document.querySelector("#trainingModule"), region: document.querySelector("#trainingRegion"), learnerStatus: document.querySelector("#trainingLearnerStatus"), search: document.querySelector("#trainingSearch"), clear: document.querySelector("#trainingClearFilters"),
    modulesCount: document.querySelector("#trainingModulesCount"), learnersCount: document.querySelector("#trainingLearnersCount"), completion: document.querySelector("#trainingCompletion"), passRate: document.querySelector("#trainingPassRate"), actionCount: document.querySelector("#trainingActionCount"),
    moduleLabel: document.querySelector("#trainingModuleLabel"), modules: document.querySelector("#trainingModules"), statuses: document.querySelector("#trainingStatusRows"), followUp: document.querySelector("#trainingFollowUp"), regions: document.querySelector("#trainingRegions"), managers: document.querySelector("#trainingManagers"), rowsCount: document.querySelector("#trainingRowsCount"), rows: document.querySelector("#trainingRows")
  };
}

function trainingHubFilters(elements) {
  return { module: elements.module.value, region: elements.region.value, status: elements.learnerStatus.value, query: elements.search.value.trim().toLowerCase() };
}

function trainingHubStatusClass(value) {
  const status = String(value || "").toLowerCase();
  return status.includes("pass") ? "completed" : status.includes("fail") ? "failed" : status.includes("not") ? "warning" : "running";
}

function trainingHubRollup(rows, field) {
  const summary = new Map();
  rows.forEach((row) => {
    const key = row[field] || "Unassigned";
    const entry = summary.get(key) || { label: key, value: 0, quantity: 0, orders: 0 };
    entry.value += Number(row.done || 0);
    entry.quantity += Number(row.total || 0);
    entry.orders += 1;
    summary.set(key, entry);
  });
  return [...summary.values()].sort((left, right) => right.value - left.value || left.label.localeCompare(right.label));
}

function renderTrainingHub(data) {
  const elements = trainingHubElements();
  const modules = data?.modules || [];
  const current = trainingHubFilters(elements);
  const allRows = modules.flatMap((module) => (module.learners || []).map((learner) => ({ ...learner, moduleId: module.id, module: module.name, course: module.course, modifiedAt: module.modifiedAt })));
  const moduleRows = current.module ? allRows.filter((row) => row.moduleId === current.module) : allRows;
  const rows = moduleRows.filter((row) => (!current.region || row.region === current.region) && (!current.status || row.status === current.status) && (!current.query || `${row.name} ${row.code} ${row.manager}`.toLowerCase().includes(current.query)));
  const totalLessons = rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const completedLessons = rows.reduce((sum, row) => sum + Number(row.done || 0), 0);
  const passed = rows.filter((row) => row.status === "Passed").length;
  const action = rows.filter((row) => row.status !== "Passed").length;
  const percent = (value, total) => total ? `${((value / total) * 100).toFixed(1)}%` : "0.0%";
  const selectOptions = (select, values, label) => {
    const selected = select.value;
    select.innerHTML = `<option value="">${escapeHtml(label)}</option>${values.map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`).join("")}`;
    if (values.some((item) => item.value === selected)) select.value = selected;
  };
  selectOptions(elements.module, modules.map((module) => ({ value: module.id, label: module.name })), "All modules");
  selectOptions(elements.region, [...new Set(allRows.map((row) => row.region).filter(Boolean))].sort().map((value) => ({ value, label: value })), "All regions");
  selectOptions(elements.learnerStatus, [...new Set(allRows.map((row) => row.status).filter(Boolean))].sort().map((value) => ({ value, label: value })), "All statuses");
  elements.modulesCount.textContent = salesDashboardNumber(modules.length);
  elements.learnersCount.textContent = salesDashboardNumber(rows.length);
  elements.completion.textContent = percent(completedLessons, totalLessons);
  elements.passRate.textContent = percent(passed, rows.length);
  elements.actionCount.textContent = salesDashboardNumber(action);
  elements.source.textContent = data?.source?.refreshedAt ? `Live SharePoint source refreshed ${formatDate(data.source.refreshedAt)}.` : "Live LMS workbooks from SharePoint.";
  elements.moduleLabel.textContent = `${salesDashboardNumber(modules.length)} modules`;
  elements.modules.innerHTML = modules.length ? modules.map((module) => {
    const list = (module.learners || []); const total = list.reduce((sum, row) => sum + Number(row.total || 0), 0); const done = list.reduce((sum, row) => sum + Number(row.done || 0), 0); const pass = list.filter((row) => row.status === "Passed").length;
    return `<button type="button" data-training-module="${escapeHtml(module.id)}"><span><strong>${escapeHtml(module.name)}</strong><small>${escapeHtml(module.course || module.sourceName || "Training module")}</small></span><b>${percent(done, total)}</b><i><em style="width:${Math.round(total ? (done / total) * 100 : 0)}%"></em></i><footer><span>${salesDashboardNumber(pass)} passed</span><span>${salesDashboardNumber(list.length - pass)} need action</span></footer></button>`;
  }).join("") : `<p class="history-empty">No readable training modules were found.</p>`;
  const statuses = ["Passed", "Failed", "Not Started", "In Progress", "Unknown"].map((status) => ({ status, count: rows.filter((row) => row.status === status).length })).filter((entry) => entry.count);
  elements.statuses.innerHTML = statuses.length ? statuses.map((entry) => `<div><i class="${trainingHubStatusClass(entry.status)}"></i><span>${escapeHtml(entry.status)}</span><strong>${salesDashboardNumber(entry.count)}</strong><small>${percent(entry.count, rows.length)}</small></div>`).join("") : `<p class="history-empty">No learner statuses in this selection.</p>`;
  elements.followUp.textContent = action ? `Prioritise ${salesDashboardNumber(action)} learner${action === 1 ? "" : "s"} who are not passed, starting with failed and not-started modules.` : "All learners in the selected view have passed.";
  renderSalesDashboardBars(elements.regions, trainingHubRollup(rows, "region").slice(0, 10), (value) => `${salesDashboardNumber(value)} lessons completed`);
  renderSalesDashboardBars(elements.managers, trainingHubRollup(rows, "manager").slice(0, 10), (value) => `${salesDashboardNumber(value)} lessons completed`);
  elements.rowsCount.textContent = `${salesDashboardNumber(rows.length)} learners`;
  elements.rows.innerHTML = rows.length ? rows.sort((left, right) => left.status.localeCompare(right.status) || left.name.localeCompare(right.name)).map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.module)}</td><td>${escapeHtml(row.manager)}</td><td>${escapeHtml(row.region)}</td><td>${salesDashboardNumber(row.done)} / ${salesDashboardNumber(row.total)}</td><td>${Number(row.score || 0).toFixed(1)}%</td><td><span class="row-status ${trainingHubStatusClass(row.status)}">${escapeHtml(row.status)}</span></td></tr>`).join("") : `<tr><td colspan="7">No learners match the selected filters.</td></tr>`;
}

async function loadTrainingHub() {
  const generation = nexusSessionGeneration;
  if (state.trainingHubLoading) return;
  const elements = trainingHubElements();
  if (!state.isOperator || !cloudFunctions) { elements.status.textContent = "Sign in to Nexus to load controlled training data."; return; }
  state.trainingHubLoading = true; elements.refresh.disabled = true; elements.status.textContent = "Loading live training workbooks from SharePoint...";
  try {
    const data = await callFunction("getTrainingHubDashboard", {}, cachedDashboard(data => { state.trainingHubData = data; renderTrainingHub(data); }, elements.status));
    state.trainingHubData = data;
    renderTrainingHub(data);
    elements.status.textContent = data.errors?.length ? `Showing ${salesDashboardNumber(data.modules.length)} modules. ${salesDashboardNumber(data.errors.length)} workbook${data.errors.length === 1 ? " needs" : "s need"} review.` : `Showing ${salesDashboardNumber(data.modules.length)} live training modules.`;
  } catch (error) {
    if (generation !== nexusSessionGeneration || error.code === "cancelled") return;
    if (window.NexusLoadCache.denied(error)) { state.trainingHubData = null; renderTrainingHub(null); }
    elements.status.textContent = friendlyError(error);
  }
  finally { if (generation === nexusSessionGeneration) { state.trainingHubLoading = false; elements.refresh.disabled = false; } }
}

function attendanceDashboardNumber(value) {
  return Number(value || 0).toLocaleString("en-ZA", { maximumFractionDigits: 0 });
}

function attendanceDashboardPercent(value) {
  return `${Number(value || 0).toLocaleString("en-ZA", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function renderAttendanceDashboardBars(container, rows) {
  if (!rows?.length) { container.innerHTML = `<p class="history-empty">No matching attendance data.</p>`; return; }
  const maximum = Math.max(...rows.map((row) => Number(row.scheduled || 0)), 1);
  container.innerHTML = rows.map((row) => {
    const width = Math.max(3, Math.round((Number(row.scheduled || 0) / maximum) * 100));
    return `<div class="sales-bar-row"><div><strong title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</strong><span>${attendanceDashboardNumber(row.onSchedule)} / ${attendanceDashboardNumber(row.scheduled)} on schedule Â· ${attendanceDashboardPercent(row.strikeRate)}</span></div><i><b style="width:${width}%"></b></i></div>`;
  }).join("");
}

function renderAttendanceCoverageInsights(data) {
  if (!elements.attendanceCoverageHeroCount || !elements.attendanceCoverageInsights) return;
  const metrics = data?.metrics || {};
  const audience = data?.audience === "merchandiser" ? "merchandisers" : "reps";
  const strikeRate = Number(metrics.strikeRate || 0);
  elements.attendanceCoverageHeroCount.textContent = data ? attendanceDashboardNumber(metrics.users) : "-";
  elements.attendanceCoverageHeroSub.textContent = data ? `${audience} in the selected view` : "users in the selected Geo Rep Capture view";
  elements.attendanceCoverageHeroRate.textContent = `${attendanceDashboardPercent(strikeRate)} strike rate`;
  elements.attendanceCoverageHeroBar.style.width = `${Math.max(0, Math.min(100, strikeRate)).toFixed(1)}%`;
  if (!data) {
    elements.attendanceCoverageInsights.innerHTML = `<p class="history-empty">No attendance insights yet.</p>`;
    return;
  }
  const topRegion = data.charts?.byRegion?.[0];
  const topManager = data.charts?.byManager?.[0];
  const topRole = data.charts?.byRole?.[0];
  const bestDay = [...(data.scheduleAnalytics?.daily || [])].sort((left, right) => Number(right.rate || 0) - Number(left.rate || 0))[0];
  const missed = Math.max(0, Number(metrics.scheduled || 0) - Number(metrics.onSchedule || 0));
  const insights = [
    { label: "Coverage gap", value: `${attendanceDashboardNumber(missed)} missed`, detail: `${attendanceDashboardNumber(metrics.onSchedule)} of ${attendanceDashboardNumber(metrics.scheduled)} scheduled visits are on schedule.` },
    topRegion ? { label: "Largest region", value: topRegion.label, detail: `${attendanceDashboardNumber(topRegion.onSchedule)} of ${attendanceDashboardNumber(topRegion.scheduled)} visits on schedule.` } : null,
    topManager ? { label: "Top manager load", value: topManager.label, detail: `${attendanceDashboardNumber(topManager.scheduled)} scheduled visits in the current filter.` } : null,
    topRole ? { label: "Main resource type", value: topRole.label, detail: `${attendanceDashboardPercent(topRole.strikeRate)} strike rate for this role.` } : null,
    bestDay ? { label: "Best day", value: bestDay.label, detail: `${attendanceDashboardPercent(bestDay.rate)} attendance rate.` } : null
  ].filter(Boolean);
  elements.attendanceCoverageInsights.innerHTML = insights.length
    ? insights.map((item) => `<div><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong><small>${escapeHtml(item.detail)}</small></div>`).join("")
    : `<p class="history-empty">No attendance insights yet.</p>`;
}

function attendanceMissed(row) {
  return Math.max(0, Number(row?.scheduled || 0) - Number(row?.onSchedule ?? row?.attended ?? 0));
}

function renderAttendanceCallCycleTiles(data) {
  if (!elements.attendanceCallCycleTiles) return;
  if (!data) {
    elements.attendanceCallCycleTiles.innerHTML = `<p class="history-empty">No attendance coverage split yet.</p>`;
    return;
  }
  const metrics = data.metrics || {};
  const sourceRows = Number(data?.source?.strikeRate?.rows || 0);
  const scheduled = Number(metrics.scheduled || 0);
  const onSchedule = Number(metrics.onSchedule || 0);
  const missed = Math.max(0, scheduled - onSchedule);
  const tiles = [
    { label: "Scheduled", value: metrics.scheduled, pct: scheduled ? "100.0%" : "0.0%" },
    { label: "On schedule", value: metrics.onSchedule, pct: attendanceDashboardPercent(metrics.strikeRate) },
    { label: "Missed", value: missed, pct: attendanceDashboardPercent(scheduled ? (missed / scheduled) * 100 : 0) },
    { label: "Leave", value: metrics.leave, pct: attendanceDashboardPercent(scheduled ? (Number(metrics.leave || 0) / scheduled) * 100 : 0) },
    { label: "Additional", value: metrics.additionalVisits, pct: attendanceDashboardPercent(scheduled ? (Number(metrics.additionalVisits || 0) / scheduled) * 100 : 0) },
    { label: "Source rows", value: sourceRows, pct: "raw" }
  ];
  const max = Math.max(...tiles.map((tile) => Number(tile.value || 0)), 1);
  elements.attendanceCallCycleTiles.innerHTML = tiles.map((tile) => {
    const width = Math.max(3, Math.round((Number(tile.value || 0) / max) * 100));
    return `<article><span>${escapeHtml(tile.label)}</span><div><strong>${attendanceDashboardNumber(tile.value)}</strong><small>${escapeHtml(tile.pct)}</small></div><i><b style="width:${width}%"></b></i></article>`;
  }).join("");
}

function renderAttendanceCoveragePages(data) {
  const regionRows = data?.charts?.byRegion || [];
  const storeRows = data?.stores || [];
  const resourceRows = data?.rows || [];
  const dailyRows = data?.scheduleAnalytics?.daily || [];
  const regionBody = regionRows.length
    ? regionRows.map((row) => `<tr><td>${escapeHtml(row.label || "-")}</td><td>${attendanceDashboardNumber(row.scheduled)}</td><td>${attendanceDashboardNumber(row.onSchedule)}</td><td>${attendanceDashboardNumber(attendanceMissed(row))}</td><td>${attendanceDashboardNumber(row.additionalVisits)}</td><td>${attendanceDashboardPercent(row.strikeRate)}</td></tr>`).join("")
    : `<tr><td colspan="6">No region data yet.</td></tr>`;
  const resourceBody = resourceRows.length
    ? resourceRows.map((row) => `<tr><td>${escapeHtml(row.userName || "-")}</td><td>${escapeHtml(row.role || "-")}</td><td>${escapeHtml(row.manager || "-")}</td><td>${escapeHtml(row.region || "-")}</td><td>${attendanceDashboardNumber(row.scheduled)}</td><td>${attendanceDashboardNumber(row.onSchedule)}</td><td>${attendanceDashboardNumber(attendanceMissed(row))}</td><td>${attendanceDashboardNumber(row.additionalVisits)}</td><td>${attendanceDashboardPercent(row.strikeRate)}</td></tr>`).join("")
    : `<tr><td colspan="9">No resource data yet.</td></tr>`;
  const storeBody = storeRows.length
    ? storeRows.map((row) => `<tr><td>${escapeHtml(row.storeName || "-")}</td><td>${escapeHtml(row.region || "-")}</td><td title="${escapeHtml((row.resources || []).join(", "))}">${escapeHtml((row.resources || []).join(", ") || "-")}</td><td>${attendanceDashboardNumber(row.scheduled)}</td><td>${attendanceDashboardNumber(row.attended)}</td><td>${attendanceDashboardNumber(row.missed)}</td><td>${attendanceDashboardPercent(row.attendanceRate)}</td><td>${escapeHtml(row.lastScheduledDate || "-")}</td></tr>`).join("")
    : `<tr><td colspan="8">Store coverage will be available after the next Geo attendance update.</td></tr>`;
  const dailyBody = dailyRows.length
    ? dailyRows.map((row) => `<tr><td>${escapeHtml(row.label || "-")}</td><td>${attendanceDashboardNumber(row.scheduled)}</td><td>${attendanceDashboardNumber(row.attended)}</td><td>${attendanceDashboardNumber(Math.max(0, Number(row.scheduled || 0) - Number(row.attended || 0)))}</td><td>${attendanceDashboardPercent(row.rate)}</td></tr>`).join("")
    : `<tr><td colspan="5">No daily data yet.</td></tr>`;
  const usersBody = resourceRows.length
    ? resourceRows.map((row) => `<tr><td>${escapeHtml(row.userName || "-")}</td><td>${escapeHtml(row.role || "-")}</td><td>${escapeHtml(row.manager || "-")}</td><td>${escapeHtml(row.region || "-")}</td><td>${attendanceDashboardNumber(row.scheduled)}</td><td>${attendanceDashboardNumber(row.onSchedule)}</td><td>${attendanceDashboardPercent(row.strikeRate)}</td><td>${attendanceDashboardNumber(row.totalCheckins)}</td></tr>`).join("")
    : `<tr><td colspan="8">No attendance data yet.</td></tr>`;
  if (elements.attendanceCoverageRegionCount) elements.attendanceCoverageRegionCount.textContent = `${attendanceDashboardNumber(regionRows.length)} regions`;
  if (elements.attendanceCoverageRegionScorecard) elements.attendanceCoverageRegionScorecard.innerHTML = regionBody;
  const storedTotal = Number(data?.storeCoverage?.totalStores || storeRows.length);
  if (elements.attendanceCoverageStoreCount) elements.attendanceCoverageStoreCount.textContent = `${attendanceDashboardNumber(storedTotal)} stores`;
  if (elements.attendanceCoverageStoreRows) elements.attendanceCoverageStoreRows.innerHTML = storeBody;
  if (elements.attendanceCoverageResourceCount) elements.attendanceCoverageResourceCount.textContent = `${attendanceDashboardNumber(resourceRows.length)} resources`;
  if (elements.attendanceCoverageResourceRows) elements.attendanceCoverageResourceRows.innerHTML = resourceBody;
  if (elements.attendanceCoverageDailyCount) elements.attendanceCoverageDailyCount.textContent = `${attendanceDashboardNumber(dailyRows.length)} days`;
  if (elements.attendanceCoverageDailyRows) elements.attendanceCoverageDailyRows.innerHTML = dailyBody;
  if (elements.attendanceCoverageUserCount) elements.attendanceCoverageUserCount.textContent = `${attendanceDashboardNumber(resourceRows.length)} users`;
  if (elements.attendanceCoverageUserRows) elements.attendanceCoverageUserRows.innerHTML = usersBody;
}

function publishAttendanceRegionalFootprint(data) {
  const map = elements.attendanceRegionalFootprint;
  if (!map?.contentWindow) return;
  const storeCounts = (data?.stores || []).reduce((counts, store) => {
    const region = String(store?.region || "").trim();
    if (region) counts[region] = (counts[region] || 0) + 1;
    return counts;
  }, {});
  const regions = (data?.charts?.byRegion || []).map((row) => ({
    region: row.label || "Unknown",
    scheduled: Number(row.scheduled || 0),
    onSchedule: Number(row.onSchedule || 0),
    strikeRate: Number(row.strikeRate || 0),
    stores: Number(storeCounts[row.label] || 0)
  }));
  map.contentWindow.postMessage({
    type: "nexus-call-cycle-region-data",
    payload: { regions, reportEndDate: data?.reportEndDate || "" }
  }, window.location.origin);
}

function renderAttendanceDashboardLegacy(data) {
  state.attendanceDashboardData = data || null;
  const metrics = data?.metrics || {};
  const audience = data?.audience === "merchandiser" ? "merchandiser" : state.attendanceDashboardAudience;
  const audienceLabel = audience === "merchandiser" ? "Merchandiser" : "Rep";
  const operationalWeek = Number(data?.operationalWeek || 0);
  elements.attendanceDashboardOperationalWeek.textContent = [1, 2, 3, 4].includes(operationalWeek) ? `Operational week ${operationalWeek}` : "Operational week not set";
  elements.attendanceDashboardPeriod.textContent = data?.reportStartDate && data?.reportEndDate
    ? `${data.reportStartDate} to ${data.reportEndDate}` : "Latest run";
  elements.attendanceDashboardUsers.textContent = data ? attendanceDashboardNumber(metrics.users) : "-";
  elements.attendanceDashboardScheduled.textContent = data ? attendanceDashboardNumber(metrics.scheduled) : "-";
  elements.attendanceDashboardOnSchedule.textContent = data ? attendanceDashboardNumber(metrics.onSchedule) : "-";
  elements.attendanceDashboardStrikeRate.textContent = data ? attendanceDashboardPercent(metrics.strikeRate) : "-";
  elements.attendanceDashboardLeave.textContent = data ? attendanceDashboardNumber(metrics.leave) : "-";
  elements.attendanceDashboardCheckins.textContent = data ? attendanceDashboardNumber(metrics.totalCheckins) : "-";
  elements.attendanceDashboardAdditional.textContent = data ? attendanceDashboardNumber(metrics.additionalVisits) : "-";
  const storeCount = Number(data?.storeCoverage?.totalStores || data?.stores?.length || 0);
  if (state.attendanceProduct === "attendance" && state.attendanceDashboardSource === "geo") {
    if (elements.attendanceHeaderMetricLabel) elements.attendanceHeaderMetricLabel.textContent = "Stores in view";
    if (elements.attendanceHeaderStoreCount) elements.attendanceHeaderStoreCount.textContent = data && storeCount ? attendanceDashboardNumber(storeCount) : "-";
  }
  if (elements.attendanceNavRegionCount) elements.attendanceNavRegionCount.textContent = data ? attendanceDashboardNumber((data?.charts?.byRegion || []).length) : "-";
  if (elements.attendanceNavResourceCount) elements.attendanceNavResourceCount.textContent = data ? attendanceDashboardNumber(metrics.users) : "-";
  if (elements.attendanceNavStoreCount) elements.attendanceNavStoreCount.textContent = data && storeCount ? attendanceDashboardNumber(storeCount) : "-";
  if (elements.attendanceSidebarDataDate) elements.attendanceSidebarDataDate.textContent = data?.reportEndDate ? `Data to ${data.reportEndDate}` : "Data awaiting latest run";
  if (elements.attendanceSidebarDataNote) elements.attendanceSidebarDataNote.textContent = data && storeCount ? `${attendanceDashboardNumber(storeCount)} stores in coverage` : "Geo Rep Capture attendance";
  const sourceRows = Number(data?.source?.strikeRate?.rows || 0);
  elements.attendanceDashboardSourceRows.textContent = data ? attendanceDashboardNumber(sourceRows) : "-";
  elements.attendanceDashboardSourceNote.textContent = data?.source?.strikeRate?.fileName
    ? `${data.source.strikeRate.fileName} Â· ${attendanceDashboardNumber(data.source.strikeRate.salesRepRows)} ${audienceLabel} rows available in portal`
    : "Waiting for a completed run";
  renderAttendanceCoverageInsights(data);
  renderAttendanceCallCycleTiles(data);
  renderAttendanceCoveragePages(data);
  publishAttendanceRegionalFootprint(data);
  renderSalesDashboardOptions(elements.attendanceDashboardRole, data?.availableFilters?.roles || [], "All roles");
  renderSalesDashboardOptions(elements.attendanceDashboardRegion, data?.availableFilters?.regions || [], "All regions");
  renderSalesDashboardOptions(elements.attendanceDashboardManager, data?.availableFilters?.managers || [], "All managers");
  renderAttendanceDashboardBars(elements.attendanceDashboardRegions, data?.charts?.byRegion || []);
  renderAttendanceDashboardBars(elements.attendanceDashboardManagers, data?.charts?.byManager || []);
  const scheduleBars = (rows) => (rows || []).map((row) => ({ label: row.label, scheduled: row.scheduled, onSchedule: row.attended, strikeRate: row.rate }));
  renderAttendanceDashboardBars(elements.attendanceDashboardWeekly, scheduleBars(data?.scheduleAnalytics?.weekly));
  renderAttendanceDashboardBars(elements.attendanceDashboardDaily, scheduleBars(data?.scheduleAnalytics?.daily));
  renderAttendanceDashboardBars(elements.attendanceDashboardRoles, data?.charts?.byRole || []);
  const rows = data?.rows || [];
  elements.attendanceDashboardRowsCount.textContent = `${attendanceDashboardNumber(rows.length)} users`;
  elements.attendanceDashboardRows.innerHTML = rows.length
    ? rows.map((row) => `<tr><td>${escapeHtml(row.userName || "-")}</td><td>${escapeHtml(row.role || "-")}</td><td>${escapeHtml(row.manager || "-")}</td><td>${escapeHtml(row.region || "-")}</td><td>${attendanceDashboardNumber(row.scheduled)}</td><td>${attendanceDashboardNumber(row.onSchedule)}</td><td>${attendanceDashboardPercent(row.strikeRate)}</td><td>${attendanceDashboardNumber(row.totalCheckins)}</td></tr>`).join("")
    : `<tr><td colspan="8">No attendance data yet.</td></tr>`;
}

function attendancePgPercent(value) {
  const numeric = Number(value || 0);
  return Math.max(0, Math.min(100, numeric <= 1 ? numeric * 100 : numeric));
}

function attendancePgFormatPercent(value) {
  return `${attendancePgPercent(value).toLocaleString("en-ZA", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function attendancePgDivision(region) { return window.NexusAttendance.division(region); }

function attendancePgRows(items, labelKey = "label", scheduledKey = "scheduled", actualKey = "onSchedule") {
  return (items || []).map((item) => {
    const scheduled = Number(item?.[scheduledKey] || 0);
    const actual = Number(item?.[actualKey] || 0);
    return { label: String(item?.[labelKey] || "Unassigned"), scheduled, actual, rate: scheduled ? (actual / scheduled) * 100 : attendancePgPercent(item?.strikeRate ?? item?.rate), additional: Number(item?.additionalVisits || 0), totalCheckins: Number(item?.totalCheckins || actual) };
  });
}

function attendancePgKpi(label, value, sub, accent, color = "#f3f7fc") {
  return `<article class="pg-source-kpi" style="--pg-accent:${accent}"><span>${escapeHtml(label)}</span><strong style="color:${color}">${escapeHtml(String(value))}</strong><small>${escapeHtml(sub)}</small></article>`;
}

function attendancePgBars(rows, emptyMessage = "No attendance data is available.") {
  if (!rows.length) return `<p class="history-empty">${escapeHtml(emptyMessage)}</p>`;
  const maximum = Math.max(...rows.map((row) => Number(row.scheduled || row.actual || 0)), 1);
  return `<div class="pg-source-bars">${rows.map((row) => {
    const progress = attendancePgPercent(row.rate);
    const width = Math.max(3, Math.round((Number(row.scheduled || row.actual || 0) / maximum) * 100));
    const color = progress >= 95 ? "#22c55e" : progress >= 80 ? "#e8a838" : "#d94f3a";
    return `<div class="pg-source-bar"><div><span title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</span><b>${attendanceDashboardNumber(row.actual)} / ${attendanceDashboardNumber(row.scheduled)}</b></div><i><b style="width:${width}%;background:${color}"></b></i><small style="color:${color}">${attendancePgFormatPercent(progress)}</small></div>`;
  }).join("")}</div>`;
}

function attendancePgRing(label, rate, detail, color) {
  const progress = attendancePgPercent(rate);
  return `<div class="pg-source-ring-group"><div class="pg-source-ring" style="--pg-progress:${progress};--pg-ring:${color}"><b>${attendancePgFormatPercent(progress)}</b></div><strong>${escapeHtml(label)}</strong><small>${escapeHtml(detail)}</small></div>`;
}

function attendancePgTable(headers, rows, emptyMessage) {
  return `<div class="pg-source-table-wrap"><table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.join("") : `<tr><td colspan="${headers.length}">${escapeHtml(emptyMessage)}</td></tr>`}</tbody></table></div>`;
}

function attendancePgFilterBar(context) {
  const optionList = (items, allLabel, selected = "") => `<option value=""${selected ? "" : " selected"}>${escapeHtml(allLabel)}</option>${items.map((value) => `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(value)}</option>`).join("")}`;
  const filters = context.filters || {};
  const selected = context.selectedFilters || {};
  const select = (field, items, label) => `<select data-pg-attendance-filter="${field}" aria-label="${label}"${items.length ? "" : " disabled"}>${optionList(items, `All ${label.toLowerCase()}`, selected[field])}</select>`;
  return `<section class="pg-source-filterbar" aria-label="Attendance filters"><label><select disabled aria-label="Month"><option>${escapeHtml(context.monthLabel || "Latest month")}</option></select></label><label>${select("region", filters.regions || [], "Regions")}</label><label>${select("banner", filters.banners || [], "Banners")}</label><label>${select("channel", filters.channels || [], "Channels")}</label><label>${select("manager", filters.managers || [], "Managers")}</label><label>${select("division", filters.divisions || [], "Divisions")}</label><label>${select("role", filters.roles || [], context.audienceLabel === "Merchandiser" ? "Merchandiser types" : "Rep types")}</label><button data-pg-attendance-clear type="button">Clear filters</button></section>`;
}

function attendancePgOverview(context) {
  const divisionRows = context.divisionRows;
  const inland = context.regionRows.filter((row) => attendancePgDivision(row.label) === "INLAND");
  const coastal = context.regionRows.filter((row) => attendancePgDivision(row.label) === "COASTAL");
  const divisionCard = `<article class="pg-source-card pg-source-division"><header><div><h2>Attendance by division</h2><p>${escapeHtml(context.divisionMessage)}</p></div></header><div class="pg-source-ring-row">${divisionRows.slice(0, 2).map((row) => attendancePgRing(row.label, row.rate, `${attendanceDashboardNumber(row.actual)} of ${attendanceDashboardNumber(row.scheduled)}`, row.label === "COASTAL" ? "#f58220" : "#4fa3e3")).join("") || `<p class="history-empty">No division breakdown available.</p>`}</div><ul>${divisionRows.slice(0, 2).map((row) => `<li><i style="background:${row.label === "COASTAL" ? "#f58220" : "#4fa3e3"}"></i><b>${escapeHtml(row.label)}</b> ${attendancePgFormatPercent(row.rate)} with ${attendanceDashboardNumber(Math.max(0, row.scheduled - row.actual))} visits still due.</li>`).join("")}</ul></article>`;
  const roleCard = `<article class="pg-source-card pg-source-reptype"><header><div><h2>Attendance by rep type</h2></div><span><i class="pg-ahead"></i>Ahead <i class="pg-pace"></i>On pace <i class="pg-behind"></i>Behind</span></header><div class="pg-source-role-grid">${context.roleRows.length ? context.roleRows.slice(0, 6).map((row) => { const rate = attendancePgPercent(row.rate); const color = rate >= 95 ? "#22c55e" : rate >= 80 ? "#e8a838" : "#d94f3a"; return `<div><strong>${escapeHtml(row.label)}</strong><b style="color:${color}">${attendancePgFormatPercent(rate)}</b><small>${attendanceDashboardNumber(row.scheduled)} visits</small><i><em style="width:${Math.max(3, rate)}%;background:${color}"></em></i></div>`; }).join("") : `<p class="history-empty">No rep type data available.</p>`}</div></article>`;
  const regionalCard = (title, rows, message) => `<article class="pg-source-card pg-source-region"><header><div><h2>${title}</h2><p>${message}</p></div></header><div class="pg-source-split-bars"><section><strong>INLAND</strong>${attendancePgBars(rows.filter((row) => attendancePgDivision(row.label) === "INLAND").slice(0, 5), "No Inland data.")}</section><section><strong>COASTAL</strong>${attendancePgBars(rows.filter((row) => attendancePgDivision(row.label) === "COASTAL").slice(0, 5), "No Coastal data.")}</section></div></article>`;
  const missedRows = context.regionRows.map((row) => ({ ...row, actual: Math.max(0, row.scheduled - row.actual), rate: row.scheduled ? ((row.scheduled - row.actual) / row.scheduled) * 100 : 0 }));
  const managerRows = context.managerRows.slice(0, 24).map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${attendanceDashboardNumber(row.scheduled)}</td><td>${attendanceDashboardNumber(row.actual)}</td><td><b class="pg-rate-cell" style="--pg-rate:${attendancePgPercent(row.rate)}">${attendancePgFormatPercent(row.rate)}</b></td><td>${attendanceDashboardNumber(Math.max(0, row.scheduled - row.actual))}</td></tr>`);
  const weeklyRows = context.weeklyRows.slice(0, 8).map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${attendanceDashboardNumber(row.scheduled)}</td><td>${attendanceDashboardNumber(row.actual)}</td><td>${attendancePgFormatPercent(row.rate)}</td></tr>`);
  return `<section class="pg-source-kpis">${context.kpis.join("")}</section><section class="pg-source-overview-grid">${divisionCard}${roleCard}${regionalCard("% Attendance by region", context.regionRows, "MTD progress by province and region")}${regionalCard("Missed stores by region", missedRows, "Stores not yet visited MTD, by region")}</section><section class="pg-source-bottom-grid"><article class="pg-source-card"><header><div><h2>Line manager scorecard</h2><p>Attendance and visits not completed</p></div></header>${attendancePgTable(["Line manager", "Target", "Actual", "Attend %", "Not vis."], managerRows, "No manager scorecard available.")}</article><article class="pg-source-card"><header><div><h2>Weekly attendance</h2><p>Scheduled vs actual visits</p></div></header>${attendancePgTable(["Week", "Scheduled", "Actual", "Attendance"], weeklyRows, "No weekly attendance available.")}</article></section>`;
}

function attendancePgDaily(context) {
  const latest = context.dailyRows[context.dailyRows.length - 1] || { scheduled: 0, actual: 0, rate: 0, label: "Latest day" };
  const missed = Math.max(0, latest.scheduled - latest.actual);
  const kpis = [attendancePgKpi("Scheduled Visits", attendanceDashboardNumber(latest.scheduled), "due on selected day", "#22c55e"), attendancePgKpi("Actual Visits", attendanceDashboardNumber(latest.actual), "completed", "#d94f3a"), attendancePgKpi("Attendance (Day)", attendancePgFormatPercent(latest.rate), "of due visits", "#f58220"), attendancePgKpi("Stores Not Visited", attendanceDashboardNumber(missed), `of ${attendanceDashboardNumber(latest.scheduled)} due`, "#3b82f6", missed ? "#d94f3a" : "#22c55e"), attendancePgKpi("% Stores Not Visited", attendancePgFormatPercent(latest.scheduled ? (missed / latest.scheduled) * 100 : 0), "unvisited share", "#a78bfa"), attendancePgKpi("Time Gone", attendancePgFormatPercent(context.timeGone), `latest: ${latest.label}`, "#22c55e")];
  const tableRows = context.dailyRows.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${attendanceDashboardNumber(row.scheduled)}</td><td>${attendanceDashboardNumber(row.actual)}</td><td>${attendanceDashboardNumber(Math.max(0, row.scheduled - row.actual))}</td><td>${attendancePgFormatPercent(row.rate)}</td></tr>`);
  return `<section class="pg-source-datebar"><span>Daily Visits</span><strong>${escapeHtml(latest.label)}</strong></section><section class="pg-source-kpis">${kpis.join("")}</section><section class="pg-source-overview-grid"><article class="pg-source-card"><header><div><h2>Daily attendance trend</h2><p>Visits completed by day</p></div></header>${attendancePgBars(context.dailyRows, "No daily attendance data.")}</article><article class="pg-source-card"><header><div><h2>Attendance by rep type</h2><p>Latest available breakdown</p></div></header>${attendancePgBars(context.roleRows, "No rep type data available.")}</article></section><article class="pg-source-card"><header><div><h2>Daily visit detail</h2><p>Latest verified daily attendance</p></div></header>${attendancePgTable(["Date", "Scheduled", "Actual", "Not visited", "Attendance"], tableRows, "No daily attendance is available.")}</article>`;
}

function attendancePgRoster(context) {
  const rows = context.resourceRows;
  const active = rows.filter((row) => row.actual > 0).length;
  const best = [...rows].sort((a, b) => b.rate - a.rate)[0];
  const worst = [...rows].sort((a, b) => a.rate - b.rate)[0];
  const kpis = [attendancePgKpi("Reps", attendanceDashboardNumber(rows.length), `${attendanceDashboardNumber(active)} active this month`, "#22c55e"), attendancePgKpi("Avg Attendance", attendancePgFormatPercent(rows.length ? rows.reduce((sum, row) => sum + row.rate, 0) / rows.length : 0), "across selected reps", "#d94f3a"), attendancePgKpi("Top Performer", best ? attendancePgFormatPercent(best.rate) : "-", best?.label || "No data", "#f58220", "#22c55e"), attendancePgKpi("Needs Attention", worst ? attendancePgFormatPercent(worst.rate) : "-", worst?.label || "No data", "#3b82f6", "#d94f3a")];
  const tableRows = rows.slice().sort((a, b) => a.rate - b.rate).map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.role || "-")}</td><td>${escapeHtml(row.manager || "-")}</td><td>${escapeHtml(row.region || "-")}</td><td>${attendanceDashboardNumber(row.scheduled)}</td><td>${attendanceDashboardNumber(row.actual)}</td><td><b class="pg-rate-cell" style="--pg-rate:${attendancePgPercent(row.rate)}">${attendancePgFormatPercent(row.rate)}</b></td></tr>`);
  return `<section class="pg-source-kpis pg-source-kpis-four">${kpis.join("")}</section><article class="pg-source-card pg-source-detail"><header><div><h2>Rep roster MTD</h2><p>${attendanceDashboardNumber(rows.length)} reps in the current view</p></div></header>${attendancePgTable(["Rep", "Rep type", "Manager", "Region", "Target", "Actual", "Progress"], tableRows, "No roster data is available.")}</article>`;
}

function attendancePgStores(context) {
  const rows = context.storeRows;
  const visited = rows.filter((row) => row.actual > 0).length;
  const missed = rows.length - visited;
  const kpis = [attendancePgKpi("Total Stores", attendanceDashboardNumber(rows.length), "in current filter", "#22c55e"), attendancePgKpi("Visited", attendanceDashboardNumber(visited), "store visits completed", "#d94f3a", "#22c55e"), attendancePgKpi("Missed", attendanceDashboardNumber(missed), "not yet visited", "#f58220", "#d94f3a"), attendancePgKpi("% Missed", attendancePgFormatPercent(rows.length ? (missed / rows.length) * 100 : 0), "of assigned stores", "#3b82f6")];
  const tableRows = rows.slice().sort((a, b) => a.actual - b.actual).map((row) => `<tr><td><span class="pg-status ${row.actual > 0 ? "visited" : "missed"}">${row.actual > 0 ? "Visited" : "Missed"}</span></td><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.owner || "-")}</td><td>${escapeHtml(row.region || "-")}</td><td>${attendanceDashboardNumber(row.scheduled)}</td><td>${attendanceDashboardNumber(row.actual)}</td></tr>`);
  return `<section class="pg-source-kpis pg-source-kpis-four">${kpis.join("")}</section><article class="pg-source-card pg-source-detail"><header><div><h2>Attendance detail by store</h2><p>${attendanceDashboardNumber(rows.length)} stores &middot; missed stores first</p></div></header>${attendancePgTable(["Status", "Store", "Rep", "Region", "Target", "Actual"], tableRows, "No store detail is available.")}</article>`;
}

function renderAttendancePgPage(context) {
  const page = state.attendanceCoveragePage;
  const body = page === "daily" ? attendancePgDaily(context) : page === "users" ? attendancePgRoster(context) : page === "stores" ? attendancePgStores(context) : attendancePgOverview(context);
  return `${attendancePgFilterBar(context)}<section class="pg-source-page pg-source-page-${page}">${body}</section>`;
}

function buildGeoAttendancePgContext(data) {
  const metrics = data?.metrics || {};
  const resourceRows = (data?.rows || []).map((row) => ({ label: row.userName || "Unassigned", role: row.role || "-", manager: row.manager || "-", region: row.region || "-", scheduled: Number(row.scheduled || 0), actual: Number(row.onSchedule || 0), rate: attendancePgPercent(row.strikeRate), totalCheckins: Number(row.totalCheckins || 0) }));
  const storeRows = (data?.stores || []).map((row) => ({ label: row.storeName || "Unassigned store", owner: (row.resources || []).join(", "), region: row.region || "-", scheduled: Number(row.scheduled || 0), actual: Number(row.attended || 0), rate: attendancePgPercent(row.attendanceRate) }));
  const regionRows = attendancePgRows(data?.charts?.byRegion || []);
  const roleRows = attendancePgRows(data?.charts?.byRole || []);
  const managerRows = attendancePgRows(data?.charts?.byManager || []);
  const weeklyRows = attendancePgRows(data?.scheduleAnalytics?.weekly || [], "label", "scheduled", "attended");
  const dailyRows = attendancePgRows(data?.scheduleAnalytics?.daily || [], "label", "scheduled", "attended");
  const divisionMap = new Map();
  regionRows.forEach((row) => {
    const division = attendancePgDivision(row.label);
    const aggregate = divisionMap.get(division) || { label: division, scheduled: 0, actual: 0, rate: 0 };
    aggregate.scheduled += row.scheduled;
    aggregate.actual += row.actual;
    aggregate.rate = aggregate.scheduled ? (aggregate.actual / aggregate.scheduled) * 100 : 0;
    divisionMap.set(division, aggregate);
  });
  const scheduled = Number(metrics.scheduled || 0);
  const actual = Number(metrics.onSchedule || 0);
  const totalStores = Number(data?.storeCoverage?.totalStores || storeRows.length || 0);
  const missedStores = storeRows.length ? storeRows.filter((row) => row.actual <= 0).length : Math.max(0, totalStores - Number(metrics.coveredStores || 0));
  const reportDate = data?.reportEndDate ? new Date(`${data.reportEndDate}T12:00:00`) : null;
  const timeGone = reportDate && !Number.isNaN(reportDate.getTime()) ? (reportDate.getDate() / new Date(reportDate.getFullYear(), reportDate.getMonth() + 1, 0).getDate()) * 100 : 100;
  const audienceLabel = data?.audience === "merchandiser" ? "Merchandisers" : "Reps";
  return {
    monthLabel: data?.reportEndDate || "Latest verified Geo report", filters: data?.availableFilters || {}, selectedFilters: attendanceDashboardCurrentFilters(), resourceRows, storeRows, regionRows, roleRows, managerRows, weeklyRows, dailyRows, divisionRows: (data?.charts?.byDivision?.length ? attendancePgRows(data.charts.byDivision) : [...divisionMap.values()]), timeGone,
    divisionMessage: "Attendance progress across the active Geo regions",
    kpis: [
      attendancePgKpi("Scheduled Visits", attendanceDashboardNumber(scheduled), "MTD visit target", "#22c55e"),
      attendancePgKpi("Actual Visits", attendanceDashboardNumber(actual), "MTD completed", "#d94f3a"),
      attendancePgKpi("Attendance MTD", attendancePgFormatPercent(metrics.strikeRate), `${attendanceDashboardNumber(resourceRows.filter((row) => row.actual > 0).length)} / ${attendanceDashboardNumber(resourceRows.length)} ${audienceLabel.toLowerCase()} active`, "#f58220", attendancePgPercent(metrics.strikeRate) >= 95 ? "#22c55e" : "#d94f3a"),
      attendancePgKpi("Stores Not Visited", attendanceDashboardNumber(missedStores), `of ${attendanceDashboardNumber(totalStores)} assigned`, "#3b82f6", missedStores ? "#d94f3a" : "#22c55e"),
      attendancePgKpi("% Stores Not Visited", attendancePgFormatPercent(totalStores ? (missedStores / totalStores) * 100 : 0), "unvisited share", "#a78bfa"),
      attendancePgKpi("Time Gone", attendancePgFormatPercent(timeGone), "of report month elapsed", "#22c55e")
    ]
  };
}

function renderAttendanceDashboard(data) {
  state.attendanceDashboardData = data || null;
  const container = elements.attendanceGeoOverview;
  if (container && data?.analyticsVersion === 1) {
    const generation = nexusSessionGeneration;
    const audience = state.attendanceDashboardAudience;
    const filters = attendanceDashboardCurrentFilters();
    window.NexusAttendance.render(container, data, {
      page: state.attendanceCoveragePage, filters,
      filterBar: attendancePgFilterBar({ monthLabel: data.reportEndDate, filters: data.availableFilters, selectedFilters: filters, audienceLabel: data.audience === "merchandiser" ? "Merchandiser" : "Rep" }),
      request: payload => callFunction("getGeoRepAttendanceDashboard", { ...payload, export: true }),
      current: () => generation === nexusSessionGeneration && state.isOperator && state.attendanceDashboardData === data && JSON.stringify(filters) === JSON.stringify(attendanceDashboardCurrentFilters()) && state.attendanceDashboardAudience === audience && state.attendanceDashboardSource === "geo" && window.location.hash === "#attendance"
    });
  } else if (container) {
    container.onclick = null; container.onchange = null;
    container.innerHTML = data ? renderAttendancePgPage(buildGeoAttendancePgContext(data)) : '<section class="pg-source-page"><p class="history-empty">No Geo attendance is available yet.</p></section>';
  }
  const storeCount = Number(data?.storeCoverage?.totalStores || data?.stores?.length || 0);
  if (elements.attendanceHeaderMetricLabel) elements.attendanceHeaderMetricLabel.textContent = "Stores in view";
  if (elements.attendanceHeaderStoreCount) elements.attendanceHeaderStoreCount.textContent = data ? attendanceDashboardNumber(storeCount) : "-";
  if (elements.attendanceDashboardOperationalWeek) elements.attendanceDashboardOperationalWeek.textContent = Number(data?.operationalWeek || 0) ? `Operational week ${data.operationalWeek}` : "Operational week not set";
  if (elements.attendanceDashboardPeriod) elements.attendanceDashboardPeriod.textContent = data?.reportEndDate || "Latest run";
  syncAttendanceWorkspaceHeader();
  renderSalesDashboardOptions(elements.attendanceDashboardRole, data?.availableFilters?.roles || [], "All rep types");
  renderSalesDashboardOptions(elements.attendanceDashboardRegion, data?.availableFilters?.regions || [], "All regions");
  renderSalesDashboardOptions(elements.attendanceDashboardManager, data?.availableFilters?.managers || [], "All managers");
}

function attendanceDashboardCurrentFilters() {
  return {
    role: elements.attendanceDashboardRole.value,
    region: elements.attendanceDashboardRegion.value,
    manager: elements.attendanceDashboardManager.value,
    ...(state.attendanceDashboardExtraFilters || {})
  };
}

function setAttendanceCoveragePage(page) {
  const validPages = new Set(["overview", "stores", "daily", "users"]);
  state.attendanceCoveragePage = validPages.has(page) ? page : "overview";
  document.querySelectorAll("[data-attendance-page]").forEach((button) => {
    const active = button.dataset.attendancePage === state.attendanceCoveragePage && (!button.dataset.attendanceSource || button.dataset.attendanceSource === state.attendanceDashboardSource);
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  syncAttendanceWorkspaceHeader();
  if (state.attendanceDashboardSource === "salesforce") renderDedicatedAttendanceDashboard(state.salesforceAttendanceDashboardData);
  else renderAttendanceDashboard(state.attendanceDashboardData);
}

function setAttendanceAudience(audience) {
  state.attendanceDashboardAudience = audience === "merchandiser" ? "merchandiser" : "rep";
  state.attendanceDashboardExtraFilters = {};
  state.attendanceWorksheetPage = 1;
  setAttendanceCoveragePage("overview");
  document.querySelectorAll("[data-attendance-audience]").forEach((button) => {
    const active = button.dataset.attendanceAudience === state.attendanceDashboardAudience;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  loadAttendanceDashboard();
}

function setAttendanceWorkbookTab(tab) {
  state.attendanceWorkbookTab = tab && tab !== "overview" ? tab : "overview";
  state.attendanceWorksheetPage = 1;
  elements.attendanceWorkbookTabs?.forEach((button) => {
    const active = button.dataset.attendanceWorkbookTab === state.attendanceWorkbookTab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  if (elements.attendanceGeoOverview) elements.attendanceGeoOverview.hidden = state.attendanceWorkbookTab !== "overview";
  if (elements.attendanceGeoWorksheetPanel) elements.attendanceGeoWorksheetPanel.hidden = state.attendanceWorkbookTab === "overview";
  if (state.attendanceWorkbookTab === "overview") return;
  loadAttendanceWorksheetView();
}

function renderAttendanceWorksheetView(data) {
  state.attendanceWorksheetData = data || null;
  const headers = data?.headers || [];
  const rows = data?.rows || [];
  const audienceLabel = data?.audience === "merchandiser" ? "Merchandiser" : "Rep";
  elements.attendanceWorksheetTitle.textContent = data ? `${audienceLabel} ${data.tab}` : "Geo Attendance worksheet";
  elements.attendanceWorksheetStatus.textContent = data
    ? `${attendanceDashboardNumber(data.rowCount)} rows from ${data.sourceFileName || "latest source"}`
    : "No worksheet data loaded.";
  elements.attendanceWorksheetHead.innerHTML = headers.length
    ? `<tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>`
    : `<tr><th>Worksheet</th></tr>`;
  elements.attendanceWorksheetRows.innerHTML = rows.length
    ? rows.map((row) => `<tr>${headers.map((_header, index) => `<td title="${escapeHtml(row[index] || "")}">${escapeHtml(row[index] || "")}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${Math.max(1, headers.length)}">No rows match the selected filters.</td></tr>`;
  elements.attendanceWorksheetPage.textContent = data ? `Page ${attendanceDashboardNumber(data.page)} of ${attendanceDashboardNumber(data.pageCount)}` : "Page 1 of 1";
  elements.attendanceWorksheetPrevious.disabled = !data || Number(data.page || 1) <= 1 || state.attendanceWorksheetLoading;
  elements.attendanceWorksheetNext.disabled = !data || Number(data.page || 1) >= Number(data.pageCount || 1) || state.attendanceWorksheetLoading;
}

async function loadAttendanceWorksheetView(page = state.attendanceWorksheetPage) {
  if (state.attendanceWorkbookTab === "overview" || state.attendanceWorksheetLoading) return;
  if (!state.isOperator || !cloudFunctions) {
    renderAttendanceWorksheetView(null);
    elements.attendanceWorksheetStatus.textContent = "Sign in to Nexus to load the workbook view.";
    return;
  }
  state.attendanceWorksheetLoading = true;
  elements.attendanceWorksheetPrevious.disabled = true;
  elements.attendanceWorksheetNext.disabled = true;
  elements.attendanceWorksheetStatus.textContent = `Loading ${state.attendanceWorkbookTab} rows...`;
  try {
    const data = await callFunction("getGeoRepAttendanceWorksheetView", {
      audience: state.attendanceDashboardAudience,
      tab: state.attendanceWorkbookTab,
      source: "tracker",
      page,
      pageSize: 100,
      filters: {}
    });
    state.attendanceWorksheetPage = data.page || 1;
    renderAttendanceWorksheetView(data);
  } catch (error) {
    renderAttendanceWorksheetView({ headers: [], rows: [], page: 1, pageCount: 1, rowCount: 0, sourceFileName: "" });
    elements.attendanceWorksheetStatus.textContent = friendlyError(error);
  } finally {
    state.attendanceWorksheetLoading = false;
    renderAttendanceWorksheetView(state.attendanceWorksheetData);
  }
}

function attendanceDashboardRange(startDate, endDate) {
  if (startDate && endDate) return `${startDate} to ${endDate}`;
  return startDate || endDate || "-";
}

function renderSalesforceAttendanceBars(id, rows, emptyMessage) {
  const container = document.querySelector(`#${id}`);
  if (!rows?.length) { container.innerHTML = `<p class="history-empty">${escapeHtml(emptyMessage)}</p>`; return; }
  const maximum = Math.max(...rows.map((row) => Number(row.value || 0)), 1);
  container.innerHTML = rows.map((row) => {
    const width = Math.max(3, Math.round((Number(row.value || 0) / maximum) * 100));
    return `<div class="sales-bar-row"><div><strong title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</strong><span>${escapeHtml(row.detail || `${attendanceDashboardNumber(row.value)}`)}</span></div><i><b style="width:${width}%"></b></i></div>`;
  }).join("");
}

function renderSalesforceWorkbookSnapshot(statusSelector, containerSelector, snapshot, emptyMessage) {
  const status = document.querySelector(statusSelector);
  const container = document.querySelector(containerSelector);
  if (!status || !container) return;
  if (!snapshot?.worksheet?.rows?.length) {
    status.textContent = snapshot ? "Workbook copy saved; preview not available." : "No verified workbook copy yet.";
    container.innerHTML = `<p class="history-empty">${escapeHtml(emptyMessage)}</p>`;
    return;
  }
  const worksheet = snapshot.worksheet;
  const rows = worksheet.rows || [];
  const previewRows = rows.slice(0, 40);
  const rowCells = (row) => Array.isArray(row) ? row : row?.cells || [];
  const columnCount = Number(worksheet.columnCount || previewRows.reduce((max, row) => Math.max(max, rowCells(row).length), 0));
  const headers = Array.from({ length: columnCount }, (_, index) => excelColumnLabel(index + 1));
  const createdAt = snapshot.createdAt ? formatDate(snapshot.createdAt) : "";
  status.textContent = `${worksheet.name || "Worksheet"} - ${attendanceDashboardNumber(worksheet.rowCount)} rows x ${attendanceDashboardNumber(columnCount)} columns${createdAt ? ` - ${createdAt}` : ""}`;
  const exportLink = /^https:\/\//i.test(String(snapshot.downloadUrl || ""))
    ? `<a class="secondary-button" href="${escapeHtml(snapshot.downloadUrl)}" target="_blank" rel="noopener noreferrer">Export saved workbook</a>`
    : "";
  const sharePointLink = /^https:\/\//i.test(String(snapshot.workbook?.url || ""))
    ? `<a class="secondary-button" href="${escapeHtml(snapshot.workbook.url)}" target="_blank" rel="noopener noreferrer">Open SharePoint workbook</a>`
    : "";
  const backupLabel = snapshot.workbook?.preWriteBackupId ? "Protected backup saved" : "Protected backup not recorded";
  const headerHtml = headers.map((label) => `<th>${label}</th>`).join("");
  const bodyHtml = previewRows.map((row) => {
    const cells = rowCells(row);
    return `<tr>${headers.map((_, index) => `<td>${escapeHtml(cells[index] ?? "")}</td>`).join("")}</tr>`;
  }).join("");
  const loadRowsButton = snapshot.id && Number(worksheet.rowCount || 0) > previewRows.length
    ? `<button class="secondary-button" type="button" data-salesforce-snapshot-load="${escapeHtml(snapshot.id)}" data-salesforce-snapshot-target="${escapeHtml(container.id)}" data-salesforce-snapshot-offset="0">Load workbook rows</button>`
    : "";
  container.innerHTML = `<div class="sales-monthly-snapshot-grid"><div><span>Workbook</span><strong>${escapeHtml(snapshot.fileName || snapshot.workbook?.name || "Attendance Blueprint.xlsx")}</strong></div><div><span>Worksheet</span><strong>${escapeHtml(worksheet.name || "-")}</strong></div><div><span>Rows</span><strong>${attendanceDashboardNumber(worksheet.rowCount)}</strong></div><div><span>Backup</span><strong>${backupLabel}</strong></div></div><div class="sales-order-table-wrap"><table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div><div class="sales-monthly-snapshot-actions">${exportLink}${sharePointLink}${loadRowsButton}</div>`;
}

async function loadSalesforceWorkbookSnapshotRows(snapshotId, targetId, offset = 0) {
  const container = document.getElementById(targetId);
  if (!container || !snapshotId || !attendanceJobSummarySession || window.location.hash !== "#attendance-jobs") return;
  const request = attendanceJobSummaryRequest;
  const session = attendanceJobSummarySession;
  container.querySelectorAll("button").forEach(button => { button.disabled = true; });
  container.querySelector(".sales-monthly-snapshot-actions")?.insertAdjacentHTML("afterbegin", `<span class="history-empty">Loading worksheet rows...</span>`);
  try {
    const data = await callFunction("getSalesforceAttendanceWorkbookSnapshotRows", { snapshotId, offset, limit: 200 });
    if (request !== attendanceJobSummaryRequest || session !== attendanceJobSummarySession) return;
    const worksheet = data.worksheet || {};
    const rows = worksheet.rows || [];
    const columnCount = Number(worksheet.columnCount || 0);
    const headers = Array.from({ length: columnCount }, (_, index) => excelColumnLabel(index + 1));
    const headerHtml = `<th>Row</th>${headers.map((label) => `<th>${label}</th>`).join("")}`;
    const bodyHtml = rows.map((row) => {
      const cells = Array.isArray(row?.cells) ? row.cells : [];
      return `<tr><th>${escapeHtml(row?.rowNumber || "")}</th>${headers.map((_, index) => `<td>${escapeHtml(cells[index] ?? "")}</td>`).join("")}</tr>`;
    }).join("");
    const exportLink = /^https:\/\//i.test(String(data.downloadUrl || ""))
      ? `<a class="secondary-button" href="${escapeHtml(data.downloadUrl)}" target="_blank" rel="noopener noreferrer">Export saved workbook</a>`
      : "";
    const previousButton = data.previousOffset !== null && data.previousOffset !== undefined
      ? `<button class="secondary-button" type="button" data-salesforce-snapshot-load="${escapeHtml(snapshotId)}" data-salesforce-snapshot-target="${escapeHtml(targetId)}" data-salesforce-snapshot-offset="${Number(data.previousOffset)}">Previous rows</button>`
      : "";
    const nextButton = data.nextOffset !== null && data.nextOffset !== undefined
      ? `<button class="secondary-button" type="button" data-salesforce-snapshot-load="${escapeHtml(snapshotId)}" data-salesforce-snapshot-target="${escapeHtml(targetId)}" data-salesforce-snapshot-offset="${Number(data.nextOffset)}">Next rows</button>`
      : "";
    const firstRow = rows[0]?.rowNumber || offset + 1;
    const lastRow = rows[rows.length - 1]?.rowNumber || firstRow;
    container.innerHTML = `<div class="sales-monthly-snapshot-grid"><div><span>Workbook</span><strong>${escapeHtml(data.fileName || data.workbook?.name || "Attendance Blueprint.xlsx")}</strong></div><div><span>Worksheet</span><strong>${escapeHtml(worksheet.name || "-")}</strong></div><div><span>Rows shown</span><strong>${attendanceDashboardNumber(firstRow)}-${attendanceDashboardNumber(lastRow)}</strong></div><div><span>Total rows</span><strong>${attendanceDashboardNumber(worksheet.rowCount)}</strong></div></div><div class="sales-order-table-wrap"><table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div><div class="sales-monthly-snapshot-actions">${previousButton}${nextButton}${exportLink}</div>`;
  } catch (error) {
    if (request !== attendanceJobSummaryRequest || session !== attendanceJobSummarySession) return;
    container.querySelector(".sales-monthly-snapshot-actions .history-empty")?.remove();
    const message = document.createElement("p");
    message.className = "history-empty";
    message.textContent = `Could not load workbook rows: ${friendlyError(error)}`;
    container.append(message);
  } finally {
    if (request === attendanceJobSummaryRequest && session === attendanceJobSummarySession) container.querySelectorAll("button").forEach(button => { button.disabled = false; });
  }
}

function excelColumnLabel(number) {
  let value = Number(number || 0);
  let label = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label || "-";
}

function renderSalesforceAttendanceLegacy(data) {
  state.salesforceAttendanceDashboardData = data || null;
  const daily = data?.daily || {};
  const dailyMetrics = daily.metrics || {};
  const monthly = data?.monthly || {};
  const monthlyMetrics = monthly.metrics || {};
  document.querySelector("#salesforceDailyRuns").textContent = data ? attendanceDashboardNumber(dailyMetrics.runs) : "-";
  document.querySelector("#salesforceDailyVisits").textContent = data ? attendanceDashboardNumber(dailyMetrics.validVisits) : "-";
  document.querySelector("#salesforceDailyActuals").textContent = data ? attendanceDashboardNumber(dailyMetrics.actualStores) : "-";
  document.querySelector("#salesforceDailyCoverage").textContent = data ? attendanceDashboardPercent(dailyMetrics.coverageRate) : "-";
  renderSalesforceAttendanceBars("salesforceDailyActivity", daily.activity || [], "No Daily Attendance updates yet.");
  renderSalesforceAttendanceBars("salesforceDailyQuality", daily.quality || [], "No Daily Attendance updates yet.");
  const dailyHistory = daily.history || [];
  document.querySelector("#salesforceDailyRowsCount").textContent = `${attendanceDashboardNumber(dailyHistory.length)} updates`;
  document.querySelector("#salesforceDailyRows").innerHTML = dailyHistory.length
    ? dailyHistory.map((row) => {
      const coverage = Number(row.plannedRows || 0) ? (Number(row.actualStores || 0) / Number(row.plannedRows || 0)) * 100 : 0;
      return `<tr><td>${escapeHtml(row.attendanceDate || "-")}</td><td>${attendanceDashboardNumber(row.validVisits)}</td><td>${attendanceDashboardNumber(row.actualStores)}</td><td>${attendanceDashboardNumber(row.plannedRows)}</td><td>${attendanceDashboardPercent(coverage)}</td><td>${attendanceDashboardNumber(row.matchedStoreCodes)}</td><td title="${escapeHtml(row.sourceFileName || "-")}">${escapeHtml(row.sourceFileName || "-")}</td><td>${escapeHtml(row.completedAt ? formatDate(row.completedAt) : "-")}</td></tr>`;
    }).join("")
    : `<tr><td colspan="8">No Daily Attendance updates yet.</td></tr>`;
  document.querySelector("#salesforceMonthlyActuals").textContent = data ? attendanceDashboardNumber(monthlyMetrics.actualVisits) : "-";
  document.querySelector("#salesforceMonthlyWeeks").textContent = data ? attendanceDashboardNumber(monthlyMetrics.actualWeeks) : "-";
  document.querySelector("#salesforceMonthlyEligible").textContent = data ? attendanceDashboardNumber(monthlyMetrics.eligibleVisits) : "-";
  document.querySelector("#salesforceMonthlySourceRows").textContent = data ? attendanceDashboardNumber(monthlyMetrics.sourceRows) : "-";
  renderSalesforceAttendanceBars("salesforceMonthlyActualsChart", (monthly.weeklyActuals || []).map((row) => ({
    label: `Actual Week ${row.week}`, value: row.actual,
    detail: `${attendanceDashboardNumber(row.actual)} actual visits (${attendanceDashboardRange(row.rangeStart, row.rangeEnd)})`
  })), "No Monthly Attendance Actual Week totals yet.");
  const latestMonthly = monthly.latest || null;
  renderSalesforceAttendanceBars("salesforceMonthlyQuality", latestMonthly ? [
    { label: "Export rows", value: Number(monthlyMetrics.sourceRows || 0), detail: `${attendanceDashboardNumber(monthlyMetrics.sourceRows)} rows in the latest monthly export` },
    { label: "Eligible visits", value: Number(monthlyMetrics.eligibleVisits || 0), detail: `${attendanceDashboardNumber(monthlyMetrics.eligibleVisits)} unique compliant visits` },
    { label: "Compliant rows", value: Number(monthlyMetrics.compliantRows || 0), detail: `${attendanceDashboardNumber(monthlyMetrics.compliantRows)} rows passed either-location validation` },
    { label: "Plan rows", value: Number(monthlyMetrics.plannedRows || 0), detail: `${attendanceDashboardNumber(monthlyMetrics.plannedRows)} South Africa Visit Plan rows in scope` }
  ] : [], "No Monthly Attendance reconciliation yet.");
  const verifiedSnapshot = monthly.verifiedSnapshot || null;
  const snapshotStatus = document.querySelector("#salesforceMonthlySnapshotStatus");
  const snapshotContainer = document.querySelector("#salesforceMonthlySnapshot");
  if (snapshotStatus && snapshotContainer && monthly.workbookSnapshot) {
    renderSalesforceWorkbookSnapshot("#salesforceMonthlySnapshotStatus", "#salesforceMonthlySnapshot", monthly.workbookSnapshot, "The next successful Monthly Attendance update will save an exportable workbook copy here.");
  } else if (snapshotStatus && snapshotContainer && verifiedSnapshot) {
    const snapshotActuals = Object.entries(verifiedSnapshot.actualWeekTotals || {})
      .sort(([left], [right]) => Number(left) - Number(right))
      .map(([week, total]) => `<tr><td>Actual Week ${escapeHtml(week)}</td><td>${attendanceDashboardNumber(total)}</td></tr>`).join("");
    const workbook = verifiedSnapshot.workbook || {};
    const workbookLink = /^https:\/\//i.test(String(workbook.url || ""))
      ? `<a class="secondary-button" href="${escapeHtml(workbook.url)}" target="_blank" rel="noopener noreferrer">Open verified workbook</a>`
      : "";
    const verifiedAt = verifiedSnapshot.validation?.verifiedAt ? new Date(verifiedSnapshot.validation.verifiedAt) : null;
    const verificationLabel = verifiedSnapshot.validation?.sharePointRoundTripValidated ? "Verified" : "Recorded bot result";
    snapshotStatus.textContent = `${workbook.sharePointVersion ? `SharePoint version ${workbook.sharePointVersion}` : verificationLabel}${verifiedAt && !Number.isNaN(verifiedAt.valueOf()) ? ` | ${verifiedAt.toLocaleString("en-ZA")}` : ""}`;
    snapshotContainer.innerHTML = `<div class="sales-monthly-snapshot-grid"><div><span>Reconciled range</span><strong>${escapeHtml(attendanceDashboardRange(verifiedSnapshot.rangeStart, verifiedSnapshot.rangeEnd))}</strong></div><div><span>Eligible visits</span><strong>${attendanceDashboardNumber(verifiedSnapshot.eligibleVisits)}</strong></div><div><span>Workbook total</span><strong>${attendanceDashboardNumber(verifiedSnapshot.totalActualVisits)}</strong></div><div><span>Protected backup</span><strong>${verifiedSnapshot.workbook?.preWriteBackupId ? "Saved" : "Not available"}</strong></div></div><div class="sales-order-table-wrap"><table><thead><tr><th>Workbook value</th><th>Verified total</th></tr></thead><tbody>${snapshotActuals || '<tr><td colspan="2">No Actual Week totals were written.</td></tr>'}</tbody></table></div><div class="sales-monthly-snapshot-actions">${workbookLink}</div>`;
  } else if (snapshotStatus && snapshotContainer) {
    snapshotStatus.textContent = "No verified monthly workbook yet.";
    snapshotContainer.innerHTML = `<p class="history-empty">The next successful Monthly Attendance update will save its verified totals here.</p>`;
  }
  const monthlyHistory = monthly.history || [];
  document.querySelector("#salesforceMonthlyRowsCount").textContent = `${attendanceDashboardNumber(monthlyHistory.length)} runs`;
  document.querySelector("#salesforceMonthlyRows").innerHTML = monthlyHistory.length
    ? monthlyHistory.map((row) => {
      const actuals = Object.entries(row.actualWeeks || {}).sort(([left], [right]) => Number(left) - Number(right)).map(([week, total]) => `W${week}: ${attendanceDashboardNumber(total)}`).join(" | ") || "-";
      return `<tr><td>${escapeHtml(attendanceDashboardRange(row.rangeStart, row.rangeEnd))}</td><td>${escapeHtml(actuals)}</td><td>${attendanceDashboardNumber(row.eligibleVisits)}</td><td>${attendanceDashboardNumber(row.sourceRows)}</td><td>${row.reconcileAllWeeks ? "All Actual Weeks" : escapeHtml(row.actualWeek ? `Actual Week ${row.actualWeek}` : "By source date")}</td><td title="${escapeHtml(row.sourceFileName || "-")}">${escapeHtml(row.sourceFileName || "-")}</td><td>${escapeHtml(row.completedAt ? formatDate(row.completedAt) : "-")}</td></tr>`;
    }).join("")
    : `<tr><td colspan="7">No Monthly Attendance updates yet.</td></tr>`;
}

function callCycleDefaultFilters() {
  return { division: "", region: "", channel: "", banner: "", repType: "", frequency: "", manager: "", status: "", query: "", trax: false, gold: false, posh: false };
}

function dedicatedCallCycleFilters() {
  if (!state.callCycleFilters) state.callCycleFilters = { dedicated: callCycleDefaultFilters(), syndicated: callCycleDefaultFilters() };
  return state.callCycleFilters[state.callCycleSource] || state.callCycleFilters.dedicated;
}

function syndicatedCallCycleRecords(data) {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return (data?.stores || []).map((row) => {
    const dates = Array.isArray(row.dates) ? row.dates : [];
    const weekdayVisits = Object.fromEntries(days.map((day) => [day, 0]));
    dates.forEach((value) => {
      const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
      if (!Number.isNaN(date.getTime())) weekdayVisits[days[date.getDay()]] = 1;
    });
    const scheduledWeeks = new Set((Array.isArray(row.weeks) ? row.weeks : []).map((value) => String(value))).size;
    const frequency = scheduledWeeks >= 4 ? "SYNDICATED WEEKLY" : scheduledWeeks >= 2 ? "SYNDICATED BI WEEKLY" : "SYNDICATED MONTHLY";
    return {
      storeCode: Array.isArray(row.storeCodes) ? row.storeCodes[0] || "" : "",
      store: row.storeName || row.customer || "Unassigned store",
      employeeId: Array.isArray(row.resources) ? row.resources[0] || "" : "",
      rep: Array.isArray(row.resources) ? row.resources[0] || "" : "",
      division: Array.isArray(row.divisions) ? row.divisions[0] || "Unassigned" : "Unassigned",
      region: row.region || "Unassigned",
      channel: Array.isArray(row.channels) ? row.channels[0] || "Not set" : "Not set",
      banner: Array.isArray(row.banners) ? row.banners[0] || "Not set" : "Not set",
      repType: Array.isArray(row.roles) ? row.roles[0] || "Syndicated rep" : "Syndicated rep",
      manager: Array.isArray(row.managers) ? row.managers[0] || "Not set" : "Not set",
      status: "Active",
      frequency,
      plannedDays: Object.values(weekdayVisits).reduce((total, value) => total + value, 0),
      scheduledWeeks,
      callsPerMonth: Number(row.scheduled || dates.length || 0),
      weekdayVisits,
      smartSellWeeks: Object.fromEntries([1, 2, 3, 4].map((week) => [week, scheduledWeeks >= week ? 1 : 0])),
      trax: false,
      gold: false,
      posh: false
    };
  });
}

function callCycleSourceData(salesforceData) {
  if (state.callCycleSource === "syndicated") {
    const source = state.callCycleSyndicatedData || {};
    return {
      label: "Syndicated Call Cycle",
      records: syndicatedCallCycleRecords(source),
      source: { fileName: source?.source?.schedules?.fileName || source?.source?.strikeRate?.fileName || "Geo Rep Capture Schedules", worksheet: "Schedules", rowCount: source?.stores?.length || 0 },
      error: source?.stores?.length ? "" : "Run Geo Rep Capture Attendance and build Store Coverage to load the Syndicated Call Cycle."
    };
  }
  return {
    label: "Dedicated Call Cycle",
    records: Array.isArray(salesforceData?.dedicatedCallCycle?.records) ? salesforceData.dedicatedCallCycle.records : [],
    source: salesforceData?.dedicatedCallCycle?.source || {},
    error: salesforceData?.dedicatedCallCycle?.error || "No active Smart Sell Master is available. Upload the current master to load the Dedicated Call Cycle."
  };
}

function callCyclePageContent(page, records, groups, metrics) {
  const { division, region } = groups;
  const { count, reps } = metrics;
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const dayChip = (row) => `<span class="callcycle-chip-row">${dayNames.map((day) => `<i class="${Number(row.weekdayVisits?.[day] || 0) ? "active" : ""}">${day.slice(0, 1)}</i>`).join("")}</span>`;
  const weekChip = (row) => `<span class="callcycle-chip-row">${[1, 2, 3, 4].map((week) => `<i class="${Number(row.smartSellWeeks?.[week] || 0) ? "active" : ""}">${week}</i>`).join("")}</span>`;
  const repRows = [...new Map(records.filter((row) => row.rep || row.employeeId).map((row) => {
    const key = row.rep || row.employeeId;
    const portfolio = records.filter((item) => (item.rep || item.employeeId) === key);
    const weekday = dayNames.map((day) => ({ day, value: portfolio.reduce((total, item) => total + Number(item.weekdayVisits?.[day] || 0), 0) })).sort((left, right) => right.value - left.value)[0];
    return [key, { label: key, manager: row.manager, repType: row.repType, region: row.region, stores: portfolio.length, calls: portfolio.reduce((total, item) => total + Number(item.callsPerMonth || 0), 0), busiest: weekday?.value ? weekday.day.slice(0, 3) : "-", portfolio }];
  })).values()].sort((left, right) => right.calls - left.calls || left.label.localeCompare(right.label));
  if (page === "divisions") {
    const scorecard = region.map((item) => {
      const rows = records.filter((row) => row.region === item.label);
      const resourceCount = new Set(rows.map((row) => row.rep || row.employeeId).filter(Boolean)).size;
      const managerCount = new Set(rows.map((row) => row.manager).filter((value) => value && value !== "Not set")).size;
      const calls = rows.reduce((total, row) => total + Number(row.callsPerMonth || 0), 0);
      const unscheduled = rows.filter((row) => !Number(row.scheduledWeeks || 0)).length;
      return { ...item, rows, resourceCount, managerCount, calls, unscheduled, division: rows[0]?.division || "Not set" };
    });
    return `<section class="callcycle-page-heading"><div><p>Call cycle coverage</p><h2>Divisional coverage</h2></div><span>Stores, resources and call load by division</span></section><section class="callcycle-division-grid">${division.map((item) => {
      const rows = records.filter((row) => row.division === item.label);
      const calls = rows.reduce((total, row) => total + Number(row.callsPerMonth || 0), 0);
      const resourceCount = new Set(rows.map((row) => row.rep || row.employeeId).filter(Boolean)).size;
      const managerCount = new Set(rows.map((row) => row.manager).filter((value) => value && value !== "Not set")).size;
      const regions = dedicatedCallCycleUnique(rows, "region");
      return `<article><header><div><h2>${escapeHtml(item.label)}</h2><span>${attendanceDashboardNumber(item.value)} stores</span></div><b>${count ? Math.round(item.value / count * 100) : 0}% share</b></header><strong>${count ? Math.round(item.value / count * 100) : 0}%</strong><small>of stores in view</small><i><em style="width:${count ? Math.round(item.value / count * 100) : 0}%"></em></i><p>${rows.length ? (calls / rows.length).toFixed(1) : "0.0"} planned calls per store</p><div class="callcycle-division-stats"><span><b>${attendanceDashboardNumber(item.value)}</b>Stores</span><span><b>${attendanceDashboardNumber(resourceCount)}</b>Reps</span><span><b>${attendanceDashboardNumber(managerCount)}</b>Managers</span><span><b>${attendanceDashboardNumber(calls)}</b>Calls / mo</span></div><h3>Regions</h3>${regions.slice(0, 5).map((entry) => `<div class="callcycle-mini-bar"><span>${escapeHtml(entry.label)}</span><i><b style="width:${item.value ? Math.round(entry.value / item.value * 100) : 0}%"></b></i><em>${attendanceDashboardNumber(entry.value)}</em></div>`).join("")}</article>`;
    }).join("") || `<p class="history-empty">No division data is available for this view.</p>`}</section><section class="callcycle-table-card callcycle-scorecard"><header><div><p>Coverage</p><h2>Region scorecard</h2><span>Stores, resources and call load by region</span></div></header><table><thead><tr><th>Region</th><th>Division</th><th>Stores</th><th>Reps</th><th>Managers</th><th>Stores / rep</th><th>Calls / mo</th><th>Calls / store</th><th>Unscheduled</th><th>Share of calls</th></tr></thead><tbody>${scorecard.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.division)}</td><td>${attendanceDashboardNumber(row.value)}</td><td>${attendanceDashboardNumber(row.resourceCount)}</td><td>${attendanceDashboardNumber(row.managerCount)}</td><td>${row.resourceCount ? (row.value / row.resourceCount).toFixed(1) : "0.0"}</td><td>${attendanceDashboardNumber(row.calls)}</td><td>${row.value ? (row.calls / row.value).toFixed(1) : "0.0"}</td><td class="${row.unscheduled ? "warning" : ""}">${attendanceDashboardNumber(row.unscheduled)}</td><td><i><b style="width:${metrics.plannedCalls ? Math.round(row.calls / metrics.plannedCalls * 100) : 0}%"></b></i></td></tr>`).join("") || `<tr><td colspan="10">No regions match the current filters.</td></tr>`}</tbody></table></section>`;
  }
  if (page === "reps") {
    const selected = repRows.find((row) => row.label === state.callCycleSelectedRep);
    if (selected) {
      const bannerRows = dedicatedCallCycleUnique(selected.portfolio, "banner");
      const dayRows = dayNames.map((day) => ({ label: day.slice(0, 3), value: selected.portfolio.reduce((total, row) => total + Number(row.weekdayVisits?.[day] || 0), 0) }));
      return `<section class="callcycle-rep-detail"><button data-callcycle-rep-back type="button">Back to reps</button><header><p>Representative</p><h2>${escapeHtml(selected.label)}</h2><span>${escapeHtml([selected.repType, selected.manager, selected.region].filter(Boolean).join(" · "))}</span></header><section class="callcycle-rep-kpis"><article><span>Stores</span><strong>${attendanceDashboardNumber(selected.stores)}</strong></article><article><span>Calls / month</span><strong>${attendanceDashboardNumber(selected.calls)}</strong></article><article><span>Stores / rep</span><strong>${selected.stores.toFixed(1)}</strong></article><article><span>Busiest day</span><strong>${escapeHtml(selected.busiest)}</strong></article></section><div class="callcycle-rep-split"><section><header><h3>Weekly rhythm</h3><span>Calls landing on each day</span></header>${dedicatedCallCycleBarRows(dayRows)}</section><section><header><h3>Portfolio</h3><span>Banners covered</span></header>${dedicatedCallCycleBarRows(bannerRows)}</section></div><section class="callcycle-table-card callcycle-rep-cycle"><header><div><p>Visit plan</p><h2>Call cycle</h2><span>Every store on this representative's plan</span></div></header><table><thead><tr><th>Store</th><th>Frequency</th><th>Days</th><th>Weeks</th><th>Calls / mo</th></tr></thead><tbody>${selected.portfolio.map((row) => `<tr><td><b>${escapeHtml(row.store || "-")}</b><small>${escapeHtml([row.banner, row.region].filter(Boolean).join(" · "))}</small></td><td>${escapeHtml(row.frequency || "-")}</td><td>${dayChip(row)}</td><td>${weekChip(row)}</td><td>${attendanceDashboardNumber(row.callsPerMonth)}</td></tr>`).join("")}</tbody></table></section></section>`;
    }
    return `<section class="callcycle-page-heading"><div><p>Field resources</p><h2>Reps by call load</h2></div><span>${attendanceDashboardNumber(reps.size)} reps in view · select a rep for their cycle</span></section><section class="callcycle-table-card callcycle-reps-table"><table><thead><tr><th>Rep</th><th>Stores</th><th>Calls / mo</th><th>Busiest day</th></tr></thead><tbody>${repRows.map((row) => `<tr data-callcycle-rep="${escapeHtml(row.label)}" tabindex="0"><td><b>${escapeHtml(row.label)}</b><small>${escapeHtml([row.repType, row.manager, row.region].filter(Boolean).join(" · "))}</small></td><td>${attendanceDashboardNumber(row.stores)}</td><td class="callcycle-orange">${attendanceDashboardNumber(row.calls)}</td><td>${escapeHtml(row.busiest)}</td></tr>`).join("") || `<tr><td colspan="4">No representatives match the current filters.</td></tr>`}</tbody></table></section>`;
  }
  if (page === "stores") {
    const sortMode = state.callCycleStoreSort || "name";
    const sorted = [...records].sort((left, right) => sortMode === "calls" ? Number(right.callsPerMonth || 0) - Number(left.callsPerMonth || 0) : sortMode === "frequency" ? String(left.frequency || "").localeCompare(String(right.frequency || "")) : String(left.store || "").localeCompare(String(right.store || "")));
    const pageSize = 50;
    const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
    const activePage = Math.min(Math.max(1, Number(state.callCycleStorePage || 1)), pageCount);
    const pageRows = sorted.slice((activePage - 1) * pageSize, activePage * pageSize);
    return `<section class="callcycle-page-heading"><div><p>Visit plan</p><h2>Store visit plans</h2></div><span>${attendanceDashboardNumber(count)} verified stores in the selected view</span></section><section class="callcycle-table-card callcycle-stores-table"><header><div><h2>Store visit plans</h2><span>Sort the selected cycle plan</span></div><div class="callcycle-sort-tabs">${[["name", "Store"], ["calls", "Call load"], ["frequency", "Frequency"]].map(([key, label]) => `<button class="${sortMode === key ? "active" : ""}" data-callcycle-store-sort="${key}" type="button">${label}</button>`).join("")}</div></header><div class="callcycle-table-scroll"><table><thead><tr><th>Store</th><th>Rep</th><th>Days</th><th>Weeks</th><th>Calls / mo</th></tr></thead><tbody>${pageRows.map((row) => `<tr><td><b>${escapeHtml(row.store || "-")}</b><small>${escapeHtml([row.banner, row.channel, row.region].filter(Boolean).join(" · "))}</small></td><td>${escapeHtml(row.rep || row.employeeId || "-")}</td><td>${dayChip(row)}</td><td>${weekChip(row)}</td><td>${attendanceDashboardNumber(row.callsPerMonth)}</td></tr>`).join("") || `<tr><td colspan="5">No stores match the current filters.</td></tr>`}</tbody></table></div><footer><button data-callcycle-store-page="${Math.max(1, activePage - 1)}" type="button" ${activePage === 1 ? "disabled" : ""}>Previous</button><button data-callcycle-store-page="${Math.min(pageCount, activePage + 1)}" type="button" ${activePage === pageCount ? "disabled" : ""}>Next</button><span>Page ${activePage} of ${pageCount} · ${attendanceDashboardNumber(sorted.length)} stores</span></footer></section>`;
  }
  return "";
}

function dedicatedCallCycleUnique(rows, key) {
  const grouped = new Map();
  rows.forEach((row) => {
    const value = String(row[key] || "Not set");
    grouped.set(value, (grouped.get(value) || 0) + 1);
  });
  return [...grouped.entries()].map(([label, value]) => ({ label, value })).sort((left, right) => right.value - left.value || left.label.localeCompare(right.label));
}

function dedicatedCallCycleBarRows(rows) {
  if (!rows.length) return `<p class="history-empty">No matching data.</p>`;
  const visibleRows = rows.slice(0, 10);
  const max = Math.max(...visibleRows.map((row) => Number(row.value || 0)), 1);
  return visibleRows.map((row) => `<div class="dedicated-callcycle-bar"><div><span>${escapeHtml(row.label)}</span><b>${attendanceDashboardNumber(row.value)}</b></div><i><b style="width:${Math.max(3, Math.round((Number(row.value || 0) / max) * 100))}%"></b></i></div>`).join("");
}

function dedicatedCallCycleDonut(rows, total) {
  const colors = ["#ec6d25", "#ee7f3c", "#6fb2ff", "#3d5f85", "#9dc4ec"];
  let from = 0;
  const pieces = rows.slice(0, 5).map((row, index) => {
    const to = from + ((Number(row.value || 0) / Math.max(total, 1)) * 100);
    const piece = `${colors[index]} ${from.toFixed(2)}% ${to.toFixed(2)}%`;
    from = to;
    return piece;
  });
  return pieces.length ? `conic-gradient(${pieces.join(",")})` : "#1c3f6b";
}

function renderCallCycleDashboard(data) {
  state.salesforceAttendanceDashboardData = data || null;
  const container = document.querySelector("#salesforceDedicatedCallCycle");
  if (!container) return;
  const sourceData = callCycleSourceData(data);
  const source = sourceData.source || {};
  const records = (sourceData.records || []).map(row => ({ ...row, division: attendancePgDivision(row.region) === "UNASSIGNED" ? row.division : attendancePgDivision(row.region) }));
  if (!records.length) {
    const message = sourceData.error || `No ${sourceData.label || "Call Cycle"} data is available.`;
    container.innerHTML = `<p class="history-empty">${escapeHtml(message)}</p>`;
    return;
  }
  const filters = dedicatedCallCycleFilters();
  const filterKeys = ["division", "region", "channel", "banner", "repType", "frequency", "manager", "status"];
  const rows = records.filter((row) => filterKeys.every((key) => !filters[key] || String(row[key] || "") === filters[key])
    && (!filters.query || [row.store, row.storeCode, row.rep, row.employeeId].some((value) => String(value || "").toLowerCase().includes(filters.query.toLowerCase())))
    && (!filters.trax || row.trax) && (!filters.gold || row.gold) && (!filters.posh || row.posh));
  state.callCycleExportRows = rows;
  const stores = rows;
  const count = stores.length;
  const group = (key) => dedicatedCallCycleUnique(rows, key);
  const division = group("division");
  const repType = group("repType");
  const region = group("region");
  const banner = group("banner");
  const channel = group("channel");
  const frequency = group("frequency");
  const managers = new Set(rows.map((row) => row.manager).filter((value) => value && value !== "Not set"));
  const reps = new Set(rows.map((row) => row.rep || row.employeeId).filter(Boolean));
  const plannedCalls = stores.reduce((total, row) => total + Number(row.callsPerMonth || 0), 0);
  const top = (items) => items[0] || { label: "Not set", value: 0 };
  const select = (field, label) => `<label><span>${label}</span><select data-dedicated-filter="${field}"><option value="">All</option>${[...new Set(records.map((row) => String(row[field] || "Not set")))].sort().map((value) => `<option value="${escapeHtml(value)}"${filters[field] === value ? " selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label>`;
  const toggle = (field, label) => `<button class="${filters[field] ? "active" : ""}" data-dedicated-toggle="${field}" type="button" aria-pressed="${filters[field] ? "true" : "false"}">${label}</button>`;
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => key !== "query" && Boolean(value)).length + (filters.query ? 1 : 0);
  const mix = [
    { label: "Weekly cycle", value: stores.filter((row) => /WEEKLY/i.test(row.frequency || "") && !/BI\s*WEEKLY/i.test(row.frequency || "")).length },
    { label: "Bi-weekly cycle", value: stores.filter((row) => /BI\s*WEEKLY/i.test(row.frequency || "")).length },
    { label: "Monthly cycle", value: stores.filter((row) => /MONTHLY/i.test(row.frequency || "")).length }
  ];
  const dayRows = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => ({ label: day.slice(0, 3), value: stores.reduce((total, row) => total + Number(row.weekdayVisits?.[day] || 0), 0) }));
  if (state.attendanceProduct === "callcycle" && elements.attendanceHeaderStoreCount) elements.attendanceHeaderStoreCount.textContent = attendanceDashboardNumber(count);
  if (elements.attendanceDashboardPeriod) elements.attendanceDashboardPeriod.textContent = source.fileName || sourceData.label;
  syncAttendanceWorkspaceHeader();
  const filterBar = `<section class="dedicated-callcycle-filters">${select("division", "Division")}${select("region", "Region")}${select("channel", "Channel")}${select("banner", "Banner")}${select("repType", "Rep type")}${select("frequency", "Calling frequency")}${select("manager", "Line manager")}${select("status", "Status")}<label class="dedicated-callcycle-search"><span>Search store or rep</span><input data-dedicated-query type="search" value="${escapeHtml(filters.query)}" placeholder="Store name, code, rep" /></label><div class="dedicated-callcycle-filter-actions">${toggle("trax", "TRAX only")}${toggle("gold", "Gold Mine only")}${toggle("posh", "Posh only")}<span>${attendanceDashboardNumber(count)} stores${activeFilterCount ? ` - ${activeFilterCount} active` : " - no filters"}</span><button data-dedicated-reset type="button">Reset</button></div></section>`;
  if (state.callCyclePage !== "overview") {
    container.innerHTML = `${filterBar}${callCyclePageContent(state.callCyclePage, stores, { division, repType, region, banner, channel, frequency }, { count, plannedCalls, reps, managers, sourceLabel: sourceData.label })}<p class="dedicated-callcycle-source">Verified source: ${escapeHtml(source.fileName || sourceData.label)} - ${escapeHtml(source.worksheet || "Schedule data")} - ${attendanceDashboardNumber(source.rowCount || records.length)} plan rows</p>`;
    container.insertAdjacentHTML("afterbegin", '<div class="callcycle-export-toolbar"><button type="button" data-callcycle-export><i class="ph ph-download-simple" aria-hidden="true"></i> Excel</button></div>');
    return;
  }
  container.innerHTML = `<section class="dedicated-callcycle-filters">${select("division", "Division")}${select("region", "Region")}${select("channel", "Channel")}${select("banner", "Banner")}${select("repType", "Rep type")}${select("frequency", "Calling frequency")}${select("manager", "Line manager")}${select("status", "Status")}<label class="dedicated-callcycle-search"><span>Search store or rep</span><input data-dedicated-query type="search" value="${escapeHtml(filters.query)}" placeholder="Store name, code, rep" /></label><div class="dedicated-callcycle-filter-actions">${toggle("trax", "TRAX only")}${toggle("gold", "Gold Mine only")}${toggle("posh", "Posh only")}<span>${attendanceDashboardNumber(count)} stores${activeFilterCount ? ` Â· ${activeFilterCount} active` : " Â· no filters"}</span><button data-dedicated-reset type="button">Reset</button></div></section>
    <section class="dedicated-callcycle-overview"><article class="dedicated-callcycle-hero"><p>Network covered</p><strong>${attendanceDashboardNumber(count)}</strong><span>stores on the selected call cycle</span><i>${mix.map((row, index) => `<b style="width:${count ? ((row.value / count) * 100).toFixed(2) : 0}%;--mix-color:${["#ec6d25", "#6fb2ff", "#3d5f85"][index]}"></b>`).join("")}</i><div>${mix.map((row, index) => `<small><b style="background:${["#ec6d25", "#6fb2ff", "#3d5f85"][index]}"></b><span>${escapeHtml(row.label)}</span><strong>${attendanceDashboardNumber(row.value)}</strong><em>${count ? Math.round((row.value / count) * 100) : 0}%</em></small>`).join("")}</div></article><div class="dedicated-callcycle-side"><section class="dedicated-callcycle-kpis"><article><span>Calls / month</span><strong>${attendanceDashboardNumber(plannedCalls)}</strong><small>${count ? (plannedCalls / count).toFixed(2) : "0.00"} per store</small></article><article><span>Reps</span><strong>${attendanceDashboardNumber(reps.size)}</strong><small>${reps.size ? (count / reps.size).toFixed(1) : "0.0"} stores each</small></article><article><span>Line managers</span><strong>${attendanceDashboardNumber(managers.size)}</strong><small>${managers.size ? (reps.size / managers.size).toFixed(1) : "0.0"} reps each</small></article><article><span>Banners</span><strong>${attendanceDashboardNumber(banner.length)}</strong><small>${channel.length} channels</small></article><article><span>Regions</span><strong>${attendanceDashboardNumber(region.length)}</strong><small>Verified hierarchy</small></article></section><article class="dedicated-callcycle-insights"><p>What the data says</p><ul><li><b>${escapeHtml(top(region).label)}</b> carries ${count ? Math.round((top(region).value / count) * 100) : 0}% of the stores in view.</li><li><b>${escapeHtml(top(banner).label)}</b> is the largest banner with ${attendanceDashboardNumber(top(banner).value)} stores.</li><li><b>${attendanceDashboardNumber(mix.reduce((total, row) => total + row.value, 0))}</b> stores have a defined calling pattern.</li><li><b>${attendanceDashboardNumber(reps.size)}</b> resources are mapped in ${escapeHtml(sourceData.label)}.</li></ul></article></div></section>
    <section class="dedicated-callcycle-frequency"><header><h2>Calling frequency</h2><span>stores per cycle pattern, share of the network</span></header><div>${frequency.slice(0, 7).map((row) => `<article><span>${escapeHtml(row.label)}</span><div><strong>${attendanceDashboardNumber(row.value)}</strong><small>${count ? Math.round((row.value / count) * 100) : 0}%</small></div><i><b style="width:${frequency[0]?.value ? Math.max(3, Math.round((row.value / frequency[0].value) * 100)) : 0}%"></b></i></article>`).join("")}</div></section>
    <section class="dedicated-callcycle-analytics"><article><h2>Stores by division</h2><div class="dedicated-callcycle-donut" style="--donut:${dedicatedCallCycleDonut(division, count)}"><strong>${attendanceDashboardNumber(count)}</strong><span>stores</span></div><div class="dedicated-callcycle-legend">${division.slice(0, 5).map((row, index) => `<p><i style="background:${["#ec6d25", "#ee7f3c", "#6fb2ff", "#3d5f85", "#9dc4ec"][index]}"></i><span>${escapeHtml(row.label)}</span><b>${attendanceDashboardNumber(row.value)}</b><em>${count ? Math.round((row.value / count) * 100) : 0}%</em></p>`).join("")}</div></article><article><h2>Stores by rep type</h2><div class="dedicated-callcycle-donut" style="--donut:${dedicatedCallCycleDonut(repType, count)}"><strong>${attendanceDashboardNumber(reps.size)}</strong><span>reps</span></div><div class="dedicated-callcycle-legend">${repType.slice(0, 5).map((row, index) => `<p><i style="background:${["#ec6d25", "#ee7f3c", "#6fb2ff", "#3d5f85", "#9dc4ec"][index]}"></i><span>${escapeHtml(row.label)}</span><b>${attendanceDashboardNumber(row.value)}</b><em>${count ? Math.round((row.value / count) * 100) : 0}%</em></p>`).join("")}</div></article><article class="dedicated-callcycle-region"><h2>Stores covered by region</h2><span>Each bar shows the share of the verified plan</span><div>${region.map((row) => `<p><b>${escapeHtml(row.label)}</b><i><em style="width:${region[0]?.value ? Math.max(3, Math.round((row.value / region[0].value) * 100)) : 0}%"></em></i><strong>${attendanceDashboardNumber(row.value)}</strong><small>${attendanceDashboardNumber(stores.filter((store) => store.region === row.label).reduce((total, store) => total + Number(store.callsPerMonth || 0), 0))} calls</small></p>`).join("")}</div></article></section>
    <section class="dedicated-callcycle-lower"><article><h2>Stores covered by banner</h2>${dedicatedCallCycleBarRows(banner)}</article><article><h2>Stores covered by channel</h2>${dedicatedCallCycleBarRows(channel)}</article><article><h2>Calls by day of week</h2>${dedicatedCallCycleBarRows(dayRows)}</article><article><h2>Calling frequency mix</h2>${dedicatedCallCycleBarRows(frequency.slice(0, 7))}</article></section><p class="dedicated-callcycle-source">Verified source: ${escapeHtml(source.fileName || "Salesforce Monthly Attendance workbook")} Â· ${escapeHtml(source.worksheet || "South Africa Visit Plan")} Â· ${attendanceDashboardNumber(source.rowCount || records.length)} plan rows</p>`;
  ["ph-phone-call", "ph-users-three", "ph-user-focus", "ph-storefront", "ph-map-pin"].forEach((icon, index) => {
    const label = container.querySelectorAll(".dedicated-callcycle-kpis article > span")[index];
    if (label) label.insertAdjacentHTML("afterbegin", `<i class="ph ${icon}" aria-hidden="true"></i>`);
  });
  const kpiSubtitles = container.querySelectorAll(".dedicated-callcycle-kpis article > small");
  if (kpiSubtitles[4]) kpiSubtitles[4].textContent = "3 divisions";

  const weeklyStores = mix[0]?.value || 0;
  const scheduleGaps = stores.filter((row) => !Number(row.scheduledWeeks || 0)).length;
  const insightItems = [
    { icon: "ph-map-pin", text: `<b>${escapeHtml(top(region).label)}</b> carries the largest share of the network at <b>${count ? Math.round((top(region).value / count) * 100) : 0}%</b> of stores in view.` },
    { icon: "ph-storefront", text: `<b>${escapeHtml(top(banner).label)}</b> is the biggest banner with <b>${attendanceDashboardNumber(top(banner).value)} stores</b> on cycle.` },
    { icon: "ph-repeat", text: `Weekly cycles cover <b>${count ? Math.round((weeklyStores / count) * 100) : 0}%</b> of stores - the rest run bi-weekly or monthly.` },
    { icon: "ph-warning", text: scheduleGaps ? `Stores with no Smart Sell week set: <b>${attendanceDashboardNumber(scheduleGaps)}</b> - cycle load may be understated.` : `Every store in view has a week set - <b>no gaps</b>.` },
    { icon: "ph-users-three", text: `Average rep load is <b>${reps.size ? (count / reps.size).toFixed(1) : "0.0"} stores</b> per representative.` }
  ];
  const insightList = container.querySelector(".dedicated-callcycle-insights ul");
  if (insightList) insightList.innerHTML = insightItems.map((item) => `<li><i class="ph ${item.icon}" aria-hidden="true"></i><span>${item.text}</span></li>`).join("");

  const frequencyPalette = [
    ["DEDICATED WEEKLY", "#ec6d25"], ["DEDICATED BI WEEKLY", "#ee7f3c"], ["DEDICATED MONTHLY", "#ec6d25"],
    ["SYNDICATED BI WEEKLY", "#6fb2ff"], ["SYNDICATED MONTHLY", "#9dc4ec"], ["FIELDMARKETER WEEKLY", "#3d5f85"], ["FIELDMARKETER MONTHLY", "#c9d7e6"]
  ];
  const exportToolbar = document.createElement("div");
  exportToolbar.className = "callcycle-export-toolbar";
  exportToolbar.innerHTML = '<button type="button" data-callcycle-export><i class="ph ph-download-simple" aria-hidden="true"></i> Excel</button>';
  container.prepend(exportToolbar);
  const regionalMaximum = Math.max(...region.map((item) => Number(item.value || 0)), 1);
  const regionChart = container.querySelector(".dedicated-callcycle-region > div");
  if (regionChart) regionChart.innerHTML = region.map((item) => {
    const regionStores = stores.filter((row) => row.region === item.label);
    const segments = frequencyPalette.map(([frequencyName, color]) => {
      const frequencyCount = regionStores.filter((row) => row.frequency === frequencyName).length;
      return frequencyCount ? `<span title="${escapeHtml(`${frequencyName}: ${frequencyCount} stores`)}" style="width:${((frequencyCount / regionStores.length) * 100).toFixed(2)}%;background:${color}"></span>` : "";
    }).join("");
    const calls = regionStores.reduce((total, row) => total + Number(row.callsPerMonth || 0), 0);
    return `<p><b>${escapeHtml(item.label)}</b><i><em class="dedicated-callcycle-region-stack" style="width:${((Number(item.value || 0) / regionalMaximum) * 100).toFixed(2)}%">${segments}</em></i><strong>${attendanceDashboardNumber(item.value)}</strong><small>${attendanceDashboardNumber(calls)} calls</small></p>`;
  }).join("");
}

function renderDedicatedAttendanceDashboardLegacy(data) {
  const container = document.querySelector("#salesforceDedicatedAttendance");
  if (!container) return;
  const daily = data?.daily || {};
  const monthly = data?.monthly || {};
  const dailyMetrics = daily.metrics || {};
  const monthlyMetrics = monthly.metrics || {};
  const dailyRows = Array.isArray(daily.activity) ? daily.activity : [];
  const weeklyRows = Array.isArray(monthly.weeklyActuals) ? monthly.weeklyActuals : [];
  const dailyHistory = Array.isArray(daily.history) ? daily.history : [];
  const hasData = dailyRows.length || weeklyRows.length;
  if (!hasData) {
    container.innerHTML = `<p class="history-empty">Run the Daily or Monthly Salesforce Attendance automation to load Dedicated Attendance.</p>`;
    return;
  }
  const barRows = (rows, valueKey, detail) => {
    const maximum = Math.max(...rows.map((row) => Number(row[valueKey] || 0)), 1);
    return rows.map((row) => `<div class="pg-attendance-bar"><div><span>${escapeHtml(row.label || `Week ${row.week || "-"}`)}</span><b>${attendanceDashboardNumber(row[valueKey])}</b></div><i><b style="width:${Math.max(3, Math.round((Number(row[valueKey] || 0) / maximum) * 100))}%"></b></i><small>${escapeHtml(detail(row))}</small></div>`).join("");
  };
  const rate = Number(dailyMetrics.coverageRate || 0);
  const sourceLabel = [daily.month, monthly.month].filter(Boolean).join(" / ") || "Latest verified update";
  if (state.attendanceProduct === "attendance" && state.attendanceDashboardSource === "salesforce") {
    if (elements.attendanceHeaderMetricLabel) elements.attendanceHeaderMetricLabel.textContent = "Attendance rate";
    if (elements.attendanceHeaderStoreCount) elements.attendanceHeaderStoreCount.textContent = attendanceDashboardPercent(rate);
  }
  container.innerHTML = `<section class="pg-attendance-kpis" aria-label="Dedicated attendance key measures">
    <article><span>Scheduled visits</span><strong>${attendanceDashboardNumber(dailyMetrics.plannedRows)}</strong><small>Daily plan for ${escapeHtml(daily.month || "latest month")}</small></article>
    <article><span>Actual visits</span><strong>${attendanceDashboardNumber(dailyMetrics.actualStores)}</strong><small>Completed Daily Attendance visits</small></article>
    <article><span>Attendance MTD</span><strong>${attendanceDashboardPercent(rate)}</strong><small>Actual visits against plan</small></article>
    <article><span>Eligible visits</span><strong>${attendanceDashboardNumber(dailyMetrics.validVisits)}</strong><small>Validated Salesforce activity</small></article>
    <article><span>Daily updates</span><strong>${attendanceDashboardNumber(dailyMetrics.runs)}</strong><small>Completed automation runs</small></article>
    <article><span>Monthly weeks</span><strong>${attendanceDashboardNumber(monthlyMetrics.actualWeeks)}</strong><small>${attendanceDashboardNumber(monthlyMetrics.actualVisits)} actual visits</small></article>
  </section>
  <p class="pg-attendance-source">Dedicated attendance source: ${escapeHtml(sourceLabel)}. Daily and Monthly Salesforce automation results are shown here.</p>
  <section class="pg-attendance-grid">
    <article class="pg-attendance-card"><header><div><p>Daily attendance trend</p><h2>Actual visits by day</h2></div><span>${attendanceDashboardNumber(dailyRows.length)} days</span></header><div class="pg-attendance-bars">${barRows(dailyRows, "value", (row) => row.detail || "") || `<p class="history-empty">No Daily Attendance updates for this period.</p>`}</div></article>
    <article class="pg-attendance-card"><header><div><p>Monthly progress</p><h2>Actual visits by week</h2></div><span>${escapeHtml(monthly.month || "No month")}</span></header><div class="pg-attendance-bars">${barRows(weeklyRows.map((row) => ({ ...row, label: `Week ${row.week}` })), "actual", (row) => [row.rangeStart, row.rangeEnd].filter(Boolean).join(" to ")) || `<p class="history-empty">No Monthly Attendance actual weeks are available.</p>`}</div></article>
  </section>
  <section class="pg-attendance-card pg-attendance-detail"><header><div><p>Dedicated attendance detail</p><h2>Daily automation history</h2></div><span>${attendanceDashboardNumber(dailyHistory.length)} updates</span></header><div class="sales-order-table-wrap"><table><thead><tr><th>Date</th><th>Planned visits</th><th>Actual visits</th><th>Eligible visits</th><th>Matched stores</th><th>Attendance</th><th>Source</th></tr></thead><tbody>${dailyHistory.length ? dailyHistory.map((row) => { const planned = Number(row.plannedRows || 0); const actual = Number(row.actualStores || 0); return `<tr><td>${escapeHtml(row.attendanceDate || "-")}</td><td>${attendanceDashboardNumber(planned)}</td><td>${attendanceDashboardNumber(actual)}</td><td>${attendanceDashboardNumber(row.validVisits)}</td><td>${attendanceDashboardNumber(row.matchedStoreCodes)}</td><td>${attendanceDashboardPercent(planned ? (actual / planned) * 100 : 0)}</td><td>${escapeHtml(row.sourceFileName || "-")}</td></tr>`; }).join("") : `<tr><td colspan="7">No completed Daily Attendance updates are available.</td></tr>`}</tbody></table></div></section>`;
}

function buildDedicatedAttendancePgContext(data) {
  const daily = data?.daily || {};
  const monthly = data?.monthly || {};
  const metrics = daily.metrics || {};
  const dailyRows = attendancePgRows(daily.activity || [], "label", "value", "value");
  const weeklyRows = (monthly.weeklyActuals || []).map((row) => ({ label: `Week ${row.week || "-"}`, scheduled: Number(row.planned || row.actual || 0), actual: Number(row.actual || 0), rate: Number(row.planned || 0) ? (Number(row.actual || 0) / Number(row.planned || 0)) * 100 : attendancePgPercent(metrics.coverageRate) }));
  const history = (daily.history || []).map((row) => ({ label: row.attendanceDate || "Daily update", role: "Dedicated attendance", manager: row.sourceFileName || "-", region: daily.month || "-", scheduled: Number(row.plannedRows || 0), actual: Number(row.actualStores || 0), rate: Number(row.plannedRows || 0) ? (Number(row.actualStores || 0) / Number(row.plannedRows || 0)) * 100 : 0 }));
  const scheduled = Number(metrics.plannedRows || history.reduce((sum, row) => sum + row.scheduled, 0));
  const actual = Number(metrics.actualStores || history.reduce((sum, row) => sum + row.actual, 0));
  const rate = attendancePgPercent(metrics.coverageRate || (scheduled ? (actual / scheduled) * 100 : 0));
  return {
    monthLabel: [daily.month, monthly.month].filter(Boolean).join(" / ") || "Latest Salesforce updates", filters: {}, resourceRows: history, storeRows: history.map((row) => ({ ...row, owner: "Salesforce attendance automation" })), regionRows: weeklyRows, roleRows: [{ label: "Dedicated attendance", scheduled, actual, rate }], managerRows: history, weeklyRows, dailyRows, divisionRows: [], timeGone: 100,
    divisionMessage: "Salesforce publishes Daily and Monthly attendance aggregates; division-level rows are not in the current verified output.",
    kpis: [attendancePgKpi("Scheduled Visits", attendanceDashboardNumber(scheduled), "Daily plan for the selected month", "#22c55e"), attendancePgKpi("Actual Visits", attendanceDashboardNumber(actual), "completed Daily Attendance visits", "#d94f3a"), attendancePgKpi("Attendance MTD", attendancePgFormatPercent(rate), "actual visits against plan", "#f58220", rate >= 95 ? "#22c55e" : "#d94f3a"), attendancePgKpi("Stores Not Visited", attendanceDashboardNumber(Math.max(0, scheduled - actual)), "unmatched planned visits", "#3b82f6", "#d94f3a"), attendancePgKpi("% Stores Not Visited", attendancePgFormatPercent(scheduled ? ((scheduled - actual) / scheduled) * 100 : 0), "unvisited share", "#a78bfa"), attendancePgKpi("Time Gone", "100.0%", "latest published period", "#22c55e")]
  };
}

function renderDedicatedAttendanceDashboard(data) {
  state.salesforceAttendanceDashboardData = data || null;
  const container = document.querySelector("#salesforceDedicatedAttendance");
  if (!container) return;
  const daily = data?.daily || {};
  const monthly = data?.monthly || {};
  const hasData = (daily.activity || []).length || (daily.history || []).length || (monthly.weeklyActuals || []).length;
  if (!hasData) {
    container.innerHTML = `<section class="pg-source-page"><p class="history-empty">Run the Daily or Monthly Salesforce Attendance automation to load Dedicated Attendance.</p></section>`;
    return;
  }
  const context = buildDedicatedAttendancePgContext(data);
  container.innerHTML = renderAttendancePgPage(context);
  const rate = attendancePgPercent(daily.metrics?.coverageRate);
  if (state.attendanceProduct === "attendance" && state.attendanceDashboardSource === "salesforce") {
    if (elements.attendanceHeaderMetricLabel) elements.attendanceHeaderMetricLabel.textContent = "Attendance rate";
    if (elements.attendanceHeaderStoreCount) elements.attendanceHeaderStoreCount.textContent = attendancePgFormatPercent(rate);
  }
  syncAttendanceWorkspaceHeader();
}

async function loadSalesforceAttendanceDashboard() {
  const generation = nexusSessionGeneration;
  if (state.salesforceAttendanceDashboardLoading) return;
  const status = document.querySelector("#salesforceDailyAttendanceStatus");
  if (!state.isOperator || !cloudFunctions) {
    status.textContent = "Sign in to Nexus to load controlled Salesforce Attendance data.";
    renderDedicatedAttendanceDashboard(null);
    renderCallCycleDashboard(null);
    return;
  }
  state.salesforceAttendanceDashboardLoading = true;
  elements.attendanceDashboardRefresh.disabled = true;
  status.textContent = "Loading verified Salesforce Attendance updates...";
  try {
    const data = await callFunction("getSalesforceAttendanceDashboard", {}, cachedDashboard(data => {
      renderDedicatedAttendanceDashboard(data);
      renderCallCycleDashboard(data);
    }, status));
    renderDedicatedAttendanceDashboard(data);
    renderCallCycleDashboard(data);
    const period = data.monthly?.month || data.daily?.month || "Latest run";
    elements.attendanceDashboardPeriod.textContent = period;
    const dailyRuns = Number(data.daily?.metrics?.runs || 0);
    const monthlyWeeks = Number(data.monthly?.metrics?.actualWeeks || 0);
    status.textContent = dailyRuns || monthlyWeeks
      ? `Showing ${attendanceDashboardNumber(dailyRuns)} daily update${dailyRuns === 1 ? "" : "s"} and ${attendanceDashboardNumber(monthlyWeeks)} monthly Actual Week${monthlyWeeks === 1 ? "" : "s"} for ${period}.`
      : "Run Salesforce Attendance to load the online coverage dashboard.";
    const callCycleStatus = document.querySelector("#callCycleStatus");
    if (callCycleStatus) callCycleStatus.textContent = data?.dedicatedCallCycle?.records?.length
      ? `Showing ${attendanceDashboardNumber(data.dedicatedCallCycle.records.length)} active Smart Sell Master rows from ${data.dedicatedCallCycle.source?.fileName || "the verified master"}.`
      : (data?.dedicatedCallCycle?.error || "Upload the active Smart Sell Master to load Call Cycle.");
  } catch (error) {
    if (generation !== nexusSessionGeneration || error.code === "cancelled") return;
    renderDedicatedAttendanceDashboard(null);
    renderCallCycleDashboard(null);
    status.textContent = friendlyError(error);
    const callCycleStatus = document.querySelector("#callCycleStatus");
    if (callCycleStatus) callCycleStatus.textContent = friendlyError(error);
  } finally {
    if (generation === nexusSessionGeneration) {
      state.salesforceAttendanceDashboardLoading = false;
      elements.attendanceDashboardRefresh.disabled = false;
    }
  }
}

async function loadCallCycleDashboard() {
  const generation = nexusSessionGeneration;
  if (state.callCycleLoading) return;
  const status = document.querySelector("#callCycleStatus");
  if (!state.isOperator || !cloudFunctions) {
    if (status) status.textContent = "Sign in to Nexus to load controlled Call Cycle data.";
    renderCallCycleDashboard(null);
    return;
  }
  state.callCycleLoading = true;
  elements.attendanceDashboardRefresh.disabled = true;
  if (status) status.textContent = "Loading verified Dedicated and Syndicated Call Cycle sources...";
  try {
    const [salesforce, geo] = await Promise.allSettled([
      callFunction("getSalesforceAttendanceDashboard", {}, cachedDashboard(data => renderCallCycleDashboard(data), status)),
      callFunction("getGeoRepAttendanceDashboard", { mode: "callcycle", audience: "rep", filters: {} }, cachedDashboard(data => {
        state.callCycleSyndicatedData = data;
        renderCallCycleDashboard(state.salesforceAttendanceDashboardData);
      }, status))
    ]);
    if (generation !== nexusSessionGeneration) return;
    const salesforceData = salesforce.status === "fulfilled" ? salesforce.value : null;
    state.callCycleSyndicatedData = geo.status === "fulfilled" ? geo.value : null;
    renderCallCycleDashboard(salesforceData);
    const source = callCycleSourceData(salesforceData);
    if (status) status.textContent = source.records.length
      ? `Showing ${attendanceDashboardNumber(source.records.length)} stores from ${source.source.fileName || source.label}.`
      : source.error;
  } catch (error) {
    if (generation !== nexusSessionGeneration || error.code === "cancelled") return;
    renderCallCycleDashboard(null);
    if (status) status.textContent = friendlyError(error);
  } finally {
    if (generation === nexusSessionGeneration) {
      state.callCycleLoading = false;
      elements.attendanceDashboardRefresh.disabled = false;
    }
  }
}

function syncAttendanceWorkspaceHeader() {
  const attendancePageTitle = ({ overview: "MTD Overview", daily: "Daily Visits", users: "Roster", stores: "Attendance by Store" })[state.attendanceCoveragePage] || "MTD Overview";
  if (state.attendanceProduct === "callcycle") {
    if (elements.attendanceWorkspaceKicker) elements.attendanceWorkspaceKicker.textContent = "Call Cycle";
    if (elements.attendanceCallcyclePageTitle) elements.attendanceCallcyclePageTitle.textContent = ({ overview: "Overview", divisions: "Divisional coverage", reps: "Reps", stores: "Stores" })[state.callCyclePage] || "Overview";
    return;
  }
  if (state.attendanceDashboardSource === "salesforce") {
    if (elements.attendanceWorkspaceKicker) elements.attendanceWorkspaceKicker.textContent = "Dedicated Attendance";
    if (elements.attendanceCallcyclePageTitle) elements.attendanceCallcyclePageTitle.textContent = attendancePageTitle;
    return;
  }
  document.querySelectorAll('[data-attendance-source="geo"][data-attendance-page="users"] span').forEach(label => { label.textContent = state.attendanceDashboardAudience === "merchandiser" ? "Merchandiser Roster" : "Rep Roster"; });
  if (elements.attendanceWorkspaceKicker) elements.attendanceWorkspaceKicker.textContent = "Syndicated Attendance";
  if (elements.attendanceCallcyclePageTitle) {
    const audience = state.attendanceDashboardAudience === "merchandiser" ? "Merchandiser" : "Rep";
    elements.attendanceCallcyclePageTitle.textContent = `${audience} ${attendancePageTitle}`;
  }
}

function syncCallCycleNavigation() {
  document.querySelectorAll("[data-callcycle-source]").forEach((button) => {
    const active = state.attendanceProduct === "callcycle" && button.dataset.callcycleSource === state.callCycleSource && (!button.dataset.callcyclePage || button.dataset.callcyclePage === state.callCyclePage);
    button.classList.toggle("active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
}

function setCallCycleSource(source) {
  state.callCycleSource = source === "syndicated" ? "syndicated" : "dedicated";
  state.callCycleSelectedRep = "";
  state.callCycleStorePage = 1;
  syncCallCycleNavigation();
  if (state.attendanceProduct !== "callcycle") setAttendanceProduct("callcycle", true);
  loadCallCycleDashboard();
}

function setCallCyclePage(page) {
  state.callCyclePage = ["overview", "divisions", "reps", "stores"].includes(page) ? page : "overview";
  state.callCycleSelectedRep = "";
  state.callCycleStorePage = 1;
  syncCallCycleNavigation();
  syncAttendanceWorkspaceHeader();
  renderCallCycleDashboard(state.salesforceAttendanceDashboardData);
}

function setAttendanceProduct(product, skipLoad = false) {
  state.attendanceProduct = product === "callcycle" ? "callcycle" : "attendance";
  document.querySelectorAll("[data-attendance-product]").forEach((button) => {
    const active = button.dataset.attendanceProduct === state.attendanceProduct;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  if (elements.attendanceProductPanel) elements.attendanceProductPanel.hidden = state.attendanceProduct !== "attendance";
  if (elements.attendanceCallCyclePanel) elements.attendanceCallCyclePanel.hidden = state.attendanceProduct !== "callcycle";
  document.querySelectorAll('[data-attendance-product-link="callcycle"]').forEach((button) => {
    const active = state.attendanceProduct === "callcycle" && window.location.hash === "#callcycle";
    button.classList.toggle("active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
  document.querySelectorAll('[data-open-view="attendance"]:not([data-attendance-product-link]):not([data-attendance-source]):not([data-attendance-jobs])').forEach((button) => {
    const active = state.attendanceProduct === "attendance" && window.location.hash === "#attendance";
    button.classList.toggle("active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
  document.querySelectorAll("[data-attendance-source]").forEach((button) => {
    const active = state.attendanceProduct === "attendance" && button.dataset.attendanceSource === state.attendanceDashboardSource && (!button.dataset.attendancePage || button.dataset.attendancePage === state.attendanceCoveragePage) && (!button.dataset.attendanceAudience || button.dataset.attendanceAudience === state.attendanceDashboardAudience);
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  syncCallCycleNavigation();
  syncAttendanceWorkspaceHeader();
  if (skipLoad) return;
  if (state.attendanceProduct === "callcycle") {
    if (elements.attendanceHeaderMetricLabel) elements.attendanceHeaderMetricLabel.textContent = "Stores in view";
    loadCallCycleDashboard();
  } else {
    loadAttendanceDashboard();
  }
}

function setAttendanceDashboardSource(source) {
  if (state.attendanceProduct !== "attendance") setAttendanceProduct("attendance", true);
  const validSources = new Set(["geo", "salesforce"]);
  state.attendanceDashboardSource = validSources.has(source) ? source : "geo";
  document.querySelectorAll("[data-attendance-source]").forEach((button) => {
    const active = button.dataset.attendanceSource === state.attendanceDashboardSource && (!button.dataset.attendancePage || button.dataset.attendancePage === state.attendanceCoveragePage) && (!button.dataset.attendanceAudience || button.dataset.attendanceAudience === state.attendanceDashboardAudience);
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  elements.attendanceGeoPanel.hidden = state.attendanceDashboardSource !== "geo";
  elements.attendanceSalesforceDailyPanel.hidden = state.attendanceDashboardSource !== "salesforce";
  elements.attendanceSalesforceMonthlyPanel.hidden = true;
  elements.attendanceDashboardOperationalWeek.hidden = state.attendanceDashboardSource !== "geo";
  syncAttendanceWorkspaceHeader();
  if (elements.attendanceHeaderMetricLabel) elements.attendanceHeaderMetricLabel.textContent = state.attendanceDashboardSource === "geo" ? "Stores in view" : "Attendance rate";
  if (state.attendanceDashboardSource !== "geo") elements.attendanceDashboardPeriod.textContent = "Loading";
  loadAttendanceDashboard();
}

async function loadAttendanceDashboard() {
  const generation = nexusSessionGeneration;
  if (state.attendanceDashboardSource !== "geo") {
    await loadSalesforceAttendanceDashboard();
    return;
  }
  if (state.attendanceDashboardLoading) { state.attendanceDashboardReloadRequested = true; return; }
  if (!state.isOperator || !cloudFunctions) {
    elements.attendanceDashboardStatus.textContent = "Sign in to Nexus to load controlled Geo Rep Capture attendance data.";
    renderAttendanceDashboard(null);
    return;
  }
  state.attendanceDashboardLoading = true;
  elements.attendanceDashboardRefresh.disabled = true;
  elements.attendanceDashboardStatus.textContent = "Loading the latest verified Geo Rep Capture Strike Rate export...";
  const audience = state.attendanceDashboardAudience;
  const filters = attendanceDashboardCurrentFilters();
  const current = () => generation === nexusSessionGeneration && state.attendanceDashboardSource === "geo" && audience === state.attendanceDashboardAudience && JSON.stringify(filters) === JSON.stringify(attendanceDashboardCurrentFilters());
  try {
    const data = await callFunction("getGeoRepAttendanceDashboard", {
      audience, filters
    }, cachedDashboard(data => { if (current()) renderAttendanceDashboard(data); }, elements.attendanceDashboardStatus));
    if (!current()) return;
    renderAttendanceDashboard(data);
    if (state.attendanceWorkbookTab !== "overview") loadAttendanceWorksheetView(1);
    const audienceLabel = state.attendanceDashboardAudience === "merchandiser" ? "Merchandiser" : "Rep";
    elements.attendanceDashboardStatus.textContent = data.source?.strikeRate?.fileName
      ? `Showing ${attendanceDashboardNumber(data.metrics.users)} ${audienceLabel} users from ${data.source.strikeRate.fileName}.`
      : "Run Geo Rep Attendance once to load the Strike Rate dashboard and update the Rep TNA tracker.";
  } catch (error) {
    if (!current() || error.code === "cancelled") return;
    renderAttendanceDashboard(null);
    elements.attendanceDashboardStatus.textContent = friendlyError(error);
  } finally {
    if (generation === nexusSessionGeneration) {
      state.attendanceDashboardLoading = false;
      elements.attendanceDashboardRefresh.disabled = false;
      if (state.attendanceDashboardReloadRequested) {
        state.attendanceDashboardReloadRequested = false;
        loadAttendanceDashboard();
      }
    }
  }
}

function renderGeoRepAttendanceAdmin() {
  const config = state.geoRepAttendanceConfig || {};
  const tracker = config.tracker || null;
  const master = state.attendanceStoreMasters.find((item) => item.id === config.storeMasterId) || state.attendanceStoreMasters[0] || null;
  const operationalWeek = Number(config.operationalWeek || 0);
  const profile = state.retailers.find((item) => item.id === "geo-rep-attendance-for-reps");
  const schedule = profile?.reportSchedule || {};
  if (document.activeElement !== elements.geoRepAttendanceOperationalWeek) elements.geoRepAttendanceOperationalWeek.value = [1, 2, 3, 4].includes(operationalWeek) ? String(operationalWeek) : "";
  if ([1, 2, 3, 4].includes(operationalWeek)) {
    elements.geoRepAttendanceOperationalWeekStatus.textContent = `Week ${operationalWeek} is the active Geo operational week for future Rep TNA tracker updates.`;
    elements.geoRepAttendanceOperationalWeekState.textContent = `Week ${operationalWeek}`;
    elements.geoRepAttendanceOperationalWeekDetails.innerHTML = `<article class="operation-row"><span class="operation-indicator good"></span><div><strong>Operational week ${operationalWeek}</strong><small>Saved centrally and recorded against each new Geo Rep Attendance tracker update.</small></div><span class="row-status">Active</span></article>`;
  } else {
    elements.geoRepAttendanceOperationalWeekStatus.textContent = "Select the current Geo operational week before the next tracker update.";
    elements.geoRepAttendanceOperationalWeekState.textContent = "Not set";
    elements.geoRepAttendanceOperationalWeekDetails.innerHTML = `<p class="history-empty">The selected week is stored with each new Geo Rep Attendance tracker update. Existing raw rows and historic reports are not relabelled.</p>`;
  }
  if (tracker) {
    elements.geoRepAttendanceTrackerUrl.value = tracker.sourceUrl || "";
    elements.geoRepAttendanceTrackerStatus.textContent = `${tracker.name || "Rep TNA tracker"} is validated. Raw tabs: Strike rate and Schedules.`;
    elements.geoRepAttendanceTrackerState.textContent = "Validated";
    elements.geoRepAttendanceTrackerDetails.innerHTML = `<article class="operation-row"><span class="operation-indicator good"></span><div><strong>${escapeHtml(tracker.name || "Rep TNA tracker")}</strong><small>Only supported Rep source rows are replaced; weekly, daily and total formulas are refreshed after each update.</small></div><span class="row-status">Ready</span></article>`;
  } else {
    elements.geoRepAttendanceTrackerUrl.value = elements.geoRepAttendanceTrackerUrl.value || "https://meridiangroupza.sharepoint.com/:x:/s/MeridianNexus/IQCaanuLoEUbRrSEtCLJa7cmAUgzsqqXCy8y9AYjHM_osUg?e=yeGhnf";
    elements.geoRepAttendanceTrackerState.textContent = "Not configured";
    elements.geoRepAttendanceTrackerDetails.innerHTML = `<p class="history-empty">Save the Rep TNA tracker to enable automatic updates after Strike Rate and Scheduled Attendance complete.</p>`;
  }
  if (elements.geoRepAttendanceScheduleForm) {
    elements.geoRepAttendanceScheduleEnabled.checked = schedule.enabled === true;
    elements.geoRepAttendanceScheduleTime.value = schedule.time || "01:00";
    const days = new Set((schedule.daysOfWeek?.length ? schedule.daysOfWeek : scheduleDayOrder).map(Number));
    elements.geoRepAttendanceScheduleDays.forEach((input) => { input.checked = days.has(Number(input.value)); });
    const selectedDays = selectedScheduleDays(elements.geoRepAttendanceScheduleDays);
    const timeLabel = scheduleTimeDescription(elements.geoRepAttendanceScheduleTime.value);
    if (profile) {
      elements.geoRepAttendanceScheduleStatus.textContent = schedule.enabled
        ? `Automatic Geo attendance runs ${scheduleDaysDescription(selectedDays)} at ${timeLabel}. The scheduled range is always the 1st of the current month to yesterday; the 1st day of a new month is skipped.`
        : "Automatic Geo attendance is currently off. Manual runs remain available from Report automation.";
      elements.geoRepAttendanceScheduleState.textContent = schedule.enabled ? `Scheduled ${timeLabel}` : "Off";
      elements.geoRepAttendanceScheduleDetails.innerHTML = `<article class="operation-row"><span class="operation-indicator ${schedule.enabled ? "good" : "warning"}"></span><div><strong>${escapeHtml(profile.name || "Geo rep capture attendance for reps")}</strong><small>${escapeHtml(schedule.enabled ? `Runs ${scheduleDaysDescription(selectedDays)} at ${timeLabel}. Updates both Rep and Merchandiser workbooks.` : "Schedule disabled.")}</small></div><span class="row-status">${schedule.enabled ? "Active" : "Manual"}</span></article>`;
    } else {
      elements.geoRepAttendanceScheduleStatus.textContent = "The Geo rep capture attendance for reps extraction profile is not available yet.";
      elements.geoRepAttendanceScheduleState.textContent = "Missing profile";
      elements.geoRepAttendanceScheduleDetails.innerHTML = `<p class="history-empty">Create or restore the Geo rep capture attendance for reps extraction profile before scheduling.</p>`;
    }
  }
  if (master) {
    elements.geoRepAttendanceStoreMasterId.value = master.id;
    elements.geoRepAttendanceStoreMasterName.value = master.name || "Geo Rep Attendance Store Master";
    elements.geoRepAttendanceStoreMasterStatus.textContent = `${master.storeCount || 0} stores and ${master.regionCount || 0} regions were validated from ${master.sourceName || "the saved workbook"}.`;
    elements.geoRepAttendanceStoreMasterState.textContent = "Saved";
    elements.geoRepAttendanceStoreMasterDetails.innerHTML = `<article class="operation-row"><span class="operation-indicator good"></span><div><strong>${escapeHtml(master.name || "Attendance Store Master")}</strong><small>Reserved for store-level attendance enrichment when the export contains store records.</small></div><span class="row-status">Optional</span></article>`;
  } else {
    elements.geoRepAttendanceStoreMasterState.textContent = "Not required";
  }
}

async function saveGeoRepAttendanceTracker(event) {
  event.preventDefault();
  const submit = event.submitter;
  submit.disabled = true;
  try {
    elements.geoRepAttendanceTrackerStatus.textContent = "Checking the workbook layout and protected raw tabs...";
    const result = await callFunction("saveGeoRepAttendanceTracker", { sharePointUrl: elements.geoRepAttendanceTrackerUrl.value.trim() });
    state.geoRepAttendanceConfig = { ...(state.geoRepAttendanceConfig || {}), tracker: result.tracker };
    renderGeoRepAttendanceAdmin();
    showToast("Rep TNA tracker validated and saved.");
  } catch (error) {
    elements.geoRepAttendanceTrackerStatus.textContent = friendlyError(error);
    showToast(friendlyError(error), true);
  } finally {
    submit.disabled = false;
  }
}

async function saveGeoRepAttendanceOperationalWeek(event) {
  event.preventDefault();
  const submit = event.submitter;
  const operationalWeek = Number(elements.geoRepAttendanceOperationalWeek.value);
  if (![1, 2, 3, 4].includes(operationalWeek)) { showToast("Select Geo Rep operational week 1, 2, 3, or 4.", true); return; }
  submit.disabled = true;
  try {
    elements.geoRepAttendanceOperationalWeekStatus.textContent = "Saving the current Geo operational week...";
    const result = await callFunction("saveGeoRepAttendanceOperationalWeek", { operationalWeek });
    state.geoRepAttendanceConfig = { ...(state.geoRepAttendanceConfig || {}), operationalWeek: result.operationalWeek };
    renderGeoRepAttendanceAdmin();
    showToast(`Geo Rep operational week ${result.operationalWeek} saved.`);
  } catch (error) {
    elements.geoRepAttendanceOperationalWeekStatus.textContent = friendlyError(error);
    showToast(friendlyError(error), true);
  } finally {
    submit.disabled = false;
  }
}

async function saveGeoRepAttendanceSchedule(event) {
  event.preventDefault();
  const submit = event.submitter;
  const retailerId = "geo-rep-attendance-for-reps";
  const profile = state.retailers.find((item) => item.id === retailerId);
  if (!profile) { showToast("Geo rep capture attendance for reps profile is not available.", true); return; }
  const daysOfWeek = selectedScheduleDays(elements.geoRepAttendanceScheduleDays);
  if (elements.geoRepAttendanceScheduleEnabled.checked && !daysOfWeek.length) { showToast("Select at least one run day.", true); return; }
  submit.disabled = true;
  try {
    elements.geoRepAttendanceScheduleStatus.textContent = "Saving the Geo attendance schedule...";
    const result = await callFunction("saveRetailerSchedule", {
      retailerId,
      enabled: elements.geoRepAttendanceScheduleEnabled.checked,
      time: elements.geoRepAttendanceScheduleTime.value || "01:00",
      dateMode: "daily",
      daysOfWeek,
      startDate: "",
      endDate: ""
    });
    showToast(result.missedToday ? `Geo attendance schedule saved. The next eligible run is ${result.nextEligibleDate}.` : "Geo attendance schedule saved.");
    await loadAdminData();
  } catch (error) {
    elements.geoRepAttendanceScheduleStatus.textContent = friendlyError(error);
    showToast(friendlyError(error), true);
  } finally {
    submit.disabled = false;
  }
}

async function saveGeoRepAttendanceStoreMaster(event) {
  event.preventDefault();
  const file = elements.geoRepAttendanceStoreMasterFile.files[0];
  const submit = event.submitter;
  if (!file) { showToast("Choose an Attendance Store Master workbook first.", true); return; }
  if (file.size > 25 * 1024 * 1024 || !/\.xlsx$/i.test(file.name)) { showToast("Upload an .xlsx Store Master no larger than 25 MB.", true); return; }
  const id = elements.geoRepAttendanceStoreMasterId.value || "geo-rep-attendance-store-master";
  submit.disabled = true;
  try {
    const storagePath = `geo-rep-attendance-store-masters/${id}/${safeStorageName(file.name)}`;
    elements.geoRepAttendanceStoreMasterStatus.textContent = "Uploading and validating the optional Attendance Store Master...";
    const upload = await storage.ref(storagePath).put(file, { contentType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", customMetadata: { masterId: id, purpose: "geo-rep-attendance-store-enrichment" } });
    if (Number(upload.metadata.size) !== file.size) throw new Error("Store Master upload verification failed.");
    const result = await callFunction("saveGeoRepAttendanceStoreMaster", { id, name: elements.geoRepAttendanceStoreMasterName.value.trim(), storagePath, sourceName: file.name });
    elements.geoRepAttendanceStoreMasterFile.value = "";
    elements.geoRepAttendanceStoreMasterStatus.textContent = `${result.storeCount} stores and ${result.regionCount} regions validated on ${result.sheetName}.`;
    showToast("Attendance Store Master saved.");
  } catch (error) {
    elements.geoRepAttendanceStoreMasterStatus.textContent = friendlyError(error);
    showToast(friendlyError(error), true);
  } finally {
    submit.disabled = false;
  }
}

async function rebuildGeoRepAttendanceStoreCoverage() {
  const button = elements.rebuildGeoRepAttendanceStoreCoverage;
  if (!button) return;
  button.disabled = true;
  const originalLabel = button.textContent;
  button.textContent = "Building store coverage...";
  try {
    const result = await callFunction("rebuildGeoRepAttendanceStoreCoverage", { audience: "both" });
    const total = (result.results || []).reduce((count, item) => count + Number(item.totalStores || 0), 0);
    showToast(`Store coverage is ready for Reps and Merchandisers: ${total} stores indexed.`);
    if (state.attendanceDashboardSource === "geo") await loadAttendanceDashboard();
  } catch (error) {
    showToast(friendlyError(error), true);
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

function renderSalesDashboardAdmin() {
  const config = state.salesDashboardConfig || {};
  const master = state.salesStoreMasters.find((item) => item.id === config.storeMasterId) || state.salesStoreMasters[0] || null;
  if (master) {
    elements.salesStoreMasterId.value = master.id;
    elements.salesStoreMasterName.value = master.name || "Geo Rep Capture Orders Store Master";
    elements.salesStoreMasterFile.required = false;
    elements.salesStoreMasterStatus.textContent = `${master.storeCount || 0} stores across ${master.regionCount || 0} regions from ${master.sourceName || "the saved workbook"}. Upload a new workbook only to replace it.`;
  } else {
    elements.salesStoreMasterId.value = "geo-rep-orders-store-master";
    elements.salesStoreMasterFile.required = true;
  }
  const isReady = config.setupStatus === "ready" && config.transactionRetailerId;
  elements.salesDashboardSetupState.textContent = isReady ? "Ready" : master ? "Store Master saved" : "Not configured";
  elements.setupGeoRepSalesDashboard.disabled = !master;
  elements.salesDashboardSetupDetails.innerHTML = master
    ? `<article class="operation-row"><span class="operation-indicator ${isReady ? "good" : "warning"}"></span><div><strong>${escapeHtml(master.name || "Geo Rep Capture Orders Store Master")}</strong><small>${master.storeCount || 0} stores Â· ${master.regionCount || 0} regions Â· exact matching only</small></div><span class="row-status ${isReady ? "" : "running"}">${isReady ? "Connected" : "Set up workflow"}</span></article>${isReady ? `<article class="operation-row"><span class="operation-indicator good"></span><div><strong>Geo Rep Capture Orders</strong><small>Current-month Orders download, Transaction Report detail import and SharePoint delivery.</small></div><span class="row-status">Ready</span></article>` : ""}`
    : `<p class="history-empty">Save the Geo Rep Capture Orders Store Master, then create the dedicated Orders workflow.</p>`;
}

function renderGeoRepOpenApiIntegration() {
  const integration = state.geoRepOpenApiIntegration || {};
  const config = integration.config || {};
  const health = integration.health || null;
  const selectedGroups = Array.isArray(config.selectedGroups) && config.selectedGroups.length ? config.selectedGroups : ["reference", "attendance", "capture", "orders"];
  const excludedEntities = Array.isArray(config.excludedEntities) ? config.excludedEntities : ["schedules"];
  const entityMeta = {
    users: { title: "Users", description: "User profiles, roles and assigned teams." },
    customers: { title: "Customers", description: "Customer and location reference records." },
    forms: { title: "Forms", description: "Available form definitions." },
    questions: { title: "Form questions", description: "Question definitions and answer configuration." },
    schedules: { title: "Schedules", description: "Planned customer visits and schedule assignments." },
    visits: { title: "Visits", description: "Completed visit and reporting records." },
    submissions: { title: "Form submissions", description: "Submitted form headers and reporting records." },
    answers: { title: "Submission answers", description: "Answers linked to completed form submissions." },
    epods: { title: "Orders and deliveries", description: "Geo Rep EPOD delivery records and product lines." }
  };
  elements.geoRepOpenApiHistoryDays.value = Number(config.initialHistoryDays || 90);
  elements.geoRepOpenApiOverlapHours.value = Number(config.overlapHours || 72);
  elements.geoRepOpenApiEnabled.checked = config.enabled === true;
  document.querySelector("#geoRepOpenApiSkipSchedules").checked = excludedEntities.includes("schedules");
  elements.geoRepOpenApiGroups.forEach((input) => { input.checked = selectedGroups.includes(input.value); });
  const status = health?.status === "connected" ? (config.enabled ? "Scheduled" : "Connected")
    : health?.status === "failed" ? "Needs attention" : "Awaiting credentials";
  elements.geoRepOpenApiState.textContent = status;
  elements.geoRepOpenApiState.classList.toggle("warning", health?.status === "failed");
  const checks = Array.isArray(health?.checks) ? health.checks : [];
  const recentRuns = Array.isArray(integration.recentRuns) ? integration.recentRuns.slice(0, 3) : [];
  const connectionLine = health
    ? `<article class="operation-row"><span class="operation-indicator ${health.status === "connected" ? "good" : "warning"}"></span><div><strong>${health.status === "connected" ? "Read-only connection verified" : "Connection needs attention"}</strong><small>${escapeHtml(health.error || (checks.length ? checks.map((item) => `${item.endpoint}: ${item.returnedRecords || 0} records`).join(" Â· ") : "No connection test has run yet."))}</small></div><span class="row-status ${health.status === "connected" ? "" : "running"}">${escapeHtml(formatDate(health.checkedAt || health.updatedAt || health.lastSyncAt))}</span></article>`
    : `<p class="history-empty">Add the API ID and API Key as Firebase secrets, then run a read-only connection test.</p>`;
  const runLines = recentRuns.map((run) => `<article class="operation-row"><span class="operation-indicator ${run.status === "completed" ? "good" : run.status === "failed" ? "warning" : "running"}"></span><div><strong>${escapeHtml(run.scope || "API sync")}</strong><small>${escapeHtml(run.message || "Preparing sync status.")}</small></div><span class="row-status">${escapeHtml(formatDate(run.completedAt || run.failedAt || run.startedAt))}</span></article>`).join("");
  elements.geoRepOpenApiDetails.innerHTML = `${connectionLine}${runLines}`;
  elements.geoRepOpenApiSettingsStatus.textContent = config.enabled
    ? `Automatic sync is enabled every 30 minutes with a ${Number(config.overlapHours || 72)}-hour late-update overlap.`
    : "Credentials are held only in Firebase Secret Manager. Existing portal extractions remain unchanged until the API connection is verified.";
  const entities = Array.isArray(integration.entities) ? integration.entities : [];
  elements.geoRepOpenApiEntityList.innerHTML = entities.length
    ? entities.map((item) => {
      const meta = entityMeta[item.entity] || { title: item.entity, description: "Geo Rep Open API source." };
      const latest = item.latestResult || null;
      const resultSummary = latest
        ? `${Number(latest.scanned || 0).toLocaleString("en-ZA")} processed ${formatDate(latest.completedAt)}`
        : "No completed pull yet";
      const sourceRange = latest?.range?.timestamp_start && latest?.range?.timestamp_end
        ? `${latest.range.timestamp_start} to ${latest.range.timestamp_end}`
        : "Checkpoint starts after the first pull";
      return `<article class="geo-api-entity-card">
        <div class="geo-api-entity-heading"><div><p class="eyebrow">${escapeHtml(item.group || "reference")}</p><h3>${escapeHtml(meta.title)}</h3></div><span class="entity-state ${item.selected ? "selected" : "excluded"}">${item.selected ? "Included" : item.excluded ? "Report flow" : "Excluded"}</span></div>
        <p>${escapeHtml(meta.description)}</p>
        <code>${escapeHtml(item.endpoint || "")}</code>
        <dl><div><dt>Firestore records</dt><dd>${Number(item.storedRecords || 0).toLocaleString("en-ZA")}</dd></div><div><dt>Last pull</dt><dd title="${escapeHtml(sourceRange)}">${escapeHtml(resultSummary)}</dd></div></dl>
        <div class="form-actions"><button class="secondary-button" type="button" data-geo-api-test="${escapeHtml(item.entity)}">Test endpoint</button><button class="primary-action" type="button" data-geo-api-sync="${escapeHtml(item.entity)}">Pull now</button></div>
      </article>`;
    }).join("")
    : `<p class="history-empty">No API source status is available yet. Run the connection test, then refresh this view.</p>`;
}

async function loadGeoRepOpenApiIntegrationStatus() {
  try {
    state.geoRepOpenApiIntegration = await callFunction("getGeoRepOpenApiIntegrationStatus");
    renderGeoRepOpenApiIntegration();
  } catch (error) {
    elements.geoRepOpenApiState.textContent = "Unavailable";
    elements.geoRepOpenApiDetails.innerHTML = `<p class="history-empty">${escapeHtml(friendlyError(error))}</p>`;
    elements.geoRepOpenApiEntityList.innerHTML = `<p class="history-empty">${escapeHtml(friendlyError(error))}</p>`;
  }
}

async function saveGeoRepOpenApiCredentials(event) {
  event.preventDefault();
  const submit = event.submitter;
  const apiId = elements.geoRepOpenApiIdInput.value.trim();
  const apiKey = elements.geoRepOpenApiKeyInput.value.trim();
  if (!apiId || !apiKey) { showToast("Enter both the Geo Rep API ID and API Key.", true); return; }
  submit.disabled = true;
  elements.geoRepOpenApiCredentialsStatus.textContent = "Saving new credentials securely...";
  try {
    await callFunction("updateGeoRepOpenApiCredentials", { apiId, apiKey });
    elements.geoRepOpenApiCredentialsForm.reset();
    elements.geoRepOpenApiCredentialsStatus.textContent = "New credentials saved in Firebase Secret Manager. Run Test connection to verify them.";
    await loadGeoRepOpenApiIntegrationStatus();
    showToast("New Geo Rep API credentials saved securely.");
  } catch (error) {
    elements.geoRepOpenApiCredentialsStatus.textContent = "The credentials could not be saved. They were not stored in the browser.";
    showToast(friendlyError(error), true);
  } finally {
    submit.disabled = false;
  }
}

async function saveGeoRepOpenApiSyncSettings(event) {
  event.preventDefault();
  const submit = event.submitter;
  const selectedGroups = [...elements.geoRepOpenApiGroups].filter((input) => input.checked).map((input) => input.value);
  if (!selectedGroups.length) { showToast("Select at least one Geo Rep API data group.", true); return; }
  submit.disabled = true;
  try {
    const result = await callFunction("saveGeoRepOpenApiSyncConfig", {
      initialHistoryDays: Number(elements.geoRepOpenApiHistoryDays.value),
      overlapHours: Number(elements.geoRepOpenApiOverlapHours.value),
      selectedGroups,
      excludedEntities: document.querySelector("#geoRepOpenApiSkipSchedules").checked ? ["schedules"] : [],
      enabled: elements.geoRepOpenApiEnabled.checked
    });
    state.geoRepOpenApiIntegration = { ...(state.geoRepOpenApiIntegration || {}), config: { ...(state.geoRepOpenApiIntegration?.config || {}), ...result } };
    renderGeoRepOpenApiIntegration();
    showToast(result.enabled ? "Geo Rep API automatic sync enabled." : "Geo Rep API sync settings saved. Connection remains disabled.");
  } catch (error) {
    showToast(friendlyError(error), true);
  } finally {
    submit.disabled = false;
  }
}

async function testGeoRepOpenApiConnection() {
  elements.testGeoRepOpenApiConnection.disabled = true;
  try {
    await callFunction("testGeoRepOpenApiConnection");
    await loadGeoRepOpenApiIntegrationStatus();
    showToast("Geo Rep API connection verified. No records were imported.");
  } catch (error) {
    await loadGeoRepOpenApiIntegrationStatus();
    showToast(friendlyError(error), true);
  } finally {
    elements.testGeoRepOpenApiConnection.disabled = false;
  }
}

async function runGeoRepOpenApiReferenceSync() {
  elements.runGeoRepOpenApiReferenceSync.disabled = true;
  try {
    const result = await callFunction("runGeoRepOpenApiSync", { scope: "reference" });
    await loadGeoRepOpenApiIntegrationStatus();
    showToast(`Reference sync completed: ${Number(result.totals?.scanned || 0).toLocaleString("en-ZA")} records processed.`);
  } catch (error) {
    await loadGeoRepOpenApiIntegrationStatus();
    showToast(friendlyError(error), true);
  } finally {
    elements.runGeoRepOpenApiReferenceSync.disabled = false;
  }
}

async function runGeoRepOpenApiFullSync() {
  elements.runGeoRepOpenApiFullSync.disabled = true;
  try {
    const result = await callFunction("runGeoRepOpenApiSync", { scope: "all" });
    await loadGeoRepOpenApiIntegrationStatus();
    showToast(`Geo Rep API sync completed: ${Number(result.totals?.scanned || 0).toLocaleString("en-ZA")} records processed.`);
  } catch (error) {
    await loadGeoRepOpenApiIntegrationStatus();
    showToast(friendlyError(error), true);
  } finally {
    elements.runGeoRepOpenApiFullSync.disabled = false;
  }
}

async function testGeoRepOpenApiEntity(entity, button) {
  button.disabled = true;
  try {
    const result = await callFunction("testGeoRepOpenApiEndpoint", { entity });
    showToast(`${result.entity}: page 1 returned ${Number(result.firstPageRecords || 0).toLocaleString("en-ZA")} records. No data was saved.`);
  } catch (error) {
    showToast(friendlyError(error), true);
  } finally {
    button.disabled = false;
  }
}

async function syncGeoRepOpenApiEntity(entity, button) {
  button.disabled = true;
  try {
    const result = await callFunction("runGeoRepOpenApiSync", { scope: entity });
    await loadGeoRepOpenApiIntegrationStatus();
    showToast(`${entity}: ${Number(result.totals?.scanned || 0).toLocaleString("en-ZA")} records processed.`);
  } catch (error) {
    await loadGeoRepOpenApiIntegrationStatus();
    showToast(friendlyError(error), true);
  } finally {
    button.disabled = false;
  }
}

async function saveGeoRepSalesStoreMaster(event) {
  event.preventDefault();
  const submit = event.submitter;
  const file = elements.salesStoreMasterFile.files[0];
  const id = elements.salesStoreMasterId.value || "geo-rep-orders-store-master";
  if (!file) { showToast("Choose the Geo Rep Capture Orders Store Master workbook.", true); return; }
  if (file.size > 25 * 1024 * 1024 || !/\.xlsx$/i.test(file.name)) { showToast("Upload an .xlsx Store Master no larger than 25 MB.", true); return; }
  submit.disabled = true;
  try {
    const storagePath = `geo-rep-sales-store-masters/${id}/${safeStorageName(file.name)}`;
    elements.salesStoreMasterStatus.textContent = "Uploading and validating the Geo Rep Capture Orders Store Master...";
    const upload = await storage.ref(storagePath).put(file, { contentType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", customMetadata: { masterId: id, purpose: "geo-rep-orders-regions" } });
    if (Number(upload.metadata.size) !== file.size) throw new Error("Store Master upload verification failed.");
    const result = await callFunction("saveGeoRepSalesStoreMaster", { id, name: elements.salesStoreMasterName.value.trim(), storagePath, sourceName: file.name });
    elements.salesStoreMasterId.value = result.id;
    elements.salesStoreMasterFile.value = "";
    elements.salesStoreMasterFile.required = false;
    elements.salesStoreMasterStatus.textContent = `${result.storeCount} stores and ${result.regionCount} regions validated on ${result.sheetName}.`;
    showToast("Geo Rep Capture Orders Store Master saved.");
  } catch (error) {
    elements.salesStoreMasterStatus.textContent = friendlyError(error);
    showToast(friendlyError(error), true);
  } finally {
    submit.disabled = false;
  }
}

async function setupGeoRepSalesDashboard() {
  elements.setupGeoRepSalesDashboard.disabled = true;
  try {
    const result = await callFunction("setupGeoRepSalesDashboard", { storeMasterId: elements.salesStoreMasterId.value });
    showToast("Geo Rep Capture Orders is ready. Set its schedule in Report Automation, then run the first month-to-date import.");
    activateAdminTab("sales");
    return result;
  } catch (error) {
    showToast(friendlyError(error), true);
  } finally {
    elements.setupGeoRepSalesDashboard.disabled = !state.salesStoreMasters.length;
  }
}

async function runGeoRepSalesApiImport() {
  const button = elements.runGeoRepSalesApiImport;
  if (!button) return;
  button.disabled = true;
  try {
    const result = await callFunction("runGeoRepSalesDashboardApiImport", {});
    const message = result?.message || (result?.status === "completed" ? "Geo Rep sales API import completed." : "Geo Rep sales API import finished.");
    showToast(message, result?.status === "failed");
    await loadSalesDashboard();
  } catch (error) {
    showToast(`Sales API import failed: ${friendlyError(error)}`, true);
  } finally {
    button.disabled = false;
  }
}

let retailerProfilesStop = null;

function stopRetailerProfiles() {
  retailerProfilesStop?.();
  retailerProfilesStop = null;
  state.retailers = [];
  state.retailerLoadStatus = "idle";
  state.retailerLoadError = "";
  renderRetailerList();
}

function renderRetailerList() {
  const status = state.retailerLoadStatus || "idle";
  const list = state.retailers.map(item => `<button type="button" data-id="${escapeHtml(item.id)}"><strong>${escapeHtml(item.name || "Incomplete extraction profile")}</strong><small>${escapeHtml(extractionProfileName(item.extractionProfileId, item.extractionName || "No extraction step set linked"))}</small></button>`).join("");
  const message = status === "error" ? state.retailerLoadError : status === "ready" ? "No extraction profiles configured." : "Loading extraction profiles...";
  elements.retailerList.innerHTML = `${status === "error" || !state.retailers.length ? `<p class="history-empty" role="status">${escapeHtml(message)}</p>` : ""}${list}${status === "error" ? '<button type="button" class="text-action" data-retry-retailers>Retry loading profiles</button>' : ""}`;
  elements.retailerCount.textContent = state.retailers.length || status === "ready" ? `${state.retailers.length} profile${state.retailers.length === 1 ? "" : "s"}` : status === "error" ? "Unavailable" : "Loading...";
  elements.retailerList.setAttribute("aria-busy", String(status === "loading"));
}

function subscribeRetailerProfiles() {
  stopRetailerProfiles();
  const user = auth?.currentUser;
  if (!state.isAdmin || !user) return;
  retailerProfilesStop = window.NexusAdminProfiles.start({
    user, projectId: firebase.app().options.projectId,
    timestamp: value => firebase.firestore.Timestamp.fromDate(new Date(value)),
    listen: (next, error) => database.collection("retailers").onSnapshot({ includeMetadataChanges: true }, next, error),
    onChange: result => {
      if (!state.isAdmin || auth.currentUser?.uid !== user.uid) return;
      state.retailers = result.rows.sort((a, b) => compareText(a, b, "name", "id"));
      state.retailerLoadStatus = result.status;
      state.retailerLoadError = result.error;
      renderRetailers();
    }
  });
}

function clearAdminSubscriptions({ preserveAdmin = false } = {}) {
  stopRetailerProfiles();
  adminUnsubscribers.forEach((unsubscribe) => unsubscribe()); adminUnsubscribers = [];
  // Refreshing admin listeners must not revoke the already verified admin session.
  if (!preserveAdmin) state.isAdmin = false;
  state.retailers = []; state.extractionProfiles = []; state.geoRepStoreMasters = []; state.geoRepFormIntakes = []; state.geoRepBlueprints = []; state.geoRepBlueprintFolder = null; state.salesStoreMasters = []; state.salesDashboardConfig = null; state.geoRepOpenApiIntegration = null; state.salesTransactionImports = []; state.geoRepAttendanceConfig = null; state.attendanceStoreMasters = []; state.salesforceAttendanceConfig = null; state.displayCompliancePhaseTwoConfig = null; state.sharePointInventoryData = null; state.sharePointInventoryLoading = false; state.sharePointInventoryScanning = false; state.localCodeContractsPreparing = false; state.adminUsers = []; state.extractionRuns = []; state.adminJobRuns = []; state.adminJobHistoryLoaded = false; state.adminJobHistoryError = ""; state.adminJobFiltersInitialised = false; state.selectedExecutionRunId = ""; state.selectedAdminJobRunId = ""; state.operationsRunDetail = null; state.adminJobDetail = null; state.activeExtractionRunId = ""; state.activeExtractionRun = null; state.activeAutomationPrompt = null; state.handledPromptIds.clear();
  if (elements.automationPromptDialog.open) elements.automationPromptDialog.close();
  renderRetailers();
  renderExtractionProfiles();
  renderGeoRepStoreMasters();
  renderGeoRepBlueprints();
  renderSalesDashboardAdmin();
  renderGeoRepAttendanceAdmin();
  renderSalesforceAttendanceMaster();
  renderDisplayCompliancePhaseTwoConfig();
  renderSharePointInventory();
  renderAdminUsers();
  renderOperations();
}

function stopOwnerPromptSubscription({ resetPrompt = false } = {}) {
  if (ownerPromptUnsubscribe) ownerPromptUnsubscribe();
  ownerPromptUnsubscribe = null;
  if (!resetPrompt) return;
  state.activeAutomationPrompt = null;
  state.handledPromptIds.clear();
  if (elements.automationPromptDialog.open) elements.automationPromptDialog.close();
}

function subscribeOwnerPrompts(uid) {
  stopOwnerPromptSubscription({ resetPrompt: true });
  if (!database || !uid) return;
  let stopped = false, timer, controller, revision = 0;
  const unsubscribe = database.collection("automationPrompts")
    .where("ownerUid", "==", uid)
    .where("status", "==", "waiting")
    .onSnapshot((snapshot) => {
      if (stopped || snapshot.metadata?.fromCache) return;
      revision++;
      syncAutomationPromptModal(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
    }, () => { /* The owner-scoped HTTP poll also works without a live channel. */ });
  const poll = async () => {
    const user = auth?.currentUser, currentRevision = revision;
    if (stopped || user?.uid !== uid) return;
    controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`https://firestore.googleapis.com/v1/projects/${firebase.app().options.projectId}/databases/(default)/documents:runQuery`, {
        method: "POST", signal: controller.signal,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ structuredQuery: {
          from: [{ collectionId: "automationPrompts" }],
          select: { fields: ["ownerUid", "runId", "retailerName", "type", "status", "inputRequired", "message", "codeLength"].map(fieldPath => ({ fieldPath })) },
          where: { compositeFilter: { op: "AND", filters: [
            { fieldFilter: { field: { fieldPath: "ownerUid" }, op: "EQUAL", value: { stringValue: uid } } },
            { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "waiting" } } }
          ] } }
        } })
      });
      if (!response.ok) throw new Error("Authentication prompt status is unavailable. Checking again shortly.");
      const result = await response.json();
      if (!Array.isArray(result) || result.some(row => row.error)) throw new Error("Authentication prompt status is incomplete. Checking again shortly.");
      if (stopped || auth?.currentUser?.uid !== uid || revision !== currentRevision) return;
      syncAutomationPromptModal(result.filter(row => row.document).map(({ document: doc }) => ({
        ...Object.fromEntries(Object.entries(doc.fields || {}).map(([key, value]) => [key, value.stringValue ?? value.booleanValue ?? (value.integerValue ? Number(value.integerValue) : null)])),
        id: doc.name.split("/").at(-1)
      })), { authoritative: true });
    } catch (error) {
      if (!stopped && state.activeAutomationPrompt && !state.activeAutomationPrompt.submitting) {
        elements.automationPromptMessage.textContent = "Checking the connection to Nexus. Your code has not been submitted again.";
      }
    } finally {
      window.clearTimeout(timeout);
      if (!stopped) timer = window.setTimeout(poll, 4000);
    }
  };
  ownerPromptUnsubscribe = () => { stopped = true; unsubscribe(); window.clearTimeout(timer); controller?.abort(); };
  poll();
}

async function handleAutomationPrompt(prompt) {
  if (!prompt?.id || state.handledPromptIds.has(prompt.id) || state.activeAutomationPrompt?.id === prompt.id) return;
  if (state.activeAutomationPrompt && state.activeAutomationPrompt.id !== prompt.id) return;
  state.handledPromptIds.add(prompt.id);
  const label = prompt.type === "otp" || prompt.type === "otp-login" ? "OTP" : prompt.type === "otp-export" ? "export OTP" : prompt.type === "approval" ? "approval confirmation" : "code";
  const waitingForAuthenticator = prompt.inputRequired === false;
  state.activeAutomationPrompt = prompt;
  elements.automationPromptForm.classList.toggle("approval-wait", waitingForAuthenticator);
  elements.automationPromptTitle.textContent = waitingForAuthenticator
    ? "Waiting for Salesforce Authenticator"
    : `Enter ${label} for ${prompt.retailerName || "the portal"}`;
  elements.automationPromptMessage.textContent = waitingForAuthenticator
    ? "Approve the request in Salesforce Authenticator. Nexus will detect the approval, close this prompt, and continue automatically."
    : (prompt.message || `Enter the ${label} to continue the active extraction.`);
  elements.automationPromptLabel.textContent = label;
  elements.automationPromptValue.value = "";
  elements.automationPromptValue.required = !waitingForAuthenticator;
  elements.automationPromptValue.disabled = waitingForAuthenticator;
  elements.automationPromptValue.placeholder = /OTP/i.test(label) ? "Enter the current code" : `Enter ${label}`;
  elements.automationPromptValue.inputMode = prompt.codeLength === 6 ? "numeric" : "text";
  elements.automationPromptValue.maxLength = prompt.codeLength || 80;
  elements.automationPromptForm.querySelector("button[type='submit']").disabled = false;
  elements.automationPromptForm.querySelector("button[type='submit']").textContent = waitingForAuthenticator ? "I've approved it" : "Continue";
  if (!elements.automationPromptDialog.open) elements.automationPromptDialog.showModal();
  if (!waitingForAuthenticator) window.setTimeout(() => elements.automationPromptValue.focus(), 0);
}

function syncAutomationPromptModal(prompts = [], { authoritative = false } = {}) {
  const waitingPrompts = Array.isArray(prompts) ? prompts.filter((prompt) => prompt?.id && (!prompt.status || prompt.status === "waiting")) : [];
  const activePrompt = state.activeAutomationPrompt;
  if (authoritative && activePrompt && !waitingPrompts.some((prompt) => prompt.id === activePrompt.id)) {
    if (elements.automationPromptDialog.open) elements.automationPromptDialog.close();
    elements.automationPromptForm.classList.remove("approval-wait");
    elements.automationPromptValue.disabled = false;
    elements.automationPromptValue.required = true;
    state.activeAutomationPrompt = null;
    elements.automationPromptValue.value = "";
    // Keep the handled ID: an older workspace response must not reopen it.
    state.handledPromptIds.add(activePrompt.id);
  }
  if (!state.activeAutomationPrompt) {
    const nextPrompt = waitingPrompts.find((prompt) => !state.handledPromptIds.has(prompt.id));
    if (nextPrompt) handleAutomationPrompt(nextPrompt);
  }
}

async function submitAutomationPromptValue() {
  const prompt = state.activeAutomationPrompt;
  if (!prompt || prompt.submitting) return;
  const approvalConfirmation = prompt.inputRequired === false;
  const label = prompt.type === "otp" || prompt.type === "otp-login" ? "OTP" : prompt.type === "otp-export" ? "export OTP" : prompt.type === "approval" ? "approval confirmation" : "code";
  const value = elements.automationPromptValue.value.trim();
  if (!approvalConfirmation && !value) {
    elements.automationPromptValue.focus();
    showToast(`Enter the ${label} to continue the extraction.`, true);
    return;
  }
  if (prompt.codeLength === 6 && !/^\d{6}$/.test(value)) {
    elements.automationPromptMessage.textContent = "Enter the current six-digit Authenticator code.";
    elements.automationPromptValue.focus();
    return;
  }
  const submit = elements.automationPromptForm.querySelector("button[type='submit']");
  prompt.submitting = true;
  submit.disabled = true;
  submit.textContent = "Sending...";
  elements.automationPromptMessage.textContent = "Sending to Nexus. Waiting for confirmation...";
  let timeout;
  try {
    await Promise.race([callFunction("submitAutomationPrompt", approvalConfirmation
      ? { promptId: prompt.id, action: "approve" }
      : { promptId: prompt.id, action: "submit", value }),
    new Promise((_, reject) => { timeout = window.setTimeout(() => reject(new Error("Nexus has not confirmed receipt yet. Checking status; do not reuse an expired code.")), 15000); })]);
    state.handledPromptIds.add(prompt.id);
    if (state.activeAutomationPrompt?.id === prompt.id) {
      elements.automationPromptDialog.close();
      elements.automationPromptValue.value = "";
      state.activeAutomationPrompt = null;
    }
    showToast(approvalConfirmation ? "Approval confirmation sent. Waiting for the portal." : `${label} sent. Waiting for the portal to accept it.`);
  } catch (error) {
    if (state.activeAutomationPrompt?.id === prompt.id) {
      elements.automationPromptMessage.textContent = friendlyError(error);
      showToast(friendlyError(error), true);
    }
  } finally {
    window.clearTimeout(timeout);
    prompt.submitting = false;
    if (state.activeAutomationPrompt?.id === prompt.id) {
      submit.disabled = false;
      submit.textContent = approvalConfirmation ? "I've approved it" : "Continue";
    }
  }
}

function subscribeAdminData() {
  clearAdminSubscriptions({ preserveAdmin: true });
  loadGeoRepOpenApiIntegrationStatus();
  subscribeRetailerProfiles();
  adminUnsubscribers.push(database.collection("extractionProfiles").onSnapshot((snapshot) => {
    state.extractionProfiles = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a,b) => compareText(a, b, "name", "id"));
    renderExtractionProfiles();
  }, (error) => showToast(`Could not load extraction step sets: ${friendlyError(error)}`, true)));
  adminUnsubscribers.push(database.collection("geoRepStoreMasters").onSnapshot((snapshot) => {
    state.geoRepStoreMasters = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => compareText(a, b, "name", "id"));
    renderGeoRepStoreMasters();
  }, (error) => showToast(`Could not load Geo Rep Capture store masters: ${friendlyError(error)}`, true)));
  adminUnsubscribers.push(database.collection("salesStoreMasters").onSnapshot((snapshot) => {
    state.salesStoreMasters = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => compareText(a, b, "name", "id"));
    renderSalesDashboardAdmin();
  }, (error) => showToast(`Could not load Geo Rep Capture Orders Store Master: ${friendlyError(error)}`, true)));
  adminUnsubscribers.push(database.collection("salesDashboardConfig").doc("current").onSnapshot((snapshot) => {
    state.salesDashboardConfig = snapshot.exists ? snapshot.data() : null;
    renderSalesDashboardAdmin();
  }, (error) => showToast(`Could not load sales dashboard setup: ${friendlyError(error)}`, true)));
  adminUnsubscribers.push(database.collection("geoRepAttendanceConfig").doc("current").onSnapshot((snapshot) => {
    state.geoRepAttendanceConfig = snapshot.exists ? snapshot.data() : null;
    renderGeoRepAttendanceAdmin();
  }, (error) => showToast(`Could not load Geo Rep Attendance setup: ${friendlyError(error)}`, true)));
  adminUnsubscribers.push(database.collection("attendanceStoreMasters").onSnapshot((snapshot) => {
    state.attendanceStoreMasters = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => compareText(a, b, "name", "id"));
    renderGeoRepAttendanceAdmin();
  }, (error) => showToast(`Could not load Attendance Store Masters: ${friendlyError(error)}`, true)));
  adminUnsubscribers.push(database.collection("salesTransactionImports").orderBy("createdAt", "desc").limit(6).onSnapshot((snapshot) => {
    state.salesTransactionImports = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (window.location.hash === "#sales") loadSalesDashboard();
  }, (error) => showToast(`Could not load sales dashboard import status: ${friendlyError(error)}`, true)));
  adminUnsubscribers.push(database.collection("geoRepFormIntakes").onSnapshot((snapshot) => {
    state.geoRepFormIntakes = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => compareText(a, b, "name", "id"));
    renderGeoRepFormIntakes();
  }, (error) => showToast(`Could not load Geo Rep Capture Form Intakes: ${friendlyError(error)}`, true)));
  adminUnsubscribers.push(database.collection("geoRepBlueprints").onSnapshot((snapshot) => {
    state.geoRepBlueprints = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => compareText(a, b, "name", "id"));
    renderGeoRepBlueprints();
  }, (error) => showToast(`Could not load Geo Rep Capture Blueprints: ${friendlyError(error)}`, true)));
  adminUnsubscribers.push(database.collection("geoRepBlueprintFolders").doc("current").onSnapshot((snapshot) => {
    state.geoRepBlueprintFolder = snapshot.exists ? snapshot.data() : null;
    renderGeoRepBlueprintFolder();
  }, (error) => showToast(`Could not load Geo Rep Capture Blueprint folder: ${friendlyError(error)}`, true)));
  adminUnsubscribers.push(database.collection("salesforceAttendanceConfig").doc("current").onSnapshot((snapshot) => {
    state.salesforceAttendanceConfig = snapshot.exists ? snapshot.data() : null;
    renderSalesforceAttendanceMaster();
  }, (error) => showToast(`Could not load SmartSell attendance setup: ${friendlyError(error)}`, true)));
  adminUnsubscribers.push(database.collection("salesforceDisplayComplianceConfig").doc("current").onSnapshot((snapshot) => {
    state.displayCompliancePhaseTwoConfig = snapshot.exists ? snapshot.data() : null;
    renderDisplayCompliancePhaseTwoConfig();
    renderSalesforceAttendanceMaster();
  }, (error) => showToast(`Could not load Display Compliance Phase Two setup: ${friendlyError(error)}`, true)));
  adminUnsubscribers.push(database.collection("adminUsers").onSnapshot((snapshot) => {
    state.adminUsers = snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() })).sort((a,b) => compareText(a, b, "email", "name", "uid"));
    renderAdminUsers();
  }, (error) => showToast(`Could not load admin users: ${friendlyError(error)}`, true)));
  adminUnsubscribers.push(database.collection("extractionRuns").orderBy("createdAt", "desc").limit(160).onSnapshot((snapshot) => {
    state.extractionRuns = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
    renderOperations();
  }, (error) => showToast(`Could not load extraction runs: ${friendlyError(error)}`, true)));
}

function setAdminRunActivity(status = "ready", title = "Ready to extract", copy = "Choose an extraction profile and start a report when you are ready.") {
  elements.adminRunState.className = `run-status-orb ${status}`;
  elements.adminRunStateTitle.textContent = title;
  elements.adminRunStateCopy.textContent = copy;
}

function renderExtractionRun(run, { passive = false } = {}) {
  if (!run) {
    state.extractionRunning = false;
    state.activeExtractionRunId = "";
    state.activeExtractionRun = null;
    elements.abortExtraction.hidden = true;
    if (elements.extractionStatusAbort) elements.extractionStatusAbort.hidden = true;
    elements.runStallActions.hidden = true;
    window.NexusJobStatus?.update(null);
    renderRunProgress(null, null);
    if (!passive) { updateSelectionControls(); renderRunRetailerDetails(); renderFilesRunRetailerDetails(); setAdminRunActivity(); }
    return;
  }
  const progress = describeExtractionProgress(run);
  const isBusy = progress.isBusy;
  const isCancelling = run.status === "cancelling";
  state.activeExtractionRunId = isBusy && run.id ? run.id : "";
  state.activeExtractionRun = isBusy ? run : null;
  elements.abortExtraction.hidden = !state.activeExtractionRunId;
  elements.abortExtraction.disabled = isCancelling;
  elements.abortExtraction.textContent = isCancelling ? "Stopping extraction..." : progress.waitingForPortal ? "Abort unresponsive extraction" : "Abort extraction";
  if (elements.extractionStatusAbort) {
    elements.extractionStatusAbort.hidden = !state.activeExtractionRunId;
    elements.extractionStatusAbort.disabled = isCancelling;
    elements.extractionStatusAbort.textContent = isCancelling ? "Stopping job..." : "Abort job";
  }
  elements.runStallActions.hidden = !progress.waitingForPortal;
  if (progress.waitingForPortal) elements.runStallProblem.textContent = progress.alert;
  const completedMessage = String(run.message || "The extraction has finished.").replace(/\bFiles and SharePoint\b/gi, "SharePoint").replace(/\bunder Files\b/gi, "to SharePoint");
  const ownerLabel = operationRunOwnerLabel(run);
  const progressCopy = isBusy ? `${progress.copy} Owner: ${ownerLabel}.` : completedMessage;
  const wasRunning = state.extractionRunning;
  state.extractionRunning = isBusy;
  renderRunProgress(run, progress);
  if (!passive) {
    updateSelectionControls();
    renderRunRetailerDetails();
    renderFilesRunRetailerDetails();
  }
  setAdminRunActivity(isBusy ? (progress.waitingForPortal ? "failed" : "running") : run.status === "failed" ? "failed" : "completed", isBusy ? progress.title : run.status === "failed" ? "Extraction needs attention" : run.status === "cancelled" ? "Extraction aborted" : "Report saved successfully", progressCopy);
  if (!isBusy && !wasRunning) return;
  window.NexusJobStatus?.update({
    id: run.id, status: run.status, isBusy,
    title: isBusy ? progress.title : run.status === "completed" ? "Report ready" : run.status === "failed" ? "Report extraction failed" : "Extraction finished",
    copy: progressCopy, step: progress.stepLabel, elapsed: `Elapsed ${formatElapsed(progress.elapsed)}`,
    progress: progress.progress, alert: progress.alert, canAbort: !!state.activeExtractionRunId
  });
}

if (!extractionStatusTimer) {
  extractionStatusTimer = window.setInterval(() => {
    if (state.activeExtractionRun) renderExtractionRun(state.activeExtractionRun, { passive: true });
  }, 15000);
}

function operationsProfiles(workspace = state.operationsWorkspace) {
  const profiles = [...(workspace?.profiles || [])];
  if (!state.isAdmin || workspace?.account?.role !== "admin") return profiles;
  for (const retailer of state.retailers) {
    if (!["dataorbis-game-sales", "dataorbis-makro-sales"].includes(retailer.id)
      || retailer.salesProcedure?.version !== "dataorbis-client-sales-20260923"
      || hasExtractionSteps(retailer) || profiles.some(profile => profile.id === retailer.id)) continue;
    let portal = "Configured portal";
    try { portal = new URL(retailer.webAddress).hostname; } catch { /* Keep the neutral label. */ }
    profiles.push({ id: retailer.id, name: retailer.name, portal, ready: false, setupRequired: true,
      extractionName: "Portal extraction and OTP steps are not connected",
      connectionLabel: retailer.username && retailer.credentialsUpdatedAt ? "Credentials saved" : "Credentials required",
      scheduleEnabled: false });
  }
  return profiles;
}

function currentOperationsProfile() {
  const profiles = operationsProfiles();
  return profiles.find((profile) => profile.id === elements.operationsRetailer.value) || profiles[0] || null;
}

function renderOperationsSmartSellMaster(workspace) {
  const smartSell = workspace?.smartSell || {};
  const profiles = Array.isArray(smartSell.profiles) ? smartSell.profiles : [];
  const canManage = smartSell.canManage === true && profiles.length > 0;
  elements.operationsSmartSellMasterPanel.hidden = !canManage;
  if (!canManage) return;

  const master = smartSell.master || null;
  const currentAssignments = new Set(Array.isArray(master?.assignments) ? master.assignments : []);
  if (!state.operationsSmartSellMasterDirty) {
    elements.operationsSmartSellMasterId.value = master?.id || "";
    elements.operationsSmartSellMasterWeek.value = String(master?.selectedWeek || 1);
    elements.operationsSmartSellMasterAssignments.innerHTML = profiles.map((profile) => {
      const checked = currentAssignments.size ? currentAssignments.has(profile.id) : true;
      return `<label><input type="checkbox" value="${escapeHtml(profile.id)}" ${checked ? "checked" : ""} /><span>${escapeHtml(profile.name || profile.id)}</span></label>`;
    }).join("");
  }
  elements.operationsSmartSellMasterFile.required = !master?.storagePath;
  elements.operationsSmartSellMasterState.textContent = master?.sourceName ? `Week ${master.selectedWeek || 1}` : "New Master";
  if (master?.storagePath) {
    const assignments = profiles.filter((profile) => currentAssignments.has(profile.id)).map((profile) => profile.name || profile.id);
    const assignmentText = assignments.length ? ` Assigned to ${assignments.join(" and ")}.` : " Select the Attendance profiles that should use it.";
    const updatedBy = master.weekUpdatedByName || master.weekUpdatedByEmail || "a previous Nexus user";
    const updatedAt = master.weekUpdatedAt ? ` on ${formatDate(master.weekUpdatedAt)}` : "";
    elements.operationsSmartSellMasterStatus.textContent = `${master.sourceName || "Current SmartSell Master.xlsx"} is validated${master.worksheet ? ` in ${master.worksheet}` : ""}${master.sourceRows ? ` with ${Number(master.sourceRows).toLocaleString()} source rows` : ""}. Active week: ${master.selectedWeek || 1}. Last updated by ${updatedBy}${updatedAt}.${assignmentText}`;
  } else {
    elements.operationsSmartSellMasterStatus.textContent = "Upload the current workbook, choose its active SmartSell week, and select the permitted Attendance profiles that should use it.";
  }
  const history = Array.isArray(smartSell.history) ? smartSell.history : [];
  const historyElement = document.querySelector("#operationsSmartSellMasterHistory");
  historyElement.innerHTML = history.length
    ? history.map((entry) => `<article class="operation-row"><span class="operation-indicator muted"></span><div><strong>${escapeHtml(entry.action === "week-updated" ? `Week ${entry.selectedWeek} selected` : entry.sourceName || "SmartSell Master update")}</strong><small>${escapeHtml(entry.actorName || entry.actorEmail || "Nexus user")} - ${escapeHtml(formatDate(entry.updatedAt))}${entry.assignments?.length ? ` - ${entry.assignments.length} attendance automation${entry.assignments.length === 1 ? "" : "s"}` : ""}</small></div></article>`).join("")
    : `<p class="history-empty">Future SmartSell document, week, and assignment changes will appear here with the user who made them.</p>`;
}

async function saveOperationsSmartSellMaster(event) {
  event.preventDefault();
  const smartSell = state.operationsWorkspace?.smartSell || {};
  const master = smartSell.master || null;
  const permitted = new Set((smartSell.profiles || []).map((profile) => profile.id));
  const assignments = [...elements.operationsSmartSellMasterAssignments.querySelectorAll("input:checked")]
    .map((input) => input.value)
    .filter((id) => permitted.has(id));
  const selectedFile = elements.operationsSmartSellMasterFile.files[0];
  let id = master?.id || elements.operationsSmartSellMasterId.value || "";
  let storagePath = master?.storagePath || "";
  elements.operationsSaveSmartSellMaster.disabled = true;
  try {
    if (!assignments.length) throw new Error("Select at least one permitted Attendance profile for this SmartSell Master.");
    if (selectedFile) {
      if (selectedFile.size > 25 * 1024 * 1024) throw new Error("SmartSell Master must be 25 MB or smaller.");
      if (!/\.xlsx$/i.test(selectedFile.name)) throw new Error("Upload the SmartSell Master as an .xlsx workbook.");
      id = `smartsell-${uniqueId()}`;
      storagePath = `salesforce-attendance-masters/${id}/${safeStorageName(selectedFile.name)}`;
      elements.operationsSmartSellMasterStatus.textContent = "Uploading and validating the SmartSell Master...";
      const upload = await storage.ref(storagePath).put(selectedFile, {
        contentType: selectedFile.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        customMetadata: { masterId: id, source: "operations-smartsell-attendance" }
      });
      if (Number(upload.metadata.size) !== selectedFile.size) throw new Error("SmartSell Master upload verification failed.");
    }
    if (!id || !storagePath) throw new Error("Choose the new SmartSell Master workbook before saving.");
    const result = await callFunction("saveSharedSmartSellMaster", {
      id,
      storagePath,
      sourceName: selectedFile?.name || master?.sourceName || "SmartSell Master.xlsx",
      selectedWeek: Number(elements.operationsSmartSellMasterWeek.value),
      assignments
    });
    state.operationsSmartSellMasterDirty = false;
    elements.operationsSmartSellMasterFile.value = "";
    showToast(`${result.sourceRows.toLocaleString()} SmartSell source rows validated. Active week ${result.selectedWeek} was saved.`);
    await loadOperationsWorkspace();
  } catch (error) {
    elements.operationsSmartSellMasterStatus.textContent = friendlyError(error);
    showToast(friendlyError(error), true);
  } finally {
    elements.operationsSaveSmartSellMaster.disabled = false;
  }
}

function renderOperationsMonthlyBlueprint(workspace) {
  const smartSell = workspace?.smartSell || {};
  const panel = document.querySelector("#operationsMonthlyBlueprintPanel");
  const canManage = smartSell.canManageMonthlyBlueprint === true;
  panel.hidden = !canManage;
  if (!canManage) return;
  const plan = smartSell.monthlyPlan || {};
  const blueprint = smartSell.monthlyBlueprint || {};
  const masterInput = document.querySelector("#operationsMonthlyPlanMasterUrl");
  const targetInput = document.querySelector("#operationsMonthlyPlanTargetUrl");
  if (document.activeElement !== masterInput) masterInput.value = masterInput.value || plan.masterUrl || "";
  if (document.activeElement !== targetInput && !targetInput.dataset.userEdited) targetInput.value = "";
  targetInput.placeholder = plan.targetName
    ? `Paste the workbook link to update. Current saved file: ${plan.targetName}`
    : "Paste the Monthly Plan workbook link";
  document.querySelector("#operationsMonthlyPlanEnabled").checked = plan.enabled === true;
  document.querySelector("#operationsMonthlyPlanTime").value = plan.time || "06:00";
  document.querySelector("#operationsMonthlyBlueprintTemplateUrl").value = blueprint.templateUrl || "";
  document.querySelector("#operationsMonthlyBlueprintFolderUrl").value = blueprint.folderUrl || "";
  document.querySelector("#operationsMonthlyBlueprintPrefix").value = blueprint.filePrefix || "Rep Attendance";
  document.querySelector("#operationsMonthlyBlueprintEnabled").checked = blueprint.enabled === true;
  document.querySelector("#operationsMonthlyBlueprintTime").value = blueprint.time || "05:45";
  document.querySelector("#operationsMonthlyBlueprintDay").value = String(blueprint.dayOfMonth || "1");
  const state = document.querySelector("#operationsMonthlyBlueprintState");
  const status = document.querySelector("#operationsMonthlyBlueprintStatus");
  const openLink = document.querySelector("#operationsOpenMonthlyBlueprint");
  const currentPlanText = plan.targetName
    ? `Current workbook: ${plan.targetName}.`
    : "No Monthly Plan workbook is saved yet.";
  const createsFromCurrentWorkbook = blueprint.sourceMode === "current-monthly-plan" || !blueprint.templateUrl;
  const scheduleDayText = String(blueprint.dayOfMonth || "1") === "last" ? "last day" : "1st day";
  state.textContent = blueprint.templateUrl || createsFromCurrentWorkbook
    ? (blueprint.enabled ? "Scheduled" : "Ready")
    : (plan.masterUrl && plan.targetUrl ? "Plan ready" : "Not configured");
  status.textContent = blueprint.templateUrl && !createsFromCurrentWorkbook
    ? `${blueprint.templateName || "Protected template"} creates ${blueprint.filePrefix || "Rep Attendance"} - Month Year.xlsx in ${blueprint.destinationName || "the configured folder"}. ${currentPlanText}`
    : (plan.masterUrl && plan.targetUrl
      ? `${currentPlanText} Nexus will copy it into ${blueprint.filePrefix || "Rep Attendance"} - Month Year.xlsx, clean the plan rows, and populate it from ${plan.masterName || "the saved SmartSell source"}. Automatic creation is set for the ${scheduleDayText} at ${blueprint.time || "05:45"}.`
      : "Ask an admin to save the current Monthly Attendance workbook once. After that, users can create the new month from this screen.");
  const workbookUrl = blueprint.lastRun?.webUrl || plan.targetUrl || "";
  if (openLink) {
    openLink.hidden = !workbookUrl;
    openLink.href = workbookUrl || "#";
    openLink.textContent = blueprint.lastRun?.webUrl ? `Open ${blueprint.lastRun.fileName || "new monthly workbook"}` : "Open current monthly workbook";
  }
}

function operationsMonthlyPlanPayload(options = {}) {
  const savedPlan = state.operationsWorkspace?.smartSell?.monthlyPlan || {};
  const typedMasterUrl = document.querySelector("#operationsMonthlyPlanMasterUrl").value.trim();
  const typedTargetUrl = document.querySelector("#operationsMonthlyPlanTargetUrl").value.trim();
  const targetUrl = options.requireTypedTarget ? typedTargetUrl : (typedTargetUrl || savedPlan.targetUrl || "");
  if (!targetUrl) throw new Error("Paste the Monthly Plan workbook link before populating the plan.");
  return {
    masterUrl: typedMasterUrl || savedPlan.masterUrl || "",
    targetUrl,
    enabled: document.querySelector("#operationsMonthlyPlanEnabled").checked,
    time: document.querySelector("#operationsMonthlyPlanTime").value || "06:00"
  };
}

function clearOperationsMonthlyPlanTargetDraft() {
  const targetInput = document.querySelector("#operationsMonthlyPlanTargetUrl");
  if (!targetInput) return;
  targetInput.value = "";
  delete targetInput.dataset.userEdited;
}

async function saveOperationsMonthlyPlanSetup() {
  const button = document.querySelector("#operationsSaveMonthlyPlan");
  const status = document.querySelector("#operationsMonthlyBlueprintStatus");
  button.disabled = true;
  try {
    status.textContent = "Validating the SmartSell Plan source and Monthly Plan workbook...";
    const result = await callFunction("saveSalesforceMonthlyAttendancePlanSetup", operationsMonthlyPlanPayload({ requireTypedTarget: true }));
    const setup = result.monthlyPlanSetup || {};
    status.textContent = `${setup.master?.name || "SmartSell source"} and ${setup.target?.name || "Monthly Plan workbook"} are verified. ${setup.schedule?.enabled ? `Nexus will populate it on the 1st at ${setup.schedule.time}.` : "The links are saved for manual population."}`;
    showToast("Monthly Plan links saved.");
    clearOperationsMonthlyPlanTargetDraft();
    await loadOperationsWorkspace();
  } catch (error) {
    status.textContent = friendlyError(error);
    showToast(friendlyError(error), true);
  } finally {
    button.disabled = false;
  }
}

async function runOperationsMonthlyPlanSetup() {
  const button = document.querySelector("#operationsRunMonthlyPlanSetup");
  const status = document.querySelector("#operationsMonthlyBlueprintStatus");
  button.disabled = true;
  try {
    status.textContent = "Saving the selected Monthly Plan links before queueing the population...";
    await callFunction("saveSalesforceMonthlyAttendancePlanSetup", operationsMonthlyPlanPayload({ requireTypedTarget: true }));
    status.textContent = "Queueing Monthly Plan population from the selected SmartSell source...";
    const result = await callFunction("runSalesforceMonthlyAttendancePlanSetup", {});
    status.textContent = `Monthly Plan population queued for ${result.reportMonth}-01. The run log will show the verified row count and SharePoint version.`;
    showToast("Monthly Plan population queued.");
    clearOperationsMonthlyPlanTargetDraft();
    await loadOperationsWorkspace();
  } catch (error) {
    status.textContent = friendlyError(error);
    showToast(friendlyError(error), true);
  } finally {
    button.disabled = false;
  }
}

async function saveOperationsMonthlyBlueprint(event) {
  event.preventDefault();
  const submit = event.submitter;
  const status = document.querySelector("#operationsMonthlyBlueprintStatus");
  submit.disabled = true;
  try {
    status.textContent = "Saving the monthly workbook lifecycle setup...";
    const result = await callFunction("saveSalesforceMonthlyAttendanceBlueprintProvisioning", {
      sourceMode: "current-monthly-plan",
      filePrefix: document.querySelector("#operationsMonthlyBlueprintPrefix").value.trim() || "Rep Attendance",
      enabled: document.querySelector("#operationsMonthlyBlueprintEnabled").checked,
      time: document.querySelector("#operationsMonthlyBlueprintTime").value || "05:45",
      dayOfMonth: document.querySelector("#operationsMonthlyBlueprintDay").value || "1"
    });
    const setup = result.monthlyBlueprintProvisioning || {};
    status.textContent = `Monthly setup saved. ${setup.schedule?.enabled ? `Nexus will create the new workbook on the ${setup.schedule.dayOfMonth === "last" ? "last day" : "1st day"} at ${setup.schedule.time}.` : "Automatic creation is off; use Create and populate monthly workbook now when needed."}`;
    showToast("Monthly setup saved.");
    clearOperationsMonthlyPlanTargetDraft();
    await loadOperationsWorkspace();
  } catch (error) {
    status.textContent = friendlyError(error);
    showToast(friendlyError(error), true);
  } finally {
    submit.disabled = false;
  }
}

async function createOperationsMonthlyBlueprint() {
  const button = document.querySelector("#operationsCreateMonthlyBlueprint");
  const status = document.querySelector("#operationsMonthlyBlueprintStatus");
  button.disabled = true;
  try {
    const result = await callFunction("createSalesforceMonthlyAttendanceBlueprint", {
      reportMonth: document.querySelector("#operationsMonthlyBlueprintMonth").value || ""
    });
    status.textContent = `Monthly workbook creation queued for ${result.reportMonth}-01. The Open workbook button will appear here after Nexus verifies and links the new file.`;
    showToast("Monthly workbook creation queued.");
    await loadOperationsWorkspace();
  } catch (error) {
    status.textContent = friendlyError(error);
    showToast(friendlyError(error), true);
  } finally {
    button.disabled = false;
  }
}

function renderOperationsWorkspace() {
  const workspace = state.operationsWorkspace;
  if (workspace && state.isAdmin && meridianEtlSession?.uid === auth?.currentUser?.uid) meridianEtlSession.updatePortal({ ...workspace, profiles: operationsProfiles(workspace) });
  renderReportDeliveries();
  const signedIn = state.isOperator === true && Boolean(workspace);
  elements.operationsLogin.hidden = signedIn;
  elements.operationsWorkspace.hidden = !signedIn;
  if (!signedIn) return;

  const account = workspace.account || {};
  const profiles = operationsProfiles(workspace);
  const previous = elements.operationsRetailer.value;
  elements.operationsRetailer.innerHTML = profiles.length
    ? profiles.map((profile) => `<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.name)}${profile.setupRequired ? " - Setup required" : ""}</option>`).join("")
    : `<option value="">No approved extraction profiles</option>`;
  if (profiles.some((profile) => profile.id === previous)) elements.operationsRetailer.value = previous;
  const profile = currentOperationsProfile();
  elements.operationsRetailerDetails.innerHTML = profile?.setupRequired
    ? `<div><span>Connection</span><strong>${escapeHtml(profile.connectionLabel)}</strong></div><div><span>Workflow</span><strong>Setup required</strong></div><div><span>Publication</span><strong>Off - no template update</strong></div><p>${escapeHtml(profile.extractionName)}.</p>`
    : profile
    ? `<div><span>Portal</span><strong>${escapeHtml(profile.portal || "Configured portal")}</strong></div><div><span>Workflow</span><strong>${escapeHtml(profile.extractionName || "Approved workflow")}</strong></div><div><span>Schedule</span><strong>${profile.scheduleEnabled ? "Configured" : "Manual only"}</strong></div>`
    : `<p>No extraction profile is approved for this account.</p>`;
  elements.operationsRunExtraction.disabled = !profile || profile.setupRequired === true || state.operationsRunPending === true;
  elements.operationsSessionName.textContent = [account.name, account.surname].filter(Boolean).join(" ") || account.email || "Operations";
  elements.operationsSessionCopy.textContent = account.role === "admin"
    ? "Admin access: operations, schedules, profiles, users and audit logs."
    : "Normal access: run and schedule approved jobs, update a permitted SmartSell Master and week, respond to your portal verification prompts, and stop your own jobs.";
  renderOperationsSmartSellMaster(workspace);
  renderOperationsMonthlyBlueprint(workspace);
  renderOperationsManualRunControls(profile);
  renderOperationsSchedule(profile, account);

  const allRuns = workspace.runs || [];
  // Never let another operator's job take over this user's interactive status
  // panel. Admin can monitor everyone else in the dedicated Admin Jobs view.
  const runs = allRuns.filter(operationRunBelongsToCurrentUser);
  const active = runs.find(isActiveOperationRun);
  const tracked = active || runs.find((run) => run.id && run.id === state.activeExtractionRunId) || null;
  if (tracked) renderExtractionRun(tracked, { passive: true });
  else if (state.activeExtractionRunId) renderExtractionRun(null, { passive: true });
  const activeStatus = active ? runStatus(active) : { className: "ready", label: "Ready" };
  elements.operationsRunOrb.className = `run-status-orb ${active ? (activeStatus.className === "running" ? "running" : activeStatus.className) : "ready"}`;
  elements.operationsRunHistory.innerHTML = groupedRunHistoryMarkup(runs, {
    lifetime: workspace.historyScope === "lifetime",
    admin: account.role === "admin",
    emptyMessage: "No jobs have been run from this account."
  });
  elements.operationsRunSummary.textContent = `${runs.length} job${runs.length === 1 ? "" : "s"}`;
  const selectedOperationsRun = runs.find((run) => run.id === state.operationsRunDetail?.id) || null;
  renderOperationsRunDetail(mergeRunDetail(selectedOperationsRun, state.operationsRunDetail));
  const permissions = account.permissions || {};
  const permittedMenus = account.role === "admin"
    ? "All workspaces"
    : normalUserNavigationIds(permissions).map((id) => NAVIGATION_OPTIONS[id]).join(", ") || "No workspace access";
  const permissionRows = [
    ["Side-menu workspaces", permittedMenus],
    ["Run approved jobs", permissions.runJobs === true],
    ["Permitted profiles", Array.isArray(permissions.allowedRetailerIds) && permissions.allowedRetailerIds.length ? `${permissions.allowedRetailerIds.length} assigned` : "All approved"],
    ["Respond to your portal verification", true],
    ["Stop your own job", true],
    ["Manage schedules", permissions.manageSchedules === true],
    ["Update SmartSell Master", permissions.manageSmartSellMaster === true],
    ["Manage profiles and credentials", permissions.manageAutomation === true],
    ["View organisation audit logs", permissions.viewAllAudit === true]
  ];
  elements.operationsPermissionList.innerHTML = permissionRows.map(([label, allowed]) => {
    const granted = allowed === true || typeof allowed === "string";
    return `<article class="operation-row"><span class="operation-indicator ${granted ? "good" : "muted"}"></span><div><strong>${escapeHtml(label)}</strong><small>${typeof allowed === "string" ? escapeHtml(allowed) : granted ? "Allowed" : "Restricted"}</small></div></article>`;
  }).join("");

  const audit = workspace.audit || [];
  const canViewAudit = account.permissions?.viewAllAudit === true;
  elements.operationsAuditPanel.hidden = !canViewAudit;
  if (canViewAudit) {
    elements.operationsAuditHistory.innerHTML = audit.slice(0, 20).map((entry) => {
      const actor = entry.actorEmail || entry.actorName || "System";
      const event = String(entry.event || "activity").replace(/[-_]+/g, " ");
      return `<article class="operation-row"><span class="operation-indicator muted"></span><div><strong>${escapeHtml(event)}</strong><small>${escapeHtml(actor)} - ${escapeHtml(formatDate(entry.createdAt))}${entry.message ? ` - ${escapeHtml(entry.message)}` : ""}</small></div><span class="row-status muted">${escapeHtml(entry.result || "logged")}</span></article>`;
    }).join("") || `<p class="history-empty">No audit events recorded.</p>`;
  }

  const alerts = account.role === "admin"
    ? (workspace.alerts || []).filter((alert) => !alert.resolvedAt && alert.status !== "resolved")
    : [];
  if (elements.operationsAlertsPanel) elements.operationsAlertsPanel.hidden = account.role !== "admin";
  if (account.role === "admin") {
    elements.operationsAlertsCount.textContent = `${alerts.length} alert${alerts.length === 1 ? "" : "s"}`;
    elements.operationsAlertsList.innerHTML = alerts.map((alert) => {
      const severity = String(alert.severity || "warning").toLowerCase() === "critical" ? "failed" : "no-data";
      const retry = ["failed", "no-data", "incomplete-delivery"].includes(String(alert.type || ""))
        ? `<button class="text-action" type="button" data-retry-failed="${escapeHtml(alert.runId)}">Retry failed step</button>`
        : `<button class="text-action" type="button" data-alert-view="${escapeHtml(alert.runId)}">View job</button>`;
      return `<article class="operation-row"><span class="operation-indicator ${severity}"></span><div><strong>${escapeHtml(alert.title || "Automation alert")}</strong><small>${escapeHtml(alert.retailerName || "Extraction profile")} - ${escapeHtml(alert.message || "Review the job log.")}</small></div><div class="operation-row-actions">${retry}<span class="row-status ${severity}">${escapeHtml(alert.severity || "warning")}</span></div></article>`;
    }).join("") || `<p class="history-empty">No active reliability alerts.</p>`;
  }

  const prompts = workspace.prompts || [];
  syncAutomationPromptModal(prompts);
  elements.operationsPromptPanel.hidden = !prompts.length;
  elements.operationsPromptList.innerHTML = prompts.map((prompt) => {
    const approvalOnly = prompt.inputRequired === false;
    const owner = runs.find((run) => run.id === prompt.runId);
    const ownerLabel = owner ? operationRunOwnerLabel(owner) : "Current operator";
    const action = approvalOnly
      ? `<button class="primary-action" type="button" data-operations-prompt-approve="${escapeHtml(prompt.id)}">Approval completed</button>`
      : `<label><span>Verification code</span><input name="verificationCode" inputmode="numeric" autocomplete="one-time-code" maxlength="80" required /></label><button class="primary-action" type="submit">Continue</button>`;
    return `<article class="operation-prompt-card"><div><strong>${escapeHtml(prompt.retailerName || "Extraction report")}</strong><small>${escapeHtml(ownerLabel)} - ${escapeHtml(prompt.message || "The portal requires verification before this job can continue.")}</small></div><form data-operations-prompt-form="${escapeHtml(prompt.id)}">${action}<button class="danger-button" type="button" data-operations-prompt-abort="${escapeHtml(prompt.runId)}">Abort job</button></form></article>`;
  }).join("");
}

async function loadOperationsWorkspace({ quiet = false } = {}) {
  if (state.userRole === "client") return;
  if (!state.isOperator || !cloudFunctions) {
    state.operationsWorkspace = null;
    renderOperationsWorkspace();
    return;
  }
  const generation = nexusSessionGeneration;
  try {
    const workspace = await callFunction("getOperationsWorkspace", {});
    if (generation !== nexusSessionGeneration) return;
    state.operationsWorkspace = workspace;
    renderOperationsWorkspace();
    syncNexusNavigationAccess();
    if (window.location.hash === "#attendance" && !operatorCanAccessGeoAttendance()) setViewFromHash();
  } catch (error) {
    if (!quiet) showToast(`Could not load Operations: ${friendlyError(error)}`, true);
  }
}

async function loadAdminJobHistory({ quiet = false } = {}) {
  if (!state.isAdmin || !cloudFunctions) return;
  const generation = nexusSessionGeneration;
  try {
    const result = await callFunction("getAdminExtractionRunHistory", { limit: 1000 });
    if (generation !== nexusSessionGeneration) return;
    state.adminJobRuns = Array.isArray(result?.runs) ? result.runs : [];
    state.adminJobHistoryLoaded = true;
    state.adminJobHistoryError = "";
    // Browsers can restore a prior owner selection after a hard refresh. The
    // first Admin audit load must always begin with the organisation view.
    if (!state.adminJobFiltersInitialised) {
      elements.adminJobSearch.value = "";
      elements.adminJobStatus.value = "";
      elements.adminJobOwner.value = "";
      state.adminJobFiltersInitialised = true;
    }
    renderAdminJobs();
  } catch (error) {
    state.adminJobHistoryLoaded = false;
    state.adminJobHistoryError = friendlyError(error);
    renderAdminJobs();
    if (!quiet) showToast(`Could not load organisation job logs: ${friendlyError(error)}`, true);
  }
}

function stopOperationsRefresh() {
  if (operationsRefreshTimer) window.clearInterval(operationsRefreshTimer);
  operationsRefreshTimer = null;
}

function startOperationsRefresh() {
  stopOperationsRefresh();
  operationsRefreshTimer = window.setInterval(() => loadOperationsWorkspace({ quiet: true }), 12000);
}

let nexusSessionGeneration = 0;
let legacyAdminSubscriptions = [];
let legacyAdminGeneration = 0;

function stopLegacyAdminData() {
  legacyAdminGeneration++;
  legacyAdminSubscriptions.splice(0).forEach((stop) => stop());
  state.files = [];
  state.dashboardClients = [];
  state.dashboardUploads = [];
  renderFiles();
  renderClientOptions();
  renderAdminHistory();
}

function subscribeLegacyAdminData() {
  if (!state.isAdmin || !auth?.currentUser) return;
  const generation = legacyAdminGeneration;
  const listen = (name, next, error) => {
    legacyAdminSubscriptions.push(database.collection(name).onSnapshot(
      (snapshot) => { if (generation === legacyAdminGeneration) next(snapshot); },
      (failure) => { if (generation === legacyAdminGeneration) error(failure); }
    ));
  };
  listen("files", (snapshot) => {
    state.files = snapshot.docs.map((document) => ({ id: document.id, ...document.data() })).sort(sortFilesNewestFirst);
    renderFiles();
    renderOperations();
  }, (error) => showToast(`Could not load files: ${friendlyError(error)}`, true));
  listen("dashboardClients", (snapshot) => {
    state.dashboardClients = snapshot.docs.map((document) => ({ id: document.id, ...document.data() })).sort((a, b) => String(a.clientName).localeCompare(String(b.clientName)));
    renderClientOptions();
  }, (error) => {
    elements.dataStatus.className = "data-status empty";
    elements.dataStatus.querySelector("strong").textContent = "Dashboard data unavailable";
    elements.dataStatusCopy.textContent = friendlyError(error);
  });
  listen("dashboardUploads", (snapshot) => {
    state.dashboardUploads = snapshot.docs.map((document) => ({ id: document.id, ...document.data() })).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    renderAdminHistory();
  }, (error) => showToast(`Could not load dashboard uploads: ${friendlyError(error)}`, true));
}

async function configureAdminSession(user) {
  stopRetailerProfiles();
  window.NexusJobStatus?.identity(null);
  const generation = ++nexusSessionGeneration;
  nexusReadCache.clear();
  state.isOperator = false;
  state.userRole = "";
  state.operationsWorkspace = null;
  state.portalResourcesLoaded = false;
  state.portalResourcesLoading = false;
  state.stockFixDashboardLoading = false;
  state.salesforceAttendanceDashboardLoading = false;
  state.callCycleLoading = false;
  state.attendanceDashboardLoading = false;
  state.trainingHubLoading = false;
  state.portalResources = [];
  state.stockFixDashboardData = null;
  state.salesforceAttendanceDashboardData = null;
  state.callCycleSyndicatedData = null;
  state.trainingHubData = null;
  const insightsFrame = salesInsightsSourceFrame();
  if (insightsFrame) { insightsFrame.src = "about:blank"; delete insightsFrame.dataset.nexusLoaded; }
  state.stockFixDashboardData = {};
  renderStockFixDashboard();
  state.stockFixDashboardData = null;
  renderPortalResources();
  renderTrainingHub(null);
  renderAttendanceDashboard(null);
  renderDedicatedAttendanceDashboard(null);
  renderCallCycleDashboard(null);
  stopLegacyAdminData();
  state.isAdmin = false;
  if (meridianChatSession && meridianChatSession.uid !== user?.uid) { meridianChatSession.stop(); meridianChatSession = null; }
  state.authResolved = true;
  if (!user) {
    stopOperationsRefresh();
    stopOwnerPromptSubscription({ resetPrompt: true });
    auditedSessionUid = "";
    clearAdminSubscriptions();
    state.isOperator = false;
    state.userRole = "";
    state.operationsWorkspace = null;
    renderOperationsWorkspace();
    elements.adminLogin.hidden = true;
    elements.operationsLogin.hidden = true;
    elements.adminWorkspace.hidden = true;
    elements.nexusAccountDialog?.close();
    syncNexusNavigationAccess();
    return;
  }
  const token = await user.getIdTokenResult(true);
  if (generation !== nexusSessionGeneration) return;
  const email = String(token.claims.email || user.email || "").trim().toLowerCase();
  const role = token.claims.admin === true && token.claims.chatClient !== true && token.claims.nexusRole !== "client"
    ? "admin"
    : (token.claims.chatClient === true && token.claims.nexusRole === "client" ? "client" : token.claims.operator === true || token.claims.nexusRole === "normal" ? "normal" : "");
  if (!role || role === "client") {
    await auth.signOut();
    showToast(role === "client" ? "Meridian Chat is currently available to staff only." : "This account is not authorised for Nexus Operations.", true);
    return;
  }
  state.isOperator = true;
  state.userRole = role;
  state.isAdmin = role === "admin";
  window.NexusJobStatus?.identity(user.uid);
  if (auditedSessionUid !== user.uid) {
    auditedSessionUid = user.uid;
    callFunction("recordNexusLogin", {}).catch(() => {});
  }
  if (state.isAdmin) {
    renderFilesRunRetailerDetails();
    elements.adminLogin.hidden = true;
    elements.operationsLogin.hidden = true;
    elements.adminWorkspace.hidden = false;
    elements.adminSessionName.textContent = user.displayName || user.email;
    subscribeAdminData();
    subscribeLegacyAdminData();
    loadAdminJobHistory({ quiet: true });
  } else {
    clearAdminSubscriptions();
    state.isOperator = true;
    state.userRole = role;
    elements.adminLogin.hidden = true;
    elements.operationsLogin.hidden = true;
    elements.adminWorkspace.hidden = true;
    if (!["#automation", "#chat", "#support", "#franchiseorder", "#attendance-jobs"].includes(window.location.hash)) window.location.hash = "automation";
  }
  subscribeOwnerPrompts(user.uid);
  elements.nexusLoginDialog?.close();
  elements.nexusAccountEmail.textContent = user.email || "your Nexus account";
  elements.nexusLoginPassword.value = "";
  await loadOperationsWorkspace();
  if (generation !== nexusSessionGeneration) return;
  syncNexusNavigationAccess();
  syncMeridianChat();
  startOperationsRefresh();
  if (window.location.hash === "#sales") loadSalesDashboard();
  if (window.location.hash === "#insights") {
    const frame = salesInsightsSourceFrame();
    if (!frame || frame.getAttribute("src") === "about:blank") loadSalesInsights();
  }
  if (window.location.hash === "#attendance") loadAttendanceDashboard();
  if (window.location.hash === "#stockfix") loadStockFixDashboard();
}

function initialiseFirebase() {
  try {
    database = firebase.firestore();
    // Bound idle reads on networks that close long-lived Firestore streams.
    // This does not bypass browser blockers or control the browser's QUIC transport.
    database.settings({
      experimentalForceLongPolling: true,
      experimentalAutoDetectLongPolling: false,
      experimentalLongPollingOptions: { timeoutSeconds: 25 },
      useFetchStreams: false,
      merge: true,
    });
    storage = firebase.storage();
    auth = firebase.auth();
    cloudFunctions = firebase.app().functions(window.location.origin + "/nexus/__fn");
    auth.onAuthStateChanged((user) => configureAdminSession(user).catch((error) => showToast(friendlyError(error), true)));
    storage.setMaxUploadRetryTime(24 * 60 * 60 * 1000);
    storage.setMaxOperationRetryTime(10 * 60 * 1000);
  } catch (error) {
    elements.fileSummary.textContent = "Storage unavailable";
    showToast("Firebase could not be initialised.", true);
  }
}

function setWorkspaceTreeBranch(toggle, expanded) {
  const branchId = toggle?.getAttribute("aria-controls");
  const branch = branchId ? document.getElementById(branchId) : null;
  if (!branch) return;
  branch.hidden = !expanded;
  toggle.setAttribute("aria-expanded", String(expanded));
  if (!expanded) {
    branch.querySelectorAll("[data-tree-toggle]").forEach((childToggle) => setWorkspaceTreeBranch(childToggle, false));
  }
}

function scrollNavigationItemToTop(button) {
  const signature = ["openView", "attendanceProductLink", "attendanceSource", "attendanceAudience", "attendancePage", "attendanceJobs", "callcycleSource", "callcyclePage", "insightsPage", "franchisePage"];
  const matchingButton = [...document.querySelectorAll(".nexus-home-nav [data-open-view], .nexus-workspace-nav [data-open-view]")].find((candidate) => (
    candidate.offsetParent !== null && signature.every((key) => (candidate.dataset[key] || "") === (button.dataset[key] || ""))
  ));
  const target = matchingButton || button;
  const sidebar = target.closest(".nexus-workspace-sidebar, .nexus-home-sidebar");
  if (!sidebar) return;
  const sidebarBox = sidebar.getBoundingClientRect();
  const buttonBox = target.getBoundingClientRect();
  const top = sidebar.scrollTop + buttonBox.top - sidebarBox.top - 10;
  sidebar.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

function ensureWorkspaceNavigation() {
  document.querySelectorAll('.nexus-home-nav [data-open-view="sales"], .nexus-workspace-nav [data-open-view="sales"], .nexus-home-nav [data-open-view="adoption"], .nexus-workspace-nav [data-open-view="adoption"]').forEach((button) => button.remove());
  document.querySelectorAll('[data-open-view="attendance"] span').forEach((label) => {
    label.textContent = "Time & Attendance";
  });
  const items = [
    { view: "support", markup: `<i class="ph ph-lifebuoy" aria-hidden="true"></i><span>Support</span>` },
    { view: "etls", markup: `<i class="ph ph-flow-arrow" aria-hidden="true"></i><span>ETLs</span>` },
    { view: "franchiseorder", markup: `<i class="ph ph-shopping-cart" aria-hidden="true"></i><span>Franchise orders</span>` },
    { view: "chat", markup: `<i class="ph ph-chats-circle" aria-hidden="true"></i><span>Meridian Chat</span>` },
    {
      view: "attendance", product: "callcycle",
      markup: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 3-6.24"></path><path d="M4 4v5h5"></path><path d="M12 8v4l3 2"></path></svg><span>Call Cycle</span>`
    },
    {
      view: "training",
      markup: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3Z"></path><path d="M5 4v16a3 3 0 0 1 3-3h11"></path><path d="m11 11 2 2 4-4"></path></svg><span>Training hub</span>`
    },
    {
      view: "insights",
      markup: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h16M7 16v-5m5 5V7m5 9v-8"></path><path d="m16 6 2 2 3-4"></path></svg><span>Insights</span>`
    },
    {
      view: "stockfix",
      markup: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M6 7v12h12V7M9 11h6M9 15h4"></path><path d="m17 4 3 3-3 3"></path></svg><span>Stock Fix</span>`
    },
    {
      view: "resources",
      markup: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M6 7v12h12V7M9 11h6M9 15h4"></path><path d="M12 3v8m0 0 3-3m-3 3-3-3"></path></svg><span>Resources</span>`
    },
  ];
  document.querySelectorAll(".nexus-home-nav, .nexus-workspace-nav").forEach((nav, navIndex) => {
    const automation = nav.querySelector('[data-open-view="automation"]');
    const attendance = nav.querySelector('[data-open-view="attendance"]:not([data-attendance-product-link]):not([data-attendance-source])');
    let attendanceSubmenu = nav.querySelector(".nexus-attendance-submenu");
    if (attendance && !attendanceSubmenu) {
      attendanceSubmenu = document.createElement("div");
      attendanceSubmenu.className = "nexus-attendance-submenu";
      attendanceSubmenu.innerHTML = `<section class="nexus-attendance-source-group"><button class="nexus-attendance-source" data-tree-toggle="dedicated-attendance" data-open-view="attendance" data-attendance-source="salesforce" type="button"><span>Dedicated attendance</span></button><div class="nexus-attendance-leaf-menu"><button class="nexus-attendance-page-link" data-open-view="attendance" data-attendance-source="salesforce" data-attendance-page="daily" type="button"><span>Daily Visits</span></button><button class="nexus-attendance-page-link" data-open-view="attendance" data-attendance-source="salesforce" data-attendance-page="overview" type="button"><span>MTD Overview</span></button><button class="nexus-attendance-page-link" data-open-view="attendance" data-attendance-source="salesforce" data-attendance-page="users" type="button"><span>Rep Roster</span></button><button class="nexus-attendance-page-link" data-open-view="attendance" data-attendance-source="salesforce" data-attendance-page="stores" type="button"><span>Attendance by Store</span></button></div></section><section class="nexus-attendance-source-group"><button class="nexus-attendance-source active" data-tree-toggle="syndicated-attendance" data-open-view="attendance" data-attendance-source="geo" type="button"><span>Syndicated attendance</span></button><div class="nexus-attendance-leaf-menu"><button class="nexus-attendance-audience-link" data-open-view="attendance" data-attendance-source="geo" data-attendance-audience="rep" type="button"><span>Reps</span></button><button class="nexus-attendance-audience-link" data-open-view="attendance" data-attendance-source="geo" data-attendance-audience="merchandiser" type="button"><span>Merchandisers</span></button><button class="nexus-attendance-page-link" data-open-view="attendance" data-attendance-source="geo" data-attendance-page="daily" type="button"><span>Daily Visits</span></button><button class="nexus-attendance-page-link active" data-open-view="attendance" data-attendance-source="geo" data-attendance-page="overview" type="button"><span>MTD Overview</span></button><button class="nexus-attendance-page-link" data-open-view="attendance" data-attendance-source="geo" data-attendance-page="users" type="button"><span>Rep Roster</span></button><button class="nexus-attendance-page-link" data-open-view="attendance" data-attendance-source="geo" data-attendance-page="stores" type="button"><span>Attendance by Store</span></button></div></section>`;
      attendance.insertAdjacentElement("afterend", attendanceSubmenu);
    }
    if (attendance && attendanceSubmenu) {
      if (!attendanceSubmenu.querySelector("[data-attendance-jobs]")) {
        const jobs = document.createElement("button");
        jobs.type = "button";
        jobs.className = "nexus-attendance-source";
        jobs.dataset.openView = "attendance";
        jobs.dataset.attendanceJobs = "true";
        jobs.innerHTML = '<i class="ph ph-list-checks" aria-hidden="true"></i><span>Job Summaries</span>';
        attendanceSubmenu.append(jobs);
      }
      const branchId = `nexus-attendance-tree-${navIndex}`;
      attendance.dataset.treeToggle = "attendance";
      attendance.setAttribute("aria-controls", branchId);
      attendanceSubmenu.id = branchId;
      attendanceSubmenu.dataset.treeBranch = "attendance";
      setWorkspaceTreeBranch(attendance, false);
      attendanceSubmenu.querySelectorAll(".nexus-attendance-source[data-tree-toggle]").forEach((source, sourceIndex) => {
        const leafMenu = source.nextElementSibling;
        const leafId = `${branchId}-source-${sourceIndex}`;
        leafMenu.id = leafId;
        source.setAttribute("aria-controls", leafId);
        setWorkspaceTreeBranch(source, false);
      });
    }
    items.forEach((item) => {
      const selector = item.product ? `[data-attendance-product-link="${item.product}"]` : `[data-open-view="${item.view}"]`;
      if (nav.querySelector(selector)) return;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.openView = item.view;
      if (item.product) button.dataset.attendanceProductLink = item.product;
      button.innerHTML = item.markup;
      const stockFix = nav.querySelector('[data-open-view="stockfix"]');
      if (item.product && attendanceSubmenu) attendanceSubmenu.insertAdjacentElement("afterend", button);
      else if (item.product && attendance) attendance.insertAdjacentElement("afterend", button);
      else if (item.view === "adoption" && stockFix) stockFix.insertAdjacentElement("afterend", button);
      else if (automation) nav.insertBefore(button, automation);
      else nav.append(button);
    });
    const callCycle = nav.querySelector('[data-attendance-product-link="callcycle"]');
    let callCycleSubmenu = nav.querySelector(".nexus-callcycle-submenu");
    if (callCycle && !callCycleSubmenu) {
      callCycleSubmenu = document.createElement("div");
      callCycleSubmenu.className = "nexus-callcycle-submenu";
      callCycleSubmenu.innerHTML = `<section class="nexus-callcycle-source-group"><button class="nexus-callcycle-source" data-tree-toggle="dedicated-callcycle" data-open-view="attendance" data-attendance-product-link="callcycle" data-callcycle-source="dedicated" type="button"><span>Dedicated Call Cycle</span></button><div class="nexus-callcycle-leaf-menu"><button data-open-view="attendance" data-attendance-product-link="callcycle" data-callcycle-source="dedicated" data-callcycle-page="overview" type="button"><span>Overview</span></button><button data-open-view="attendance" data-attendance-product-link="callcycle" data-callcycle-source="dedicated" data-callcycle-page="divisions" type="button"><span>Divisional coverage</span></button><button data-open-view="attendance" data-attendance-product-link="callcycle" data-callcycle-source="dedicated" data-callcycle-page="reps" type="button"><span>Reps</span></button><button data-open-view="attendance" data-attendance-product-link="callcycle" data-callcycle-source="dedicated" data-callcycle-page="stores" type="button"><span>Stores</span></button></div></section><section class="nexus-callcycle-source-group"><button class="nexus-callcycle-source" data-tree-toggle="syndicated-callcycle" data-open-view="attendance" data-attendance-product-link="callcycle" data-callcycle-source="syndicated" type="button"><span>Syndicated Call Cycle</span></button><div class="nexus-callcycle-leaf-menu"><button data-open-view="attendance" data-attendance-product-link="callcycle" data-callcycle-source="syndicated" data-callcycle-page="overview" type="button"><span>Overview</span></button><button data-open-view="attendance" data-attendance-product-link="callcycle" data-callcycle-source="syndicated" data-callcycle-page="divisions" type="button"><span>Divisional coverage</span></button><button data-open-view="attendance" data-attendance-product-link="callcycle" data-callcycle-source="syndicated" data-callcycle-page="reps" type="button"><span>Reps</span></button><button data-open-view="attendance" data-attendance-product-link="callcycle" data-callcycle-source="syndicated" data-callcycle-page="stores" type="button"><span>Stores</span></button></div></section>`;
      callCycle.insertAdjacentElement("afterend", callCycleSubmenu);
    }
    if (callCycle && callCycleSubmenu) {
      const branchId = `nexus-callcycle-tree-${navIndex}`;
      callCycle.dataset.treeToggle = "callcycle";
      callCycle.setAttribute("aria-controls", branchId);
      callCycleSubmenu.id = branchId;
      setWorkspaceTreeBranch(callCycle, false);
      callCycleSubmenu.querySelectorAll(".nexus-callcycle-source[data-tree-toggle]").forEach((source, sourceIndex) => {
        const leafMenu = source.nextElementSibling;
        const leafId = `${branchId}-source-${sourceIndex}`;
        leafMenu.id = leafId;
        source.setAttribute("aria-controls", leafId);
        setWorkspaceTreeBranch(source, false);
      });
    }
    const insights = nav.querySelector('[data-open-view="insights"]:not([data-insights-page])');
    let insightsSubmenu = nav.querySelector(".nexus-insights-submenu");
    if (insights && !insightsSubmenu) {
      insightsSubmenu = document.createElement("div");
      insightsSubmenu.className = "nexus-insights-submenu";
      insightsSubmenu.innerHTML = `<button data-open-view="insights" data-insights-page="overview" type="button"><span>Executive Overview</span></button><button data-open-view="insights" data-insights-page="trend" type="button"><span>Trend</span></button><button data-open-view="insights" data-insights-page="regions" type="button"><span>Regions</span></button><button data-open-view="insights" data-insights-page="brands" type="button"><span>Brands</span></button><button data-open-view="insights" data-insights-page="categories" type="button"><span>Categories</span></button><button data-open-view="insights" data-insights-page="products" type="button"><span>Products</span></button><button data-open-view="insights" data-insights-page="channels" type="button"><span>Channels</span></button><button data-open-view="insights" data-insights-page="pricemix" type="button"><span>Price &amp; Mix</span></button><button data-open-view="insights" data-insights-page="stores" type="button"><span>Stores</span></button>`;
      insights.insertAdjacentElement("afterend", insightsSubmenu);
    }
    if (insights && insightsSubmenu) {
      const branchId = `nexus-insights-tree-${navIndex}`;
      insights.dataset.treeToggle = "insights";
      insights.setAttribute("aria-controls", branchId);
      insightsSubmenu.id = branchId;
      insightsSubmenu.dataset.treeBranch = "insights";
      setWorkspaceTreeBranch(insights, false);
    }
    const franchise = nav.querySelector('[data-open-view="franchiseorder"]:not([data-franchise-page])');
    let franchiseSubmenu = nav.querySelector(".nexus-franchise-submenu");
    if (franchise && !franchiseSubmenu) {
      franchiseSubmenu = document.createElement("div");
      franchiseSubmenu.className = "nexus-insights-submenu nexus-franchise-submenu";
      franchiseSubmenu.innerHTML = Object.entries(window.FranchiseOrders?.pages || {}).map(([page, title]) => `<button data-open-view="franchiseorder" data-franchise-page="${page}" type="button"><span>${title}</span></button>`).join("");
      franchise.insertAdjacentElement("afterend", franchiseSubmenu);
      franchise.dataset.treeToggle = "franchiseorder";
      franchise.setAttribute("aria-controls", `nexus-franchise-tree-${navIndex}`);
      franchiseSubmenu.id = `nexus-franchise-tree-${navIndex}`;
      setWorkspaceTreeBranch(franchise, false);
    }
    const directButton = (view) => [...nav.children].find((child) => child.dataset?.openView === view);
    const workspaceLabel = [...nav.children].find((child) => child.tagName === "P");
    const orderedNodes = [
      directButton("home"), workspaceLabel, insights, insightsSubmenu, franchise, franchiseSubmenu, attendance, attendanceSubmenu,
      callCycle, callCycleSubmenu, directButton("training"), directButton("stockfix"), directButton("chat"), directButton("resources"), directButton("etls"), automation, directButton("support"), directButton("admin")
    ].filter(Boolean);
    orderedNodes.forEach((node) => nav.append(node));
  });
}

ensureWorkspaceNavigation();
document.getElementById("supportNavToggle").addEventListener("click", event => {
  const open = event.currentTarget.getAttribute("aria-expanded") !== "true";
  event.currentTarget.setAttribute("aria-expanded", String(open));
  document.getElementById("supportPrimaryNav").classList.toggle("sp-nav-open", open);
});
document.getElementById("etlNavToggle").addEventListener("click", event => {
  const button = event.currentTarget;
  const open = button.getAttribute("aria-expanded") !== "true";
  button.setAttribute("aria-expanded", String(open));
  document.getElementById("etlPrimaryNav").classList.toggle("etl-nav-open", open);
});
document.getElementById("franchiseNavToggle").addEventListener("click", event => {
  const button = event.currentTarget;
  const open = button.getAttribute("aria-expanded") !== "true";
  button.setAttribute("aria-expanded", String(open));
  document.getElementById("franchisePrimaryNav").classList.toggle("fo-nav-open", open);
});

elements.adminClient.innerHTML = `${CLIENTS.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}<option value="__new">+ Add a new client</option>`;
elements.adminNav?.addEventListener("click", openAdminWorkspace);
elements.automationNav?.addEventListener("click", openAutomationWorkspace);
elements.openAdminReports?.addEventListener("click", () => {
  openAdminWorkspace();
  activateAdminTab("reports");
});
elements.openAdminAction?.addEventListener("click", openAdminWorkspace);
elements.closeAdminPage.addEventListener("click", closeAdminWorkspace);
document.querySelectorAll("[data-open-view]").forEach((button) => button.addEventListener("click", () => {
  if (button.id === "openAdminAction") return;
  if (button.dataset.treeToggle) {
    setWorkspaceTreeBranch(button, button.getAttribute("aria-expanded") !== "true");
  }
  const target = button.dataset.openView;
  if (target === "automation") openAutomationWorkspace();
  else if (target === "admin") openAdminWorkspace();
  else if (target === "resources") openResourcesWorkspace();
  else if (target === "support") { window.location.hash = "support"; setViewFromHash(); document.getElementById("supportPrimaryNav").classList.remove("sp-nav-open"); document.getElementById("supportNavToggle").setAttribute("aria-expanded", "false"); }
  else if (target === "chat") { window.location.hash = "chat"; setViewFromHash(); }
  else if (target === "franchiseorder") {
    if (button.dataset.franchisePage) franchiseOrderPage = button.dataset.franchisePage;
    window.location.hash = "franchiseorder";
    setViewFromHash();
    if (button.dataset.franchisePage && window.matchMedia("(max-width: 640px)").matches) {
      document.getElementById("franchisePrimaryNav").classList.remove("fo-nav-open");
      document.getElementById("franchiseNavToggle").setAttribute("aria-expanded", "false");
      document.querySelector("#franchiseOrderView .nexus-workspace-sidebar").scrollTop = 0;
    }
  }
  else if (target === "etls") { window.location.hash = "etls"; setViewFromHash(); }
  else if (target === "sales") openSalesDashboard();
  else if (target === "insights") {
    openSalesInsights();
    if (button.dataset.insightsPage) updateSalesInsightsPage(button.dataset.insightsPage);
  }
  else if (target === "training") openTrainingHub();
  else if (target === "attendance") {
    if (button.dataset.attendanceJobs) { window.location.hash = "attendance-jobs"; setViewFromHash(); }
    else if (button.dataset.attendanceProductLink === "callcycle") openCallCycleDashboard();
    else openAttendanceDashboard();
  }
  else if (target === "stockfix") openStockFixDashboard();
  else if (target === "adoption") openStockFixAdoption();
  else if (target === "home") {
    if (window.location.hash !== "#home") window.location.hash = "home";
    else setViewFromHash();
  }
  window.requestAnimationFrame(() => scrollNavigationItemToTop(button));
}));
elements.resourceRefresh?.addEventListener("click", () => loadPortalResources(true));
elements.newPortalResource?.addEventListener("click", () => {
  resetPortalResourceEditor();
  elements.resourceTitle?.focus();
});
[elements.resourceSearch, elements.resourceCategoryFilter, elements.resourceActiveFilter].forEach((input) => input?.addEventListener("input", renderPortalResources));
elements.resourceCategoryFilter?.addEventListener("change", renderPortalResources);
elements.resourceEditorForm?.addEventListener("submit", savePortalResource);
elements.resourceFile?.addEventListener("change", () => {
  const file = elements.resourceFile.files?.[0];
  if (file) elements.resourceFileHint.textContent = `${file.name} · ${formatBytes(file.size)}. Saving will create a new protected version.`;
});
elements.downloadPortalResource?.addEventListener("click", () => downloadPortalResource());
elements.deletePortalResource?.addEventListener("click", deletePortalResource);
elements.resourceRows?.addEventListener("click", (event) => {
  const download = event.target.closest("[data-resource-download]");
  const edit = event.target.closest("[data-resource-edit]");
  if (download) downloadPortalResource(download.dataset.resourceDownload);
  if (edit) editPortalResource(edit.dataset.resourceEdit);
});
elements.salesDashboardRefresh.addEventListener("click", loadSalesDashboard);
[elements.salesDashboardRegion, elements.salesDashboardRep, elements.salesDashboardManager, elements.salesDashboardStore, elements.salesDashboardSku, elements.salesDashboardProduct, elements.salesDashboardStatusFilter].forEach((select) => select.addEventListener("change", () => { closeSalesDrilldown(); loadSalesDashboard(); }));
elements.salesDashboardClearFilters.addEventListener("click", () => {
  [elements.salesDashboardRegion, elements.salesDashboardRep, elements.salesDashboardManager, elements.salesDashboardStore, elements.salesDashboardSku, elements.salesDashboardProduct, elements.salesDashboardStatusFilter].forEach((select) => { select.value = ""; });
  closeSalesDrilldown();
  loadSalesDashboard();
});
elements.insightsRefresh?.addEventListener("click", () => {
  loadSalesInsights();
});
[elements.insightsClient, elements.insightsWindow, elements.insightsCategory, elements.insightsBrand, elements.insightsChannel, elements.insightsRetailer, elements.insightsRegion, elements.insightsDivision, elements.insightsProduct].forEach((select) => select?.addEventListener("change", loadSalesInsights));
elements.insightsClearFilters?.addEventListener("click", () => {
  [elements.insightsClient, elements.insightsCategory, elements.insightsBrand, elements.insightsChannel, elements.insightsRetailer, elements.insightsRegion, elements.insightsDivision, elements.insightsProduct].forEach((select) => { if (select) select.value = ""; });
  if (elements.insightsWindow) elements.insightsWindow.value = "12";
  loadSalesInsights();
});
elements.insightsModulePages.forEach((button) => button.addEventListener("click", () => updateSalesInsightsPage(button.dataset.insightsPage)));
document.querySelector("#insightsDetailPage")?.addEventListener("click", (event) => {
  const region = event.target.closest("[data-insights-region]")?.dataset.insightsRegion;
  const brand = event.target.closest("[data-insights-pick]")?.dataset.insightsPick;
  const category = event.target.closest("[data-insights-category]")?.dataset.insightsCategory;
  const product = event.target.closest("[data-insights-product]")?.dataset.insightsProduct;
  const channel = event.target.closest("[data-insights-channel]")?.dataset.insightsChannel;
  const retailer = event.target.closest("[data-insights-retailer]")?.dataset.insightsRetailer;
  if (region && elements.insightsRegion) {
    elements.insightsRegion.value = region;
    loadSalesInsights();
  } else if (brand && elements.insightsBrand && state.insightsPage === "brands") {
    elements.insightsBrand.value = brand;
    loadSalesInsights();
  } else if (category && elements.insightsCategory) {
    elements.insightsCategory.value = category;
    loadSalesInsights();
  } else if (product && elements.insightsProduct) {
    elements.insightsProduct.value = product;
    loadSalesInsights();
  } else if (channel && elements.insightsChannel) {
    elements.insightsChannel.value = channel;
    loadSalesInsights();
  } else if (retailer && elements.insightsRetailer) {
    elements.insightsRetailer.value = retailer;
    loadSalesInsights();
  }
});
document.querySelector("#trainingRefresh")?.addEventListener("click", loadTrainingHub);
["#trainingModule", "#trainingRegion", "#trainingLearnerStatus"].forEach((selector) => document.querySelector(selector)?.addEventListener("change", () => renderTrainingHub(state.trainingHubData)));
document.querySelector("#trainingSearch")?.addEventListener("input", () => renderTrainingHub(state.trainingHubData));
document.querySelector("#trainingClearFilters")?.addEventListener("click", () => {
  ["#trainingModule", "#trainingRegion", "#trainingLearnerStatus", "#trainingSearch"].forEach((selector) => { const field = document.querySelector(selector); if (field) field.value = ""; });
  renderTrainingHub(state.trainingHubData);
});
document.querySelector("#trainingModules")?.addEventListener("click", (event) => {
  const moduleId = event.target.closest("[data-training-module]")?.dataset.trainingModule;
  const select = document.querySelector("#trainingModule");
  if (!moduleId || !select) return;
  select.value = moduleId;
  renderTrainingHub(state.trainingHubData);
});
elements.salesDashboardRegions.addEventListener("click", (event) => {
  const region = event.target.closest("[data-sales-region]")?.dataset.salesRegion;
  if (!region || region === elements.salesDashboardRegion.value) return;
  elements.salesDashboardRegion.value = region;
  closeSalesDrilldown();
  loadSalesDashboard();
});
elements.salesDashboardMetrics?.addEventListener("click", (event) => {
  const card = event.target.closest("[data-sales-drilldown]");
  if (card?.dataset.salesDrilldown) openSalesDrilldown(card.dataset.salesDrilldown);
});
elements.salesDrilldownClose?.addEventListener("click", closeSalesDrilldown);
elements.salesDrilldownDialog?.addEventListener("close", () => { state.salesDrilldownMetric = ""; state.salesDrilldownPage = 1; state.salesDrilldownData = null; });
elements.salesDrilldownPrevious?.addEventListener("click", () => { if (state.salesDrilldownMetric) openSalesDrilldown(state.salesDrilldownMetric, Math.max(1, state.salesDrilldownPage - 1)); });
elements.salesDrilldownNext?.addEventListener("click", () => { if (state.salesDrilldownMetric) openSalesDrilldown(state.salesDrilldownMetric, state.salesDrilldownPage + 1); });
elements.stockFixRefresh?.addEventListener("click", loadStockFixDashboard);
[elements.stockFixClient, elements.stockFixBanner, elements.stockFixRegion, elements.stockFixClassification, elements.stockFixResourceType, elements.stockFixActionStatus, elements.stockFixWeek].filter(Boolean).forEach((select) => select.addEventListener("change", loadStockFixDashboard));
elements.stockFixFirebasePublishForm?.addEventListener("submit", publishStockFixFirebaseWeek);
elements.stockFixPipelineRunForm?.addEventListener("submit", startStockFixPipelineRun);
elements.stockFixSharePointSyncNow?.addEventListener("click", syncStockFixSharePointSource);
elements.stockFixPipelineSources?.addEventListener("change", renderStockFixPipelineMappings);
elements.stockFixRosterForm?.addEventListener("submit", saveStockFixOperationalRoster);
elements.stockFixRosterList?.addEventListener("click", (event) => {
  const edit = event.target.closest("[data-stockfix-roster-edit]");
  if (!edit) return;
  const roster = (state.stockFixOperationalRoster || []).find((entry) => entry.uid === edit.dataset.stockfixRosterEdit);
  if (!roster) return;
  if (elements.stockFixRosterUser) elements.stockFixRosterUser.value = roster.uid;
  if (elements.stockFixRosterRepNames) elements.stockFixRosterRepNames.value = (roster.repNames || []).join("\n");
  elements.stockFixRosterRepNames?.focus();
});
elements.stockFixSearch?.addEventListener("input", () => {
  window.clearTimeout(stockFixSearchTimer);
  stockFixSearchTimer = window.setTimeout(loadStockFixDashboard, 450);
});
elements.stockFixFieldRefresh?.addEventListener("click", () => loadStockFixOperationalWorkspace());
[elements.stockFixFieldWeek, elements.stockFixFieldRep, elements.stockFixFieldStore, elements.stockFixFieldStatus].filter(Boolean).forEach((select) => select.addEventListener("change", () => {
  resetStockFixOperationalDetail();
  loadStockFixOperationalWorkspace();
}));
elements.stockFixFieldSearch?.addEventListener("input", () => {
  window.clearTimeout(stockFixFieldSearchTimer);
  stockFixFieldSearchTimer = window.setTimeout(() => {
    resetStockFixOperationalDetail();
    loadStockFixOperationalWorkspace({ quiet: true });
  }, 300);
});
elements.stockFixFieldTaskList?.addEventListener("click", (event) => {
  const taskId = event.target.closest("[data-stockfix-field-task]")?.dataset.stockfixFieldTask;
  if (taskId) openStockFixOperationalTask(taskId);
});
elements.stockFixFieldBack?.addEventListener("click", resetStockFixOperationalDetail);
elements.stockFixFieldPhysicalCount?.addEventListener("input", updateStockFixOperationalVariance);
elements.stockFixFieldEvidence?.addEventListener("change", renderStockFixOperationalEvidencePreview);
elements.stockFixFieldCaptureForm?.addEventListener("submit", completeStockFixOperationalTask);
document.querySelectorAll("[data-stockfix-tab]").forEach((button) => button.addEventListener("click", () => activateStockFixTab(button.dataset.stockfixTab)));
elements.stockFixAdoptionPublishForm?.addEventListener("submit", publishStockFixAdoptionWorkbook);
[elements.stockFixAdoptionWeek, elements.stockFixAdoptionResourceType, elements.stockFixAdoptionRegion, elements.stockFixAdoptionManager].filter(Boolean).forEach((select) => select.addEventListener("change", loadStockFixAdoptionDashboard));
elements.stockFixAdoptionClear?.addEventListener("click", () => {
  [elements.stockFixAdoptionResourceType, elements.stockFixAdoptionRegion, elements.stockFixAdoptionManager].forEach((select) => { if (select) select.value = ""; });
  if (elements.stockFixAdoptionSearch) elements.stockFixAdoptionSearch.value = "";
  loadStockFixAdoptionDashboard();
});
elements.stockFixAdoptionSearch?.addEventListener("input", () => {
  window.clearTimeout(stockFixSearchTimer);
  stockFixSearchTimer = window.setTimeout(loadStockFixAdoptionDashboard, 350);
});
elements.attendanceDashboardRefresh?.addEventListener("click", () => {
  if (state.attendanceProduct === "callcycle") loadCallCycleDashboard();
  else loadAttendanceDashboard();
});
document.getElementById("attendanceJobSummaryRefresh").addEventListener("click", loadAttendanceJobSummaries);
document.getElementById("attendanceJobSummaryAssistant").addEventListener("click", () => { if (attendanceJobSummarySession) elements.nexusAssistantToggle?.click(); });
document.querySelectorAll("[data-job-summary-tab]").forEach(button => {
  button.addEventListener("click", () => setAttendanceJobSummaryTab(button.dataset.jobSummaryTab));
  button.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tab = event.key === "Home" ? "daily" : event.key === "End" ? "monthly" : attendanceJobSummaryTab === "daily" ? "monthly" : "daily";
    setAttendanceJobSummaryTab(tab);
    document.querySelector(`[data-job-summary-tab="${tab}"]`).focus();
  });
});
[elements.attendanceDashboardRole, elements.attendanceDashboardRegion, elements.attendanceDashboardManager].filter(Boolean).forEach((select) => select.addEventListener("change", () => {
  state.attendanceWorksheetPage = 1;
  loadAttendanceDashboard();
}));
elements.attendanceDashboardClearFilters?.addEventListener("click", () => {
  [elements.attendanceDashboardRole, elements.attendanceDashboardRegion, elements.attendanceDashboardManager].forEach((select) => { select.value = ""; });
  state.attendanceWorksheetPage = 1;
  loadAttendanceDashboard();
});
elements.attendanceDashboardView?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-salesforce-snapshot-load]");
  if (!button) return;
  loadSalesforceWorkbookSnapshotRows(button.dataset.salesforceSnapshotLoad, button.dataset.salesforceSnapshotTarget, Number(button.dataset.salesforceSnapshotOffset || 0));
});
document.querySelectorAll("[data-attendance-source]").forEach((button) => button.addEventListener("click", () => setAttendanceDashboardSource(button.dataset.attendanceSource)));
document.querySelectorAll("[data-attendance-product]").forEach((button) => button.addEventListener("click", () => setAttendanceProduct(button.dataset.attendanceProduct)));
document.querySelectorAll("[data-attendance-product-link]").forEach((button) => button.addEventListener("click", () => {
  window.setTimeout(() => setAttendanceProduct(button.dataset.attendanceProductLink), 0);
}));
document.querySelectorAll("[data-callcycle-source]").forEach((button) => button.addEventListener("click", () => {
  window.setTimeout(() => setCallCycleSource(button.dataset.callcycleSource), 0);
}));
document.querySelectorAll("[data-callcycle-page]").forEach((button) => button.addEventListener("click", () => {
  window.setTimeout(() => setCallCyclePage(button.dataset.callcyclePage), 0);
}));
document.querySelectorAll('[data-open-view="attendance"]:not([data-attendance-product-link]):not([data-attendance-source]):not([data-attendance-jobs])').forEach((button) => button.addEventListener("click", () => {
  window.setTimeout(() => setAttendanceProduct("attendance"), 0);
}));
document.querySelectorAll("[data-attendance-audience]").forEach((button) => button.addEventListener("click", () => setAttendanceAudience(button.dataset.attendanceAudience)));
document.querySelectorAll("[data-attendance-page]").forEach((button) => button.addEventListener("click", () => setAttendanceCoveragePage(button.dataset.attendancePage)));
elements.attendanceGeoOverview?.addEventListener("change", (event) => {
  const field = event.target?.dataset?.pgAttendanceFilter;
  if (!field) return;
  const controls = { role: elements.attendanceDashboardRole, region: elements.attendanceDashboardRegion, manager: elements.attendanceDashboardManager };
  if (controls[field]) controls[field].value = event.target.value;
  else state.attendanceDashboardExtraFilters = { ...(state.attendanceDashboardExtraFilters || {}), [field]: event.target.value };
  state.attendanceWorksheetPage = 1;
  loadAttendanceDashboard();
});
elements.attendanceGeoOverview?.addEventListener("click", (event) => {
  if (!event.target.closest("[data-pg-attendance-clear]")) return;
  [elements.attendanceDashboardRole, elements.attendanceDashboardRegion, elements.attendanceDashboardManager].forEach((select) => { if (select) select.value = ""; });
  state.attendanceDashboardExtraFilters = {};
  state.attendanceWorksheetPage = 1;
  loadAttendanceDashboard();
});
elements.attendanceRegionalFootprint?.addEventListener("load", () => publishAttendanceRegionalFootprint(state.attendanceDashboardData));
document.querySelector("#attendanceCallCyclePanel")?.addEventListener("change", (event) => {
  const field = event.target?.dataset?.dedicatedFilter;
  if (!field) return;
  dedicatedCallCycleFilters()[field] = event.target.value;
  renderCallCycleDashboard(state.salesforceAttendanceDashboardData);
});
document.querySelector("#attendanceCallCyclePanel")?.addEventListener("input", (event) => {
  if (!event.target?.matches("[data-dedicated-query]")) return;
  dedicatedCallCycleFilters().query = event.target.value;
  renderCallCycleDashboard(state.salesforceAttendanceDashboardData);
});
document.querySelector("#attendanceCallCyclePanel")?.addEventListener("click", (event) => {
  const rep = event.target?.closest("[data-callcycle-rep]");
  if (rep) {
    state.callCycleSelectedRep = rep.dataset.callcycleRep || "";
    renderCallCycleDashboard(state.salesforceAttendanceDashboardData);
    return;
  }
  if (event.target?.closest("[data-callcycle-rep-back]")) {
    state.callCycleSelectedRep = "";
    renderCallCycleDashboard(state.salesforceAttendanceDashboardData);
    return;
  }
  const sort = event.target?.closest("[data-callcycle-store-sort]");
  if (sort) {
    state.callCycleStoreSort = sort.dataset.callcycleStoreSort || "name";
    state.callCycleStorePage = 1;
    renderCallCycleDashboard(state.salesforceAttendanceDashboardData);
    return;
  }
  const storePage = event.target?.closest("[data-callcycle-store-page]");
  if (storePage && !storePage.disabled) {
    state.callCycleStorePage = Number(storePage.dataset.callcycleStorePage || 1);
    renderCallCycleDashboard(state.salesforceAttendanceDashboardData);
    return;
  }
  const toggle = event.target?.closest("[data-dedicated-toggle]");
  if (toggle) {
    const filters = dedicatedCallCycleFilters();
    const field = toggle.dataset.dedicatedToggle;
    filters[field] = !filters[field];
    renderCallCycleDashboard(state.salesforceAttendanceDashboardData);
    return;
  }
  if (!event.target?.closest("[data-dedicated-reset]")) return;
  if (!state.callCycleFilters) state.callCycleFilters = { dedicated: callCycleDefaultFilters(), syndicated: callCycleDefaultFilters() };
  state.callCycleFilters[state.callCycleSource] = callCycleDefaultFilters();
  renderCallCycleDashboard(state.salesforceAttendanceDashboardData);
});
document.querySelectorAll("[data-attendance-workbook-tab]").forEach((button) => button.addEventListener("click", () => setAttendanceWorkbookTab(button.dataset.attendanceWorkbookTab)));
elements.attendanceWorksheetPrevious?.addEventListener("click", () => loadAttendanceWorksheetView(Math.max(1, state.attendanceWorksheetPage - 1)));
elements.attendanceWorksheetNext?.addEventListener("click", () => loadAttendanceWorksheetView(state.attendanceWorksheetPage + 1));
elements.overviewSearch?.addEventListener("input", () => {
  const query = elements.overviewSearch.value.trim().toLowerCase();
  document.querySelectorAll("#overviewToolGrid .workspace-card").forEach((card) => {
    card.hidden = Boolean(query) && !card.textContent.toLowerCase().includes(query);
  });
});
document.querySelectorAll("[data-nexus-session]").forEach((button) => button.addEventListener("click", openNexusSession));
elements.nexusAssistantToggle?.addEventListener("click", openNexusAssistant);
elements.nexusAssistantClose?.addEventListener("click", () => elements.nexusAssistantDialog.close());
elements.nexusAssistantBack?.addEventListener("click", () => setNexusAssistantView(state.nexusAssistantView === "task" ? "response" : "ask"));
elements.nexusAssistantOpenTask?.addEventListener("click", prefillNexusAssistantTask);
elements.nexusAssistantCancelTask?.addEventListener("click", () => setNexusAssistantView("response"));
elements.nexusAssistantCreateTask?.addEventListener("click", async () => {
  const button = elements.nexusAssistantCreateTask;
  button.disabled = true;
  try {
    const result = await callFunction("createNexusAssistantTask", {
      title: elements.nexusAssistantTaskTitle?.value || "Follow up on AI insight",
      location: elements.nexusAssistantTaskLocation?.value || "",
      product: elements.nexusAssistantTaskProduct?.value || "",
      assignee: elements.nexusAssistantTaskAssignee?.value || "",
      due: elements.nexusAssistantTaskDue?.value || "",
      priority: elements.nexusAssistantTaskPriority?.value || "Medium",
      note: elements.nexusAssistantTaskNote?.value || "",
      sourcePrompt: state.nexusAssistantLastPrompt,
      sourceAnswer: state.nexusAssistantLastAnswer,
      sourceWorkspace: nexusAssistantWorkspaceName()
    });
    showToast(`AI task created${result?.id ? `: ${result.id}` : "."}`);
    setNexusAssistantView("response");
  } catch (error) {
    showToast(`Could not create AI task: ${friendlyError(error)}`, true);
  } finally {
    button.disabled = false;
  }
});
elements.nexusAssistantForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const question = elements.nexusAssistantQuestion.value.trim();
  if (!question) return;
  elements.nexusAssistantQuestion.value = "";
  await askNexusAssistant(question);
});
document.addEventListener("click", (event) => {
  const clickTarget = event.target instanceof Element ? event.target : event.target?.parentElement;
  const promptButton = clickTarget?.closest("[data-assistant-prompt]");
  if (promptButton) {
    elements.nexusAssistantQuestion.value = promptButton.dataset.assistantPrompt || "";
    elements.nexusAssistantQuestion.focus();
    if (state.nexusAssistantView === "task") setNexusAssistantView("response");
    return;
  }
  const promptTab = clickTarget?.closest("[data-assistant-prompt-tab]");
  if (promptTab) {
    state.nexusAssistantPromptTab = promptTab.dataset.assistantPromptTab || "saved";
    renderNexusAssistantPromptList();
  }
});
elements.nexusLoginClose.addEventListener("click", () => elements.nexusLoginDialog.close());
elements.nexusLoginForm.addEventListener("submit", async (event) => { event.preventDefault(); try { setNexusLoginStatus(""); await auth.signInWithEmailAndPassword(elements.nexusLoginEmail.value.trim(), elements.nexusLoginPassword.value); } catch (error) { setNexusLoginStatus(`Sign in failed: ${friendlyError(error)}`, true); } });
elements.nexusForgotPassword.addEventListener("click", async () => {
  const email = elements.nexusLoginEmail.value.trim();
  if (!email) {
    elements.nexusLoginEmail.focus();
    setNexusLoginStatus("Enter your Nexus email address first.", true);
    return;
  }
  elements.nexusForgotPassword.disabled = true;
  setNexusLoginStatus("Sending password reset email...");
  try {
    // Use Firebase's approved action handler. The canonical Hosting domain is
    // not an Auth continue-domain yet, so forcing a return URL blocks resets.
    await auth.sendPasswordResetEmail(email);
    setNexusLoginStatus(`Reset email sent to ${email}. Check your inbox and spam folder.`);
  } catch (error) {
    setNexusLoginStatus(`Could not send reset email: ${friendlyError(error)}`, true);
  } finally {
    elements.nexusForgotPassword.disabled = false;
  }
});
elements.nexusAccountClose.addEventListener("click", () => elements.nexusAccountDialog.close());
elements.nexusAccountSignOut.addEventListener("click", async () => {
  elements.nexusAccountDialog.close();
  await auth.signOut();
});
elements.nexusPasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const user = auth.currentUser;
  const currentPassword = elements.nexusCurrentPassword.value;
  const newPassword = elements.nexusNewPassword.value;
  const confirmPassword = elements.nexusConfirmPassword.value;
  if (!user?.email) {
    showToast("Sign in again before changing your password.", true);
    return;
  }
  if (newPassword.length < 8) {
    showToast("Use a new password with at least eight characters.", true);
    return;
  }
  if (newPassword !== confirmPassword) {
    showToast("The new passwords do not match.", true);
    return;
  }
  const submit = event.submitter;
  submit.disabled = true;
  try {
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
    await user.reauthenticateWithCredential(credential);
    await user.updatePassword(newPassword);
    elements.nexusPasswordForm.reset();
    elements.nexusAccountDialog.close();
    showToast("Password changed successfully.");
  } catch (error) {
    showToast(`Could not change password: ${friendlyError(error)}`, true);
  } finally {
    submit.disabled = false;
  }
});
elements.adminLoginForm.addEventListener("submit", async (event) => { event.preventDefault(); try { await auth.signInWithEmailAndPassword(elements.adminLoginEmail.value.trim(), elements.adminLoginPassword.value); elements.adminLoginPassword.value = ""; } catch (error) { showToast(`Sign in failed: ${friendlyError(error)}`, true); } });
elements.operationsLoginForm.addEventListener("submit", async (event) => { event.preventDefault(); try { await auth.signInWithEmailAndPassword(elements.operationsLoginEmail.value.trim(), elements.operationsLoginPassword.value); elements.operationsLoginPassword.value = ""; } catch (error) { showToast(`Sign in failed: ${friendlyError(error)}`, true); } });
elements.adminLogout.addEventListener("click", () => auth.signOut());
elements.operationsLogout.addEventListener("click", () => auth.signOut());
function activateAdminTab(tabName) {
  document.querySelectorAll("[data-admin-tab]").forEach((item) => {
    const active = item.dataset.adminTab === tabName;
    item.classList.toggle("active", active);
    item.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll("[data-admin-panel]").forEach((panel) => {
    const active = panel.dataset.adminPanel === tabName;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });
  if (tabName === "jobs" && state.isAdmin) loadAdminJobHistory({ quiet: true });
  if (tabName === "integration-inventory" && state.isAdmin) loadSharePointInventory({ quiet: true });
  syncAttendanceExclusions();
  syncMeridianSupport();
  if (tabName === "stockfix-ops" && state.isAdmin) {
    loadStockFixSharePointAutomationStatus({ quiet: true });
    loadStockFixFirebasePublishStatus({ quiet: true });
    loadStockFixOperationalRoster({ quiet: true });
  }
}
document.querySelectorAll("[data-admin-tab]").forEach((button) => button.addEventListener("click", () => activateAdminTab(button.dataset.adminTab)));
document.querySelectorAll("[data-open-admin-tab]").forEach((button) => button.addEventListener("click", () => activateAdminTab(button.dataset.openAdminTab)));
elements.newRetailer.addEventListener("click", resetRetailerForm);
elements.newExtractionProfile.addEventListener("click", resetExtractionProfileForm);
  elements.newGeoRepStoreMaster.addEventListener("click", resetGeoRepStoreMasterForm);
  elements.newGeoRepBlueprint.addEventListener("click", resetGeoRepBlueprintForm);
  elements.geoRepStoreMasterForm.addEventListener("submit", saveGeoRepStoreMaster);
  elements.salesStoreMasterForm.addEventListener("submit", saveGeoRepSalesStoreMaster);
  elements.setupGeoRepSalesDashboard.addEventListener("click", setupGeoRepSalesDashboard);
  elements.runGeoRepSalesApiImport.addEventListener("click", runGeoRepSalesApiImport);
  elements.geoRepOpenApiCredentialsForm.addEventListener("submit", saveGeoRepOpenApiCredentials);
  elements.geoRepOpenApiSettingsForm.addEventListener("submit", saveGeoRepOpenApiSyncSettings);
  elements.testGeoRepOpenApiConnection.addEventListener("click", testGeoRepOpenApiConnection);
  elements.runGeoRepOpenApiReferenceSync.addEventListener("click", runGeoRepOpenApiReferenceSync);
  elements.runGeoRepOpenApiFullSync.addEventListener("click", runGeoRepOpenApiFullSync);
  elements.refreshSharePointInventory?.addEventListener("click", () => loadSharePointInventory());
  elements.scanSharePointInventory?.addEventListener("click", scanSharePointInventory);
  elements.prepareLocalCodeContracts?.addEventListener("click", prepareLocalCodeContracts);
  elements.geoRepOpenApiEntityList.addEventListener("click", (event) => {
    const testButton = event.target.closest("[data-geo-api-test]");
    if (testButton) { testGeoRepOpenApiEntity(testButton.dataset.geoApiTest, testButton); return; }
    const syncButton = event.target.closest("[data-geo-api-sync]");
    if (syncButton) syncGeoRepOpenApiEntity(syncButton.dataset.geoApiSync, syncButton);
  });
  elements.geoRepAttendanceTrackerForm.addEventListener("submit", saveGeoRepAttendanceTracker);
  elements.geoRepAttendanceOperationalWeekForm.addEventListener("submit", saveGeoRepAttendanceOperationalWeek);
  elements.geoRepAttendanceScheduleForm?.addEventListener("submit", saveGeoRepAttendanceSchedule);
  elements.geoRepAttendanceStoreMasterForm.addEventListener("submit", saveGeoRepAttendanceStoreMaster);
  elements.rebuildGeoRepAttendanceStoreCoverage?.addEventListener("click", rebuildGeoRepAttendanceStoreCoverage);
  elements.geoRepFormIntakeForm.addEventListener("submit", saveGeoRepFormIntake);
  elements.geoRepBlueprintFolderForm.addEventListener("submit", saveGeoRepBlueprintFolder);
  elements.salesforceAttendanceMasterForm.addEventListener("submit", saveSalesforceAttendanceSmartSellMaster);
  elements.salesforceAttendanceMonthlyMasterForm.addEventListener("submit", saveSalesforceAttendanceMonthlySmartSellMaster);
  elements.salesforceAttendanceBlueprintForm.addEventListener("submit", saveSalesforceAttendanceBlueprint);
  elements.salesforceAttendanceMonthlyPlanSetupForm.addEventListener("submit", saveSalesforceAttendanceMonthlyPlanSetup);
  elements.runSalesforceAttendanceMonthlyPlanSetup.addEventListener("click", runSalesforceAttendanceMonthlyPlanSetup);
  elements.salesforceAttendanceMonthlyBlueprintProvisionForm.addEventListener("submit", saveSalesforceAttendanceMonthlyBlueprintProvisioning);
  elements.createSalesforceAttendanceMonthlyBlueprint.addEventListener("click", createSalesforceAttendanceMonthlyBlueprint);
elements.displayComplianceChannelsForm.addEventListener("submit", addDisplayComplianceChannel);
elements.displayComplianceChannelsList.addEventListener("click", removeDisplayComplianceChannel);
elements.displayComplianceSmartSellMasterForm.addEventListener("submit", saveDisplayComplianceSmartSellMaster);
elements.displayComplianceTemplateFolderForm.addEventListener("submit", saveDisplayComplianceTemplateFolder);
elements.displayCompliancePhaseTwoAutoRun.addEventListener("change", setDisplayCompliancePhaseTwoAutomation);
elements.scanDisplayCompliancePhaseTwoInputs.addEventListener("click", scanDisplayCompliancePhaseTwoInputs);
elements.runDisplayCompliancePhaseTwoTest.addEventListener("click", startDisplayCompliancePhaseTwoReferenceValidation);
  elements.geoRepBlueprintForm.addEventListener("submit", saveGeoRepBlueprint);
  elements.geoRepBlueprintFormIntake.addEventListener("change", () => applyGeoRepFormIntakeToBlueprint(elements.geoRepBlueprintFormIntake.value));
  elements.geoRepFormReportImportForm?.addEventListener("submit", importGeoRepFormReport);
elements.geoRepStoreMasterList.addEventListener("click", (event) => {
  const edit = event.target.closest("button[data-id]");
  if (edit) { editGeoRepStoreMaster(edit.dataset.id); return; }
  if (event.target.closest("[data-rebuild-master]")) buildLatestGeoRepPowerBiReport();
});
  elements.geoRepBlueprintList.addEventListener("click", (event) => {
    const edit = event.target.closest("button[data-id]");
    if (edit) editGeoRepBlueprint(edit.dataset.id);
  });
  elements.geoRepFormIntakeList.addEventListener("click", (event) => {
    const intake = event.target.closest("button[data-intake-id]");
    if (!intake) return;
    elements.geoRepBlueprintFormIntake.value = intake.dataset.intakeId;
    applyGeoRepFormIntakeToBlueprint(intake.dataset.intakeId);
  });
elements.addExtractionStep.addEventListener("click", () => { readStepsFromEditor(); state.extractionSteps.push(newStep()); renderExtractionSteps(); });
elements.extractionSteps.addEventListener("input", readStepsFromEditor);
elements.extractionSteps.addEventListener("click", (event) => { const button = event.target.closest(".remove-step"); if (!button) return; readStepsFromEditor(); const id = button.closest(".extraction-step").dataset.stepId; state.extractionSteps = state.extractionSteps.filter((step) => step.id !== id); renderExtractionSteps(); });
let draggedStepId = null;
elements.extractionSteps.addEventListener("dragstart", (event) => { const row = event.target.closest(".extraction-step"); if (!row) return; readStepsFromEditor(); draggedStepId = row.dataset.stepId; row.classList.add("dragging"); event.dataTransfer.effectAllowed = "move"; });
elements.extractionSteps.addEventListener("dragend", (event) => { event.target.closest(".extraction-step")?.classList.remove("dragging"); draggedStepId = null; });
elements.extractionSteps.addEventListener("dragover", (event) => { event.preventDefault(); const target = event.target.closest(".extraction-step"); if (!target || target.dataset.stepId === draggedStepId) return; const from = state.extractionSteps.findIndex((step) => step.id === draggedStepId), to = state.extractionSteps.findIndex((step) => step.id === target.dataset.stepId); const [moved] = state.extractionSteps.splice(from, 1); state.extractionSteps.splice(to, 0, moved); renderExtractionSteps(); });
elements.retailerList.addEventListener("click", (event) => {
  if (event.target.closest("button[data-retry-retailers]")) { subscribeRetailerProfiles(); return; }
  const button = event.target.closest("button[data-id]"); if (button) editRetailer(button.dataset.id);
});
elements.extractionProfileList.addEventListener("click", (event) => { const button = event.target.closest("button[data-id]"); if (button) editExtractionProfile(button.dataset.id); });
elements.retailerExtractionProfile.addEventListener("change", () => { elements.openLinkedExtractionProfile.disabled = !elements.retailerExtractionProfile.value; });
elements.openLinkedExtractionProfile.addEventListener("click", () => { if (elements.retailerExtractionProfile.value) { editExtractionProfile(elements.retailerExtractionProfile.value); activateAdminTab("steps"); } });
elements.retailerName.addEventListener("input", () => syncSalesforceConnectedAppFields());
elements.retailerWebAddress.addEventListener("input", () => syncSalesforceConnectedAppFields());
elements.retailerUsername.addEventListener("input", () => {
  if (!elements.salesforceConnectedAppFields.hidden && !elements.retailerSalesforceApiUsername.value) elements.retailerSalesforceApiUsername.value = elements.retailerUsername.value;
});
elements.retailerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = event.submitter;
  submit.disabled = true;
  try {
    const privateKey = elements.retailerSalesforcePrivateKey.value.trim();
    const result = await callFunction("saveRetailer", {
      id: elements.retailerId.value,
      name: elements.retailerName.value,
      webAddress: elements.retailerWebAddress.value,
      username: elements.retailerUsername.value,
      password: elements.retailerPassword.value,
      extractionProfileId: elements.retailerExtractionProfile.value,
      salesforceConnectedApp: privateKey ? {
        clientId: elements.retailerSalesforceClientId.value.trim(),
        username: elements.retailerSalesforceApiUsername.value.trim() || elements.retailerUsername.value.trim(),
        loginUrl: elements.retailerSalesforceLoginUrl.value.trim(),
        privateKey
      } : null
    });
    elements.retailerId.value = result.id;
    elements.retailerPassword.value = "";
    elements.retailerSalesforcePrivateKey.value = "";
    elements.deleteRetailer.hidden = false;
    elements.testRetailerSalesforceConnectedApp.disabled = !privateKey && elements.testRetailerSalesforceConnectedApp.disabled;
    if (privateKey) {
      elements.salesforceConnectedAppBadge.className = "entity-state excluded";
      elements.salesforceConnectedAppBadge.textContent = "Test required";
      elements.salesforceConnectedAppStatus.textContent = "Certificate settings were encrypted and saved. Run Test connection to verify the Salesforce report assignment.";
      elements.testRetailerSalesforceConnectedApp.disabled = false;
    }
    showToast("Extraction profile saved.");
    subscribeRetailerProfiles();
  } catch (error) {
    showToast(friendlyError(error), true);
  } finally {
    submit.disabled = false;
  }
});
elements.testRetailerSalesforceConnectedApp.addEventListener("click", async () => {
  const retailerId = elements.retailerId.value;
  if (!retailerId) return;
  const button = elements.testRetailerSalesforceConnectedApp;
  button.disabled = true;
  elements.salesforceConnectedAppStatus.textContent = "Authenticating with the certificate and checking the configured Attendance report...";
  try {
    const result = await callFunction("testSalesforceConnectedApp", { retailerId });
    elements.salesforceConnectedAppBadge.className = "entity-state selected";
    elements.salesforceConnectedAppBadge.textContent = "Verified";
    elements.salesforceConnectedAppStatus.textContent = `${result.reportName} is available through Salesforce API ${result.apiVersion} on ${result.instanceHost}. Scheduled Attendance runs will not request MFA.`;
    showToast("Salesforce unattended access verified.");
  } catch (error) {
    elements.salesforceConnectedAppBadge.className = "entity-state excluded";
    elements.salesforceConnectedAppBadge.textContent = "Failed";
    elements.salesforceConnectedAppStatus.textContent = friendlyError(error);
    showToast(friendlyError(error), true);
  } finally {
    button.disabled = false;
  }
});
elements.deleteRetailer.addEventListener("click", async () => { if (!elements.retailerId.value || !window.confirm("Delete this extraction profile and its encrypted login credentials?")) return; try { await callFunction("deleteRetailer", { id: elements.retailerId.value }); resetRetailerForm(); showToast("Extraction profile deleted."); } catch (error) { showToast(friendlyError(error), true); } });
elements.extractionProfileForm.addEventListener("submit", async (event) => { event.preventDefault(); const submit = event.submitter; submit.disabled = true; try { const result = await callFunction("saveExtractionProfile", { id: elements.extractionProfileId.value, name: elements.extractionProfileName.value, steps: readStepsFromEditor() }); elements.extractionProfileId.value = result.id; elements.deleteExtractionProfile.hidden = false; elements.retailerExtractionProfile.value = elements.retailerExtractionProfile.value || result.id; elements.openLinkedExtractionProfile.disabled = !elements.retailerExtractionProfile.value; showToast("Extraction step set saved."); } catch (error) { showToast(friendlyError(error), true); } finally { submit.disabled = false; } });
elements.deleteExtractionProfile.addEventListener("click", async () => { if (!elements.extractionProfileId.value || !window.confirm("Delete this extraction step set?")) return; try { await callFunction("deleteExtractionProfile", { id: elements.extractionProfileId.value }); if (elements.retailerExtractionProfile.value === elements.extractionProfileId.value) elements.retailerExtractionProfile.value = ""; resetExtractionProfileForm(); showToast("Extraction step set deleted."); } catch (error) { showToast(friendlyError(error), true); } });
function refreshRunSchedulePreview() {
  const retailer = state.retailers.find((item) => item.id === elements.runRetailer.value);
  renderScheduleSummary(retailer, runScheduleRefs(), { monthly: isMonthlyAttendanceRetailer(retailer) });
}

function refreshFilesSchedulePreview() {
  const retailer = state.retailers.find((item) => item.id === elements.filesRunRetailer.value);
  renderScheduleSummary(retailer, filesScheduleRefs());
}

function applySchedulePreset(target, preset) {
  const refs = target === "files" ? filesScheduleRefs() : runScheduleRefs();
  const retailer = state.retailers.find((item) => item.id === (target === "files" ? elements.filesRunRetailer.value : elements.runRetailer.value));
  if (target === "run" && isMonthlyAttendanceRetailer(retailer)) return;
  const selected = preset === "weekdays" ? weekdayScheduleDays : preset === "everyday" ? scheduleDayOrder : [];
  refs.days.forEach((input) => { input.checked = selected.includes(Number(input.value)); });
  if (target === "files") refreshFilesSchedulePreview(); else refreshRunSchedulePreview();
}

elements.runStartDate.addEventListener("change", () => {
  if (!elements.runEndDate.value || elements.runEndDate.value < elements.runStartDate.value) elements.runEndDate.value = elements.runStartDate.value;
  refreshRunSchedulePreview();
});
elements.runEndDate.addEventListener("change", refreshRunSchedulePreview);
elements.runMonthlyActualWeek.addEventListener("change", () => {
  const retailer = state.retailers.find((item) => item.id === elements.runRetailer.value);
  syncMonthlyAttendanceRunControls(retailer);
});
elements.runMonthlyScheduleDay.addEventListener("change", refreshRunSchedulePreview);
elements.runScheduleComposer.addEventListener("input", refreshRunSchedulePreview);
elements.runScheduleComposer.addEventListener("change", refreshRunSchedulePreview);
elements.filesScheduleComposer.addEventListener("input", refreshFilesSchedulePreview);
elements.filesScheduleComposer.addEventListener("change", refreshFilesSchedulePreview);
document.addEventListener("click", (event) => {
  const preset = event.target.closest("[data-schedule-preset]");
  if (preset) applySchedulePreset(preset.dataset.scheduleTarget, preset.dataset.schedulePreset);
});
elements.saveRunSchedule.addEventListener("click", async () => {
  if (state.isAdmin !== true) {
    showToast("Only an Admin can change an automated schedule.", true);
    return;
  }
  const retailerId = elements.runRetailer.value;
  if (!retailerId) return;
  const retailer = state.retailers.find((item) => item.id === retailerId);
  elements.saveRunSchedule.disabled = true;
  try {
    const scheduleOptions = validateScheduleControls(retailer, runScheduleRefs(), { monthly: isMonthlyAttendanceRetailer(retailer) });
    const monthlyOptions = monthlyAttendanceRunOptions(retailer, { required: scheduleOptions.enabled });
    const result = await callFunction("saveRetailerSchedule", {
      retailerId,
      dateMode: elements.runScheduleDateMode.value,
      startDate: elements.runStartDate.value,
      endDate: elements.runEndDate.value,
      ...monthlyOptions,
      time: elements.runScheduleTime.value,
      ...scheduleOptions
    });
    showToast(result.missedToday ? `Schedule saved. Today's time has passed; the next eligible run is ${result.nextEligibleDate}.` : "Extraction profile schedule saved.");
  } catch (error) {
    showToast(friendlyError(error), true);
  } finally {
    elements.saveRunSchedule.disabled = false;
  }
});
elements.runExtraction.addEventListener("click", async () => {
  const retailer = state.retailers.find((item) => item.id === elements.runRetailer.value);
  try {
    const monthlyOptions = monthlyAttendanceRunOptions(retailer);
    // Rendering the queued state refreshes schedule controls. Preserve the
    // explicit manual date range before that refresh can reset blank fields.
    const reportStartDate = elements.runStartDate.value;
    const reportEndDate = elements.runEndDate.value;
    elements.runExtraction.disabled = true;
    renderExtractionRun({ status: "queued", retailerId: retailer?.id, retailerName: retailer?.name });
    const result = await callFunction("startExtraction", { retailerId: elements.runRetailer.value, reportStartDate, reportEndDate, ...monthlyOptions });
    renderExtractionRun({ id: result.runId, status: "queued", retailerId: retailer?.id, retailerName: retailer?.name });
    showToast("Report extraction started.");
  } catch (error) {
    // Do not leave a visual queued state behind when client-side validation
    // or the callable request fails before a real extraction run is created.
    renderExtractionRun(null);
    showToast(friendlyError(error), true);
  } finally {
    renderRunRetailerDetails();
  }
});
elements.operationsRetailer.addEventListener("change", renderOperationsWorkspace);
document.querySelector(".operations-shortcut-tabs")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-operations-jump]");
  if (!button) return;
  jumpToOperationsPanel(button.dataset.operationsJump, button);
});
elements.operationsSchedulePanel.addEventListener("input", () => {
  state.operationsScheduleDirty = true;
  renderOperationsScheduleSummary(currentOperationsProfile());
});
elements.operationsSchedulePanel.addEventListener("change", () => {
  state.operationsScheduleDirty = true;
  const profile = currentOperationsProfile();
  renderOperationsSchedule(profile, state.operationsWorkspace?.account || {});
});
elements.operationsRunMonthlyActualWeek.addEventListener("change", () => renderOperationsManualRunControls(currentOperationsProfile()));
elements.operationsDailySmartSellWeek.addEventListener("change", () => renderOperationsScheduleSummary(currentOperationsProfile()));
elements.operationsSmartSellMasterWeek.addEventListener("change", () => { state.operationsSmartSellMasterDirty = true; });
elements.operationsSmartSellMasterFile.addEventListener("change", () => { state.operationsSmartSellMasterDirty = true; });
elements.operationsSmartSellMasterAssignments.addEventListener("change", () => { state.operationsSmartSellMasterDirty = true; });
elements.operationsSmartSellMasterForm.addEventListener("submit", saveOperationsSmartSellMaster);
document.querySelector("#operationsMonthlyBlueprintForm").addEventListener("submit", saveOperationsMonthlyBlueprint);
document.querySelector("#operationsMonthlyPlanTargetUrl").addEventListener("input", (event) => {
  event.currentTarget.dataset.userEdited = "true";
});
document.querySelector("#operationsSaveMonthlyPlan")?.addEventListener("click", saveOperationsMonthlyPlanSetup);
document.querySelector("#operationsRunMonthlyPlanSetup")?.addEventListener("click", runOperationsMonthlyPlanSetup);
document.querySelector("#operationsCreateMonthlyBlueprint").addEventListener("click", createOperationsMonthlyBlueprint);
elements.operationsSaveSchedule.addEventListener("click", async () => {
  const profile = currentOperationsProfile();
  const account = state.operationsWorkspace?.account || {};
  if (!profile || account.permissions?.manageSchedules !== true) {
    showToast("Your Nexus account is not permitted to manage this schedule.", true);
    return;
  }
  elements.operationsSaveSchedule.disabled = true;
  try {
    const monthly = isMonthlyAttendanceRetailer(profile);
    const scheduleOptions = validateScheduleControls(profile, operationsScheduleRefs(), { monthly });
    const monthlyOptions = operationsMonthlyAttendanceScheduleOptions(profile, { required: scheduleOptions.enabled });
    const result = await callFunction("saveRetailerSchedule", {
      retailerId: profile.id,
      dateMode: elements.operationsScheduleDateMode.value,
      startDate: elements.operationsScheduleStartDate.value,
      endDate: elements.operationsScheduleEndDate.value,
      time: elements.operationsScheduleTime.value,
      dailySmartSellWeekOverride: isDailySalesforceAttendanceProfile(profile) ? elements.operationsDailySmartSellWeek.value : "",
      ...monthlyOptions,
      ...scheduleOptions
    });
    state.operationsScheduleDirty = false;
    showToast(result.missedToday ? `Schedule saved. Today's time has passed; the next eligible run is ${result.nextEligibleDate}.` : "Automated schedule saved.");
    await loadOperationsWorkspace();
  } catch (error) {
    showToast(friendlyError(error), true);
  } finally {
    elements.operationsSaveSchedule.disabled = false;
  }
});
elements.operationsRunExtraction.addEventListener("click", async () => {
  const profile = currentOperationsProfile();
  if (!profile || profile.setupRequired === true || state.operationsRunPending) return;
  state.operationsRunPending = true;
  elements.operationsRunExtraction.disabled = true;
  elements.operationsSessionCopy.textContent = `Queuing ${profile.name}...`;
  renderExtractionRun({ status: "queued", retailerId: profile.id, retailerName: profile.name });
  try {
    const monthlyOptions = operationsMonthlyAttendanceRunOptions(profile);
    const monthly = isMonthlyAttendanceRetailer(profile);
    const result = await callFunction("startExtraction", {
      retailerId: profile.id,
      reportStartDate: elements.operationsStartDate.value,
      reportEndDate: elements.operationsEndDate.value,
      dailySmartSellWeekOverride: isDailySalesforceAttendanceProfile(profile) ? elements.operationsDailySmartSellWeek.value : "",
      ...monthlyOptions
    });
    renderExtractionRun({ id: result.runId, status: "queued", retailerId: profile.id, retailerName: profile.name });
    showToast("Report job queued. Nexus will update this page as it progresses.");
    await loadOperationsWorkspace();
    if (result.runId) elements.operationsSessionCopy.textContent = `Job ${result.runId.slice(0, 8)} is queued.`;
  } catch (error) {
    renderExtractionRun(null);
    showToast(friendlyError(error), true);
  } finally {
    state.operationsRunPending = false;
    renderOperationsWorkspace();
  }
});
elements.operationsPromptList.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-operations-prompt-form]");
  if (!form) return;
  event.preventDefault();
  const value = form.querySelector("[name='verificationCode']")?.value.trim() || "";
  try {
    await callFunction("submitAutomationPrompt", { promptId: form.dataset.operationsPromptForm, action: "submit", value });
    showToast("Verification code sent to the bot.");
    await loadOperationsWorkspace();
  } catch (error) { showToast(friendlyError(error), true); }
});
elements.operationsPromptList.addEventListener("click", async (event) => {
  const approve = event.target.closest("[data-operations-prompt-approve]");
  const abort = event.target.closest("[data-operations-prompt-abort]");
  try {
    if (approve) {
      await callFunction("submitAutomationPrompt", { promptId: approve.dataset.operationsPromptApprove, action: "approve" });
      showToast("Authenticator approval confirmed. The bot is continuing.");
      await loadOperationsWorkspace();
    }
    if (abort) {
      if (!window.confirm("Abort this job? No new report will be delivered.")) return;
      await callFunction("abortExtraction", { runId: abort.dataset.operationsPromptAbort });
      showToast("Job abort requested.");
      await loadOperationsWorkspace();
    }
  } catch (error) { showToast(friendlyError(error), true); }
});
elements.operationsRunHistory.addEventListener("click", async (event) => {
  const abort = event.target.closest("[data-operations-abort]");
  const view = event.target.closest("[data-operations-view]");
  if (view) { await loadOperationRunDetail(view.dataset.operationsView); return; }
  if (!abort || !window.confirm("Abort this job? No new report will be delivered.")) return;
  try {
    await callFunction("abortExtraction", { runId: abort.dataset.operationsAbort });
    showToast("Job abort requested.");
    await loadOperationsWorkspace();
  } catch (error) { showToast(friendlyError(error), true); }
});
async function abortActiveExtraction() {
  const runId = state.activeExtractionRunId;
  if (!runId || !window.confirm("Abort this extraction? The bot will stop safely and no new report will be delivered.")) return;
  [elements.abortExtraction, elements.extractionStatusAbort].filter(Boolean).forEach((control) => {
    control.disabled = true;
    control.textContent = control === elements.extractionStatusAbort ? "Stopping job..." : "Stopping extraction...";
  });
  try {
    await callFunction("abortExtraction", { runId });
    showToast("Extraction abort requested.");
    await loadOperationsWorkspace({ quiet: true });
  } catch (error) {
    [elements.abortExtraction, elements.extractionStatusAbort].filter(Boolean).forEach((control) => {
      control.disabled = false;
      control.textContent = control === elements.extractionStatusAbort ? "Abort job" : "Abort extraction";
    });
    showToast(friendlyError(error), true);
  }
}
elements.abortExtraction.addEventListener("click", abortActiveExtraction);
elements.extractionStatusAbort?.addEventListener("click", abortActiveExtraction);

async function handleStalledExtractionAction(action, runId = state.activeExtractionRunId) {
  if (!runId) return;
  const prompts = {
    continue: "Continue waiting for this portal response? Nexus will keep the current secure session open.",
    restart: "Restart this extraction? Nexus will end the current unresponsive session and create one fresh retry.",
    end: "End this extraction session? Nexus will stop the current run and will not retry it."
  };
  if (!window.confirm(prompts[action])) return;
  const button = action === "continue" ? elements.continueWaitingExtraction : action === "restart" ? elements.restartStalledExtraction : elements.endStalledExtraction;
  if (button) button.disabled = true;
  try {
    if (action === "continue") {
      await callFunction("continueWaitingExtraction", { runId });
      showToast("Nexus will continue waiting for the portal response.");
    } else if (action === "restart") {
      const result = await callFunction("restartExtraction", { runId });
      showToast(`A fresh retry was queued${result.restartRunId ? "." : ""}`);
    } else {
      await callFunction("abortExtraction", { runId });
      showToast("Extraction session ended.");
    }
  } catch (error) {
    showToast(friendlyError(error), true);
  } finally {
    if (button) button.disabled = false;
  }
}

elements.continueWaitingExtraction.addEventListener("click", () => handleStalledExtractionAction("continue"));
elements.restartStalledExtraction.addEventListener("click", () => handleStalledExtractionAction("restart"));
elements.endStalledExtraction.addEventListener("click", () => handleStalledExtractionAction("end"));
[elements.adminRunDetail, elements.operationsRunDetail, elements.adminJobDetail, elements.automationLogDetail].forEach((container) => container?.addEventListener("click", (event) => {
  const continueButton = event.target.closest("[data-continue-stalled]");
  const restartButton = event.target.closest("[data-restart-stalled]");
  const endButton = event.target.closest("[data-end-stalled]");
  const retryButton = event.target.closest("[data-retry-failed]");
  if (continueButton) handleStalledExtractionAction("continue", continueButton.dataset.continueStalled);
  if (restartButton) handleStalledExtractionAction("restart", restartButton.dataset.restartStalled);
  if (endButton) handleStalledExtractionAction("end", endButton.dataset.endStalled);
  if (retryButton) retryFailedExtractionStep(retryButton.dataset.retryFailed);
}));
async function retryFailedExtractionStep(runId) {
  if (!runId || !window.confirm("Retry the last failed step? Nexus will rebuild the required secure portal state and keep the original job log.")) return;
  try {
    const result = await callFunction("retryFailedExtractionStep", { runId });
    showToast(`Targeted retry queued from step ${result.retryFromStep}.`);
    await loadOperationsWorkspace();
  } catch (error) { showToast(friendlyError(error), true); }
}
elements.operationsAlertsList?.addEventListener("click", async (event) => {
  const retry = event.target.closest("[data-retry-failed]");
  const view = event.target.closest("[data-alert-view]");
  if (retry) { await retryFailedExtractionStep(retry.dataset.retryFailed); return; }
  if (view) {
    if (state.isAdmin) activateAdminTab("jobs");
    await loadOperationRunDetail(view.dataset.alertView, state.isAdmin ? "admin" : "operator");
  }
});
elements.adminJobList?.addEventListener("click", async (event) => {
  const view = event.target.closest("[data-admin-job-view],[data-operations-view]");
  const abort = event.target.closest("[data-admin-job-abort]");
  if (view) { await loadOperationRunDetail(view.dataset.adminJobView || view.dataset.operationsView, "admin"); return; }
  if (!abort || !window.confirm("Abort this job? No new report will be delivered.")) return;
  try {
    await callFunction("abortExtraction", { runId: abort.dataset.adminJobAbort });
    showToast("Job abort requested.");
    await loadOperationsWorkspace();
  } catch (error) { showToast(friendlyError(error), true); }
});
elements.adminEndAllActiveJobs?.addEventListener("click", async () => {
  const activeCount = (state.operationsWorkspace?.runs || state.extractionRuns || []).filter(isActiveOperationRun).length;
  if (!activeCount) {
    showToast("There are no active jobs to end.");
    return;
  }
  if (!window.confirm(`End all ${activeCount} active automation job${activeCount === 1 ? "" : "s"}? No new reports will be delivered for the stopped jobs.`)) return;
  elements.adminEndAllActiveJobs.disabled = true;
  elements.adminEndAllActiveJobs.textContent = "Ending active jobs...";
  try {
    const result = await callFunction("endAllActiveExtractionRuns", {});
    showToast(`Ended ${result.cancelledRuns || 0} active job${Number(result.cancelledRuns || 0) === 1 ? "" : "s"} and closed ${result.closedPrompts || 0} waiting prompt${Number(result.closedPrompts || 0) === 1 ? "" : "s"}.`);
    await loadOperationsWorkspace();
  } catch (error) {
    showToast(friendlyError(error), true);
  } finally {
    renderAdminJobs();
  }
});
elements.adminLiveJobList?.addEventListener("click", async (event) => {
  const view = event.target.closest("[data-admin-job-view]");
  if (view) await loadOperationRunDetail(view.dataset.adminJobView, "admin");
});
elements.adminRefreshJobLogs?.addEventListener("click", async () => {
  elements.adminRefreshJobLogs.disabled = true;
  elements.adminRefreshJobLogs.textContent = "Refreshing logs...";
  try {
    await loadAdminJobHistory();
    showToast("Organisation-wide job logs refreshed.");
  } finally {
    elements.adminRefreshJobLogs.disabled = false;
    elements.adminRefreshJobLogs.textContent = "Refresh all job logs";
  }
});
elements.adminClearJobFilters?.addEventListener("click", () => {
  elements.adminJobSearch.value = "";
  elements.adminJobStatus.value = "";
  elements.adminJobOwner.value = "";
  renderAdminJobs();
});
[elements.adminJobSearch, elements.adminJobStatus, elements.adminJobOwner].forEach((field) => field?.addEventListener(field === elements.adminJobSearch ? "input" : "change", renderAdminJobs));
[
  elements.automationRunHistory,
  elements.adminRunHistory
].forEach((container) => container?.addEventListener("click", async (event) => {
  const view = event.target.closest("[data-operations-view]");
  if (view) await loadOperationRunDetail(view.dataset.operationsView, state.isAdmin ? "admin" : "operator");
}));
elements.runRetailer.addEventListener("change", renderRunRetailerDetails);
document.querySelectorAll("#nexusHomeAutomationList,#adminProfileHealth,#adminScheduleList,#automationDeliveryHistory,#adminDeliveryList,#adminRunHistory").forEach((container) => container?.addEventListener("click", (event) => {
  const configure = event.target.closest("[data-configure-profile]");
  if (configure) { configureAutomationProfile(configure.dataset.configureProfile); return; }
  const openProfile = event.target.closest("[data-open-profile]");
  if (openProfile) { editRetailer(openProfile.dataset.openProfile); activateAdminTab("retailers"); return; }
  const viewRun = event.target.closest("[data-view-run]");
  if (viewRun) {
    state.selectedExecutionRunId = viewRun.dataset.viewRun;
    renderOperations();
    return;
  }
  const download = event.target.closest("[data-download-delivery]");
  if (download) {
    const file = reportFiles().find((item) => item.id === download.dataset.downloadDelivery);
    if (file) downloadFiles([file]);
  }
}));
elements.filesRunStartDate.addEventListener("change", () => {
  if (!elements.filesRunEndDate.value || elements.filesRunEndDate.value < elements.filesRunStartDate.value) elements.filesRunEndDate.value = elements.filesRunStartDate.value;
  refreshFilesSchedulePreview();
});
elements.filesRunEndDate.addEventListener("change", refreshFilesSchedulePreview);
elements.filesRunRetailer.addEventListener("change", renderFilesRunRetailerDetails);
elements.filesSaveRunSchedule.addEventListener("click", async () => {
  const retailerId = elements.filesRunRetailer.value;
  if (!retailerId) return;
  elements.filesSaveRunSchedule.disabled = true;
  try {
    const scheduleOptions = validateScheduleControls(state.retailers.find((item) => item.id === retailerId), filesScheduleRefs());
    const result = await callFunction("saveRetailerSchedule", {
      retailerId,
      dateMode: elements.filesRunScheduleDateMode.value,
      startDate: elements.filesRunStartDate.value,
      endDate: elements.filesRunEndDate.value,
      time: elements.filesRunScheduleTime.value,
      ...scheduleOptions
    });
    showToast(result.missedToday ? `Schedule saved. Today's time has passed; the next eligible run is ${result.nextEligibleDate}.` : "Extraction profile schedule saved.");
  } catch (error) {
    showToast(friendlyError(error), true);
  } finally {
    elements.filesSaveRunSchedule.disabled = false;
  }
});
elements.filesRunExtraction.addEventListener("click", async () => {
  elements.filesRunExtraction.disabled = true;
  const retailer = state.retailers.find((item) => item.id === elements.filesRunRetailer.value);
  renderExtractionRun({ status: "queued", retailerId: retailer?.id, retailerName: retailer?.name });
  try {
    const result = await callFunction("startExtraction", { retailerId: elements.filesRunRetailer.value, reportStartDate: elements.filesRunStartDate.value, reportEndDate: elements.filesRunEndDate.value });
    renderExtractionRun({ id: result.runId, status: "queued", retailerId: retailer?.id, retailerName: retailer?.name });
    showToast("Report extraction started.");
  } catch (error) {
    state.extractionRunning = false;
    window.NexusJobStatus?.update(null);
    updateSelectionControls();
    renderFilesRunRetailerDetails();
    showToast(friendlyError(error), true);
  } finally {
    renderFilesRunRetailerDetails();
  }
});
elements.openFilesFromAdmin?.addEventListener("click", openAutomationWorkspace);
elements.automationLogClose?.addEventListener("click", () => elements.automationLogDialog?.close());
elements.automationPromptDialog.addEventListener("cancel", (event) => event.preventDefault());
elements.automationPromptForm.addEventListener("submit", (event) => { event.preventDefault(); submitAutomationPromptValue(); });
elements.automationPromptAbort.addEventListener("click", async () => {
  const prompt = state.activeAutomationPrompt;
  if (!prompt || !window.confirm("Abort this extraction? No report will be delivered.")) return;
  elements.automationPromptAbort.disabled = true;
  try {
    await callFunction("abortExtraction", { runId: prompt.runId });
    elements.automationPromptDialog.close();
    state.activeAutomationPrompt = null;
    showToast("Extraction abort requested.");
  } catch (error) {
    showToast(friendlyError(error), true);
  } finally {
    elements.automationPromptAbort.disabled = false;
  }
});
elements.newAdminUser.addEventListener("click", resetAdminUserForm);
elements.adminUserSearch?.addEventListener("input", renderAdminUsers);
elements.adminUserList.addEventListener("click", (event) => { const button = event.target.closest("button[data-id]"); if (button) editAdminUser(button.dataset.id); });
elements.adminUserRole.addEventListener("change", () => {
  renderAdminUserNavigation([...elements.adminUserNavigation].filter(input => input.checked).map(input => input.value), elements.adminUserRole.value, [...elements.adminUserNavigation].some(input => input.value === "chat" && input.checked));
  syncAdminChatFields();
});
document.getElementById("adminChatAudience").addEventListener("change", syncAdminChatFields);
elements.adminUserForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = elements.adminUserForm;
  if (form.dataset.saving === "true") return;
  const submit = event.submitter || form.querySelector('button[type="submit"]');
  const status = document.getElementById("adminUserSaveStatus");
  form.dataset.saving = "true";
  if (submit) submit.disabled = true;
  if (status) { status.hidden = false; status.textContent = "Saving user..."; }
  try {
    if (elements.adminUserId.value === auth.currentUser?.uid && (elements.adminUserRole.value !== "admin" || elements.adminUserDisabled.checked)) throw new Error("Another administrator must change your Administrator role or disable your account.");
    if (!elements.adminUserId.value && elements.adminUserPassword.value.length < 6) {
      throw new Error("Enter a password of at least six characters for this new user.");
    }
    const allowedRetailerIds = [...elements.adminUserAllowedRetailers.selectedOptions].map(option => option.value).filter(Boolean);
    const allowedNavigationIds = [...elements.adminUserNavigation].filter(input => input.checked).map(input => input.value);
    const chatAccess = Object.fromEntries(["audience", "clientId", "workRole", "region", "department"].map(key => [key, document.getElementById(`adminChat${key[0].toUpperCase()}${key.slice(1)}`).value]));
    for (const key of ["createGroups", "assignTasks", "moderateMessages"]) chatAccess[key] = document.getElementById(`adminChat${key[0].toUpperCase()}${key.slice(1)}`).checked;
    const result = await callFunction("saveAdminUser", { uid: elements.adminUserId.value, name: elements.adminUserName.value, surname: elements.adminUserSurname.value, email: elements.adminUserEmail.value, role: elements.adminUserRole.value, password: elements.adminUserPassword.value, disabled: elements.adminUserDisabled.checked, allowedRetailerIds, allowedNavigationIds, chatAccess });
    elements.adminUserId.value = result.uid; elements.adminUserPassword.value = "";
    elements.adminUserFormTitle.textContent = "Edit user";
    elements.deleteAdminUser.hidden = result.uid === auth.currentUser?.uid;
    if (status) status.textContent = "User saved.";
    showToast(`User saved as ${result.accountType === "client" ? "Client" : result.role === "admin" ? "Admin" : "Normal"}.`);
  } catch (error) {
    if (error.details?.incomplete === true && typeof error.details.savedUid === "string") {
      elements.adminUserId.value = error.details.savedUid;
      elements.adminUserPassword.value = "";
      elements.adminUserFormTitle.textContent = "Complete user setup";
    }
    const message = friendlyError(error);
    if (status) status.textContent = message;
    showToast(message, true);
  } finally {
    delete form.dataset.saving;
    if (submit) submit.disabled = false;
  }
});
elements.deleteAdminUser.addEventListener("click", async () => { if (!elements.adminUserId.value || !window.confirm("Permanently delete this user?")) return; try { await callFunction("deleteAdminUser", { uid: elements.adminUserId.value }); resetAdminUserForm(); showToast("User deleted."); } catch (error) { showToast(friendlyError(error), true); } });
elements.clientFilter.addEventListener("change", renderDashboard);
elements.dashboardTypeFilter.addEventListener("change", renderDashboard);
elements.adminClient.addEventListener("change", () => {
  elements.customClientField.hidden = elements.adminClient.value !== "__new";
  renderSourcePreview();
  if (!elements.customClientField.hidden) elements.customClient.focus();
});
elements.customClient.addEventListener("input", renderSourcePreview);
elements.sourceType.addEventListener("change", renderSourcePreview);
elements.adminFileInput.addEventListener("change", () => chooseAdminFile(elements.adminFileInput.files[0]));
elements.adminDropZone.addEventListener("click", () => elements.adminFileInput.click());
elements.adminDropZone.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); elements.adminFileInput.click(); } });
elements.adminDropZone.addEventListener("dragenter", (event) => { if (!containsFiles(event)) return; event.preventDefault(); adminDragDepth += 1; elements.adminDropZone.classList.add("is-dragging"); elements.adminDropTitle.textContent = "Release to analyse source"; });
elements.adminDropZone.addEventListener("dragover", (event) => { if (!containsFiles(event)) return; event.preventDefault(); event.dataTransfer.dropEffect = "copy"; });
elements.adminDropZone.addEventListener("dragleave", (event) => { if (!containsFiles(event)) return; adminDragDepth = Math.max(0, adminDragDepth - 1); if (!adminDragDepth) { elements.adminDropZone.classList.remove("is-dragging"); elements.adminDropTitle.textContent = state.pendingDataset ? "Source ready to publish" : "Drop a source file here"; } });
elements.adminDropZone.addEventListener("drop", (event) => { event.preventDefault(); adminDragDepth = 0; elements.adminDropZone.classList.remove("is-dragging"); chooseAdminFile(event.dataTransfer.files[0]); });
elements.publishDataset.addEventListener("click", publishPendingDataset);

elements.fileInput.addEventListener("change", () => uploadFiles([...elements.fileInput.files]));
elements.dropZone.addEventListener("click", openFilePicker);
elements.dropZone.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  openFilePicker();
});
elements.dropZone.addEventListener("dragenter", (event) => {
  if (!containsFiles(event)) return;
  event.preventDefault();
  dragDepth += 1;
  setDropZoneActive(true);
});
elements.dropZone.addEventListener("dragover", (event) => {
  if (!containsFiles(event)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
});
elements.dropZone.addEventListener("dragleave", (event) => {
  if (!containsFiles(event)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) setDropZoneActive(false);
});
elements.dropZone.addEventListener("drop", async (event) => {
  event.preventDefault();
  dragDepth = 0;
  setDropZoneActive(false);
  try {
    const files = await filesFromDrop(event.dataTransfer);
    if (files.length) await uploadFiles(files);
    else showToast("The dropped folder does not contain any files.", true);
  } catch (error) {
    showToast(`Could not read the dropped folder: ${friendlyError(error)}`, true);
  }
});
document.addEventListener("dragover", (event) => {
  if ((!elements.filesView.hidden || !elements.adminPage.hidden) && containsFiles(event)) event.preventDefault();
});
document.addEventListener("drop", (event) => {
  if (!elements.filesView.hidden && containsFiles(event) && !event.target.closest("#dropZone")) {
    event.preventDefault();
    showToast("Drop files inside the highlighted upload area.");
  }
  if (!elements.adminPage.hidden && containsFiles(event) && !event.target.closest("#adminDropZone")) {
    event.preventDefault();
    showToast("Drop the spreadsheet inside the Admin source area.");
  }
});
elements.filesNav?.addEventListener("click", openFilesWorkspace);
elements.closeFilesDialog.addEventListener("click", closeFilesWorkspace);
elements.selectAll.addEventListener("change", () => {
  state.visibleFileIds.forEach((id) => { if (elements.selectAll.checked) state.selected.add(id); else state.selected.delete(id); });
  renderFiles();
});
elements.fileSearch.addEventListener("input", () => { state.fileQuery = elements.fileSearch.value; state.filePage = 1; renderFiles(); });
elements.fileTypeFilter.addEventListener("change", () => { state.fileType = elements.fileTypeFilter.value; state.filePage = 1; renderFiles(); });
elements.fileSort.addEventListener("change", () => { state.fileSort = elements.fileSort.value; state.filePage = 1; renderFiles(); });
elements.filePageSize.addEventListener("change", () => { state.filePageSize = Number(elements.filePageSize.value) || 25; state.filePage = 1; renderFiles(); });
elements.filePrev.addEventListener("click", () => { state.filePage = Math.max(1, state.filePage - 1); renderFiles(); elements.fileList.scrollIntoView({ behavior: "smooth", block: "start" }); });
elements.fileNext.addEventListener("click", () => { state.filePage += 1; renderFiles(); elements.fileList.scrollIntoView({ behavior: "smooth", block: "start" }); });
elements.fileList.addEventListener("change", (event) => {
  if (!event.target.matches(".file-checkbox")) return;
  if (event.target.checked) state.selected.add(event.target.dataset.id);
  else state.selected.delete(event.target.dataset.id);
  updateSelectionControls();
});
elements.fileList.addEventListener("click", (event) => {
  const button = event.target.closest(".download-one");
  if (!button) return;
  const file = state.files.find((candidate) => candidate.id === button.dataset.id);
  if (file) downloadFiles([file]);
});
elements.downloadSelected.addEventListener("click", () => downloadFiles(selectedFiles()));
elements.deleteSelected.addEventListener("click", () => {
  const count = state.selected.size;
  elements.deleteDialogCopy.textContent = `${count} selected file${count === 1 ? "" : "s"} will be permanently removed. This action cannot be undone.`;
  elements.deleteDialog.showModal();
});
elements.deleteDialog.addEventListener("close", () => {
  if (elements.deleteDialog.returnValue === "default") deleteFiles(selectedFiles());
});

window.addEventListener("hashchange", setViewFromHash);
window.addEventListener("DOMContentLoaded", dismissAppLoader, { once: true });
window.setTimeout(dismissAppLoader, 2800);
// Allow the browser's native install affordance. Deferring the event without
// invoking prompt() produces a persistent console warning in Chromium.
elements.installButton?.addEventListener("click", () => window.NexusComms?.install());

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    Promise.reject(new Error("Offline cache is not used on Azure")).then((registration) => registration.update()).catch(() => {});
  });
}
setViewFromHash();
renderFiles();
renderClientOptions();
resetRetailerForm();
resetExtractionProfileForm();
resetAdminUserForm();
renderAdminHistory();
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialiseFirebase, { once: true });
else initialiseFirebase();

document.querySelector("#attendanceCallCyclePanel")?.addEventListener("click", async event => {
  const button = event.target.closest("[data-callcycle-export]");
  if (!button || !state.isOperator) return;
  const generation = nexusSessionGeneration;
  const rows = structuredClone((state.callCycleExportRows || []).filter(row => state.callCyclePage !== "reps" || !state.callCycleSelectedRep || (row.rep || row.employeeId) === state.callCycleSelectedRep));
  const filters = structuredClone(dedicatedCallCycleFilters());
  const source = state.callCycleSource;
  button.disabled = true;
  try {
    await ensureSpreadsheetReader();
    if (generation !== nexusSessionGeneration) return;
    const workbook = XLSX.utils.book_new();
    const headers = ["Store code", "Store", "Rep", "Line / Channel Manager", "Division", "Region", "Channel", "Banner", "Frequency", "Planned calls", "Scheduled days", "Scheduled weeks"];
    const records = rows.map(r => [r.storeCode, r.store, r.rep, r.manager, r.division, r.region, r.channel, r.banner, r.frequency, Number(r.callsPerMonth || 0), Object.entries(r.weekdayVisits || {}).filter(([,v]) => Number(v)).map(([k]) => k).join(", "), Object.entries(r.smartSellWeeks || {}).filter(([,v]) => Number(v)).map(([k]) => k).join(", ")]);
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers, ...records]), "Call Cycle");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Source", source], ["Filters", JSON.stringify(filters)], ["Records", rows.length]]), "Selection");
    XLSX.writeFile(workbook, "Call-Cycle-" + source + ".xlsx");
  } catch (error) { if (generation === nexusSessionGeneration) showToast(friendlyError(error), true); }
  finally { button.disabled = false; }
});
