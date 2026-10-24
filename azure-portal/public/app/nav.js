// Nexus modules and their tools: one definition drives the sidebar, home page, module pages, search and routing.
// Order, names and wording follow the Firebase-era Nexus workspace (meridain-nexus.web.app). A tool's `section` must
// match server/access.cjs; the server decides which sections each person may open.

import {CONFIG} from './config.js';

// Where tools that have not moved yet still run, and which tools work on this site (see config.js).
export const OLD_NEXUS = CONFIG.currentNexus;
export const BUILT = new Set(CONFIG.built);
const PAGE_TOOLS = new Set(CONFIG.pageTools);

export const MODULES = [
  {id: 'activate', label: 'Activate', icon: 'bolt', tone: 'orange', dev: true, blurb: 'Activation campaigns and in-store execution.'},
  {id: 'call-cycle', label: 'Call Cycle Management', short: 'Call Cycle', icon: 'cycle', tone: 'green', blurb: 'Call-cycle control centre — schedule build, conflict resolution and coverage.', tools: [
    {id: 'callcycle', label: 'Syndicated call cycle', desc: 'Planned versus visited stores by division, rep and store.', section: 'callcycle', path: '/call-cycle/overview', old: '#callcycle', pages: [
      {label: 'Overview', path: '/call-cycle/overview'}, {label: 'Divisional coverage', path: '/call-cycle/divisions'}, {label: 'Reps', path: '/call-cycle/reps'}, {label: 'Stores', path: '/call-cycle/stores'}]},
    {id: 'control-centre', label: 'Control Centre', desc: 'Upload data, build the call cycle, resolve store conflicts and review exceptions.', section: 'admin', restricted: true}
  ]},
  {id: 'capture', label: 'Capture', icon: 'camera', tone: 'blue', dev: true, blurb: 'In-store photo and form capture.'},
  {id: 'connect', label: 'Connect', icon: 'signal', tone: 'violet', blurb: 'Team conversations, tasks and support.', tools: [
    {id: 'chat', label: 'Meridian Chat', desc: 'Direct and group conversations, tasks and announcements.', section: 'chat', path: '/chat', old: '#chat'},
    {id: 'support', label: 'Support', desc: 'Raise and follow up support requests for Nexus.', section: 'support', path: '/support', old: '#support'}
  ]},
  {id: 'geo', label: 'Geo', icon: 'pin', tone: 'violet', blurb: 'Geo-verified store coverage and route tracking on a live map.', tools: [
    {id: 'attendance', label: 'Time and Attendance', navLabel: 'Time & Attendance', desc: 'Syndicated attendance for reps and merchandisers: daily visits, month-to-date coverage, rosters and stores.', section: 'attendance', path: '/attendance/rep/overview', old: '#attendance', pages: [
      {label: 'Reps · MTD overview', path: '/attendance/rep/overview'}, {label: 'Reps · Daily visits', path: '/attendance/rep/daily'}, {label: 'Reps · Roster', path: '/attendance/rep/users'}, {label: 'Reps · Stores', path: '/attendance/rep/stores'},
      {label: 'Merchandisers · MTD overview', path: '/attendance/merchandiser/overview'}, {label: 'Merchandisers · Daily visits', path: '/attendance/merchandiser/daily'}, {label: 'Merchandisers · Roster', path: '/attendance/merchandiser/users'}, {label: 'Merchandisers · Stores', path: '/attendance/merchandiser/stores'}]},
    {id: 'franchiseorder', label: 'Franchise orders', desc: 'Franchise order value, trends, regions, products, stores and reps.', section: 'franchiseorder', path: '/franchise-orders/overview', old: '#franchiseorder', pages: [
      {label: 'Executive overview', path: '/franchise-orders/overview'}, {label: 'Trend analysis', path: '/franchise-orders/trend'}, {label: 'Regional', path: '/franchise-orders/regions'}, {label: 'Products', path: '/franchise-orders/products'},
      {label: 'Stores', path: '/franchise-orders/stores'}, {label: 'Reps', path: '/franchise-orders/reps'}, {label: 'Order detail', path: '/franchise-orders/orders'}]},
    {id: 'geo-portal', label: 'Open Geo Portal', desc: 'Sign in to the Geo portal for live coverage, routes and check-ins.', external: 'https://meridian.georep.com/portal/'}
  ]},
  {id: 'insights', label: 'Insights', icon: 'chart', tone: 'green', dev: true, blurb: 'Sales intelligence across clients, regions and products.'},
  // `home`: the module opens this tool directly (no module page). Its clients are listed in the side menu.
  {id: 'gap-tracker', label: 'Gap tracker', icon: 'target', tone: 'orange', home: 'gaps', blurb: 'Client distribution gaps by banner, store and product: what converted, what was won back and what dropped out.', tools: [
    {id: 'gaps', label: 'Distribution gaps', desc: 'Weekly No gap, Opportunity and Lost by store and product for every client, and what converted.', section: 'gaps', path: '/gap-tracker', prefix: true}
  ]},
  {id: 'learn', label: 'Learn', icon: 'cap', tone: 'violet', blurb: 'Learning completion and pass rates for the field team.', tools: [
    {id: 'training', label: 'Training hub', desc: 'LMS completion and pass rates by module, region and manager.', section: 'training', path: '/training', old: '#training'}
  ]},
  // StockFix is its own app (own sign-in); Nexus links to it (user decision, 24 October 2026).
  {id: 'stockfix', label: 'StockFix', icon: 'box', tone: 'orange', home: 'stockfix-app', blurb: 'Out-of-stock fixes, adoption and field tasks.', tools: [
    {id: 'stockfix-app', label: 'StockFix', desc: 'Adoption, out-of-stock fixes and field tasks in the StockFix app.', external: 'https://stock-fix.replit.app/adoption/', action: 'Open StockFix'}
  ]},
  {id: 'sales', label: 'Sales dashboard', icon: 'bars', tone: 'blue', blurb: 'Review current-month Geo Rep orders by region, rep, store and product.', tools: [
    {id: 'sales', label: 'Sales dashboard', desc: 'Month-to-date Geo Rep orders with drilldowns and reconciliation.', section: 'sales', path: '/sales', old: '#sales'}
  ]},
  {id: 'automation', label: 'Report automation', icon: 'bolt', tone: 'green', blurb: 'Run, schedule and deliver verified report extractions.', tools: [
    {id: 'automation', label: 'Report automation', desc: 'Run and schedule portal reports, answer verification prompts and review deliveries.', section: 'automation', path: '/automation', old: '#automation'},
    {id: 'etls', label: 'ETLs', desc: 'Retailer data pipelines: upload inputs, review, approve and download outputs.', section: 'etls', path: '/etls', old: '#etls'}
  ]},
  {id: 'admin', label: 'Admin', icon: 'bank', tone: 'orange', blurb: 'Manage extraction profile connections, extraction steps and secure access.', tools: [
    {id: 'admin-overview', label: 'Migration health', desc: 'Firestore to Azure sync status and recent runs.', section: 'admin', path: '/admin'},
    {id: 'admin-users', label: 'Users', desc: 'Who can open what in Nexus.', section: 'admin', path: '/admin/users'},
    {id: 'gap-upload', label: 'Upload gap report', desc: "Upload a client's weekly gap workbook (or add a new client), check it, then save.", section: 'gaps-upload', path: '/admin/gap-upload'},
    {id: 'admin-jobs', label: 'Jobs and schedules', desc: 'Live and historical extraction runs, schedules and reliability alerts.', section: 'admin', path: '/admin/jobs', old: '#admin'},
    {id: 'admin-profiles', label: 'Extraction profiles', desc: 'Portal connections, credentials and workflow steps.', section: 'admin', path: '/admin/profiles', old: '#admin'},
    {id: 'resources', label: 'Resources', desc: 'Shared reference files and templates.', section: 'resources', path: '/resources', old: '#resources'}
  ]}
];

