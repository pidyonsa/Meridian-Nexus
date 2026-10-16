const ExcelJS = require('../functions/node_modules/exceljs');
const crypto = require('node:crypto');
const fs = require('node:fs');
const text = cell => String(cell.text || '').trim().replace(/\s+/g, ' ');
async function readHierarchy(file) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const sheet = workbook.getWorksheet('Organogram');
  if (!sheet || text(sheet.getCell('A1')) !== 'Division' || text(sheet.getCell('G1')) !== 'Reps') throw new Error('Unexpected hierarchy workbook headers');
  const rows = [], access = [], duplicates = [], seen = new Set();
  sheet.eachRow((row, number) => {
    if (number === 1) return;
    const [division, region, head, generalManager, regionalManager, manager, rep, dedicatedRep] = Array.from({length: 8}, (_, i) => text(row.getCell(i + 1)));
    for (const [name, assignment] of [[rep, 'syndicated'], [dedicatedRep, 'dedicated']]) {
      if (!name) continue;
      const record = { division: division.toUpperCase(), region, head, generalManager, regionalManager, manager, name, assignment };
      const key = JSON.stringify(record).toUpperCase();
      if (seen.has(key)) { duplicates.push({ row: number, name }); continue; }
      seen.add(key); rows.push({ ...record, sourceRow: number });
    }
  });
  workbook.getWorksheet('NEXUS ACCESS')?.eachRow((row, number) => {
    if (number === 1) return;
    const name = text(row.getCell(1)), title = text(row.getCell(2)), email = text(row.getCell(3)).toLowerCase();
    if (!/^[^\s@]+@meridiangroup\.co\.za$/.test(email)) throw new Error(`Invalid staff email on access row ${number}`);
    access.push({ name, title, email });
  });
  return { sourceName: 'National Reporting Hierarchy.xlsx', sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), rows, access, duplicates };
}
module.exports = { readHierarchy };
