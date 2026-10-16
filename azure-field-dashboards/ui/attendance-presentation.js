(function(global) {
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const n=value=>Number(value||0).toLocaleString('en-ZA');
  const pct=value=>Number.isFinite(value)?`${value.toFixed(1)}%`:'--';
  const key=value=>String(value||'').trim().replace(/\s+/g,' ').normalize('NFKC').toUpperCase();
  const tone=value=>value>=95?'good':value>=90?'watch':'low';
  const ratio=(part,total)=>total?part/total*100:null;
  const width=value=>Math.max(0,Math.min(100,Number(value)||0));
  const detail=(text,selection,title)=>`<button type="button" class="attendance-count" data-attendance-detail="${esc(JSON.stringify(selection))}" aria-label="${esc(title)}">${esc(text)}</button>`;
  const rate=(row,selection)=>detail(row?.scheduled?pct(row.strikeRate):'--',{...selection,metric:'target'},'Attendance: inspect target and completed visits');
  function timeGone(endDate) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(endDate||''))return null;
    const date=new Date(endDate+'T12:00:00Z');
    if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==endDate)return null;
    return date.getUTCDate()/new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate()*100;
  }
  function kpis(data,h) {
    const m=data.metrics, gone=timeGone(data.reportEndDate), missing=ratio(m.missedStores,m.totalStores);
    const items=[
      ['Scheduled visits',h.link(m.scheduled,{metric:'target'},'Scheduled visits'),'MTD visit target','#22c55e'],
      ['Actual visits',h.link(m.attended,{metric:'actual'},'Completed visits'),'MTD completed','#22c55e'],
      ['Attendance MTD',rate(m,{}),`${n(m.users)} ${data.audience==='rep'?'reps':'merchandisers'} in view`,'#ec6d25'],
      ['Stores not visited',h.link(m.missedStores,{unit:'stores',metric:'missed'},'Distinct stores not visited'),`of ${n(m.totalStores)} targeted stores`,'#3b82f6'],
      ['% Stores not visited',detail(pct(missing),{unit:'stores',metric:'missed'},'Inspect stores not visited'),'Unvisited share','#22c55e'],
      ['Time gone',esc(pct(gone)),'Through report date','#d94f3a']
    ];
    return `<section class="pg-source-kpis attendance-overview-kpis">${items.map(([label,value,note,color])=>`<article class="pg-source-kpi" style="--pg-accent:${color}"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`).join('')}</section>`;
  }
  function divisionCards(data,h) {
    const rows=data.charts.byDivision.filter(r=>r.scheduled), palette={CENTRAL:'#22c55e',INLAND:'#4fa3e3',COASTAL:'#ec6d25',UNASSIGNED:'#9dc4ec'};
    const roles=data.charts.byRole;
    return `<section class="pg-source-overview-grid attendance-overview-charts"><article class="pg-source-card"><header><div><h2>Attendance by division</h2><p>Central, Inland and Coastal</p></div></header><div class="pg-source-ring-row">${rows.map(r=>`<div class="pg-source-ring-group"><div class="pg-source-ring" style="--pg-progress:${width(r.strikeRate)};--pg-ring:${palette[r.label]||'#9dc4ec'}"><b>${rate(r,{division:r.label})}</b></div><strong>${esc(r.label)}</strong><small>${h.link(r.attended,{division:r.label,metric:'actual'},'Completed visits')} of ${h.link(r.scheduled,{division:r.label,metric:'target'},'Scheduled visits')}</small></div>`).join('')||'<p>No scheduled visits</p>'}</div><p class="attendance-chart-note">${n(data.metrics.missedVisits)} missed visits; ${n(data.metrics.unknownVisits)} unverified.</p></article><article class="pg-source-card"><header><div><h2>Attendance by ${data.audience==='rep'?'rep':'merchandiser'} type</h2><p>Completed visits against schedule</p></div></header><div class="attendance-role-bars">${roles.map(r=>`<div class="attendance-role tone-${tone(r.strikeRate)}"><strong>${esc(r.label)}</strong><b>${rate(r,{role:r.label})}</b><small>${n(r.users)} ${data.audience==='rep'?'reps':'merchandisers'}</small><div class="attendance-bar-track"><span style="width:${width(r.strikeRate)}%"></span></div></div>`).join('')||'<p>No scheduled visits</p>'}</div><p class="attendance-chart-note">${roles.length?`${esc([...roles].sort((a,b)=>b.strikeRate-a.strikeRate)[0].label)} has the highest attendance at ${pct(Math.max(...roles.map(r=>r.strikeRate)))}.`:'No type records for this selection.'}</p></article></section>`;
  }
  function regions(data,h) {
    const grouped=new Map();
    for(const r of data.charts.byRegion){const d=global.NexusAttendance.division(r.label);if(!grouped.has(d))grouped.set(d,[]);grouped.get(d).push(r);}
    const max=Math.max(1,...data.charts.byRegion.map(r=>r.missedStores));
    return `<section class="pg-source-overview-grid attendance-overview-charts">${[false,true].map(missed=>`<article class="pg-source-card"><header><div><h2>${missed?'Missed stores by region':'% Attendance by region'}</h2><p>${missed?'Distinct stores not visited MTD, by province':'MTD progress by province, split by division'}</p></div></header><div class="attendance-region-groups">${[...grouped].sort(([a],[b])=>a.localeCompare(b)).map(([division,rows])=>`<section><h3 class="division-${division.toLowerCase()}">${esc(division)}</h3>${[...rows].sort((a,b)=>missed?b.missedStores-a.missedStores:b.strikeRate-a.strikeRate).map(r=>`<div class="attendance-region-bar tone-${missed?'low':tone(r.strikeRate)}"><span title="${esc(r.label)}">${esc(r.label)}</span><div class="attendance-bar-track"><span style="width:${width(missed?r.missedStores/max*100:r.strikeRate)}%"></span></div><b>${missed?h.link(r.missedStores,{region:r.label,metric:'missed',unit:'stores'},r.label+' stores not visited'):rate(r,{region:r.label})}</b></div>`).join('')}</section>`).join('')||'<p>No regions in this selection.</p>'}</div></article>`).join('')}</section>`;
  }
  function managerScorecard(data,h) {
    const managers=[...data.charts.byManager].sort((a,b)=>b.strikeRate-a.strikeRate||a.label.localeCompare(b.label));
    const row=(r,index)=>{const s={lineManager:r.label};return `<tr><td><button class="attendance-manager-name" data-manager-team="${index}" aria-label="Open ${esc(r.label)} team">${esc(r.label)}</button></td><td>${h.link(r.totalStores,{...s,metric:'target',unit:'stores'},'Targeted stores')}</td><td>${h.link(r.scheduled,{...s,metric:'target'},'Scheduled visits')}</td><td>${h.link(r.attended,{...s,metric:'actual'},'Completed visits')}</td><td class="attendance-heat tone-${tone(r.strikeRate)}">${rate(r,s)}</td><td>${h.link(r.missedStores,{...s,metric:'missed',unit:'stores'},'Distinct stores not visited')}</td><td class="attendance-heat tone-${tone(100-(ratio(r.missedStores,r.totalStores)||0))}">${detail(pct(ratio(r.missedStores,r.totalStores)),{...s,metric:'missed',unit:'stores'},'Store non-attendance')}</td></tr>`;};
    const headers=['Line manager','# Stores','Target','Actual','Attend %','Not visited stores','% Not visited'];
    return `<section class="pg-source-card attendance-manager-scorecard"><header><div><h2>Line manager scorecard</h2><p>${n(managers.length)} managers, sorted by attendance</p></div>${h.exportButton()}</header><div class="attendance-manager-columns">${[0,1].map(column=>h.table(headers,managers.map((r,i)=>({r,i})).filter(({i})=>i%2===column).map(({r,i})=>row(r,i)))).join('')}</div><details class="attendance-team-directory"><summary>Manager and team detail</summary>${managers.map((r,index)=>{
      const people=data.rows.filter(p=>key(p.manager)===key(r.label));
      return `<details class="attendance-team" id="manager-team-${index}"><summary><span>${esc(r.label)}</span><small>${n(people.length)} team members</small></summary>${h.exportButton({lineManager:r.label})}${h.table(['Team member','Target','Actual','Not visited (visits)','Attendance','Unverified'],[`<tr class="attendance-total"><th scope="row">Team total</th>${h.cells(r,{lineManager:r.label})}</tr>`,...people.map(p=>`<tr><td>${esc(p.userName)}${data.audience==='merchandiser'?`<small>Rep: ${esc(p.rep||'Unassigned')}</small>`:''}</td>${h.cells(p,{person:p.userCode||p.userName,lineManager:r.label})}</tr>`)])}</details>`;
    }).join('')}</details></section>`;
  }
  function weekly(data,h) {
    const weeks=data.scheduleAnalytics.weekly, regions=data.scheduleAnalytics.byRegionWeekly;
    const legend='<p class="attendance-heat-legend"><span class="tone-good">95% and above</span><span class="tone-watch">90-94.9%</span><span class="tone-low">Below 90%</span></p>';
    if(!regions)return `<section class="pg-source-card"><header><h2>Weekly attendance</h2>${h.exportButton()}</header>${h.table(['Geo week','Target','Actual','Not visited (visits)','Attendance','Unverified'],weeks.map(r=>`<tr><td>${esc(r.label)}</td>${h.cells(r,{week:r.label})}</tr>`))}</section>`;
    const weekCell=(r,s)=>`<td class="attendance-heat ${r?.scheduled?'tone-'+tone(r.strikeRate):'attendance-no-schedule'}" title="${r?.scheduled?`${n(r.attended)} completed / ${n(r.scheduled)} scheduled`:'No scheduled records in the report'}">${rate(r,s)}</td>`;
    const body=regions.map(r=>`<tr><th scope="row">${esc(r.label)}</th><td>${h.link(r.missedStores,{region:r.label,unit:'stores',metric:'missed'},'Distinct stores not visited')}</td>${weekCell(r,{region:r.label})}${weeks.map(w=>weekCell(r.weeks.find(item=>key(item.label)===key(w.label)),{region:r.label,week:w.label})).join('')}</tr>`);
    body.push(`<tr class="attendance-total"><th scope="row">Total</th><td>${h.link(data.metrics.missedStores,{unit:'stores',metric:'missed'},'Total distinct stores not visited')}</td>${weekCell(data.metrics,{})}${weeks.map(w=>weekCell(w,{week:w.label})).join('')}</tr>`);
    return `<section class="pg-source-card attendance-weekly"><header><div><h2>MTD and weekly attendance by region</h2><p>Geo reporting weeks; only weeks present in the source are shown.</p></div>${h.exportButton()}</header>${legend}${h.table(['Region','Stores not visited at all','MTD',...weeks.map(w=>w.label)],body)}</section>`;
  }
  function overview(data,h) {
    const totals=[['By type','role',data.charts.byRole],['By region','region',data.charts.byRegion],['By Geo week','week',data.scheduleAnalytics.weekly]];
    const visitTotals=`<details class="attendance-visit-totals"><summary>Visit and verification totals</summary>${totals.map(([label,field,rows])=>`<section><h3>${label}</h3>${h.table([label,'Target','Actual','Not visited (visits)','Attendance','Unverified'],rows.map(r=>`<tr><td>${esc(r.label)}</td>${h.cells(r,{[field]:r.label})}</tr>`))}</section>`).join('')}<section><h3>Store verification by region</h3>${h.table(['Region','Targeted stores','Not visited (stores)','Unverified stores'],data.charts.byRegion.map(r=>`<tr><td>${esc(r.label)}</td><td>${h.link(r.totalStores,{region:r.label,unit:'stores',metric:'target'},'Targeted stores')}</td><td>${h.link(r.missedStores,{region:r.label,unit:'stores',metric:'missed'},'Distinct stores not visited')}</td><td>${h.link(r.unknownStores,{region:r.label,unit:'stores',metric:'unknown'},'Unverified stores')}</td></tr>`))}</section></details>`;
    return kpis(data,h)+divisionCards(data,h)+regions(data,h)+managerScorecard(data,h)+weekly(data,h)+visitTotals+`<div class="attendance-summary-links"><span>Targeted stores ${h.link(data.metrics.totalStores,{unit:'stores',metric:'target'},'All targeted stores')}</span><span>Unverified visits ${h.link(data.metrics.unknownVisits,{metric:'unknown'},'Unverified visits')}</span><span>Unverified stores ${h.link(data.metrics.unknownStores,{unit:'stores',metric:'unknown'},'Unverified stores')}</span></div>`;
  }
  if(global.document)global.document.addEventListener('click',event=>{
    const button=event.target.closest('[data-manager-team]');if(!button)return;
    const team=global.document.getElementById('manager-team-'+button.dataset.managerTeam);
    if(team){team.closest('.attendance-team-directory').open=true;team.open=true;team.scrollIntoView({block:'center',behavior:global.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});team.querySelector('summary').focus();}
  });
  global.AttendancePresentation={overview,timeGone};
})(typeof window==='undefined'?globalThis:window);
