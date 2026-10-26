'use strict';
// Syndicated attendance exclusions (people or managers' teams left out of the attendance dashboards): the
// Firebase-era manageSyndicatedAttendanceExclusions (functions/attendance-exclusions-core.js, -admin.js and the
// person resolution of attendance-analytics.js, read 26 October 2026) on the same geoRepAttendanceConfig/current
// .dashboardExclusions and exclusionAudit documents. The Azure attendance publisher and the dashboards read them.
const crypto = require('node:crypto');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const {AppError} = require('../errors.cjs');
const hierarchy = require('./hierarchy.json');

const CONFIG = 'geoRepAttendanceConfig/current';
const MAX_RULES = 1000;
const HEADERS = ['Name', 'Type', 'Audience', 'Staff Code', 'Reason'];
const clean = v => String(v ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
const key = v => clean(v).toUpperCase();

function textField(value, label, max, required = false) {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f]/.test(value) || (required && !clean(value))) throw new Error(`Invalid ${label}.`);
  return clean(value);
}
function rule(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid exclusion.');
  const name = textField(value.name, 'name', 160, true), userCode = textField(value.userCode, 'staff code', 80);
  const type = value.type || 'person', audience = value.audience || 'both';
  if (!['person', 'manager'].includes(type) || !['rep', 'merchandiser', 'both'].includes(audience)) throw new Error('Invalid exclusion type or audience.');
  if (type === 'manager' && userCode) throw new Error('Manager/team exclusions use the manager name, not a staff code.');
  const reason = textField(value.reason, 'reason', 300);
  if (value.enabled !== undefined && typeof value.enabled !== 'boolean') throw new Error('Invalid enabled flag.');
  const id = crypto.createHash('sha256').update(JSON.stringify([type, audience, userCode ? 'code' : 'name', key(userCode || name)])).digest('hex').slice(0, 32);
  return {id, type, audience, name, userCode, reason, enabled: value.enabled !== false};
}
function policy(value) {
  if (value == null) return {revision: 0, entries: []};
  if (!Number.isSafeInteger(value.revision) || value.revision < 0 || !Array.isArray(value.entries) || value.entries.length > MAX_RULES) throw new Error('Invalid attendance exclusion settings.');
  const entries = value.entries.map(rule);
  if (new Set(entries.map(r => r.id)).size !== entries.length) throw new Error('Duplicate attendance exclusion settings.');
  return {revision: value.revision, entries};
}
function matches(person, entry, audience) {
  if (!entry.enabled || (entry.audience !== 'both' && entry.audience !== audience)) return false;
  if (entry.type === 'person') return entry.userCode ? key(person.userCode) === key(entry.userCode) : key(person.userName) === key(entry.name);
  return [person.userName, person.rep, ...(person.managerPath || [person.manager])].some(n => n && key(n) === key(entry.name));
}
const canonicalEntries = entries => {
  if (!Array.isArray(entries) || !entries.length || entries.length > 500) throw new Error('Enter between 1 and 500 exclusions.');
  return entries.map(rule);
};

// The reporting line of a dashboard row (attendance-analytics.js resolvePerson), for previewing who a rule matches.
const valid = v => v && !['UNASSIGNED', 'NOT SET', '-'].includes(key(v));
const HIERARCHY = (() => {
  const index = new Map();
  for (const r of hierarchy.rows || []) {
    const k = key(r.name), entries = index.get(k) || [];
    if (!entries.some(e => ['manager', 'regionalManager', 'generalManager', 'head', 'division', 'region'].every(f => key(e[f]) === key(r[f])))) entries.push(r);
    index.set(k, entries);
  }
  return index;
})();
function resolvePerson(row, audience) {
  const userName = clean(row.userName) || 'Unassigned';
  const rep = audience === 'merchandiser' ? clean(row.rep || row.manager) : userName;
  const found = HIERARCHY.get(key(rep)) || [], h = found.length === 1 ? found[0] : null;
  const manager = h?.manager || (audience === 'rep' ? clean(row.manager) : '') || 'Unassigned';
  return {userName, userCode: clean(row.userCode), rep: valid(rep) ? rep : '', manager, managerPath: [...new Set([manager, h?.regionalManager, h?.generalManager, h?.head].filter(valid))]};
}

