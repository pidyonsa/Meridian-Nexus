// Small DOM helpers and the icon set used across Nexus.

// h('div.card', {onclick}, child, ...) -> element. Strings become text nodes (never HTML).
export function h(tag, props = {}, ...children) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (key === 'class') el.className = [el.className, value].filter(Boolean).join(' ');
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(value));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

const SVG = 'http://www.w3.org/2000/svg';
// 24px stroke icons (round caps). Each entry is a list of path data strings.
const PATHS = {
  home: ['M3 10.5 12 3l9 7.5', 'M5 9.5V21h14V9.5', 'M9.5 21v-6h5v6'],
  clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 7v5l3 2'],
  route: ['M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z', 'M18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z', 'M8 17h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7'],
  cart: ['M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6.2', 'M9.5 20.5h.01', 'M17.5 20.5h.01'],
  chart: ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M22 20H2'],
  cap: ['M2 9l10-5 10 5-10 5-10-5Z', 'M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5', 'M22 9v6'],
  play: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'm10 8.5 5.5 3.5-5.5 3.5v-7Z'],
  flow: ['M5 3h5v5H5z', 'M14 16h5v5h-5z', 'M7.5 8v4a3 3 0 0 0 3 3h3.5'],
  folder: ['M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5v-12Z'],
  chat: ['M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.8A8 8 0 1 1 21 12Z', 'M8.5 12h.01', 'M12 12h.01', 'M15.5 12h.01'],
  lifebuoy: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z', 'm5.6 5.6 3.9 3.9', 'm14.5 14.5 3.9 3.9', 'm14.5 9.5 3.9-3.9', 'm5.6 18.4 3.9-3.9'],
  shield: ['M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Z', 'm9 12 2 2 4-4'],
  search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z', 'm20 20-4-4'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  chevron: ['m9 6 6 6-6 6'],
  arrow: ['M5 12h14', 'm13 6 6 6-6 6'],
  sparkle: ['M12 3v4', 'M12 17v4', 'M3 12h4', 'M17 12h4', 'm6 6 2.5 2.5', 'm15.5 15.5 2.5 2.5', 'm18 6-2.5 2.5', 'm8.5 15.5-2.5 2.5'],
  alert: ['M12 9v4', 'M12 17h.01', 'M10.3 4.3 2.6 17.6A2 2 0 0 0 4.3 20.6h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z'],
  check: ['m5 12.5 4.5 4.5L19 7.5'],
  refresh: ['M20 11a8 8 0 0 0-14.6-4.5L4 8', 'M4 4v4h4', 'M4 13a8 8 0 0 0 14.6 4.5L20 16', 'M20 20v-4h-4'],
  // Module icons, matching the Firebase-era Nexus workspace.
  target: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z', 'M12 12.01V12'],
  grid: ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h6v6h-6z'],
  bolt: ['m13 2-9 12h7l-2 8 9-12h-7l2-8Z'],
  cycle: ['M3 12a9 9 0 0 1 15-6.7L21 8', 'M21 3v5h-5', 'M21 12a9 9 0 0 1-15 6.7L3 16', 'M3 21v-5h5'],
  camera: ['M14.5 4h-5L8 6H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-4z', 'M12 15.7a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z'],
  signal: ['M5 12a7 7 0 0 1 14 0', 'M8.5 12a3.5 3.5 0 0 1 7 0', 'M12 13.4a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8Z'],
  pin: ['M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z', 'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  box: ['M21 8 12 3 3 8v8l9 5 9-5V8Z', 'm3 8 9 5 9-5', 'M12 13v8'],
  bars: ['M4 20v-5', 'M9 20V9', 'M14 20v-8', 'M19 20V6', 'M3 21h18'],
  bank: ['M3 21h18', 'M12 3 3 8h18L12 3Z', 'M5 10v8', 'M9.5 10v8', 'M14.5 10v8', 'M19 10v8'],
  cube: ['M21 8 12 3 3 8v8l9 5 9-5V8Z', 'm3 8 9 5 9-5', 'M12 13v8'],
  checkCircle: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'm8.5 12.5 2.5 2.5 4.5-5'],
  gear: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z', 'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z'],
  bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.9 1.9 0 0 0 3.4 0'],
  lock: ['M6 11h12v10H6z', 'M8.5 11V7.5a3.5 3.5 0 0 1 7 0V11'],
  external: ['M14 4h6v6', 'M20 4 10 14', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
  logout: ['M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4', 'M10 17l5-5-5-5', 'M15 12H4']
};

export function icon(name, label) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icon');
  if (label) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label); } else svg.setAttribute('aria-hidden', 'true');
  for (const d of PATHS[name] || PATHS.sparkle) {
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

export function toast(message, tone = 'info') {
  const region = document.getElementById('toasts');
  const el = h(`div.toast.${tone}`, {role: tone === 'error' ? 'alert' : 'status'}, icon(tone === 'error' ? 'alert' : 'check'), h('span', {}, message));
  region.append(el);
  setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 300); }, 4200);
}

export const formatNumber = (n, digits = 0) => new Intl.NumberFormat('en-ZA', {maximumFractionDigits: digits, minimumFractionDigits: digits}).format(n || 0);
export const formatRand = n => new Intl.NumberFormat('en-ZA', {style: 'currency', currency: 'ZAR', maximumFractionDigits: 0}).format(n || 0);
export const formatDate = value => new Intl.DateTimeFormat('en-ZA', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Johannesburg'}).format(new Date(value));
export const initials = name => String(name || '?').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('') || '?';
