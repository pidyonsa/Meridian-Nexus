'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { XMLParser } = require('../functions/node_modules/fast-xml-parser');
const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false });
const list = value => value === undefined ? [] : Array.isArray(value) ? value : [value];

function worksheetNumbers(xml) {
  const cells = new Map();
  for (const row of list(parser.parse(xml).worksheet?.sheetData?.row)) {
    for (const cell of list(row.c)) {
      const value = cell.v;
      // ExcelJS can omit zero-valued formula results. Read the XML cache itself.
      const numeric = (!cell['@_t'] || cell['@_t'] === 'n') &&
        value !== undefined && String(value).trim() !== '' && Number.isFinite(Number(value));
      if (numeric) cells.set(cell['@_r'], Number(value));
    }
  }
  return cells;
}

async function worksheetCache(zip, sheetName) {
  const workbook = parser.parse(await zip.file('xl/workbook.xml').async('string')).workbook;
  const sheet = list(workbook.sheets.sheet).find(item => item['@_name'] === sheetName);
  assert.ok(sheet, 'Monthly worksheet not found');
  const relationships = parser.parse(await zip.file('xl/_rels/workbook.xml.rels').async('string')).Relationships;
  const rel = list(relationships.Relationship).find(item => item['@_Id'] === sheet['@_id']);
  assert.ok(rel && rel['@_TargetMode'] !== 'External', 'Monthly worksheet relationship not found');
  const target = rel['@_Target'];
  const part = target.startsWith('/') ? target.slice(1) : path.posix.normalize(path.posix.join('xl', target));
  assert.ok(part.startsWith('xl/worksheets/') && zip.file(part), 'Invalid monthly worksheet part');
  return worksheetNumbers(await zip.file(part).async('string'));
}

function auditMtdCache(cells, rowNumbers) {
  const result = { rows: 0, verifiedRows: 0, missingTargetResults: 0, missingMtdResults: 0, targetTotal: 0, mtdTotal: 0, mismatches: 0 };
  for (const row of rowNumbers) {
    result.rows++;
    const target = cells.get('AF' + row), mtd = cells.get('AG' + row);
    if (target === undefined) result.missingTargetResults++;
    else result.targetTotal += target;
    if (mtd === undefined) result.missingMtdResults++;
    else result.mtdTotal += mtd;
    if (target === undefined || mtd === undefined) continue;
    result.verifiedRows++;
    const actual = ['AH', 'AI', 'AJ', 'AK', 'AL'].reduce((sum, col) => sum + (cells.get(col + row) || 0), 0);
    // The template caps MTD attendance at each row's target, unlike raw week totals.
    if (Math.abs(mtd - Math.min(actual, target)) > 1e-9) result.mismatches++;
  }
  return result;
}

module.exports = { worksheetNumbers, worksheetCache, auditMtdCache };
