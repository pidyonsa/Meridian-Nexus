'use strict';
const ROUTES=new Map([['/api/attendance','attendance'],['/api/orders','orders']]);
function createHandler(service,{enabled=()=>process.env.PUBLIC_DASHBOARDS_ENABLED==='true',now=Date.now}={}) {
  const limits=new Map();
  return async(req,res)=>{
    res.set('X-Robots-Tag','noindex, nofollow, noarchive');res.set('Cache-Control','no-store');res.set('X-Content-Type-Options','nosniff');
    if(!enabled())return res.status(503).json({error:'The public dashboards are currently unavailable.'});
    if(req.method==='GET'&&req.path==='/api/health')return res.json({status:'ok',edition:'public-dashboard-viewer',readOnly:true});
    if(!ROUTES.has(req.path))return res.status(404).json({error:'This viewer contains Attendance and Franchise Orders only.'});
    if(req.method!=='POST')return res.status(405).set('Allow','POST').json({error:'Unsupported request method.'});
    const input=req.body;
    if(!input||typeof input!=='object'||Array.isArray(input)||Buffer.byteLength(JSON.stringify(input))>32768)return res.status(400).json({error:'Invalid dashboard request.'});
    const current=now(),key=req.ip||'unknown';
    for(const[k,v]of limits)if(v.until<=current)limits.delete(k);
    if(!limits.has(key)){if(limits.size>=2000)return res.status(429).json({error:'The viewer is busy. Try again shortly.'});limits.set(key,{until:current+60000,count:0});}
    if(++limits.get(key).count>90)return res.status(429).set('Retry-After','60').json({error:'Please wait a minute before requesting more records.'});
    try{
      const result=await service[ROUTES.get(req.path)](input);
      if(Buffer.byteLength(JSON.stringify(result))>9*1024*1024)return res.status(413).json({error:'Narrow the filters to reduce the response size.'});
      return res.json(result);
    }catch(error){
      const status={'invalid-argument':400,'failed-precondition':409,'not-found':404,'resource-exhausted':413,'unavailable':503}[error.code];
      if(!status)console.error(JSON.stringify({event:'public-dashboard-failed',route:req.path,code:error.code||'internal'}));
      return res.status(status||500).json({error:status?error.message:'The report could not be loaded. Please try again shortly.',code:error.code||'internal'});
    }
  };
}
module.exports={createHandler};
