'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const ExcelJS = require('../functions/node_modules/exceljs');
const Zip = require('../functions/node_modules/jszip');
const { worksheetCache, auditMtdCache } = require('./monthly-workbook-cache-audit.cjs');
const dir = path.resolve(__dirname, '../.tmp/salesforce-monthly-recovery-20260922');

async function main() {
  const originalFile = path.join(dir, 'verified-jn2KcttejPBxTuFwQks8-1790065293360.xlsx');
  const calculatedFile = path.join(dir, 'recalculated-local.xlsx');
  const original = new ExcelJS.Workbook(), calculated = new ExcelJS.Workbook();
  await original.xlsx.readFile(originalFile);
  await calculated.xlsx.readFile(calculatedFile);
  assert.deepEqual(calculated.worksheets.map(s => s.name), original.worksheets.map(s => s.name));
  const errors = book => {
    const result = [];
    for (const sheet of book.worksheets) sheet.eachRow(row => row.eachCell(cell => {
      const error = cell.value?.result?.error || cell.value?.error;
      if (error) result.push({ sheet: sheet.name, cell: cell.address, error });
    }));
    return result;
  };
  let checkedCells = 0;
  const semanticValue = cell => cell.formula ? { formula: cell.formula } : cell.value;
  for (const sheet of original.worksheets) {
    const next = calculated.getWorksheet(sheet.name), addresses = new Set();
    for (const current of [sheet, next]) current.eachRow(row => row.eachCell(cell => addresses.add(cell.address)));
    for (const address of addresses) {
      assert.deepEqual(semanticValue(next.getCell(address)), semanticValue(sheet.getCell(address)), sheet.name + '!' + address);
      checkedCells++;
    }
  }
  const zip = await Zip.loadAsync(await fs.readFile(calculatedFile));
  const formulaCache = auditMtdCache(await worksheetCache(zip, 'South Africa Visit Plan'), Array.from({ length: 3973 }, (_, i) => i + 2));
  assert.equal(formulaCache.verifiedRows, 3973);
  assert.equal(formulaCache.mismatches, 0);
  const beforeErrors = errors(original), afterErrors = errors(calculated);
  assert.deepEqual(afterErrors, beforeErrors, 'Recalculation changed the pre-existing formula error set');
  const result = { checkedAt: new Date().toISOString(), localOnly: true, uploaded: false, checkedCells, formulaCache, preExistingErrors: afterErrors };
  await fs.writeFile(path.join(dir, 'local-recalculation-verification.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, preExistingErrors: afterErrors.length }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
