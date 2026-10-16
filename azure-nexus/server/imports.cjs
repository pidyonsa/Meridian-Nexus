'use strict';
const crypto=require('node:crypto');
const ExcelJS=require('exceljs');
const {AppError}=require('./errors.cjs');
const key=v=>String(v??'').normalize('NFKC').replace(/[^a-z0-9]/gi,'').toUpperCase();
const text=v=>String(v??'').trim();
function value(cell) {
  const v=cell.value;
  if(v instanceof Date) return v.toISOString().slice(0,10);
  if(v && typeof v==='object') {
    if(v.formula || v.sharedFormula) return v.result ?? '';
    if(v.richText) return v.richText.map(t=>t.text).join('');
    return v.text ?? '';
  }
  return v ?? '';
}
function day(v) {
  let s=text(v);
  if(typeof v==='number' && v>20000 && v<100000) s=new Date(Date.UTC(1899,11,30)+Math.floor(v)*86400000).toISOString().slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const d=new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10)===s ? s : '';
}
function pick(row,names) { for(const n of names) if(row[key(n)]!==undefined && row[key(n)]!=='') return row[key(n)]; return ''; }
function group(role) { const r=key(role); return r.includes('MERCH')?'merchandiser':/SALESREP|TEAMLEADER/.test(r)?'rep':''; }
function operationalWeek(date) {
  const days=Math.floor((Date.parse(`${date}T00:00:00Z`)-Date.UTC(2026,3,27))/86400000);
  return `Week ${(((Math.floor(days/7)+1)%4)+4)%4+1}`;
}
async function workbookTables(bytes) {
  if(!Buffer.isBuffer(bytes) || bytes.length<4 || bytes.length>8*1024*1024 || bytes.readUInt16LE(0)!==0x4b50) throw new AppError('invalid-argument','Upload an XLSX workbook under 8 MB.');
  await inspectZip(bytes);
  const workbook=new ExcelJS.Workbook();
  try {await workbook.xlsx.load(bytes);} catch {throw new AppError('invalid-argument','The workbook could not be read.');}
  return workbook.worksheets;
}
async function inspectZip(bytes) {
  const yauzl=require('yauzl');
  await new Promise((resolve,reject)=>yauzl.fromBuffer(bytes,{lazyEntries:true},(err,zip)=>{
    if(err) return reject(new AppError('invalid-argument','Invalid XLSX archive.'));
    let total=0,count=0;
    zip.on('error',()=>reject(new AppError('invalid-argument','Invalid XLSX archive.')));
    zip.on('entry',entry=>{
      total+=entry.uncompressedSize; count++;
      if(total>100*1024*1024 || count>10000) {zip.close();reject(new AppError('resource-exhausted','The expanded workbook is too large.'));return;}
      zip.readEntry();
    });
    zip.on('end',resolve);zip.readEntry();
  }));
}
function readTable(sheet,required) {
  for(let r=1;r<=Math.min(15,sheet.rowCount);r++) {
    const headers=sheet.getRow(r).values.slice(1).map(v=>key(v?.result ?? v));
    if(!required.every(aliases=>aliases.some(n=>headers.includes(key(n))))) continue;
    const rows=[];
    if(sheet.rowCount>100015) throw new AppError('resource-exhausted','Workbook exceeds 100,000 rows.');
    for(let i=r+1;i<=sheet.rowCount;i++) {
      const row={};headers.forEach((h,c)=>{if(h)row[h]=value(sheet.getRow(i).getCell(c+1));});
      if(Object.values(row).some(v=>v!=='')) rows.push({...row,_row:i});
    }
    return rows;
  }
  return null;
}
function enrich(rows,master=[]) {
  const codes=new Map(),names=new Map();
  for(const s of master) {
    for(const [map,k] of [[codes,key(s.storeCode)],[names,key(s.storeName)]]) {
      if(!k) continue;
      if(map.has(k) && JSON.stringify(map.get(k))!==JSON.stringify(s)) throw new AppError('failed-precondition',`Ambiguous store master key: ${k}.`);
      map.set(k,s);
    }
  }
  return rows.map(row=>{
    const matched=codes.get(key(row.storeCode)) || names.get(key(row.storeName || row.customer));
    return {...row,region:row.region || matched?.region || 'Unassigned',rep:row.rep || matched?.rep || '',manager:row.manager || matched?.manager || '',banner:row.banner || matched?.banner || '',channel:row.channel || matched?.channel || '',client:row.client || matched?.client || '',storeCode:row.storeCode || matched?.storeCode || '',mapped:!!matched};
  });
}
async function parseAttendance(bytes,audience,period,master=[]) {
  if(!['rep','merchandiser'].includes(audience) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new AppError('invalid-argument','Choose an audience and month.');
  const sheets=await workbookTables(bytes), candidates=[];
  for(const sheet of sheets) {
    const table=readTable(sheet,[['Schedule Date'],['Rep Name','User Name'],['Customer Name','Store Name','Customer'],['Result'],['Role']]);
    if(table) candidates.push({name:sheet.name,table});
  }
  const selected=candidates.length===1?candidates[0]:candidates.find(t=>key(t.name)==='SCHEDULES');
  if(!selected) throw new AppError('invalid-argument','A detailed Schedules sheet is required, with Schedule Date, Rep Name, Customer Name, Role and Result. Summary/check-in-only reports cannot establish missed visits.');
  const rows=[]; let invalid=0,otherAudience=0,outsideMonth=0;
  for(const r of selected.table) {
    const role=text(pick(r,['Role']));
    if(group(role)!==audience) {otherAudience++;continue;}
    const date=day(pick(r,['Schedule Date']));
    if(!date) {invalid++;continue;}
    if(date.slice(0,7)!==period) {outsideMonth++;continue;}
    rows.push({id:`${selected.name}:${r._row}`,date,week:text(pick(r,['GeoRep Week'])) || operationalWeek(date),userName:text(pick(r,['Rep Name','User Name'])),userCode:text(pick(r,['User Code'])),manager:text(pick(r,['Manager'])),rep:text(pick(r,['Rep'])),role,region:text(pick(r,['Assigned Region(s)','Region'])),storeCode:text(pick(r,['Geo Rep Store Code','Store Code','Customer Code','Customer No','Diplomat Customer no','Diplomat Store Code'])),customer:text(pick(r,['Customer Name','Store Name','Customer'])),result:text(pick(r,['Result']))});
  }
  if(invalid) throw new AppError('invalid-argument',`${invalid} schedule dates could not be parsed; nothing has been published.`);
  if(!rows.length) throw new AppError('invalid-argument','No matching scheduled rows in this workbook; existing data is unchanged.');
  const sourceRows=[];
  for(const sheet of sheets) {
    const table=readTable(sheet,[['User Name'],['Schedule Count (w/o Leave)'],['On Schedule Checkins'],['Role']]);
    if(table) for(const r of table.filter(r=>group(pick(r,['Role']))===audience)) sourceRows.push({userName:text(pick(r,['User Name'])),userCode:text(pick(r,['User Code'])),manager:text(pick(r,['Manager'])),role:text(pick(r,['Role'])),region:text(pick(r,['Assigned Region(s)','Region'])),scheduled:Number(pick(r,['Schedule Count (w/o Leave)']))||0,onSchedule:Number(pick(r,['On Schedule Checkins']))||0});
  }
  return {rows:enrich(rows,master),metadata:{sourceRows,source:'Geo Rep Schedules workbook',sourceSheet:selected.name,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),reportEndDate:rows.map(r=>r.date).sort().at(-1),outsideMonth,otherAudience}};
}
module.exports={parseAttendance,enrich,day,group,operationalWeek,workbookTables,readTable,pick,key};
