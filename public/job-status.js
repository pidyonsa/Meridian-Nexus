(function(global){
  "use strict";
  let uid=null,model=null,opened=false,opener=null,panel=null;
  const find=id=>document.getElementById(id);
  function controls(){
    for(const account of document.querySelectorAll('aside .nexus-session-button')){
      if(account.parentElement.querySelector('[data-job-status-toggle]'))continue;
      const button=document.createElement('button');button.type='button';button.className='nexus-job-toggle';button.dataset.jobStatusToggle='';
      button.setAttribute('aria-controls','extractionStatus');button.title='Show or hide job status';
      button.innerHTML='<i class="ph ph-pulse" aria-hidden="true"></i><span>Job status</span><small>Idle</small><i class="ph ph-caret-up" aria-hidden="true"></i>';
      account.before(button);
    }
    for(const button of document.querySelectorAll('[data-job-status-toggle]')){
      button.hidden=!uid;button.setAttribute('aria-expanded',String(opened));
      button.dataset.status=model?.status||'idle';button.querySelector('small').textContent=model?.isBusy?'Running':model?.status==='failed'?'Failed':model?'Finished':'Idle';
    }
  }
  function position(){
    if(!opened||!panel)return;
    const sidebar=document.querySelector('.view:not([hidden]) .nexus-workspace-sidebar, .view:not([hidden]) .nexus-home-sidebar');
    const edge=sidebar?.getBoundingClientRect().right||0;
    const inset=global.innerWidth>640 && edge<global.innerWidth-80?Math.max(12,edge+12):12;
    panel.style.width=`${Math.max(0,Math.min(380,global.innerWidth-inset-16))}px`;
  }
  function close(restore=false){
    opened=false;if(panel)panel.hidden=true;controls();
    if(restore && opener?.isConnected && opener.getClientRects().length)opener.focus({preventScroll:true});
    opener=null;
  }
  function render(){
    if(!panel)return;
    panel.dataset.status=model?.status||'idle';
    find('extractionStatusTitle').textContent=model?.title||'No active extraction';
    find('extractionStatusCopy').textContent=model?.copy||'';
    find('extractionStatusCopy').hidden=!model?.copy;
    find('extractionStatusStep').textContent=model?.step||'';
    find('extractionStatusElapsed').textContent=model?.elapsed||'';
    find('extractionStatusMeta').hidden=!model;
    const progress=find('extractionStatusProgress'),amount=Math.max(0,Math.min(100,Number(model?.progress)||0));
    progress.style.width=`${amount}%`;progress.parentElement.hidden=!model;
    find('extractionStatusAbort').hidden=!model?.canAbort;find('extractionStatusAbort').disabled=model?.status==='cancelling';
    find('extractionStatusAbort').textContent=model?.status==='cancelling'?'Stopping job...':'Abort job';
    find('extractionStatusAlert').hidden=!model?.alert;find('extractionStatusAlert').textContent=model?.alert||'';
    panel.hidden=!uid||!opened;controls();position();
  }
  function boot(){
    panel=find('extractionStatus');if(!panel)return;
    // Keep job updates outside every dashboard's layout and scrolling container.
    document.body.append(panel);render();
    document.addEventListener('click',event=>{
      const toggle=event.target.closest('[data-job-status-toggle]');
      if(toggle && uid){if(opened)close(true);else{opener=toggle;opened=true;render();find('extractionStatusHide').focus({preventScroll:true});}}
      if(event.target.closest('#extractionStatusHide'))close(true);
      if(event.target.closest('[data-open-view],[data-admin-tab],[data-insights-page],[data-callcycle-page],[data-attendance-page]'))close();
    });
    document.addEventListener('pointerdown',event=>{if(opened&&!panel.contains(event.target)&&!event.target.closest('[data-job-status-toggle]'))close();});
    document.addEventListener('focusin',event=>{if(opened&&!panel.contains(event.target)&&!event.target.closest('[data-job-status-toggle]'))close();});
    document.addEventListener('scroll',event=>{if(opened&&!panel.contains(event.target))close();},true);
    document.addEventListener('keydown',event=>{if(opened&&event.key==='Escape'){event.preventDefault();close(true);}});
    global.addEventListener('hashchange',()=>close());
    global.addEventListener('resize',position);
    global.addEventListener('blur',()=>{if(document.activeElement?.tagName==='IFRAME')close();});
  }
  global.NexusJobStatus={
    identity(value){if(value!==uid){uid=value||null;model=null;close();render();}else controls();},
    update(value){if(!uid)return;model=value;render();},
    close
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window);
