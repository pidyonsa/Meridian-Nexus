"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { gc } = require("./release-etls.cjs");
const project = "meridain-nexus";
const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const unpack = v => v.stringValue ?? v.timestampValue ?? v.booleanValue ??
  (v.integerValue !== undefined ? Number(v.integerValue) : v.doubleValue ??
    (v.mapValue ? Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, unpack(x)])) :
      v.arrayValue ? (v.arrayValue.values || []).map(unpack) : null));
const decode = d => ({ id: d.name.split("/").at(-1), ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, unpack(v)])) });
const matches = value => /pick[\s_-]*(?:n[\s_-]*)?pay|picknpay|\bpnp\b/i.test(String(value || ""));
async function main() {
  const token = gc("auth", "print-access-token", `--project=${project}`, "--quiet").trim();
  async function query(collection, fields, where) {
    const r = await fetch(`${base}:runQuery`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "x-goog-user-project": project, "Content-Type": "application/json" },
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId: collection }], select: { fields: fields.map(fieldPath => ({ fieldPath })) }, ...(where ? { where } : {}), limit: 1001 } }),
      signal: AbortSignal.timeout(60000)
    });
    if (!r.ok) throw new Error(`${collection}: HTTP ${r.status}`);
    const docs = (await r.json()).filter(x => x.document).map(x => decode(x.document));
    if (docs.length > 1000) throw new Error(`${collection}: audit limit exceeded; do not treat as complete`);
    return docs;
  }
  const retailers = await query("retailers", ["name", "webAddress", "extractionProfileId", "extractionName", "workflowMode", "reportSchedule.enabled", "steps", "updatedAt"]);
  const profiles = await query("extractionProfiles", ["name", "steps", "updatedAt"]);
  const candidateIds = new Set(retailers.filter(r => matches(`${r.id} ${r.name} ${r.webAddress}`)).map(r => r.id));
  const candidateProfiles = new Set(retailers.filter(r => candidateIds.has(r.id)).map(r => r.extractionProfileId));
  const secrets = await query("retailerSecrets", ["updatedAt"]);
  const portalProfiles = await query("retailerPortalProfiles", ["retailerId", "portalProfileId", "name", "group", "active", "order", "lastSeenAt"]);
  const safeSteps = steps => (steps || []).map(s => ({ action: s.action, selector: s.selector, hasValue: !!s.value }));
  const report = {
    checkedAt: new Date().toISOString(),
    credentialRecords: secrets.map(s => ({ id: s.id, updatedAt: s.updatedAt })),
    portalProfiles: portalProfiles.filter(p => matches(p.retailerId)),
    retailers: retailers.map(r => ({ ...r, webAddress: r.webAddress ? new URL(r.webAddress).origin + new URL(r.webAddress).pathname : null, steps: safeSteps(r.steps) })),
    profiles: profiles.map(p => ({ id: p.id, name: p.name, updatedAt: p.updatedAt, stepCount: p.steps?.length || 0, ...(candidateProfiles.has(p.id) || matches(`${p.id} ${p.name}`) ? { steps: safeSteps(p.steps) } : {}) })),
    runs: []
  };
  for (const id of new Set([...candidateIds, "pick-n-pay", "picknpay", "pnp"])) {
    report.runs.push(...await query("extractionRuns", ["retailerId", "retailerName", "extractionProfileId", "extractionName", "status", "createdAt", "completedAt", "reportStartDate", "reportEndDate"], {
      fieldFilter: { field: { fieldPath: "retailerId" }, op: "EQUAL", value: { stringValue: id } }
    }));
  }
  report.profileRuns = await query("extractionRuns", ["retailerId", "retailerName", "extractionProfileId", "status", "createdAt", "completedAt", "portalProfileName"], {
    fieldFilter: { field: { fieldPath: "extractionProfileId" }, op: "EQUAL", value: { stringValue: "picknpay-sales-extraction-steps" } }
  });
  report.picknPaySteps = profiles.find(p => p.id === "picknpay-sales-extraction-steps")?.steps.map(s => ({ action: s.action, selector: s.selector, value: /password|username|otp/i.test(s.action) ? "[omitted]" : s.value }));
  const out = path.resolve(__dirname, "../.tmp/retailer-extraction-audit");
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "audit.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
