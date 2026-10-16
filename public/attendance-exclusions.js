(function(global) {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const types = {person:'Staff member only', manager:'Manager and reporting team'};
  const audiences = {both:'Reps and merchandisers', rep:'Reps', merchandiser:'Merchandisers'};
  const icon = name => `<i class="ph ph-${name}" aria-hidden="true"></i>`;
  const options = (values, current) => Object.entries(values).map(([value, label]) => `<option value="${value}" ${value===current?'selected':''}>${label}</option>`).join('');
  const when = value => value ? new Date(value).toLocaleString('en-ZA', {timeZone:'Africa/Johannesburg'}) : '';
  function mount(root, {call, changed=()=>{}}) {
    let stopped=false, busy=false, policy={revision:0,entries:[],history:[]}, preview=null, error='', notice='', loaded=false;
    const draft={name:'',userCode:'',reason:'',type:'person',audience:'both'}, abort=new AbortController();
    const button = (action, glyph, label, extra='') => `<button type="button" data-aex-action="${action}" title="${esc(label)}" aria-label="${esc(label)}" ${extra} ${busy?'disabled':''}>${icon(glyph)}</button>`;
    function render() {
      if(stopped)return;
      root.innerHTML=`<header class="aex-heading"><div><p class="eyebrow">Syndicated attendance</p><h2>Attendance exclusions</h2></div><div class="aex-actions">${button('template','download-simple','Download Excel template')}${button('refresh','arrow-clockwise','Refresh exclusions')}</div></header>
        <p class="aex-status" role="status">${esc(error||notice||(!loaded?'Loading exclusions...':`${policy.entries.filter(r=>r.enabled).length} active exclusions`))}</p>
        <form class="aex-form"><fieldset ${busy||!loaded?'disabled':''}><div class="aex-fields">
        <label>Exclude<select name="type">${options(types,draft.type)}</select></label><label>Audience<select name="audience">${options(audiences,draft.audience)}</select></label>
        <label>Full name<input name="name" maxlength="160" required value="${esc(draft.name)}" autocomplete="off"/></label>
        <label>Staff code (optional)<input name="userCode" maxlength="80" value="${esc(draft.userCode)}" ${draft.type==='manager'?'disabled':''}/></label>
        <label class="aex-reason">Reason (optional)<input name="reason" maxlength="300" value="${esc(draft.reason)}"/></label></div>
        <div class="aex-actions"><button type="submit" class="primary-action">${icon('magnifying-glass')} Preview exclusion</button><label class="aex-import">${icon('file-xls')} Import Excel<input type="file" accept=".xlsx" aria-label="Import exclusions workbook" ${busy||!loaded?'disabled':''}/></label></div></fieldset></form>
        ${preview?`<section class="aex-preview"><header><h3>Review exclusions</h3><span>${preview.adding} new / ${preview.duplicates} duplicates / ${preview.unmatched} unmatched</span></header>
          <div class="aex-table"><table><thead><tr><th>Name</th><th>Exclusion</th><th>Audience</th><th>Latest staff-source matches</th></tr></thead><tbody>${preview.review.map(r=>`<tr><td>${esc(r.name)}${r.userCode?`<small>${esc(r.userCode)}</small>`:''}</td><td>${esc(types[r.type])}</td><td>${esc(audiences[r.audience])}</td><td>${r.duplicate?'Already listed; skipped':`${r.matchedPeople} staff`}${r.sample.length?`<small>${r.sample.map(esc).join('<br>')}</small>`:''}${!r.duplicate&&!r.matchedPeople?'<small>No current match; applies when a matching name appears.</small>':''}</td></tr>`).join('')}</tbody></table></div>
          <label class="aex-confirm"><input type="checkbox" data-aex-confirm ${busy?'disabled':''}/> Confirm the selected people${preview.entries.some(r=>r.type==='manager')?' and managers’ reporting teams':''} will be excluded from syndicated totals, detail and exports. Source records remain unchanged.</label>
          <div class="aex-actions"><button type="button" class="primary-action" data-aex-action="save" disabled>${icon('check')} Save exclusions</button><button type="button" data-aex-action="cancel" ${busy?'disabled':''}>Cancel</button></div></section>`:''}
        <section class="aex-list"><header><h3>Exclusion list</h3><span>${policy.entries.length} entries${policy.updatedAt?` / Updated ${esc(when(policy.updatedAt))}`:''}</span></header>
          <div class="aex-table"><table><thead><tr><th>Name / staff code</th><th>Exclusion</th><th>Audience</th><th>Reason</th><th>Excluded</th><th></th></tr></thead><tbody>${policy.entries.map(r=>`<tr><td>${esc(r.name)}${r.userCode?`<small>${esc(r.userCode)}</small>`:''}</td><td>${esc(types[r.type])}</td><td>${esc(audiences[r.audience])}</td><td>${esc(r.reason)||'-'}</td><td><input type="checkbox" data-aex-toggle="${r.id}" aria-label="Exclude ${esc(r.name)}" ${r.enabled?'checked':''} ${busy?'disabled':''}/></td><td>${button('remove','trash','Remove exclusion for '+r.name,`data-id="${r.id}"`)}</td></tr>`).join('')||'<tr><td colspan="6">No exclusions saved.</td></tr>'}</tbody></table></div></section>
        <details class="aex-history"><summary>Recent changes</summary>${policy.history.map(h=>`<p><strong>${esc(h.actor.name||h.actor.email)}</strong> / ${esc(h.action)} / ${h.entries.length} entries / ${esc(when(h.at))}</p>`).join('')||'<p>No changes recorded.</p>'}</details>`;
    }
    async function run(payload, apply) {
      if(busy||stopped)return; busy=true; error=''; render();
      try {const result=await call(payload);if(!stopped)apply(result);}
      catch(e){if(!stopped){error=e.message||'Could not update exclusions.';if(/permission-denied|unauthenticated/.test(e.code||'')){policy={revision:0,entries:[],history:[]};preview=null;loaded=false;}}}
      finally{busy=false;render();}
    }
    function saved(result){policy=result;preview=null;notice=`${result.changed} changes saved. Refresh any open attendance dashboards.`;changed();}
    function download(result){const bytes=Uint8Array.from(atob(result.base64),c=>c.charCodeAt(0)),url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a=document.createElement('a');a.href=url;a.download=result.fileName;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    root.addEventListener('input',event=>{if(event.target.name&&Object.hasOwn(draft,event.target.name)){draft[event.target.name]=event.target.value;preview=null;root.querySelector('.aex-preview')?.remove();}}, {signal:abort.signal});
    root.addEventListener('submit',event=>{event.preventDefault();if(!event.target.matches('.aex-form'))return;run({action:'preview',entries:[{...draft}]},result=>{preview=result;notice='';});}, {signal:abort.signal});
    root.addEventListener('change',async event=>{
      const input=event.target;
      if(input.name==='type'){draft.type=input.value;if(draft.type==='manager')draft.userCode='';preview=null;render();return;}
      if(input.matches('[data-aex-confirm]')){root.querySelector('[data-aex-action="save"]').disabled=busy||!input.checked||!preview?.adding;return;}
      if(input.dataset.aexToggle){const r=policy.entries.find(r=>r.id===input.dataset.aexToggle);if(global.confirm(`${input.checked?'Exclude':'Restore'} ${r.name}${r.type==='manager'?' and their reporting team':''}?`))run({action:'setEnabled',id:r.id,enabled:input.checked,revision:policy.revision},saved);else render();return;}
      if(input.type==='file'){
        const file=input.files[0];if(!file)return;
        if(!/\.xlsx$/i.test(file.name)||file.size>1024*1024){error='Choose an XLSX workbook under 1 MB.';render();return;}
        busy=true;render();
        try{const workbook=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(Error('Could not read workbook.'));reader.readAsDataURL(file);});busy=false;if(stopped)return;await run({action:'preview',workbook,type:draft.type,audience:draft.audience},result=>{preview=result;notice='';});}
        catch(e){busy=false;error=e.message;render();}
      }
    }, {signal:abort.signal});
    root.addEventListener('click',event=>{
      const target=event.target.closest('[data-aex-action]');if(!target||busy)return;
      const action=target.dataset.aexAction;
      if(action==='refresh'){preview=null;run({action:'list'},result=>{policy=result;loaded=true;notice='';});}
      if(action==='template')run({action:'template'},download);
      if(action==='cancel'){preview=null;render();}
      if(action==='save'&&preview&&root.querySelector('[data-aex-confirm]')?.checked)run({action:'commit',entries:preview.entries,reviewId:preview.reviewId,revision:preview.revision},saved);
      if(action==='remove'){const r=policy.entries.find(r=>r.id===target.dataset.id);if(global.confirm(`Remove the exclusion for ${r.name}? Matching staff will be included again unless another exclusion applies.`))run({action:'remove',id:r.id,revision:policy.revision},saved);}
    }, {signal:abort.signal});
    render();run({action:'list'},result=>{policy=result;loaded=true;});
    return {stop(){stopped=true;abort.abort();root.replaceChildren();}};
  }
  global.NexusAttendanceExclusions={mount};
})(window);
