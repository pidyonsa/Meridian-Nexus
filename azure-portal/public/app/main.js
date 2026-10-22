import {h, icon, initials, toast} from './ui.js';
import {api} from './api.js';
import {visibleNav, match} from './nav.js';
import {VIEWS} from './views/index.js';

const $ = id => document.getElementById(id);
const state = {user: null, nav: [], controller: null};

async function boot() {
  try {
    state.user = await api('/me');
  } catch (error) {
    $('boot').replaceChildren(h('div.boot-error', {}, icon('alert'), h('strong', {}, 'Nexus could not start'), h('span', {}, error.message), h('button.button', {type: 'button', onclick: () => location.reload()}, 'Try again')));
    return;
  }
  state.nav = visibleNav(state.user.sections);
  renderChrome();
  await route();
  $('boot').remove();
  $('shell').hidden = false;
}

function renderChrome() {
  const {user} = state;
  $('avatar').textContent = initials(user.name);
  $('userName').textContent = user.name;
  $('menuName').textContent = user.name;
  $('menuEmail').textContent = user.email;
  $('menuRole').textContent = user.preview ? 'Local preview' : user.admin ? 'Administrator' : 'Staff';
  $('menuButton').replaceChildren(icon('menu'));
  $('searchButton').querySelector('.search-icon').replaceChildren(icon('search'));
  $('nav').replaceChildren(...state.nav.map(group => h('div.nav-group', {},
    group.group ? h('p.nav-label', {}, group.group) : null,
    h('ul', {}, group.items.map(item => h('li', {},
      h('a.nav-item', {href: item.path, 'data-link': true, 'data-nav': item.id}, icon(item.icon), h('span', {}, item.label), item.children ? h('span.nav-caret', {}, icon('chevron')) : null),
      item.children ? h('ul.nav-children', {'data-children': item.id}, item.children.map(child => h('li', {}, h('a.nav-child', {href: child.path, 'data-link': true}, child.label)))) : null
    )))
  )));
}

function highlight(found) {
  for (const el of document.querySelectorAll('[data-nav]')) {
    const active = el.dataset.nav === found?.item.id;
    el.classList.toggle('active', active);
    if (active) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
  }
  for (const list of document.querySelectorAll('[data-children]')) list.classList.toggle('open', list.dataset.children === found?.item.id);
  for (const el of document.querySelectorAll('.nav-child')) el.classList.toggle('active', el.getAttribute('href') === location.pathname);
  $('crumbs').replaceChildren(...[
    h('a', {href: state.user.sections.includes('home') ? '/' : state.nav[0].items[0].path, 'data-link': true}, 'Nexus'),
    found && found.item.path !== '/' ? [h('span.crumb-sep', {}, icon('chevron')), h(found.child ? 'a' : 'span', found.child ? {href: found.item.path, 'data-link': true} : {'aria-current': 'page'}, found.item.label)] : null,
    found?.child ? [h('span.crumb-sep', {}, icon('chevron')), h('span', {'aria-current': 'page'}, found.child.label)] : null
  ].flat().filter(Boolean));
}

async function route() {
  const found = match(location.pathname, state.nav);
  if (!found) {
    // Not allowed or unknown: go to the first section this user may open.
    history.replaceState(null, '', state.nav[0].items[0].path);
    return route();
  }
  highlight(found);
  closeDrawer();
  state.controller?.abort();
  state.controller = new AbortController();
  const main = $('main');
  main.replaceChildren(h('div.page-loading', {role: 'status'}, h('span.spinner'), 'Loading…'));
  document.title = `${found.child?.label || found.item.label} · Meridian Nexus`;
  try {
    await (VIEWS[found.item.id] || VIEWS.pending)(main, {user: state.user, nav: state.nav, item: found.item, child: found.child, path: location.pathname, signal: state.controller.signal});
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

// User menu.
$('userButton').addEventListener('click', () => { const menu = $('userMenu'); menu.hidden = !menu.hidden; $('userButton').setAttribute('aria-expanded', String(!menu.hidden)); });
document.addEventListener('click', event => { if (!event.target.closest('.user-menu')) { $('userMenu').hidden = true; $('userButton').setAttribute('aria-expanded', 'false'); } });

// Search palette (Ctrl/Cmd+K): every page the user may open.
function entries() {
  return state.nav.flatMap(group => group.items.flatMap(item => [{label: item.label, hint: group.group || 'Nexus', path: item.path, icon: item.icon}, ...(item.children || []).map(child => ({label: child.label, hint: item.label, path: child.path, icon: item.icon}))])).filter((e, i, all) => all.findIndex(x => x.path === e.path && x.label === e.label) === i);
}
let selected = 0;
function renderPalette() {
  const q = $('paletteInput').value.trim().toLowerCase();
  const results = entries().filter(e => !q || `${e.label} ${e.hint}`.toLowerCase().includes(q)).slice(0, 12);
  selected = Math.min(selected, Math.max(results.length - 1, 0));
  $('paletteResults').replaceChildren(...(results.length ? results.map((e, i) => h('li', {role: 'option', 'aria-selected': String(i === selected), class: i === selected ? 'selected' : '', onclick: () => openResult(e), onmousemove: () => { if (selected !== i) { selected = i; renderPalette(); } }}, icon(e.icon), h('span.result-label', {}, e.label), h('span.result-hint', {}, e.hint))) : [h('li.palette-empty', {}, 'No matching pages')]));
  return results;
}
function openResult(entry) { $('palette').close(); navigate(entry.path); }
function openPalette() { $('paletteInput').value = ''; selected = 0; renderPalette(); $('palette').showModal(); $('paletteInput').focus(); }
$('searchButton').addEventListener('click', openPalette);
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
