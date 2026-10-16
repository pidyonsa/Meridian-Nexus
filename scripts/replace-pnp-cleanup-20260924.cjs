"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const engine = require("../etl-worker/engine.cjs"), { files, folder } = require("./test-anchor-etl-real.cjs");
const { json, hash } = require("./release-multi-admin.cjs"), { gc } = require("./release-etls.cjs");
const { fields } = require("./refresh-national-master-20260924.cjs");
const source = "C:/Users/PC/Downloads/OneDrive_2_9-24-2026/SALES DATA STORE NAME CLEAN UP .xlsx";
const stage = path.resolve(__dirname, "../.tmp/pnp-corrected-stores-20260924");
const project = "meridain-nexus", bucket = "meridain-nexus.firebasestorage.app";
const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const refKey = "etlReferenceSets/anchor-pnp-v1", actor = "nexus-authorized-pnp-store-refresh-20260924";
const type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const read = file => JSON.parse(fs.readFileSync(path.join(stage, file), "utf8"));
function save(file, value) {
  const target = path.resolve(stage, file); assert.ok(target.startsWith(stage + path.sep));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, Buffer.isBuffer(value) || typeof value === "string" ? value : JSON.stringify(value, null, 2), { flag: "wx" });
}
const encode = value => value === null ? { nullValue: null } : typeof value === "string" ? { stringValue: value }
  : typeof value === "boolean" ? { booleanValue: value } : typeof value === "number" ? { integerValue: String(value) }
  : Array.isArray(value) ? { arrayValue: { values: value.map(encode) } }
  : { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, v]) => [key, encode(v)])) } };
