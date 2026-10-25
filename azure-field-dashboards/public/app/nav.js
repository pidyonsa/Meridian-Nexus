// Nexus modules and their tools: one definition drives the sidebar, home page, module pages, search and routing.
// Modules, wording, statuses and tool cards mirror the Firebase-era Nexus workspace (meridain-nexus.web.app/portal.html,
// read 25 October 2026); only tools with an Azure version are swapped in (Time and Attendance, Franchise orders, Gap
// tracker), StockFix uses its new address, and everything else still opens the existing Nexus. A tool's `section`
// must match server/access.cjs; the server decides which sections each person may open.

import {CONFIG} from './config.js';

// Where tools that have not moved yet still run, and which tools work on this site (see config.js).
export const OLD_NEXUS = CONFIG.currentNexus;
export const BUILT = new Set(CONFIG.built);
const PAGE_TOOLS = new Set(CONFIG.pageTools);
const STOCKFIX = 'https://stock-fix.replit.app/adoption/';

// Module fields: status (as the old portal shows it: available | dev | adminOnly), dot (sidebar dot colour),
// badgeTone (Admin only pill colour), cardBlurb (description on the home card), home (tool opened directly).
// Tool fields: dev (under development, no link), restricted (admin only, no link), external, old (#route in the
// existing Nexus), pages (sub-pages for search).
export const MODULES = [
  {id: 'activate', label: 'Activate', icon: 'bolt', tone: 'orange', status: 'dev', blurb: 'Trade activation and promotional campaign management.'},
  {id: 'call-cycle', label: 'Call Cycle Management', short: 'Call Cycle', icon: 'cycle', tone: 'green', status: 'available', dot: 'green', blurb: 'Call-cycle control centre — schedule build, conflict resolution and coverage.', tools: [
    {id: 'control-centre', label: 'Control Centre', desc: 'Upload data, build the call cycle, resolve store conflicts and review exceptions.', section: 'admin', restricted: true}
  ]},
  {id: 'capture', label: 'Capture', icon: 'camera', tone: 'blue', status: 'dev', blurb: 'Photo validation and compliance tracking on every visit.'},
  {id: 'connect', label: 'Connect', icon: 'signal', tone: 'violet', status: 'dev', blurb: 'Mobile-driven field comms and campaign execution.', tools: [
    {id: 'newsletter', label: 'Newsletter', desc: 'Company and client newsletters, sent and tracked from one place.', dev: true},
    {id: 'jem', label: 'Jem', desc: 'Internal admin tool.', section: 'admin', restricted: true}
  ]},
  {id: 'geo', label: 'Geo', icon: 'pin', tone: 'violet', status: 'available', dot: 'green', blurb: 'Geo-verified store coverage and route tracking on a live map.', tools: [
    {id: 'attendance', label: 'Time and Attendance', navLabel: 'Time & Attendance', desc: 'Syndicated attendance for reps and merchandisers: daily visits, month-to-date coverage, rosters and stores.', section: 'attendance', path: '/attendance/rep/overview', old: '#attendance', pages: [
      {label: 'Reps · MTD overview', path: '/attendance/rep/overview'}, {label: 'Reps · Daily visits', path: '/attendance/rep/daily'}, {label: 'Reps · Roster', path: '/attendance/rep/users'}, {label: 'Reps · Stores', path: '/attendance/rep/stores'},
      {label: 'Merchandisers · MTD overview', path: '/attendance/merchandiser/overview'}, {label: 'Merchandisers · Daily visits', path: '/attendance/merchandiser/daily'}, {label: 'Merchandisers · Roster', path: '/attendance/merchandiser/users'}, {label: 'Merchandisers · Stores', path: '/attendance/merchandiser/stores'}]},
    {id: 'franchiseorder', label: 'Franchise orders', desc: 'Franchise order value, trends, regions, products, stores and reps.', section: 'franchiseorder', path: '/franchise-orders/overview', old: '#franchiseorder', pages: [
      {label: 'Executive overview', path: '/franchise-orders/overview'}, {label: 'Trend analysis', path: '/franchise-orders/trend'}, {label: 'Regional', path: '/franchise-orders/regions'}, {label: 'Products', path: '/franchise-orders/products'},
      {label: 'Stores', path: '/franchise-orders/stores'}, {label: 'Reps', path: '/franchise-orders/reps'}, {label: 'Order detail', path: '/franchise-orders/orders'}]},
    {id: 'geo-portal', label: 'Open Geo Portal', desc: 'Sign in to the Geo portal for live coverage, routes and check-ins.', external: 'https://meridian.georep.com/portal/login'}
  ]},
  {id: 'insights', label: 'Insights', icon: 'chart', tone: 'green', status: 'dev', blurb: 'Live dashboards and reporting across execution.', tools: [
    {id: 'insights-sales', label: 'Sales', desc: 'Sales performance, trends and targets by client, banner and store.', dev: true},
    {id: 'insights-inventory', label: 'Inventory', desc: 'Stock on hand, coverage and out-of-stock trends over time.', dev: true}
  ]},
  // Azure-only module: opens the dashboard directly; its clients are listed in the side menu.
  {id: 'gap-tracker', label: 'Gap tracker', icon: 'target', tone: 'orange', home: 'gaps', blurb: 'Client distribution gaps by banner, store and product: what converted, what was won back and what dropped out.', tools: [
    {id: 'gaps', label: 'Distribution gaps', desc: 'Weekly No gap, Opportunity and Lost by store and product for every client, and what converted.', section: 'gaps', path: '/gap-tracker', prefix: true}
  ]},
  {id: 'learn', label: 'Learn', icon: 'cap', tone: 'violet', status: 'available', dot: 'green', blurb: 'Mobile-first training, guided journeys and quizzes for every team.', tools: [
    {id: 'learning', label: 'Learning', desc: 'Track recent courses loaded on Geo, leaderboards and courses completed.', dev: true},
    {id: 'training-academy', label: 'Meridian Training Academy', desc: 'Courses, guided journeys and quizzes for field and office teams.', external: 'https://training.meridiangroup.co.za/app/learn/landing', action: 'Open'}
  ]},
  // StockFix is its own app (own sign-in); Nexus links to it (user decision, 24 October 2026).
  {id: 'stockfix', label: 'StockFix', icon: 'box', tone: 'orange', status: 'available', dot: 'orange', home: 'stockfix-live', blurb: 'Out-of-stock detection, listing gaps and replenishment across all clients.', tools: [
    {id: 'stockfix-live', label: 'Live Dashboard', desc: 'Out-of-stock trends, listing gaps and coverage by client, banner and store.', external: STOCKFIX, action: 'Open dashboard'},
    {id: 'stockfix-data-admin', label: 'Data Admin', desc: 'Run the weekly scripts and refresh StockFix data.', section: 'admin', restricted: true}
  ]},
  {id: 'sales', label: 'Sales dashboard', icon: 'bars', tone: 'blue', status: 'adminOnly', badgeTone: 'blue', dot: 'blue', cardBlurb: true, home: 'sales', blurb: 'Review current-month Geo Rep orders by region, rep, store and product.', tools: [
    {id: 'sales', label: 'Sales dashboard', desc: 'Month-to-date Geo Rep orders with drilldowns and reconciliation.', section: 'sales', path: '/sales', old: '#sales'}
  ]},
  {id: 'automation', label: 'Report automation', icon: 'bolt', tone: 'green', status: 'available', dot: 'green', cardBlurb: true, home: 'automation', blurb: 'Run, schedule and deliver verified report extractions.', tools: [
    {id: 'automation', label: 'Report automation', desc: 'Run and schedule portal reports, answer verification prompts and review deliveries.', section: 'automation', path: '/automation', old: '#automation'},
    {id: 'etls', label: 'ETLs', desc: 'Retailer data pipelines: upload inputs, review, approve and download outputs.', section: 'etls', path: '/etls', old: '#etls'}
  ]},
  {id: 'admin', label: 'Admin', icon: 'bank', tone: 'orange', status: 'adminOnly', badgeTone: 'orange', dot: 'orange', cardBlurb: true, blurb: 'Manage extraction profile connections, extraction steps and secure access.', tools: [
    {id: 'admin-overview', label: 'Migration health', desc: 'Firestore to Azure sync status and recent runs.', section: 'admin', path: '/admin'},
    {id: 'admin-users', label: 'Users', desc: 'Who can open what in Nexus.', section: 'admin', path: '/admin/users'},
    {id: 'gap-upload', label: 'Upload gap report', desc: "Upload a client's weekly gap workbook (or add a new client), check it, then save.", section: 'gaps-upload', path: '/admin/gap-upload'},
    {id: 'admin-workspace', label: 'Admin workspace', desc: 'Extraction profiles, schedules, jobs, users and integrations in the existing Nexus.', section: 'admin', path: '/admin/workspace', old: '#admin'},
    {id: 'resources', label: 'Resources', desc: 'Shared reference files and templates.', section: 'resources', path: '/resources', old: '#resources'}
  ]}
];

