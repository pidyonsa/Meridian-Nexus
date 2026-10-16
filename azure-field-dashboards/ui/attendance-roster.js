(function(global) {
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const key=value=>String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ').toUpperCase();
  const personKey=row=>key(row.userCode||row.userName);
  const n=value=>Number(value||0).toLocaleString('en-ZA');
  const pct=value=>Number.isFinite(value)?value.toFixed(1)+'%':'--';
  const hasSchedule=row=>!row.noSchedule&&Number.isFinite(row.scheduled)&&row.scheduled>0;
  const tone=value=>value>=95?'good':value>=90?'watch':'low';
  const select=row=>({person:row.userCode||row.userName,lineManager:row.manager});
  const detail=(text,selection,title)=>`<button type="button" class="attendance-count" data-attendance-detail="${esc(JSON.stringify(selection))}" aria-label="${esc(title)}">${esc(text)}</button>`;
  const pageSize=100;
  function matchingRows(data,query='') {
    const search=key(query);
    return data.rows.filter(row=>!search||key(row.userName).includes(search)).sort((a,b)=>{
      if(hasSchedule(a)!==hasSchedule(b))return hasSchedule(a)?-1:1;
      return (hasSchedule(a)?a.strikeRate-b.strikeRate:0)||a.userName.localeCompare(b.userName)||String(a.manager||'').localeCompare(String(b.manager||''));
    });
  }
  function summary(rows) {
    const people=new Map();
    for(const row of rows){
      const id=personKey(row),person=people.get(id)||{userName:row.userName,person:row.userCode||row.userName,scheduled:0,attended:0};
      if(hasSchedule(row)){person.scheduled+=row.scheduled;person.attended+=row.attended;}
      people.set(id,person);
    }
    const ranked=[...people.values()].filter(row=>row.scheduled>0).map(row=>({...row,strikeRate:row.attended/row.scheduled*100})).sort((a,b)=>a.strikeRate-b.strikeRate||a.userName.localeCompare(b.userName));
    return {count:people.size,active:ranked.filter(row=>row.attended>0).length,average:ranked.length?ranked.reduce((sum,row)=>sum+row.strikeRate,0)/ranked.length:null,
      highest:[...ranked].sort((a,b)=>b.strikeRate-a.strikeRate||a.userName.localeCompare(b.userName))[0],lowest:ranked[0],scheduledPeople:ranked.length};
  }
  function kpis(data,rows) {
    const stats=summary(rows),plural=data.audience==='rep'?'Reps':'Merchandisers';
    const performer=person=>person?detail(pct(person.strikeRate),{person:person.person,metric:'target'},'Inspect '+person.userName+' attendance'):'--';
    const cards=[
      [plural,`<button type="button" class="attendance-count" data-roster-focus="search" aria-label="Search ${plural.toLowerCase()}">${n(stats.count)}</button>`,`${n(stats.active)} active this month`,'#22c55e'],
      ['Avg attendance',`<button type="button" class="attendance-count" data-roster-focus="verification" aria-label="Inspect roster attendance" title="Mean attendance per person with scheduled visits; staff without a schedule are excluded">${pct(stats.average)}</button>`,`Across ${n(stats.scheduledPeople)} scheduled ${plural.toLowerCase()}`,'#eb543c'],
      ['Top performer',performer(stats.highest),stats.highest?.userName||'No scheduled visits','#ff761b'],
      ['Needs attention',performer(stats.lowest),stats.lowest?.userName||'No scheduled visits','#3b82f6']
    ];
    return cards.map(([label,value,note,color])=>`<article class="pg-source-kpi" style="--pg-accent:${color}"><span>${label}</span><strong>${value}</strong><small title="${esc(note)}">${esc(note)}</small></article>`).join('');
  }
  function progress(row) {
    if(!hasSchedule(row))return '<span class="attendance-roster-no-schedule">No schedule</span>';
    return `<button type="button" class="attendance-roster-progress tone-${tone(row.strikeRate)}" data-attendance-detail="${esc(JSON.stringify({...select(row),metric:'target'}))}" aria-label="${esc(row.userName)} attendance: ${pct(row.strikeRate)}"><span class="attendance-bar-track"><span style="width:${Math.max(0,Math.min(100,row.strikeRate))}%"></span></span><b>${pct(row.strikeRate)}</b></button>`;
  }
  function table(data,rows,h) {
    const merch=data.audience==='merchandiser';
    return h.table([merch?'Merchandiser':'Rep',...(merch?['Rep']:[]),'Region','Manager','Stores','Target','Actual','Progress'],rows.map(row=>{
      const selection=select(row),cell=(value,metric,unit)=>hasSchedule(row)?h.link(value,{...selection,metric,...(unit?{unit}:{})},`${row.userName}: ${metric} ${unit||'visits'}`):'<span title="No schedule detail in the report">--</span>';
      return `<tr data-roster-person="${esc(personKey(row))}"><th scope="row">${hasSchedule(row)?detail(row.userName,{...selection,metric:'target'},'Inspect '+row.userName+' visits'):esc(row.userName)}</th>${merch?`<td>${esc(row.rep||'Unassigned')}</td>`:''}<td>${esc(row.region||'Unassigned')}</td><td>${esc(row.manager||'Unassigned')}</td><td>${cell(row.totalStores,'target','stores')}</td><td>${cell(row.scheduled,'target')}</td><td>${cell(row.attended,'actual')}</td><td>${progress(row)}</td></tr>`;
    }));
  }
  function verification(data,rows,h) {
    return h.table([data.audience==='rep'?'Rep':'Merchandiser','Manager','Target','Actual','Not visited (visits)','Attendance','Unverified'],rows.map(row=>`<tr><td>${esc(row.userName)}</td><td>${esc(row.manager)}</td>${h.cells(row,select(row))}</tr>`));
  }
  function html(data) {
    const name=data.audience==='rep'?'Rep':'Merchandiser';
    return `<div class="attendance-roster" data-roster-root data-audience="${data.audience==='rep'?'rep':'merchandiser'}"><section class="pg-source-kpis attendance-roster-kpis" data-roster-kpis></section><section class="pg-source-card attendance-roster-card"><header><div class="attendance-roster-heading"><h2>${name} roster</h2><small data-roster-count role="status"></small></div><div class="attendance-roster-tools"><label><span class="roster-sr-only">Search ${name.toLowerCase()} name</span><input type="search" data-roster-search maxlength="120" placeholder="Search ${name.toLowerCase()} name..." aria-label="Search ${name.toLowerCase()} name" autocomplete="off"></label><button type="button" class="attendance-export" data-roster-export><i class="ph ph-file-xls" aria-hidden="true"></i> Export to Excel</button></div></header><div data-roster-table></div><footer class="attendance-roster-pagination"><span data-roster-page-count></span><div><button type="button" data-roster-page="previous" aria-label="Previous roster page" title="Previous page"><i class="ph ph-caret-left" aria-hidden="true"></i></button><button type="button" data-roster-page="next" aria-label="Next roster page" title="Next page"><i class="ph ph-caret-right" aria-hidden="true"></i></button></div></footer></section><details class="attendance-roster-verification"><summary>Visit and verification detail</summary><div data-roster-verification></div></details><p data-roster-status role="status"></p></div>`;
  }
  function workbook(data,rows,query,filters,ExcelJS) {
    const merch=data.audience==='merchandiser',book=new ExcelJS.Workbook();book.creator='Meridian Nexus';
    const sheet=book.addWorksheet(merch?'Merchandiser roster':'Rep roster');
    const headers=[merch?'Merchandiser':'Rep','User code',...(merch?['Rep']:[]),'Region','Manager','Stores','Target','Actual','Attendance','Not visited (visits)','Unverified','Schedule status'];
    sheet.addRow(headers);
    for(const row of rows){
      const scheduled=hasSchedule(row);
      sheet.addRow([row.userName,row.userCode||'',...(merch?[row.rep||'Unassigned']:[]),row.region,row.manager,...(scheduled?[row.totalStores,row.scheduled,row.attended,row.strikeRate/100,row.missedVisits,row.unknownVisits]:[null,null,null,null,null,null]),scheduled?'Scheduled':'No schedule detail']);
    }
    sheet.views=[{state:'frozen',ySplit:1}];sheet.autoFilter={from:{row:1,column:1},to:{row:sheet.rowCount,column:headers.length}};
    sheet.columns.forEach((column,i)=>{column.width=['Rep','Merchandiser','Manager','Schedule status'].includes(headers[i])?30:headers[i]==='Region'?22:18;});
    sheet.getColumn(headers.indexOf('Attendance')+1).numFmt='0.0%';
    sheet.getRow(1).font={bold:true,color:{argb:'FFF3F7FC'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0B1D39'}};
    const meta=book.addWorksheet('Selection');meta.columns=[{width:30},{width:110}];
    const stats=summary(rows);
    for(const [name,value] of Object.entries({audience:data.audience,reportStartDate:data.reportStartDate,reportEndDate:data.reportEndDate,updatedAt:data.updatedAt,version:data.version,filters,search:query,rows:rows.length,people:stats.count,activePeople:stats.active,averageAttendance:stats.average,averageBasis:'Mean per person with scheduled visits; missing schedules excluded',sort:'Lowest attendance first; no schedule last'}))meta.addRow([name,value==null?'':typeof value==='object'?JSON.stringify(value):value]);
    return book;
  }
  function mount(container,data,h,context) {
    const root=container.querySelector('[data-roster-root]'),input=root.querySelector('[data-roster-search]'),exportButton=root.querySelector('[data-roster-export]'),status=root.querySelector('[data-roster-status]');
    const current=()=>context.current()&&root.isConnected&&container.contains(root);
    let query=context.query||'',page=1,rows=[],timer,busy=false;
    input.value=query;
    function paint() {
      if(!current())return;
      rows=matchingRows(data,query);page=Math.min(page,Math.max(1,Math.ceil(rows.length/pageSize)));
      const first=(page-1)*pageSize,visible=rows.slice(first,first+pageSize),stats=summary(rows);
      root.querySelector('[data-roster-kpis]').innerHTML=kpis(data,rows);
      root.querySelector('[data-roster-count]').textContent=`${n(stats.count)} ${data.audience==='rep'?'reps':'merchandisers'}${rows.length!==stats.count?`, ${n(rows.length)} reporting lines`:''} - lowest attendance first`;
      root.querySelector('[data-roster-table]').innerHTML=table(data,visible,h);
      root.querySelector('[data-roster-verification]').innerHTML=verification(data,visible,h);
      root.querySelector('[data-roster-page-count]').textContent=rows.length?`${n(first+1)}-${n(Math.min(first+pageSize,rows.length))} of ${n(rows.length)}`:'0 results';
      root.querySelector('[data-roster-page="previous"]').disabled=page===1;
      root.querySelector('[data-roster-page="next"]').disabled=page*pageSize>=rows.length;
      exportButton.disabled=!rows.length||busy;root.dataset.query=query;root.dataset.rows=rows.length;
    }
    input.oninput=()=>{clearTimeout(timer);query=input.value;page=1;context.onQueryChange?.(query);status.textContent='';timer=setTimeout(paint,100);};
    root.addEventListener('click',async event=>{
      if(!current())return;
      const button=event.target.closest('button');if(!button)return;
      if(button.dataset.rosterPage){clearTimeout(timer);page+=button.dataset.rosterPage==='next'?1:-1;paint();root.querySelector('[data-roster-table] .pg-source-table-wrap').focus();}
      else if(button.dataset.rosterFocus==='search'){input.focus();}
      else if(button.dataset.rosterFocus==='verification'){const panel=root.querySelector('.attendance-roster-verification');panel.open=true;panel.scrollIntoView({block:'nearest'});panel.querySelector('summary').focus();}
      else if(button.hasAttribute('data-roster-export')&&!busy){
        clearTimeout(timer);paint();if(!rows.length)return;
        busy=true;exportButton.disabled=true;input.disabled=true;status.textContent='Preparing roster Excel...';
        const snapshot=[...rows],search=query;
        try {
          // Validate source version before exporting the same rows displayed in this view.
          const latest=await context.request({mode:'dashboard',audience:data.audience,filters:context.filters,version:data.version,refresh:true});
          if(!current())return;
          if(latest.version!==data.version)throw Error('Attendance refreshed. Use Refresh now before exporting.');
          const ExcelJS=await global.AttendanceExcel.load();if(!current())return;
          const bytes=await workbook(data,snapshot,search,context.filters||{},ExcelJS).xlsx.writeBuffer();if(!current())return;
          const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
          const a=document.createElement('a');a.href=url;a.download=`Attendance-${data.audience}-roster-${data.reportEndDate||'latest'}.xlsx`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
          status.textContent=`Excel ready: ${n(snapshot.length)} roster rows.`;
        }catch(error){if(current())status.textContent=error.message||'Roster export failed. Please retry.';}
        finally{busy=false;if(current()){exportButton.disabled=!rows.length;input.disabled=false;}}
      }
    });
    paint();
  }
  global.AttendanceRoster={html,mount,matchingRows,summary,workbook,kpis,pageSize};
})(typeof window==='undefined'?globalThis:window);
