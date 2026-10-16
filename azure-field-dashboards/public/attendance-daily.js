(function(global) {
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const n=value=>Number(value||0).toLocaleString('en-ZA');
  const pct=value=>Number.isFinite(value)?value.toFixed(1)+'%':'--';
  const ratio=(part,total)=>total?part/total*100:null;
  const tone=value=>value>=80?'good':value>=50?'watch':'low';
  const width=value=>Math.max(0,Math.min(100,Number(value)||0));
  const detail=(text,selection,title)=>`<button type="button" class="attendance-count" data-attendance-detail="${esc(JSON.stringify(selection))}" aria-label="${esc(title)}">${esc(text)}</button>`;
  const rate=(r,selection)=>detail(r.scheduled?pct(r.strikeRate):'--',{...selection,metric:'target'},'Inspect scheduled and completed visits');
  const dateLabel=(date,short=false)=>/^\d{4}-\d{2}-\d{2}$/.test(date)?new Intl.DateTimeFormat('en-GB',short?{day:'2-digit',month:'2-digit',timeZone:'UTC'}:{weekday:'short',day:'2-digit',month:'short',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z')):date;
  function selectedDate(data,selected) {
    const days=data.scheduleAnalytics.daily;
    return days.some(r=>r.label===selected)?selected:days.at(-1)?.label||'';
  }
  function historyRows(data,date) {
    return data.scheduleAnalytics.daily.filter(r=>r.label<=date&&r.scheduled>0).sort((a,b)=>a.label.localeCompare(b.label)).slice(-13);
  }
  function kpis(data,date,h) {
    const m=data.scheduleAnalytics.daily.find(r=>r.label===date)||{}, s={date};
    const items=[
      ['Scheduled visits',h.link(m.scheduled,{...s,metric:'target'},'Scheduled visits for selected day'),'Due on selected day','#22c55e'],
      ['Actual visits',h.link(m.attended,{...s,metric:'actual'},'Completed visits for selected day'),'Completed','#eb543c'],
      ['Attendance (day)',rate(m,s),'Of scheduled visits','#ff761b'],
      ['Stores not visited',h.link(m.missedStores,{...s,metric:'missed',unit:'stores'},'Distinct stores not visited on selected day'),`of ${n(m.totalStores)} targeted stores`,'#3b82f6'],
      ['% Stores not visited',detail(pct(ratio(m.missedStores,m.totalStores)),{...s,metric:'missed',unit:'stores'},'Inspect unvisited stores'),'Unvisited share','#22c55e'],
      ['Time gone',pct(global.AttendancePresentation.timeGone(data.reportEndDate)),'Of report month elapsed','#eb543c']
    ];
    return `<section class="pg-source-kpis attendance-overview-kpis attendance-daily-kpis">${items.map(([label,value,note,color])=>`<article class="pg-source-kpi" style="--pg-accent:${color}"><span>${label}</span><strong>${value}</strong><small>${esc(note)}</small></article>`).join('')}</section>`;
  }
  function history(data,date) {
    const rows=historyRows(data,date), best=[...rows].sort((a,b)=>b.strikeRate-a.strikeRate)[0], worst=[...rows].sort((a,b)=>a.strikeRate-b.strikeRate)[0];
    const avg=rows.length?rows.reduce((sum,r)=>sum+r.strikeRate,0)/rows.length:null;
    return `<article class="pg-source-card attendance-daily-history"><header><h2>% Attendance - Last ${rows.length} Report Days</h2></header><div class="attendance-history-scroll"><div class="attendance-history-bars" style="--day-count:${Math.max(1,rows.length)}">${rows.map(r=>`<button type="button" class="attendance-history-day tone-${tone(r.strikeRate)}${r.label===date?' is-selected':''}" data-attendance-detail="${esc(JSON.stringify({date:r.label,metric:'target'}))}" aria-label="${esc(dateLabel(r.label))}: ${pct(r.strikeRate)}, ${n(r.attended)} of ${n(r.scheduled)} visits"><span class="attendance-history-column"><span class="attendance-history-fill" style="height:${width(r.strikeRate)}%"><b>${pct(r.strikeRate)}</b></span></span><small>${esc(dateLabel(r.label,true))}</small></button>`).join('')||'<p>No scheduled visits.</p>'}</div></div><p class="attendance-chart-note">${rows.length?`Daily average ${pct(avg)}; best ${esc(dateLabel(best.label))} (${pct(best.strikeRate)}); lowest ${esc(dateLabel(worst.label))} (${pct(worst.strikeRate)}).`:'No report days for this selection.'}</p></article>`;
  }
  function roles(data,date) {
    const rows=[...data.charts.byRole].filter(r=>r.scheduled).sort((a,b)=>b.strikeRate-a.strikeRate), name=data.audience==='rep'?'rep':'merchandiser';
    return `<header><h2>Attendance by ${name} type</h2><p class="attendance-heat-legend"><span class="tone-good">80% and above</span><span class="tone-watch">50-79.9%</span><span class="tone-low">Below 50%</span></p></header><div class="attendance-role-bars">${rows.map(r=>`<div class="attendance-role tone-${tone(r.strikeRate)}"><strong>${esc(r.label)}</strong><b>${rate(r,{date,role:r.label})}</b><small>${n(r.scheduled)} scheduled visits</small><div class="attendance-bar-track"><span style="width:${width(r.strikeRate)}%"></span></div></div>`).join('')||'<p>No types in this selection.</p>'}</div><p class="attendance-chart-note">${rows.length?`${esc(rows[0].label)} leads at ${pct(rows[0].strikeRate)}${rows.length>1?`; ${esc(rows.at(-1).label)} is lowest at ${pct(rows.at(-1).strikeRate)}`:''}.`:'No scheduled visits for this day.'}</p>`;
  }
  function divisions(data,date,h) {
    const palette={CENTRAL:'#22c55e',COASTAL:'#ec6d25',INLAND:'#4fa3e3',UNASSIGNED:'#9dc4ec'};
    const rows=[...data.charts.byDivision].filter(r=>r.scheduled).sort((a,b)=>a.label.localeCompare(b.label));
    return `<section class="pg-source-card attendance-daily-divisions"><header><div><h2>Attendance by division &amp; region</h2><p>Selected day, provinces grouped by division</p></div></header><div class="attendance-daily-division-layout"><div class="pg-source-ring-row">${rows.map(r=>`<div class="pg-source-ring-group"><div class="pg-source-ring" style="--pg-progress:${width(r.strikeRate)};--pg-ring:${palette[r.label]||palette.UNASSIGNED}"><b>${rate(r,{date,division:r.label})}</b></div><strong>${esc(r.label)}</strong><small>${h.link(r.attended,{date,division:r.label,metric:'actual'},'Completed visits')} of ${h.link(r.scheduled,{date,division:r.label,metric:'target'},'Scheduled visits')}</small></div>`).join('')||'<p>No divisions in this selection.</p>'}</div><div class="attendance-region-groups">${rows.map(r=>`<section><h3 class="division-${esc(r.label.toLowerCase())}">${esc(r.label)}</h3>${data.charts.byRegion.filter(region=>global.NexusAttendance.division(region.label)===r.label).sort((a,b)=>b.strikeRate-a.strikeRate).map(region=>`<div class="attendance-region-bar tone-${tone(region.strikeRate)}"><span>${esc(region.label)}</span><div class="attendance-bar-track"><span style="width:${width(region.strikeRate)}%"></span></div><b>${rate(region,{date,region:region.label})}</b></div>`).join('')}</section>`).join('')}</div></div></section>`;
  }
  function heat(value) {
    const stops=[[50,[217,79,58]],[80,[232,168,56]],[100,[26,190,97]]], v=width(value);
    const end=stops.findIndex(([at])=>v<=at);
    if(end<=0)return 'rgb('+stops[0][1].join(',')+')';
    const [low,a]=stops[end-1],[high,b]=stops[end], mix=(v-low)/(high-low);
    return 'rgb('+a.map((color,i)=>Math.round(color+(b[i]-color)*mix)).join(',')+')';
  }
  function managers(data,date,h) {
    const rows=[...data.charts.byManager].sort((a,b)=>b.strikeRate-a.strikeRate||a.label.localeCompare(b.label));
    const headers=['Line manager','Target','Actual','Attend %','Not visited stores','% Not visited'];
    const render=r=>{const s={date,lineManager:r.label}, missed=ratio(r.missedStores,r.totalStores);return `<tr><th scope="row">${detail(r.label,{...s,metric:'target'},'Inspect '+r.label+' daily team visits')}</th><td>${h.link(r.scheduled,{...s,metric:'target'},'Scheduled visits')}</td><td>${h.link(r.attended,{...s,metric:'actual'},'Completed visits')}</td><td class="attendance-heat" style="--attendance-tone:${heat(r.strikeRate)}">${rate(r,s)}</td><td>${h.link(r.missedStores,{...s,unit:'stores',metric:'missed'},'Distinct stores not visited')}</td><td class="attendance-heat" style="--attendance-tone:${heat(100-(missed||0))}">${detail(pct(missed),{...s,unit:'stores',metric:'missed'},'Store non-attendance')}</td></tr>`;};
    return `<section class="pg-source-card attendance-manager-scorecard attendance-daily-managers"><header><div><h2>Line manager daily scorecard</h2><p>${n(rows.length)} managers, sorted by daily attendance</p></div>${h.exportButton({date})}</header><div class="attendance-manager-columns">${[0,1].map(col=>h.table(headers,rows.filter((r,i)=>i%2===col).map(render))).join('')}</div></section>`;
  }
  function missedStores(data,date,h) {
    const merch=data.audience==='merchandiser', rows=data.stores.filter(r=>r.status==='missed').sort((a,b)=>a.managers.join(', ').localeCompare(b.managers.join(', '))||a.resources.join(', ').localeCompare(b.resources.join(', '))||a.storeName.localeCompare(b.storeName));
    return `<section class="pg-source-card attendance-daily-missed"><header><div><h2>Stores not visited</h2><p>${n(rows.length)} distinct stores scheduled on ${esc(dateLabel(date))} with no completed or unverified visits</p></div><button type="button" class="attendance-export" data-attendance-export="${esc(JSON.stringify({date,metric:'missed',unit:'stores'}))}"><i class="ph ph-file-xls" aria-hidden="true"></i> Export to Excel</button></header>${h.table([merch?'Merchandiser name':'Rep name',...(merch?['Rep']:[]),'Manager name','Store name','Region'],rows.map(r=>`<tr><td>${esc(r.resources.join(', '))}</td>${merch?`<td>${esc(r.reps.join(', '))}</td>`:''}<td>${esc(r.managers.join(', ')||'Unassigned')}</td><td>${detail(r.storeName,{date,store:r.storeId,metric:'missed'},'Inspect missed visits at '+r.storeName)}</td><td>${esc(r.region)}</td></tr>`))}</section>`;
  }
  function html(data,selected,h) {
    const date=selectedDate(data,selected);
    return `<section class="pg-source-datebar attendance-daily-datebar"><label><span class="sr-only">Attendance date</span><select data-attendance-date aria-label="Attendance date">${data.scheduleAnalytics.daily.map(r=>`<option value="${esc(r.label)}"${r.label===date?' selected':''}>${esc(dateLabel(r.label))}</option>`).join('')}</select></label><span>Scheduled visits for the selected day</span>${h.exportButton({date})}</section>${kpis(data,date,h)}<section class="pg-source-overview-grid attendance-daily-charts">${history(data,date)}<article class="pg-source-card attendance-daily-roles" data-daily-roles aria-busy="true"><h2>Attendance by ${data.audience==='rep'?'rep':'merchandiser'} type</h2><p role="status">Loading selected day...</p></article></section><div class="attendance-daily-details" data-daily-details aria-busy="true"><p role="status">Loading daily regions, managers and stores...</p></div>`;
  }
  async function mount(container,data,selected,h,context) {
    const slot=container.querySelector('[data-daily-details]'), role=container.querySelector('[data-daily-roles]'), date=selectedDate(data,selected);
    const current=()=>context.current()&&slot.isConnected&&container.contains(slot);
    const paint=day=>{
      if(!current())return;
      if(day.version!==data.version)throw Error('Attendance refreshed. Use Refresh now before viewing daily details.');
      slot.innerHTML=divisions(day,date,h)+managers(day,date,h)+missedStores(day,date,h)+`<div class="attendance-summary-links"><span>Missed visits ${h.link(day.metrics.missedVisits,{date,metric:'missed'},'Missed scheduled visits')}</span><span>Unverified visits ${h.link(day.metrics.unknownVisits,{date,metric:'unknown'},'Unverified scheduled visits')}</span><span>Unverified stores ${h.link(day.metrics.unknownStores,{date,metric:'unknown',unit:'stores'},'Unverified stores')}</span></div>`;
      role.innerHTML=roles(day,date);slot.setAttribute('aria-busy','false');role.setAttribute('aria-busy','false');
      slot.dataset.date=date;
    };
    if(!date){slot.innerHTML='<p>No scheduled visits for this selection.</p>';role.innerHTML='<h2>Attendance by type</h2><p>No scheduled visits.</p>';slot.setAttribute('aria-busy','false');role.setAttribute('aria-busy','false');return;}
    const input={mode:'dashboard',audience:data.audience,filters:{...context.filters,date},version:data.version};
    try {
      const cached=context.request.cached?.(input);
      if(cached){paint(cached);return;}
      paint(await context.request(input));
    }catch(error){
      if(!current())return;
      slot.innerHTML=`<p role="alert">${esc(error.message||'Daily details could not be loaded.')}</p>`;
      role.innerHTML='<h2>Attendance by type</h2><p>Daily details unavailable. Use Refresh now to retry.</p>';
      slot.setAttribute('aria-busy','false');role.setAttribute('aria-busy','false');
    }
  }
  global.AttendanceDaily={html,mount,selectedDate,historyRows,heat};
})(typeof window==='undefined'?globalThis:window);
