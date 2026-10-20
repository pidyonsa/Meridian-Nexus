'use strict';
// Meridian Nexus landing page (/). Every Meridian account gets the dashboards; Nexus.Admin also gets every
// workspace of the full Nexus portal (served at /nexus/, still on its Firebase data and Nexus sign-in).
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));

const DASHBOARDS = [
  {href: '/attendance/rep/overview', title: 'Syndicated Attendance: Reps', text: 'Strike rate, daily visits, roster and stores for reps.'},
  {href: '/attendance/merchandiser/overview', title: 'Syndicated Attendance: Merchandisers', text: 'Strike rate, daily visits, roster and stores for merchandisers.'},
  {href: '/franchise-orders/overview', title: 'Franchise Orders', text: 'Orders by trend, region, product, store and rep.'}
];
// The full Nexus portal's workspaces (its own #links).
const NEXUS = [
  ['home', 'Overview', 'Nexus home and operational signals.'],
  ['sales', 'Sales dashboard', 'Geo Rep sales transactions.'],
  ['insights', 'Sales Insights', 'Sell-out insights by client, brand and region.'],
  ['attendance', 'Time & Attendance', 'Geo and Salesforce attendance workspace.'],
  ['callcycle', 'Call Cycle', 'Call cycle coverage.'],
  ['attendance-jobs', 'Attendance jobs', 'Attendance job summaries.'],
  ['stockfix', 'Stock Fix', 'Stock Fix performance and adoption.'],
  ['training', 'Training hub', 'Training content and progress.'],
  ['automation', 'Report automation', 'Retailer downloads, schedules and runs.'],
  ['etls', 'ETLs', 'Sales and inventory ETL uploads.'],
  ['franchiseorder', 'Franchise orders workspace', 'Franchise order capture and drilldowns.'],
  ['resources', 'Resources', 'Shared files and references.'],
  ['chat', 'Chat', 'Meridian chat.'],
  ['support', 'Support', 'Support requests.'],
  ['admin', 'Admin', 'Users, retailers, schedules and settings.']
];

function tile({href, title, text}) {
  return `<a class="tile" href="${esc(href)}"><strong>${esc(title)}</strong><span>${esc(text)}</span></a>`;
}

function renderLanding(user) {
  const admin = Boolean(user?.admin);
  const nexus = admin ? `<section aria-labelledby="nexus-title">
      <h2 id="nexus-title">Full Nexus</h2>
      <p class="note">The complete Nexus workspace. It still uses its Firebase data, so sign in with your Nexus account the first time you open it.</p>
      <div class="grid">${NEXUS.map(([hash, title, text]) => tile({href: `/nexus/#${hash}`, title, text})).join('')}</div>
    </section>` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Meridian Nexus</title>
<link rel="icon" href="/assets/meridian-mark.png">
<style>
  :root { --ink: #14213d; --muted: #5b6475; --line: #dde3ec; --card: #ffffff; --page: #f4f6fa; --accent: #c8102e; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Segoe UI", system-ui, -apple-system, sans-serif; color: var(--ink); background: var(--page); }
  header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 24px; background: var(--card); border-bottom: 1px solid var(--line); }
  .brand { display: flex; align-items: center; gap: 10px; font-size: 18px; color: var(--ink); text-decoration: none; }
  .brand img { width: 32px; height: 32px; }
  .account { display: flex; align-items: center; gap: 14px; font-size: 14px; color: var(--muted); }
  .account a { color: var(--accent); font-weight: 600; text-decoration: none; }
  main { max-width: 1120px; margin: 0 auto; padding: 28px 24px 48px; }
  h1 { margin: 0 0 4px; font-size: 26px; }
  h2 { margin: 32px 0 6px; font-size: 18px; }
  .note { margin: 0 0 14px; color: var(--muted); font-size: 14px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
  .tile { display: flex; flex-direction: column; gap: 6px; padding: 16px 18px; background: var(--card); border: 1px solid var(--line); border-radius: 10px; color: var(--ink); text-decoration: none; }
  .tile:hover, .tile:focus-visible { border-color: var(--accent); outline: none; box-shadow: 0 2px 10px rgba(20, 33, 61, .08); }
  .tile strong { font-size: 15px; }
  .tile span { color: var(--muted); font-size: 13px; line-height: 1.4; }
  footer { max-width: 1120px; margin: 0 auto; padding: 0 24px 32px; }
  footer img { height: 28px; opacity: .8; }
  @media (max-width: 600px) { header { padding: 12px 16px; } main { padding: 20px 16px 36px; } .account span { display: none; } }
</style>
</head>
<body>
<header>
  <a class="brand" href="/"><img src="/assets/meridian-mark.png" alt=""><span>Meridian <b>Nexus</b></span></a>
  <div class="account"><span>${esc(user?.name)}</span><a href="/.auth/logout?post_logout_redirect_uri=/">Sign out</a></div>
</header>
<main>
  <h1>Meridian Nexus</h1>
  <p class="note">Signed in with your Meridian Microsoft account.</p>
  <section aria-labelledby="dashboards-title">
    <h2 id="dashboards-title">Dashboards</h2>
    <div class="grid">${DASHBOARDS.map(tile).join('')}</div>
  </section>
  ${nexus}
</main>
<footer><img src="/assets/meridian-logo.png" alt="Meridian Group"></footer>
</body>
</html>`;
}

module.exports = {renderLanding, NEXUS};
