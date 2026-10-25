import {h, icon} from '../ui.js';
import {MODULES, moduleState, moduleLink, anchorAttrs} from '../nav.js';
import {UPDATES} from '../updates.js';
import {openPalette} from '../main.js';

export const BADGE = {
  available: ['Available', 'green'], moving: ['Available', 'green'], dev: ['In development', 'orange'], adminOnly: ['Admin only', 'orange'],
  locked: ['Admin only', 'orange'], restricted: ['Admin only', 'orange'], link: ['Opens Geo', 'blue'], separate: ['Separate app', 'orange']
};
// The old portal shows Sales dashboard's "Admin only" in blue and Admin's in orange (module.badgeTone).
export const badge = (s, module) => h(`span.pill.${s === 'adminOnly' && module?.badgeTone ? module.badgeTone : BADGE[s][1]}`, {}, BADGE[s][0]);
export const tile = (name, tone) => h(`span.tile.${tone}`, {}, icon(name));

const shortDate = value => new Intl.DateTimeFormat('en-ZA', {day: 'numeric', month: 'short', timeZone: 'Africa/Johannesburg'}).format(new Date(`${value}T12:00:00Z`));

function stat(value, label, iconName, tone) {
  return h(`div.stat-card.${tone}`, {}, h('div', {}, h('strong', {}, String(value)), h('span', {}, label)), tile(iconName, tone));
}

export async function renderHome(main, {user, sections}) {
  const states = MODULES.map(m => moduleState(m, sections));
  const recent = UPDATES.filter(u => Date.now() - new Date(`${u.date}T00:00:00Z`) < 14 * 86400000);
  const first = user.name.split(/\s+/)[0];
  main.replaceChildren(
    h('header.home-head', {},
      h('p.eyebrow', {}, 'Meridian workspace'),
      h('h1', {}, first && !user.preview ? `Welcome back, ${first}.` : 'Welcome back.'),
      h('p.lede', {}, 'Find a tool below, or pick one from the sidebar.'),
      h('button.tool-search', {type: 'button', onclick: () => openPalette()}, icon('search'), h('span', {}, 'Search tools…'), h('kbd', {}, 'Ctrl K'))
    ),
    h('div.stat-row', {},
      stat(MODULES.length, 'Modules in Nexus', 'cube', 'orange'),
      stat(states.filter(s => s === 'available' || s === 'moving').length, 'Available to use', 'checkCircle', 'green'),
      stat(states.filter(s => s === 'dev').length, 'In development', 'gear', 'orange'),
      stat(recent.length, 'Recent updates', 'bell', 'blue')
    ),
    h('div.home-grid', {},
      h('section.glass', {'aria-labelledby': 'modulesHeading'},
        h('h2', {id: 'modulesHeading'}, 'Workspace Modules'),
        h('div.module-grid', {}, MODULES.map((m, i) => h('a.module-card', anchorAttrs(moduleLink(m, sections)),
          h('div.module-top', {}, tile(m.icon, m.tone), h('strong', {}, m.short || m.label)),
          m.cardBlurb ? h('p', {}, m.blurb) : null,
          badge(states[i], m)
        )))
      ),
      h('section.glass.updates', {'aria-labelledby': 'updatesHeading'},
        h('h2', {id: 'updatesHeading'}, 'Recent Updates'),
        UPDATES.length ? h('ol.update-list', {}, UPDATES.map(u => h('li', {}, h('span.update-date', {}, shortDate(u.date)), h('strong', {}, u.title), h('p', {}, u.text)))) : h('p.muted', {}, 'Nothing new yet.')
      )
    )
  );
}
