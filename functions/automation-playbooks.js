"use strict";

// Curated from the deployed Nexus automation handlers and approved operating rules.
// These playbooks are deliberately free of credentials, SharePoint URLs, and raw data.
const PLAYBOOK_VERSION = "2026-09-09-attendance-latest-completed";

const PLAYBOOKS = {
  "geo-rep-capture": {
    title: "Geo Rep Capture Form Report and Blueprint population",
    rules: [
      "Use the requested date range; for the standard monthly run use the first day of the current month through today.",
      "Download the Geo Rep Form Report and read answer-level values from the Submission Answers worksheet, not only Summary.",
      "Match campaigns/forms by canonical Form Name and questions by approved blueprint mapping. Do not guess a match.",
      "Queue every eligible workbook in the configured Blueprint folder independently. Record and skip a workbook whose structure or required mapping is invalid.",
      "Keep an image link and issue-tracking question beside the matching yes/no answer only where the approved blueprint contains the mapping.",
      "Preserve formulas, tables, pivots, formatting, and unrelated worksheets. Empty mapped values remain blank rather than invented."
    ]
  },
  "geo-rep-sales-transactions": {
    title: "Geo Rep Capture Sales Transactions",
    rules: [
      "Download the Transaction Report for the requested current-month range.",
      "Use the Order Details worksheet as the dashboard source; Order Summary is not the detail source.",
      "Deduplicate imports using stable transaction and line identity so a later run adds only new records.",
      "Map stores to region only through the approved Geo Sales Store Master. Retain unmapped rows and report their count instead of inventing a region.",
      "Publish validated transaction detail to the controlled dashboard dataset only after the import counts and duplicate checks are recorded."
    ]
  },
  "geo-rep-attendance-reps": {
    title: "Geo Rep Capture Attendance for Reps",
    rules: [
      "Open Geo Rep Capture Strike Rate Report for the selected inclusive start and end dates.",
      "Use the signed-in user's authorised report access and do not substitute another Geo Rep report type.",
      "Use the Strike rate and Schedules worksheets from the verified export as the Rep TNA source data.",
      "Include Sales Rep, Semi-Dedicated Sales Rep, and Team Leader roles; keep Merchandiser handling outside this workflow.",
      "Normalize Geo Rep region text before writing to the tracker, including KwaZulu-Natal to Kwazulu Natal for the approved workbook formulas.",
      "Update only the protected Strike rate and Schedules raw tabs, then refresh Weekly Manager vs Rep, Daily T&A Manager vs Rep, and Total Daily Attendance formulas.",
      "Preserve formulas, pivots, summaries, formatting, and manual dashboard tabs in the Rep TNA tracker."
    ]
  },
  "salesforce-attendance-daily": {
    title: "SalesForce Rep Attendance Daily",
    rules: [
      "Read the combined Salesforce export from the approved SharePoint Rep Attendance Raw Data folder using the Nexus service integration. Do not open Salesforce, request MFA, or run the old portal download steps.",
      "Select the latest Updated South Africa Attendance Report-YYYY-MM-DD-HH-MM-SS.xlsx by its export timestamp, not upload time. Both Daily and Monthly read this same raw folder. Ignore blueprints, temporary files, and unrelated reports.",
      "Scan every SharePoint results page before choosing a file. Treat filename timestamps as South African time; a browser copy suffix such as (1) does not change the export date. Future-dated files are not eligible.",
      "Validate the stable file version, attendance columns, matching Salesforce As of timestamp and Visit Date start filter. The export day is partial: only earlier completed days may update attendance. Missing, stale, ambiguous or invalid data stops the job without an older-file or portal fallback.",
      "SharePoint is a read-only input. Keep the verified Nexus source copy and audit the file name, period and version. A separate report publisher must keep SharePoint current.",
      "Use the normal previous-business-day attendance period unless an approved one-off date override is supplied.",
      "When a completed-day export is missing or late, recheck every 10 minutes for at most two hours and 12 retries. Keep the original owner and date anchor. Invalid headers, changed files, wrong start filters, and ambiguous files require correction, not automatic retry. Never update a workbook while waiting.",
      "A valid visit is present when either the check-in location or checkout location is 1. Both values are not required.",
      "Update only the Daily worksheet using the selected SmartSell Master and the configured daily week logic.",
      "Preserve formulas, pivot tables, styles, and monthly worksheets. Daily processing must never clear or recalculate Monthly actual-week results.",
      "Record source row count, eligible unique visits, target period, target workbook, and changed rows in the run summary."
    ]
  },
  "salesforce-attendance-monthly": {
    title: "SalesForce Rep Attendance Monthly",
    rules: [
      "Read the combined Salesforce export from the approved SharePoint Rep Attendance Raw Data folder using the Nexus service integration. Do not open Salesforce, request MFA, or run the old portal download steps.",
      "Use the latest Updated South Africa Attendance Report-YYYY-MM-DD-HH-MM-SS.xlsx by its export timestamp. Validate the Salesforce As of header and explicit Visit Date start filter; the filename timestamp is not the reporting period.",
      "Read every SharePoint results page, even for large folders. A later upload of an older export must not replace the newest filename timestamp; accept a normal (1) browser copy suffix without changing that timestamp.",
      "Require a stable SharePoint version and the approved attendance columns. The entire selected monthly range must be inside the declared filter and end before the export day, which is partial. Stop for missing, stale, ambiguous or invalid input, without an older-file or Salesforce fallback and without workbook changes.",
      "Read the source without overwriting it. Keep the verified Nexus source copy and its provenance; a separate publisher must supply new exports to SharePoint.",
      "Use the operator-selected reconciliation start and end dates and selected Actual Week, or all Actual Weeks when explicitly selected.",
      "All Actual Weeks uses month start through yesterday in South African time, not the partial current day. On the first day of a month, finish the preceding month. Explicitly selected Actual Week ranges remain unchanged. Freeze the range when queued and preserve it across retries and the Blueprint handoff.",
      "If the required completed-day export has not arrived, retry every 10 minutes for at most two hours and 12 attempts. Never fall back to an older file or Salesforce. Stop without workbook changes for corrupt, ambiguous, changed, wrong-filter or still-incomplete input; report when the retry window is exhausted.",
      "A valid visit is present when either the check-in location or checkout location is 1.",
      "Update only South Africa Visit Plan actual-week fields from the assigned monthly SmartSell Master.",
      "Use the supplied actual-week/date range rather than inferring a week from the current date.",
      "Preserve Daily data, formulas, pivot tables, existing formatting, and non-target actual-week cells."
    ]
  },
  "salesforce-display-compliance": {
    title: "SalesForce Display Compliance Automation",
    rules: [
      "Use only Display and Visibility activity types and the administrator-approved customer/channel list.",
      "Keep each customer/channel report isolated; record missing, empty, or failed channels without replacing a successful channel result.",
      "Complete the source export before Phase 2. Phase 2 updates the approved template artifacts, including the configured File 2 and ZA POP Top outputs when their source rules are available.",
      "Do not download unapproved channels or create a result for a customer with no validated source data.",
      "Preserve workbook formulas, pivot tables, and existing layout when updating a template."
    ]
  },
  "powerbi-perfect-store": {
    title: "P&G Perfect Store SOS Overview",
    rules: [
      "Open the authorised SOS Overview page in the configured Power BI report.",
      "Clear visual filters before selecting the current month.",
      "Export data from the target SOS visual's More options menu, then validate the resulting file before controlled delivery.",
      "Authentication, MFA, SMS, or acknowledgement screens require user approval or input; never retry them automatically."
    ]
  },
  generic: {
    title: "Generic Nexus extraction",
    rules: [
      "Follow only the configured workflow steps and selected report date range.",
      "Validate downloads before delivery and keep one version per report identity.",
      "Never infer credentials, OTPs, portal selections, file mappings, or delivery paths."
    ]
  }
};

