'use strict';
// Loads a client gap workbook into Azure SQL with the same checks and replace-by-week rules as the Nexus upload page
// (for initial loads and support). Prints the preview first; --apply saves.
//   SQL_SERVER=... SQL_DATABASE=... node scripts/load-gap-report.cjs <client> <file.xlsx> <uploaded by> [--apply]
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {pool, close} = require('../server/db.cjs');
const {parseWorkbook, summarise} = require('../server/gap/parse.cjs');
const {sqlGapStore} = require('../server/gap/store.cjs');

async function main() {
  const [client, file, uploadedBy] = process.argv.slice(2).filter(a => !a.startsWith('--'));
  if (!client || !file || !uploadedBy) throw new Error('Usage: load-gap-report.cjs <client> <file.xlsx> <uploaded by> [--apply]');
  const buffer = fs.readFileSync(file);
  const parsed = await parseWorkbook(buffer);
  const store = sqlGapStore(() => pool());
  if (!(await store.clients()).some(c => c.id === client)) throw new Error('Unknown client: ' + client + ' (add it in Nexus first).');
  const existing = new Set((await store.existingWeeks(client)).map(w => `${w.banner}|${w.week}`));
  const summary = summarise(parsed);
  for (const b of summary.banners) for (const w of b.weeks) w.action = existing.has(`${b.banner}|${w.week}`) ? 'replace' : 'new';
  for (const b of summary.banners) for (const w of b.weeks) console.log(`${w.action.padEnd(8)} ${b.banner.padEnd(20)} ${w.week}  stores ${w.stores}  no gap ${w.noGap}  opportunity ${w.opportunity}  lost ${w.lost}`);
  for (const w of summary.warnings) console.log(`warning  ${w}`);
  if (!process.argv.includes('--apply')) { console.log('dry run: nothing saved (add --apply)'); return; }
  const saved = await store.save({client, fileName: path.basename(file), sha256: crypto.createHash('sha256').update(buffer).digest('hex'), uploadedBy, parsed, summary});
  console.log(JSON.stringify({saved: true, ...saved}));
}

main().then(close, async error => { console.error(error.message); await close(); process.exitCode = 1; });
