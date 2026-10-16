'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const attendancePages={overview:'MTD Overview',daily:'Daily Visits',users:'Roster',stores:'Attendance by Store'};
const cache=new Map();let session,generation=0,orders=null,attendanceState={audience:'rep',period:'',filters:{}},lastAttendance=null;
async function api(path,body,options={}) {
  const response=await fetch(path,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),...options});
  const result=await response.json();
  if(!response.ok){if(response.status===401 || response.status===403){cache.clear();lastAttendance=null;}const e=new Error(result.error||'Request failed.');e.status=response.status;e.code=result.code;throw e;}
  return result;
}
async function ordersApi(input){
  const {refresh,...query}=input,key=JSON.stringify(query),existing=cache.get(key);
  if(!refresh && existing && existing.until>Date.now())return existing.data;
  const result=await api('/api/orders',query);
  if(!query.export){while(cache.size>=20)cache.delete(cache.keys().next().value);cache.set(key,{data:result,until:Date.now()+45000});}
  return result;
}
function nav(){
  $('attendance-nav').innerHTML=['rep','merchandiser'].map(a=>`<details class="audience"><summary>Syndicated ${a==='rep'?'reps':'merchandisers'}</summary>${Object.entries(attendancePages).map(([p,n])=>`<a href="#attendance/${a}/${p}">${n==='Roster'?(a==='rep'?'Rep':'Merchandiser')+' roster':n}</a>`).join('')}</details>`).join('');
  $('orders-nav').innerHTML=Object.entries(FranchiseOrders.pages).map(([p,n])=>`<a href="#orders/${p}" data-franchise-page="${p}">${esc(n)}</a>`).join('');
}
function currentNav(){document.querySelectorAll('nav a').forEach(a=>{if(a.origin===location.origin&&a.hash===location.hash)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});}
function showError(e){
  $('main').innerHTML=`<section class="page-message" role="alert"><h1>${e.status===401?'Sign in required':'Dashboard unavailable'}</h1><p>${esc(e.message)}</p>${e.status===401?'<a href="/.auth/login/aad?post_login_redirect_uri=/">Sign in with Microsoft</a>':'<button id="retry">Retry</button>'}</section>`;
  $('retry')?.addEventListener('click',()=>route(true));
}
function filters(data){
  const names={region:'Region',manager:'Manager',division:'Division',role:'Role',banner:'Banner',channel:'Channel'}, keys={region:'regions',manager:'managers',division:'divisions',role:'roles',banner:'banners',channel:'channels'};
  return `<form class="attendance-filters" id="attendance-filters"><label>Report month<select name="period">${data.periods.map(p=>`<option${data.period===p?' selected':''}>${p}</option>`).join('')}</select></label>${Object.entries(names).map(([field,label])=>`<label>${label}<select name="${field}"><option value="">All ${label.toLowerCase()}s</option>${(data.availableFilters[keys[field]]||[]).map(v=>`<option value="${esc(v)}"${attendanceState.filters[field]===v?' selected':''}>${esc(v)}</option>`).join('')}</select></label>`).join('')}<button type="reset">Reset filters</button></form>`;
}
async function attendance(page,force=false){
  const ticket=++generation,signature=JSON.stringify(attendanceState);
  const paint=data=>{
    if(ticket!==generation)return;
    $('main').innerHTML=`<section class="attendance-shell"><header class="attendance-header"><div><p>SYNDICATED ${data.audience==='rep'?'REP':'MERCHANDISER'} ATTENDANCE</p><h1>${esc(attendancePages[page]||attendancePages.overview)}</h1><small>${esc(data.reportEndDate)} ${data.updatedAt?' | Updated '+esc(new Date(data.updatedAt).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'}))+' SAST':''}</small></div><button id="refresh-attendance" title="Refresh attendance"><i class="ph ph-arrow-clockwise" aria-hidden="true"></i> Refresh</button></header>${filters(data)}<div id="attendance-view"></div></section>`;
    const snapshot={...attendanceState,period:data.period,filters:{...attendanceState.filters}};
    NexusAttendance.render($('attendance-view'),data,{page,filters:snapshot.filters,request:input=>api('/api/attendance',{...input,period:snapshot.period}),current:()=>ticket===generation});
    $('attendance-filters').addEventListener('change',e=>{const f=e.target.name;if(f==='period')attendanceState.period=e.target.value;else attendanceState.filters[f]=e.target.value;attendance(page,true);});
    $('attendance-filters').addEventListener('reset',e=>{e.preventDefault();attendanceState.filters={};attendance(page,true);});
    $('refresh-attendance').onclick=()=>attendance(page,true);
  };
  if(lastAttendance?.signature===signature){paint(lastAttendance.data);if(!force && lastAttendance.until>Date.now())return;}
  else $('main').innerHTML='<p class="page-message" role="status">Loading syndicated attendance...</p>';
  try{const data=await api('/api/attendance',attendanceState);if(ticket!==generation)return;lastAttendance={signature,data,until:Date.now()+45000};paint(data);}catch(e){if(ticket===generation)showError(e);}
}
function route(force=false){
  if(!session)return;
  const [area,a,b]=location.hash.slice(1).split('/');currentNav();
  document.body.classList.remove('nav-open');$('nav-toggle').setAttribute('aria-expanded','false');
  if(area==='orders'){
    generation++;lastAttendance=null;
    if(orders && !force){orders.setPage(a||'overview');$('main').scrollTop=0;return;}
    orders?.stop();$('main').innerHTML='<div id="orders-view" class="fo"></div>';
    orders=FranchiseOrders.mount($('orders-view'),ordersApi,a||'overview');
  }else{
    orders?.stop();orders=null;
    const audience=a==='merchandiser'?'merchandiser':'rep';
    if(attendanceState.audience!==audience)attendanceState={audience,period:'',filters:{}};
    attendance(b||'overview',force);
  }
  $('main').scrollTop=0;
}
async function sourceStatus(){
  const sources=await api('/api/sources');
  $('source-status').innerHTML=`<table><thead><tr><th>Source</th><th>Month</th><th>Rows</th></tr></thead><tbody>${Object.entries(sources).map(([key,list])=>`<tr><td>${esc(key)}</td><td>${esc(list[0]?.period==='2000-01'?'Reference':list[0]?.period||'Not loaded')}</td><td>${(list[0]?.count||0).toLocaleString('en-ZA')}</td></tr>`).join('')}</tbody></table>`;
}
$('sources').onclick=async()=>{$('source-dialog').showModal();$('source-status').textContent='Loading sources...';try{await sourceStatus();}catch(e){$('source-status').textContent=e.message;}};
$('close-sources').onclick=()=>$('source-dialog').close();
$('import-form').elements.period.value=new Date().toISOString().slice(0,7);
$('import-form').elements.kind.onchange=e=>{$('period-label').hidden=!e.target.value.startsWith('attendance');};
$('import-form').onsubmit=async e=>{
  e.preventDefault();const form=e.currentTarget,kind=form.elements.kind.value,button=form.querySelector('[type=submit]'),file=form.elements.workbook.files[0];
  if(!file)return;button.disabled=true;$('import-status').textContent='Validating workbook...';
  try{
    const path=kind.startsWith('attendance-')?`/api/import/attendance?audience=${encodeURIComponent(kind.slice(11))}&period=${encodeURIComponent(form.elements.period.value)}`:`/api/import/reference/${kind}`;
    const result=await api(path,undefined,{method:'POST',headers:{'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent(file.name)},body:file});
    cache.clear();lastAttendance=null;$('import-status').textContent=`Imported ${result.count.toLocaleString('en-ZA')} rows.`;await sourceStatus();route(true);
  }catch(e){$('import-status').textContent=e.message;}finally{button.disabled=false;}
};
$('nav-toggle').onclick=()=>{$('nav-toggle').setAttribute('aria-expanded',String(document.body.classList.toggle('nav-open')));};
window.addEventListener('hashchange',()=>route());
window.addEventListener('pagehide',()=>{cache.clear();lastAttendance=null;});
$('sign-out').onclick=()=>{cache.clear();lastAttendance=null;orders?.stop();$('main').replaceChildren();};
(async()=>{nav();try{session=await api('/api/session');$('user-name').textContent=session.name;$('sources').hidden=!session.admin;$('preview-banner').hidden=!session.preview;if(session.preview)$('sign-out').hidden=true;if(!location.hash)location.hash='attendance/rep/overview';else route();}catch(e){showError(e);}})();