// What a tool means for this user: available here, still on the existing Nexus, under development, locked,
// restricted (admin only, no link) or an outside link.
export function toolState(tool, sections) {
  if (tool.dev) return 'dev';
  if (tool.external) return 'link';
  if (!sections.has(tool.section)) return 'locked';
  if (tool.restricted) return 'restricted';
  return BUILT.has(tool.id) ? 'available' : 'moving';
}

// Module badge: as the old portal shows it, or worked out from the tools for Azure-only modules.
export function moduleState(module, sections) {
  if (module.status) return module.status;
  const states = (module.tools || []).map(t => toolState(t, sections));
  if (states.includes('available') || states.includes('link')) return 'available';
  if (states.includes('moving')) return 'moving';
  return states.length ? 'locked' : 'dev';
}

// Where a tool (or one of its pages) opens: inside the workspace (spa), as its own page on this site, or in the
// existing Nexus. `newTab` only for other sites.
export function toolLink(tool, page = null) {
  if (tool.external) return {href: tool.external, newTab: true};
  if (BUILT.has(tool.id)) return PAGE_TOOLS.has(tool.id) ? {href: page?.path || tool.path} : {href: page?.path || tool.path, spa: true};
  if (CONFIG.directLinks) return {href: `${OLD_NEXUS}${tool.old || ''}`};
  return {href: page?.path || tool.path, spa: true};
}

