"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), assert = require("node:assert/strict");
const ExcelJS = require("../etl-worker/node_modules/exceljs");
const engine = require("../etl-worker/engine.cjs"), { gc, stage } = require("./release-etl-references.cjs");
const source = "C:/Users/PC/Documents/Meridian Nexus/ETL FILES/Non-Linked ETLs/ANCHOR";
const entries = {
  products: ["Product List.xlsx", "Product List", "Meridian Product Master"],
  stores: ["SALES DATA STORE NAME CLEAN UP .xlsx", "Store name clean-up", "Reference"],
  staffing: ["National_Call_Cycle_Masters 01.09.2026.xlsx", "Store / call-cycle master", "Meridian Store Master"],
  dc: ["DC Mapping File.xlsx", "DC mapping", "Reference"],
  status: ["PNP Status Codes.xlsx", "PnP status codes", "Reference"],
  template: ["Inventory Template.xlsx", "Inventory template", "Template"]
};
const project = "meridain-nexus", bucket = "meridain-nexus.firebasestorage.app", base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const output = path.join(stage, "resources"), json = f => JSON.parse(fs.readFileSync(path.join(output, f), "utf8"));
const encode = value => typeof value === "string" ? { stringValue: value } : typeof value === "number" ? { integerValue: String(value) } : typeof value === "boolean" ? { booleanValue: value } : Array.isArray(value) ? { arrayValue: { values: value.map(encode) } } : { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)])) } };
async function prepare() {
  fs.mkdirSync(output, { recursive: true });
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(path.join(source, "Transformed Inventory File- Anchor.xlsx"));
  const original = wb.getWorksheet("Template"), blank = new ExcelJS.Workbook(), sheet = blank.addWorksheet("Template", { views: [{ state: "frozen", ySplit: 1 }] });
  assert.equal(original.columnCount, 17);
  for (let i = 1; i <= 17; i++) {
    assert.equal(engine.norm(original.getRow(1).getCell(i).value), engine.norm(engine.HEADERS[i - 1]));
    sheet.getCell(1, i).value = original.getCell(1, i).value;
    sheet.getCell(1, i).style = structuredClone(original.getCell(1, i).style);
    sheet.getColumn(i).width = original.getColumn(i).width || 24;
    sheet.getCell(2, i).style = structuredClone(original.getCell(2, i).style);
  }
  sheet.getRow(1).height = original.getRow(1).height;
  const template = Buffer.from(await blank.xlsx.writeBuffer()); await engine.readTemplate(template);
  fs.writeFileSync(path.join(output, "Inventory Template.xlsx"), template);
  const manifest = [];
  for (const [role, [name, title, category]] of Object.entries(entries)) {
    const bytes = role === "template" ? template : fs.readFileSync(path.join(source, name));
    const rows = role === "template" ? [] : await engine.readWorkbook(bytes, role);
    const file = path.join(output, name); if (role !== "template") fs.writeFileSync(file, bytes);
    manifest.push({ role, name, title, category, file, size: bytes.length, sha256: engine.sha(bytes), md5: crypto.createHash("md5").update(bytes).digest("base64"), rows: rows.length, id: `inventory-anchor-${role}`, storagePath: `portal-resources/inventory-anchor-${role}/${engine.sha(bytes).slice(0, 16)}_${name}` });
  }
  fs.writeFileSync(path.join(output, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest.map(({ role, name, size, rows }) => ({ role, name, size, rows })), null, 2));
}
async function upload() {
  const token = gc("auth", "print-access-token", `--project=${project}`, "--quiet").trim();
  const api = async (url, options = {}) => {
    const r = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, "x-goog-user-project": project, ...options.headers }, signal: AbortSignal.timeout(120000) });
    if (r.status === 404 && !options.method) return null;
    if (!r.ok) throw new Error(`Resource import HTTP ${r.status}: ${new URL(url).pathname}`);
    return r.json();
  };
  const manifest = json("manifest.json"), referenceUrl = `${base}/etlReferenceSets/anchor-pnp-v1`;
  assert.equal(await api(referenceUrl), null, "A reference set already exists. Use Resources instead of overwriting it.");
  const listed = await api(`${base}:runQuery`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "portalResources" }], select: { fields: ["title", "sourceName", "tags", "storagePath"].map(fieldPath => ({ fieldPath })) }, limit: 501 } }) });
  const existing = listed.filter(r => r.document).map(r => r.document); assert.ok(existing.length < 501);
  fs.writeFileSync(path.join(output, "before.json"), JSON.stringify(existing, null, 2));
  for (const item of manifest) {
    assert.ok(!existing.some(d => d.name.endsWith(`/portalResources/${item.id}`) || d.fields?.sourceName?.stringValue === item.name), `${item.name} is already in Resources. Review and reuse it rather than duplicate it.`);
  }
  const writes = [], now = new Date().toISOString(), actor = "nexus-shared-inventory-import-20260910";
  for (const item of manifest) {
    const bytes = fs.readFileSync(item.file); assert.equal(engine.sha(bytes), item.sha256);
    let metadata = await api(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(item.storagePath)}`);
    if (!metadata) {
      const boundary = `nexus_${crypto.randomBytes(12).toString("hex")}`;
      const meta = { name: item.storagePath, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", cacheControl: "private, no-store", metadata: { resourceId: item.id, source: "nexus-resources", sha256: item.sha256 } };
      const body = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${meta.contentType}\r\n\r\n`), bytes, Buffer.from(`\r\n--${boundary}--\r\n`)]);
      metadata = await api(`https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=multipart&ifGenerationMatch=0`, { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body });
    }
    assert.equal(metadata.md5Hash, item.md5); assert.equal(Number(metadata.size), item.size); assert.ok(!metadata.metadata?.firebaseStorageDownloadTokens);
    const data = { title: item.title, category: item.category, sourceName: item.name, storagePath: item.storagePath, size: item.size, type: metadata.contentType, active: true, tags: ["etl", "anchor", `etl-anchor-${item.role}`], description: item.role === "template" ? "Blank 17-column inventory template derived from the supplied Anchor output. Contains no historical inventory rows." : "Shared inventory reference from the supplied Anchor folder. Replace this resource to update future runs.", sha256: item.sha256, createdAt: now, updatedAt: now, createdBy: actor, updatedBy: actor, versions: [{ storagePath: item.storagePath, sourceName: item.name, size: item.size, type: metadata.contentType, savedAt: now }] };
    writes.push({ update: { name: `projects/${project}/databases/(default)/documents/portalResources/${item.id}`, fields: encode(data).mapValue.fields }, currentDocument: { exists: false } });
  }
  writes.push({ update: { name: `projects/${project}/databases/(default)/documents/etlReferenceSets/anchor-pnp-v1`, fields: encode({ resources: Object.fromEntries(manifest.map(i => [i.role, i.id])), revision: 1, updatedAt: now, updatedBy: { uid: actor, email: "" } }).mapValue.fields }, currentDocument: { exists: false } });
  await api(`${base}:commit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ writes }) });
  for (const item of manifest) { const record = await api(`${base}/portalResources/${item.id}`); assert.equal(record.fields.sha256.stringValue, item.sha256); assert.equal(record.fields.storagePath.stringValue, item.storagePath); }
  const refs = await api(referenceUrl); assert.equal(refs.fields.revision.integerValue, "1");
  const evidence = { verifiedAt: new Date().toISOString(), resources: manifest.map(({ role, id, name, sha256 }) => ({ role, id, name, sha256 })), referenceRevision: 1, publicDownloadTokens: false, jobsStarted: 0 };
  fs.writeFileSync(path.join(output, "verified.json"), JSON.stringify(evidence, null, 2)); console.log(JSON.stringify(evidence, null, 2));
}
if (require.main === module) (process.argv[2] === "prepare" ? prepare() : process.argv[2] === "upload" ? upload() : Promise.reject(new Error("Specify prepare or upload"))).catch(e => { console.error(e.stack); process.exitCode = 1; });