function playbookKeyForRun(run = {}) {
  const retailerId = String(run.retailerId || "").toLowerCase();
  const workflowMode = String(run.workflowMode || "").toLowerCase();
  const extractionName = String(run.extractionName || run.retailerName || "").toLowerCase();
  if (workflowMode === "salesforce-attendance-blueprint-update" && run.attendanceReportType === "Rep Attendance Monthly") return "salesforce-attendance-monthly";
  if (workflowMode === "salesforce-attendance-blueprint-update" && run.attendanceReportType === "Rep Attendance Daily") return "salesforce-attendance-daily";
  if (retailerId === "geo-rep" || workflowMode.includes("geo-rep-blueprint") || workflowMode === "geo-rep-form-report-import") return "geo-rep-capture";
  if (retailerId === "geo-rep-sales-transactions" || retailerId === "geo-rep-orders" || workflowMode.includes("geo-rep-sales-transactions")) return "geo-rep-sales-transactions";
  if (retailerId === "geo-rep-attendance-for-reps" || workflowMode.includes("geo-rep-rep-attendance")) return "geo-rep-attendance-reps";
  if (retailerId === "sales-force-p-g-monthly" || workflowMode.includes("monthly-attendance") || /attendance.*monthly|monthly.*attendance/.test(extractionName)) return "salesforce-attendance-monthly";
  if (retailerId === "sales-force-p-g" || workflowMode.includes("attendance") || /rep attendance/.test(extractionName)) return "salesforce-attendance-daily";
  if (retailerId === "salesforce-display-compliance-automation" || workflowMode.includes("display-compliance") || /display compliance/.test(extractionName)) return "salesforce-display-compliance";
  if (retailerId === "p-g-perfect-store" || workflowMode.includes("perfect-store") || /perfect store|sos overview/.test(extractionName)) return "powerbi-perfect-store";
  return "generic";
}

function automationPlaybookForRun(run = {}) {
  const key = playbookKeyForRun(run);
  const playbook = PLAYBOOKS[key] || PLAYBOOKS.generic;
  return { id: key, version: PLAYBOOK_VERSION, title: playbook.title, rules: playbook.rules };
}

module.exports = { automationPlaybookForRun, PLAYBOOK_VERSION };
