import {h, icon, formatNumber, toast} from '../ui.js';
import {api, ApiError} from '../api.js';

// Shared resources (/resources, Nexus admins): store masters, product masters, templates and reference files that
// ETLs and the Geo Rep worker read. Same catalogue as the Firebase-era #resources, files kept with 12 versions.
const MAX_BYTES = 100 * 1024 * 1024;
const size = n => (n >= 1048576 ? `${formatNumber(n / 1048576, 1)} MB` : n >= 1024 ? `${formatNumber(n / 1024, 0)} KB` : `${formatNumber(n)} B`);
const when = v => (v ? new Intl.DateTimeFormat('en-ZA', {day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg'}).format(new Date(v)) : '–');

// The upload sends the raw file (no form encoding); progress needs XMLHttpRequest.
function uploadFile(file, id, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/resources/upload?${new URLSearchParams({...(id ? {id} : {}), name: file.name})}`);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = () => {
      let body = null;
      try { body = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body); else reject(new ApiError(xhr.status, body));
    };
    xhr.onerror = () => reject(new Error('The upload was interrupted. Check the connection and try again.'));
    xhr.send(file);
  });
}

export async function renderResources(main, context) {
  const state = {data: null, q: '', category: '', active: 'active', editing: null};
  const body = h('div.resources-body');
  main.replaceChildren(
    h('header.page-head', {}, h('div', {}, h('p.eyebrow', {}, 'Shared data'), h('h1', {}, 'Resources'), h('p.lede.compact', {}, 'Masters, templates and reference files used by ETLs and report automation. Each file keeps its last 12 versions.')),
      h('div.head-actions', {}, h('button.button', {type: 'button', onclick: () => load()}, icon('refresh'), 'Refresh'), h('button.button.primary', {type: 'button', onclick: () => edit(null)}, icon('sparkle'), 'New resource'))),
    body);

  async function load() {
    body.replaceChildren(h('div.page-loading', {role: 'status'}, h('span.spinner'), 'Loading…'));
    try { state.data = await api('/resources', {signal: context.signal}); draw(); } catch (error) {
      if (error.name !== 'AbortError') body.replaceChildren(h('section.state-panel.error', {}, icon('alert'), h('h2', {}, 'Resources could not load'), h('p', {}, error.message)));
    }
  }

  function draw() {
    const {resources, categories} = state.data;
    const q = state.q.toLowerCase();
    const shown = resources.filter(r => (!state.category || r.category === state.category) && (state.active === 'all' || (state.active === 'active') === r.active) && (!q || `${r.title} ${r.sourceName} ${r.tags.join(' ')} ${r.description}`.toLowerCase().includes(q)));
    const total = resources.reduce((s, r) => s + r.size, 0);
    const recent = resources.filter(r => r.updatedAt && Date.now() - new Date(r.updatedAt).getTime() < 30 * 86400000).length;
    const search = h('input', {type: 'search', value: state.q, placeholder: 'Name, file, tag', oninput: e => { state.q = e.target.value; const pos = e.target.selectionStart; draw(); const again = body.querySelector('input[type=search]'); again.focus(); again.setSelectionRange(pos, pos); }});
    body.replaceChildren(
      h('section.stat-grid', {}, h('div.stat', {}, h('span.stat-label', {}, 'Resources'), h('strong.stat-value', {}, formatNumber(resources.length)), h('span.stat-hint', {}, `${formatNumber(resources.filter(r => r.active).length)} active`)),
        h('div.stat', {}, h('span.stat-label', {}, 'Stored'), h('strong.stat-value', {}, size(total)), h('span.stat-hint', {}, 'Current versions')),
        h('div.stat', {}, h('span.stat-label', {}, 'Updated in 30 days'), h('strong.stat-value', {}, formatNumber(recent)), h('span.stat-hint', {}, 'New files or details'))),
      h('section.panel', {},
        h('div.toolbar', {}, h('label.field.grow', {}, h('span', {}, 'Search'), search),
          h('label.field', {}, h('span', {}, 'Category'), h('select', {onchange: e => { state.category = e.target.value; draw(); }}, h('option', {value: ''}, 'All categories'), categories.map(c => h('option', {value: c, selected: c === state.category}, c)))),
          h('label.field', {}, h('span', {}, 'Show'), h('select', {onchange: e => { state.active = e.target.value; draw(); }}, [['active', 'Active'], ['inactive', 'Inactive'], ['all', 'All']].map(([v, l]) => h('option', {value: v, selected: v === state.active}, l))))),
        h('p.table-summary', {}, `${formatNumber(shown.length)} of ${formatNumber(resources.length)} resources`),
        h('div.table-wrap', {}, h('table.table', {}, h('thead', {}, h('tr', {}, ['Resource', 'Category', 'File', 'Size', 'Updated', ''].map((l, i) => h('th', {scope: 'col', class: i === 3 ? 'num' : ''}, l)))),
          h('tbody', {}, shown.length ? shown.map(r => h('tr', {class: r.active ? '' : 'dim'},
            h('td', {}, h('button.link', {type: 'button', onclick: () => edit(r)}, r.title), r.tags.length ? h('div.tag-row', {}, r.tags.map(t => h('span.tag', {}, t))) : null),
            h('td', {}, r.category), h('td.problem', {title: r.sourceName}, r.sourceName), h('td.num', {}, size(r.size)),
            h('td.nowrap', {}, when(r.updatedAt), h('div.muted.small-note', {}, r.updatedByEmail || '')),
            h('td.actions', {}, h('a.button.small', {href: `/api/resources/${encodeURIComponent(r.id)}/download`, download: ''}, 'Download'))))
            : h('tr', {}, h('td.empty', {colspan: '6'}, 'No resources match.')))))));
  }

  // Editor dialog: details, a new file version, the version list, and delete.
  const dialog = h('dialog.drill.narrow', {'aria-labelledby': 'resourceTitle'});
  dialog.addEventListener('click', e => { if (e.target === dialog && !dialog.dataset.busy) dialog.close(); });
  main.append(dialog);

  function edit(r) {
    const title = h('input', {type: 'text', maxlength: '180', required: true, value: r?.title || ''});
    const category = h('select', {}, state.data.categories.map(c => h('option', {value: c, selected: c === (r?.category || 'Other')}, c)));
    const tags = h('input', {type: 'text', value: (r?.tags || []).join(', '), placeholder: 'Comma-separated, e.g. etl-anchor-products'});
    const description = h('textarea', {rows: '3', maxlength: '1200'}, r?.description || '');
    const active = h('input', {type: 'checkbox', checked: r ? r.active : true});
    const file = h('input', {type: 'file'});
    const progress = h('progress', {max: '1', value: '0', hidden: true});
    const status = h('p.muted.small-note', {'aria-live': 'polite'}, r ? `Current file: ${r.sourceName} (${size(r.size)}), version ${r.versionCount}.` : 'Choose the file to store.');
    const save = h('button.button.primary', {type: 'submit'}, r ? 'Save changes' : 'Save resource');
    const remove = r ? h('button.button.ghost.danger', {type: 'button', onclick: async () => {
      if (!confirm(`Delete "${r.title}" and all ${r.versionCount} stored file version(s)? This cannot be undone.`)) return;
      remove.disabled = true;
      try { const x = await api(`/resources/${encodeURIComponent(r.id)}`, {method: 'DELETE', signal: context.signal}); toast(`Deleted, with ${x.deletedFiles} stored file(s).`, 'success'); dialog.close(); await load(); } catch (error) { toast(error.message, 'error'); remove.disabled = false; }
    }}, 'Delete') : null;
    async function submit(e) {
      e.preventDefault();
      const chosen = file.files[0];
      if (!r && !chosen) { status.textContent = 'Choose a file to upload.'; return; }
      if (chosen && chosen.size > MAX_BYTES) { status.textContent = 'Resource files must be 100 MB or smaller.'; return; }
      save.disabled = true; dialog.dataset.busy = '1';
      try {
        let uploaded = null;
        if (chosen) {
          progress.hidden = false;
          status.textContent = `Uploading ${chosen.name}…`;
          uploaded = await uploadFile(chosen, r?.id, p => { progress.value = p; });
        }
        const id = uploaded?.id || r.id;
        await api(`/resources/${encodeURIComponent(id)}`, {method: 'PUT', signal: context.signal, body: {title: title.value, category: category.value, description: description.value, active: active.checked,
          tags: tags.value.split(',').map(t => t.trim()).filter(Boolean), ...(uploaded ? {storagePath: uploaded.storagePath, sourceName: uploaded.sourceName} : {})}});
        toast(uploaded ? `Saved ${title.value} with the new file.` : `Saved ${title.value}.`, 'success');
        delete dialog.dataset.busy; dialog.close(); await load();
      } catch (error) {
        status.textContent = error.message; save.disabled = false; progress.hidden = true; delete dialog.dataset.busy;
      }
    }
    dialog.replaceChildren(h('form.resource-form', {onsubmit: submit},
      h('header.drill-head', {}, h('div', {}, h('p.eyebrow', {}, r ? r.category : 'New resource'), h('h2', {id: 'resourceTitle'}, r ? r.title : 'Add a resource')), h('button.button.ghost', {type: 'button', 'aria-label': 'Close', onclick: () => dialog.close()}, '✕')),
      h('div.form-grid', {},
        h('label.field', {}, h('span', {}, 'Name'), title), h('label.field', {}, h('span', {}, 'Category'), category),
        h('label.field.wide', {}, h('span', {}, 'Tags'), tags), h('label.field.wide', {}, h('span', {}, 'Description'), description),
        h('label.field.wide', {}, h('span', {}, r ? 'Replace with a new file version' : 'File (up to 100 MB)'), file), progress,
        h('label.switch.wide', {}, active, h('span', {}, 'Active (offered to ETLs and automation)'))),
      status,
      r?.versions?.length ? h('details.versions', {}, h('summary', {}, `${r.versions.length} stored version${r.versions.length === 1 ? '' : 's'}`), h('ul.plain-list', {}, r.versions.map((v, i) => h('li', {}, h('span', {}, v.sourceName, i === 0 ? h('span.pill.small.green', {}, 'Current') : null), h('em', {}, size(v.size)), h('em', {}, `${when(v.savedAt)} · ${v.savedByEmail || ''}`))))) : null,
      h('div.form-actions', {}, remove, h('span.spacer'), h('button.button', {type: 'button', onclick: () => dialog.close()}, 'Cancel'), save)));
    dialog.showModal();
    title.focus();
  }

  await load();
}
