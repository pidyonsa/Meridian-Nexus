'use strict';
const crypto = require('node:crypto');
const clean = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
const key = value => clean(value).toUpperCase();
const MAX_RULES = 1000;
function text(value, label, max, required = false) {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f]/.test(value) || (required && !clean(value))) throw Error(`Invalid ${label}.`);
  return clean(value);
}
function rule(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid exclusion.');
  const name = text(value.name, 'name', 160, true), userCode = text(value.userCode, 'staff code', 80);
  const type = value.type || 'person', audience = value.audience || 'both';
  if (!['person', 'manager'].includes(type) || !['rep', 'merchandiser', 'both'].includes(audience)) throw Error('Invalid exclusion type or audience.');
  if (type === 'manager' && userCode) throw Error('Manager/team exclusions use the manager name, not a staff code.');
  const reason = text(value.reason, 'reason', 300);
  if (value.enabled !== undefined && typeof value.enabled !== 'boolean') throw Error('Invalid enabled flag.');
  const id = crypto.createHash('sha256').update(JSON.stringify([type, audience, userCode ? 'code' : 'name', key(userCode || name)])).digest('hex').slice(0, 32);
  return {id, type, audience, name, userCode, reason, enabled:value.enabled !== false};
}
function policy(value) {
  if (value == null) return {revision:0, entries:[]};
  if (!Number.isSafeInteger(value.revision) || value.revision < 0 || !Array.isArray(value.entries) || value.entries.length > MAX_RULES) throw Error('Invalid attendance exclusion settings.');
  const entries = value.entries.map(rule);
  if (new Set(entries.map(r => r.id)).size !== entries.length) throw Error('Duplicate attendance exclusion settings.');
  return {revision:value.revision, entries};
}
function matches(person, entry, audience) {
  if (!entry.enabled || (entry.audience !== 'both' && entry.audience !== audience)) return false;
  if (entry.type === 'person') return entry.userCode ? key(person.userCode) === key(entry.userCode) : key(person.userName) === key(entry.name);
  return [person.userName, person.rep, ...(person.managerPath || [person.manager])].some(name => name && key(name) === key(entry.name));
}
const excluded = (person, entries, audience) => entries.some(entry => matches(person, entry, audience));
function matcher(entries, audience) {
  const names = new Set(), codes = new Set(), managers = new Set();
  for (const entry of entries) {
    if (!entry.enabled || (entry.audience !== 'both' && entry.audience !== audience)) continue;
    if (entry.type === 'manager') managers.add(key(entry.name));
    else if (entry.userCode) codes.add(key(entry.userCode));
    else names.add(key(entry.name));
  }
  return person => names.has(key(person.userName)) || codes.has(key(person.userCode)) ||
    (managers.size > 0 && [person.userName, person.rep, ...(person.managerPath || [person.manager])].some(name => name && managers.has(key(name))));
}
function revisionVersion(version, config) {
  return crypto.createHash('sha256').update(JSON.stringify([version, 'attendance-exclusions-v1', config.revision, config.entries])).digest('hex');
}
module.exports = {clean, key, rule, policy, matches, excluded, matcher, revisionVersion, MAX_RULES};
