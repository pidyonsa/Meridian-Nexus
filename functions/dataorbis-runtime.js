"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs/promises"), os = require("node:os"), path = require("node:path"), crypto = require("node:crypto");
const ExcelJS = require("exceljs");
const portal = require("./dataorbis-portal"), sales = require("./dataorbis-sales"), workbook = require("./dataorbis-workbook");
const MODE = "dataorbis-monthly-sales";
const CLIENTS = { "dataorbis-game-sales": "WILMAR", "dataorbis-makro-sales": "ESPEN" };
const MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
function isProfile(id) { return Object.hasOwn(CLIENTS, id); }
function checkConfig(id, data) {
  assert.ok(isProfile(id));
  assert.equal(data.salesProcedure?.clientCode, CLIENTS[id]);
  assert.equal(data.salesProcedure?.automationReady, true, "The client workflow has not passed validation.");
  assert.equal(new URL(data.webAddress).origin, portal.ORIGIN);
  assert.ok(data.username, "Save the client's portal username in Extraction profiles.");
  assert.ok(typeof data.salesProcedure.supplier === "string" && data.salesProcedure.supplier.trim(), "Configure this client's exact DataOrbis supplier name.");
  assert.equal(data.salesProcedure.excludeGameOnlineAndNonSa, true, "The approved Game exclusion policy is missing.");
}
function descriptor(input) {
  assert.ok(input && typeof input.storagePath === "string" && /^(?:dataorbis-inputs|uploads)\//.test(input.storagePath) && !input.storagePath.split("/").includes(".."), "Approved input is missing.");
  assert.match(input.sha256 || "", /^[a-f0-9]{64}$/);
  return { storagePath: input.storagePath, sha256: input.sha256 };
}
async function queue({ db, FieldValue, HttpsError, request, retailerId, retailerData }) {
  let period;
  try {
    checkConfig(retailerId, retailerData);
    let start = request.data.reportStartDate, end = request.data.reportEndDate;
    if (!start && !end) {
      const now = new Date(Date.now() + 7200000), year = now.getUTCFullYear(), month = now.getUTCMonth();
      start = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
      end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    }
    period = workbook.monthRange(start, end);
  }
  catch (error) { throw new HttpsError("failed-precondition", error.message.split("\n")[0]); }
  const runRef = db.collection("extractionRuns").doc();
  const monthRef = db.collection("dataorbisMonthlyTemplates").doc(period.month);
  const batchRef = db.collection("dataorbisMonthlyBatches").doc(`${CLIENTS[retailerId]}-${period.month}`);
  return db.runTransaction(async tx => {
    const [monthSnap, batchSnap] = await Promise.all([tx.get(monthRef), tx.get(batchRef)]);
    if (batchSnap.data()?.status === "completed") return { runId: batchSnap.data().runId, reused: true };
    const config = monthSnap.data();
    if (!config?.approved || !config.template) throw new HttpsError("failed-precondition", "An approved all-clients template and store mappings are required for this reporting month.");
    if (config.activeRunId) {
      const active = (await tx.get(db.collection("extractionRuns").doc(config.activeRunId))).data();
      if (active && !active.cancellationRequestedAt && !["failed", "cancelled", "completed", "skipped_duplicate"].includes(active.status)) {
        throw new HttpsError("already-exists", "Another monthly DataOrbis job is active. Finish or cancel that job before starting another.");
      }
    }
    let inputs;
    try { inputs = { template: descriptor(config.template), cleanup: descriptor(config.cleanup), callCycle: descriptor(config.callCycle) }; }
    catch { throw new HttpsError("failed-precondition", "The approved monthly inputs are incomplete."); }
    const run = { retailerId, retailerName: retailerData.name, extractionName: `${CLIENTS[retailerId]} monthly Game / Makro / Jumbo sales`,
      workflowMode: MODE, extractionProfileId: retailerData.extractionProfileId || null, status: "queued", message: "Monthly sales extraction queued; enter the OTP in Nexus when prompted.",
      reportStartDate: period.start, reportEndDate: period.end, reportMonth: period.month, outputFileName: period.fileName,
      createdBy: request.auth.uid, promptOwnerUid: request.auth.uid, createdByEmail: request.auth.token?.email || null,
      createdAt: FieldValue.serverTimestamp(), dataorbis: { client: CLIENTS[retailerId], supplier: retailerData.salesProcedure.supplier, inputs, excludeGameOnlineAndNonSa: true },
      executionTimeline: [{ at: new Date().toISOString(), event: "queued", message: "Manual monthly sales extraction queued." }] };
    tx.create(runRef, run);
    tx.update(monthRef, { activeRunId: runRef.id, updatedAt: FieldValue.serverTimestamp() });
    tx.set(batchRef, { runId: runRef.id, status: "queued", month: period.month, client: CLIENTS[retailerId], updatedAt: FieldValue.serverTimestamp() });
    return { runId: runRef.id };
  });
}
async function failRun({ db, FieldValue, monthRef, batchRef, runRef, runId, message }) {
  await db.runTransaction(async tx => {
    const [monthSnap, runSnap, batchSnap] = await Promise.all([tx.get(monthRef), tx.get(runRef), tx.get(batchRef)]);
    if (runSnap.data()?.status === "completed") return;
    if (monthSnap.data()?.activeRunId === runId) tx.update(monthRef, { activeRunId: FieldValue.delete() });
    // A cancelled worker may finish after an admin has queued its replacement.
    if (batchSnap.data()?.runId === runId) tx.set(batchRef, { status: "failed", runId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.update(runRef, { status: runSnap.data()?.cancellationRequestedAt ? "cancelled" : "failed", message: `${message} No final workbook was committed.`, workbookChanged: false, completedAt: FieldValue.serverTimestamp() });
  });
}
async function processRun(event, context) {
  const { db, FieldValue, getStorage, decryptPassword, launchAutomationBrowser, ensureExtractionActive, appendRunTimeline, waitForAutomationPromptValue } = context;
  const runRef = event.data.ref, run = event.data.data(), runId = event.params.runId;
  const monthRef = db.collection("dataorbisMonthlyTemplates").doc(run.reportMonth);
  const batchRef = db.collection("dataorbisMonthlyBatches").doc(`${CLIENTS[run.retailerId]}-${run.reportMonth}`);
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "nexus-dataorbis-"));
  const deadline = Date.now() + 470000;
  const bucket = getStorage().bucket();
  let browser, step = 0;
  const active = async () => { await ensureExtractionActive(runRef); assert.ok(Date.now() < deadline, "Monthly extraction exceeded its safe execution window. No final workbook was published."); };
  const progress = async message => {
    await active();
    await runRef.update({ status: "running", message, currentStep: ++step, currentStepAction: "dataorbisMonthlySales", lastActivityAt: FieldValue.serverTimestamp() });
    await appendRunTimeline(runRef, "dataorbis-progress", message);
  };
  async function downloadInput(input, name) {
    descriptor(input);
    const target = path.join(directory, name);
    const file = bucket.file(input.storagePath), [metadata] = await file.getMetadata();
    assert.ok(Number(metadata.size) > 0 && Number(metadata.size) <= 25 * 1024 * 1024, "Approved input exceeds the workbook size limit.");
    await file.download({ destination: target });
    assert.equal(sales.sha(await fs.readFile(target)), input.sha256, "An approved input changed; reapprove it before running.");
    return target;
  }
  async function publish(filePath, name, kind) {
    await active();
    const bytes = await fs.readFile(filePath), sha256 = sales.sha(bytes), fileId = crypto.randomUUID();
    const storagePath = `uploads/${fileId}/${name}`;
    const [file] = await bucket.upload(filePath, { destination: storagePath, resumable: false, metadata: { contentType: MIME, metadata: { extractionRunId: runId, retailerId: run.retailerId, sha256, kind } } });
    const [readback] = await file.download();
    assert.equal(sales.sha(readback), sha256, "Stored workbook hash differs from the verified file.");
    await db.collection("files").doc(fileId).create({ name, originalName: name, size: bytes.length, type: MIME, storagePath, sha256,
      isDuplicate: false, source: "retailer-extraction", retailerId: run.retailerId, extractionRunId: runId, artifactKind: kind,
      reportStartDate: run.reportStartDate, reportEndDate: run.reportEndDate, createdAt: FieldValue.serverTimestamp(), uploadedAt: FieldValue.serverTimestamp(), completedAt: FieldValue.serverTimestamp() });
    return { fileId, fileName: name, fileSize: bytes.length, fileSha256: sha256, storagePath };
  }
  try {
    const retailer = (await db.collection("retailers").doc(run.retailerId).get()).data();
    checkConfig(run.retailerId, retailer);
    assert.equal(run.dataorbis?.client, CLIENTS[run.retailerId]);
    assert.equal(run.dataorbis?.supplier, retailer.salesProcedure.supplier, "Supplier changed after this run was queued.");
    assert.equal((await monthRef.get()).data()?.activeRunId, runId, "This run no longer owns the monthly workbook lock.");
    const period = workbook.monthRange(run.reportStartDate, run.reportEndDate);
    assert.equal(period.month, run.reportMonth);
    await progress("Checking the approved monthly template and store mappings.");
    const inputs = run.dataorbis.inputs;
    const templateFile = await downloadInput(inputs.template, "template.xlsx");
    const cleanup = await downloadInput(inputs.cleanup, "cleanup.xlsx");
    const callCycle = await downloadInput(inputs.callCycle, "call-cycle.xlsx");
    const template = await sales.inspectTemplate(templateFile, { month: period.month, client: run.dataorbis.client });
    assert.equal(template.conflictingRows, 0, "This client's monthly rows already exist in the template. They cannot be appended twice.");
    const references = await sales.readReferences(cleanup, callCycle);
    await progress("Signing into this client's DataOrbis account.");
    const session = await launchAutomationBrowser(directory);
    browser = session.browser;
    const page = session.page;
    const secret = (await db.collection("retailerSecrets").doc(run.retailerId).get()).data();
    assert.ok(secret?.ciphertext, "Save this client's password in Extraction profiles.");
    await portal.login(page, { url: retailer.webAddress, username: retailer.username, password: decryptPassword(secret), requestOtp: async attempt => {
      await active();
      return waitForAutomationPromptValue(page, runRef, runId, run,
        { value: `${attempt > 1 ? "The previous code was rejected. Enter a newly generated code. " : ""}${run.dataorbis.client}: enter the current six-digit DataOrbis code here in Nexus.` },
        `dataorbis-${attempt}`, "otp", { timeoutMs: Math.min(120000, Math.max(1000, deadline - Date.now() - 180000)) });
    } });
    const exports = [];
    for (const channel of ["game", "wholesale"]) exports.push(await portal.extractChannel(page, { channel, supplier: run.dataorbis.supplier, month: period.month, progress }));
    await browser.close(); browser = null;
    await progress("Reconciling store mappings, exclusions and source totals.");
    const rawRows = exports.flatMap(source => source.rows.map((v, i) => ({ sheet: source.channel === "game" ? "Game Raw Data" : "Makro Raw Data", line: i + 2, v })));
    const result = sales.transform(rawRows, references, { month: period.month, client: run.dataorbis.client, numericConvention: "literal-confirmed", referencesApproved: true,
      sourceComplete: true, excludeGameOnlineAndNonSa: true });
    const rawBook = new ExcelJS.Workbook();
    for (const name of ["Game Raw Data", "Makro Raw Data"]) { const sheet = rawBook.addWorksheet(name); sheet.addRow(sales.RAW_HEADERS); rawRows.filter(r => r.sheet === name).forEach(r => sheet.addRow(r.v)); }
    const rawPath = path.join(directory, "raw.xlsx"); await rawBook.xlsx.writeFile(rawPath);
    const rawFile = await publish(rawPath, `${run.dataorbis.client}-${period.month}-Raw.xlsx`, "dataorbis-raw");
    const auditPath = path.join(directory, "audit.xlsx");
    await fs.writeFile(auditPath, await sales.draftWorkbook(result, exports.map(({ channel, reconciliation, capturedAt }) => ({ channel, reconciliation, capturedAt })), { expectedRows: 0, matchedRows: 0, missing: [], extra: [] }));
    const auditFile = await publish(auditPath, `${run.dataorbis.client}-${period.month}-Validation.xlsx`, "dataorbis-audit");
    await runRef.update({ rawFileId: rawFile.fileId, auditFileId: auditFile.fileId, dataorbisTotals: result.totals });
    sales.assertPublishable(result, template);
    await progress("Building and reading back the all-clients workbook.");
    const outputPath = path.join(directory, period.fileName);
    const verification = await workbook.finalWorkbook(templateFile, outputPath, result);
    await progress("Saving the verified workbook to Nexus Files.");
    const final = await publish(outputPath, period.fileName, "dataorbis-final");
    await active();
    await db.runTransaction(async tx => {
      const [monthSnap, runSnap] = await Promise.all([tx.get(monthRef), tx.get(runRef)]);
      assert.equal(monthSnap.data()?.activeRunId, runId, "Monthly workbook lock changed before publication.");
      assert.equal(monthSnap.data()?.template?.sha256, inputs.template.sha256, "Monthly workbook changed before publication.");
      assert.ok(!runSnap.data()?.cancellationRequestedAt && runSnap.data()?.status === "running", "Job cancelled before final publication.");
      tx.update(monthRef, { template: { storagePath: final.storagePath, sha256: final.fileSha256 }, latestFileId: final.fileId, activeRunId: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
      tx.set(batchRef, { status: "completed", runId, fileId: final.fileId, batchDigest: result.batchDigest, completedAt: FieldValue.serverTimestamp() }, { merge: true });
      tx.update(runRef, { ...final, status: "completed", message: `${period.fileName} verified and saved. ${verification.originalRows} existing rows preserved; ${verification.appendedRows} client rows added.`,
        workbookChanged: true, verification, completedAt: FieldValue.serverTimestamp(), lastActivityAt: FieldValue.serverTimestamp() });
    });
    await appendRunTimeline(runRef, "completed", "Final workbook, other-client preservation and private-storage readback verified.");
  } catch (error) {
    const message = String(error.message || "DataOrbis extraction failed.").split("\n")[0].slice(0, 500);
    await failRun({ db, FieldValue, monthRef, batchRef, runRef, runId, message });
  } finally {
    if (browser) await browser.close().catch(() => {});
    const prompts = await db.collection("automationPrompts").where("runId", "==", runId).get().catch(() => null);
    for (const prompt of prompts?.docs || []) await prompt.ref.set({ status: "closed", value: FieldValue.delete(), closedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});
    assert.equal(path.dirname(directory), os.tmpdir());
    await fs.rm(directory, { recursive: true, force: true }).catch(() => {});
  }
}
module.exports = { MODE, CLIENTS, isProfile, checkConfig, descriptor, queue, failRun, processRun };
