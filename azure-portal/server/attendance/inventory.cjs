'use strict';
// SharePoint integration inventory on Azure: catalogues the Meridian Nexus SharePoint site (read-only) to plan which
// legacy modules, scripts, workbooks and data files still need a home in Nexus. The Firebase-era
// scanMeridianSharePointInventory / getMeridianSharePointInventory (functions/index.js, read 26 October 2026) on the
// same sharePointIntegrationInventory, sharePointIntegrationScans and legacyModuleContracts documents.
// Differences: the retired Stock Fix folder is no longer scanned; a second scan cannot start while one is running;
// items left over from earlier scans are not returned (filtered by scan id, as before).
const crypto = require('node:crypto');
const {AppError} = require('../errors.cjs');
const {SERVER_TIME} = require('../google/firestore.cjs');
const {encodeGraphPath} = require('../azure/graph.cjs');

const SITE = {hostname: 'meridiangroupza.sharepoint.com', path: '/sites/MeridianNexus'};
const LIB = 'https://meridiangroupza.sharepoint.com/sites/MeridianNexus/Shared%20Documents/Forms/AllItems.aspx';
const CYCLE_FILES = ['index.html', 'support.js', 'msal-auth.js', 'hierarchy.json', 'scripts/live_data_server.py'];
const ROOTS = [
  {key: 'shared-documents', label: 'Shared Documents', path: '', depth: 1, sourceUrl: LIB},
  {key: 'portal', label: 'Portal', path: 'Portal', depth: 6, integrationMode: 'read-only', requiredFiles: ['index.html'], sourceUrl: `${LIB}?id=%2Fsites%2FMeridianNexus%2FShared%20Documents%2FPortal&viewid=07363d44%2D959c%2D4333%2D9a6d%2De18024fb140d`},
  {key: 'call-cycle-coverage', label: 'Call Cycle Coverage', path: 'Call Cycle Coverage', depth: 6, integrationMode: 'read-only', requiredFiles: CYCLE_FILES, sourceUrl: `${LIB}?id=%2Fsites%2FMeridianNexus%2FShared%20Documents%2FCall%20Cycle%20Coverage`},
  {key: 'pg-call-cycle-coverage', label: 'P&G Call Cycle Coverage', path: 'P&G Call Cycle Coverage', depth: 6, integrationMode: 'read-only', requiredFiles: CYCLE_FILES, sourceUrl: `${LIB}?id=%2Fsites%2FMeridianNexus%2FShared%20Documents%2FP%26G%20Call%20Cycle%20Coverage`},
  {key: 'geo-rep-capture-handover', label: 'Geo Rep Capture Handover', path: 'Capture/Capture', depth: 7, integrationMode: 'read-only', requiredFiles: ['Aspen Report Automation - Handover/RUN_REPORT.bat', 'Aspen Report Automation - Handover/Run_Report.ps1', '.md'], sourceUrl: `${LIB}?id=%2Fsites%2FMeridianNexus%2FShared%20Documents%2FCapture`},
  {key: 'sales-insights', label: 'Sales Insights', path: 'Sales Insights', depth: 7, integrationMode: 'read-only', requiredFiles: ['sales-insights-export/Sales Insights Dashboard.dc.html', 'sales-insights-data.json', 'scripts/build_sales_duckdb.py', 'scripts/run_sales_pipeline.ps1'], sourceUrl: `${LIB}?id=%2Fsites%2FMeridianNexus%2FShared%20Documents%2FSales%20Insights`},
  {key: 'connect-notifications', label: 'Connect Notifications', path: 'Connect/Notifications', depth: 4, integrationMode: 'read-only', requiredFiles: ['notifications.json'], sourceUrl: `${LIB}?id=%2Fsites%2FMeridianNexus%2FShared%20Documents%2FConnect%2FNotifications`}
];
const CODE = new Set(['.bat', '.cmd', '.css', '.html', '.js', '.json', '.md', '.ps1', '.py', '.ts', '.yaml', '.yml']);
const WORKBOOK = new Set(['.csv', '.xls', '.xlsb', '.xlsm', '.xlsx']);
const KNOWLEDGE = new Set(['.doc', '.docx', '.msg', '.mp4', '.pdf', '.ppt', '.pptx', '.txt']);
const HIGH_VOLUME = new Set(['adoption snapshots', 'manual backups', 'soh updates', 'stock fix app output data', 'node_modules', '.venv', 'venv', 'dist', 'build', '__pycache__']);
const CONFIG_FILES = new Set(['hierarchy.json', 'cycle-data.json', 'sales-insights-data.json', 'notifications.json', 'weeks_index.json']);
const STORED_ITEMS = 2500;

