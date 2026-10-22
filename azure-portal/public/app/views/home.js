import {h, icon} from '../ui.js';

const BLURBS = {
  attendance: 'Daily visits, MTD coverage, rosters and store attendance for reps and merchandisers.',
  callcycle: 'Planned versus visited stores by division, rep and store.',
  franchiseorder: 'Franchise order value, trends, regions, products, stores and reps.',
  sales: 'Month-to-date Geo Rep orders with drilldowns and reconciliation.',
  training: 'LMS completion and pass rates by module, region and manager.',
  automation: 'Run and schedule portal reports, answer verification prompts and review deliveries.',
  etls: 'Retailer data pipelines: upload inputs, review, approve and download outputs.',
  resources: 'Shared reference files and templates for the team.',
  chat: 'Direct and group conversations, tasks and announcements.',
  support: 'Raise and follow up support requests for Nexus.',
  admin: 'Users, jobs, schedules, extraction profiles and integrations.'
};

function greeting() {
  const hour = Number(new Intl.DateTimeFormat('en-ZA', {hour: 'numeric', hourCycle: 'h23', timeZone: 'Africa/Johannesburg'}).format(new Date()));
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

export async function renderHome(main, {user, nav}) {
  const first = user.name.split(/\s+/)[0];
  const cards = nav.flatMap(group => group.items.filter(item => item.id !== 'home').map(item => ({...item, group: group.group})));
  main.replaceChildren(
    h('section.hero', {},
      h('div.hero-copy', {},
        h('p.eyebrow', {}, new Intl.DateTimeFormat('en-ZA', {weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Johannesburg'}).format(new Date())),
        h('h1', {}, `${greeting()}, ${first}`),
        h('p.lede', {}, 'Your Meridian operations in one place: field attendance, orders, automations and the team.')
      ),
      h('div.hero-actions', {},
        user.sections.includes('automation') ? h('a.button.primary', {href: '/automation', 'data-link': true}, icon('play'), 'Run a report') : null,
        user.sections.includes('attendance') ? h('a.button', {href: '/attendance/reps/daily', 'data-link': true}, icon('clock'), "Today's attendance") : null
      )
    ),
    h('section.section', {'aria-labelledby': 'workspaceHeading'},
      h('div.section-head', {}, h('h2', {id: 'workspaceHeading'}, 'Workspace'), h('p.muted', {}, 'Everything you have access to')),
      h('div.card-grid', {}, cards.map(item => h('a.feature-card', {href: item.path, 'data-link': true},
        h('span.feature-icon', {}, icon(item.icon)),
        h('span.feature-text', {}, h('strong', {}, item.label), h('span', {}, BLURBS[item.id] || '')),
        h('span.feature-go', {}, icon('arrow'))
      )))
    )
  );
}