async function parseWorkbook(base64, defaults) {
  if (typeof base64 !== 'string' || base64.length > 1400000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error('Choose an XLSX workbook under 1 MB.');
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length > 1024 * 1024 || bytes.subarray(0, 2).toString() !== 'PK') throw new Error('Choose an XLSX workbook under 1 MB.');
  const zip = await JSZip.loadAsync(bytes), files = Object.values(zip.files);
  if (files.length > 100 || files.some(f => /vbaProject|externalLinks/i.test(f.name)) || files.reduce((n, f) => n + (f._data?.uncompressedSize || 0), 0) > 10 * 1024 * 1024) throw new Error('Workbook is too large or contains unsupported linked content.');
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes);
  const sheets = book.worksheets.filter(s => s.actualRowCount);
  if (sheets.length !== 1) throw new Error('Use one worksheet containing the exclusion names.');
  const sheet = sheets[0];
  if (sheet.rowCount > 501 || sheet.columnCount > 5) throw new Error('Use at most 500 names and the five template columns.');
  const cell = (row, col) => {
    const value = sheet.getCell(row, col).value;
    if (value == null) return '';
    if (typeof value === 'object') throw new Error(`Row ${row}: formulas, links and rich text are not supported.`);
    return String(value).trim();
  };
  const first = Array.from({length: sheet.columnCount}, (_, i) => key(cell(1, i + 1)));
  const hasHeader = first.includes('NAME');
  if (!hasHeader && sheet.columnCount !== 1) throw new Error('Use the template headers, or a single column of names.');
  if (hasHeader && (first.some(x => !HEADERS.map(key).includes(x)) || new Set(first).size !== first.length)) throw new Error('Use the template headers: Name, Type, Audience, Staff Code, Reason.');
  const entries = [];
  for (let row = hasHeader ? 2 : 1; row <= sheet.rowCount; row++) {
    const values = Array.from({length: sheet.columnCount}, (_, i) => cell(row, i + 1));
    if (values.every(v => !v)) continue;
    const value = name => values[first.indexOf(key(name))] || '';
    const type = hasHeader ? value('Type').toLowerCase() || defaults.type : defaults.type;
    const audience = hasHeader ? value('Audience').toLowerCase() || defaults.audience : defaults.audience;
    try { entries.push(rule({name: hasHeader ? value('Name') : values[0], type, audience, userCode: hasHeader ? value('Staff Code') : '', reason: hasHeader ? value('Reason') : ''})); } catch (error) { throw new Error(`Row ${row}: ${error.message}`); }
  }
  return canonicalEntries(entries);
}

