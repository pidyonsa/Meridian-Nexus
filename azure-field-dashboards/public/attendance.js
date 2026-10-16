(function(global) {
  'use strict';
  const mounted = new WeakMap();
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const n = v => Number(v || 0).toLocaleString('en-ZA');
  const pct = v => `${Number(v || 0).toFixed(1)}%`;
  const attrs = value => escape(JSON.stringify(value));
  function status(row) { const name = row.status === 'visited' ? 'Attended' : row.status === 'missed' ? 'Not visited' : 'Unverified'; return `<span class="attendance-status attendance-status-${escape(row.status)}">${name}${row.caughtUp ? ' (caught up)' : ''}</span>`; }
  function link(value,selection,title) { return `<button type="button" class="attendance-count" data-attendance-detail="${attrs(selection)}" aria-label="${escape(title)}">${n(value)}</button>`; }
  function table(headers,rows) { return `<div class="pg-source-table-wrap" tabindex="0" role="region" aria-label="Scrollable attendance table"><table><thead><tr>${headers.map(h=>`<th scope="col">${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${headers.length}">No records match this selection.</td></tr>`}</tbody></table></div>`; }
  const exportButton = (selection={}) => `<button type="button" data-attendance-export="${attrs(selection)}" class="attendance-export" title="Download Excel"><span aria-hidden="true">&#8595;</span> Excel</button>`;
  function cells(row,selection) { if(row.noSchedule) return '<td colspan="5">No schedule detail in this report</td>'; return `<td>${link(row.scheduled,{...selection,metric:'target'},'Target visits')}</td><td>${link(row.attended ?? row.onSchedule,{...selection,metric:'actual'},'Completed visits')}</td><td>${link(row.missedVisits,{...selection,metric:'missed'},'Not visited: scheduled visit records')}</td><td>${pct(row.strikeRate)}</td>${row.unknownVisits ? `<td>${link(row.unknownVisits,{...selection,metric:'unknown'},'Unverified visits')}</td>` : '<td>0</td>'}`; }
  function kpis(metrics,selection={}) {
    const items = [['Target Visits',metrics.scheduled,'#5b9bd5',{metric:'target'}],['Actual Visits',metrics.attended ?? metrics.onSchedule,'#22c55e',{metric:'actual'}],['Attendance',pct(metrics.strikeRate),'#f58220',null],['Stores Not Visited',metrics.missedStores,'#d94f3a',{metric:'missed',unit:'stores'}],['Targeted Stores',metrics.totalStores,'#9dc4ec',{metric:'target',unit:'stores'}],['Unverified Visits',metrics.unknownVisits,'#e8a838',{metric:'unknown'}]];
    return `<section class="pg-source-kpis">${items.map(([label,value,color,detail])=>`<article class="pg-source-kpi" style="--pg-accent:${color}"><span>${label}</span><strong>${detail ? link(value,{...selection,...detail},label) : value}</strong><small>${label === 'Stores Not Visited' ? 'Distinct stores with no completed or unverified visits' : label === 'Attendance' ? 'Completed / targeted visits' : 'Current selection'}</small></article>`).join('')}</section>`;
  }
  const managerKey = value => String(value || '').trim().replace(/\s+/g,' ').normalize('NFKC').toUpperCase();
  function scorecard(data) {
    return `<article class="pg-source-card attendance-scorecard"><header><h2>Manager and team scorecard</h2>${exportButton()}</header>${(data.charts.byManager || []).map(manager=>{
      const rows = data.rows.filter(r=>managerKey(r.manager) === managerKey(manager.label));
      return `<details class="attendance-team"><summary><span>${escape(manager.label)}</span><small>${rows.length} team members</small></summary>${table(['Team member','Target','Actual','Not Visited (visits)','Attendance','Unverified'],[
        `<tr class="attendance-total"><th scope="row">Team total</th>${cells(manager,{lineManager:manager.label})}</tr>`,
        ...rows.map(r=>`<tr><td>${escape(r.userName)}${data.audience === 'merchandiser' ? `<small>Rep: ${escape(r.rep || 'Unassigned')}</small>` : ''}</td>${cells(r,{person:r.userCode || r.userName,lineManager:manager.label})}</tr>`)
      ])}</details>`;
    }).join('') || '<p>No manager records in this selection.</p>'}</article>`;
  }
  function regionCards(data) {
    const divisions = ['CENTRAL','INLAND','COASTAL'];
    return `<section class="pg-source-overview-grid"><article class="pg-source-card"><header><h2>Attendance by division</h2></header><div class="pg-source-ring-row">${divisions.map((d,i)=>{
      const row = data.charts.byDivision.find(r=>r.label===d) || {};
      return `<div class="pg-source-ring-group"><div class="pg-source-ring" style="--pg-progress:${Math.min(100,row.strikeRate || 0)};--pg-ring:${['#22c55e','#4fa3e3','#f58220'][i]}"><b>${pct(row.strikeRate)}</b></div><strong>${d}</strong><small>${link(row.attended,{division:d,metric:'actual'},`${d} completed visits`)} of ${link(row.scheduled,{division:d,metric:'target'},`${d} target visits`)}</small></div>`;
    }).join('')}</div></article><article class="pg-source-card"><header><h2>Attendance by ${data.audience === 'merchandiser' ? 'merchandiser' : 'rep'} type</h2></header>${table(['Type','Target','Actual','Not Visited (visits)','Attendance','Unverified'],data.charts.byRole.map(r=>`<tr><td>${escape(r.label)}</td>${cells(r,{role:r.label})}</tr>`))}</article></section><section class="pg-source-overview-grid">${['Attendance by region','Missed stores by region'].map((title,i)=>`<article class="pg-source-card"><header><h2>${title}</h2></header>${table(i ? ['Region','Division','Targeted Stores','Not Visited (stores)','Unverified Stores'] : ['Region','Target','Actual','Not Visited (visits)','Attendance','Unverified'],data.charts.byRegion.map(r=>`<tr><td>${escape(r.label)}</td>${i ? `<td>${escape(global.NexusAttendance.division(r.label))}</td><td>${link(r.totalStores,{region:r.label,unit:'stores',metric:'target'},'Targeted stores')}</td><td>${link(r.missedStores,{region:r.label,unit:'stores',metric:'missed'},'Distinct stores not visited')}</td><td>${link(r.unknownStores,{region:r.label,unit:'stores',metric:'unknown'},'Unverified stores')}</td>` : cells(r,{region:r.label})}</tr>`))}</article>`).join('')}</section>`;
  }
  function roster(data) {
    const merch = data.audience === 'merchandiser';
    return `<article class="pg-source-card"><header><h2>${merch?'Merchandiser':'Rep'} roster</h2>${exportButton()}</header>${table([merch?'Merchandiser':'Rep',...(merch?['Rep']:[]),'Line / Channel Manager','Region','Target','Actual','Not Visited (visits)','Attendance','Unverified'],data.rows.map(r=>`<tr><td>${escape(r.userName)}</td>${merch?`<td>${escape(r.rep || 'Unassigned')}</td>`:''}<td>${escape(r.manager)}</td><td>${escape(r.region)}</td>${cells(r,{person:r.userCode || r.userName,lineManager:r.manager})}</tr>`))}</article>`;
  }
  function stores(data) {
    const merch = data.audience === 'merchandiser';
    return `<article class="pg-source-card"><header><h2>Attendance by store</h2>${exportButton({unit:'stores'})}</header>${table(['Store','Status',merch?'Merchandiser':'Rep',...(merch?['Rep']:[]),'Line / Channel Manager','Region','Target','Actual','Not Visited (visits)','Attendance','Unverified'],[...data.stores].sort((a,b)=>(a.attended-b.attended)||a.storeName.localeCompare(b.storeName)).map(r=>`<tr><td>${escape(r.storeName)}<small>${escape(r.storeCodes.join(', '))}</small></td><td>${status(r)}</td><td>${escape(r.resources.join(', '))}</td>${merch?`<td>${escape(r.reps.join(', '))}</td>`:''}<td>${escape(r.managers.join(', '))}</td><td>${escape(r.region)}</td>${cells(r,{store:r.storeId})}</tr>`))}</article>`;
  }
  function daily(data,selected) {
    const days = data.scheduleAnalytics.daily, date = days.some(day=>day.label===selected) ? selected : days.at(-1)?.label || '', row = days.find(r=>r.label===date) || {};
    return `<section class="pg-source-datebar"><label>Daily Visit Detail <select data-attendance-date aria-label="Attendance date">${days.map(r=>`<option value="${escape(r.label)}"${r.label===date?' selected':''}>${escape(r.label)}</option>`).join('')}</select></label>${exportButton({date})}</section>${kpis(row,{date})}<article class="pg-source-card"><header><h2>Daily attendance</h2></header>${table(['Date','Target','Actual','Not Visited (visits)','Attendance','Unverified'],days.map(r=>`<tr${r.label===date?' class="attendance-total"':''}><td>${escape(r.label)}</td>${cells(r,{date:r.label})}</tr>`))}</article>`;
  }
  function reconciliation(data) {
    return `<details class="attendance-reconciliation"><summary>Hierarchy reconciliation (${n(data.reconciliation.length)})</summary>${table(['Person','Rep','Manager','Region','Issue'],data.reconciliation.map(r=>`<tr><td>${escape(r.userName)}</td><td>${escape(r.rep)}</td><td>${escape(r.manager)}</td><td>${escape(r.region)}</td><td>${escape(r.issue)}</td></tr>`))}</details>`;
  }
  function detailRows(result,audience) {
    const merch = audience === 'merchandiser';
    return table(['Scheduled date','Completed date','Store code','Store','Status','Geo result',merch?'Merchandiser':'Rep',...(merch?['Rep']:[]),'Line / Channel Manager','Region','Brand','Source row'],result.rows.map(r=>`<tr><td>${escape(r.date || (r.dates || []).join(', '))}</td><td>${escape(r.completedDate || (r.completedDates || []).join(', '))}</td><td>${escape(r.storeCode || (r.storeCodes || []).join(', '))}</td><td>${escape(r.storeName)}</td><td>${status(r)}</td><td>${escape(r.result || '')}</td><td>${escape(r.userName || (r.resources || []).join(', '))}</td>${merch?`<td>${escape(r.rep || (r.reps || []).join(', '))}</td>`:''}<td>${escape(r.manager || (r.managers || []).join(', '))}</td><td>${escape(r.region)}</td><td>${escape(r.brand || (r.brands || []).join(", "))}</td><td>${escape(r.id)}</td></tr>`));
  }
  function render(container,data,options) {
    const previous = mounted.get(container), view = {data,options,date:options.date || (previous?.data.audience===data.audience ? previous.date : ''),selection:null,requestId:0};
    mounted.set(container,view);
    const valid = () => mounted.get(container) === view && (!options.current || options.current());
    function paint() {
      const page = options.page || 'overview';
      const content = page === 'stores' && options.stores ? options.stores.html(data) : page === 'users' && options.roster ? options.roster.html(data) : page === 'overview' && options.overview ? options.overview(data,{link,table,exportButton,cells}) : page === 'daily' && options.daily ? options.daily.html(data,view.date,{link,table,exportButton,cells}) : page === 'daily' ? daily(data,view.date) : kpis(data.metrics) + (page === 'users' ? roster(data) : page === 'stores' ? stores(data) : regionCards(data)+scorecard(data)+`<article class="pg-source-card"><header><h2>Weekly attendance</h2></header>${table(['Geo week','Target','Actual','Not Visited (visits)','Attendance','Unverified'],data.scheduleAnalytics.weekly.map(r=>`<tr><td>${escape(r.label)}</td>${cells(r,{week:r.label})}</tr>`))}</article>`);
      const reference=page === 'daily' ? null : data.quality.strikeRateTotals;
      container.innerHTML = `${options.filterBar || ''}<section class="pg-source-page attendance-analytics">${content}<p class="attendance-quality">${escape(data.quality.basis)}. ${data.quality.warnings.map(escape).join(' ')}${reference && !options.filters?.banner && !options.filters?.channel ? ` Strike-rate reference: ${n(reference.scheduled)} target / ${n(reference.actual)} actual; this view uses the individual schedule records.` : ''}</p>${reconciliation(data)}<section class="attendance-drilldown" hidden aria-live="polite"></section><p class="attendance-action-status" role="status"></p></section>`;
      if(page === 'daily' && options.daily) options.daily.mount(container,data,view.date,{link,table,exportButton,cells},{request:options.request,filters:options.filters,current:valid});
      if(page === 'users' && options.roster) options.roster.mount(container,data,{link,table,exportButton,cells},{request:options.request,filters:options.filters,current:valid,query:options.rosterQuery,onQueryChange:options.onRosterQueryChange});
      if(page === 'stores' && options.stores) options.stores.mount(container,data,{link,table,exportButton,cells},{request:options.request,filters:options.filters,current:valid,selection:options.storeSelection,onSelectionChange:options.onStoreSelectionChange});
    }
    async function open(selection,page=1) {
      view.selection = selection; const id = ++view.requestId;
      const panel = container.querySelector('.attendance-drilldown'); panel.hidden = false; panel.innerHTML = '<p>Loading source records...</p>';
      try {
        const result = await options.request({mode:'detail',audience:data.audience,filters:options.filters,selection,version:data.version,page,pageSize:100});
        if (!valid() || id!==view.requestId) return;
        panel.innerHTML = `<header><h2>${escape(({target:'Target',actual:'Actual',missed:'Not Visited',unknown:'Unverified'})[result.metric])}: ${n(result.total)} ${escape(result.unit)}</h2>${exportButton(selection)}<button type="button" data-attendance-close aria-label="Close details">&#215;</button></header>${detailRows(result,data.audience)}<footer><button type="button" data-attendance-detail-page="${page-1}"${page<=1?' disabled':''}>Previous</button><span>Page ${page} of ${result.pageCount}</span><button type="button" data-attendance-detail-page="${page+1}"${page>=result.pageCount?' disabled':''}>Next</button></footer>`;
        panel.scrollIntoView({block:'start',behavior:'smooth'});
      } catch(error) { if(valid() && id===view.requestId) panel.innerHTML=`<p role="alert">${escape(error.message || error)}</p>`; }
    }
    async function download(selection,button) {
      button.disabled = true; const status = container.querySelector('.attendance-action-status'); status.textContent = 'Preparing Excel...';
      try {
        const result = await options.request({mode:'export',audience:data.audience,filters:options.filters,selection,version:data.version});
        if(!valid()) return;
        const bytes=Uint8Array.from(atob(result.base64),c=>c.charCodeAt(0)), url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
        const a=document.createElement('a');a.href=url;a.download=result.fileName;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
        status.textContent=`Excel ready: ${n(result.total)} records.`;
      } catch(error) {if(valid()) status.textContent=error.message || String(error);} finally {button.disabled=false;}
    }
    container.onclick = event => {
      if (!valid()) return;
      const button=event.target.closest('button'); if(!button) return;
      if(button.dataset.attendanceDetail) open(JSON.parse(button.dataset.attendanceDetail));
      else if(button.dataset.attendanceExport) download(JSON.parse(button.dataset.attendanceExport),button);
      else if(button.dataset.attendanceDetailPage) open(view.selection,Number(button.dataset.attendanceDetailPage));
      else if(button.hasAttribute('data-attendance-close')) {view.requestId++;container.querySelector('.attendance-drilldown').hidden=true;}
    };
    container.onchange = event => {if(event.target.hasAttribute('data-attendance-date')) {view.date=event.target.value;options.onDateChange?.(view.date);view.requestId++;paint();}};
    paint();
  }
  const division = region => /FREE\s*STATE|NORTH[ -]*WEST/i.test(region) ? 'CENTRAL' : /WESTERN|EASTERN|KWA|NATAL|PORT ELIZABETH|EAST LONDON|COAST|SWD|PE OPERATIONS/i.test(region) ? 'COASTAL' : /GAUTENG|MPUMALANGA|LIMPOPO/i.test(region) ? 'INLAND' : 'UNASSIGNED';
  global.NexusAttendance = {render,division};
})(window);
