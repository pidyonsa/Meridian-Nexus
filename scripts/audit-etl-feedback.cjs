"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { api, json, hash } = require("./release-multi-admin.cjs");
const base = "https://firestore.googleapis.com/v1/projects/meridain-nexus/databases/(default)/documents";
const out = path.resolve(__dirname, "../.tmp/etl-feedback-20260925/resources");
async function main() {
  fs.mkdirSync(out, { recursive: true });
  for (const [role, id] of [["clicks-failed-raw", "resource-cabbe6b0-bbe6-4d4f-bbe7-657566df5e2c"], ["gln", "resource-eae4d5cf-2591-4c22-b43c-4fdb6a1b053f"]]) {
    const doc = await json(`${base}/portalResources/${id}`), fields = doc.fields;
    const storagePath = fields.storagePath.stringValue, name = fields.sourceName.stringValue;
    assert.ok(storagePath.startsWith(`portal-resources/${id}/`));
    const url = `https://storage.googleapis.com/storage/v1/b/meridain-nexus.firebasestorage.app/o/${encodeURIComponent(storagePath)}`;
    try {
      const metadata = await json(url); assert.ok(+metadata.size <= 25 * 1024 * 1024);
      const bytes = Buffer.from(await (await api(url + `?alt=media&generation=${metadata.generation}`)).arrayBuffer());
      assert.equal(bytes.length, +metadata.size);
      fs.writeFileSync(path.join(out, role + ".xlsx"), bytes, { flag: "wx" });
      fs.writeFileSync(path.join(out, role + ".json"), JSON.stringify({ id, name, size: bytes.length, generation: metadata.generation, sha256: hash(bytes) }, null, 2), { flag: "wx" });
      console.log(`${role}: inspected authorized Resource copy (${bytes.length} bytes).`);
    } catch (error) {
      if (/GET 403:/.test(error.message)) console.log(`${role}: current operator cannot read private Resource bytes. No permissions changed.`);
      else throw error;
    }
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
