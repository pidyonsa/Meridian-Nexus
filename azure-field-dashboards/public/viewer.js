'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const reportDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?new Intl.DateTimeFormat('en-ZA',{timeZone:'Africa/Johannesburg',day:'2-digit',month:'short',year:'numeric'}).format(new Date(value+'T12:00:00Z')):value;
const attendancePages={daily:'Daily Visits',overview:'MTD Overview',users:'Roster',stores:'Attendance by Store'};
const attendanceTitle=(page,audience)=>page==='daily'?'Daily Visit Log':page==='stores'?'Attendance Detail by Store':page==='users'?(audience==='rep'?'Rep Roster':'Merchandiser Roster'):attendancePages[page];
let generation=0,orders=null,attendanceState={audience:'rep',filters:{}},lastRefresh=0;
const loading=new Map();let loadingSerial=0,showTimer,hideTimer;
function beginLoading(path,input){
  const id=++loadingSerial;clearTimeout(hideTimer);
  loading.set(id,input.export||input.mode==='export'?'Preparing export...':path==='/api/orders'?'Fetching latest orders...':'Fetching latest attendance...');
  $('loading-status').classList.remove('failed');$('loading-status').querySelector('i').className='ph ph-circle-notch';
  $('loading-label').textContent=loading.get(id);
  if(!showTimer)showTimer=setTimeout(()=>{$('loading-status').hidden=!loading.size;showTimer=null;},120);
  return id;
}
function endLoading(id,error){
  loading.delete(id);
  if(loading.size){$('loading-label').textContent=[...loading.values()].at(-1);return;}
  clearTimeout(showTimer);showTimer=null;
  if(error){$('loading-status').classList.add('failed');$('loading-status').querySelector('i').className='ph ph-warning-circle';$('loading-label').textContent='Update failed. Please try Refresh.';$('loading-status').hidden=false;}
  hideTimer=setTimeout(()=>{$('loading-status').hidden=true;},error?5000:250);
}
const attendanceDates={rep:'',merchandiser:''};
const attendanceRosterQueries={rep:'',merchandiser:''};
const attendanceStoreSelections={rep:{},merchandiser:{}};
async function fetchReport(path,body){
  // The site is behind Microsoft sign-in (App Service Authentication cookie), so report calls must send it.
  const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'same-origin',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(65000)});
  // Signed out or the 8-hour session ended: App Service answers 401 or redirects to Microsoft sign-in.
  if(response.type==='opaqueredirect'||response.status===401)throw Error('Your Microsoft sign-in has ended. Reload the page to sign in again.');
  let result;try{result=await response.json();}catch{throw Error('The report service is unavailable. Please try again shortly.');}
  if(!response.ok)throw Error(result.error||'The report could not be loaded.');
  return result;
}
const reports=ReportLoader.create({fetcher:fetchReport,onStart:beginLoading,onEnd:endLoading});
const api=(path,body)=>reports.read(path,body);
const attendanceApi=input=>api('/api/attendance',input);
attendanceApi.cached=input=>reports.fresh('/api/attendance',input)?reports.peek('/api/attendance',input):null;
const ordersApi=input=>api('/api/orders',input);
ordersApi.cached=input=>reports.peek('/api/orders',input);
function nav(target){
  const isAttendance=target.area==='attendance';
  document.body.classList.toggle('attendance-mode',isAttendance);
  document.body.classList.toggle('orders-mode',!isAttendance);
  $('attendance-sidebar').hidden=!isAttendance;
  $('attendance-mobile-bar').hidden=!isAttendance;
  $('orders-sidebar').hidden=isAttendance;
  $('orders-mobile-bar').hidden=isAttendance;
  FranchiseReference.closeNavigation(false);
  const navigation=document.querySelector('.report-navigation');
  navigation.hidden=true;
  const destination=isAttendance?$('attendance-sidebar-controls'):$('orders-sidebar-controls');
  destination.append($('audience-switch'),$('report-tabs'));
  $('attendance-audience-label').textContent=target.audience==='merchandiser'?'Merchandiser attendance':'Rep attendance';
  closeAttendanceNav(false);
  $('audience-switch').hidden=!isAttendance;
  $('audience-switch').innerHTML=isAttendance?['rep','merchandiser'].map(a=>`<a href="/attendance/${a}/${target.page}"${a===target.audience?' aria-current="true"':''}>${a==='rep'?'Reps':'Merchandisers'}</a>`).join(''):'';
  const pages=isAttendance?attendancePages:FranchiseOrders.pages;
  const icons=isAttendance?{daily:'calendar-check',overview:'chart-bar',users:'list-bullets',stores:'storefront'}:FranchiseReference.icons;
  $('report-tabs').innerHTML=Object.entries(pages).map(([page,label])=>`<a href="${isAttendance?`/attendance/${target.audience}`:'/franchise-orders'}/${page}"${isAttendance?'':` data-franchise-page="${page}"`}${page===target.page?' aria-current="page"':''}><i class="ph ph-${icons[page]}" aria-hidden="true"></i><span>${esc(isAttendance?attendanceTitle(page,target.audience):FranchiseReference.labels[page]||label)}</span></a>`).join('');
  if(isAttendance)$('report-tabs').querySelector('a[href$="/daily"] span').textContent='Daily Visits';
  if(isAttendance)$('report-tabs').querySelector('a[href$="/stores"] span').textContent='Attendance by Store';
  const active=$('report-tabs').querySelector('[aria-current="page"]');
  const reveal=()=>{if(active?.isConnected)active.scrollIntoView({block:'nearest',inline:'nearest'});};
  reveal();document.fonts.ready.then(reveal);
  document.title=`${isAttendance?'Attendance':'Franchise Orders'} | Meridian`;
}
function currentRoute(){const parts=location.pathname.split('/').filter(Boolean);return parts[0]==='franchise-orders'?{area:'orders',page:Object.hasOwn(FranchiseOrders.pages,parts[1])?parts[1]:'overview'}:{area:'attendance',audience:parts[1]==='merchandiser'?'merchandiser':'rep',page:Object.hasOwn(attendancePages,parts[2])?parts[2]:'overview'};}
function showError(e){$('report-body').innerHTML=`<section class="page-message" role="alert"><h1>Report unavailable</h1><p>${esc(e.message)}</p><button id="retry"><i class="ph ph-arrow-clockwise" aria-hidden="true"></i> Retry</button></section>`;$('retry').onclick=()=>route(true);}
function filterBar(data){
  const names={region:'Region',manager:'Manager',division:'Division',role:'Role',banner:'Banner',channel:'Channel'},keys={region:'regions',manager:'managers',division:'divisions',role:'roles',banner:'banners',channel:'channels'};
  if(!data.availableFilters.banners?.length)delete names.banner;
  if(!data.availableFilters.channels?.length)delete names.channel;
  if(data.availableFilters.brands?.length){names.brand='Brand';keys.brand='brands';}
  const month=/^\d{4}-\d{2}-\d{2}$/.test(data.reportEndDate||'')?new Intl.DateTimeFormat('en-ZA',{month:'long',year:'numeric',timeZone:'Africa/Johannesburg'}).format(new Date(data.reportEndDate+'T12:00:00Z')):'Latest report';
  return `<form class="attendance-filters" id="attendance-filters"><label class="attendance-period-filter">Report month<span class="report-period" title="${esc(reportDate(data.reportStartDate))} to ${esc(reportDate(data.reportEndDate))}"><time datetime="${esc((data.reportEndDate||'').slice(0,7))}">${esc(month)}</time></span></label>${Object.entries(names).map(([field,label])=>{
    const values=data.availableFilters[keys[field]]||[],current=attendanceState.filters[field]||'',options=[...new Set([...values,...(current?[current]:[])])];
    return `<label>${label}<select name="${field}"${!options.length?' disabled title="No mapped values in the current attendance source"':''}><option value="">${options.length?'All '+label.toLowerCase()+'s':'Not in source'}</option>${options.map(v=>`<option value="${esc(v)}"${current===v?' selected':''}>${esc(v)}</option>`).join('')}</select></label>`;
  }).join('')}<button type="reset" title="Reset filters"><i class="ph ph-arrow-counter-clockwise" aria-hidden="true"></i> Reset</button><button type="button" id="refresh-attendance" title="Refresh attendance"><i class="ph ph-arrows-clockwise" aria-hidden="true"></i> Refresh now</button></form>`;
}
async function attendance(page,force=false){
  const ticket=++generation,snapshot={audience:attendanceState.audience,filters:{...attendanceState.filters}};
  const paint=data=>{
    if(ticket!==generation)return;
    const updated=data.updatedAt?new Date(data.updatedAt).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'}):'';
    $('attendance-refreshed').textContent=updated?'Data refreshed '+updated+' SAST':'Latest Geo Rep report';
    $('report-body').innerHTML=`<section class="attendance-shell"><header class="attendance-header"><div><p>SYNDICATED ${data.audience==='rep'?'REP':'MERCHANDISER'} ATTENDANCE</p><h1>${esc(attendanceTitle(page,data.audience))}</h1></div></header>${filterBar(data)}<p class="attendance-period-note">Geo Rep | ${esc(reportDate(data.reportStartDate))} to ${esc(reportDate(data.reportEndDate))}</p><div id="attendance-view"></div></section>`;
    const days=data.scheduleAnalytics.daily.map(day=>day.label);
    const date=days.includes(attendanceDates[snapshot.audience])?attendanceDates[snapshot.audience]:days.at(-1)||'';
    attendanceDates[snapshot.audience]=date;
    NexusAttendance.render($('attendance-view'),data,{page,date,overview:AttendancePresentation.overview,daily:AttendanceDaily,roster:AttendanceRoster,rosterQuery:attendanceRosterQueries[snapshot.audience],onRosterQueryChange:value=>{attendanceRosterQueries[snapshot.audience]=value;},stores:AttendanceStores,storeSelection:attendanceStoreSelections[snapshot.audience],onStoreSelectionChange:value=>{attendanceStoreSelections[snapshot.audience]=value;},onDateChange:value=>{attendanceDates[snapshot.audience]=value;},filters:snapshot.filters,request:attendanceApi,current:()=>ticket===generation});
    $('attendance-filters').addEventListener('submit',e=>e.preventDefault());
    $('attendance-filters').addEventListener('change',e=>{attendanceState.filters[e.target.name]=e.target.value;attendance(page);});
    $('attendance-filters').addEventListener('reset',e=>{e.preventDefault();attendanceState.filters={};attendanceDates[snapshot.audience]='';attendanceRosterQueries[snapshot.audience]='';attendanceStoreSelections[snapshot.audience]={};attendance(page);});
    $('refresh-attendance').onclick=()=>attendance(page,true);
  };
  const cached=reports.peek('/api/attendance',snapshot);
  if(cached){paint(cached);if(!force&&reports.fresh('/api/attendance',snapshot))return;}
  else $('report-body').innerHTML='<p class="page-message" role="status">Loading attendance...</p>';
  try{
    const data=await api('/api/attendance',{...snapshot,refresh:force});if(ticket!==generation)return;
    if(!data.availableFilters.banners?.length&&attendanceState.filters.banner){delete attendanceState.filters.banner;return attendance(page,true);}
    paint(data);
  }catch(e){if(ticket===generation){if(cached){$('report-body').insertAdjacentHTML('afterbegin','<p class="attendance-refresh-note" role="alert">Could not fetch the latest data. Showing the last loaded selection; use Refresh to try again.</p>');}else showError(e);}}
}
function route(force=false){
  const target=currentRoute();lastRefresh=Date.now();nav(target);
  if(target.area==='orders'){
    generation++;
    if(orders&&!force){orders.setPage(target.page);$('main').scrollTop=0;return;}
    orders?.stop();$('report-body').innerHTML='<div id="orders-view" class="fo"></div>';orders=FranchiseOrders.mount($('orders-view'),ordersApi,target.page);
  }else{
    orders?.stop();orders=null;
    if(attendanceState.audience!==target.audience){attendanceState={audience:target.audience,filters:{}};}
    attendance(target.page,force);
  }
  $('main').scrollTop=0;
}
document.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(!a||a.origin!==location.origin||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button)return;if(!/^\/(attendance|franchise-orders)(\/|$)/.test(a.pathname))return;e.preventDefault();history.pushState(null,'',a.pathname);route();});
window.addEventListener('popstate',()=>route());
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastRefresh>120000)route(true);});
window.addEventListener('pagehide',()=>{reports.clear();orders?.stop();});
function closeAttendanceNav(focus=true){
  const wasOpen=document.body.classList.contains('attendance-nav-open');
  document.body.classList.remove('attendance-nav-open');$('attendance-nav-toggle').setAttribute('aria-expanded','false');$('attendance-nav-backdrop').hidden=true;
  if(focus||wasOpen)$('attendance-nav-toggle').focus();
}
$('attendance-nav-toggle').onclick=()=>{
  document.body.classList.add('attendance-nav-open');$('attendance-nav-toggle').setAttribute('aria-expanded','true');$('attendance-nav-backdrop').hidden=false;$('attendance-nav-close').focus();
};
$('attendance-nav-close').onclick=()=>closeAttendanceNav();
$('attendance-nav-backdrop').onclick=()=>closeAttendanceNav();
window.matchMedia('(max-width:760px)').addEventListener('change',()=>closeAttendanceNav(false));
document.addEventListener('keydown',event=>{
  if(!document.body.classList.contains('attendance-nav-open'))return;
  if(event.key==='Escape'){event.preventDefault();closeAttendanceNav();}
  if(event.key==='Tab'){
    const items=[...$('attendance-sidebar').querySelectorAll('a,button')].filter(el=>el.getClientRects().length);
    const first=items[0],last=items.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
});
FranchiseReference.initNavigation();
route();
