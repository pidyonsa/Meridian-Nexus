// The Nexus navigation: one definition drives the sidebar, breadcrumbs, search palette and routing.
// `section` must match server/access.cjs; only sections the server allows are shown.

export const NAV = [
  {group: null, items: [
    {id: 'home', section: 'home', label: 'Overview', icon: 'home', path: '/'}
  ]},
  {group: 'Dashboards', items: [
    {id: 'attendance', section: 'attendance', label: 'Time & Attendance', icon: 'clock', path: '/attendance/reps/daily', children: [
      {label: 'Reps · Daily visits', path: '/attendance/reps/daily'},
      {label: 'Reps · MTD overview', path: '/attendance/reps/mtd'},
      {label: 'Reps · Roster', path: '/attendance/reps/roster'},
      {label: 'Reps · Stores', path: '/attendance/reps/stores'},
      {label: 'Merchandisers · Daily visits', path: '/attendance/merchandisers/daily'},
      {label: 'Merchandisers · MTD overview', path: '/attendance/merchandisers/mtd'},
      {label: 'Merchandisers · Roster', path: '/attendance/merchandisers/roster'},
      {label: 'Merchandisers · Stores', path: '/attendance/merchandisers/stores'}
    ]},
    {id: 'callcycle', section: 'callcycle', label: 'Call Cycle', icon: 'route', path: '/call-cycle/overview', children: [
      {label: 'Overview', path: '/call-cycle/overview'},
      {label: 'Divisional coverage', path: '/call-cycle/divisions'},
      {label: 'Reps', path: '/call-cycle/reps'},
      {label: 'Stores', path: '/call-cycle/stores'}
    ]},
    {id: 'franchiseorder', section: 'franchiseorder', label: 'Franchise orders', icon: 'cart', path: '/franchise-orders/overview', children: [
      {label: 'Executive overview', path: '/franchise-orders/overview'},
      {label: 'Trend analysis', path: '/franchise-orders/trend'},
      {label: 'Regional', path: '/franchise-orders/regions'},
      {label: 'Products', path: '/franchise-orders/products'},
      {label: 'Stores', path: '/franchise-orders/stores'},
      {label: 'Reps', path: '/franchise-orders/reps'},
      {label: 'Order detail', path: '/franchise-orders/orders'}
    ]},
    {id: 'sales', section: 'sales', label: 'Sales', icon: 'chart', path: '/sales'},
    {id: 'training', section: 'training', label: 'Training hub', icon: 'cap', path: '/training'}
  ]},
  {group: 'Operations', items: [
    {id: 'automation', section: 'automation', label: 'Report automation', icon: 'play', path: '/automation'},
    {id: 'etls', section: 'etls', label: 'ETLs', icon: 'flow', path: '/etls'},
    {id: 'resources', section: 'resources', label: 'Resources', icon: 'folder', path: '/resources'}
  ]},
  {group: 'Collaborate', items: [
    {id: 'chat', section: 'chat', label: 'Meridian Chat', icon: 'chat', path: '/chat'},
    {id: 'support', section: 'support', label: 'Support', icon: 'lifebuoy', path: '/support'}
  ]},
  {group: 'Administration', items: [
    {id: 'admin', section: 'admin', label: 'Admin', icon: 'shield', path: '/admin', children: [
      {label: 'Overview', path: '/admin'},
      {label: 'Jobs', path: '/admin/jobs'},
      {label: 'Schedules', path: '/admin/schedules'},
      {label: 'Extraction profiles', path: '/admin/profiles'},
      {label: 'Workflows', path: '/admin/workflows'},
      {label: 'Users', path: '/admin/users'},
      {label: 'Integrations', path: '/admin/integrations'},
      {label: 'Audit log', path: '/admin/audit'}
    ]}
  ]}
];

export function visibleNav(sections) {
  const allowed = new Set(sections);
  return NAV.map(group => ({...group, items: group.items.filter(item => allowed.has(item.section))})).filter(group => group.items.length);
}

// The nav item (and child) that owns a path: longest matching prefix wins.
export function match(path, nav) {
  let best = null;
  for (const group of nav) for (const item of group.items) {
    const base = item.path === '/' ? '/' : `/${item.path.split('/')[1]}`;
    const owns = item.path === '/' ? path === '/' : path === base || path.startsWith(`${base}/`);
    if (!owns) continue;
    const child = item.children?.find(c => c.path === path) || null;
    if (!best || base.length > best.base.length) best = {item, child, base};
  }
  return best;
}