async function audit() {
  const refs = await json(`${base}/${refKey}`), data = fields(refs);
  assert.equal(data.resources.stores, "inventory-anchor-stores", "Review a changed active store Resource before replacing it.");
  const documents = {};
  for (const [role, id] of Object.entries(data.resources)) {
    assert.match(id, /^[A-Za-z0-9_-]{1,160}$/); documents[role] = await json(`${base}/portalResources/${id}`);
    assert.notEqual(fields(documents[role]).active, false);
  }
  const bytes = fs.readFileSync(source), rows = await engine.readWorkbook(bytes, "stores");
  const resource = fields(documents.stores), sha256 = hash(bytes);
  assert.notEqual(resource.sha256, sha256, "This exact corrected workbook is already active; verify rather than publish again.");
  save("audit.json", { at: new Date().toISOString(), refs, documents });
  save("source.xlsx", bytes);
  save("manifest.json", { id: data.resources.stores, sourceName: path.basename(source), size: bytes.length, sha256,
    md5Hash: crypto.createHash("md5").update(bytes).digest("base64"), rows: rows.length,
    referenceCellErrorCount: rows.reduce((n, row) => n + (row.cellErrors?.length || 0), 0),
    storagePath: `portal-resources/${data.resources.stores}/${sha256.slice(0, 16)}_${path.basename(source)}` });
  console.log(JSON.stringify({ source: path.basename(source), rows: rows.length, referenceRevision: Number(data.revision),
    activeReferences: Object.fromEntries(Object.entries(documents).map(([role, doc]) => [role, { sourceName: fields(doc).sourceName, sha256: fields(doc).sha256 }])) }, null, 2));
}
async function validate() {
  const before = read("audit.json"), manifest = read("manifest.json"), data = {}, checksums = {};
  const oldManifest = JSON.parse(fs.readFileSync(path.resolve(".tmp/national-master-20260924/manifest.json"), "utf8"));
  for (const [role, name] of Object.entries(files)) {
    const file = role === "stores" ? path.join(stage, "source.xlsx")
      : role === "staffing" ? oldManifest.find(item => item.id === fields(before.refs).resources.staffing).file : path.join(folder, name);
    const bytes = fs.readFileSync(file); checksums[role] = hash(bytes);
    if (role === "stores") assert.equal(checksums[role], manifest.sha256);
    else if (role !== "raw") assert.equal(checksums[role], fields(before.documents[role]).sha256, `Local ${role} differs from the active Resource; do not claim a current-reference replay.`);
    data[role] = await engine.readWorkbook(bytes, role);
  }
  const rules = { salesDays: 30, openPO: "unknown", bannerColumn: "D", reportDate: "exported", productFamily: "PICK N PAY CORPORATE", confirmed: true };
  const result = engine.transform(data, rules, files.raw, engine.ACCEPTED_MAPPING_POLICY);
  assert.ok(result.reconciled); assert.equal(result.totals.inputRows, 3462); assert.equal(result.totals.sourceStoreSOH, 141358);
  const stores = new Map();
  for (const row of result.exceptions) {
    const key = JSON.stringify([row.siteCode, row.rawName]);
    if (!stores.has(key)) stores.set(key, { siteCode: row.siteCode, sourceName: row.rawName, rowCount: 0, errors: row.errors });
    stores.get(key).rowCount++;
  }
  const summary = { at: new Date().toISOString(), localReplayOnly: true, source: files.raw, asOf: result.asOf, correctedStoreSha256: manifest.sha256,
    checksums, mappingPolicy: result.mappingPolicy, status: result.status, reconciled: result.reconciled, totals: result.totals,
    issueCounts: result.issueCounts, warningCounts: result.warningCounts, remainingStores: [...stores.values()],
    referenceCellErrors: result.referenceCellErrors.filter(row => row.role === "stores") };
  save("validation.json", summary);
  save("inventory-local-validation.xlsx", await engine.exportWorkbook(result, { note: "LOCAL VALIDATION ONLY - NOT APPROVED", checksums }));
  console.log(JSON.stringify(summary, null, 2));
}
async function upload() {
  const validation = read("validation.json"), manifest = read("manifest.json"), bytes = fs.readFileSync(path.join(stage, "source.xlsx"));
  assert.ok(validation.reconciled); assert.equal(hash(bytes), manifest.sha256); assert.equal(hash(fs.readFileSync(source)), manifest.sha256);
  assert.equal((await json(`${base}/${refKey}`)).updateTime, read("audit.json").refs.updateTime);
  assert.equal((await json(`${base}/portalResources/${manifest.id}`)).updateTime, read("audit.json").documents.stores.updateTime);
  const token = gc("auth", "print-access-token", `--project=${project}`, "--quiet").trim();
  const boundary = "nexus_" + crypto.randomBytes(12).toString("hex");
  const metadata = { name: manifest.storagePath, contentType: type, cacheControl: "private, no-store",
    metadata: { resourceId: manifest.id, source: "user-corrected-pnp-store-cleanup-20260924", sha256: manifest.sha256 } };
  const body = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${type}\r\n\r\n`), bytes, Buffer.from(`\r\n--${boundary}--\r\n`)]);
  const response = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=multipart&ifGenerationMatch=0`, {
    method: "POST", redirect: "error", headers: { Authorization: `Bearer ${token}`, "x-goog-user-project": project, "Content-Type": `multipart/related; boundary=${boundary}` },
    body, signal: AbortSignal.timeout(120000) });
  assert.ok(response.ok, `Create-only private upload returned HTTP ${response.status}; no Resource pointer changed.`);
  const stored = await response.json(); assert.equal(stored.name, manifest.storagePath); assert.equal(stored.md5Hash, manifest.md5Hash);
  assert.equal(Number(stored.size), manifest.size); assert.equal(stored.metadata.sha256, manifest.sha256); assert.ok(!stored.metadata.firebaseStorageDownloadTokens);
  save("uploaded.json", { ...manifest, generation: stored.generation, md5Hash: stored.md5Hash, uploadedAt: new Date().toISOString() });
  console.log("Corrected workbook uploaded unchanged as a private version; upload checksum verified.");
}
async function publish() {
  const audit = read("audit.json"), item = read("uploaded.json"), refs = fields(audit.refs), resource = fields(audit.documents.stores);
  assert.ok(read("validation.json").reconciled); assert.equal(hash(fs.readFileSync(source)), item.sha256);
  assert.ok(!fs.existsSync(path.join(stage, "published.json")), "Already published; verify rather than replay.");
  const now = new Date().toISOString();
  const versions = [...(resource.versions || [])];
  if (!versions.some(v => v.storagePath === resource.storagePath)) versions.push({ storagePath: resource.storagePath, sourceName: resource.sourceName, size: Number(resource.size), type: resource.type || type, sha256: resource.sha256, savedAt: resource.updatedAt || now, ...(resource.generation ? { generation: resource.generation } : {}) });
  versions.push({ storagePath: item.storagePath, sourceName: item.sourceName, size: item.size, type, sha256: item.sha256, generation: item.generation, savedAt: now });
  const changes = { title: "Store name clean-up - corrected 24 September 2026", description: "User-corrected store clean-up workbook, uploaded unchanged on 24 September 2026. Active reference for future Anchor / Pick n Pay inventory runs. Previous versions and completed outputs retained.",
    sourceName: item.sourceName, storagePath: item.storagePath, size: item.size, type, sha256: item.sha256, generation: item.generation,
    sourceResourceId: null, sourceSha256: item.sha256, active: true, versions, updatedAt: now, updatedBy: actor };
  const revision = Number(refs.revision) + 1; assert.ok(Number.isSafeInteger(revision));
  const refChanges = { revision, updatedAt: now, updatedBy: { uid: actor, email: "" } };
  const writes = [[audit.documents.stores, changes], [audit.refs, refChanges]].map(([doc, values]) => ({
    update: { name: doc.name, fields: encode(values).mapValue.fields }, updateMask: { fieldPaths: Object.keys(values) }, currentDocument: { updateTime: doc.updateTime }
  }));
  // Preserve the exact Firestore types and fields of historical versions.
  const historicalVersions = audit.documents.stores.fields.versions?.arrayValue?.values || [];
  writes[0].update.fields.versions.arrayValue.values.splice(0, historicalVersions.length, ...historicalVersions);
  save("publish-writes.json", writes);
  const result = await json(`${base}:commit`, "POST", { writes }); assert.equal(result.writeResults.length, 2);
  save("published.json", { at: now, commitTime: result.commitTime, id: item.id, referenceRevision: revision, storagePath: item.storagePath,
    sourceName: item.sourceName, sha256: item.sha256, generation: item.generation, completedOutputsChanged: false, businessJobsStarted: 0 });
  console.log(`Existing store Resource replaced; active reference revision is ${revision}. Completed outputs are unchanged.`);
}
async function verify() {
  const before = read("audit.json"), writes = read("publish-writes.json"), checked = [];
  for (const write of writes) {
    const key = write.update.name.split("/documents/")[1], current = await json(`${base}/${key}`);
    for (const field of write.updateMask.fieldPaths) assert.deepEqual(current.fields[field], write.update.fields[field], `${key}/${field}`);
    const original = key === refKey ? before.refs : before.documents.stores;
    for (const [key, value] of Object.entries(original.fields)) if (!write.updateMask.fieldPaths.includes(key)) assert.deepEqual(current.fields[key], value, `Unrelated field ${key}`);
    checked.push({ key, updateTime: current.updateTime });
  }
  for (const [role, doc] of Object.entries(before.documents)) if (role !== "stores") {
    const current = await json(`${base}/${doc.name.split("/documents/")[1]}`); assert.equal(current.updateTime, doc.updateTime, `${role} reference changed during validation.`);
  }
  save("verified.json", { ...read("published.json"), verifiedAt: new Date().toISOString(), documents: checked, otherReferencesUnchanged: true,
    privateUploadChecksumVerified: true, localReplay: read("validation.json").totals, readyToRerun: true });
  console.log(JSON.stringify(read("verified.json"), null, 2));
}
const actions = { audit, validate, upload, publish, verify };
if (require.main === module) Promise.resolve().then(() => { assert.ok(actions[process.argv[2]], "Choose audit, validate, upload, publish or verify"); return actions[process.argv[2]](); }).catch(error => { console.error(error.stack); process.exitCode = 1; });
