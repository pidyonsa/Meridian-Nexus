'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {permissionService} = require('../server/permissions/service.cjs');
const {memoryPermissionStore} = require('../server/permissions/store.cjs');
const {sectionOf, DEFAULT} = require('../server/permissions/catalogue.cjs');

const quiet = {error() {}};
const admin = {email: 'jpinto@meridiangroup.co.za', entraAdmin: true};

test('every tool page and API belongs to one section; dashboards and the workspace to none', () => {
  assert.equal(sectionOf('/automation'), 'automation'); assert.equal(sectionOf('/api/automation/runs/abc/abort'), 'automation');
  assert.equal(sectionOf('/admin/gap-upload'), 'gaps-upload'); assert.equal(sectionOf('/api/gaps/sir-fruit/upload'), 'gaps-upload'); assert.equal(sectionOf('/api/gaps/clients'), 'gaps-upload');
  assert.equal(sectionOf('/api/gaps/sir-fruit/detail'), null, 'viewing the gap tracker is for everyone');
  assert.equal(sectionOf('/admin/users'), 'users'); assert.equal(sectionOf('/api/permissions/x@y.co'), 'users'); assert.equal(sectionOf('/admin'), 'admin');
  assert.equal(sectionOf('/api/integrations/scan'), 'integrations'); assert.equal(sectionOf('/api/geo-attendance/week'), 'geo-attendance');
  assert.equal(sectionOf('/'), null); assert.equal(sectionOf('/attendance/rep/overview'), null);
});

test('effective access: defaults, grants, Entra roles, Nexus administrators and blocking', async () => {
  const store = memoryPermissionStore({permissions: [
    {email: 'snaidoo@meridiangroup.co.za', sections: ['gaps-upload', 'not-a-section']},
    {email: 'boss@meridiangroup.co.za', admin: true},
    {email: 'gone@meridiangroup.co.za', disabled: true, admin: true}
  ]});
  const s = permissionService({store, log: quiet});
  assert.deepEqual((await s.effective({email: 'new@meridiangroup.co.za'})).sections, DEFAULT);
  assert.deepEqual((await s.effective({email: 'SNAIDOO@meridiangroup.co.za'})).sections, [...DEFAULT, 'gaps-upload'], 'emails are case-insensitive; unknown sections ignored');
  assert.deepEqual((await s.effective({email: 'x@meridiangroup.co.za', gapUploader: true})).sections, [...DEFAULT, 'gaps-upload'], 'the Entra uploader role still works');
  const boss = await s.effective({email: 'boss@meridiangroup.co.za'});
  assert.equal(boss.admin, true); assert.ok(boss.sections.includes('users'));
  const gone = await s.effective({email: 'gone@meridiangroup.co.za'});
  assert.equal(gone.disabled, true); assert.equal(gone.admin, false); assert.deepEqual(gone.sections, []);
  assert.equal((await s.effective({email: 'gone@meridiangroup.co.za', entraAdmin: true})).admin, true, 'Entra administrators cannot be blocked in Nexus');
});

test('saving: validated, audited, takes effect at once; administrators cannot lock themselves out', async () => {
  const store = memoryPermissionStore({signIns: [{email: 'snaidoo@meridiangroup.co.za', name: 'Shonesa Naidoo', entraAdmin: false, lastSeenAt: '2026-10-27T08:00:00Z'}], directory: [{email: 'tthring@meridiangroup.co.za', name: 'T Thring'}]});
  const s = permissionService({store, log: quiet});
  assert.deepEqual((await s.effective({email: 'snaidoo@meridiangroup.co.za'})).sections, DEFAULT);
  await assert.rejects(s.save(admin, 'not an email', {sections: []}), /sign-in email/);
  await assert.rejects(s.save(admin, 'snaidoo@meridiangroup.co.za', {sections: ['root']}), /Unknown permission: root/);
  await s.save(admin, 'Snaidoo@MeridianGroup.co.za', {sections: ['gaps-upload'], note: 'Sir Fruit uploads'});
  assert.ok((await s.effective({email: 'snaidoo@meridiangroup.co.za'})).sections.includes('gaps-upload'), 'no waiting for the cache');
  const portalAdmin = {email: 'boss@meridiangroup.co.za', entraAdmin: false};
  await s.save(admin, portalAdmin.email, {admin: true, sections: []});
  await assert.rejects(s.save(portalAdmin, portalAdmin.email, {admin: false, sections: []}), /your own administrator access/);
  await assert.rejects(s.remove(portalAdmin, portalAdmin.email), /your own administrator access/);
  const view = await s.people();
  assert.deepEqual(view.people.map(p => p.email), ['boss@meridiangroup.co.za', 'snaidoo@meridiangroup.co.za', 'tthring@meridiangroup.co.za']);
  assert.equal(view.people.find(p => p.email === 'snaidoo@meridiangroup.co.za').permissions.note, 'Sir Fruit uploads');
  assert.equal(view.history[0].email, 'boss@meridiangroup.co.za'); assert.equal(view.history[1].action, 'permissions-granted');
  await s.remove(admin, 'snaidoo@meridiangroup.co.za');
  assert.deepEqual((await s.effective({email: 'snaidoo@meridiangroup.co.za'})).sections, DEFAULT);
});

test('when the database cannot be read, people keep the defaults only', async () => {
  const s = permissionService({store: {get: async () => { throw new Error('SQL down'); }}, log: quiet});
  const access = await s.effective({email: 'boss@meridiangroup.co.za'});
  assert.equal(access.admin, false); assert.deepEqual(access.sections, DEFAULT);
});