function exclusionService({fs, actorOf}) {
  const readPolicy = doc => { try { return policy(doc?.data?.dashboardExclusions); } catch (error) { throw new AppError('failed-precondition', error.message); } };
  const digest = (uid, revision, entries) => crypto.createHash('sha256').update(JSON.stringify([uid, revision, entries])).digest('hex');
  const invalid = fn => { try { return fn(); } catch (error) { throw new AppError('invalid-argument', error.message); } };

  async function list() {
    const doc = await fs.get(CONFIG);
    const config = readPolicy(doc);
    const audit = await fs.query('exclusionAudit', {parent: CONFIG, orderBy: [['at', 'desc']], limit: 20});
    const raw = doc?.data?.dashboardExclusions;
    return {...config, updatedAt: raw?.updatedAt || null, updatedBy: raw?.updatedBy || null, history: audit.map(d => ({id: d.id, ...d.data}))};
  }

  async function template() {
    const book = new ExcelJS.Workbook(), sheet = book.addWorksheet('Exclusions');
    sheet.addRow(HEADERS);
    sheet.getRow(1).font = {bold: true};
    sheet.columns.forEach(c => { c.width = 25; });
    sheet.getCell('B1').note = 'person or manager. A manager exclusion includes their reporting team.';
    sheet.getCell('C1').note = 'rep, merchandiser or both. Blank uses the selected import audience.';
    return {fileName: 'Syndicated-attendance-exclusions.xlsx', data: Buffer.from(await book.xlsx.writeBuffer())};
  }

  async function preview(user, body) {
    let entries;
    try { entries = body.workbook ? await parseWorkbook(body.workbook, {type: body.type || 'person', audience: body.audience || 'both'}) : canonicalEntries(body.entries); } catch (error) { throw new AppError('invalid-argument', error.message); }
    const actor = await actorOf(user);
    const config = readPolicy(await fs.get(CONFIG));
    const existing = new Set(config.entries.map(r => r.id)), seen = new Set(), people = [];
    for (const audience of ['rep', 'merchandiser']) {
      const source = await fs.get(`geoRepAttendanceDashboard/${audience === 'rep' ? 'current' : 'merchandisers'}`);
      for (const row of source?.data?.rows || []) people.push({...resolvePerson(row, audience), audience});
    }
    const review = entries.map(entry => {
      const duplicate = existing.has(entry.id) || seen.has(entry.id);
      seen.add(entry.id);
      const names = [...new Set(people.filter(p => matches(p, entry, p.audience)).map(p => `${p.userName}${p.userCode ? ` (${p.userCode})` : ''} / ${p.audience}`))];
      return {...entry, duplicate, matchedPeople: names.length, sample: names.slice(0, 8)};
    });
    return {entries, review, revision: config.revision, reviewId: digest(actor.uid, config.revision, entries),
      adding: review.filter(r => !r.duplicate).length, duplicates: review.filter(r => r.duplicate).length, unmatched: review.filter(r => !r.duplicate && !r.matchedPeople).length};
  }

  async function change(user, action, body) {
    if (!['commit', 'setEnabled', 'remove'].includes(action)) throw new AppError('invalid-argument', 'Unknown exclusion action.');
    if (!Number.isSafeInteger(body.revision) || body.revision < 0) throw new AppError('invalid-argument', 'Reload the exclusion list before saving.');
    const actor = await actorOf(user);
    let entries = [];
    if (action === 'commit') {
      entries = invalid(() => canonicalEntries(body.entries));
      if (body.reviewId !== digest(actor.uid, body.revision, entries)) throw new AppError('failed-precondition', 'Preview these exclusions before saving.');
    } else if (!/^[a-f0-9]{32}$/.test(body.id || '') || (action === 'setEnabled' && typeof body.enabled !== 'boolean')) throw new AppError('invalid-argument', 'Invalid exclusion update.');
    const at = new Date().toISOString();
    const by = {uid: actor.uid, name: actor.name, email: actor.email};
    let changed = 0;
    await fs.transaction(async tx => {
      const config = readPolicy(await tx.get(CONFIG));
      if (config.revision !== body.revision) throw new AppError('already-exists', 'Another administrator changed the list. Reload and preview again.');
      const next = new Map(config.entries.map(r => [r.id, r])), affected = [];
      if (action === 'commit') {
        for (const entry of entries) if (!next.has(entry.id)) { next.set(entry.id, entry); affected.push(entry); }
      } else {
        const entry = next.get(body.id);
        if (!entry) throw new AppError('not-found', 'This exclusion no longer exists.');
        if (action === 'remove') { next.delete(body.id); affected.push(entry); } else if (entry.enabled !== body.enabled) { const updated = {...entry, enabled: body.enabled}; next.set(entry.id, updated); affected.push(updated); }
      }
      if (next.size > MAX_RULES) throw new AppError('resource-exhausted', `Keep at most ${MAX_RULES} exclusions.`);
      changed = affected.length;
      if (!changed) return;
      const revision = config.revision + 1;
      tx.merge(CONFIG, {dashboardExclusions: {revision, entries: [...next.values()], updatedAt: at, updatedBy: by}});
      tx.create(`${CONFIG}/exclusionAudit/${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`, {action, at, actor: by, revision, entries: affected});
    });
    return {...await list(), changed};
  }

  return {list, template, preview, change};
}

module.exports = {exclusionService, rule, policy, matches, parseWorkbook, resolvePerson};
