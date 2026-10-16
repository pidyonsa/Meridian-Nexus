'use strict';
const crypto = require('node:crypto');
const exclusions = require('./attendance-exclusions-core');
const clean = value => String(value ?? '').trim().replace(/\s+/g, ' ');
const key = value => clean(value).normalize('NFKC').toUpperCase();
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const valid = value => value && !['UNASSIGNED', 'NOT SET', '-'].includes(key(value));
const unique = values => [...new Set(values.filter(valid))].sort((a,b) => a.localeCompare(b));
function division(region, fallback = '') {
  const r = key(region).replace(/[-_]/g, ' ');
  if (/FREE\s*STATE|NORTH\s*WEST/.test(r)) return 'CENTRAL';
  if (/WESTERN|EASTERN|KWA|NATAL|PORT ELIZABETH|EAST LONDON|COAST|SWD|PE OPERATIONS/.test(r)) return 'COASTAL';
  if (/GAUTENG|MPUMALANGA|LIMPOPO/.test(r)) return 'INLAND';
  return ['CENTRAL', 'COASTAL', 'INLAND'].includes(key(fallback)) ? key(fallback) : 'UNASSIGNED';
}
function resultStatus(value) {
  const result = key(value).replace(/[_-]/g, ' ');
  if (completionDate(value)) return 'visited';
  if (/\bLEAVE\b/.test(result)) return 'excluded';
  if (/^(NOT VISITED|NOT COMPLETED|NOT CHECKED IN|MISSED|NO VISIT|NO CHECK IN|UNVISITED|ABSENT)$/.test(result)) return 'missed';
  if (/^(VISITED|COMPLETED|CHECKED IN|CHECK IN|ATTENDED)$/.test(result)) return 'visited';
  return 'unknown';
}
function completionDate(value) {
  const match = clean(value).match(/^(?:Caught up|Early visit) on:\s*(\d{4}-\d{2}-\d{2})$/i);
  if (!match) return '';
  const date = new Date(`${match[1]}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === match[1] ? match[1] : '';
}
function hierarchyIndex(hierarchy) {
  const index = new Map();
  for (const r of hierarchy.rows || []) {
    const k = key(r.name), entries = index.get(k) || [];
    if (!entries.some(e => ['manager','regionalManager','generalManager','head','division','region'].every(f => key(e[f]) === key(r[f])))) entries.push(r);
    index.set(k, entries);
  }
  return index;
}
function resolvePerson(row, audience, index) {
  const userName = clean(row.userName) || 'Unassigned';
  const rep = audience === 'merchandiser' ? clean(row.rep || row.manager) : userName;
  const matches = index.get(key(rep)) || [], h = matches.length === 1 ? matches[0] : null;
  const sourceManager = clean(row.manager);
  const manager = h?.manager || (audience === 'rep' ? sourceManager : '') || 'Unassigned';
  const region = valid(row.region) ? clean(row.region) : h?.region || 'Unassigned';
  return {userName, userCode:clean(row.userCode), rep:valid(rep) ? rep : '', manager, sourceManager,
    regionalManager:h?.regionalManager || '', generalManager:h?.generalManager || '', head:h?.head || '',
    managerPath:unique([manager,h?.regionalManager,h?.generalManager,h?.head]), region, division:division(region,h?.division || row.division),
    hierarchyStatus:h ? (h.manager ? 'matched' : 'manager-not-specified') : matches.length > 1 ? 'ambiguous' : 'unmatched',
    hierarchyName:h?.name || '', role:clean(row.role) || (audience === 'merchandiser' ? 'Merchandiser' : 'Rep')};
}
function normaliseVisits(rows, audience, hierarchy) {
  const index = hierarchyIndex(hierarchy);
  return rows.map((row, i) => {
    const person = resolvePerson(row, audience, index), storeName = clean(row.storeName || row.customer) || 'Unassigned store';
    const storeCode = clean(row.storeCode);
    const storeId = storeCode ? `code:${key(storeCode)}` : `name:${key(person.region)}|${key(storeName)}`;
    const completedDate = completionDate(row.result), status = resultStatus(row.result);
    return {id:clean(row.id) || `source-row-${i+2}`, ...person, date:clean(row.date), week:clean(row.week),
      storeName, storeCode, storeId, banner:clean(row.banner) || 'Unassigned', channel:clean(row.channel) || 'Unassigned',
      result:clean(row.result), status, caughtUp:!!completedDate && /^Caught up on:/i.test(clean(row.result)),
      earlyVisit:!!completedDate && /^Early visit on:/i.test(clean(row.result)), completedDate:completedDate || (status === 'visited' ? clean(row.date) : '')};
  });
}
function matches(row, filters = {}) {
  return ['region','division','role','banner','channel','date','week'].every(f => !filters[f] || key(row[f]) === key(filters[f]))
    && (!filters.lineManager || key(row.manager) === key(filters.lineManager))
    && (!filters.manager || (row.managerPath || [row.manager]).some(v => key(v) === key(filters.manager)))
    && (!filters.person || key(row.userCode || row.userName) === key(filters.person))
    && (!filters.store || row.storeId === filters.store);
}
function totals(rows) {
  const stores = new Map(); let attended = 0, missedVisits = 0, unknownVisits = 0;
  for (const r of rows) {
    attended += r.status === 'visited' ? 1 : 0; missedVisits += r.status === 'missed' ? 1 : 0; unknownVisits += r.status === 'unknown' ? 1 : 0;
    const store = stores.get(r.storeId) || {visited:false, unknown:false};
    store.visited ||= r.status === 'visited'; store.unknown ||= r.status === 'unknown'; stores.set(r.storeId,store);
  }
  return {scheduled:rows.length, onSchedule:attended, attended, caughtUpVisits:rows.filter(r=>r.caughtUp).length, earlyVisits:rows.filter(r=>r.earlyVisit).length, missedVisits, unknownVisits,
    totalStores:stores.size, visitedStores:[...stores.values()].filter(s=>s.visited).length,
    missedStores:[...stores.values()].filter(s=>!s.visited && !s.unknown).length,
    unknownStores:[...stores.values()].filter(s=>!s.visited && s.unknown).length,
    strikeRate:rows.length ? attended/rows.length*100 : 0,
    users:new Set(rows.map(r=>r.userCode || key(r.userName))).size};
}
function groups(rows, groupKey) {
  const buckets = new Map();
  for (const row of rows) { const label = groupKey(row); const list = buckets.get(label) || []; list.push(row); buckets.set(label,list); }
  return [...buckets.entries()].map(([label,items])=>({label, ...totals(items), items}));
}
const stripItems = ({items,...row}) => row;
function storeRows(rows) {
  return groups(rows,r=>r.storeId).map(group=>{
    const first = group.items[0], metric = stripItems(group);
    return {...metric, id:first.storeId, storeId:first.storeId, storeName:first.storeName, region:first.region,
      storeCodes:unique(group.items.map(r=>r.storeCode)), divisions:unique(group.items.map(r=>r.division)),
      managers:unique(group.items.map(r=>r.manager)), managerPaths:unique(group.items.flatMap(r=>r.managerPath)),
      resources:unique(group.items.map(r=>r.userName)), reps:unique(group.items.map(r=>r.rep)), roles:unique(group.items.map(r=>r.role)),
      banners:unique(group.items.map(r=>r.banner)), channels:unique(group.items.map(r=>r.channel)),
      dates:unique(group.items.map(r=>r.date)), completedDates:unique(group.items.map(r=>r.completedDate)), weeks:unique(group.items.map(r=>r.week)),
      status:metric.attended ? 'visited' : metric.unknownVisits ? 'unknown' : 'missed'};
  }).sort((a,b)=>a.storeName.localeCompare(b.storeName));
}
function reconciliation(sourceRows, visits, hierarchy, audience, filters) {
  const index = hierarchyIndex(hierarchy);
  const observed = new Set(sourceRows.map(r=>key(audience === 'merchandiser' ? r.manager : r.userName)));
  const planned = new Set(visits.map(r=>key(audience === 'merchandiser' ? r.rep : r.userName)));
  const expected = audience === 'rep' ? (hierarchy.rows || []).filter(r=>r.assignment === 'syndicated') : [];
  const output = [];
  for (const r of expected) {
    const person = resolvePerson({userName:r.name,region:r.region}, 'rep', index);
    if (matches(person,filters) && (!observed.has(key(r.name)) || !planned.has(key(r.name)))) output.push({...person, issue:!observed.has(key(r.name)) ? 'Missing from Geo strike-rate source' : 'No scheduled visits in selected report'});
  }
  for (const r of sourceRows) {
    const person = resolvePerson(r,audience,index);
    if (matches(person,filters) && person.hierarchyStatus !== 'matched') output.push({...person,issue:person.hierarchyStatus === 'ambiguous' ? 'Conflicting hierarchy entries' : audience === 'merchandiser' ? 'Rep-to-manager mapping not found in supplied hierarchy' : 'Not matched to supplied hierarchy'});
  }
  return output;
}
function buildDataset({visits, sourceRows = [], hierarchy, audience, source = {}, version}) {
  const all = normaliseVisits(visits,audience,hierarchy);
  const rows = all.filter(r=>r.status !== 'excluded');
  return {rows, planRows:all, sourceRows, hierarchy, audience, source, version,
    excludedVisits:all.length-rows.length,
    warnings:unique([all.some(r=>r.status === 'unknown') ? 'Some source results are unrecognised; they are shown as unverified, not completed or missed.' : '',
      all.some(r=>!r.storeCode) ? 'Stores without codes are reconciled by exact normalised store name and region.' : '',
      all.some(r=>r.hierarchyStatus !== 'matched') ? 'Some reporting lines need confirmation in the hierarchy reconciliation.' : ''])};
}
function applyExclusions(dataset, config) {
  const entries = config.entries.filter(r => r.enabled);
  const omittedPerson = exclusions.matcher(entries, dataset.audience);
  const index = hierarchyIndex(dataset.hierarchy);
  const rows = entries.length ? dataset.rows.filter(r => !omittedPerson(r)) : dataset.rows;
  const sourceRows = entries.length ? dataset.sourceRows.filter(r => !omittedPerson(resolvePerson(r, dataset.audience, index))) : dataset.sourceRows;
  const omitted = dataset.rows.length - rows.length;
  return {...dataset, rows, sourceRows, exclusions:entries, exclusionRevision:config.revision,
    version:exclusions.revisionVersion(dataset.version, config), adminExcludedVisits:omitted,
    warnings:[...dataset.warnings, ...(omitted ? [`${omitted} scheduled visits are omitted by administrator attendance exclusions.`] : [])]};
}
function dashboard(dataset, filters = {}) {
  const omittedPerson = exclusions.matcher(dataset.exclusions || [], dataset.audience);
  const rows = dataset.rows.filter(r=>matches(r,filters));
  const metrics = totals(rows);
  const by = field => groups(rows,r=>r[field] || 'Unassigned').map(stripItems).sort((a,b)=>a.label.localeCompare(b.label,undefined,{numeric:true}));
  const people = groups(rows,r=>JSON.stringify([r.userCode || key(r.userName),r.manager])).map(g=>({...g.items[0],...stripItems(g),userName:g.items[0].userName,label:g.items[0].userName}));
  const sourcePeople = new Map(dataset.sourceRows.map(r=>[key(r.userCode || r.userName),r]));
  for (const p of people) { const s = sourcePeople.get(key(p.userCode || p.userName)); p.sourceScheduled = s ? number(s.scheduled) : null; p.sourceActual = s ? number(s.onSchedule) : null; }
  if (!filters.banner && !filters.channel && !filters.date && !filters.week && !filters.store) {
    const ids = new Set(people.map(r=>key(r.userCode || r.userName))), index = hierarchyIndex(dataset.hierarchy);
    for (const r of dataset.sourceRows) {
      const person = resolvePerson(r,dataset.audience,index);
      if (!ids.has(key(r.userCode || r.userName)) && matches(person,filters)) people.push({...person,label:person.userName,noSchedule:true,scheduled:null,attended:null,missedVisits:null,unknownVisits:null,strikeRate:null,sourceScheduled:number(r.scheduled),sourceActual:number(r.onSchedule)});
    }
  }
  const available = dataset.rows;
  metrics.users = new Set(people.map(p=>p.userCode || key(p.userName))).size;
  return {analyticsVersion:1, version:dataset.version, audience:dataset.audience, ...dataset.source, metrics,
    rows:people, stores:storeRows(rows), storeCoverage:{totalStores:metrics.totalStores,totalVisits:metrics.scheduled},
    availableFilters:{roles:unique(available.map(r=>r.role)),regions:unique(available.map(r=>r.region)),divisions:unique(available.map(r=>r.division)),
      managers:unique(available.flatMap(r=>r.managerPath)),banners:unique(available.map(r=>r.banner)),channels:unique(available.map(r=>r.channel))},
    charts:{byRegion:by('region'),byDivision:by('division'),byManager:unique(people.map(p=>p.manager)).concat(people.some(p=>p.manager === 'Unassigned') ? ['Unassigned'] : []).map(label=>({label,...totals(rows.filter(r=>r.manager === label))})),byRole:by('role')},
    scheduleAnalytics:{daily:by('date'),weekly:by('week')},
    reconciliation:reconciliation(dataset.sourceRows, dataset.rows, dataset.hierarchy,dataset.audience,filters).filter(r=>!omittedPerson(r)),
    quality:{basis:'Schedules worksheet; leave rows excluded; caught-up and early visits count as attended against their scheduled day; cancellations retained for review',excludedVisits:dataset.excludedVisits,unknownVisits:metrics.unknownVisits,warnings:dataset.warnings,
      unverifiedResults:groups(rows.filter(r=>r.status === 'unknown'),r=>r.result || '(empty)').map(r=>({result:r.label,count:r.scheduled})),
      hierarchySource:dataset.hierarchy.sourceName,hierarchyVersion:dataset.hierarchy.sha256,adminExcludedVisits:dataset.adminExcludedVisits || 0,exclusionRevision:dataset.exclusionRevision || 0,
      strikeRateTotals:totalsFromSource(dataset.sourceRows.filter(r=>matches(resolvePerson(r,dataset.audience,hierarchyIndex(dataset.hierarchy)),filters)))}};
}
function totalsFromSource(rows) { return {scheduled:rows.reduce((s,r)=>s+number(r.scheduled),0),actual:rows.reduce((s,r)=>s+number(r.onSchedule),0)}; }
function detail(dataset, filters, selection = {}) {
  const rows = dataset.rows.filter(r=>matches(r,filters)).filter(r=>matches(r,selection));
  const metric = selection.metric || 'target', unit = selection.unit || 'visits';
  if (!['target','actual','missed','unknown'].includes(metric) || !['visits','stores'].includes(unit)) throw new Error('Invalid detail selection');
  const candidates = unit === 'stores' ? storeRows(rows) : rows;
  const selected = candidates.filter(r=>metric === 'target' || r.status === ({actual:'visited',missed:'missed',unknown:'unknown'})[metric]);
  return {rows:selected, total:selected.length, totals:totals(rows), unit, metric};
}
async function excel(detailResult, metadata, ExcelJS) {
  const workbook = new ExcelJS.Workbook(); workbook.creator = 'Meridian Nexus';
  const sheet = workbook.addWorksheet(detailResult.unit === 'stores' ? 'Stores' : 'Visits');
  const headers = ['Source row','Scheduled date','Geo week','Store code','Store','Status','Merchandiser','Rep','Line / Channel Manager','Regional Manager','Region','Division','Role','Banner','Channel','Target','Actual','Not Visited','Unverified','Geo result','Completed date'];
  sheet.addRow(headers);
  for (const r of detailResult.rows) sheet.addRow([r.id,r.date || (r.dates || []).join(', '),r.week || (r.weeks || []).join(', '),r.storeCode || (r.storeCodes || []).join(', '),r.storeName,r.status,
    metadata.audience === 'merchandiser' ? r.userName || (r.resources || []).join(', ') : '',r.rep || (r.reps || []).join(', '),r.manager || (r.managers || []).join(', '),r.regionalManager || '',r.region,r.division || (r.divisions || []).join(', '),r.role || (r.roles || []).join(', '),r.banner || (r.banners || []).join(', '),r.channel || (r.channels || []).join(', '),r.scheduled ?? 1,r.attended ?? (r.status === 'visited' ? 1 : 0),r.missedVisits ?? (r.status === 'missed' ? 1 : 0),r.unknownVisits ?? (r.status === 'unknown' ? 1 : 0),r.result || '',r.completedDate || (r.completedDates || []).join(', ')]);
  sheet.views = [{state:'frozen',ySplit:1}]; sheet.autoFilter = {from:{row:1,column:1},to:{row:sheet.rowCount,column:headers.length}};
  sheet.columns.forEach((c,i)=>{c.width = i < 3 ? 18 : i > 14 ? 14 : 28});
  sheet.getRow(1).font = {bold:true,color:{argb:'FFFFFFFF'}}; sheet.getRow(1).fill = {type:'pattern',pattern:'solid',fgColor:{argb:'FF0C2948'}};
  const info = workbook.addWorksheet('Selection'); info.columns=[{width:28},{width:110}];
  for (const [k,v] of Object.entries({...metadata,rows:detailResult.total,unit:detailResult.unit,metric:detailResult.metric})) info.addRow([k,typeof v === 'object' ? JSON.stringify(v) : String(v)]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
function createService(deps) {
  const cache = new Map();
  return async request => {
    const {db,hierarchy,HttpsError} = deps;
    const input = request.data || {}, audience = input.audience === 'merchandiser' ? 'merchandiser' : 'rep';
    const mode = input.mode || 'dashboard';
    if (!['dashboard','callcycle','detail','export'].includes(mode)) throw new HttpsError('invalid-argument','Unknown attendance request');
    const filters = input.filters || {}, selection = input.selection || {};
    if (typeof filters !== 'object' || Array.isArray(filters) || typeof selection !== 'object' || Array.isArray(selection)) throw new HttpsError('invalid-argument','Invalid attendance filter');
    for (const object of [filters,selection]) for (const [field,value] of Object.entries(object)) if (!['region','division','role','banner','channel','date','week','manager','lineManager','person','store','metric','unit'].includes(field) || typeof value !== 'string' || value.length > 500) throw new HttpsError('invalid-argument','Invalid attendance filter');
    const doc = await db.collection('geoRepAttendanceDashboard').doc(audience === 'rep' ? 'current' : 'merchandisers').get();
    if (!doc.exists) throw new HttpsError('not-found','No verified attendance source is available.');
    const source = doc.data(), fileId = source.source?.schedules?.fileId;
    if (!fileId) throw new HttpsError('failed-precondition','The latest attendance source workbook is not linked.');
    const fileDoc = await db.collection('files').doc(fileId).get();
    if (!fileDoc.exists) throw new HttpsError('not-found','The verified source workbook is no longer available.');
    const file = fileDoc.data();
    const version = crypto.createHash('sha256').update(JSON.stringify(['attendance-analytics4-early-visits',fileId,file.sha256,source.updatedByRunId,hierarchy.sha256,audience])).digest('hex');
    for (const [k,v] of cache) if (v.expires <= Date.now()) cache.delete(k);
    let entry = cache.get(version);
    if (!entry) {
      while(cache.size >= 2) cache.delete(cache.keys().next().value);
      entry = {expires:Date.now()+120000, promise:deps.loadVisits(file,audience).then(visits=>buildDataset({visits,sourceRows:source.rows || [],hierarchy,audience,version,
        source:{reportStartDate:source.reportStartDate || '',reportEndDate:source.reportEndDate || '',updatedAt:source.updatedAt || null,source:source.source || {},tracker:source.tracker || null,operationalWeek:source.operationalWeek || 0}}))};
      cache.set(version,entry); entry.promise.catch(()=>cache.delete(version));
    }
    let dataset = await entry.promise;
    if (mode === 'callcycle') {
      if (input.version && input.version !== version) throw new HttpsError('failed-precondition','Attendance has refreshed. Reload the dashboard before opening or exporting these records.');
      const stores = storeRows(dataset.planRows.filter(r=>matches(r,filters)));
      return {...dataset.source,version,stores,coverageBasis:'All schedule assignments, including leave; attendance exclusions do not remove stores from the call plan.'};
    }
    const config = exclusions.policy((await db.collection('geoRepAttendanceConfig').doc('current').get()).data()?.dashboardExclusions);
    dataset = applyExclusions(dataset, config);
    const attendanceVersion = dataset.version;
    if (input.version && input.version !== attendanceVersion) throw new HttpsError('failed-precondition','Attendance has refreshed. Reload the dashboard before opening or exporting these records.');
    if (mode === 'dashboard') {
      const output = dashboard(dataset,filters);
      if (Buffer.byteLength(JSON.stringify(output)) > 9*1024*1024) throw new HttpsError('resource-exhausted','Attendance selection is too large. Select a manager or region.');
      return output;
    }
    let selected; try { selected = detail(dataset,filters,selection); } catch { throw new HttpsError('invalid-argument','Invalid attendance detail selection'); }
    if (mode === 'export') {
      const buffer = await excel(selected,{audience,source:file.name || '',version:attendanceVersion,exclusionRevision:config.revision,filters,selection,reportStartDate:source.reportStartDate,reportEndDate:source.reportEndDate},deps.ExcelJS);
      if (buffer.length > 6*1024*1024) throw new HttpsError('resource-exhausted','Export exceeds the download limit. Select a day, manager or region.');
      return {fileName:`Attendance-${audience}-${source.reportEndDate || 'latest'}-${selected.metric}.xlsx`,base64:buffer.toString('base64'),total:selected.total,version:attendanceVersion};
    }
    const page = Number(input.page ?? 1), pageSize = Number(input.pageSize ?? 100);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 250) throw new HttpsError('invalid-argument','Invalid detail page');
    return {...selected, rows:selected.rows.slice((page-1)*pageSize,page*pageSize),page,pageSize,pageCount:Math.max(1,Math.ceil(selected.total/pageSize)),version:attendanceVersion};
  };
}
module.exports = {division,resultStatus,hierarchyIndex,resolvePerson,normaliseVisits,matches,totals,buildDataset,applyExclusions,dashboard,detail,excel,createService};
