'use strict';
// What can be granted in Admin › Users, and which pages and APIs each permission opens on nexus.meridiangroup.co.za.
// Everyone signed in with a Meridian account opens the DEFAULT sections; Nexus administrators open everything,
// including managing permissions ('users'), which cannot be granted on its own.
const SECTIONS = [
  {id: 'attendance', label: 'Syndicated Attendance', group: 'Dashboards', everyone: true},
  {id: 'franchiseorder', label: 'Franchise Orders', group: 'Dashboards', everyone: true},
  {id: 'gaps', label: 'Gap tracker', group: 'Dashboards', everyone: true},
  {id: 'gaps-upload', label: 'Upload gap reports', group: 'Gap tracker', hint: 'Upload client gap workbooks and add clients'},
  {id: 'sales', label: 'Sales dashboard', group: 'Tools', hint: 'Geo Rep orders by month'},
  {id: 'automation', label: 'Report automation', group: 'Tools', hint: 'Run, schedule and control report jobs; answer portal verification'},
  {id: 'etls', label: 'ETLs', group: 'Tools', hint: 'Run, review and approve retailer ETLs'},
  {id: 'resources', label: 'Resources', group: 'Admin tools', hint: 'Shared masters, templates and reference files'},
  {id: 'profiles', label: 'Extraction profiles', group: 'Admin tools', hint: 'Portals, logins and step sets'},
  {id: 'geo-attendance', label: 'Geo attendance', group: 'Admin tools', hint: 'Tracker, operational week, store master, exclusions'},
  {id: 'integrations', label: 'SharePoint inventory', group: 'Admin tools', hint: 'Catalogue of the Meridian Nexus SharePoint site'},
  {id: 'admin', label: 'Migration health', group: 'Admin tools', hint: 'Firebase to Azure sync status'}
];
const DEFAULT = SECTIONS.filter(s => s.everyone).map(s => s.id);
const GRANTABLE = new Set(SECTIONS.filter(s => !s.everyone).map(s => s.id));
// Section ids the workspace knows (nav.js), admins get all of them.
const ALL = [...SECTIONS.map(s => s.id), 'users'];

// Page and API paths per section (methods are not split: a section opens its whole tool).
const ROUTES = [
  ['gaps-upload', /^\/(?:admin\/gap-upload\/?|api\/gaps\/(?:clients|[a-z0-9-]{2,60}\/(?:uploads|preview|upload)))$/],
  ['sales', /^\/(?:sales\/?|api\/sales(?:\/.*)?)$/],
  ['automation', /^\/(?:automation\/?|api\/automation(?:\/.*)?)$/],
  ['etls', /^\/(?:etls\/?|api\/etls(?:\/.*)?)$/],
  ['resources', /^\/(?:resources\/?|api\/resources(?:\/.*)?)$/],
  ['profiles', /^\/(?:admin\/profiles\/?|api\/profiles(?:\/.*)?)$/],
  ['geo-attendance', /^\/(?:admin\/geo-attendance\/?|api\/geo-attendance(?:\/.*)?)$/],
  ['integrations', /^\/(?:admin\/integrations\/?|api\/integrations(?:\/.*)?)$/],
  ['admin', /^\/(?:admin\/?|api\/admin\/sync)$/],
  ['users', /^\/(?:admin\/users\/?|api\/permissions(?:\/.*)?)$/]
];
const sectionOf = path => ROUTES.find(([, re]) => re.test(path))?.[0] || null;

module.exports = {SECTIONS, DEFAULT, GRANTABLE, ALL, ROUTES, sectionOf};
