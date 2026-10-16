(function(global) {
  'use strict';
  const labels={overview:'Executive Overview',trend:'Trend',regions:'Regions',products:'Products',stores:'Stores',reps:'Reps',orders:'Order Detail'};
  const icons={overview:'squares-four',trend:'trend-up',regions:'map-pin',products:'package',stores:'storefront',reps:'users',orders:'receipt'};
  function trace(geometry,field,small) {
    const color=small?'#ec6d25':field==='units'||field==='orders'?'#5b9bd5':field==='stores'?'#22c55e':'#ec6d25';
    let drawing='',connected=false;const points=[];
    for(const point of geometry.points){
      if(!Number.isFinite(point.x)||!Number.isFinite(point.y)){connected=false;continue;}
      const x=point.x.toFixed(3),y=point.y.toFixed(3);
      drawing+=(connected?'L':'M')+x+' '+y+' ';connected=true;points.push({x,y});
    }
    if(!points.length)return '';
    // Use the existing chart coordinates exactly; do not smooth, invent dates or add comparison data.
    return `<g class="fo-reference-trace" pointer-events="none" aria-hidden="true" fill="none" stroke="${color}"><path d="${drawing.trim()}" stroke-width="${small?1.8:2.2}" stroke-linejoin="round" stroke-linecap="round"/>${points.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="${small?1.7:2.7}" fill="${color}" stroke="none"/>`).join('')}</g>`;
  }
  function decorate(root,data,page) {
    root.dataset.referencePage=page;
    root.querySelectorAll('svg.fo-spark').forEach(svg=>svg.setAttribute('preserveAspectRatio','none'));
    const period=document.getElementById('orders-data-month');
    if(period)period.textContent=/^\d{4}-(0[1-9]|1[0-2])$/.test(data.latestPeriod||'')?new Date(data.latestPeriod+'-01T12:00:00Z').toLocaleDateString('en-ZA',{month:'short',year:'numeric',timeZone:'Africa/Johannesburg'}):'Not supplied';
    const source=root.querySelector('.fo-badge');if(source)source.innerHTML='<i class="ph ph-database" aria-hidden="true"></i> GEO DATA';
    const title=root.querySelector('.fo-heading h1');if(title)document.title=title.textContent+' | Franchise Orders | Meridian';
  }
  function closeNavigation(focus=true) {
    const wasOpen=document.body.classList.contains('orders-nav-open');
    document.body.classList.remove('orders-nav-open');
    document.getElementById('orders-nav-toggle').setAttribute('aria-expanded','false');
    document.getElementById('orders-nav-backdrop').hidden=true;
    document.getElementById('main').inert=false;
    if(focus&&wasOpen)document.getElementById('orders-nav-toggle').focus();
  }
  function initNavigation() {
    const sidebar=document.getElementById('orders-sidebar');
    document.getElementById('orders-nav-toggle').onclick=()=>{
      document.body.classList.add('orders-nav-open');document.getElementById('orders-nav-toggle').setAttribute('aria-expanded','true');
      document.getElementById('orders-nav-backdrop').hidden=false;document.getElementById('main').inert=true;document.getElementById('orders-nav-close').focus();
    };
    document.getElementById('orders-nav-close').onclick=()=>closeNavigation();
    document.getElementById('orders-nav-backdrop').onclick=()=>closeNavigation();
    global.matchMedia('(max-width:760px)').addEventListener('change',()=>closeNavigation(false));
    document.addEventListener('keydown',event=>{
      if(!document.body.classList.contains('orders-nav-open'))return;
      if(event.key==='Escape'){event.preventDefault();closeNavigation();}
      if(event.key==='Tab'){
        const items=[...sidebar.querySelectorAll('a,button')].filter(el=>el.getClientRects().length),first=items[0],last=items.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    });
  }
  global.FranchiseReference={labels,icons,trace,decorate,closeNavigation,initNavigation};
})(typeof window==='undefined'?globalThis:window);
