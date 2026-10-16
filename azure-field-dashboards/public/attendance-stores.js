(function(global) {
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const key=value=>String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ').toUpperCase();
  const n=value=>Number(value||0).toLocaleString('en-ZA');
  const values=items=>(items||[]).filter(value=>key(value)&&!['UNASSIGNED','NOT SET','NOTSET','-'].includes(key(value)));
  const joined=items=>values(items).join(', ')||'Unassigned';
  const status=row=>row.attended>0?'visited':row.unknownVisits>0?'unknown':'missed';
  const labels={all:'All stores',visited:'Visited',missed:'Missed',unknown:'Unverified'};
  const rank={missed:0,unknown:1,visited:2},pageSize=100;
  const hasBanner=data=>values(data.availableFilters?.banners).length>0||data.stores.some(row=>values(row.banners).length);
  const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function day(value,year) {
    const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||''));if(!match)return String(value||'');
    const date=new Date(Date.UTC(+match[1],match[2]-1,+match[3]));
    return `${days[date.getUTCDay()]} ${match[3]} ${months[date.getUTCMonth()]}${year?' '+match[1]:''}`;
  }
  const dateList=(items,year)=>[...new Set(items||[])].filter(Boolean).sort().map(value=>day(value,year));
  function missedDatesCell(row) {
    const list=dateList(row.missedDates);if(!list.length)return '<td class="attendance-store-dates is-empty">-</td>';
    const shown=list.slice(0,4),more=list.length-shown.length;
    return `<td class="attendance-store-dates" title="${esc(list.join(', '))}">${shown.map(value=>`<span>${esc(value)}</span>`).join(', ')}${more?` <small>+${more} more</small>`:''}</td>`;
  }
  function matchingRows(data,query='',selection='all') {
    const search=key(query);
    return data.stores.filter(row=>(selection==='all'||status(row)===selection)&&(!search||[row.storeName,...(row.storeCodes||[]),...(row.resources||[]),...(row.reps||[])].some(value=>key(value).includes(search))))
      .sort((a,b)=>rank[status(a)]-rank[status(b)]||a.storeName.localeCompare(b.storeName)||a.storeId.localeCompare(b.storeId));
  }
  function summary(rows) {
    const counts={total:rows.length,visited:0,missed:0,unknown:0};
    for(const row of rows)counts[status(row)]++;
    return {...counts,missedPercent:counts.total?counts.missed/counts.total*100:null};
  }
  function kpis(rows,selection) {
    const stats=summary(rows);
    return [
      ['Total stores',n(stats.total),'In current filter','all','#22c55e'],
      ['Visited',n(stats.visited),'Stores with a completed visit','visited','#eb543c'],
      ['Missed',n(stats.missed),'Not yet visited','missed','#ff761b'],
      ['% Missed',stats.missedPercent===null?'--':stats.missedPercent.toFixed(1)+'%','Of assigned stores','missed','#3b82f6']
    ].map(([label,value,note,filter,color])=>`<article class="pg-source-kpi" style="--pg-accent:${color}"><span>${label}</span><strong><button type="button" class="attendance-count" data-store-filter="${filter}" aria-pressed="${selection===filter}" aria-label="Show ${labels[filter].toLowerCase()}">${value}</button></strong><small>${note}</small></article>`).join('');
  }
  function table(data,rows,h) {
    const merch=data.audience==='merchandiser',banner=hasBanner(data);
    return h.table(['Status','Store',merch?'Merchandiser':'Rep',...(merch?['Rep']:[]),'Region',...(banner?['Banner']:[]),merch?'Line / Channel Manager':'Manager','Missed dates','Target','Actual'],rows.map(row=>{
      const state=status(row),selection={store:row.storeId};
      const detail=(text,metric,unit,cls='attendance-count')=>`<button type="button" class="${cls}" data-attendance-detail="${esc(JSON.stringify({...selection,metric,...(unit?{unit}:{})}))}" aria-label="${esc(row.storeName+': '+text)}">${esc(text)}</button>`;
      return `<tr data-store-id="${esc(row.storeId)}"><td>${detail(labels[state],state==='visited'?'actual':state,'stores','attendance-store-badge is-'+state)}</td><th scope="row">${detail(row.storeName,'target')}</th><td>${esc(joined(row.resources))}</td>${merch?`<td>${esc(joined(row.reps))}</td>`:''}<td>${esc(row.region||'Unassigned')}</td>${banner?`<td>${esc(joined(row.banners))}</td>`:''}<td>${esc(joined(row.managers))}</td>${missedDatesCell(row)}<td>${h.link(row.scheduled,{...selection,metric:'target'},row.storeName+': target visits')}</td><td>${h.link(row.attended,{...selection,metric:'actual'},row.storeName+': completed visits')}</td></tr>`;
    }));
  }
  function verification(data,rows,h) {
    return h.table(['Store',data.audience==='rep'?'Rep':'Merchandiser','Target','Actual','Not visited (visits)','Attendance','Unverified'],rows.map(row=>`<tr><td>${esc(row.storeName)}</td><td>${esc(joined(row.resources))}</td>${h.cells(row,{store:row.storeId})}</tr>`));
  }
  function html(data) {
    const placeholder=data.audience==='rep'?'Search rep or store...':'Search merchandiser, rep or store...';
    return `<div class="attendance-stores" data-store-root data-audience="${data.audience==='rep'?'rep':'merchandiser'}" data-banner="${hasBanner(data)}"><section class="pg-source-kpis attendance-store-kpis" data-store-kpis></section><div class="attendance-store-unknown" data-store-unknown></div><section class="pg-source-card attendance-store-card"><header><div class="attendance-roster-heading"><h2>Attendance detail by store</h2><small data-store-count role="status"></small></div><div class="attendance-roster-tools"><label><span class="roster-sr-only">${placeholder}</span><input type="search" data-store-search maxlength="120" placeholder="${placeholder}" aria-label="${placeholder}" autocomplete="off"></label><button type="button" class="attendance-export" data-store-export><i class="ph ph-file-xls" aria-hidden="true"></i> Export to Excel</button></div></header><div data-store-table></div><footer class="attendance-roster-pagination"><span data-store-page-count></span><div><button type="button" data-store-page="previous" aria-label="Previous store page" title="Previous page"><i class="ph ph-caret-left" aria-hidden="true"></i></button><button type="button" data-store-page="next" aria-label="Next store page" title="Next page"><i class="ph ph-caret-right" aria-hidden="true"></i></button></div></footer></section><details class="attendance-roster-verification"><summary>Visit and verification detail</summary><div data-store-verification></div></details><p data-store-status role="status"></p></div>`;
  }
  function workbook(data,rows,query,selection,filters,ExcelJS) {
    const merch=data.audience==='merchandiser',banner=hasBanner(data),book=new ExcelJS.Workbook();book.creator='Meridian Nexus';
    const sheet=book.addWorksheet('Attendance by store');
    const headers=['Status','Store','Store codes',merch?'Merchandiser':'Rep',...(merch?['Rep']:[]),'Region',...(banner?['Banner']:[]),'Manager','Target','Actual','Not visited (visits)','Unverified visits','Missed dates','Scheduled dates','Store ID'];
    sheet.addRow(headers);
    for(const row of rows)sheet.addRow([labels[status(row)],row.storeName,(row.storeCodes||[]).join(', '),joined(row.resources),...(merch?[joined(row.reps)]:[]),row.region,...(banner?[joined(row.banners)]:[]),joined(row.managers),row.scheduled,row.attended,row.missedVisits,row.unknownVisits,dateList(row.missedDates,true).join(', '),dateList(row.dates,true).join(', '),row.storeId]);
    sheet.views=[{state:'frozen',ySplit:1}];sheet.autoFilter={from:{row:1,column:1},to:{row:sheet.rowCount,column:headers.length}};
    sheet.columns.forEach((column,i)=>{column.width=['Missed dates','Scheduled dates'].includes(headers[i])?60:['Store','Rep','Merchandiser','Manager','Store ID'].includes(headers[i])?36:20;});
    sheet.getRow(1).font={bold:true,color:{argb:'FFF3F7FC'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0B1D39'}};
    const meta=book.addWorksheet('Selection');meta.columns=[{width:30},{width:110}];
    for(const [name,value] of Object.entries({audience:data.audience,reportStartDate:data.reportStartDate,reportEndDate:data.reportEndDate,updatedAt:data.updatedAt,version:data.version,filters,search:query,status:selection,rows:rows.length,summary:summary(rows),sort:'Missed, then unverified, then visited; store name',basis:'Distinct stores. Visited: at least one completed visit. Unverified is not counted as missed.'}))meta.addRow([name,value==null?'':typeof value==='object'?JSON.stringify(value):value]);
    return book;
  }
  function mount(container,data,h,context) {
    const root=container.querySelector('[data-store-root]'),input=root.querySelector('[data-store-search]'),exportButton=root.querySelector('[data-store-export]'),message=root.querySelector('[data-store-status]');
    const current=()=>context.current()&&root.isConnected&&container.contains(root);
    let query=context.selection?.query||'',selection=Object.hasOwn(labels,context.selection?.status)?context.selection.status:'all',page=1,rows=[],timer,busy=false;
    input.value=query;
    const remember=()=>context.onSelectionChange?.({query,status:selection});
    function paint() {
      if(!current())return;
      const all=matchingRows(data,query),stats=summary(all);rows=selection==='all'?all:all.filter(row=>status(row)===selection);
      page=Math.min(page,Math.max(1,Math.ceil(rows.length/pageSize)));
      const first=(page-1)*pageSize;
      root.querySelector('[data-store-kpis]').innerHTML=kpis(all,selection);
      root.querySelector('[data-store-unknown]').innerHTML=stats.unknown?`<button type="button" data-store-filter="unknown" aria-pressed="${selection==='unknown'}">${n(stats.unknown)} unverified ${stats.unknown===1?'store':'stores'}</button><span>Awaiting confirmation; not counted as missed.</span>`:'';
      root.querySelector('[data-store-count]').textContent=`${n(rows.length)} stores - ${selection==='all'?'missed stores first':labels[selection].toLowerCase()+' stores'}`;
      root.querySelector('[data-store-table]').innerHTML=table(data,rows.slice(first,first+pageSize),h);
      root.querySelector('[data-store-verification]').innerHTML=verification(data,rows.slice(first,first+pageSize),h);
      root.querySelector('[data-store-page-count]').textContent=rows.length?`${n(first+1)}-${n(Math.min(first+pageSize,rows.length))} of ${n(rows.length)}`:'0 results';
      root.querySelector('[data-store-page="previous"]').disabled=page===1;
      root.querySelector('[data-store-page="next"]').disabled=page*pageSize>=rows.length;
      exportButton.disabled=!rows.length||busy;root.dataset.query=query;root.dataset.status=selection;root.dataset.rows=rows.length;
      root.querySelectorAll('[data-store-filter]').forEach(button=>{button.disabled=busy;});
    }
    input.oninput=()=>{clearTimeout(timer);query=input.value;page=1;remember();message.textContent='';timer=setTimeout(paint,100);};
    root.addEventListener('click',async event=>{
      if(!current())return;
      const button=event.target.closest('button');if(!button)return;
      if(button.dataset.storeFilter&&!busy){clearTimeout(timer);selection=button.dataset.storeFilter;page=1;remember();message.textContent='';paint();root.querySelector('[data-store-table] .pg-source-table-wrap').focus({preventScroll:true});}
      else if(button.dataset.storePage){clearTimeout(timer);page+=button.dataset.storePage==='next'?1:-1;paint();root.querySelector('[data-store-table] .pg-source-table-wrap').focus();}
      else if(button.hasAttribute('data-store-export')&&!busy){
        clearTimeout(timer);paint();if(!rows.length)return;
        busy=true;exportButton.disabled=true;input.disabled=true;message.textContent='Preparing store Excel...';
        root.querySelectorAll('[data-store-filter]').forEach(button=>{button.disabled=true;});
        const snapshot=[...rows],search=query,selected=selection;
        try {
          // Keep the export aligned with the displayed source version and full selection, not just this page.
          const latest=await context.request({mode:'dashboard',audience:data.audience,filters:context.filters,version:data.version,refresh:true});
          if(!current())return;
          if(latest.version!==data.version)throw Error('Attendance refreshed. Use Refresh now before exporting.');
          const ExcelJS=await global.AttendanceExcel.load();if(!current())return;
          const bytes=await workbook(data,snapshot,search,selected,context.filters||{},ExcelJS).xlsx.writeBuffer();if(!current())return;
          const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
          const a=document.createElement('a');a.href=url;a.download=`Attendance-${data.audience}-stores-${selected}-${data.reportEndDate||'latest'}.xlsx`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
          message.textContent=`Excel ready: ${n(snapshot.length)} ${labels[selected].toLowerCase()} rows.`;
        }catch(error){if(current())message.textContent=error.message||'Store export failed. Please retry.';}
        finally{busy=false;if(current()){exportButton.disabled=!rows.length;input.disabled=false;root.querySelectorAll('[data-store-filter]').forEach(button=>{button.disabled=false;});}}
      }
    });
    paint();
  }
  global.AttendanceStores={html,mount,matchingRows,summary,status,hasBanner,workbook,kpis,pageSize,tableHtml:table};
})(typeof window==='undefined'?globalThis:window);
