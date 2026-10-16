'use strict';
const crypto=require('node:crypto');
const key=v=>String(v??'').trim().replace(/[^a-z0-9]/gi,'').toLowerCase();
function cell(v){if(v instanceof Date)return v.toISOString();if(v&&typeof v==='object')return v.result??v.text??v.richText?.map(r=>r.text).join('')??'';return v??'';}
const fields={orderDate:['Date','Order Date','Transaction Date'],orderNumber:['Transaction Number','Order Number','Order No'],storeCode:['Diplomat Customer no','Store Code','Customer Code'],storeName:['Customer Name','Store Name'],sku:['Product SKU Code','SKU','Item Code'],product:['Product Name','Product','Item Description'],quantity:['Quantity','Qty','Units'],value:['Total','Line Total','Amount'],unitPrice:['Unit Price','Price'],brand:['Brand','Brands','Brand Name'],banner:['Banner'],rep:['User','Rep','Sales Rep'],manager:['Manager','Line Manager'],status:['Status'],poNumber:['PO Number','Purchase Order'],region:['Region','Province','Assigned Region(s)'],client:['Client','Client Name'],channel:['Channel','Channel Name'],category:['Category','Product Category'],currency:['Currency','Currency Code']};
const numeric=v=>{if(v===''||v===null||v===undefined)return null;const n=Number(String(v).replace(/[ ,]/g,''));return Number.isFinite(n)?n:null;};
function date(v){const text=String(v).trim().slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(text))return '';const d=new Date(text+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===text?text:'';}
async function parseOrders(bytes,{ExcelJS,range,importedAt,sha256=crypto.createHash('sha256').update(bytes).digest('hex')}){
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(bytes);
  const sheet=workbook.worksheets.find(s=>key(s.name)==='orderdetails');if(!sheet)throw Error('Order Details worksheet is required.');
  const headers=sheet.getRow(1).values.slice(1).map(cell),indices=Object.fromEntries(Object.entries(fields).map(([field,aliases])=>[field,aliases.map(a=>headers.findIndex(h=>key(h)===key(a))).find(i=>i>=0)??-1]));
  for(const field of ['orderDate','orderNumber','storeName','product','quantity','value'])if(indices[field]<0)throw Error('Missing required order column: '+field);
  const rows=[];let invalid=0,skippedBlankZero=0;
  for(let i=2;i<=sheet.rowCount;i++){
    const source=sheet.getRow(i);if(!source.hasValues)continue;
    const r=Object.fromEntries(Object.entries(indices).map(([field,column])=>[field,column<0?'':cell(source.getCell(column+1).value)]));
    if(!r.orderNumber&&!r.product&&!r.storeName)continue;
    // Geo Rep occasionally records an R0 line with no product; it carries no order value, so skip and count it.
    if(!String(r.product).trim()&&numeric(r.value)===0){skippedBlankZero++;continue;}
    r.orderDate=date(r.orderDate);
    if(!r.orderDate||r.orderDate<range.startDate||r.orderDate>range.endDate||!r.orderNumber||!r.storeName||!r.product){invalid++;continue;}
    r.quantity=numeric(r.quantity);r.value=numeric(r.value);r.unitPrice=numeric(r.unitPrice);
    const subtotalIndex=headers.findIndex(h=>key(h)==='subtotal');
    if(r.unitPrice===null&&r.quantity){const subtotal=subtotalIndex<0?null:numeric(cell(source.getCell(subtotalIndex+1).value));if(subtotal!==null)r.unitPrice=subtotal/r.quantity;}
    for(const field of Object.keys(r))if(!['quantity','value','unitPrice'].includes(field))r[field]=String(r[field]).trim().slice(0,500);
    rows.push({...r,id:crypto.createHash('sha256').update(`${sha256}:Order Details:${i}`).digest('hex'),periodKey:r.orderDate.slice(0,7),importedAt,sourceSystem:'geo-rep-transaction-workbook',mapped:!!r.region,sourceRow:i});
  }
  if(invalid)throw Error(`${invalid} order lines have missing identity or dates outside the requested period; publication stopped.`);
  if(!rows.length||rows.length>30000)throw Error('Order report must contain between 1 and 30,000 lines.');
  const summary=workbook.worksheets.find(s=>key(s.name)==='ordersummary'),summaryRows=[];
  if(summary){const h=summary.getRow(1).values.slice(1).map(cell),total=h.findIndex(v=>key(v)==='total'),order=h.findIndex(v=>key(v)==='transactionnumber');
    if(total>=0&&order>=0)for(let i=2;i<=summary.rowCount;i++){const r=summary.getRow(i);if(cell(r.getCell(order+1).value))summaryRows.push(numeric(cell(r.getCell(total+1).value)));}}
  const detailTotal=rows.every(r=>r.value!==null)?Math.round(rows.reduce((n,r)=>n+r.value,0)*100)/100:null;
  const summaryTotal=summaryRows.length&&summaryRows.every(v=>v!==null)?Math.round(summaryRows.reduce((n,v)=>n+v,0)*100)/100:null;
  const summaryDifference=summaryTotal!==null&&detailTotal!==null?Math.round((detailTotal-summaryTotal)*100)/100:null;
  return {rows,metadata:{range,importedAt,sha256,headers,source:'Geo Rep Transactions Report',rowCount:rows.length,brandColumn:indices.brand<0?null:headers[indices.brand],brandRows:rows.filter(r=>r.brand).length,bannerRows:rows.filter(r=>r.banner).length,summaryOrders:summaryRows.length,summaryTotal,detailTotal,summaryDifference,skippedBlankZeroLines:skippedBlankZero}};
}
module.exports={parseOrders};
