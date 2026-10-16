"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const h = require("../tmp/sharepoint_helpers");
const root = path.resolve(__dirname, "..");
const project = "meridain-nexus";
const bucket = `${project}.firebasestorage.app`;
const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const stage = path.join(root, ".tmp/launch-readiness");
const decode = v => v.stringValue ?? v.timestampValue ?? v.booleanValue ?? (v.integerValue !== undefined ? Number(v.integerValue) : v.doubleValue ?? (v.mapValue ? Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, decode(x)])) : v.arrayValue ? (v.arrayValue.values || []).map(decode) : null));
const unpack = d => ({ id: d.name.split("/").at(-1), ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, decode(v)])) });
function save(name, value) { fs.mkdirSync(stage, { recursive: true }); fs.writeFileSync(path.join(stage, name), JSON.stringify(value, null, 2)); }
async function main() {
  const mode = process.argv[2];
  if (!["security", "sharepoint", "orders", "download-insights", "masters"].includes(mode)) throw new Error("Choose a read-only audit mode.");
  const token = execFileSync("powershell.exe", ["-NoProfile", "-File", "C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1", "auth", "print-access-token", `--project=${project}`, "--quiet"], { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }).trim();
  async function api(url, method = "GET", body) {
    const r = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, "x-goog-user-project": project, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(90000) });
    if (!r.ok) throw new Error(`Read-only audit HTTP ${r.status}: ${new URL(url).pathname}`);
    return r.json();
  }
  async function query(collection, fields, limit = 500) {
    const result = await api(`${base}:runQuery`, "POST", { structuredQuery: { from: [{ collectionId: collection }], ...(fields ? { select: { fields: fields.map(fieldPath => ({ fieldPath })) } } : {}), limit } });
    return result.filter(x => x.document).map(x => unpack(x.document));
  }
  if (mode === "download-insights") {
    const graphToken = await h.graphToken();
    const listing = JSON.parse(fs.readFileSync(path.join(stage, "insights-sharepoint-files.json")));
    for (const name of ["build_sales_duckdb.py", "run_sales_pipeline.ps1", "validate_sales_db.py"]) {
      const item = listing.find(x => x.relativePath === `Sales Insights/scripts/${name}`);
      if (!item || item.size > 100000) throw new Error(`Expected source script missing: ${name}`);
      const response = await fetch(`https://graph.microsoft.com/v1.0/drives/${item.driveId}/items/${item.id}/content`, { headers: { Authorization: `Bearer ${graphToken}` }, signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`Source download HTTP ${response.status}`);
      const dest = path.join(stage, "insights-source", name);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, Buffer.from(await response.arrayBuffer()));
      console.log(JSON.stringify({ source: item.relativePath, bytes: fs.statSync(dest).size }));
    }
  }
  if (mode === "masters") {
    const ExcelJS = require("../functions/node_modules/exceljs");
    const config = unpack(await api(`${base}/salesStoreMasters/geo-rep-orders-store-master`));
    const response = await fetch(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(config.storagePath)}?alt=media`, { headers: { Authorization: `Bearer ${token}`, "x-goog-user-project": project }, signal: AbortSignal.timeout(90000) });
    if (!response.ok) throw new Error(`Master read HTTP ${response.status}`);
    const content = Buffer.from(await response.arrayBuffer());
    if (content.length > 25 * 1024 * 1024) throw new Error("Master exceeds audit limit.");
    fs.mkdirSync(stage, { recursive: true });
    fs.writeFileSync(path.join(stage, "orders-store-master.xlsx"), content);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(content);
    const sheets = workbook.worksheets.map(sheet => ({ name: sheet.name, rows: sheet.rowCount, headerRows: Array.from({ length: Math.min(5, sheet.rowCount) }, (_, i) => ({ row: i + 1, values: sheet.getRow(i + 1).values })).filter(r => r.values.some(v => /store.*code|currency|franchise/i.test(String(v)))) }));
    console.log(JSON.stringify({ master: config.sourceName, sheets }, null, 2));
  }
  if (mode === "security") {
    const releases = await api(`https://firebaserules.googleapis.com/v1/projects/${project}/releases?pageSize=100`);
    if (releases.nextPageToken) throw new Error("Rules listing requires pagination.");
    for (const kind of ["firestore", "storage"]) {
      const release = releases.releases.find(r => kind === "firestore" ? r.name.endsWith("/cloud.firestore") : r.name.endsWith(`/firebase.storage/${bucket}`));
      if (!release) throw new Error(`Missing ${kind} release.`);
      const rules = await api(`https://firebaserules.googleapis.com/v1/${release.rulesetName}`);
      const file = path.join(stage, `${kind}.before.json`);
      if (fs.existsSync(file)) {
        if (JSON.parse(fs.readFileSync(file)).release.rulesetName !== release.rulesetName) throw new Error("Live rules changed since baseline. Review instead of overwriting backup.");
      } else save(`${kind}.before.json`, { release, rules });
    }
    const rooms = await query("fileDropRooms", ["expiresAt", "createdAt"], 1001);
    const files = await query("fileDrops", ["size", "createdAt"], 1001);
    let pageToken = "";
    const objects = [];
    do {
      const list = await api(`https://storage.googleapis.com/storage/v1/b/${bucket}/o?prefix=file-drops%2F&maxResults=1000&fields=items(name,generation,size),nextPageToken${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`);
      objects.push(...list.items || []);
      pageToken = list.nextPageToken || "";
    } while (pageToken);
    save("drop-objects.before.json", objects);
    const summary = { auditedAt: new Date().toISOString(), rooms: rooms.length, activeRooms: rooms.filter(r => Date.parse(r.expiresAt) > Date.now()).length, metadataRows: files.length, objects: objects.length, totalBytes: objects.reduce((s, o) => s + Number(o.size), 0), listingComplete: rooms.length < 1001 && files.length < 1001 };
    save("security-summary.json", summary);
    console.log(JSON.stringify(summary, null, 2));
  }
  if (mode === "sharepoint") {
    const graphToken = await h.graphToken();
    const site = await h.graphJson(graphToken, "/sites/meridiangroupza.sharepoint.com:/sites/MeridianNexus?$select=id");
    const drive = await h.graphJson(graphToken, `/sites/${site.id}/drive?$select=id`);
    async function list(folderPath, depth) {
      const urlPath = folderPath.split("/").map(encodeURIComponent).join("/");
      let next = `/drives/${drive.id}/root:/${urlPath}:/children?$select=id,name,folder,file,size,lastModifiedDateTime,parentReference&$top=200`;
      const all = [];
      while (next) {
        const page = await h.graphJson(graphToken, next);
        for (const item of page.value || []) {
          const entry = { ...item, relativePath: `${folderPath}/${item.name}`, driveId: drive.id };
          all.push(entry);
          console.log(JSON.stringify({ path: entry.relativePath, folder: !!item.folder, bytes: item.size, modified: item.lastModifiedDateTime }));
          if (item.folder && depth > 0) all.push(...await list(entry.relativePath, depth - 1));
        }
        const link = page["@odata.nextLink"];
        if (link && !link.startsWith("https://graph.microsoft.com/v1.0/")) throw new Error("Unexpected Graph page.");
        next = link ? link.slice("https://graph.microsoft.com/v1.0".length) : "";
      }
      return all;
    }
    save("insights-sharepoint-files.json", await list("Sales Insights", 4));
  }
  if (mode === "orders") {
    const records = await query("salesTransactions", null, 500);
    const keys = [...new Set(records.flatMap(r => Object.keys(r)))].sort();
    const dimensions = ["currency", "currencyCode", "franchise", "isFranchise", "storeType", "ownershipType", "channel", "banner", "client", "sourceSystem"];
    const summary = { sampleSize: records.length, fieldNames: keys, dimensions: Object.fromEntries(dimensions.map(key => [key, [...new Set(records.map(r => r[key]).filter(v => v !== undefined && v !== null && v !== ""))].slice(0, 30)])) };
    const configs = await query("salesStoreMasters", ["name", "sourceName", "storagePath", "rowCount", "columns", "updatedAt"]);
    const resources = await query("portalResources", ["name", "category", "storagePath", "updatedAt", "status"], 250);
    save("order-master-files.json", { configs, resources });
    console.log(JSON.stringify({ ...summary, masterFiles: configs, resources }, null, 2));
    save("orders-summary.json", summary);
  }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
