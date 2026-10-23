import {h, icon} from '../ui.js';
import {OLD_NEXUS} from '../nav.js';
import {moduleHead} from './module.js';

// A tool that still runs on the Firebase-era Nexus: say so and link straight to it.
export async function renderPending(main, {module, tool, page}) {
  main.replaceChildren(
    moduleHead(module),
    h('section.state-panel', {},
      h('span.state-icon', {}, icon(module.icon)),
      h('h2', {}, page ? `${tool.label} · ${page.label}` : tool.label),
      h('p', {}, `${tool.label} is moving to the Azure Nexus. Until it lands here, open it on the current Nexus — nothing has changed there.`),
      h('a.button.primary', {href: `${OLD_NEXUS}/${tool.old || ''}`, target: '_blank', rel: 'noopener'}, 'Open on current Nexus', icon('external')),
      h('a.button.ghost', {href: `/modules/${module.id}`, 'data-link': true}, `Back to ${module.short || module.label}`)
    )
  );
}
