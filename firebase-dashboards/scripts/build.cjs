'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const acorn=require('acorn');
const root=path.resolve(__dirname,'..'),repo=path.resolve(root,'..'),out=path.join(root,'dist');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const manifest=[];
function patchCode(file,before,after){
  const p=path.join(root,file),s=fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
  assert.ok(s.includes(before)&&s.indexOf(before)===s.lastIndexOf(before),'Port adapter anchor changed: '+file+' / '+before.slice(0,60));
  fs.writeFileSync(p,s.replace(before,after));
}
function copy(from,to) {
  const input=path.join(repo,from),output=path.join(root,to),bytes=fs.readFileSync(input);
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,bytes);
  manifest.push({source:from,target:to,sha256:hash(bytes)});
}
for(const file of ['attendance.js','attendance.css','attendance-base.css','orders.js','orders.css','shell.css','assets/meridian-logo.png']) copy('azure-nexus/public/'+file,'dist/'+file);
for(const file of ['index.html','viewer.js','viewer.css','robots.txt']) copy('firebase-dashboards/public/'+file,'dist/'+file);
const fonts='azure-nexus/node_modules/@fontsource/poppins/files/';
for(const weight of [400,500,600,700])copy(fonts+`poppins-latin-${weight}-normal.woff2`,`dist/vendor/fonts/poppins-latin-${weight}-normal.woff2`);
for(const file of ['style.css','Phosphor.ttf','Phosphor.woff','Phosphor.woff2'])copy('azure-nexus/node_modules/@phosphor-icons/web/src/regular/'+file,'dist/vendor/icons/'+file);
copy('functions/attendance-analytics.js','backend/vendor/attendance.cjs');
copy('functions/attendance-exclusions-core.js','backend/vendor/attendance-exclusions-core.js');
copy('functions/franchise-orders.js','backend/vendor/orders.cjs');
copy('functions/attendance-hierarchy.json','backend/vendor/hierarchy.json');

