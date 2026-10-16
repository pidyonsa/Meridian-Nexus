"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const JSZip = require("../functions/node_modules/jszip");
const { api, json, fnUrl, hash, fileHashes } = require("./release-multi-admin.cjs");

const root = path.resolve(__dirname, ".."), stage = path.join(root, ".tmp/georep-attendance-recovery-20260928");
const name = "processExtraction";
const read = file => JSON.parse(fs.readFileSync(path.join(stage, file), "utf8"));
const save = (file, value) => {
  const target = path.join(stage, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2), { flag: "wx" });
};
const text = file => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
function once(source, from, to) {
  assert.equal(source.split(from).length, 2, `Expected one scoped source anchor: ${from.slice(0, 100)}`);
  return source.replace(from, to);
}
function within(source, from, to, transform) {
  const start = source.indexOf(from), end = source.indexOf(to, start);
  assert.ok(start >= 0 && end > start, `Missing scoped block: ${from}`);
  return source.slice(0, start) + transform(source.slice(start, end)) + source.slice(end);
}
async function liveSource(functionInfo) {
  const source = functionInfo.buildConfig.source.storageSource;
  return JSZip.loadAsync(await (await api(`https://storage.googleapis.com/storage/v1/b/${source.bucket}/o/${encodeURIComponent(source.object)}?alt=media&generation=${source.generation}`)).arrayBuffer());
}
async function audit() {
  assert.ok(!fs.existsSync(stage), "A recovery release stage already exists; preserve its evidence.");
  const fn = await json(fnUrl(name));
  save("before.json", fn);
  save("iam.before.json", await json(`https://run.googleapis.com/v2/${fn.serviceConfig.service}:getIamPolicy`));
  const zip = await liveSource(fn);
  for (const entry of Object.values(zip.files)) if (!entry.dir) save("source/" + entry.name, await entry.async("nodebuffer"));
  assert.ok(fs.existsSync(path.join(stage, "source/index.js")), "Live extraction worker has no index.js");
  console.log("Captured the exact live extraction worker. No jobs or schedules changed.");
}
function applyRecovery(source) {
  source = within(source, "async function geoRepDownloadRepAttendanceReport", "async function loginToGeoRepPortal", segment => {
    segment = once(segment,
      "async function geoRepDownloadRepAttendanceReport(page, downloadDir, run, reportName) {",
      "async function geoRepDownloadRepAttendanceReport(page, downloadDir, run, reportName, context = {}) {");
    segment = once(segment,
      "  const startedAt = Date.now();\n  await page.evaluate(() => {",
      "  const startedAt = Date.now();\n  const responseCapture = captureGeoRepDownloadResponse(page, downloadDir);\n  try {\n    await page.evaluate(() => {");
    return once(segment,
      "  });\n  const attendanceDownloadTimeout = /schedule/i.test(String(reportName || \"\")) ? 360000 : 240000;\n  const downloaded = await waitForDownload(downloadDir, startedAt, attendanceDownloadTimeout);\n  const repFilter = await filterGeoRepRepAttendanceWorkbook(downloaded.filePath, reportName);\n  const stat = await fs.stat(downloaded.filePath);\n  return { ...downloaded, size: stat.size, repFilter };\n}\n\n",
      "    });\n    const attendanceDownloadTimeout = /schedule/i.test(String(reportName || \"\")) ? 360000 : 240000;\n    const downloaded = await waitForGeoRepReportResult(page, downloadDir, startedAt, attendanceDownloadTimeout, {\n      ...context,\n      responseCapture: responseCapture.capture\n    });\n    const repFilter = await filterGeoRepRepAttendanceWorkbook(downloaded.filePath, reportName);\n    const stat = await fs.stat(downloaded.filePath);\n    return { ...downloaded, size: stat.size, repFilter };\n  } finally {\n    responseCapture.dispose();\n  }\n}\n\n");
  });
  source = once(source,
    "function geoRepReportsMenuUnavailable(error) {\n  return /could not find the reports menu item|ended the session while opening/i.test(String(error?.message || error));\n}\n",
    "function geoRepReportsMenuUnavailable(error) {\n  return /could not find the reports menu item|ended the session while opening/i.test(String(error?.message || error));\n}\n\nfunction geoRepSessionExpired(error) {\n  return /session_expired|access has expired|ended the session while opening/i.test(String(error?.message || error));\n}\n");
  source = within(source, "  if (step.action === \"geoRepDownloadRepAttendanceReport\")", "  if (step.action === \"powerBiLogin\")", segment => {
    segment = once(segment,
      "      return await geoRepDownloadRepAttendanceReport(page, downloadDir, run, step.value);\n    } catch (error) {\n      if (!retailer.repAttendanceFallback || !geoRepReportsMenuUnavailable(error)) throw error;",
      "      return await geoRepDownloadRepAttendanceReport(page, downloadDir, run, step.value, context);\n    } catch (error) {\n      if (geoRepSessionExpired(error)) {\n        await context.runRef?.set({\n          message: \"Geo Rep ended the portal session while opening Attendance. Signing in once more and retrying the report.\",\n          lastActivityAt: FieldValue.serverTimestamp()\n        }, { merge: true });\n        await appendRunTimeline(context.runRef, \"geo-rep-session-restored\", \"Geo Rep ended the portal session; Nexus is signing in once more before retrying Attendance.\", {\n          step: context.stepNumber || null,\n          action: \"geoRepDownloadRepAttendanceReport\"\n        });\n        await loginToGeoRepPortal(page, retailer);\n        return geoRepDownloadRepAttendanceReport(page, downloadDir, run, step.value, context);\n      }\n      if (!retailer.repAttendanceFallback || !geoRepReportsMenuUnavailable(error)) throw error;");
    return once(segment,
      "      return geoRepDownloadRepAttendanceReport(page, downloadDir, run, step.value);\n    }\n  }\n",
      "      return geoRepDownloadRepAttendanceReport(page, downloadDir, run, step.value, context);\n    }\n  }\n");
  });
  return source;
}
function prepare() {
  const sourceRoot = path.join(stage, "source"), deploy = path.join(stage, "deploy");
  fs.cpSync(sourceRoot, deploy, { recursive: true });
  const before = text(path.join(sourceRoot, "index.js")), after = applyRecovery(before);
  fs.writeFileSync(path.join(deploy, "index.js"), after);
  const beforeHashes = fileHashes(sourceRoot), afterHashes = fileHashes(deploy);
  assert.deepEqual(Object.keys(afterHashes), Object.keys(beforeHashes));
  for (const file of Object.keys(beforeHashes)) if (file !== "index.js") assert.equal(afterHashes[file], beforeHashes[file], `Unexpected changed source file: ${file}`);
  assert.notEqual(afterHashes["index.js"], beforeHashes["index.js"]);
  save("prepared.json", { before: beforeHashes, after: afterHashes });
  console.log("Prepared only the Geo Rep Attendance session/download recovery changes.");
}
function test() {
  const prepared = read("prepared.json"), before = text(path.join(stage, "source/index.js")), after = text(path.join(stage, "deploy/index.js"));
  assert.deepEqual(fileHashes(path.join(stage, "source")), prepared.before);
  assert.deepEqual(fileHashes(path.join(stage, "deploy")), prepared.after);
  assert.equal(applyRecovery(before), after);
  assert.match(after, /captureGeoRepDownloadResponse\(page, downloadDir\)/);
  assert.match(after, /waitForGeoRepReportResult\(page, downloadDir, startedAt, attendanceDownloadTimeout/);
  assert.match(after, /function geoRepSessionExpired\(error\)/);
  assert.match(after, /geo-rep-session-restored/);
  require("node:child_process").execFileSync(process.execPath, ["--check", path.join(stage, "deploy/index.js")], { stdio: "inherit", windowsHide: true });
  save("tested.json", { ...prepared, at: new Date().toISOString() });
  console.log("Recovery syntax and exact scoped-source checks passed.");
}
async function poll(operation) {
  for (let i = 0; i < 80; i++) {
    const result = await json("https://cloudfunctions.googleapis.com/v2/" + operation.name);
    if (result.done) { assert.ok(!result.error, JSON.stringify(result.error)); return result; }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  throw Error("Deployment is still running; inspect the saved operation before retrying.");
}
async function deploy() {
  const before = read("before.json"), current = await json(fnUrl(name));
  assert.equal(current.serviceConfig.revision, before.serviceConfig.revision, "Live extraction worker changed after review.");
  assert.deepEqual(await json(`https://run.googleapis.com/v2/${current.serviceConfig.service}:getIamPolicy`), read("iam.before.json"));
  assert.deepEqual(fileHashes(path.join(stage, "deploy")), read("tested.json").after);
  const zip = new JSZip();
  for (const file of Object.keys(read("tested.json").after)) zip.file(file, fs.readFileSync(path.join(stage, "deploy", file)));
  const upload = await json("https://cloudfunctions.googleapis.com/v2/projects/meridain-nexus/locations/us-central1/functions:generateUploadUrl", "POST", {});
  const response = await fetch(upload.uploadUrl, { method: "PUT", headers: { "content-type": "application/zip" }, body: await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }) });
  assert.ok(response.ok, "Source upload failed");
  const operation = await json(fnUrl(name) + "?updateMask=buildConfig.source", "PATCH", { name: before.name, buildConfig: { source: { storageSource: upload.storageSource } } });
  save("operation.json", operation);
  await poll(operation);
  const after = await json(fnUrl(name));
  assert.equal(after.state, "ACTIVE");
  save("after.json", after);
  console.log("Geo Rep Attendance recovery deployed. No run was started by deployment.");
}
async function verify() {
  const before = read("before.json"), after = await json(fnUrl(name)), tested = read("tested.json");
  assert.equal(after.state, "ACTIVE");
  assert.equal(after.serviceConfig.revision, read("after.json").serviceConfig.revision);
  for (const key of ["serviceAccountEmail", "environmentVariables", "secretEnvironmentVariables", "availableMemory", "availableCpu", "maxInstanceCount", "minInstanceCount", "maxInstanceRequestConcurrency", "timeoutSeconds", "ingressSettings"]) assert.deepEqual(after.serviceConfig[key], before.serviceConfig[key], key);
  assert.deepEqual(await json(`https://run.googleapis.com/v2/${after.serviceConfig.service}:getIamPolicy`), read("iam.before.json"));
  const zip = await liveSource(after);
  for (const [file, digest] of Object.entries(tested.after)) assert.equal(hash(await zip.file(file).async("nodebuffer")), digest, file);
  save("verified.json", { at: new Date().toISOString(), revision: after.serviceConfig.revision, runtimeAndIamPreserved: true, jobsStarted: false });
  console.log("Live recovery source, runtime settings and IAM verified.");
}
const action = process.argv[2];
Promise.resolve().then(() => {
  const handler = ({ audit, prepare, test, deploy, verify })[action];
  assert.ok(handler, "Use audit, prepare, test, deploy or verify");
  return handler();
}).catch(error => { console.error(error.stack); process.exitCode = 1; });
