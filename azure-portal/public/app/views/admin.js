import {h, icon, formatNumber, initials} from '../ui.js';
import {api} from '../api.js';
import {renderPending} from './pending.js';

const SECTION_LABELS = {attendance: 'Time & Attendance', callcycle: 'Call Cycle', franchiseorder: 'Franchise orders', sales: 'Sales', training: 'Training hub', automation: 'Report automation', chat: 'Chat', insights: 'Insights', all: 'Everything'};
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

async function users(main, {signal}) {
  const data = await api('/admin/users', {signal});
  const state = {q: '', role: 'all', status: 'active'};
  const counts = {total: data.users.length, admins: data.users.filter(u => u.role === 'admin').length, disabled: data.users.filter(u => u.disabled).length};
  const tbody = h('tbody');
  const summary = h('p.table-summary', {'aria-live': 'polite'});

  function render() {
    const q = state.q.trim().toLowerCase();
    const rows = data.users.filter(u => (state.role === 'all' || u.role === state.role) && (state.status === 'all' || (state.status === 'active' ? !u.disabled : u.disabled))
      && (!q || `${u.name} ${u.email} ${u.workRole || ''}`.toLowerCase().includes(q)));
    summary.textContent = `${rows.length} of ${data.users.length} people`;
    tbody.replaceChildren(...(rows.length ? rows.map(u => h('tr', {class: u.disabled ? 'dim' : ''},
      h('td', {}, h('div.person', {}, h('span.avatar.small', {}, initials(u.name)), h('div', {}, h('strong', {}, u.name), h('span.muted', {}, u.email)))),
      h('td', {}, badge(u.role === 'admin' ? 'Admin' : u.role === 'client' ? 'Client' : 'Staff', u.role === 'admin' ? 'accent' : '')),
      h('td', {}, h('div.chips', {}, u.sections.length ? u.sections.map(s => h('span.chip', {}, SECTION_LABELS[s] || s)) : h('span.muted', {}, 'Support only'))),
      h('td', {}, u.retailers.length ? h('div.chips', {}, u.retailers.slice(0, 3).map(r => h('span.chip', {title: r.id}, r.name)), u.retailers.length > 3 ? h('span.muted', {}, `+${u.retailers.length - 3}`) : null) : h('span.muted', {}, 'All profiles')),
      h('td', {}, u.disabled ? badge('Disabled', 'bad') : badge('Active', 'ok')),
      h('td.muted', {}, relative(u.updatedAt))
    )) : [h('tr', {}, h('td.empty', {colspan: '6'}, 'Nobody matches these filters.'))]));
  }

  const select = (label, key, options) => h('label.field', {}, h('span', {}, label), h('select', {onchange: e => { state[key] = e.target.value; render(); }}, options.map(([v, t]) => h('option', {value: v, selected: state[key] === v}, t))));
  main.replaceChildren(
    pageHead('Users', 'Who can open what in Nexus.', h('a.button', {href: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/ManagedAppMenuBlade/~/Users/objectId/63942481-5a74-4ad5-be7e-a61b1ce0ed12/appId/748c496f-5033-415d-9d3f-f2bb85de1d71', target: '_blank', rel: 'noopener'}, 'Manage roles in Microsoft Entra', icon('external'))),
    sourceNote(data.sample),
    h('div.stat-grid', {}, stat('People', formatNumber(counts.total)), stat('Administrators', formatNumber(counts.admins)), stat('Active staff', formatNumber(counts.total - counts.disabled - counts.admins)), stat('Disabled', formatNumber(counts.disabled), counts.disabled ? 'warn' : '')),
    h('section.panel', {},
      h('div.toolbar', {},
        h('label.field.grow', {}, h('span', {}, 'Search'), h('input', {type: 'search', placeholder: 'Name, email or role', oninput: e => { state.q = e.target.value; render(); }})),
        select('Role', 'role', [['all', 'All roles'], ['admin', 'Admins'], ['staff', 'Staff'], ['client', 'Clients']]),
        select('Status', 'status', [['active', 'Active'], ['disabled', 'Disabled'], ['all', 'All']])
      ),
      summary,
      h('div.table-wrap', {}, h('table.table', {}, h('thead', {}, h('tr', {}, ['Person', 'Role', 'Sections', 'Automation profiles', 'Status', 'Changed'].map(t => h('th', {scope: 'col'}, t)))), tbody))
    )
  );
  render();
}

export async function renderAdmin(main, context) {
  if (context.path === '/admin') return overview(main, context);
  if (context.path === '/admin/users') return users(main, context);
  return renderPending(main, context);
}
