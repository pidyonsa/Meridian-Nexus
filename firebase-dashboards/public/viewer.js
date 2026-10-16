'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const attendancePages={overview:'MTD Overview',daily:'Daily Visits',users:'Roster',stores:'Attendance by Store'};
let generation=0,orders=null,lastAttendance=null,attendanceState={audience:'rep',filters:{}},lastRefresh=0;
const cache=new Map();
const attendanceDates={rep:'',merchandiser:''};
async function api(path,body){
  const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(65000)});
  let result;try{result=await response.json();}catch{throw Error('The report service is unavailable. Please try again shortly.');}
  if(!response.ok)throw Error(result.error||'The report could not be loaded.');
  return result;
}
async function ordersApi(input){
  const {refresh,...query}=input,key=JSON.stringify(query),entry=cache.get(key);
  if(!refresh&&entry&&entry.until>Date.now())return entry.data;
  const result=await api('/api/orders',query);
  if(!query.export){while(cache.size>=20)cache.delete(cache.keys().next().value);cache.set(key,{data:result,until:Date.now()+45000});}
  return result;
}
function nav(){
  $('attendance-nav').innerHTML=['rep','merchandiser'].map(a=>`<details class="audience"><summary>Syndicated ${a==='rep'?'reps':'merchandisers'}</summary>${Object.entries(attendancePages).map(([p,n])=>`<a href="/attendance/${a}/${p}">${n==='Roster'?(a==='rep'?'Rep':'Merchandiser')+' roster':n}</a>`).join('')}</details>`).join('');
  $('orders-nav').innerHTML=Object.entries(FranchiseOrders.pages).map(([p,n])=>`<a href="/franchise-orders/${p}" data-franchise-page="${p}">${esc(n)}</a>`).join('');
}
function currentRoute(){const parts=location.pathname.split('/').filter(Boolean);return parts[0]==='franchise-orders'?{area:'orders',page:Object.hasOwn(FranchiseOrders.pages,parts[1])?parts[1]:'overview'}:{area:'attendance',audience:parts[1]==='merchandiser'?'merchandiser':'rep',page:Object.hasOwn(attendancePages,parts[2])?parts[2]:'overview'};}
function showError(e){$('main').innerHTML=`<section class="page-message" role="alert"><h1>Report unavailable</h1><p>${esc(e.message)}</p><button id="retry"><i class="ph ph-arrow-clockwise" aria-hidden="true"></i> Retry</button></section>`;$('retry').onclick=()=>route(true);}
function filterBar(data){
  const names={region:'Region',manager:'Manager',division:'Division',role:'Role',banner:'Banner',channel:'Channel'},keys={region:'regions',manager:'managers',division:'divisions',role:'roles',banner:'banners',channel:'channels'};
  if(!data.availableFilters.banners?.length)delete names.banner;
  if(data.availableFilters.brands?.length){names.brand='Brand';keys.brand='brands';}
  return `<form class="attendance-filters" id="attendance-filters"><label>Report period<span class="report-period">${esc(data.reportStartDate)} to ${esc(data.reportEndDate)}</span></label>${Object.entries(names).map(([field,label])=>{
    const values=data.availableFilters[keys[field]]||[],current=attendanceState.filters[field]||'',options=[...new Set([...values,...(current?[current]:[])])];
    return `<label>${label}<select name="${field}"${!options.length?' disabled title="No mapped values in the current attendance source"':''}><option value="">${options.length?'All '+label.toLowerCase()+'s':'Not in source'}</option>${options.map(v=>`<option value="${esc(v)}"${current===v?' selected':''}>${esc(v)}</option>`).join('')}</select></label>`;
  }).join('')}<button type="reset">Reset filters</button></form>`;
}
async function attendance(page,force=false){
  const ticket=++generation,signature=JSON.stringify(attendanceState),snapshot={audience:attendanceState.audience,filters:{...attendanceState.filters}};
  const paint=data=>{
    if(ticket!==generation)return;
    const updated=data.updatedAt?new Date(data.updatedAt).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'}):'';
    $('main').innerHTML=`<section class="attendance-shell"><header class="attendance-header"><div><p>SYNDICATED ${data.audience==='rep'?'REP':'MERCHANDISER'} ATTENDANCE</p><h1>${esc(attendancePages[page])}</h1><small>Geo Rep | Through ${esc(data.reportEndDate)}${updated?' | Updated '+esc(updated)+' SAST':''}</small></div><button id="refresh-attendance" title="Refresh attendance"><i class="ph ph-arrow-clockwise" aria-hidden="true"></i> Refresh</button></header>${filterBar(data)}<div id="attendance-view"></div></section>`;
    const days=data.scheduleAnalytics.daily.map(day=>day.label);
    const date=days.includes(attendanceDates[snapshot.audience])?attendanceDates[snapshot.audience]:days.at(-1)||'';
    attendanceDates[snapshot.audience]=date;
    NexusAttendance.render($('attendance-view'),data,{page,date,onDateChange:value=>{attendanceDates[snapshot.audience]=value;},filters:snapshot.filters,request:input=>api('/api/attendance',input),current:()=>ticket===generation});
    $('attendance-filters').addEventListener('submit',e=>e.preventDefault());
    $('attendance-filters').addEventListener('change',e=>{attendanceState.filters[e.target.name]=e.target.value;attendance(page,true);});
    $('attendance-filters').addEventListener('reset',e=>{e.preventDefault();attendanceState.filters={};attendanceDates[snapshot.audience]='';attendance(page,true);});
    $('refresh-attendance').onclick=()=>attendance(page,true);
  };
  if(lastAttendance?.signature===signature){paint(lastAttendance.data);if(!force&&lastAttendance.until>Date.now())return;}
  else $('main').innerHTML='<p class="page-message" role="status">Loading attendance...</p>';
  try{
    const data=await api('/api/attendance',snapshot);if(ticket!==generation)return;
    if(!data.availableFilters.banners?.length&&attendanceState.filters.banner){delete attendanceState.filters.banner;return attendance(page,true);}
    lastAttendance={signature,data,until:Date.now()+45000};paint(data);
  }catch(e){if(ticket===generation)showError(e);}
}
function route(force=false){
  const target=currentRoute();lastRefresh=Date.now();
  const selected=target.area==='orders'?`/franchise-orders/${target.page}`:`/attendance/${target.audience}/${target.page}`;
  document.querySelectorAll('nav a').forEach(a=>{if(a.pathname===selected)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  document.body.classList.remove('nav-open');$('nav-toggle').setAttribute('aria-expanded','false');
  if(target.area==='orders'){
    generation++;
    if(orders&&!force){orders.setPage(target.page);$('main').scrollTop=0;return;}
    orders?.stop();$('main').innerHTML='<div id="orders-view" class="fo"></div>';orders=FranchiseOrders.mount($('orders-view'),ordersApi,target.page);
  }else{
    orders?.stop();orders=null;
    if(attendanceState.audience!==target.audience){attendanceState={audience:target.audience,filters:{}};lastAttendance=null;}
    attendance(target.page,force);
  }
  $('main').scrollTop=0;
}
document.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(!a||a.origin!==location.origin||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button)return;if(!/^\/(attendance|franchise-orders)(\/|$)/.test(a.pathname))return;e.preventDefault();history.pushState(null,'',a.pathname);route();});
window.addEventListener('popstate',()=>route());
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastRefresh>120000)route(true);});
window.addEventListener('pagehide',()=>{cache.clear();lastAttendance=null;orders?.stop();});
$('nav-toggle').onclick=()=>$('nav-toggle').setAttribute('aria-expanded',String(document.body.classList.toggle('nav-open')));
nav();route();
