'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {definitions,setupDocument,validateNoDuplicates}=require('../setup-dataorbis-sales.cjs');
const sha='a'.repeat(64);
test('Game and Makro/Jumbo are distinct editable portal connections without credentials',()=>{
  const [game,makro]=definitions.map(d=>setupDocument(d,sha));
  assert.equal(game.webAddress,'https://pyramid.dataorbis.com');assert.equal(makro.webAddress,game.webAddress);
  assert.deepEqual(game.salesProcedure.allowedBanners,['GAME']);assert.deepEqual(makro.salesProcedure.allowedBanners,['MAKRO','JUMBO']);
  assert.notEqual(game.salesProcedure.folder,makro.salesProcedure.folder);
  for(const value of [game,makro]) {
    assert.equal(value.username,'');assert.equal(value.password,undefined);
    assert.equal(value.extractionProfileId,undefined);assert.equal(value.steps,undefined);
    assert.equal(value.reportSchedule.enabled,false);assert.equal(value.salesProcedure.validated,false);
    assert.equal(value.salesProcedure.publicationEnabled,false);assert.equal(value.restoration.automaticPublication,false);
  }
});
test('preserves sales dimensions, value-excluding-VAT measure and blank template columns',()=>{
  const {salesProcedure:p}=setupDocument(definitions[0],sha);
  assert.deepEqual(p.rawDimensions,['Site Code','Site','Region','Category','Brand','Product']);
  assert.deepEqual(p.measures,['Sales Quantity','Sales Value Excl']);
  assert.equal(p.outputColumns.length,18);assert.equal(p.blankColumns.length,6);
  assert.deepEqual(p.outputColumns.slice(6,8),['CHAIN #','STORE #']);
  assert.deepEqual(p.outputColumns.slice(9,13),['RSM','DM','REP','MERCH']);
  assert.equal(p.periodPolicy,'previous-full-calendar-month');
});
test('recording example is not an approved supplier selection or a hard-coded reporting month',()=>{
  const {salesProcedure:p}=setupDocument(definitions[1],sha);
  assert.equal(p.exampleSupplier,'WILMAR SA (PTY) LTD');assert.equal(p.exampleClient,'WILMAR');
  assert.equal(p.supplierName,'');assert.equal(p.exampleIsNotConfiguredSupplier,true);
  assert.equal(p.reportStartDate,undefined);assert.equal(p.reportEndDate,undefined);
  assert.ok(p.rules.some(r=>r.includes('Never append')));
  assert.ok(p.rules.some(r=>r.includes('Unmapped or ambiguous')));
});
test('refuses duplicates and untraceable setup evidence',()=>{
  validateNoDuplicates([{id:'picknpay',name:'Pick n Pay Sales'}]);
  for(const profile of [{id:'game'},{id:'makro-old'},{id:'existing',webAddress:'https://pyramid.dataorbis.com'}])assert.throws(()=>validateNoDuplicates([profile]),/already exists/);
  assert.throws(()=>setupDocument(definitions[0],'missing'));
});
