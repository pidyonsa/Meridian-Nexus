'use strict';
const crypto=require('node:crypto');
const {AppError}=require('./errors.cjs');
const {enrich,day}=require('./imports.cjs');
const BASES=['https://meridian.georep.com/api_gateway/','https://meridian.georep.com/openapi/'];
class GeoClient {
  constructor(env=process.env,fetcher=fetch) {this.id=env.GEO_REP_OPEN_API_ID;this.key=env.GEO_REP_OPEN_API_KEY;this.fetch=fetcher;}
  async get(path,parameters={}) {
    if(!this.id || !this.key || this.key.startsWith('@Microsoft.')) throw new AppError('failed-precondition','Geo Rep API credentials are not configured in Key Vault.');
    for(const base of BASES) {
      const url=new URL(path,base);
      for(const [key,value] of Object.entries(parameters)) url.searchParams.set(key,String(value));
      for(let attempt=0;attempt<3;attempt++) {
        let response;
        try {response=await this.fetch(url,{headers:{Accept:'application/json','Client-Api-Id':this.id,'Client-Api-Key':this.key},redirect:'error',signal:AbortSignal.timeout(90000)});} catch {
          if(attempt<2) {await new Promise(r=>setTimeout(r,1500*(attempt+1)));continue;}
          throw new AppError('unavailable','Geo Rep request timed out or failed. No partial data was published.');
        }
        if([404,444].includes(response.status)) break;
        if([429,500,502,503,504].includes(response.status) && attempt<2) {await new Promise(r=>setTimeout(r,2000*(attempt+1)));continue;}
        if(!response.ok) throw new AppError('unavailable',`Geo Rep returned HTTP ${response.status}. No partial data was published.`);
        const raw=await response.text();
        if(Buffer.byteLength(raw)>32*1024*1024) throw new AppError('resource-exhausted','Geo Rep response exceeded 32 MB.');
        let data;try{data=JSON.parse(raw);}catch{throw new AppError('unavailable','Geo Rep returned invalid JSON.');}
        if(data.status && String(data.status).toLowerCase()!=='success') throw new AppError('unavailable','Geo Rep reported an unsuccessful request.');
        return data;
      }
    }
    throw new AppError('unavailable','Geo Rep rejected both configured API routes. Confirm Meridian Open API access with Geo Rep.');
  }
  async all(path,field,parameters={}) {
    const first=await this.get(path,{...parameters,page:0});
    const total=Number(first.total_pages);
    if(!Number.isSafeInteger(total) || total<0 || total>10000 || !Array.isArray(first[field])) throw new AppError('unavailable',`Geo Rep ${field} pagination contract is incomplete. Publication stopped.`);
    const rows=[...first[field]], seen=new Set();
    function check(payload,page) {
      if(!Array.isArray(payload[field]) || Number(payload.total_pages)!==total) throw new AppError('unavailable','Geo Rep pages changed during extraction. Retry the complete import.');
      if(page>0 && !payload[field].length) throw new AppError('unavailable','Geo Rep returned an empty intermediate page.');
      const hash=crypto.createHash('sha256').update(JSON.stringify(payload[field])).digest('hex');
      if(seen.has(hash) && payload[field].length) throw new AppError('unavailable','Geo Rep returned a repeated page.');
      seen.add(hash);
    }
    check(first,0);
    for(let page=1;page<total;page++) {const payload=await this.get(path,{...parameters,page});check(payload,page);rows.push(...payload[field]);if(rows.length>100000)throw new AppError('resource-exhausted','Geo Rep import exceeds 100,000 records.');}
    return rows;
  }
}
function get(source,names,depth=0) {
  if(!source || typeof source!=='object' || depth>3) return '';
  for(const name of names) if(source[name]!==undefined && source[name]!==null && source[name]!=='') return source[name];
  for(const value of Object.values(source)) if(value && typeof value==='object' && !Array.isArray(value)) {const found=get(value,names,depth+1);if(found!=='')return found;}
  return '';
}
const str=(r,n)=>String(get(r,n)).trim().slice(0,500);
function numeric(r,n) {const v=get(r,n);if(v==='' || typeof v==='object')return null;const parsed=Number(String(v).replace(/[ ,]/g,''));return Number.isFinite(parsed)?parsed:null;}
function orderRows(epod,details,users,period) {
  const merged={...epod,...details,status:String(details.status).toLowerCase()==='success'?epod.status:details.status || epod.status};
  const orderNumber=str(merged,['epod_number','transaction_number','order_number','order_no','reference','epod_id']);
  const products=(details.submissions || []).flatMap(s=>(s.products || []).map(p=>({...p,submissionDate:s.submission_date})));
  const lines=products.length?products:Array.isArray(details.products)?details.products:Array.isArray(epod.products)?epod.products:[];
  if(!lines.length || !orderNumber) throw new AppError('unavailable','An order has no identifiable product lines. Publication stopped.');
  return lines.map((p,index)=>{
    const rawDate=str(p,['submissionDate']) || str(merged,['completed_datetime_utc','completed_date_timezone','submission_date','expected_delivery_date','schedule_date','added_date_utc','timestamp_utc','date','order_date']);
    // Preserve source date fields; do not manufacture an order date from the import date.
    const orderDate=day(rawDate.slice(0,10));
    if(!orderDate || orderDate.slice(0,7)!==period) throw new AppError('unavailable','An order date is missing or outside the requested month. Publication stopped for review.');
    const quantity=numeric(p,['qty','quantity','order_quantity','units']),unitPrice=numeric(p,['unit_price','price','selling_price']);
    const explicit=numeric(p,['total','total_value','line_total','amount','value']);
    const value=explicit ?? (quantity!==null && unitPrice!==null?quantity*unitPrice:null);
    const epodId=str(merged,['epod_id']);
    return {id:crypto.createHash('sha256').update(JSON.stringify([epodId||orderNumber,index])).digest('hex'),epodId,orderNumber,orderDate,storeCode:str(merged,['location_id','customer_code','store_code','diplomat_customer_no']),storeName:str(merged,['location_name','customer_name','store_name','customer']),sku:str(p,['sku_code','product_sku_code','sku','item_code','stock_code']),product:str(p,['product_name','product','item_description','sku_description']),quantity,unitPrice,value,currency:str(p,['currency','currency_code'])||str(merged,['currency','currency_code']),rep:str(merged,['assigned_user_name','user_name','rep','representative'])||users.get(str(merged,['assigned_user_id','user_id']))||'',manager:str(merged,['manager','line_manager']),status:str(merged,['status','delivery_status'])||'Unspecified',poNumber:str(merged,['po_number','purchase_order']),client:str(merged,['client','client_name','customer_group']),channel:str(merged,['channel','channel_name','retail_channel']),brand:str(p,['brand','brand_name']),category:str(p,['category','category_name','product_category']),sourceSystem:'geo-rep-open-api',importedAt:new Date().toISOString()};
  });
}
async function syncOrders(store,client,period) {
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new AppError('invalid-argument','Invalid order month.');
  const last=new Date(Date.UTC(Number(period.slice(0,4)),Number(period.slice(5)),0)).toISOString().slice(0,10);
  const users=new Map((await client.all('openapis/fetch-users','users')).map(u=>[String(u.user_id),str(u,['user_name','name'])||[u.first_name,u.surname].filter(Boolean).join(' ')]));
  const epods=await client.all('openapis/epods/epods','epods',{added_date_start:`${period}-01T00:00:00`,added_date_end:`${last}T23:59:59`});
  if(!epods.length) return {status:'no-data',period,message:'Existing data was retained.'};
  const rows=[],seen=new Set();
  for(const epod of epods) {
    if(!epod.epod_id || seen.has(String(epod.epod_id))) throw new AppError('unavailable','Geo Rep returned a missing or duplicate EPOD identifier.');
    seen.add(String(epod.epod_id));
    const details=await client.get('openapis/epods/epod-details',{epod_id:epod.epod_id});
    rows.push(...orderRows(epod,details,users,period));
  }
  const master=await store.read('stores','2000-01');
  if(!master) throw new AppError('failed-precondition','Load the store master before importing Geo orders.');
  const result=await store.publish('orders',period,enrich(rows,master.rows),{source:'Geo Rep Open API EPOD details',orderHeaders:epods.length,storeMasterVersion:master.version});
  return {status:'completed',period,count:result.count,version:result.version};
}
module.exports={GeoClient,orderRows,syncOrders};
