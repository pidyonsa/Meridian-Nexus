(function(global){
  'use strict';
  const colors=['#ec6d25','#5b9bd5','#22c55e','#f4b332','#a5c9ef','#e9513d'];
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=(v,compact=false)=>Number.isFinite(v)?new Intl.NumberFormat('en-ZA',{maximumFractionDigits:1,...(compact?{notation:'compact'}:{})}).format(v):'Not available';
  const pct=v=>v===null?'Not available':num(v)+'%';
  const rank=(rows,field)=>global.FranchiseOrders.ranked(rows,field);
  const share=(row,rows,total,field)=>global.FranchiseOrders.share(row?.[field],total?.[field],rows,field);
  const pick=(key,value)=>`data-fo-pick="${key}" data-value="${esc(value)}"`;
  function value(v,field,currency,compact=false){
    if(field==='amount'&&Number.isFinite(v)&&/^[A-Z]{3}$/.test(currency||''))return new Intl.NumberFormat('en-ZA',{style:'currency',currency,maximumFractionDigits:compact?1:2,...(compact?{notation:'compact'}:{})}).format(v);
    return num(v,compact);
  }
  function color(p){return p===null?'#233b55':p>=25?'#2bad85':p>=10?'#5b9bd5':p>=5?'#3b6089':p>0?'#e5ac39':'#132d49';}
  function map(data,metric){
    const a=data.regionalAnalytics,geometry=global.FranchiseProvinceGeometry;
    return `<svg class="fr-map" viewBox="${geometry.viewBox}" role="group" aria-label="South African province ${metric==='amount'?'amount':'unit'} share">${geometry.provinces.map(p=>{
      const row=a.provinces.find(r=>r.label===p.name),pc=row?share(row,a.provinces,data.totals,metric):null;
      const title=`${p.name}: ${row?value(row[metric],metric,data.totals.currency)+' / '+pct(pc):'No matching order lines'}`;
      return `<path d="${p.path}" fill="${row?color(pc):'#132d49'}" ${row?`data-fr-province="${esc(p.name)}" role="button" tabindex="0" aria-label="${esc(title)}"`:''}><title>${esc(title)}</title></path>`;
    }).join('')}${geometry.provinces.map(p=>`<text x="${p.label[0]}" y="${p.label[1]}" text-anchor="middle">${esc(p.name)}</text>`).join('')}</svg>`;
  }
  function snapshot(title,row,field,data,tone){
    const empty=data.totals.lines?(field==='amount'&&data.totals.amount===0?'No recorded value':'Not available'):'No records';
    return `<article class="fr-snapshot" style="--fr-accent:${tone}"><h3>${title}</h3>${row?`<button type="button" class="fo-text-button" ${pick('region',row.label)}>${esc(row.label)}</button><small>${esc(value(row[field],field,data.totals.currency,true))} ${field==='units'?'units':field==='orders'?'orders':field==='stores'?'stores':'recorded amount'}</small>`:`<strong>${empty}</strong>`}</article>`;
  }
  function shares(data,field){
    const rows=rank(data.by.region,field),total=data.totals[field],valid=rows.length&&rows.every(r=>share(r,rows,data.totals,field)!==null);
    const title=field==='amount'?'Value share':'Volume share',accent=field==='amount'?colors[0]:colors[1];
    const shown=rows.slice(0,9),top=rows.slice(0,3).reduce((s,r)=>s+(r[field]||0),0);
    return `<section class="fr-shares" style="--fr-accent:${accent}" aria-label="${title}"><h3>${title}</h3>${valid?shown.map(r=>{
      const p=share(r,rows,data.totals,field);
      return `<button type="button" class="fr-share-row" ${pick('region',r.label)} title="${esc(r.label)}: ${esc(value(r[field],field,data.totals.currency))}"><span>${esc(r.label)}</span><span class="fr-share-track"><i style="width:${p}%"></i></span><small>${pct(p)}</small></button>`;
    }).join(''):`<p class="fr-empty">${total===0?'No recorded '+(field==='amount'?'amount':'units')+' in this selection.':'Shares are unavailable for missing, mixed-currency or negative values.'}</p>`}${valid?`<p class="fr-note">Top 3: ${pct(top/total*100)} of all selected ${field==='amount'?'amount':'units'}${rows.length>9?' / top 9 regions shown':''}</p>`:''}</section>`;
  }
  function tooltipDetails(data,metric,index){
    const period=data.regionalAnalytics.series[index];
    if(!period)return null;
    const date=day=>new Date(day+'T00:00:00Z').toLocaleDateString('en-ZA',{timeZone:'UTC',month:'short',year:'numeric',...(data.regionalAnalytics.granularity==='month'?{}:{day:'numeric'})});
    const title=date(period.start)+(data.regionalAnalytics.granularity==='week'&&period.end!==period.start?' - '+date(period.end):'');
    const format=v=>!Number.isFinite(v)?'Not available':metric==='amount'&&/^[A-Z]{3}$/.test(data.totals.currency||'')?value(v,metric,data.totals.currency):new Intl.NumberFormat('en-ZA',{maximumFractionDigits:metric==='amount'?2:10}).format(v);
    const rows=rank(data.by.region,metric).slice(0,6).map((region,i)=>{
      const recorded=period.regions.find(row=>row.label===region.label),total=recorded?recorded[metric]:0;
      return {label:region.label,color:colors[i],value:total,formatted:format(total)};
    });
    const total=data.trend.find(row=>row.label===period.label)?.[metric]??null;
    return {title,metric:metric==='amount'?'Recorded amount':'Units',rows,total,formattedTotal:format(total)};
  }
  function tooltipHtml(details){
    return `<div class="fr-tooltip-heading"><strong>${esc(details.title)}</strong><small>${details.metric}</small></div><div class="fr-tooltip-values">${details.rows.map(row=>`<div class="fr-tooltip-row"><span><i style="background:${row.color}"></i>${esc(row.label)}</span><strong>${esc(row.formatted)}</strong></div>`).join('')}</div><div class="fr-tooltip-total"><span>Period total <small>All selected regions</small></span><strong>${esc(details.formattedTotal)}</strong></div>`;
  }
  function trend(data,metric){
    const a=data.regionalAnalytics,leaders=rank(data.by.region,metric).slice(0,6),periods=a.series;
    const label={day:'Daily',week:'Weekly',month:'Monthly'}[a.granularity]||'Recorded';
    const heading=`${label} ${metric==='amount'?'amount':'units'} by region`;
    if(!periods.length||!leaders.length)return `<section class="fr-trend"><h2>${heading}</h2><p class="fr-empty">No orders match the filters.</p></section>`;
    const all=periods.flatMap(p=>p.regions.map(r=>r[metric])).filter(Number.isFinite);
    if(!all.length||metric==='amount'&&data.totals.currency==='Mixed currencies')return `<section class="fr-trend"><h2>${heading}</h2><p class="fr-empty">Comparable amounts are not available. Select Units or one currency.</p></section>`;
    const min=Math.min(0,...all),max=Math.max(0,...all)||(min===0?1:0),span=max-min;
    const width=1040,height=278,left=72,right=20,top=18,bottom=42;
    const times=periods.map(p=>Date.parse(p.start+'T00:00:00Z')),duration=times.at(-1)-times[0];
    const x=i=>duration?left+(times[i]-times[0])/duration*(width-left-right):(width+left-right)/2;
    const y=v=>top+(max-v)/span*(height-top-bottom);
    const ticks=Array.from({length:5},(_,i)=>min+(span*i/4));
    const date=p=>new Date(p.start+'T00:00:00Z').toLocaleDateString('en-ZA',{timeZone:'UTC',month:'short',...(a.granularity==='month'?{year:'2-digit'}:{day:'numeric'})});
    const paths=leaders.map((r,n)=>{
      let path='',open=false;
      const points=periods.map((p,i)=>{
        // A missing region in an observed bucket means no selected lines, not missing source history.
        const found=p.regions.find(item=>item.label===r.label),v=found?found[metric]:0;
        if(!Number.isFinite(v)){open=false;return '';}
        const px=x(i),py=y(v);path+=`${open?'L':'M'}${px.toFixed(2)},${py.toFixed(2)} `;open=true;
        const title=`${r.label}, ${date(p)}: ${value(v,metric,data.totals.currency)}`;
        return `<circle cx="${px}" cy="${py}" r="3" fill="${colors[n]}" data-fr-point="${esc(r.label)}" data-fr-period-index="${i}" data-start="${p.start}" data-end="${p.end}" role="button" tabindex="0" aria-label="${esc(title)}"/>`;
      }).join('');
      return `<g class="fr-series"><path d="${path.trim()}" stroke="${colors[n]}" fill="none" stroke-width="2"/>${points}</g>`;
    }).join('');
    const guide=`<g class="fr-hover-guide" style="display:none" aria-hidden="true"><rect class="fr-hover-band" y="${top}" height="${height-top-bottom}"/><line class="fr-hover-line" y1="${top}" y2="${height-bottom}"/><g class="fr-hover-dots"></g></g>`;
    return `<section class="fr-trend" aria-label="Regional activity"><header><h2>${heading} <span>/ top ${leaders.length}</span></h2><small>Recorded ${a.granularity} periods only</small></header><div class="fr-trend-legend">${leaders.map((r,i)=>`<button type="button" ${pick('region',r.label)} style="--fr-accent:${colors[i]}"><i></i>${esc(r.label)}</button>`).join('')}</div><div class="fr-chart-stage"><div class="fr-chart-scroll" tabindex="0" aria-label="${heading}"><svg viewBox="0 0 ${width} ${height}" data-fr-positions="${esc(JSON.stringify(periods.map((p,i)=>x(i))))}" class="fr-line-chart" role="group" aria-label="${heading}">${ticks.map(v=>`<line x1="${left}" x2="${width-right}" y1="${y(v)}" y2="${y(v)}" class="fr-gridline"/><text x="${left-10}" y="${y(v)+3}" text-anchor="end">${esc(value(v,metric,data.totals.currency,true))}</text>`).join('')}${periods.map((p,i)=>i%Math.max(1,Math.ceil(periods.length/9))===0||i===periods.length-1?`<text x="${x(i)}" y="${height-15}" text-anchor="${i===periods.length-1?'end':i===0?'start':'middle'}">${date(p)}</text>`:'').join('')}${paths}${guide}</svg></div><div class="fr-tooltip" role="tooltip" hidden></div></div><p class="fr-note">${data.selection.start} to ${data.selection.end}. Only dates with recorded orders are included; no prior-year comparison is supplied.</p></section>`;
  }
  const mounted=new WeakMap();let tooltipSequence=0;
  function mount(root,data,metric,ownerSignal){
    mounted.get(root)?.();
    const svg=root.querySelector('.fr-line-chart'),tooltip=root.querySelector('.fr-tooltip');
    if(!data||!svg||!tooltip||ownerSignal?.aborted||root.querySelector('.fo-results')?.getAttribute('aria-busy')==='true')return;
    const abort=new AbortController(),options={signal:abort.signal},scroll=svg.closest('.fr-chart-scroll'),stage=svg.closest('.fr-chart-stage'),guide=svg.querySelector('.fr-hover-guide');
    const positions=JSON.parse(svg.dataset.frPositions),left=72,right=1020,top=18,bottom=236;
    let current=-1,described=null,touchStart=null,suppressClickUntil=0,frame=0;
    tooltip.id='fr-region-tooltip-'+(++tooltipSequence);
    function hide(){tooltip.hidden=true;guide.style.display='none';described?.removeAttribute('aria-describedby');described=null;}
    function cleanup(){hide();abort.abort();global.cancelAnimationFrame(frame);ownerSignal?.removeEventListener('abort',cleanup);mounted.delete(root);}
    mounted.set(root,cleanup);ownerSignal?.addEventListener('abort',cleanup,{once:true});
    function screenPoint(x,y){const point=svg.createSVGPoint();point.x=x;point.y=y;return point.matrixTransform(svg.getScreenCTM());}
    function show(index,client){
      if(index<0||index>=positions.length||!svg.isConnected)return;
      const details=tooltipDetails(data,metric,index);
      if(!details)return;
      if(current!==index||tooltip.hidden)tooltip.innerHTML=tooltipHtml(details);
      current=index;tooltip.hidden=false;tooltip.dataset.periodIndex=String(index);guide.style.display='';
      const start=index?(positions[index-1]+positions[index])/2:left,end=index<positions.length-1?(positions[index]+positions[index+1])/2:right;
      const band=guide.querySelector('rect'),line=guide.querySelector('line');
      band.setAttribute('x',start);band.setAttribute('width',end-start);line.setAttribute('x1',positions[index]);line.setAttribute('x2',positions[index]);
      const dots=[...svg.querySelectorAll(`.fr-series [data-fr-period-index="${index}"]`)];
      guide.querySelector('.fr-hover-dots').replaceChildren(...dots.map(dot=>{
        const ring=document.createElementNS('http://www.w3.org/2000/svg','circle');
        for(const key of ['cx','cy','fill'])ring.setAttribute(key,dot.getAttribute(key));
        ring.setAttribute('r','4');return ring;
      }));
      const anchor=client||screenPoint(positions[index],70),width=tooltip.offsetWidth,height=tooltip.offsetHeight;
      const x=anchor.x+16+width<=global.innerWidth-8?anchor.x+16:anchor.x-width-16;
      tooltip.style.left=Math.max(8,Math.min(global.innerWidth-width-8,x))+'px';
      tooltip.style.top=Math.max(8,Math.min(global.innerHeight-height-8,anchor.y-28))+'px';
      described?.removeAttribute('aria-describedby');described=scroll.contains(document.activeElement)?document.activeElement:scroll;
      described.setAttribute('aria-describedby',tooltip.id);
    }
    function hit(event){
      const matrix=svg.getScreenCTM();if(!matrix)return -1;
      const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;
      const local=point.matrixTransform(matrix.inverse());
      if(local.x<left-5||local.x>right+5||local.y<top-5||local.y>bottom+5)return -1;
      return positions.reduce((best,x,i)=>Math.abs(x-local.x)<Math.abs(positions[best]-local.x)?i:best,0);
    }
    svg.addEventListener('pointermove',event=>{
      if(event.pointerType!=='mouse')return;
      const index=hit(event);if(index<0){hide();return;}show(index,{x:event.clientX,y:event.clientY});
    },options);
    svg.addEventListener('pointerleave',event=>{if(event.pointerType==='mouse'&&!tooltip.contains(event.relatedTarget)&&!scroll.contains(document.activeElement))hide();},options);
    tooltip.addEventListener('pointerleave',event=>{if(!svg.contains(event.relatedTarget)&&!scroll.contains(document.activeElement))hide();},options);
    svg.addEventListener('pointerdown',event=>{if(event.pointerType!=='mouse')touchStart={x:event.clientX,y:event.clientY};},options);
    svg.addEventListener('pointerup',event=>{
      if(event.pointerType==='mouse'||!touchStart)return;
      const moved=Math.hypot(event.clientX-touchStart.x,event.clientY-touchStart.y);touchStart=null;
      const index=hit(event);if(moved>8||index<0)return;
      show(index,{x:event.clientX,y:event.clientY});suppressClickUntil=Date.now()+700;
    },options);
    svg.addEventListener('pointercancel',()=>{touchStart=null;hide();},options);
    svg.addEventListener('click',event=>{if(Date.now()<suppressClickUntil){event.preventDefault();event.stopPropagation();suppressClickUntil=0;}},{...options,capture:true});
    scroll.addEventListener('focusin',event=>{const index=event.target.dataset.frPeriodIndex;show(index===undefined?Math.max(0,current):Number(index));},options);
    scroll.addEventListener('focusout',event=>{if(!scroll.contains(event.relatedTarget)&&!tooltip.matches(':hover'))hide();},options);
    scroll.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();event.stopPropagation();
      const index=event.key==='Home'?0:event.key==='End'?positions.length-1:Math.max(0,Math.min(positions.length-1,Math.max(0,current)+(event.key==='ArrowLeft'?-1:1)));
      const point=[...svg.querySelectorAll(`[data-fr-period-index="${index}"]`)].find(p=>p.dataset.frPoint===event.target.dataset.frPoint);
      if(point){point.focus({preventScroll:true});point.scrollIntoView({block:'nearest',inline:'nearest'});}
      else if(event.target!==scroll)scroll.focus({preventScroll:true});
      const localX=positions[index]*svg.getBoundingClientRect().width/1040;
      if(localX<scroll.scrollLeft||localX>scroll.scrollLeft+scroll.clientWidth)scroll.scrollLeft=Math.max(0,localX-scroll.clientWidth/2);
      global.cancelAnimationFrame(frame);frame=global.requestAnimationFrame(()=>show(index));
    },options);
    document.addEventListener('keydown',event=>{if(event.key==='Escape')hide();},options);
    document.addEventListener('pointerdown',event=>{if(!stage.contains(event.target))hide();},options);
    document.addEventListener('scroll',event=>{if(!tooltip.contains(event.target))hide();},{...options,capture:true});
    global.addEventListener('resize',hide,options);
  }
  function html(data,metric,helpers){
    const a=data.regionalAnalytics;
    if(!a||a.schema!==1)return `<section class="fr-empty"><h2>Regional analytics unavailable</h2><p>Refresh to load the latest regional report.</p></section>${helpers.groupTable()}`;
    const rows=data.by.region,candidate=rank(rows,metric)[0],leader=candidate&&share(candidate,rows,data.totals,metric)!==null?candidate:null,volume=Number.isFinite(data.totals.units)?rank(rows,'units').find(r=>r.units>0):null,orders=rank(rows,'orders')[0],stores=rank(rows,'stores')[0];
    const mapped=share({lines:a.mapped.lines},[{lines:a.mapped.lines},{lines:a.unmapped.lines}],{lines:data.totals.lines},'lines');
    const dominant=leader?share(leader,rows,data.totals,metric):null;
    const valueLeader=Number.isFinite(data.totals.amount)&&rows.every(r=>Number.isFinite(r.amount))?rank(rows,'amount').find(r=>r.amount>0):null;
    const summary=data.totals.lines?`${num(data.totals.orders)} distinct orders across ${num(data.totals.stores)} stores, with ${num(data.totals.units)} units ordered. ${leader?esc(leader.label)+' contributes '+pct(dominant)+' of selected '+(metric==='amount'?'amount':'units')+'.':'Regional shares are not available for this measure.'}`:'No order lines match the selected filters.';
    return `<div class="fr-regions"><section class="fr-intelligence"><header><h2>Regional intelligence</h2><small>${rows.length} regions / ${data.selection.start} to ${data.selection.end}</small></header><p class="fr-scope">${esc(data.selection.filters.province||data.selection.filters.region||'All regions')}</p><p class="fr-summary">${summary}</p><div class="fr-highlights"><article><i class="ph ph-map-pin" aria-hidden="true"></i><div><h3>Largest contribution</h3><strong>${leader?esc(leader.label):data.totals.lines?'Not available':'No records'}</strong><p>${leader?esc(value(leader[metric],metric,data.totals.currency,true))+' '+(metric==='amount'?'recorded amount':'units'):'Not available'}</p></div></article><article><i class="ph ph-storefront" aria-hidden="true"></i><div><h3>Broadest store reach</h3><strong>${stores?esc(stores.label):'No records'}</strong><p>${stores?num(stores.stores)+' ordering stores':'Not available'}</p></div></article><article><i class="ph ph-crosshair" aria-hidden="true"></i><div><h3>Province coverage</h3><strong>${pct(mapped)} of order lines</strong><p>${num(a.unmapped.lines)} lines outside mapped provinces</p></div></article></div></section>
    <section class="fr-performance"><header><div><h2>Order performance by province</h2><small>${metric==='amount'?'Recorded amount':'Units ordered'} / current selection</small></div>${helpers.metricControl()}</header>${data.totals.amount===0&&data.totals.lines?'<p class="fr-data-note">Geo records zero amounts for this selection. Units and order counts remain available; no prices have been inferred.</p>':''}<div class="fr-map-layout"><div class="fr-map-surface">${map(data,metric)}</div><div class="fr-map-details"><h3>Regional snapshot</h3><div class="fr-snapshots">${snapshot('Value leader',valueLeader,'amount',data,colors[0])}${snapshot('Volume leader',volume,'units',data,colors[1])}${snapshot('Most orders',orders,'orders',data,colors[2])}${snapshot('Store reach',stores,'stores',data,colors[3])}</div><h3>Divisional snapshot</h3><div class="fr-divisions">${['Central','Coastal','Inland'].map((name,i)=>{const row=a.divisions.find(r=>r.label===name);return `<article style="--fr-accent:${[colors[1],colors[2],colors[0]][i]}"><h4>${name}</h4><strong>${pct(share(row||{amount:0},a.divisions,data.totals,'amount'))} value</strong><small>${pct(share(row||{units:0},a.divisions,data.totals,'units'))} volume</small></article>`;}).join('')}</div><h3>${metric==='amount'?'Value':'Volume'} share of selected orders</h3><div class="fr-map-legend">${[['#2bad85','25% and above'],['#5b9bd5','10% to <25%'],['#3b6089','5% to <10%'],['#e5ac39','Above 0% to <5%'],['#132d49','No contribution'],['#233b55','Share unavailable']].map(([c,t])=>`<span><i style="background:${c}"></i>${t}</span>`).join('')}</div><p class="fr-note">Province totals combine their source regions. Unmapped and other areas remain in the league table and selection totals.${a.divisions.some(d=>d.label==='Other / unassigned')?' Other / unassigned divisions: '+num(a.divisions.find(d=>d.label==='Other / unassigned').lines)+' lines.':''}</p></div></div><div class="fr-share-grid">${shares(data,'amount')}${shares(data,'units')}</div></section><div class="fr-league">${helpers.groupTable()}</div><div class="fr-trend-tools">${helpers.granularityControl()}</div>${trend(data,metric)}</div>`;
  }
  global.FranchiseRegions={html,color,trend,shares,tooltipDetails,tooltipHtml,mount};
})(typeof window==='undefined'?globalThis:window);