// Where a module opens: straight into its home tool when it has one (an outside app opens in a new tab), otherwise
// its module page. Returns a link like toolLink().
export function moduleLink(module, sections) {
  const tool = module.home && module.tools.find(t => t.id === module.home);
  if (tool?.external) return {href: tool.external, newTab: true};
  return tool && toolState(tool, sections) === 'available' ? {href: tool.path, spa: true} : {href: `/modules/${module.id}`, spa: true};
}

// <a> attributes for a link: workspace route, full page on this site, or a new tab for other sites.
export function anchorAttrs(link) {
  return link.spa ? {href: link.href, 'data-link': true} : link.newTab ? {href: link.href, target: '_blank', rel: 'noopener'} : {href: link.href};
}

// Where a tool (or one of its pages) opens: inside the workspace (spa), as its own page on this site, or on the
// current Nexus. `newTab` only for other sites.
export function toolLink(tool, page = null) {
  if (tool.external) return {href: tool.external, newTab: true};
  if (BUILT.has(tool.id)) return PAGE_TOOLS.has(tool.id) ? {href: page?.path || tool.path} : {href: page?.path || tool.path, spa: true};
  if (CONFIG.directLinks) return {href: `${OLD_NEXUS}${tool.old || ''}`};
  return {href: page?.path || tool.path, spa: true};
}

// What a tool means for this user: available here, still on the current Nexus, locked, restricted or an outside link.
export function toolState(tool, sections) {
  if (tool.external) return 'link';
  if (!sections.has(tool.section)) return 'locked';
  if (tool.restricted) return 'restricted';
  return BUILT.has(tool.id) ? 'available' : 'moving';
}

// Module badge: In development / Available / Moving to Azure / Admin only, from the user's tools.
export function moduleState(module, sections) {
  if (module.dev) return 'dev';
  if (module.separate) return 'separate';
  const states = (module.tools || []).map(t => toolState(t, sections));
  if (states.includes('available')) return 'available';
  if (states.includes('moving')) return 'moving';
  if (states.some(s => s === 'link')) return 'available';
  return states.length ? 'locked' : 'moving';
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