// Port only the reviewed reader dependency tree, never the automation module itself.
const code=fs.readFileSync(path.join(repo,'functions/index.js'),'utf8');
const tree=acorn.parse(code,{ecmaVersion:'latest',sourceType:'script'}),declarations=new Map();
for(const node of tree.body) {
  if(node.type==='FunctionDeclaration')declarations.set(node.id.name,node);
  if(node.type==='VariableDeclaration')for(const item of node.declarations)if(item.id.type==='Identifier')declarations.set(item.id.name,{...item,start:item.start,end:item.end,variable:true});
}
const roots=['readGeoRepAttendanceSource','geoRepAttendanceScheduleRowsAsObjects','geoRepAttendanceStoreMasterEnrichment','geoRepAttendanceEnrichScheduleRows'];
const selected=new Set();
for(const name of ['db','getStorage','ExcelJS','path','NoReportDataError'])declarations.delete(name);
function walk(node,visit){if(!node||typeof node!=='object')return;visit(node);for(const [key,value]of Object.entries(node)){if(['start','end'].includes(key))continue;if(Array.isArray(value))value.forEach(v=>walk(v,visit));else if(value&&typeof value==='object')walk(value,visit);}}
function include(name){if(selected.has(name))return;const node=declarations.get(name);assert.ok(node,'Missing reader dependency '+name);selected.add(name);walk(node,child=>{if(child.type==='Identifier'&&declarations.has(child.name)&&child.name!==name)include(child.name);});}
roots.forEach(include);
assert.ok(selected.size<60,'Unexpected automation dependency expansion');
const extracted=[...selected].map(name=>{const n=declarations.get(name);return (n.variable?'const ':'')+code.slice(n.start,n.end)+(n.variable?';':'');}).join('\n\n');
assert.ok(!/FieldValue|\.set\(|\.update\(|\.delete\(/.test(extracted.replace(/\b(?:byCode|byName|columns|entries)\.set\(/g,'mapInsert(')),'Reader unexpectedly contains write operations');
const target=path.join(root,'backend/vendor/source-reader.cjs');
fs.writeFileSync(target,`'use strict';\nmodule.exports = function({db,getStorage,ExcelJS,path,NoReportDataError}) {\n${extracted}\nreturn {${roots.join(',')}};\n};\n`);
manifest.push({source:'functions/index.js (reader declarations only)',target:'backend/vendor/source-reader.cjs',names:[...selected],sha256:hash(extracted)});
// Optional brand fields are port adapters; the original Nexus modules stay intact.
patchCode('dist/orders.js','product: "Product", quantity:','product: "Product", brand: "Brand", banner: "Banner", quantity:');
patchCode('dist/orders.js','"storeName", "product", "quantity", "value", "status"','"storeName", "product", "brand", "banner", "quantity", "value", "status"');
// Keep period controls together and expose the primary field-team filters.
const orderDates='<label><span>From</span><input type="date" data-fo-date="start" value="${query.start}"/></label><label><span>To</span><input type="date" data-fo-date="end" value="${query.end}"/></label>';
patchCode('dist/orders.js','["manager","client","banner","channel","brand","category","currency"]','["client","channel","brand","category","currency"]');
patchCode('dist/orders.js','<div class="fo-period-tools"><label><span class="sr-only">Reporting period</span>','<div class="fo-period-tools"><div class="fo-period-fields"><label><span>Reporting period</span>');
patchCode('dist/orders.js','</select></label><span>${totalButton("lines",`${fmt(data.table.total)} selected lines`)}','</select></label>'+orderDates+'</div><span>${totalButton("lines",`${fmt(data.table.total)} selected lines`)}');
patchCode('dist/orders.js','<div class="fo-filter-grid">'+orderDates+'${["region","rep","storeName","product","status"]','<div class="fo-filter-grid">${["manager","banner","region","rep","storeName","product","status"]');
patchCode('dist/orders.js','const options = data.options[key] || [];','const options = [...new Set([...(data.options[key] || []), ...(current ? [current] : [])])];');
patchCode('dist/orders.js','filter(key => data.options[key]?.some(v => !["Not supplied","Unassigned"].includes(v)))','filter(key => query.filters[key] || data.options[key]?.some(v => !["Not supplied","Unassigned"].includes(v)))');
patchCode('dist/orders.js','data-fo-cancelled ${query.includeCancelled ? "checked" : ""}','data-fo-cancelled ${query.includeCancelled ? "checked" : ""} ${/^(cancelled|canceled|void|voided)$/i.test(query.filters.status || "") || query.exceptions?.includes("cancelled") ? \'disabled title="Included by the selected cancellation filter"\' : ""}');
patchCode('dist/orders.js','client: "Client", banner:','client: "Clients", banner:');
patchCode('dist/orders.js','product: "Product", brand: "Brand", banner: "Banner", quantity:','product: "Product", client: "Client", brand: "Brand", banner: "Banner", quantity:');
patchCode('dist/orders.js','"storeName", "product", "brand", "banner", "quantity", "value", "status"','"storeName", "product", "client", "brand", "banner", "quantity", "value", "status"');
patchCode('dist/orders.js','["client","channel","brand","category","currency"]','["channel","brand","category","currency"]');
patchCode('dist/orders.js','["manager","banner","region","rep","storeName","product","status"]','["manager","banner","client","region","rep","storeName","product","status"]');
patchCode('dist/orders.js','["storeName","region","rep","product","manager"].includes(key)','["storeName","region","rep","product","manager","client"].includes(key)');
patchCode('dist/orders.js','Geo Rep / Azure Cosmos DB','Geo Rep / Nexus live-data service');
patchCode('dist/orders.js','</small></div><div class="fo-tools">${button("refresh"','</small><small class="fo-refresh-schedule">Daily download 06:00 SAST</small></div><div class="fo-tools">${button("refresh"');
patchCode('dist/orders.js','const id = ++generation; busy = true;',`const id = ++generation; busy = true;
      const cached = !refresh && api.cached?.({...query,filters:{...query.filters}});
      if(cached){ data=cached; query={...cached.selection,filters:{...cached.selection.filters},export:false}; render(); }`);
patchCode('dist/orders.js','await api({...query, refresh})','await api({...query, filters:{...query.filters}, refresh})');
patchCode('dist/orders.js','await api({...query, export:true})','await api({...query, filters:{...query.filters}, export:true, version:data.version})');
// During a filter request, every tab keeps the displayed selection tied to its displayed data.
patchCode('dist/orders.js','function render() {','function render() {\n      const pendingQuery=query; query=data.selection;\n      try {');
patchCode('dist/orders.js','      if (busy) note("Updating selected orders...");\n    }','      if (busy) { note("Updating selected orders..."); root.querySelectorAll(\'.fo-results button,.fo-results select,[data-fo-action="export"]\').forEach(node=>node.disabled=true); }\n      } finally { query=pendingQuery; }\n    }');
patchCode('backend/vendor/orders.cjs','  row.currency =','  row.brand ||= text(data.Brands || data.brands || data.Brand || data["Brand Name"]);\n  row.currency =');
patchCode('backend/vendor/orders.cjs','input.includeCancelled === true || exceptions.includes("cancelled")','input.includeCancelled === true || exceptions.includes("cancelled") || /^(cancelled|canceled|void|voided)$/i.test(filters.status)');
patchCode('backend/vendor/source-reader.cjs','const expected = geoRepAttendanceContractForTab(tabName);','const expected = [...geoRepAttendanceContractForTab(tabName), "Brand"];');
patchCode('backend/vendor/source-reader.cjs','const configured = Object.prototype.hasOwnProperty.call(sourceContract.fields, name) ? sourceContract.fields[name] : name;',
  'const configured = name === "Brand" ? ["Brand", "Brands", "Brand Name"].find(h => candidate.header.columns.has(geoRepAttendanceCanonicalHeader(h))) || null : Object.prototype.hasOwnProperty.call(sourceContract.fields, name) ? sourceContract.fields[name] : name;');
patchCode('backend/vendor/source-reader.cjs','      result,\n      visited:', '      brand: String(value(row, ["Brand", "Brands", "Brand Name"]) || "").trim(),\n      result,\n      visited:');
patchCode('backend/vendor/attendance.cjs',"banner:clean(row.banner) || 'Unassigned'","brand:clean(row.brand || row.Brands || row.brands), banner:clean(row.banner) || 'Unassigned'");
patchCode('backend/vendor/attendance.cjs',"['region','division','role','banner','channel','date','week']","['region','division','role','banner','brand','channel','date','week']");
patchCode('backend/vendor/attendance.cjs','      banners:unique(group.items.map(r=>r.banner))','      brands:unique(group.items.map(r=>r.brand)), banners:unique(group.items.map(r=>r.banner))');
patchCode('backend/vendor/attendance.cjs','if (!filters.banner && !filters.channel','if (!filters.brand && !filters.banner && !filters.channel');
patchCode('backend/vendor/attendance.cjs','managers:unique(available.flatMap(r=>r.managerPath)),banners:','brands:unique(available.map(r=>r.brand)),managers:unique(available.flatMap(r=>r.managerPath)),banners:');
patchCode('backend/vendor/attendance.cjs',"'Geo result','Completed date'];","'Geo result','Completed date','Brand'];");
// Reuse one hierarchy lookup per report instead of rebuilding it for every staff row.
patchCode('backend/vendor/attendance.cjs','const omittedPerson = exclusions.matcher(dataset.exclusions || [], dataset.audience);','const omittedPerson = exclusions.matcher(dataset.exclusions || [], dataset.audience), index = hierarchyIndex(dataset.hierarchy);');
patchCode('backend/vendor/attendance.cjs','resolvePerson(r,dataset.audience,hierarchyIndex(dataset.hierarchy)),filters)','resolvePerson(r,dataset.audience,index),filters)');
patchCode('backend/vendor/attendance.cjs','const available = dataset.rows;','const available = dataset.rows;\n  const managerTotals = new Map(groups(rows,r=>r.manager).map(g=>[g.label,stripItems(g)]));');
patchCode('backend/vendor/attendance.cjs','map(label=>({label,...totals(rows.filter(r=>r.manager === label))}))','map(label=>managerTotals.get(label) || {label,...totals([])})');
// Group labels with the same identity rules used by filters and detail selections.
patchCode('backend/vendor/attendance.cjs','[...new Set(values.filter(valid))]','[...new Map(values.filter(valid).map(value=>[key(value),value])).values()]');
patchCode('backend/vendor/attendance.cjs',"groups(rows,r=>r[field] || 'Unassigned').map(stripItems)","groups(rows,r=>key(r[field] || 'Unassigned')).map(group=>({...stripItems(group),label:group.items[0][field] || 'Unassigned'}))");
patchCode('backend/vendor/attendance.cjs','JSON.stringify([r.userCode || key(r.userName),r.manager])','JSON.stringify([key(r.userCode || r.userName),key(r.manager)])');
patchCode('backend/vendor/attendance.cjs','new Map(groups(rows,r=>r.manager).map(g=>[g.label,stripItems(g)]))','new Map(groups(rows,r=>key(r.manager)).map(g=>[g.label,stripItems(g)]))');
patchCode('backend/vendor/attendance.cjs','map(label=>managerTotals.get(label) || {label,...totals([])})','map(label=>({...managerTotals.get(key(label)) || totals([]),label}))');
patchCode('dist/attendance.js','  function scorecard(data) {',"  const managerKey = value => String(value || '').trim().replace(/\\s+/g,' ').normalize('NFKC').toUpperCase();\n  function scorecard(data) {");
patchCode('dist/attendance.js','data.rows.filter(r=>r.manager === manager.label)','data.rows.filter(r=>managerKey(r.manager) === managerKey(manager.label))');
patchCode('backend/vendor/attendance.cjs',"r.completedDate || (r.completedDates || []).join(', ')]);","r.completedDate || (r.completedDates || []).join(', '),r.brand || (r.brands || []).join(', ')]);");
patchCode('dist/attendance.js',"'Line / Channel Manager','Region','Source row']","'Line / Channel Manager','Region','Brand','Source row']");
patchCode('dist/attendance.js','<td>${escape(r.region)}</td><td>${escape(r.id)}</td>','<td>${escape(r.region)}</td><td>${escape(r.brand || (r.brands || []).join(", "))}</td><td>${escape(r.id)}</td>');
patchCode('dist/attendance.js',"date = selected || days.at(-1)?.label || ''","date = days.some(day=>day.label===selected) ? selected : days.at(-1)?.label || ''");
patchCode('dist/attendance.js',"date:previous?.data.audience===data.audience ? previous.date : ''","date:options.date || (previous?.data.audience===data.audience ? previous.date : '')");
patchCode('dist/attendance.js','view.date=event.target.value;view.requestId++','view.date=event.target.value;options.onDateChange?.(view.date);view.requestId++');
patchCode('dist/attendance.js',"['Target Visits',metrics.scheduled,'#22c55e'","['Target Visits',metrics.scheduled,'#5b9bd5'");
patchCode('dist/attendance.js',"['Actual Visits',metrics.attended ?? metrics.onSchedule,'#d94f3a'","['Actual Visits',metrics.attended ?? metrics.onSchedule,'#22c55e'");
patchCode('dist/attendance.js',"['Stores Not Visited',metrics.missedStores,'#3b82f6'","['Stores Not Visited',metrics.missedStores,'#d94f3a'");
patchCode('dist/attendance.js',"['Targeted Stores',metrics.totalStores,'#a78bfa'","['Targeted Stores',metrics.totalStores,'#9dc4ec'");
for(const item of manifest){const actual=fs.readFileSync(path.join(root,item.target));item.outputSha256=hash(actual);}
fs.writeFileSync(path.join(root,'PORT_MANIFEST.json'),JSON.stringify({builtAt:new Date().toISOString(),files:manifest},null,2));
fs.writeFileSync(path.join(out,'404.html'),'<html lang="en"><meta charset="utf-8"><title>Not found</title><h1>Page not found</h1><p><a href="/attendance">Attendance</a> | <a href="/franchise-orders">Franchise Orders</a></p></html>');
console.log(`Built ${manifest.length} allowlisted assets/modules; extracted ${selected.size} read-only helpers. Original files unchanged.`);
