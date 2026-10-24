import {h, icon, initials, toast} from './ui.js';
import {api} from './api.js';
import {MODULES, locate, moduleState, toolState, toolLink} from './nav.js';
import {renderHome} from './views/home.js';
import {renderModule, renderLocked} from './views/module.js';
import {renderAdmin} from './views/admin.js';
import {renderPending} from './views/pending.js';
import {renderGaps, renderGapUpload} from './views/gaps.js';

const $ = id => document.getElementById(id);
const state = {user: null, sections: new Set(), controller: null};
// Tools with a page on the Azure portal; the rest show where they still run.
const TOOL_VIEWS = {'admin-overview': renderAdmin, 'admin-users': renderAdmin, 'sirfruit-gaps': renderGaps, 'sirfruit-upload': renderGapUpload};

async function boot() {
  try {
    state.user = await api('/me');
  } catch (error) {
    $('boot').replaceChildren(h('div.boot-error', {}, icon('alert'), h('strong', {}, 'Nexus could not start'), h('span', {}, error.message), h('button.button', {type: 'button', onclick: () => location.reload()}, 'Try again')));
    return;
  }
  state.sections = new Set(state.user.sections);
  renderChrome();
  await route();
  $('boot').remove();
  $('shell').hidden = false;
}

const DOT = {available: 'green', moving: 'blue', locked: 'orange', separate: 'orange'};

function renderChrome() {
  const {user} = state;
  $('avatar').textContent = initials(user.name);
  $('userName').textContent = user.name;
  $('userRole').textContent = user.preview ? 'Preview' : user.admin ? 'Admin' : '';
  $('userRole').hidden = !user.admin && !user.preview;
  $('menuButton').replaceChildren(icon('menu'));
  $('mobileSearch').replaceChildren(icon('search'));
  $('nav').replaceChildren(
    h('a.nav-item', {href: '/', 'data-link': true, 'data-nav': 'home'}, icon('grid'), h('span', {}, 'Overview')),
    h('p.nav-label', {}, 'Modules'),
    h('ul', {}, MODULES.map(m => {
      const s = moduleState(m, state.sections);
      // Tools that work on this site are listed by name under their module, one click away.
      const ready = (m.tools || []).filter(t => toolState(t, state.sections) === 'available');
      return h('li', {},
        h('a.nav-item', {href: `/modules/${m.id}`, 'data-link': true, 'data-nav': m.id}, icon(m.icon), h('span', {}, m.label), DOT[s] ? h(`span.dot.${DOT[s]}`, {title: s === 'locked' ? 'Admin only' : s === 'moving' ? 'On the current Nexus' : 'Available'}) : null),
        ready.length ? h('ul.nav-tools', {}, ready.map(t => {
          const link = toolLink(t);
          return h('li', {}, h('a.nav-tool', {...(link.spa ? {href: link.href, 'data-link': true} : {href: link.href}), 'data-tool': t.id}, t.navLabel || t.label));
        })) : null);
    }))
  );
}

function highlight(found) {
  const active = found?.home ? 'home' : found?.module?.id;
  for (const el of document.querySelectorAll('[data-tool]')) {
    const on = el.dataset.tool === found?.tool?.id;
    el.classList.toggle('active', on);
    if (on) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
  }
  for (const el of document.querySelectorAll('[data-nav]')) {
    el.classList.toggle('active', el.dataset.nav === active);
    if (el.dataset.nav === active) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
  }
}

async function route() {
  const found = locate(location.pathname);
  if (!found) { history.replaceState(null, '', '/'); return route(); }
  highlight(found);
  closeDrawer();
  state.controller?.abort();
  state.controller = new AbortController();
  const main = $('main');
  main.replaceChildren(h('div.page-loading', {role: 'status'}, h('span.spinner'), 'Loading…'));
  document.title = `${found.page?.label || found.tool?.label || found.module?.label || 'Overview'} · Meridian Nexus`;
  const context = {user: state.user, sections: state.sections, ...found, path: location.pathname, signal: state.controller.signal};
  try {
    if (found.home) await renderHome(main, context);
    else if (!found.tool) await renderModule(main, context);
    else {
      const s = toolState(found.tool, state.sections);
      if (s === 'locked' || s === 'restricted') await renderLocked(main, context);
      else await (TOOL_VIEWS[found.tool.id] || renderPending)(main, context);
    }
    main.focus({preventScroll: true});
  } catch (error) {
    if (error.name === 'AbortError') return;
    main.replaceChildren(h('section.state-panel.error', {}, icon('alert'), h('h2', {}, 'This page could not load'), h('p', {}, error.message), error.requestId ? h('p.muted', {}, `Reference ${error.requestId}`) : null, h('button.button', {type: 'button', onclick: route}, icon('refresh'), 'Try again')));
  }
}

