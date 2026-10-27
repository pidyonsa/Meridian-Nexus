import {h, icon, formatNumber, initials, toast} from '../ui.js';
import {api} from '../api.js';
import {renderPending} from './pending.js';

const relative = value => {
  if (!value) return 'never';
  const minutes = Math.round((Date.now() - new Date(value)) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)} h ago`;
  return new Intl.DateTimeFormat('en-ZA', {day: 'numeric', month: 'short', timeZone: 'Africa/Johannesburg'}).format(new Date(value));
};
const clock = value => (value ? new Intl.DateTimeFormat('en-ZA', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg'}).format(new Date(value)) : '—');

function pageHead(title, lede, extra) {
  return h('header.page-head', {}, h('div', {}, h('p.eyebrow', {}, 'Admin'), h('h1', {}, title), lede ? h('p.lede.compact', {}, lede) : null), extra || null);
}

function sourceNote(sample) {
  return sample
    ? h('div.notice.warning', {role: 'note'}, icon('alert'), h('span', {}, 'Sample data for local preview. Nothing here is real.'))
    : h('div.notice', {role: 'note'}, icon('refresh'), h('span', {}, 'Synced hourly from the current Nexus. Make changes there until this area moves over.'));
}

function stat(label, value, tone, hint) {
  return h(`div.stat${tone ? `.${tone}` : ''}`, {}, h('span.stat-label', {}, label), h('strong.stat-value', {}, value), hint ? h('span.stat-hint', {}, hint) : null);
}

const STATUS_TONE = {succeeded: 'ok', partial: 'warn', failed: 'bad', running: 'info'};
const badge = (text, tone = '') => h(`span.badge${tone ? `.${tone}` : ''}`, {}, text);

async function overview(main, {signal}) {
  const sync = await api('/admin/sync', {signal});
  const last = sync.runs[0];
  const lastOk = sync.runs.find(r => r.status === 'succeeded');
  const dayRuns = sync.runs.filter(r => Date.now() - new Date(r.startedAt) < 24 * 3600 * 1000);
  const healthy = last && last.status === 'succeeded' && Date.now() - new Date(last.startedAt) < 2 * 3600 * 1000;
  main.replaceChildren(
    pageHead('Overview', 'Health of the move from Firebase to Azure.'),
    sourceNote(sync.sample),
    h('div.stat-grid', {},
      stat('Data sync', healthy ? 'Healthy' : last ? 'Needs attention' : 'Not run yet', healthy ? 'ok' : 'warn', last ? `Last run ${relative(last.startedAt)} · ${last.status}` : 'Waiting for the first run'),
      stat('Last good sync', lastOk ? relative(lastOk.finishedAt) : '—', lastOk ? '' : 'warn', lastOk ? clock(lastOk.finishedAt) : 'No successful run yet'),
      stat('Runs in 24 h', formatNumber(dayRuns.length), '', `${dayRuns.filter(r => r.status !== 'succeeded').length} with problems`),
      stat('Collections', formatNumber(sync.collections.length), '', `${formatNumber(sync.collections.reduce((s, c) => s + (c.documents || 0), 0))} documents`)
    ),
    h('section.panel', {'aria-labelledby': 'syncRunsHeading'},
      h('div.panel-head', {}, h('h2', {id: 'syncRunsHeading'}, 'Recent sync runs'), h('span.muted', {}, 'Hourly, with a full pass every night at 02:15')),
      sync.runs.length ? h('div.table-wrap', {}, h('table.table', {},
        h('thead', {}, h('tr', {}, ['Started', 'Type', 'Status', 'Read', 'Written', 'Removed', 'Problem'].map(t => h('th', {scope: 'col'}, t)))),
        h('tbody', {}, sync.runs.slice(0, 24).map(r => h('tr', {},
          h('td', {}, clock(r.startedAt)), h('td', {}, r.mode === 'nightly' ? 'Nightly full' : 'Hourly'),
          h('td', {}, badge(r.status.charAt(0).toUpperCase() + r.status.slice(1), STATUS_TONE[r.status])), h('td.num', {}, formatNumber(r.read)), h('td.num', {}, formatNumber(r.written)), h('td.num', {}, formatNumber(r.deleted)),
          h('td.problem', {title: r.error || ''}, r.error ? r.error.split(';')[0].slice(0, 90) : '—')
        )))
      )) : h('p.empty', {}, 'No sync runs yet.')
    )
  );
}

// Users: who may open which Nexus tools. Everyone signed in with a Meridian account gets the default dashboards;
// administrators grant the rest, switch people to administrator, or block them. Holders of the Microsoft role
// Nexus Administrator are always administrators.
async function users(main, {signal, user}) {
  let data = await api('/permissions', {signal});
  const state = {q: '', filter: 'all'};
  const tbody = h('tbody');
  const summary = h('p.table-summary', {'aria-live': 'polite'});
  const stats = h('div.stat-grid');
  const dialog = h('dialog.drill.narrow', {'aria-labelledby': 'personTitle'});
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  const label = id => data.catalogue.find(s => s.id === id)?.label || id;
  const kind = p => (p.entraAdmin ? 'entra' : p.permissions?.disabled ? 'blocked' : p.permissions?.admin ? 'admin' : p.permissions?.sections?.length ? 'access' : 'default');

  function render() {
    const q = state.q.trim().toLowerCase();
    const rows = data.people.filter(p => (state.filter === 'all' || (state.filter === 'admins' ? ['entra', 'admin'].includes(kind(p)) : state.filter === 'never' ? !p.lastSeenAt : kind(p) === state.filter))
      && (!q || `${p.name || ''} ${p.email}`.toLowerCase().includes(q)));
    const n = k => data.people.filter(p => k(p)).length;
    stats.replaceChildren(stat('People', formatNumber(data.people.length)), stat('Administrators', formatNumber(n(p => ['entra', 'admin'].includes(kind(p)))), 'ok'),
      stat('With extra access', formatNumber(n(p => kind(p) === 'access'))), stat('Blocked', formatNumber(n(p => kind(p) === 'blocked')), n(p => kind(p) === 'blocked') ? 'bad' : ''));
    summary.textContent = `${rows.length} of ${data.people.length} people`;
    tbody.replaceChildren(...(rows.length ? rows.map(p => {
      const k = kind(p);
      const access = k === 'entra' ? badge('Administrator (Microsoft role)', 'accent') : k === 'admin' ? badge('Administrator', 'accent') : k === 'blocked' ? badge('Blocked', 'bad')
        : h('div.chips', {}, (p.permissions?.sections || []).map(s => h('span.chip', {}, label(s))), (p.permissions?.sections || []).length ? null : h('span.muted', {}, 'Dashboards only'));
      return h('tr', {class: k === 'blocked' ? 'dim' : ''},
        h('td', {}, h('div.person', {}, h('span.avatar.small', {}, initials(p.name || p.email)), h('div', {}, h('strong', {}, p.name || p.email.split('@')[0]), h('span.muted', {}, p.email)))),
        h('td', {}, access), h('td.muted', {}, p.lastSeenAt ? relative(p.lastSeenAt) : 'not yet'),
        h('td.actions', {}, h('button.button.small', {type: 'button', onclick: () => edit(p)}, 'Edit access')));
    }) : [h('tr', {}, h('td.empty', {colspan: '4'}, 'Nobody matches.'))]));
  }

  async function reload() { data = await api('/permissions', {signal}); render(); }

  function edit(person) {
    const p = person.permissions || {admin: false, disabled: false, sections: []};
    const admin = h('input', {type: 'checkbox', checked: person.entraAdmin || p.admin, disabled: person.entraAdmin});
    const blocked = h('input', {type: 'checkbox', checked: p.disabled, disabled: person.entraAdmin});
    const note = h('input', {type: 'text', maxlength: '300', value: p.note || '', placeholder: 'Why (optional), e.g. "Shonesa\'s team uploads Sir Fruit reports"'});
    const boxes = new Map();
    const groups = [...new Set(data.catalogue.map(s => s.group))];
    const grid = h('div.permission-groups', {}, groups.map(g => h('fieldset.days.permission-group', {}, h('legend', {}, g), data.catalogue.filter(s => s.group === g).map(s => {
      const box = h('input', {type: 'checkbox', checked: s.everyone || p.sections.includes(s.id), disabled: s.everyone});
      if (!s.everyone) boxes.set(s.id, box);
      return h('label.permission', {title: s.hint || ''}, box, h('span', {}, s.label, s.everyone ? h('em', {}, ' · everyone') : s.hint ? h('em', {}, ` · ${s.hint}`) : null));
    }))));
    const sync = () => { const off = admin.checked || blocked.checked; grid.classList.toggle('dim', off); for (const b of boxes.values()) b.disabled = off; };
    admin.addEventListener('change', () => { if (admin.checked) blocked.checked = false; sync(); });
    blocked.addEventListener('change', () => { if (blocked.checked) admin.checked = false; sync(); });
    sync();
    const save = h('button.button.primary', {type: 'submit'}, 'Save access');
    const reset = person.permissions && !person.entraAdmin ? h('button.button.ghost.danger', {type: 'button', onclick: async e => {
      if (!confirm(`Reset ${person.name || person.email} to the default dashboards only?`)) return;
      e.currentTarget.disabled = true;
      try { await api(`/permissions/${encodeURIComponent(person.email)}`, {method: 'DELETE', signal}); toast('Access reset to the defaults.', 'success'); dialog.close(); await reload(); } catch (error) { toast(error.message, 'error'); e.currentTarget.disabled = false; }
    }}, 'Reset to defaults') : null;
    dialog.replaceChildren(h('form', {onsubmit: async e => {
      e.preventDefault();
      save.disabled = true;
      try {
        await api(`/permissions/${encodeURIComponent(person.email)}`, {method: 'PUT', signal, body: {name: person.name || undefined, admin: admin.checked && !person.entraAdmin, disabled: blocked.checked, note: note.value, sections: [...boxes].filter(([, b]) => b.checked).map(([id]) => id)}});
        toast(`Access saved for ${person.name || person.email}. It applies within a minute; they may need to refresh Nexus.`, 'success');
        dialog.close(); await reload();
      } catch (error) { toast(error.message, 'error'); save.disabled = false; }
    }},
      h('header.drill-head', {}, h('div', {}, h('p.eyebrow', {}, person.email), h('h2', {id: 'personTitle'}, person.name || person.email)), h('button.button.ghost', {type: 'button', 'aria-label': 'Close', onclick: () => dialog.close()}, '✕')),
      person.entraAdmin ? h('div.notice', {}, icon('shield'), h('span', {}, 'Administrator through the Microsoft role Nexus Administrator. Change that in Microsoft Entra.')) : null,
      h('div.switch-row', {}, h('label.switch', {}, admin, h('span', {}, 'Administrator (everything, including this page)')), h('label.switch', {}, blocked, h('span', {}, 'Block access to Nexus'))),
      grid, h('label.field', {}, h('span', {}, 'Note'), note),
      person.permissions?.updatedBy ? h('p.muted.small-note', {}, `Last changed ${clock(person.permissions.updatedAt)} by ${person.permissions.updatedBy}.`) : null,
      h('div.form-actions', {}, reset, h('span.spacer'), h('button.button', {type: 'button', onclick: () => dialog.close()}, 'Cancel'), save)));
    dialog.showModal();
  }

  const addEmail = h('input', {type: 'email', placeholder: 'name@meridiangroup.co.za', 'aria-label': 'Email of the person to add'});
  const add = h('form.add-person', {onsubmit: e => {
    e.preventDefault();
    const email = addEmail.value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Enter their Microsoft sign-in email.', 'error'); return; }
    edit(data.people.find(p => p.email === email) || {email, name: null, entraAdmin: false, lastSeenAt: null, permissions: null});
  }}, h('label.field.grow', {}, h('span', {}, 'Give someone access'), addEmail), h('button.button.primary', {type: 'submit'}, 'Add person'));
  const select = (text, key, options) => h('label.field', {}, h('span', {}, text), h('select', {onchange: e => { state[key] = e.target.value; render(); }}, options.map(([v, t]) => h('option', {value: v, selected: state[key] === v}, t))));
  main.replaceChildren(
    pageHead('Users', 'Who can open which Nexus tools. Everyone with a Meridian Microsoft account sees the dashboards; give people more here.',
      h('a.button.ghost', {href: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ManagedAppMenuBlade/~/Users/objectId/63942481-5a74-4ad5-be7e-a61b1ce0ed12/appId/748c496f-5033-415d-9d3f-f2bb85de1d71', target: '_blank', rel: 'noopener'}, 'Microsoft roles', icon('external'))),
    stats,
    h('section.panel', {}, add,
      h('div.toolbar', {}, h('label.field.grow', {}, h('span', {}, 'Search'), h('input', {type: 'search', placeholder: 'Name or email', oninput: e => { state.q = e.target.value; render(); }})),
        select('Show', 'filter', [['all', 'Everyone'], ['admins', 'Administrators'], ['access', 'With extra access'], ['default', 'Dashboards only'], ['blocked', 'Blocked'], ['never', 'Not signed in yet']])),
      summary, h('div.table-wrap', {}, h('table.table', {}, h('thead', {}, h('tr', {}, ['Person', 'Access', 'Last in Nexus', ''].map(t => h('th', {scope: 'col'}, t)))), tbody))),
    data.history.length ? h('section.panel', {}, h('div.panel-head', {}, h('h2', {}, 'Recent changes')), h('ul.plain-list', {}, data.history.slice(0, 15).map(c => h('li', {},
      h('span', {}, h('strong', {}, c.email), ` · ${c.action.replace('permissions-', '')}`, c.detail?.after ? h('div.muted.small-note', {}, c.detail.after.disabled ? 'Blocked' : c.detail.after.admin ? 'Administrator' : (c.detail.after.sections || []).map(label).join(', ') || 'Dashboards only') : null),
      h('em', {}, c.by), h('em', {}, clock(c.at)))))) : null,
    dialog);
  render();
}

export async function renderAdmin(main, context) {
  if (context.path === '/admin') return overview(main, context);
  if (context.path === '/admin/users') return users(main, context);
  return renderPending(main, context);
}
