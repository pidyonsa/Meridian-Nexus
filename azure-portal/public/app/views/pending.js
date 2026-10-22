import {h, icon} from '../ui.js';

// Shown for sections that are still being moved to Azure; the Firebase portal keeps serving them until then.
const OLD_NEXUS = 'https://meridian-nexus.web.app';

export async function renderPending(main, {item, child}) {
  main.replaceChildren(
    h('header.page-head', {}, h('div', {}, h('p.eyebrow', {}, child ? item.label : 'Nexus'), h('h1', {}, child?.label || item.label))),
    h('section.state-panel', {},
      h('span.state-icon', {}, icon(item.icon)),
      h('h2', {}, 'Moving to Azure'),
      h('p', {}, `${item.label} is being rebuilt on the new Azure Nexus. Until it lands here, keep using it on the current Nexus — nothing has changed there.`),
      h('a.button.primary', {href: OLD_NEXUS, target: '_blank', rel: 'noopener'}, 'Open current Nexus', icon('arrow'))
    )
  );
}
