import {h, icon, formatNumber, toast} from '../ui.js';
import {api} from '../api.js';

// SharePoint integration inventory (/admin/integrations, Nexus admins): a read-only catalogue of the Meridian Nexus
// SharePoint site, showing which legacy modules, scripts, workbooks and data files still need a home in Nexus.
const STATUS = {'read-only-linked': ['Read-only linked', 'green'], partial: ['Needs review', 'orange'], missing: ['Missing', 'red']};
const when = v => (v ? new Intl.DateTimeFormat('en-ZA', {day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg'}).format(new Date(v)) : '–');

export async function renderIntegrations(main, context) {
  const body = h('div.integrations-body');
  const scanBtn = h('button.button.primary', {type: 'button', onclick: () => scan()}, icon('refresh'), 'Scan SharePoint now');
  main.replaceChildren(
    h('header.page-head', {}, h('div', {}, h('p.eyebrow', {}, 'Admin'), h('h1', {}, 'SharePoint inventory'), h('p.lede.compact', {}, 'A read-only catalogue of the Meridian Nexus SharePoint site: what each legacy module holds and what still needs to move into Nexus.')),
      h('div.head-actions', {}, h('button.button', {type: 'button', onclick: () => load()}, 'Refresh'), scanBtn)),
    body);

  async function load() {
    body.replaceChildren(h('div.page-loading', {role: 'status'}, h('span.spinner'), 'Loading…'));
    try { draw(await api('/integrations?limit=500', {signal: context.signal})); } catch (error) {
      if (error.name !== 'AbortError') body.replaceChildren(h('section.state-panel.error', {}, icon('alert'), h('h2', {}, 'The inventory could not load'), h('p', {}, error.message)));
    }
  }

  async function scan() {
    scanBtn.disabled = true;
    toast('Scanning SharePoint; this takes a minute or two.', 'info');
    try { const r = await api('/integrations/scan', {method: 'POST', body: {maxItems: 3600}, signal: context.signal}); toast(`Scan finished: ${formatNumber(r.counts.total)} items.`, 'success'); await load(); } catch (error) { if (error.name !== 'AbortError') toast(error.message, 'error'); }
    scanBtn.disabled = false;
  }

  const list = (title, rows) => h('section.panel', {}, h('div.panel-head', {}, h('h2', {}, title), h('span.muted', {}, `${formatNumber(rows.length)} shown`)),
    rows.length ? h('ul.plain-list', {}, rows.slice(0, 80).map(i => h('li', {}, h('span', {}, i.webUrl ? h('a', {href: i.webUrl, target: '_blank', rel: 'noopener'}, i.name) : i.name, h('div.muted.small-note', {}, `${i.module} · ${i.path}`)), h('em', {}, i.category), h('em', {}, when(i.lastModifiedDateTime))))) : h('p.empty', {}, 'Nothing found.'));

  function draw(d) {
    scanBtn.disabled = !d.graphEnabled;
    const c = d.current;
    if (!c) { body.replaceChildren(h('section.state-panel', {}, h('h2', {}, 'No scan yet'), h('p', {}, 'Run a scan to catalogue the SharePoint site.'))); return; }
    const counts = c.counts || {};
    const fallback = cat => d.items.filter(i => i.category === cat);
    body.replaceChildren(
      h('div.notice', {}, icon('clock'), h('span', {}, `Last scan ${when(c.updatedAt)} · ${formatNumber(counts.total)} items · ${c.source?.driveName || ''}`)),
      h('section.stat-grid', {}, [['Items', counts.total], ['Code files', counts.code], ['Workbooks', counts.workbook], ['Data and config', (counts['output-data'] || 0) + (counts['config-data'] || 0)]].map(([l, v]) => h('div.stat', {}, h('span.stat-label', {}, l), h('strong.stat-value', {}, formatNumber(v || 0))))),
      h('section.panel', {}, h('div.panel-head', {}, h('h2', {}, 'Integration tracks')),
        h('ul.plain-list.tracks', {}, (c.integrationTracks || []).map(t => { const [label, tone] = STATUS[t.status] || [t.status, 'muted']; return h('li', {},
          h('span', {}, h('strong', {}, t.label), h('div.muted.small-note', {}, t.nextStep), h('div.tag-row', {}, (t.requiredFiles || []).map(f => (f.webUrl ? h('a.tag', {href: f.webUrl, target: '_blank', rel: 'noopener', class: 'found'}, `✓ ${f.name}`) : h('span.tag.missing', {}, `✕ ${f.name}`))))),
          h('em', {}, `${formatNumber(t.itemCount)} items`), h(`span.run-pill.${tone}`, {}, label)); }))),
      d.localCodeContracts.length ? h('section.panel', {}, h('div.panel-head', {}, h('h2', {}, 'Local code references'), h('span.muted', {}, 'Reference only; never copied into Nexus')),
        h('ul.plain-list', {}, d.localCodeContracts.map(k => h('li', {}, h('span', {}, h('strong', {}, k.label || k.key), h('div.muted.small-note', {}, [k.useFor, k.recommendedNexusTarget].filter(Boolean).join(' · '))), h('em', {}, (k.technology || []).join(', ')))))) : null,
      h('div.sales-grid', {}, list('Modules', c.modules || fallback('folder')), list('Code files', c.codeFiles || fallback('code')), list('Workbooks', c.workbooks || fallback('workbook')),
        list('Data, config and knowledge', [...(c.outputData || []), ...(c.configData || []), ...(c.knowledgeFiles || [])])),
      h('section.panel', {}, h('div.panel-head', {}, h('h2', {}, 'Scan history')), h('ul.plain-list', {}, d.scans.map(s => h('li', {}, h('span', {}, s.id, h('div.muted.small-note', {}, s.message || (s.counts ? `${formatNumber(s.counts.total)} items` : ''))),
        h('em', {}, s.startedByEmail || ''), h(`span.run-pill.${s.status === 'completed' ? 'green' : s.status === 'failed' ? 'red' : 'blue'}`, {}, s.status), h('em', {}, when(s.startedAt)))))));
  }

  await load();
}