const pathKey = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const extension = name => { const m = String(name || '').toLowerCase().match(/(\.[a-z0-9]+)$/); return m ? m[1] : ''; };
function category(item, relativePath) {
  if (item.folder) return 'folder';
  const ext = extension(item.name);
  if (CONFIG_FILES.has(String(item.name || '').trim().toLowerCase())) return 'config-data';
  if (pathKey(relativePath).includes('DASHBOARDDATA') || ext === '.gz' || ext === '.jsonl') return 'output-data';
  if (CODE.has(ext)) return 'code';
  if (WORKBOOK.has(ext)) return 'workbook';
  if (KNOWLEDGE.has(ext)) return 'knowledge';
  return 'file';
}
function recommendation(cat, relativePath) {
  const k = pathKey(relativePath);
  if (cat === 'code') return k.includes('AUTH') || k.includes('MSAL') || k.includes('LOGIN') ? 'Review and migrate business logic only; keep old browser authentication out of Nexus.' : 'Review for native Nexus integration or migration to Azure.';
  if (cat === 'workbook') return 'Register as an automation source, template, tracker or SharePoint delivery target.';
  if (cat === 'output-data') return 'Use as an Azure SQL import or dashboard source if the schema is stable.';
  if (cat === 'config-data') return 'Read as a module configuration source now; migrate to Nexus once the schema is approved.';
  if (cat === 'knowledge') return 'Attach to workflow documentation or Nexus assistant training notes.';
  return 'Catalogue for module ownership and integration planning.';
}
function record(root, item, relativePath, depth, skipped = '') {
  const cat = category(item, relativePath);
  return {id: crypto.createHash('sha256').update(`${root.key}:${relativePath}:${item.id || ''}`).digest('hex').slice(0, 48), scanRoot: root.key, module: root.label, name: String(item.name || '').slice(0, 260),
    path: String(relativePath || '/').slice(0, 700), webUrl: String(item.webUrl || root.sourceUrl || '').slice(0, 1000), type: item.folder ? 'folder' : 'file', category: cat, extension: extension(item.name),
    size: Number(item.size) || 0, lastModifiedDateTime: item.lastModifiedDateTime || null, depth, integrationCandidate: ['code', 'workbook', 'output-data', 'config-data'].includes(cat),
    recommendation: recommendation(cat, relativePath), scanSkippedReason: skipped || null};
}
const countsOf = items => items.reduce((c, i) => { c.total++; c[i.category] = (c[i.category] || 0) + 1; if (i.integrationCandidate) c.integrationCandidates++; return c; },
  {total: 0, folder: 0, code: 0, workbook: 0, 'output-data': 0, 'config-data': 0, knowledge: 0, file: 0, integrationCandidates: 0});
