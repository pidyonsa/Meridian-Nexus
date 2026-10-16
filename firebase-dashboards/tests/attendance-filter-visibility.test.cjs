'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const acorn=require('acorn');
const code=fs.readFileSync(path.resolve(__dirname,'../public/viewer.js'),'utf8');
const tree=acorn.parse(code,{ecmaVersion:'latest'});
const filter=tree.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='filterBar');
const escape=tree.body.find(n=>n.type==='VariableDeclaration'&&n.declarations.some(d=>d.id.name==='esc'));
function render(availableFilters,filters={}){
  return vm.runInNewContext(code.slice(escape.start,escape.end)+'\n'+code.slice(filter.start,filter.end)+'\nfilterBar(data)',{attendanceState:{filters},data:{availableFilters,reportStartDate:'2026-09-01',reportEndDate:'2026-09-13'}});
}
test('attendance omits Banner for a missing or empty source field',()=>{
  for(const available of [{},{banners:[]}])assert.doesNotMatch(render(available),/select name="banner"/);
  assert.match(render({banners:[]}),/select name="channel"/,'Unrelated fields stay unchanged');
});
test('attendance retains a populated Banner filter and its selection',()=>{
  const html=render({banners:['Test Retailer']},{banner:'Test Retailer'});
  assert.match(html,/select name="banner"/);assert.match(html,/<option value="Test Retailer" selected>/);
});
