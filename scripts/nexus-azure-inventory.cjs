'use strict';
const fs = require('node:fs/promises'), path = require('node:path');
const {json} = require('./release-multi-admin.cjs');
const project = 'meridain-nexus';
const directory = path.resolve(__dirname, '../.tmp/nexus-azure-migration', new Date().toISOString().replace(/[:.]/g, '-'));
const database = `projects/${project}/databases/(default)`;
async function readWithRetry(endpoint, method, body, request = json, pause = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  for (let attempt = 0; ; attempt++) {
    try { return await request(endpoint, method, body); }
    catch (error) {
      if (attempt >= 3 || !/fetch failed|ECONNRESET|ETIMEDOUT|^(GET|POST) (408|429|500|502|503|504):/.test(error.message)) throw error;
      await pause(500 * 2 ** attempt);
    }
  }
}
async function pages(endpoint, key, body, request = readWithRetry) {
  const items = []; let token;
  const seen = new Set();
  do {
    const url = new URL(endpoint);
    if (token && !body) url.searchParams.set('pageToken', token);
    const result = await request(url.href, body ? 'POST' : 'GET', body ? {...body,...(token ? {pageToken:token} : {})} : undefined);
    if (result.unreachable?.length) throw new Error('Inventory regions unreachable: ' + result.unreachable.join(', '));
    items.push(...result[key] || []); token = result.nextPageToken;
    if (token && seen.has(token)) throw new Error('Inventory pagination token repeated.');
    if (token) seen.add(token);
  } while (token);
  return items;
}
async function main() {
  await fs.mkdir(directory, {recursive:true});
  const inventory = {at:new Date().toISOString(),project,mode:'metadata-only',errors:[],warnings:[],completeness:{subcollections:false,secretValues:false,sourceBundles:false}};
  const save = async() => fs.writeFile(path.join(directory,'inventory.json'),JSON.stringify(inventory,null,2));
  async function step(name, action) {
    const errorsBefore=inventory.errors.length;
    try {inventory[name] = await action(); console.log(JSON.stringify({step:name,complete:inventory.errors.length===errorsBefore}));}
    catch(error) {inventory.errors.push({step:name,message:String(error.message).slice(0,300)});console.log(JSON.stringify({step:name,complete:false,message:String(error.message).slice(0,160)}));}
    await save();
  }
  await step('databases',async()=>{
    const result = await json(`https://firestore.googleapis.com/v1/projects/${project}/databases`);
    return (result.databases || []).map(d=>({name:d.name,location:d.locationId,type:d.type,pointInTimeRecovery:d.pointInTimeRecoveryEnablement,earliestVersionTime:d.earliestVersionTime}));
  });
  await step('collections',async()=>{
    const ids = await pages(`https://firestore.googleapis.com/v1/${database}/documents:listCollectionIds`,'collectionIds',{pageSize:1000});
    const collections=[];
    for (const id of ids.sort()) {
      const result = await readWithRetry(`https://firestore.googleapis.com/v1/${database}/documents:runAggregationQuery`,'POST',{
        structuredAggregationQuery:{structuredQuery:{from:[{collectionId:id}]},aggregations:[{alias:'count',count:{}}]}
      });
      const count=Number(result.find(row=>row.result)?.result.aggregateFields.count.integerValue);
      collections.push({id,rootDocuments:count});
      inventory.collections = collections;
      await save();
    }
    return collections;
  });
  await step('storage',async()=>{
    const buckets = await pages(`https://storage.googleapis.com/storage/v1/b?project=${project}&fields=items(name,location,versioning,iamConfiguration,softDeletePolicy),nextPageToken`,'items');
    const results=[];
    for (const bucket of buckets) {
      const business=bucket.name===`${project}.firebasestorage.app`;
      const entry={...bucket,businessData:business};
      if (business) {
        const objects=await pages(`https://storage.googleapis.com/storage/v1/b/${bucket.name}/o?versions=true&maxResults=1000&fields=items(name,generation,metageneration,size,md5Hash,crc32c,contentType,contentEncoding,updated,timeCreated,timeDeleted),nextPageToken`,'items');
        await fs.writeFile(path.join(directory,'storage-object-manifest.json'),JSON.stringify({bucket:bucket.name,objects},null,2));
        const prefixes={};
        for(const object of objects){const p=object.name.split('/')[0],s=prefixes[p] ||= {objects:0,bytes:0};s.objects++;s.bytes+=Number(object.size);}
        entry.objects=objects.length;entry.bytes=objects.reduce((sum,o)=>sum+Number(o.size),0);entry.prefixes=prefixes;
      }
      results.push(entry);
    }
    return results;
  });
  await step('functions',async()=>(await pages(`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/-/functions?pageSize=1000`,'functions')).map(f=>({
    name:f.name,state:f.state,runtime:f.buildConfig?.runtime,source:f.buildConfig?.source,event:f.eventTrigger?.eventType,
    eventFilters:f.eventTrigger?.eventFilters,service:f.serviceConfig?.service,identity:f.serviceConfig?.serviceAccountEmail,
    environmentNames:Object.keys(f.serviceConfig?.environmentVariables||{}),secretReferences:f.serviceConfig?.secretEnvironmentVariables,
    cpu:f.serviceConfig?.availableCpu,memory:f.serviceConfig?.availableMemory
  })));
  // The location listing uses v1; jobs require a concrete region, not "-".
  await step('runLocations',async()=>pages(`https://run.googleapis.com/v1/projects/${project}/locations?pageSize=100`,'locations'));
  for (const kind of ['services','jobs']) await step(kind === 'services' ? 'runServices' : 'runJobs',async()=>{
    if (!inventory.runLocations?.length) throw new Error('Cloud Run locations are missing.');
    const result=[];
    for(const location of inventory.runLocations){
      try {
        for(const item of await pages(`https://run.googleapis.com/v2/projects/${project}/locations/${location.locationId}/${kind}?pageSize=100`,kind)) {
          const task = kind === 'jobs' ? item.template?.template : item.template;
          result.push({name:item.name,uri:item.uri,conditions:item.terminalCondition?.state,
            taskCount:item.template?.taskCount,identity:task?.serviceAccount,timeout:task?.timeout,
            containers:task?.containers?.map(c=>({image:c.image,environmentNames:(c.env||[]).map(e=>e.name),
              secretReferences:(c.env||[]).filter(e=>e.valueSource).map(e=>({name:e.name,...e.valueSource})),resources:c.resources}))});
        }
      } catch(error) { inventory.errors.push({step:`run-${kind}`,region:location.locationId,message:String(error.message).slice(0,200)}); }
    }
    return result;
  });
  await step('schedules',async()=>{
    const result=[];
    const locations=await pages(`https://cloudscheduler.googleapis.com/v1/projects/${project}/locations?pageSize=100`,'locations');
    for(const {locationId:region} of locations){
      for(const j of await pages(`https://cloudscheduler.googleapis.com/v1/projects/${project}/locations/${region}/jobs?pageSize=500`,'jobs'))result.push({name:j.name,schedule:j.schedule,timeZone:j.timeZone,state:j.state,target:j.httpTarget?.uri || j.pubsubTarget?.topicName,lastAttempt:j.lastAttemptTime});
    }
    return result;
  });
  await step('secrets',async()=>(await pages(`https://secretmanager.googleapis.com/v1/projects/${project}/secrets?pageSize=100`,'secrets')).map(s=>({name:s.name,created:s.createTime})));
  await step('hosting',async()=>{
    const sites=await pages(`https://firebasehosting.googleapis.com/v1beta1/projects/${project}/sites?pageSize=100`,'sites');
    const result=[];
    for(const site of sites) {
      const live=await readWithRetry(`https://firebasehosting.googleapis.com/v1beta1/${site.name}/channels/live`);
      const version=live.release?.version;
      result.push({name:site.name,version:version?.name,releaseTime:live.release?.releaseTime,
        files:version ? await pages(`https://firebasehosting.googleapis.com/v1beta1/${version.name}/files?pageSize=1000`,'files') : []});
    }
    return result;
  });
  await step('retailerSchedules',async()=>{
    const fields=['name','active','enabled','schedule','extractionProfileId','automationEnabled'];
    const query=new URLSearchParams({pageSize:'1000'});
    for(const field of fields) query.append('mask.fieldPaths',field);
    return pages(`https://firestore.googleapis.com/v1/${database}/documents/retailers?${query}`,'documents');
  });
  await step('bigQuery',async()=>(await pages(`https://bigquery.googleapis.com/bigquery/v2/projects/${project}/datasets?all=true&maxResults=1000`,'datasets')).map(d=>({id:d.id,location:d.location})));
  await step('authSummary',async()=>{
    let next,users=0,disabled=0; const providers={};
    do{
      const url=new URL(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:batchGet`);
      url.searchParams.set('maxResults','1000');url.searchParams.set('fields','users(disabled,providerUserInfo(providerId)),nextPageToken');
      if(next)url.searchParams.set('nextPageToken',next);
      const result=await json(url.href);
      for(const u of result.users||[]){users++;disabled+=u.disabled?1:0;for(const p of u.providerUserInfo||[])providers[p.providerId]=(providers[p.providerId]||0)+1;}
      next=result.nextPageToken;
    }while(next);
    return {users,disabled,providers,passwordsExported:false};
  });
  inventory.completedAt=new Date().toISOString(); await save();
  console.log(JSON.stringify({directory,collections:inventory.collections?.length,rootDocuments:inventory.collections?.reduce((n,c)=>n+c.rootDocuments,0),
    storage:inventory.storage?.filter(b=>b.businessData).map(b=>({bucket:b.name,objects:b.objects,bytes:b.bytes,prefixes:b.prefixes})),
    functions:inventory.functions?.length,services:inventory.runServices?.length,jobs:inventory.runJobs?.length,schedules:inventory.schedules?.length,
    secrets:inventory.secrets?.length,bigQuery:inventory.bigQuery,auth:inventory.authSummary,errors:inventory.errors},null,2));
  if(inventory.errors.length)process.exitCode=1;
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={pages,readWithRetry};
