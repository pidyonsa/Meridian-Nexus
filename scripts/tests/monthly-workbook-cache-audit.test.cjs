'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { worksheetNumbers, auditMtdCache } = require('../monthly-workbook-cache-audit.cjs');

test('formula cache distinguishes numeric zero from absent, empty and error results', () => {
  const cells = worksheetNumbers('<worksheet><sheetData><row r="2">' +
    '<c r="AF2"><f>SUM(AA2:AE2)</f><v>0</v></c>' +
    '<c r="AG2"><f>MIN(AF2,AH2)</f></c>' +
    '<c r="AH2"><f>1/0</f><v></v></c>' +
    '<c r="AI2" t="e"><f>1/0</f><v>#DIV/0!</v></c>' +
    '<c r="AJ2" t="s"><v>123</v></c>' +
    '</row></sheetData></worksheet>');
  assert.equal(cells.get('AF2'), 0);
  for (const cell of ['AG2', 'AH2', 'AI2', 'AJ2']) assert.equal(cells.has(cell), false);
});

test('MTD audit checks the target cap and never treats missing results as zero', () => {
  const cells = new Map([['AF2', 2], ['AG2', 2], ['AH2', 3], ['AI2', 1],
    ['AF3', 0], ['AG3', 0], ['AH3', 2], ['AF4', 5], ['AH4', 1]]);
  const result = auditMtdCache(cells, [2, 3, 4]);
  assert.equal(result.verifiedRows, 2);
  assert.equal(result.missingMtdResults, 1);
  assert.equal(result.mismatches, 0);
  cells.set('AG4', 0);
  assert.equal(auditMtdCache(cells, [2, 3, 4]).mismatches, 1);
});
