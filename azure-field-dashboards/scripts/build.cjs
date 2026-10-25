'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), source = path.resolve(root, '../firebase-dashboards');
const manifest = JSON.parse(fs.readFileSync(path.join(source, 'PORT_MANIFEST.json'), 'utf8'));
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const files = [];
require('node:child_process').execFileSync(process.execPath,[path.join(__dirname,'build-provinces.mjs')]);
const geometry=fs.readFileSync(path.join(root,'public/province-geometry.js'));
files.push({path:'province-geometry.js',sha256:hash(geometry),adapter:'local-sales-insights-province-geometry'});
const overrides = new Set(['index.html', 'viewer.js', 'viewer.css']);
for (const entry of manifest.files.filter(file => file.target.startsWith('dist/'))) {
  assert.ok(!entry.target.includes('..'));
  const original = fs.readFileSync(path.join(source, entry.target));
  assert.equal(hash(original), entry.outputSha256, 'Temporary dashboard artifact drift: ' + entry.target);
  const relative = entry.target.slice(5), output = path.join(root, 'public', relative);
  let bytes = overrides.has(relative) ? fs.readFileSync(path.join(root, 'ui', relative)) : original;
  if(relative==='attendance.js') {
    const code=bytes.toString('utf8'), anchor="const content = page === 'daily' ?";
    assert.equal(code.split(anchor).length,2,'Attendance overview adapter anchor changed');
    const paintEnd='${reconciliation(data)}<section class="attendance-drilldown" hidden aria-live="polite"></section><p class="attendance-action-status" role="status"></p></section>`;';
    assert.equal(code.split(paintEnd).length,2,'Attendance daily adapter anchor changed');
    const reference='const reference=data.quality.strikeRateTotals;';
    assert.equal(code.split(reference).length,2,'Attendance reference adapter anchor changed');
    bytes=Buffer.from(code.replace(anchor,"const content = page === 'stores' && options.stores ? options.stores.html(data) : page === 'users' && options.roster ? options.roster.html(data) : page === 'overview' && options.overview ? options.overview(data,{link,table,exportButton,cells}) : page === 'daily' && options.daily ? options.daily.html(data,view.date,{link,table,exportButton,cells}) : page === 'daily' ?")
      .replace(paintEnd,paintEnd+"\n      if(page === 'daily' && options.daily) options.daily.mount(container,data,view.date,{link,table,exportButton,cells},{request:options.request,filters:options.filters,current:valid});\n      if(page === 'users' && options.roster) options.roster.mount(container,data,{link,table,exportButton,cells},{request:options.request,filters:options.filters,current:valid,query:options.rosterQuery,onQueryChange:options.onRosterQueryChange});\n      if(page === 'stores' && options.stores) options.stores.mount(container,data,{link,table,exportButton,cells},{request:options.request,filters:options.filters,current:valid,selection:options.storeSelection,onSelectionChange:options.onStoreSelectionChange});")
      .replace(reference,"const reference=page === 'daily' ? null : data.quality.strikeRateTotals;"));
  }
  if(relative==='orders.js') {
    let code=bytes.toString('utf8');
    for(const [anchor,replacement] of [
      ['NEXUS DATA</span>', '${data?.dataHosting?.provider === "Azure" ? "AZURE DATA" : "NEXUS DATA"}</span>'],
      ['Daily download 06:00 SAST</small>', '${data?.dataHosting?.provider === "Azure" ? "Azure import snapshot" : "Daily download 06:00 SAST"}</small>'],
      ['const LABELS = {region:', 'const LABELS = {province: "Province", region:'],
      ['page = next; expandedLine = ""; if (data) render();', 'page = next; expandedLine = ""; if (page === "regions" && data?.totals.amount === 0 && data.totals.units > 0) { metric = "units"; groupSort = "units"; } if (data) render();'],
      ['        if (!finite(data.totals.amount) && finite(data.totals.units))', '        if (page === "regions" && data.totals.amount === 0 && data.totals.units > 0) { metric = "units"; groupSort = "units"; }\n        if (!finite(data.totals.amount) && finite(data.totals.units))'],
      ['      const key = GROUP_PAGES[page];', '      if (page === "regions" && global.FranchiseRegions) return global.FranchiseRegions.html(data,metric,{groupTable:()=>groupTable("region"),metricControl,granularityControl});\n      const key = GROUP_PAGES[page];'],
      ["event.target.closest('button,[data-fo-period],[data-fo-card]')", "event.target.closest('button,[data-fo-period],[data-fo-card],[data-fr-province],[data-fr-point]')"],
      ['      if (target.dataset.foTotal || target.dataset.foCard)', '      if (target.dataset.frProvince) { drill({filters:{...query.filters,province:target.dataset.frProvince}},`Province: ${target.dataset.frProvince}`); return; }\n      if (target.dataset.frPoint) { drill({filters:{...query.filters,region:target.dataset.frPoint},start:target.dataset.start,end:target.dataset.end},`Region: ${target.dataset.frPoint}`); return; }\n      if (target.dataset.foTotal || target.dataset.foCard)'],
      ['    root.addEventListener("keydown", event => {', '    root.addEventListener("keydown", event => {\n      if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-fr-province],[data-fr-point]")) { event.preventDefault(); event.target.dispatchEvent(new MouseEvent("click",{bubbles:true})); }'],
      ['const grid = small ? ""', 'const trace = global.FranchiseReference?.trace(geometry,field,small) || "";\n      const grid = small ? ""'],
      ['${grid}<line x1="${left}"', '${grid}${trace}<line x1="${left}"'],
      ['      syncNavigation();\n      if (data.quality.warnings.length)', '      syncNavigation();\n      global.FranchiseReference?.decorate(root,data,page);\n      global.FranchiseRegions?.mount(root,page === "regions" ? data : null,metric,abort.signal);\n      if (data.quality.warnings.length)']
    ]) {
      // The downloaded Geo renderer uses CRLF; preserve all unrelated source bytes.
      const from=anchor.replace(/\n/g,code.includes('\r\n')?'\r\n':'\n');
      assert.equal(code.split(from).length,2,'Orders reference adapter anchor changed: '+anchor);
      code=code.replace(from,replacement.replace(/\n/g,code.includes('\r\n')?'\r\n':'\n'));
    }
    bytes=Buffer.from(code);
  }
  fs.mkdirSync(path.dirname(output), {recursive: true});
  fs.writeFileSync(output, bytes);
  files.push({path: relative, sha256: hash(bytes), sourceSha256: hash(original), ...(overrides.has(relative) ? {adapter: 'dashboard-only-shell'} : relative==='attendance.js'?{adapter:'attendance-overview-hook'}:relative==='orders.js'?{adapter:'orders-reference-presentation-hook'}:{})});
}
assert.ok(files.some(file => file.path === 'index.html'));
for(const name of ['orders-regions.js','orders-regions.css']) {
  const bytes=fs.readFileSync(path.join(root,'ui',name));
  fs.writeFileSync(path.join(root,'public',name),bytes);
  files.push({path:name,sha256:hash(bytes),adapter:'geo-regional-reference'});
}
for (const [name,adapter] of [['report-loader.js','dashboard-request-cache'],['dashboard-theme.css','downloaded-reference-theme'],['attendance-layout.css','attendance-reference-layout'],['attendance-presentation.js','attendance-reference-presentation'],['attendance-daily.js','attendance-daily-reference'],['attendance-excel.js','shared-lazy-excel'],['attendance-roster.js','attendance-roster-reference'],['attendance-stores.js','attendance-store-reference'],['orders-reference.js','orders-reference-presentation'],['orders-reference.css','orders-reference-layout']]) {
  const bytes=fs.readFileSync(path.join(root,'ui',name));
  fs.writeFileSync(path.join(root,'public',name),bytes);
  files.push({path:name,sha256:hash(bytes),adapter});
}
for(const [sourceName,target] of [['dist/exceljs.min.js','vendor/exceljs.min.js'],['LICENSE','vendor/exceljs.LICENSE.txt']]) {
  const bytes=fs.readFileSync(path.join(source,'backend/node_modules/exceljs',sourceName));
  fs.writeFileSync(path.join(root,'public',target),bytes);
  files.push({path:target,sha256:hash(bytes),adapter:'existing-exceljs-browser-export'});
}
const mark=fs.readFileSync(path.resolve(root,'../public/sales-insights-source/assets/meridian-mark.png'));
fs.writeFileSync(path.join(root,'public/assets/meridian-mark.png'),mark);
files.push({path:'assets/meridian-mark.png',sha256:hash(mark),adapter:'existing-meridian-brand'});
const favicon=fs.readFileSync(path.resolve(root,'../public/assets/icons/favicon-32.png'));
fs.writeFileSync(path.join(root,'public/assets/favicon-32.png'),favicon);
files.push({path:'assets/favicon-32.png',sha256:hash(favicon),adapter:'existing-meridian-favicon'});
// The Nexus workspace (home and module pages) from ../azure-portal/public, so nexus.meridiangroup.co.za is the one
// Nexus address. Its config.js is written for this site: Attendance and Franchise Orders open these dashboards; tools
// not moved yet open in the full Nexus at /nexus/ on this same site (admins only).
const workspace = path.resolve(root, '../azure-portal/public');
for (const [from, to] of [['index.html', 'workspace.html'], ...['api.js', 'main.js', 'nav.js', 'ui.js', 'updates.js', 'views/admin.js', 'views/gaps.js', 'views/sales.js', 'views/home.js', 'views/module.js', 'views/pending.js'].map(f => [`app/${f}`, `app/${f}`]),
  ['styles/app.css', 'styles/app.css'], ['assets/nexus-mark.png', 'assets/nexus-mark.png'], ['assets/nexus-backdrop.jpg', 'assets/nexus-backdrop.jpg'], ['assets/apple-touch-icon.png', 'assets/apple-touch-icon.png']]) {
  assert.ok(!files.some(file => file.path === to), 'Workspace file collides with a dashboard file: ' + to);
  const bytes = fs.readFileSync(path.join(workspace, from));
  fs.mkdirSync(path.dirname(path.join(root, 'public', to)), {recursive: true});
  fs.writeFileSync(path.join(root, 'public', to), bytes);
  files.push({path: to, sha256: hash(bytes), adapter: 'nexus-workspace'});
}
const siteConfig = Buffer.from(`// Written by azure-field-dashboards/scripts/build.cjs for nexus.meridiangroup.co.za.
export const CONFIG = {
  built: ['attendance', 'franchiseorder', 'gaps', 'gap-upload', 'sales'],
  currentNexus: '/nexus/',
  directLinks: true,
  pageTools: ['attendance', 'franchiseorder']
};
`);
fs.writeFileSync(path.join(root, 'public/app/config.js'), siteConfig);
files.push({path: 'app/config.js', sha256: hash(siteConfig), adapter: 'nexus-workspace-site-config'});
// Server code shared with the Nexus portal (gap trackers, sales dashboard): copied, never edited here. server/shared/ is packaged by
// scripts/package.cjs; it is not a public file.
const sharedServer = ['errors.cjs', 'db.cjs', 'gap/parse.cjs', 'gap/store.cjs', 'gap/report.cjs', 'gap/routes.cjs', 'sales/report.cjs', 'sales/store.cjs', 'sales/routes.cjs'];
for (const file of sharedServer) {
  const target = path.join(root, 'server/shared', file);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, fs.readFileSync(path.resolve(root, '../azure-portal/server', file)));
}
fs.writeFileSync(path.join(root, 'server/shared/FILES.json'), JSON.stringify(sharedServer.map(file => ({file, sha256: hash(fs.readFileSync(path.join(root, 'server/shared', file)))})), null, 2));
for (const font of ['400', '500', '600', '700'].map(w => `vendor/fonts/poppins-latin-${w}-normal.woff2`)) assert.ok(files.some(file => file.path === font), 'Workspace font missing: ' + font);
fs.writeFileSync(path.join(root, 'public/asset-manifest.json'), JSON.stringify({source: 'tested-temporary-dashboard-build', files}, null, 2));
console.log(`Built ${files.length} static files with isolated Attendance and Orders presentation adapters. Original Nexus sources untouched.`);