export function navigate(path) {
  if (path === location.pathname) return;
  history.pushState(null, '', path);
  route();
}

document.addEventListener('click', event => {
  const link = event.target.closest('a[data-link]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
  event.preventDefault();
  navigate(new URL(link.href).pathname);
});
addEventListener('popstate', route);

// Mobile drawer.
function closeDrawer() { $('sidebar').classList.remove('open'); $('scrim').hidden = true; $('menuButton').setAttribute('aria-expanded', 'false'); }
$('menuButton').addEventListener('click', () => { const open = !$('sidebar').classList.contains('open'); $('sidebar').classList.toggle('open', open); $('scrim').hidden = !open; $('menuButton').setAttribute('aria-expanded', String(open)); });
$('scrim').addEventListener('click', closeDrawer);

// Search (Ctrl/Cmd+K, the home search box and the phone search button): every module, tool and page.
export function searchEntries() {
  const out = [];
  for (const m of MODULES) {
    out.push({label: m.label, hint: 'Module', link: {href: `/modules/${m.id}`, spa: true}, icon: m.icon});
    for (const t of m.tools || []) {
      if (t.external) { out.push({label: t.label, hint: m.label, link: toolLink(t), icon: 'external'}); continue; }
      if (!state.sections.has(t.section) || t.restricted) continue;
      out.push({label: t.label, hint: m.label, link: toolLink(t), icon: m.icon});
      for (const p of t.pages || []) out.push({label: p.label, hint: t.label, link: toolLink(t, p), icon: m.icon});
    }
  }
  return out;
}
let selected = 0;
function renderPalette() {
  // Every word must appear somewhere in the label or its module/tool, in any order.
  const words = $('paletteInput').value.toLowerCase().split(/[^a-z0-9&]+/).filter(Boolean);
  const results = searchEntries().filter(e => { const text = `${e.label} ${e.hint}`.toLowerCase(); return words.every(w => text.includes(w)); }).slice(0, 14);
  selected = Math.min(selected, Math.max(results.length - 1, 0));
  $('paletteResults').replaceChildren(...(results.length ? results.map((e, i) => h('li', {role: 'option', 'aria-selected': String(i === selected), class: i === selected ? 'selected' : '', onclick: () => openResult(e), onmousemove: () => { if (selected !== i) { selected = i; renderPalette(); } }}, icon(e.icon), h('span.result-label', {}, e.label), h('span.result-hint', {}, e.hint))) : [h('li.palette-empty', {}, 'No matching tools')]));
  return results;
}
function openResult({link}) {
  $('palette').close();
  if (link.spa) navigate(link.href); else if (link.newTab) window.open(link.href, '_blank', 'noopener'); else location.assign(link.href);
}
export function openPalette(query = '') { $('paletteInput').value = query; selected = 0; renderPalette(); if (!$('palette').open) $('palette').showModal(); $('paletteInput').focus(); }
$('mobileSearch').addEventListener('click', () => openPalette());
$('paletteInput').addEventListener('input', () => { selected = 0; renderPalette(); });
$('paletteInput').addEventListener('keydown', event => {
  const results = renderPalette();
  if (event.key === 'ArrowDown') { selected = (selected + 1) % Math.max(results.length, 1); renderPalette(); event.preventDefault(); }
  if (event.key === 'ArrowUp') { selected = (selected - 1 + results.length) % Math.max(results.length, 1); renderPalette(); event.preventDefault(); }
  if (event.key === 'Enter' && results[selected]) { event.preventDefault(); openResult(results[selected]); }
});
$('palette').addEventListener('click', event => { if (event.target === $('palette')) $('palette').close(); });
addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && state.user) { event.preventDefault(); openPalette(); }
});

addEventListener('unhandledrejection', event => { if (event.reason?.name !== 'AbortError') toast(event.reason?.message || 'Something went wrong.', 'error'); });
boot();
