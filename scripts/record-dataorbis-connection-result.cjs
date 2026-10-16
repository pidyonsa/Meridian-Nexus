"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { json } = require("./release-multi-admin.cjs");
const { fields } = require("./validate-dataorbis-connection.cjs");
const { decode } = require("../azure-field-dashboards/attendance-publisher/index.cjs");
const runId = "dataorbis-wilmar-connection-3aa66bd7-c6f6-4c82-a635-555a342b9593";
async function main() {
  assert.equal(process.argv[2], "record-observed-check");
  const base = "https://firestore.googleapis.com/v1/projects/meridain-nexus/databases/(default)/documents";
  const url = `${base}/extractionRuns/${runId}`;
  const doc = await json(url), run = decode({ mapValue: { fields: doc.fields } });
  assert.equal(run.workflowMode, "dataorbis-connection-validation");
  assert.equal(run.retailerId, "dataorbis-game-sales");
  assert.equal(run.status, "cancelled", "Close the diagnostic browser before recording the result.");
  assert.equal(run.publicationEnabled, false);
  const at = new Date().toISOString();
  const result = {
    message: "Wilmar OTP entered in Nexus was accepted by DataOrbis. Game and Makro/Masscash Wholesale monthly report pages loaded. Connection check closed as planned; no raw report export or monthly workbook publication was run.",
    connectionValidation: { verified: true, checkedAt: at, otpEntry: "nexus-owner-prompt", monthlyReportPagesAccessible: ["Game", "Makro / Masscash Wholesale"], supplierAndMonthScoped: false, noReportExport: true, noWorkbookPublication: true },
    executionTimeline: [...(run.executionTimeline || []), { at, event: "connection-verified", message: "Recorded observed authenticated report access. This is not a completed monthly extraction." }]
  };
  const query = new URLSearchParams({ "currentDocument.updateTime": doc.updateTime });
  for (const key of Object.keys(result)) query.append("updateMask.fieldPaths", key);
  await json(`${url}?${query}`, "PATCH", { fields: fields(result) });
  const verification = decode({ mapValue: { fields: (await json(`${url}?mask.fieldPaths=status&mask.fieldPaths=connectionValidation`)).fields } });
  assert.equal(verification.connectionValidation.verified, true);
  assert.equal(verification.status, "cancelled");
  const file = path.resolve(__dirname, "../.tmp/dataorbis-otp-race-20260923/connection-result.json");
  fs.writeFileSync(file, JSON.stringify({ runId, ...verification }, null, 2), { flag: "wx" });
  console.log(JSON.stringify({ runId, connectionVerified: true, extractedReports: 0, publishedWorkbooks: 0 }));
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
