const {spawn}=require('node:child_process'),net=require('node:net'),path=require('node:path');
const root=path.resolve(__dirname,'..'),port=8188;
const java=path.join(root,'.tmp/multi-admin-20260910/test-runtime/jdk-21.0.12.1+1-jre/bin/java.exe');
const ready=()=>new Promise(resolve=>{const s=net.connect(port,'127.0.0.1');s.once('connect',()=>{s.destroy();resolve(true);});s.once('error',()=>resolve(false));});
(async()=>{
  if(await ready())throw new Error('Local Support test emulator port is occupied.');
  const emulator=spawn(java,['-jar','C:/Users/PC/.cache/firebase/emulators/cloud-firestore-emulator-v1.22.0.jar','--host','127.0.0.1','--port',String(port),'--project_id','demo-meridian-support'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let log='';emulator.stdout.on('data',b=>log=(log+b).slice(-4000));emulator.stderr.on('data',b=>log=(log+b).slice(-4000));
  try{
    for(let i=0;!(await ready());i++){if(i>60||emulator.exitCode!==null)throw new Error('Emulator failed: '+log);await new Promise(r=>setTimeout(r,500));}
    const test=spawn(process.execPath,['--test','scripts/tests/meridian-support.test.cjs'],{cwd:root,windowsHide:true,stdio:'inherit',env:{...process.env,FIRESTORE_EMULATOR_HOST:`127.0.0.1:${port}`}});
    process.exitCode=await new Promise(resolve=>test.on('exit',resolve));
  }finally{emulator.kill();await new Promise(resolve=>emulator.exitCode!==null?resolve():emulator.once('exit',resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
