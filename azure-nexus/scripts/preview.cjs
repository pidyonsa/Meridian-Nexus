'use strict';
if(process.env.NODE_ENV==='production' || process.env.WEBSITE_INSTANCE_ID || process.env.WEBSITE_SITE_NAME)throw Error('Preview must never run in Azure.');
process.env.NODE_ENV='development';process.env.NEXUS_PREVIEW='true';
const {MemoryStore}=require('../server/store.cjs');
const {appFor}=require('../server/main.cjs');
const {seed}=require('../tests/fixtures.cjs');
(async()=>{const store=new MemoryStore();await seed(store);const port=Number(process.env.PORT||4180);appFor(store).listen(port,'127.0.0.1',()=>process.stdout.write(`Local synthetic preview: http://127.0.0.1:${port}\n`));})();
