const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const app=fs.readFileSync(process.env.NEXUS_PORTAL_STAGE ? require('node:path').join(process.env.NEXUS_PORTAL_STAGE,'app.js') : 'public/app.js','utf8');
test('Chat warms after authorised login and reuses its session across navigation, but not identities',()=>{
  const mounted=[],stopped=[],visibility=[],root={textContent:''};
  const context={
    state:{authResolved:true,isOperator:true},auth:{currentUser:{uid:'staff-a'}},database:{},callFunction(){},showToast(){},allowed:true,
    operatorCanAccessNavigation:()=>context.allowed,document:{getElementById:()=>root},
    window:{
      location:{hash:'#home'},MeridianChatTools:{identity:async()=>{}},NexusComms:{sync(){}},
      MeridianChat:{
        firebaseAdapter:()=>({}),
        mount:(r,s,uid)=>{
          mounted.push(uid);
          return {uid,stop(){stopped.push(uid);r.textContent='';},setVisible(value){visibility.push(value);}};
        }
      }
    }
  };
  vm.createContext(context);vm.runInContext('let meridianChatSession=null;\n'+app.match(/function syncMeridianChat\(\) \{[^]*?\n\}/)[0],context);
  context.syncMeridianChat();assert.deepEqual(mounted,['staff-a']);assert.deepEqual(visibility,[false]);
  for(const hash of ['#chat','#stockfix','#chat','#attendance','#chat']){context.window.location.hash=hash;context.syncMeridianChat();}
  assert.equal(mounted.length,1);assert.equal(stopped.length,0);
  context.auth.currentUser={uid:'staff-b'};context.syncMeridianChat();assert.deepEqual(stopped,['staff-a']);assert.deepEqual(mounted,['staff-a','staff-b']);
  context.allowed=false;context.syncMeridianChat();assert.deepEqual(stopped,['staff-a','staff-b']);
  context.auth.currentUser=null;context.state.isOperator=false;context.syncMeridianChat();assert.equal(mounted.length,2);
});
test('No chat preload for unauthenticated or opted-out identities',()=>{
  assert.doesNotMatch(app.match(/function syncMeridianChat\(\) \{[^]*?\n\}/)[0],/300000|meridianChatIdleTimer/);
  assert.match(app,/const permitted = state.authResolved && state.isOperator && operatorCanAccessNavigation\("chat"\)/);
});
