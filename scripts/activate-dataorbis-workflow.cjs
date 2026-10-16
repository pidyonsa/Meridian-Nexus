"use strict";
const fs = require("node:fs/promises"), path = require("node:path"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { api, json, fnUrl } = require("./release-multi-admin.cjs");
const { encode } = require("./update-dataorbis-validation.cjs");
const { decode } = require("../azure-field-dashboards/attendance-publisher/index.cjs");
const { stage } = require("./release-dataorbis-workflow.cjs");
const base = "https://firestore.googleapis.com/v1/projects/meridain-nexus/databases/(default)/documents";
const bucket = "meridain-nexus.firebasestorage.app", id = "dataorbis-game-sales";
const unpack = doc => decode({ mapValue: { fields: doc.fields } });
const read = async file => JSON.parse(await fs.readFile(path.join(stage, file), "utf8"));
const save = (file, value) => fs.writeFile(path.join(stage, file), JSON.stringify(value, null, 2), { flag: "wx" });
async function inputs() {
  const verification = await read("live-validation/final-verification.json");
  const files = { template: "C:/Users/PC/Downloads/Aug26- All Clients by Sku2 Final template.xlsx",
    cleanup: "C:/Users/PC/Documents/Meridian Nexus/ETL FILES/Non-Linked ETLs/SALES DATA STORE NAME CLEAN UP .xlsx",
    callCycle: "C:/Users/PC/Documents/Meridian Nexus/ETL FILES/Non-Linked ETLs/National_Call_Cycle_Masters 01.09.2026.xlsx" };
  const token = execFileSync("powershell.exe", ["-NoProfile", "-File", "C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1", "auth", "print-access-token", "--project=meridain-nexus", "--quiet"], { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "inherit"] }).trim();
  const descriptors = {};
  const uploadId = crypto.randomUUID();
  for (const [role, file] of Object.entries(files)) {
    const bytes = await fs.readFile(file), sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    assert.ok(bytes.length > 0 && bytes.length <= 25 * 1024 * 1024);
    if (role === "template") assert.equal(sha256, verification.templateSha256);
    const storagePath = `dataorbis-inputs/2026-08/${uploadId}/${role}-${sha256}.xlsx`;
    const md5Hash = crypto.createHash("md5").update(bytes).digest("base64");
    const response = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&ifGenerationMatch=0&name=${encodeURIComponent(storagePath)}`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-MD5": md5Hash }, body: bytes });
    assert.ok(response.ok, `Private ${role} upload failed: ${response.status}`);
    const object = await response.json();
    assert.equal(Number(object.size), bytes.length);
    assert.equal(object.md5Hash, md5Hash);
    descriptors[role] = { storagePath, sha256 };
    console.log(`Private ${role} upload checksum verified; worker SHA-256 readback required before use.`);
  }
  await save("approved-inputs.json", { ...descriptors, approved: true, month: "2026-08", approvedBy: "user-provided-template-and-ETL-procedure", approvedAt: new Date().toISOString() });
}
async function activate() {
  for (const name of ["processExtraction", "startExtraction", "getOperationsWorkspace"]) assert.equal((await json(fnUrl(name))).serviceConfig.revision, (await read(`${name}/after.json`)).serviceConfig.revision);
  const config = await read("approved-inputs.json");
  const before = await json(`${base}/retailers/${id}?mask.fieldPaths=salesProcedure&mask.fieldPaths=credentialsUpdatedAt&mask.fieldPaths=reportSchedule&mask.fieldPaths=restoration`);
  const data = unpack(before); assert.equal(data.salesProcedure.clientCode, "WILMAR");
  assert.notEqual(data.reportSchedule?.enabled, true);
  const fields = encode({ salesProcedure: { ...data.salesProcedure, automationReady: true, supplier: "WILMAR SA (PTY) LTD", excludeGameOnlineAndNonSa: true,
    validated: true, publicationEnabled: true, outputDestination: "nexus-files", validatedAt: new Date().toISOString() },
    extractionName: "Wilmar monthly Game / Makro / Jumbo sales", restoration: { ...data.restoration, status: "validated-manual-workflow", family: "dataorbis-monthly-sales" } }).mapValue.fields;
  const writes = [
    { update: { name: `${base.replace("https://firestore.googleapis.com/v1/", "")}/dataorbisMonthlyTemplates/2026-08`, fields: encode(config).mapValue.fields }, currentDocument: { exists: false } },
    { update: { name: before.name, fields }, updateMask: { fieldPaths: ["salesProcedure", "extractionName", "restoration"] }, currentDocument: { updateTime: before.updateTime } }
  ];
  await json(`${base}:commit`, "POST", { writes });
  const after = unpack(await json(`${base}/retailers/${id}?mask.fieldPaths=salesProcedure&mask.fieldPaths=credentialsUpdatedAt&mask.fieldPaths=reportSchedule`));
  assert.deepEqual(after.reportSchedule, data.reportSchedule); assert.equal(after.credentialsUpdatedAt, data.credentialsUpdatedAt);
  assert.equal(after.salesProcedure.automationReady, true);
  await save("activated.json", { at: new Date().toISOString(), profile: id, month: "2026-08", credentialsUnchanged: true, schedulesUnchanged: true, espensProfileUnchanged: true });
  console.log("Wilmar monthly workflow activated. Credentials, Espen and schedules unchanged.");
}
const actions = { inputs, activate };
Promise.resolve().then(() => { assert.ok(actions[process.argv[2]]); return actions[process.argv[2]](); }).catch(error => { console.error(error.message); process.exitCode = 1; });