function requirementFound(items, requirement) {
  const r = String(requirement || '').toLowerCase();
  return items.find(i => i.path.toLowerCase().endsWith(r)) || (r.startsWith('.') ? items.find(i => i.name.toLowerCase().endsWith(r)) : items.find(i => i.path.toLowerCase().includes(r))) || null;
}
function tracks(results) {
  return ROOTS.filter(r => r.integrationMode).map(root => {
    const result = results.find(x => x.root.key === root.key);
    const items = result?.items || [];
    const requiredFiles = (root.requiredFiles || []).map(name => { const f = requirementFound(items, name); return {name, found: Boolean(f), path: f?.path || '', webUrl: f?.webUrl || '', category: f?.category || ''}; });
    const missingRequired = requiredFiles.filter(f => !f.found).length;
    return {key: root.key, label: root.label, path: root.path, sourceUrl: root.sourceUrl, mode: root.integrationMode, writePolicy: 'sharepoint-read-only-firestore-metadata-only',
      status: result?.missing ? 'missing' : missingRequired ? 'partial' : 'read-only-linked', itemCount: items.length, counts: countsOf(items), requiredFiles, missingRequired,
      nextStep: missingRequired ? 'Review the missing expected files or update the module contract before moving data into Nexus.' : 'Read-only SharePoint source is linked. Next step is to approve the Nexus schema and replace file-based outputs.'};
  });
}

