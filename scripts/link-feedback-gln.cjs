"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { json, fnUrl, hash } = require("./release-multi-admin.cjs");
const base = "https://firestore.googleapis.com/v1/projects/meridain-nexus/databases/(default)/documents";
const stage = path.resolve(__dirname, "../.tmp/etl-feedback-release-20260925"), id = "resource-eae4d5cf-2591-4c22-b43c-4fdb6a1b053f";
const referenceUrl = `${base}/etlReferenceSets/anchor-pnp-v1`;
async function main() {
  const after = JSON.parse(fs.readFileSync(path.join(stage, "function.after.json")));
  assert.equal((await json(fnUrl("meridianEtl"))).serviceConfig.revision, after.serviceConfig.revision, "Deploy and verify the new API first");
  const resource = await json(`${base}/portalResources/${id}`), fields = resource.fields;
  assert.equal(fields.sourceName.stringValue, "GLN Master Jul26.xlsx"); assert.notEqual(fields.active?.booleanValue, false);
  const local = fs.readFileSync("C:/Users/PC/Downloads/GLN Master Jul26.xlsx");
  assert.equal(Number(fields.size?.integerValue || fields.size?.doubleValue), local.length);
  const before = await json(referenceUrl), refs = before.fields.resources.mapValue.fields;
  if (process.argv[2] === "verify") { assert.equal(refs.gln?.stringValue, id); console.log("Shared GLN Master link verified; no repeated upload required."); return; }
  assert.equal(process.argv[2], "apply"); assert.ok(!refs.gln || refs.gln.stringValue === id, "Do not replace another administrator's GLN selection");
  if (refs.gln?.stringValue === id) { console.log("GLN Master already selected."); return; }
  fs.writeFileSync(path.join(stage, "gln.references.before.json"), JSON.stringify(before, null, 2), { flag: "wx" });
  fs.writeFileSync(path.join(stage, "gln.resource.checked.json"), JSON.stringify({ resourceId: id, resourceUpdateTime: resource.updateTime, localSha256: hash(local), size: local.length, validatedSheet: "GLN Report", privateBlobDownloaded: false }, null, 2), { flag: "wx" });
  const revision = Number(before.fields.revision.integerValue) + 1;
  const mask = ["resources.gln", "revision", "updatedAt", "updatedBy"].map(p => "updateMask.fieldPaths=" + encodeURIComponent(p)).join("&");
  const updated = await json(referenceUrl + "?" + mask + "&currentDocument.updateTime=" + encodeURIComponent(before.updateTime), "PATCH", { fields: {
    resources: { mapValue: { fields: { gln: { stringValue: id } } } }, revision: { integerValue: String(revision) }, updatedAt: { stringValue: new Date().toISOString() },
    updatedBy: { mapValue: { fields: { source: { stringValue: "ETL feedback deployment" }, reason: { stringValue: "User supplied GLN Master and requested reuse of GLN Report for ETLs" } } } }
  } });
  assert.equal(updated.fields.resources.mapValue.fields.gln.stringValue, id);
  for (const [role, value] of Object.entries(refs)) assert.deepEqual(updated.fields.resources.mapValue.fields[role], value);
  fs.writeFileSync(path.join(stage, "gln.references.after.json"), JSON.stringify(updated, null, 2), { flag: "wx" });
  console.log(`Linked existing GLN Master to shared set v${revision}. All other shared references preserved.`);
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
