import {h, icon} from '../ui.js';
import {OLD_NEXUS, toolState, moduleState, toolLink} from '../nav.js';
import {CONFIG} from '../config.js';
import {badge, tile} from './home.js';

// <a> attributes for a tool link: workspace route, full page on this site, or a new tab for other sites.
export function linkAttrs(link) {
  return link.spa ? {href: link.href, 'data-link': true} : link.newTab ? {href: link.href, target: '_blank', rel: 'noopener'} : {href: link.href};
}

export function moduleHead(module) {
  return h('header.module-head', {}, tile(module.icon, module.tone), h('div', {}, h('h1', {}, module.label), h('p', {}, module.blurb)));
}

function toolCard(tool, sections) {
  const s = toolState(tool, sections);
  const top = h('div.tool-top', {}, h('strong', {}, tool.label), s === 'locked' || s === 'restricted' ? h('span.pill.orange.small', {}, icon('lock'), 'Admin only') : s === 'available' ? badge('available') : null);
  if (s === 'link') {
    return h('a.tool-card', {href: tool.external, target: '_blank', rel: 'noopener'}, top, h('p', {}, tool.desc), h('span.tool-action', {}, tool.action || 'Open portal', icon('external')));
  }
  if (s === 'locked' || s === 'restricted') {
    return h('div.tool-card.locked', {}, top, h('p', {}, tool.desc), h('span.tool-foot', {}, s === 'restricted' ? 'Restricted – admin only' : 'Ask a Nexus administrator for access'));
  }
  return h('a.tool-card', linkAttrs(toolLink(tool)), top, h('p', {}, tool.desc),
    s === 'available' ? h('span.tool-action', {}, 'Open', icon('arrow'))
      : h('span.tool-foot', {}, CONFIG.directLinks ? 'Opens in the current Nexus while it moves to Azure' : 'Opens on the current Nexus while it moves to Azure'));
}

export async function renderModule(main, {module, sections}) {
  const s = moduleState(module, sections);
  main.replaceChildren(
    moduleHead(module),
    s === 'dev'
      ? h('div.tool-grid', {}, h('div.tool-card.locked', {}, h('div.tool-top', {}, h('strong', {}, module.label), badge('dev')), h('p', {}, module.blurb), h('span.tool-foot', {}, 'Under development')))
      : module.tools?.length
        ? h('div.tool-grid', {}, module.tools.map(t => toolCard(t, sections)))
        : h('div.tool-grid', {}, h('div.tool-card.locked', {}, h('div.tool-top', {}, h('strong', {}, module.label)), h('p', {}, module.note || module.blurb), h('a.tool-action', {href: OLD_NEXUS, target: '_blank', rel: 'noopener'}, 'Open current Nexus', icon('external'))))
  );
}

export async function renderLocked(main, {module, tool}) {
  main.replaceChildren(moduleHead(module), h('section.state-panel', {}, h('span.state-icon', {}, icon('lock')), h('h2', {}, `${tool.label} is admin only`), h('p', {}, 'Your account can open Syndicated Attendance and Franchise Orders. Ask a Nexus administrator if you need more.'), h('a.button', {href: `/modules/${module.id}`, 'data-link': true}, `Back to ${module.short || module.label}`)));
}
