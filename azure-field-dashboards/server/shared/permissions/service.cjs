'use strict';
// Effective access and permission management. Rules:
//  - Entra role Nexus.Admin: administrator, always (cannot be changed or blocked in Nexus).
//  - Administrator switched on in Nexus: administrator. Only administrators manage permissions.
//  - Blocked in Nexus: nothing (unless Nexus.Admin in Entra).
//  - Everyone else: the default dashboards, plus what was granted, plus gap uploads for the Entra role Nexus.GapUploader.
// Lookups are cached for 30 seconds per person and dropped when their permissions change; if the database cannot be
// reached, people keep the defaults and their Entra roles only (fail closed for anything granted in Nexus).
const {AppError} = require('../errors.cjs');
const {SECTIONS, DEFAULT, GRANTABLE, ALL} = require('./catalogue.cjs');

const TTL_MS = 30 * 1000;
const EMAIL = /^[^\s@<>()",;]{1,160}@[A-Za-z0-9.-]{1,150}\.[A-Za-z]{2,24}$/;

function permissionService({store, log = console}) {
  const cache = new Map();

  async function stored(email) {
    const hit = cache.get(email);
    if (hit && hit.expires > Date.now()) return hit.value;
    let value = null;
    try { value = await store.get(email); } catch (error) { log.error?.(JSON.stringify({event: 'permissions-lookup-failed', error: String(error.message).slice(0, 300)})); return null; }
    cache.set(email, {value, expires: Date.now() + TTL_MS});
    return value;
  }

  // user: {email, entraAdmin, gapUploader}
  async function effective(user) {
    const email = String(user.email || '').toLowerCase();
    if (user.entraAdmin) return {admin: true, entraAdmin: true, disabled: false, sections: [...ALL]};
    const p = await stored(email);
    if (p?.disabled) return {admin: false, entraAdmin: false, disabled: true, sections: []};
    if (p?.admin) return {admin: true, entraAdmin: false, disabled: false, sections: [...ALL]};
    const sections = new Set([...DEFAULT, ...(p?.sections || []).filter(s => GRANTABLE.has(s)), ...(user.gapUploader ? ['gaps-upload'] : [])]);
    return {admin: false, entraAdmin: false, disabled: false, sections: ALL.filter(s => sections.has(s))};
  }

  async function people() {
    const [rows, signIns, directory] = await Promise.all([store.list(), store.signIns(), store.directory().catch(() => [])]);
    const byEmail = new Map();
    const at = email => { if (!byEmail.has(email)) byEmail.set(email, {email, name: null, entraAdmin: false, lastSeenAt: null, inDirectory: false, permissions: null}); return byEmail.get(email); };
    for (const d of directory) { const p = at(d.email); p.name ||= d.name; p.inDirectory = true; }
    for (const s of signIns) { const p = at(s.email); p.name = s.name || p.name; p.entraAdmin = s.entraAdmin; p.lastSeenAt = s.lastSeenAt; }
    for (const r of rows) { const p = at(r.email); p.name = p.name || r.name; p.permissions = r; }
    return {
      catalogue: SECTIONS, defaults: DEFAULT,
      people: [...byEmail.values()].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email)),
      history: await store.history().catch(() => [])
    };
  }

  async function save(actor, email, body) {
    const target = String(email || '').trim().toLowerCase();
    if (!EMAIL.test(target)) throw new AppError('invalid-argument', 'Enter the person\'s Microsoft sign-in email.');
    if (!Array.isArray(body.sections) || body.sections.some(s => typeof s !== 'string')) throw new AppError('invalid-argument', 'Choose the sections as a list.');
    const unknown = body.sections.filter(s => !GRANTABLE.has(s) && !DEFAULT.includes(s));
    if (unknown.length) throw new AppError('invalid-argument', `Unknown permission: ${unknown.join(', ')}.`);
    const admin = body.admin === true, disabled = body.disabled === true;
    if (target === actor.email.toLowerCase() && (!admin || disabled) && !actor.entraAdmin) throw new AppError('failed-precondition', 'You cannot remove your own administrator access. Ask another administrator.');
    const before = await store.get(target);
    const value = {email: target, name: typeof body.name === 'string' ? body.name.trim().slice(0, 200) || null : null, admin, disabled, sections: [...new Set(body.sections.filter(s => GRANTABLE.has(s)))].sort(),
      note: typeof body.note === 'string' ? body.note.trim().slice(0, 300) || null : null};
    await store.save(value, actor.email, {action: before ? 'permissions-updated' : 'permissions-granted', detail: {before: before && {admin: before.admin, disabled: before.disabled, sections: before.sections}, after: {admin, disabled, sections: value.sections}}});
    cache.delete(target);
    return {person: {...value}};
  }

  async function remove(actor, email) {
    const target = String(email || '').trim().toLowerCase();
    if (target === actor.email.toLowerCase() && !actor.entraAdmin) throw new AppError('failed-precondition', 'You cannot remove your own administrator access. Ask another administrator.');
    const before = await store.get(target);
    if (!before) throw new AppError('not-found', 'This person has no permissions set in Nexus.');
    await store.remove(target, actor.email, {detail: {before: {admin: before.admin, disabled: before.disabled, sections: before.sections}}});
    cache.delete(target);
    return {email: target};
  }

  return {effective, people, save, remove};
}

module.exports = {permissionService};
