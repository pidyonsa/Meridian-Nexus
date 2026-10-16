'use strict';
const crypto=require('node:crypto');
const RESOURCE_ID='orderRegions';
const text=value=>String(value??'').normalize('NFKC').trim().replace(/\s+/g,' ');
const key=value=>text(value).toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const missing=value=>!text(value)||['UNMAPPED','UNASSIGNED','NOT SUPPLIED','NOT SET','-'].includes(text(value).toUpperCase());
const canonical=value=>({'KWAZULU NATAL':'KwaZulu Natal','KZN':'KwaZulu Natal','WESTERN CAPE':'Western Cape','NORTH WEST':'North West','FREE STATE':'Free State','EAST LONDON':'East London','PORT ELIZABETH':'Port Elizabeth','GAUTENG':'Gauteng','LIMPOPO':'Limpopo','MPUMALANGA':'Mpumalanga','SWD':'SWD'}[key(value)]||text(value));
const digest=regions=>crypto.createHash('sha256').update(JSON.stringify(Object.entries(regions).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([name,values])=>[name,[...values].sort()]))).digest('hex');
function compile(entries){
  const names=new Map();
  for(const row of entries){
    const name=key(row.storeName),region=canonical(row.region);
    if(!name||missing(region))continue;
    if(!names.has(name))names.set(name,new Set());
    names.get(name).add(region);
  }
  const regions=Object.fromEntries([...names].sort(([a],[b])=>a.localeCompare(b)).map(([name,values])=>[name,[...values].sort()]));
  return {regions,version:digest(regions)};
}
function index(resource){
  const regions=resource?.regions;
  if(!regions||Array.isArray(regions)||typeof regions!=='object'||!Object.keys(regions).length||Object.keys(regions).length>15000)throw Error('Invalid store-region resource.');
  for(const [name,values]of Object.entries(regions)){
    if(!name||name!==key(name)||name.length>500||!Array.isArray(values)||!values.length||values.length>20||values.some(r=>typeof r!=='string'||missing(r)||r.length>120))throw Error('Invalid store-region entry.');
  }
  if(resource.version!==digest(regions))throw Error('Store-region resource checksum mismatch.');
  return {version:resource.version,names:new Map(Object.entries(regions)),sourceName:text(resource.sourceName)};
}
function enrich(rows,catalog){
  return rows.map(row=>{
    if(!missing(row.region))return row;
    // Customer numbers in Geo transactions are free text, not reliable master keys.
    // Only an exact normalized store name with one region can fill a missing region.
    const matches=catalog.names.get(key(row.storeName));
    if(matches?.length!==1)return row;
    return {...row,sourceRegion:row.region,region:matches[0],mapped:true,regionMatch:'exact-store-name',regionMappingVersion:catalog.version};
  });
}
async function parseMaster(bytes,ExcelJS){
  const book=new ExcelJS.Workbook();await book.xlsx.load(bytes);
  const sheet=book.getWorksheet('Call Cycle Master');
  if(!sheet||sheet.rowCount>30001)throw Error('Expected a bounded Call Cycle Master worksheet.');
  const cell=value=>value&&typeof value==='object'?value.result??value.text??value.richText?.map(r=>r.text).join('')??'':value;
  const headers=sheet.getRow(1).values.slice(1).map(v=>key(cell(v)));
  const name=headers.indexOf('STORE NAME')+1,region=headers.indexOf('REGION')+1;
  if(!name||!region)throw Error('Store Name and Region columns are required.');
  const entries=[];
  sheet.eachRow((row,n)=>{if(n>1)entries.push({storeName:text(cell(row.getCell(name).value)),region:text(cell(row.getCell(region).value))});});
  return entries;
}
module.exports={RESOURCE_ID,key,missing,compile,index,enrich,parseMaster};