// Where a module opens: straight into its home tool when the person may use it (an outside app in a new tab, a tool
// still on the existing Nexus there), otherwise its module page.
export function moduleLink(module, sections) {
  const tool = module.home && module.tools.find(t => t.id === module.home);
  const state = tool ? toolState(tool, sections) : null;
  if (state === 'link') return {href: tool.external, newTab: true};
  if (state === 'available' || (state === 'moving' && CONFIG.directLinks)) return toolLink(tool);
  return {href: `/modules/${module.id}`, spa: true};
}

// <a> attributes for a link: workspace route, full page on this site, or a new tab for other sites.
export function anchorAttrs(link) {
  return link.spa ? {href: link.href, 'data-link': true} : link.newTab ? {href: link.href, target: '_blank', rel: 'noopener'} : {href: link.href};
}

// The module and tool that own a path (module pages are /modules/<id>).
export function locate(path) {
  if (path === '/') return {home: true};
  const m = path.match(/^\/modules\/([a-z-]+)$/);
  if (m) { const module = MODULES.find(x => x.id === m[1]); return module ? {module} : null; }
  for (const module of MODULES) for (const tool of module.tools || []) {
    if (!tool.path) continue;
    const page = tool.pages?.find(p => p.path === path);
    const base = tool.path.split('/').slice(0, 2).join('/');
    if (page || path === tool.path || (tool.pages && path.startsWith(`${base}/`)) || (tool.prefix && path.startsWith(`${tool.path}/`))) return {module, tool, page: page || null};
  }
  return null;
}