function inventoryService({fs, graph, actorOf, now = () => Date.now()}) {
  async function scanRoot(driveId, root, budget) {
    const errors = [];
    let rootItem;
    try {
      rootItem = root.path ? await graph.request(`/drives/${driveId}/root:/${encodeGraphPath(root.path)}?$select=id,name,folder,file,webUrl,size,lastModifiedDateTime,parentReference`)
        : await graph.request(`/drives/${driveId}/root?$select=id,name,folder,webUrl,lastModifiedDateTime,parentReference,size`);
    } catch (error) {
      if (error.status === 404) return {root, missing: true, items: [], errors: [`${root.label} was not found at ${root.path || 'drive root'}.`]};
      throw error;
    }
    const items = [record(root, rootItem, root.path || '/', 0)];
    const queue = [{item: rootItem, path: root.path ? '' : '', depth: 0}];
    while (queue.length && items.length < budget.left) {
      const {item, path, depth} = queue.shift();
      if (!item.folder || depth >= root.depth) continue;
      try {
        const children = await graph.all(`/drives/${driveId}/items/${item.id}/children?$select=id,name,size,file,folder,webUrl,lastModifiedDateTime,parentReference&$top=200`, Math.min(500, budget.left - items.length));
        for (const child of children) {
          if (items.length >= budget.left) break;
          const relativePath = [path, child.name].filter(Boolean).join('/');
          const skip = child.folder && HIGH_VOLUME.has(String(child.name).trim().toLowerCase());
          items.push(record(root, child, root.path ? `${root.path}/${relativePath}` : relativePath, depth + 1, skip ? 'High-volume output folder catalogued but not recursively scanned.' : ''));
          if (child.folder && !skip) queue.push({item: child, path: relativePath, depth: depth + 1});
        }
      } catch (error) { errors.push(`${path || root.label}: ${String(error.message).slice(0, 300)}`); }
    }
    budget.left -= items.length;
    return {root, missing: false, items, errors};
  }

  async function scan(user, body = {}) {
    if (!graph) throw new AppError('unavailable', 'SharePoint is not connected on this site yet.');
    const maxItems = Math.min(5000, Math.max(200, Math.floor(Number(body.maxItems) || 3200)));
    const actor = await actorOf(user);
    const running = await fs.query('sharePointIntegrationScans', {where: [['status', '==', 'running']], limit: 5});
    if (running.some(s => now() - new Date(s.data.startedAt || 0).getTime() < 15 * 60 * 1000)) throw new AppError('already-exists', 'A SharePoint scan is already running. Wait for it to finish.');
    const scanId = `sharepoint-inventory-${now()}`;
    await fs.set(`sharePointIntegrationScans/${scanId}`, {status: 'running', startedAt: SERVER_TIME, startedBy: actor.uid, startedByEmail: actor.email, roots: ROOTS.map(r => r.path || '/'), via: 'azure-nexus'});
    try {
      const site = await graph.request(`/sites/${SITE.hostname}:${SITE.path}?$select=id,webUrl`);
      const drive = await graph.request(`/sites/${site.id}/drive?$select=id,name,webUrl`);
      const budget = {left: maxItems}, results = [];
      for (const root of ROOTS) results.push(await scanRoot(drive.id, root, budget));
      const all = results.flatMap(r => r.items), counts = countsOf(all), trackList = tracks(results), errors = results.flatMap(r => r.errors).slice(0, 20);
      const pick = (cat, n) => all.filter(i => i.category === cat).slice(0, n);
      const writes = [
        fs.write('merge', 'sharePointIntegrationInventory/current', {scanId, source: {provider: 'Microsoft Graph via Nexus SharePoint app', siteUrl: site.webUrl, driveName: drive.name, roots: ROOTS.map(({key, label, path, sourceUrl}) => ({key, label, path, sourceUrl}))},
          counts, roots: results.map(r => ({key: r.root.key, label: r.root.label, path: r.root.path, sourceUrl: r.root.sourceUrl, missing: r.missing, items: r.items.length, errors: r.errors.slice(0, 5)})),
          modules: all.filter(i => i.type === 'folder' && i.depth <= 2).sort((a, b) => a.path.localeCompare(b.path)).slice(0, 80), codeFiles: pick('code', 120), workbooks: pick('workbook', 120),
          outputData: pick('output-data', 80), configData: pick('config-data', 80), knowledgeFiles: pick('knowledge', 80), integrationTracks: trackList, errors, updatedAt: SERVER_TIME, updatedBy: 'sharepoint-inventory-scanner'}),
        ...trackList.map(t => fs.write('merge', `legacyModuleContracts/${t.key}`, {...t, sourceSystem: 'SharePoint', integrationStatus: t.status, firestorePrepared: true, lastInventoryScanId: scanId, updatedAt: SERVER_TIME, updatedBy: 'sharepoint-inventory-scanner'})),
        ...all.slice(0, STORED_ITEMS).map(i => fs.write('merge', `sharePointIntegrationInventory/current/items/${i.id}`, {...i, scanId, indexedAt: SERVER_TIME}))
      ];
      for (let i = 0; i < writes.length; i += 400) await fs.commit(writes.slice(i, i + 400));
      await fs.merge(`sharePointIntegrationScans/${scanId}`, {status: 'completed', counts, rootCount: results.length, errors, completedAt: SERVER_TIME});
      return {scanId, counts, roots: results.map(r => ({key: r.root.key, label: r.root.label, items: r.items.length, errors: r.errors.length}))};
    } catch (error) {
      await fs.merge(`sharePointIntegrationScans/${scanId}`, {status: 'failed', message: String(error.message).slice(0, 800), completedAt: SERVER_TIME}).catch(() => {});
      throw new AppError('unavailable', `The SharePoint scan failed: ${String(error.message).slice(0, 200)}`);
    }
  }

  async function overview(limit = 500) {
    const n = Math.min(600, Math.max(50, Math.floor(Number(limit) || 360)));
    const current = await fs.get('sharePointIntegrationInventory/current');
    const [items, scans, contracts] = await Promise.all([
      current?.data?.scanId ? fs.query('items', {parent: 'sharePointIntegrationInventory/current', where: [['scanId', '==', current.data.scanId]], limit: n}) : [],
      fs.query('sharePointIntegrationScans', {orderBy: [['startedAt', 'desc']], limit: 8}),
      fs.query('legacyModuleContracts', {where: [['sourceSystem', '==', 'Local CODES folder']], limit: 40})
    ]);
    return {graphEnabled: Boolean(graph), current: current?.data || null, items: items.map(d => ({id: d.id, ...d.data})).sort((a, b) => String(a.module).localeCompare(String(b.module)) || String(a.path).localeCompare(String(b.path))),
      scans: scans.map(d => ({id: d.id, ...d.data})), localCodeContracts: contracts.map(d => ({id: d.id, ...d.data})).sort((a, b) => String(a.label || a.key).localeCompare(String(b.label || b.key))), loadedAt: new Date(now()).toISOString()};
  }

  return {scan, overview};
}

module.exports = {inventoryService, category, recommendation, tracks, ROOTS};
