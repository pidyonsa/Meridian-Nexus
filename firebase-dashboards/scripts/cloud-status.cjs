'use strict';
const h=require('../../scripts/repair-attendance-september-weeks.cjs');
(async()=>{
  const api=await h.apiClient();
  const data=await api('https://logging.googleapis.com/v2/entries:list','POST',{resourceNames:['projects/meridain-nexus'],filter:'resource.type="cloud_run_revision" AND resource.labels.service_name="publicmeridiandashboards" AND severity>=ERROR',orderBy:'timestamp desc',pageSize:8});
  console.log(JSON.stringify((data.entries||[]).map(e=>({at:e.timestamp,message:e.textPayload,code:e.jsonPayload?.code,event:e.jsonPayload?.event,status:e.httpRequest?.status})),null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
