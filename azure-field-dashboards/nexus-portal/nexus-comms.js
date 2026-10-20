(function(global){
  'use strict';
  let session=null,installPrompt=null,audio=null,dialog=null,refreshTimer=null,openRoomId=null;
  const storage={get:key=>{try{return localStorage.getItem(key);}catch{return null;}},set:(key,value)=>{try{localStorage.setItem(key,value);}catch{}}};
  const prefs=uid=>{try{return {sound:true,volume:50,mutedUntil:0,...JSON.parse(storage.get('nexus-alert-prefs-'+uid)||'{}')};}catch{return {sound:true,volume:50,mutedUntil:0};}};
  function badge(count=0){
    for(const button of document.querySelectorAll('[data-open-view="chat"]')){
      let bubble=button.querySelector('.nexus-chat-badge');
      if(!bubble){bubble=document.createElement('span');bubble.className='nexus-chat-badge';bubble.setAttribute('aria-hidden','true');button.append(bubble);}
      bubble.hidden=!count;bubble.textContent=count>99?'99+':String(count);
      button.setAttribute('aria-label',count?`Meridian Chat, ${count} unread conversations`:'Meridian Chat');button.title=count?`${count} unread conversations`:'Meridian Chat';
    }
    const title=document.title.replace(/^\(\d+\+?\) /,'');document.title=(count?`(${count>99?'99+':count}) `:'')+title;
    try{const result=count?navigator.setAppBadge?.(count):navigator.clearAppBadge?.();result?.catch(()=>{});}catch{}
  }
  function controls(){
    for(const account of document.querySelectorAll('aside .nexus-session-button')){
      if(account.parentElement.querySelector('.nexus-app-actions'))continue;
      const bar=document.createElement('div');bar.className='nexus-app-actions';
      bar.innerHTML='<button type="button" data-nexus-install title="Install Meridian Nexus"><i class="ph ph-download-simple" aria-hidden="true"></i><span>Install app</span></button><button type="button" data-nexus-alerts title="App and notification settings" aria-label="App and notification settings"><i class="ph ph-bell" aria-hidden="true"></i></button>';
      const chatNav=account.closest('.chat-page')?.querySelector('.nexus-workspace-nav');
      if(chatNav)chatNav.append(bar);else account.before(bar);
    }
    const installed=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
    document.querySelectorAll('[data-nexus-install]').forEach(b=>{b.hidden=installed;});
    document.querySelectorAll('[data-nexus-alerts]').forEach(b=>{b.hidden=!session;});
    badge(session?.unread || 0);
  }
  async function install(){
    if(installPrompt){const prompt=installPrompt;installPrompt=null;await prompt.prompt();await prompt.userChoice;controls();}
    else if(session?.toast)session.toast((matchMedia('(display-mode: standalone)').matches||navigator.standalone)?'Nexus is installed.':'App installation is available through your browser menu.');
  }
  function unlock(){
    if(!session||!prefs(session.uid).sound)return;
    try{const Context=global.AudioContext||global.webkitAudioContext;if(!Context)return;audio ||= new Context();if(audio.state==='suspended')audio.resume().catch(()=>{});}catch{}
  }
  function tone(kind='message',test=false){
    if(!session)return;const settings=prefs(session.uid);
    if(!test&&(!settings.sound||settings.mutedUntil>Date.now()))return;
    if(!audio||audio.state!=='running')return;
    const volume=Math.max(0,Math.min(100,Number(settings.volume)||0))/100*.12;
    const now=audio.currentTime;
    [kind==='message'?740:520,kind==='message'?980:780].forEach((f,i)=>{const oscillator=audio.createOscillator(),gain=audio.createGain(),start=now+i*.12;oscillator.frequency.value=f;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume,start+.012);gain.gain.exponentialRampToValueAtTime(.0001,start+.13);oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(start);oscillator.stop(start+.15);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};});
  }
  async function alertEvent(s,event){
    if(session!==s||!event?.id||event.at<s.startedAt||event.at>Date.now()+60000)return;
    if(event.kind==='message'&&location.hash==='#chat'&&!document.hidden&&openRoomId===event.roomId)return;
    const deliver=()=>{
      if(session!==s)return;
      const key='nexus-alert-seen-'+s.uid;let seen;try{seen=JSON.parse(storage.get(key)||'{}');}catch{seen={};}
      if(seen[event.id])return;seen[event.id]=Date.now();
      storage.set(key,JSON.stringify(Object.fromEntries(Object.entries(seen).filter(([,time])=>time>Date.now()-86400000).slice(-200))));
      if(!document.hidden)tone(event.kind);
      else if(!storage.get('mc-push-enabled-'+s.uid)&&global.Notification?.permission==='granted'&&prefs(s.uid).mutedUntil<=Date.now())navigator.serviceWorker?.getRegistration().then(registration=>{
        if(session!==s)return;
        return registration?.showNotification('Meridian Nexus',{body:event.kind==='message'?'You have a new staff message.':event.kind==='reminder'?'You have a task reminder.':'A staff task has been assigned to you.',icon:'/assets/icons/icon-192.png',tag:event.id,silent:!prefs(s.uid).sound,data:{uid:s.uid,roomId:event.roomId,taskId:event.taskId||''}});
      }).catch(()=>{});
    };
    if(navigator.locks)await navigator.locks.request('nexus-alert-'+s.uid,{ifAvailable:true},lock=>{if(lock)deliver();});else deliver();
  }
  async function refresh(){
    const s=session;if(!s||s.loading){if(s)s.pending=true;return;}
    s.loading=true;
    try{
      const data=await s.call('meridianChat',{action:'activity',expectedUid:s.uid,export:true});
      if(session!==s)return;
      s.unread=Math.max(0,Number(data.unreadChats)||0);badge(s.unread);
      for(const event of data.events||[])await alertEvent(s,event);
    }catch(error){if(session!==s)return;if(/permission-denied|unauthenticated/.test(error.code||'')){stop();}else{badge(s.unread);}}
    finally{if(session===s){s.loading=false;if(s.pending){s.pending=false;schedule();}}}
  }
  function schedule(){clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,450);}
  function stop(){
    const old=session;session=null;clearTimeout(refreshTimer);old?.stops.forEach(fn=>fn());clearInterval(old?.timer);openRoomId=null;dialog?.close();badge(0);controls();
  }
  function sync(options){
    if(!options?.uid){if(session)stop();else controls();return;}
    if(session?.uid===options.uid){controls();return;}
    if(!options.database)return;
    stop();const s=session={...options,stops:[],startedAt:Date.now(),unread:0,loading:false,pending:false};
    persistSettings(s.uid,prefs(s.uid));
    const deny=()=>{if(session===s)stop();};
    // The bounded room listener invalidates an all-room server summary. It is
    // never used to truncate the unread count to the first 100 conversations.
    s.stops.push(s.database.collection('meridianChatRooms').where('memberIds','array-contains',s.uid).orderBy('updatedAt','desc').limit(100).onSnapshot(schedule,deny));
    s.stops.push(s.database.collection('meridianChatReads').doc(s.uid).collection('rooms').onSnapshot(schedule,deny));
    s.timer=setInterval(()=>{if(!document.hidden)refresh();},60000);controls();refresh();
  }
  function createDialog(){
    if(dialog)return;
    dialog=document.createElement('dialog');dialog.className='nexus-app-dialog';dialog.setAttribute('aria-labelledby','nexus-app-dialog-title');
    dialog.innerHTML='<header><h2 id="nexus-app-dialog-title">App & notifications</h2><button type="button" data-app-close aria-label="Close settings"><i class="ph ph-x" aria-hidden="true"></i></button></header><label class="nexus-setting"><span>Message and task sounds</span><input type="checkbox" name="appSound"></label><label class="nexus-setting"><span>Volume</span><input type="range" name="appVolume" min="0" max="100" step="10"></label><label class="nexus-setting"><span>Mute alerts</span><select name="appMute"><option value="0">Off</option><option value="1">1 hour</option><option value="8">8 hours</option></select></label><p data-app-state role="status"></p><footer><button type="button" data-app-test><i class="ph ph-speaker-high" aria-hidden="true"></i> Test sound</button><button type="button" data-app-push><i class="ph ph-bell-ringing" aria-hidden="true"></i> Enable notifications</button><button type="button" data-app-off>Turn notifications off</button></footer>';
    document.body.append(dialog);
    dialog.addEventListener('change',event=>{if(!session)return;const settings=prefs(session.uid);settings.sound=dialog.querySelector('[name=appSound]').checked;settings.volume=Number(dialog.querySelector('[name=appVolume]').value);if(event.target.name==='appMute'){const value=Number(dialog.querySelector('[name=appMute]').value);settings.mutedUntil=value?Date.now()+value*3600000:0;}storage.set('nexus-alert-prefs-'+session.uid,JSON.stringify(settings));unlock();persistSettings(session.uid,settings);});
    dialog.addEventListener('click',async event=>{
      const button=event.target.closest('button');if(!button)return;
      if(button.hasAttribute('data-app-close')){dialog.close();return;}
      if(button.hasAttribute('data-app-test')){unlock();await audio?.resume();tone('message',true);return;}
      const s=session;if(!s)return;button.disabled=true;
      try{
        if(button.hasAttribute('data-app-push')){
          // Permission must be requested inside this explicit user action.
          const permission=global.Notification?.permission==='granted'?'granted':await global.Notification?.requestPermission();
          if(permission!=='granted')throw new Error('Notifications are blocked or unsupported on this device.');
          const boot=await s.call('meridianChat',{action:'bootstrap',expectedUid:s.uid});if(session!==s)return;
          await global.MeridianChatTools.enablePush(s.uid,boot.pushPublicKey,{call:data=>s.call('meridianChat',{...data,expectedUid:s.uid})});
          if(session===s)dialog.querySelector('[data-app-state]').textContent='Notifications enabled on this device.';
        }else if(button.hasAttribute('data-app-off')){
          await global.MeridianChatTools.disablePush();const id=storage.get('mc-device-'+s.uid);
          if(id)await s.call('meridianChat',{action:'notifications',deviceId:id,enabled:false,expectedUid:s.uid});
          try{localStorage.removeItem('mc-push-enabled-'+s.uid);}catch{}
          if(session===s)dialog.querySelector('[data-app-state]').textContent='Notifications off on this device.';
        }
      }catch(error){if(session===s)dialog.querySelector('[data-app-state]').textContent=error.message;}finally{button.disabled=false;}
    });
  }
  function persistSettings(uid,settings){global.MeridianChatTools?.settings?.(uid,{sound:settings.sound,mutedUntil:settings.mutedUntil}).catch(()=>{});}
  function settings(){if(!session)return;createDialog();const p=prefs(session.uid);dialog.querySelector('[name=appSound]').checked=p.sound;dialog.querySelector('[name=appVolume]').value=p.volume;dialog.querySelector('[name=appMute]').value=p.mutedUntil>Date.now()?'1':'0';dialog.querySelector('[data-app-state]').textContent=storage.get('mc-push-enabled-'+session.uid)?'Notifications enabled on this device.':'Notifications are off on this device.';dialog.showModal();}
  document.addEventListener('click',event=>{if(event.target.closest('[data-nexus-install]'))install().catch(()=>{});if(event.target.closest('[data-nexus-alerts]'))settings();});
  document.addEventListener('pointerdown',unlock,{passive:true});document.addEventListener('keydown',unlock);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  global.addEventListener('online',schedule);global.addEventListener('hashchange',()=>{openRoomId=null;setTimeout(controls,0);});
  navigator.serviceWorker?.addEventListener('message',event=>{if(event.data?.type==='nexus-chat-push'&&event.data.uid===session?.uid)refresh();});
  global.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;controls();});
  global.addEventListener('appinstalled',()=>{installPrompt=null;controls();});
  global.NexusComms={sync,refresh,install,settings,openRoom:id=>{openRoomId=id;},stop,badge};
  global.addEventListener('DOMContentLoaded',controls,{once:true});
})(window);
