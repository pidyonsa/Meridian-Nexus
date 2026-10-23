'use strict';
// Which Nexus sections a user may open. Same section ids as the Firebase portal's NAVIGATION_OPTIONS, minus the
// features removed in October (Insights, Stock Fix, Salesforce, Display Compliance, Geo Rep blueprint).
const SECTIONS = ['home', 'attendance', 'callcycle', 'franchiseorder', 'sales', 'training', 'automation', 'etls', 'resources', 'chat', 'support', 'admin'];
const ADMIN_ONLY = new Set(['home', 'sales', 'etls', 'resources', 'admin']);
// Firebase defaults for a normal user: Report automation and Chat, plus Support always.
const DEFAULT_SECTIONS = ['automation', 'chat'];

// NEXUS_STAFF_SECTIONS (comma list) fixes what every non-admin sees, overriding their stored permissions.
// Set to "attendance,franchiseorder" on 23 Oct 2026: staff view Syndicated Attendance and Franchise Orders only,
// matching nexus.meridiangroup.co.za.
function sectionsFor(user, profile = {}, env = process.env) {
  if (user.admin) return [...SECTIONS];
  if (env.NEXUS_STAFF_SECTIONS) {
    const fixed = new Set(env.NEXUS_STAFF_SECTIONS.split(',').map(s => s.trim()));
    return SECTIONS.filter(id => fixed.has(id) && !ADMIN_ONLY.has(id));
  }
  const allowed = new Set(Array.isArray(profile.allowedNavigationIds) ? profile.allowedNavigationIds : DEFAULT_SECTIONS);
  // Call Cycle was always granted by the attendance permission.
  if (allowed.has('attendance')) allowed.add('callcycle');
  if (profile.chatEnabled === false) allowed.delete('chat');
  allowed.add('support');
  return SECTIONS.filter(id => allowed.has(id) && !ADMIN_ONLY.has(id));
}

module.exports = {SECTIONS, ADMIN_ONLY, DEFAULT_SECTIONS, sectionsFor};
