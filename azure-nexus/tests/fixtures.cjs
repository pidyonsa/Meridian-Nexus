'use strict';
async function seed(store){
  const regions=['Free State','Gauteng','Western Cape'];
  const hierarchy=regions.map((region,i)=>({name:`Test Rep ${i+1}`,manager:`Test Manager ${i+1}`,regionalManager:'Test Regional Manager',region,assignment:'syndicated'}));
  const masters=Array.from({length:12},(_,i)=>({storeCode:`TEST${i+1}`,storeName:`Test Store ${i+1}`,rep:`Test Rep ${i%3+1}`,region:regions[i%3],banner:'Test Retailer',channel:'Test Channel'}));
  await store.publish('hierarchy','2000-01',hierarchy,{fileName:'Synthetic hierarchy'});await store.publish('stores','2000-01',masters);
  for(const audience of ['rep','merchandiser']){
    const visits=Array.from({length:96},(_,i)=>({id:`test-${i}`,date:`2026-09-${String(i%12+1).padStart(2,'0')}`,week:`Week ${Math.ceil((i%12+1)/7)}`,userName:`Test ${audience==='rep'?'Rep':'Merchandiser'} ${i%3+1}`,userCode:`${audience}${i%3+1}`,manager:audience==='rep'?`Test Manager ${i%3+1}`:`Test Rep ${i%3+1}`,role:audience==='rep'?'Sales Rep':'Merchandiser',region:regions[i%3],customer:`Test Store ${i%12+1}`,storeCode:`TEST${i%12+1}`,result:i%13===0?'Not Visited':i%17===0?'Pending':i%7===0?'Early visit on: 2026-08-31':i%11===0?'Caught up on: 2026-09-13':'Visited',banner:'Test Retailer',channel:'Test Channel'}));
    await store.publish(`attendance-${audience}`,'2026-09',visits,{reportEndDate:'2026-09-12',fileName:'Synthetic schedules'});
  }
  const orders=Array.from({length:164},(_,i)=>({id:`order-line-${i}`,orderNumber:`TEST-ORDER-${Math.floor(i/2)}`,orderDate:`2026-09-${String(i%12+1).padStart(2,'0')}`,storeCode:`TEST${i%12+1}`,storeName:`Test Store ${i%12+1}`,sku:`SKU${i%8+1}`,product:`Test Product ${i%8+1}`,quantity:3+i%17,unitPrice:10+i%5,value:(3+i%17)*(10+i%5),currency:'ZAR',mapped:true,rep:`Test Rep ${i%3+1}`,manager:`Test Manager ${i%3+1}`,region:regions[i%3],status:i%29===0?'Cancelled':'Processed',banner:'Test Retailer',channel:'Test Channel',client:'Test Client',sourceSystem:'geo-rep-open-api',importedAt:new Date().toISOString()}));
  await store.publish('orders','2026-09',orders,{source:'Synthetic test orders'});
}
module.exports={seed};
