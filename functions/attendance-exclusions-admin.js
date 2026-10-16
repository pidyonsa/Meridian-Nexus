'use strict';
const crypto = require('node:crypto');
const E = require('./attendance-exclusions-core');
const A = require('./attendance-analytics');
const {assertActiveAdmin} = require('./admin-access');
const headers = ['Name', 'Type', 'Audience', 'Staff Code', 'Reason'];
function canonicalEntries(entries) {
  if (!Array.isArray(entries) || !entries.length || entries.length > 500) throw Error('Enter between 1 and 500 exclusions.');
  return entries.map(E.rule);
}
async function parseWorkbook(base64, defaults, {ExcelJS, JSZip}) {
  if (typeof base64 !== 'string' || base64.length > 1400000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw Error('Choose an XLSX workbook under 1 MB.');
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length > 1024 * 1024 || bytes.subarray(0, 2).toString() !== 'PK') throw Error('Choose an XLSX workbook under 1 MB.');
  const zip = await JSZip.loadAsync(bytes), files = Object.values(zip.files);
  if (files.length > 100 || files.some(f => /vbaProject|externalLinks/i.test(f.name)) || files.reduce((n, f) => n + (f._data?.uncompressedSize || 0), 0) > 10 * 1024 * 1024) throw Error('Workbook is too large or contains unsupported linked content.');
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes);
  const sheets = workbook.worksheets.filter(s => s.actualRowCount);
  if (sheets.length !== 1) throw Error('Use one worksheet containing the exclusion names.');
  const sheet = sheets[0];
  if (sheet.rowCount > 501 || sheet.columnCount > 5) throw Error('Use at most 500 names and the five template columns.');
  function cell(row, col) {
    const value = sheet.getCell(row, col).value;
    if (value == null) return '';
    if (typeof value === 'object') throw Error(`Row ${row}: formulas, links and rich text are not supported.`);
    return String(value).trim();
  }
  const first = Array.from({length:sheet.columnCount}, (_, i) => E.key(cell(1, i + 1)));
  const hasHeader = first.includes('NAME');
  if (!hasHeader && sheet.columnCount !== 1) throw Error('Use the template headers, or a single column of names.');
  if (hasHeader && (first.some(h => !headers.map(E.key).includes(h)) || new Set(first).size !== first.length)) throw Error('Use the template headers: Name, Type, Audience, Staff Code, Reason.');
  const entries = [];
  for (let row = hasHeader ? 2 : 1; row <= sheet.rowCount; row++) {
    const values = Array.from({length:sheet.columnCount}, (_, i) => cell(row, i + 1));
    if (values.every(v => !v)) continue;
    const value = name => values[first.indexOf(E.key(name))] || '';
    const type = hasHeader ? value('Type').toLowerCase() || defaults.type : defaults.type;
    const audience = hasHeader ? value('Audience').toLowerCase() || defaults.audience : defaults.audience;
    try { entries.push(E.rule({name:hasHeader ? value('Name') : values[0], type, audience, userCode:hasHeader ? value('Staff Code') : '', reason:hasHeader ? value('Reason') : ''})); }
    catch (error) { throw Error(`Row ${row}: ${error.message}`); }
  }
  return canonicalEntries(entries);
}
function createService(deps) {
  const {db, HttpsError, ExcelJS, hierarchy} = deps;
  const ref = db.collection('geoRepAttendanceConfig').doc('current');
  const readPolicy = doc => E.policy(doc.data()?.dashboardExclusions);
  const digest = (uid, revision, entries) => crypto.createHash('sha256').update(JSON.stringify([uid, revision, entries])).digest('hex');
  async function list() {
    const doc = await ref.get(), config = readPolicy(doc);
    const audit = await ref.collection('exclusionAudit').orderBy('at', 'desc').limit(20).get();
    const raw = doc.data()?.dashboardExclusions;
    return {...config, updatedAt:raw?.updatedAt || null, updatedBy:raw?.updatedBy || null,
      history:audit.docs.map(d => ({id:d.id, ...d.data()}))};
  }
  async function preview(entries, config, uid) {
    const existing = new Set(config.entries.map(r => r.id)), seen = new Set();
    const index = A.hierarchyIndex(hierarchy), people = [];
    for (const audience of ['rep', 'merchandiser']) {
      const source = await db.collection('geoRepAttendanceDashboard').doc(audience === 'rep' ? 'current' : 'merchandisers').get();
      for (const row of source.data()?.rows || []) people.push({...A.resolvePerson(row, audience, index), audience});
    }
    const review = entries.map(entry => {
      const duplicate = existing.has(entry.id) || seen.has(entry.id); seen.add(entry.id);
      const matched = people.filter(person => E.matches(person, entry, person.audience));
      const names = [...new Set(matched.map(p => `${p.userName}${p.userCode ? ` (${p.userCode})` : ''} / ${p.audience}`))];
      return {...entry, duplicate, matchedPeople:names.length, sample:names.slice(0, 8)};
    });
    return {entries, review, revision:config.revision, reviewId:digest(uid, config.revision, entries),
      adding:review.filter(r => !r.duplicate).length, duplicates:review.filter(r => r.duplicate).length,
      unmatched:review.filter(r => !r.duplicate && !r.matchedPeople).length};
  }
  return async request => {
    const profile = await assertActiveAdmin(deps, request);
    const data = request.data || {}, action = data.action || 'list';
    if (action === 'list') return list();
    if (action === 'template') {
      const book = new ExcelJS.Workbook(), sheet = book.addWorksheet('Exclusions'); sheet.addRow(headers);
      sheet.getRow(1).font = {bold:true}; sheet.columns.forEach(c => {c.width = 25;});
      sheet.getCell('B1').note = 'person or manager. A manager exclusion includes their reporting team.';
      sheet.getCell('C1').note = 'rep, merchandiser or both. Blank uses the selected import audience.';
      return {fileName:'Syndicated-attendance-exclusions.xlsx', base64:Buffer.from(await book.xlsx.writeBuffer()).toString('base64')};
    }
    if (action === 'preview') {
      let entries;
      try { entries = data.workbook ? await parseWorkbook(data.workbook, {type:data.type || 'person', audience:data.audience || 'both'}, deps) : canonicalEntries(data.entries); }
      catch (error) { throw new HttpsError('invalid-argument', error.message); }
      return preview(entries, readPolicy(await ref.get()), request.auth.uid);
    }
    if (!['commit', 'setEnabled', 'remove'].includes(action)) throw new HttpsError('invalid-argument', 'Unknown exclusion action.');
    if (!Number.isSafeInteger(data.revision) || data.revision < 0) throw new HttpsError('invalid-argument', 'Reload the exclusion list before saving.');
    let entries = [];
    if (action === 'commit') {
      try { entries = canonicalEntries(data.entries); } catch (error) { throw new HttpsError('invalid-argument', error.message); }
      if (data.reviewId !== digest(request.auth.uid, data.revision, entries)) throw new HttpsError('failed-precondition', 'Preview these exclusions before saving.');
    } else if (!/^[a-f0-9]{32}$/.test(data.id || '') || (action === 'setEnabled' && typeof data.enabled !== 'boolean')) throw new HttpsError('invalid-argument', 'Invalid exclusion update.');
    const actor = {uid:request.auth.uid, name:profile.displayName || profile.name || '', email:request.auth.token.email || profile.email || ''};
    const at = new Date().toISOString(), audit = ref.collection('exclusionAudit').doc();
    let changed = 0;
    await db.runTransaction(async tx => {
      const config = readPolicy(await tx.get(ref));
      if (config.revision !== data.revision) throw new HttpsError('aborted', 'Another administrator changed the list. Reload and preview again.');
      const next = new Map(config.entries.map(r => [r.id, r])), affected = [];
      if (action === 'commit') {
        for (const entry of entries) if (!next.has(entry.id)) { next.set(entry.id, entry); affected.push(entry); }
      } else {
        const entry = next.get(data.id); if (!entry) throw new HttpsError('not-found', 'This exclusion no longer exists.');
        if (action === 'remove') { next.delete(data.id); affected.push(entry); }
        else if (entry.enabled !== data.enabled) { const updated = {...entry, enabled:data.enabled}; next.set(entry.id, updated); affected.push(updated); }
      }
      if (next.size > E.MAX_RULES) throw new HttpsError('resource-exhausted', `Keep at most ${E.MAX_RULES} exclusions.`);
      changed = affected.length;
      if (!changed) return;
      const dashboardExclusions = {revision:config.revision + 1, entries:[...next.values()], updatedAt:at, updatedBy:actor};
      tx.set(ref, {dashboardExclusions}, {merge:true});
      tx.set(audit, {action, at, actor, revision:dashboardExclusions.revision, entries:affected});
    });
    return {...await list(), changed};
  };
}
module.exports = {createService, parseWorkbook, canonicalEntries};
