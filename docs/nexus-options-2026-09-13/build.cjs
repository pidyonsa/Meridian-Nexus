const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const PptxGenJS = require('../../.tools/board-deck/node_modules/pptxgenjs');
const JSZip = require('../../functions/node_modules/jszip');

const out = __dirname;
const name = 'Meridian-Nexus-Data-and-Application-Options-2026-09-13';
const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'Meridian | Software and AI';
pptx.company = 'Meridian Group';
pptx.subject = 'Catalyst, Geo Rep and Meridian: data custody, application integration, cost and risk';
pptx.title = 'Meridian Nexus | Data and Application Options';
pptx.lang = 'en-ZA';
pptx.theme = { headFontFace: 'Arial', bodyFontFace: 'Arial', lang: 'en-ZA' };
const C = { ink:'193344', navy:'08253D', blue:'226B92', orange:'ED6B14', teal:'007D73', muted:'596F7B', line:'D4E0E5', pale:'F2F6F8', aqua:'EAF5F3', warm:'FFF3E9', red:'A63732', white:'FFFFFF' };
const logo = path.resolve(out, '../../public/assets/callcycle/meridian.png');
const png = fs.readFileSync(logo);
const aspect = png.readUInt32BE(16) / png.readUInt32BE(20);
const refs = {
  storageLocation:'https://docs.cloud.google.com/storage/docs/locations',
  bigqueryLocation:'https://docs.cloud.google.com/bigquery/docs/locations',
  firestoreLocation:'https://firebase.google.com/docs/firestore/locations',
  runLocation:'https://docs.cloud.google.com/run/docs/locations',
  storagePrice:'https://cloud.google.com/storage/pricing',
  bigqueryPrice:'https://cloud.google.com/bigquery/pricing',
  runPrice:'https://cloud.google.com/run/pricing',
  firestorePrice:'https://cloud.google.com/firestore/pricing',
  calculator:'https://cloud.google.com/products/calculator',
  terms:'https://cloud.google.com/terms',
  privacy:'https://firebase.google.com/support/privacy',
  shared:'https://docs.cloud.google.com/architecture/framework/security/shared-responsibility-shared-fate',
  popia:'https://www.justice.gov.za/legislation/acts/2013-004.pdf',
  budgets:'https://docs.cloud.google.com/billing/docs/how-to/budgets',
  geo:'https://georep.com/product-features/'
};
const costs = [
  ['Lake files, history and backup storage',600,1500],
  ['BigQuery storage and analytical queries',1000,3000],
  ['APIs, ETL jobs and operational data',1800,4000],
  ['Logs, secrets and security services',600,1500],
  ['Network, serving and fixed outbound IP',1000,2500]
];
const low = costs.reduce((n,r)=>n+r[1],0);
const high = costs.reduce((n,r)=>n+r[2],0);
const cloud = [low*1.2, high*1.2];
const retainer = 25000;
const api = 60000;
assert.deepEqual(cloud,[6000,15000]);
assert.equal(retainer*12+api,360000);
assert.deepEqual(cloud.map(n=>n*12),[72000,180000]);
assert.deepEqual(cloud.map(n=>n*12+retainer*12+api),[432000,540000]);
let pageNo = 0;
const registry = [];
const allText = [];
const allNotes = [];
function rect(s,x,y,w,h,fill,stroke=fill) {
  s.addShape(pptx.ShapeType.rect,{x,y,w,h,fill:{color:fill},line:{color:stroke,width:.6}});
}
function text(s,value,x,y,w,h,size=13,color=C.ink,bold=false,opts={}) {
  assert.ok(x>=0 && y>=0 && x+w<=13.34 && y+h<=7.51, value);
  registry.push({page:pageNo,text:value,x,y,w,h});
  allText.push(value);
  s.addText(value,{x,y,w,h,fontFace:'Arial',fontSize:size,color,bold,margin:0,valign:'top',charSpacing:0,paraSpaceAfterPt:0,...opts});
}
function label(s,value,x,y,w,color=C.blue,size=11.5) { text(s,value,x,y,w,.24,size,color,true); }
function line(s,x1,y1,x2,y2,color=C.line,arrow=false) {
  s.addShape(pptx.ShapeType.line,{x:Math.min(x1,x2),y:Math.min(y1,y2),w:Math.abs(x2-x1),h:Math.abs(y2-y1),flipH:x2<x1,flipV:y2<y1,line:{color,width:1.2,...(arrow?{endArrowType:'triangle'}:{})}});
}
function page(title,subtitle,section) {
  pageNo++;
  const s = pptx.addSlide();
  s.background={color:C.white};
  rect(s,0,0,13.333,.69,C.navy);
  rect(s,0,.69,13.333,.045,C.orange);
  s.addImage({path:logo,x:.47,y:.10,w:.48*aspect,h:.48});
  text(s,'NEXUS  /  DATA & APPLICATION OWNERSHIP',2.35,.24,6.1,.22,11.2,C.white,true);
  text(s,'CEO & MD  |  13 SEPTEMBER 2026',9.05,.24,3.78,.22,10.3,'D8E5ED',false,{align:'right'});
  text(s,title,.50,.94,12.33,.49,26,C.ink,true);
  text(s,subtitle,.50,1.52,12.33,.44,12.7,C.muted);
  line(s,.50,7.08,12.83,7.08);
  text(s,'CONFIDENTIAL',.50,7.23,1.30,.17,8.5,C.muted,true);
  text(s,`${pageNo} / 5`,12.12,7.18,.71,.24,11.4,C.ink,true,{align:'right'});
  allText.push(`SECTION: ${section}`);
  return s;
}
function footer(s,items) {
  let x=1.98;
  for(const [title,w,url] of items) {
    text(s,title,x,7.21,w,.19,8.6,C.blue,false,url?{hyperlink:{url}}:{});
    x+=w+.16;
  }
}
function notes(s,value) { s.addNotes(value); allNotes.push(`PAGE ${pageNo}\n\n${value}`); }
function flowbox(s,title,body,x,y,w,h,color) {
  rect(s,x,y,w,h,C.pale,C.line);
  rect(s,x,y,.045,h,color);
  text(s,title,x+.14,y+.10,w-.28,.23,12,color,true);
  if(body) text(s,body,x+.14,y+.40,w-.28,h-.43,11.3,C.ink);
}
function ribbon(s,value,y=6.64,color=C.navy,size=12.2) {
  rect(s,.50,y,12.33,.37,color);
  text(s,value,.66,y+.085,12.0,.23,size,C.white,true);
}
function money(n) { return 'R'+Math.round(n).toLocaleString('en-ZA'); }

async function build() {
  {
    const s=page('Choose the data home and the application operator',
      "Three operating models for one Nexus portal. Around 1,000 users: field teams, office teams and authorised client viewers.", 'Decision');
    const options=[
      {x:.50,n:'01',title:'CATALYST HOLDS THE DATA',tag:'Continuity option',color:C.blue,
       source:'Retailer sales + inventory',host:'Catalyst extraction + supplier data',hostBody:'Existing service; exact hosting unconfirmed',app:'Meridian integrates Nexus',appBody:"Carin's handover still needs integration",
       benefit:'Retain current feeds and supplier knowledge; avoid an immediate data cutover.',
       risk:'API/export limits and supplier dependency remain. The quoted retainer is not a complete Nexus integration service.'},
      {x:4.72,n:'02',title:'GEO REP HOLDS THE DATA',tag:'Managed integration option',color:C.orange,
       source:'Retailer feeds + Geo field data',host:'Geo Rep data + integration services',hostBody:'Proposed AWS model; scope and quote needed',app:'Geo integrates + hosts one Nexus',appBody:"Carin's scripts + current Nexus capabilities",
       benefit:'Potentially one accountable integration and hosting partner, aligned with field operations.',
       risk:'Data, hosting and field services concentrate in one supplier. Firebase migration and retailer ETL must be priced and proven.'},
      {x:8.94,n:'03',title:'MERIDIAN HOLDS THE DATA',tag:'Recommended strategic destination',color:C.teal,
       source:'Authorised supplier feeds + files',host:'Meridian lake on Google Cloud',hostBody:'Johannesburg | Meridian-controlled account',app:'Meridian integrates + hosts Nexus',appBody:'Continue the existing Firebase integration',
       benefit:'Reuse Nexus work; control data access and priorities for mobile, AI and client reporting.',
       risk:'Meridian owns integration, security and support obligations. A cloud bill does not fund the people or replace retailer extraction.'}
    ];
    for(const o of options) {
      label(s,o.n,o.x,2.08,.34,o.color,12);
      label(s,o.title,o.x+.43,2.08,3.50,o.color,10.8);
      text(s,o.tag,o.x,2.42,3.90,.23,11.3,C.muted);
      rect(s,o.x,2.83,3.89,.35,C.pale);
      text(s,o.source,o.x+.14,2.91,3.61,.20,11.4,C.ink,true);
      line(s,o.x+1.945,3.19,o.x+1.945,3.36,o.color,true);
      flowbox(s,o.host,o.hostBody,o.x,3.40,3.89,.76,o.color);
      line(s,o.x+1.945,4.18,o.x+1.945,4.35,o.color,true);
      flowbox(s,o.app,o.appBody,o.x,4.39,3.89,.76,o.color);
      label(s,'BENEFIT',o.x,5.34,3.89,o.color,10.4);
      text(s,o.benefit,o.x,5.63,3.89,.49,11.4);
      label(s,'TRADE-OFF',o.x,6.16,3.89,C.red,10.4);
      text(s,o.risk,o.x,6.43,3.89,.59,10.8);
    }
    footer(s,[['Basis: Meridian brief + E1 supplier email',3.30],['H1/H2: Carin handovers',2.15],['Google Cloud locations',2.03,refs.storageLocation],['Geo product claims',1.70,refs.geo]]);
    notes(s,`RECOMMENDATION\nPrefer a Meridian-controlled data lake and continued in-house Nexus integration, conditional on funded cover, accepted data rights and operating controls. Retain Catalyst's proven service during transition. Geo Rep remains a valid managed-service alternative if its full quotation and proof of capability outperform the in-house business case. No option is declared cheapest; cost scopes and evidence differ.\n\nTHE THREE OPTIONS\nOption 1 keeps Catalyst as the current data service while Meridian completes the single Nexus application. The supplied quote does not promise to integrate all Carin handovers into Nexus. Option 2 explicitly includes Geo Rep integrating Carin's scripts and the existing Nexus capabilities, plus hosting and data custody; this is a requirement to price, not a confirmed offer. Option 3 retains Meridian's existing Firebase-based product and moves toward a Meridian-controlled analytical repository on Google Cloud Johannesburg. Geo Rep can still provide bounded services without owning the data account.\n\nSCOPE AND EVIDENCE\nE1: supplied RE Info Needed.msg, read locally. Relevant supplier response: Nikita Turck, 8 September 2026, 17:48; forwarded by Jaco Jooste on 9 September and acknowledged by Jeorge Pinto on 10 September. The email is from MAD9000; the user identifies this supplier as Catalyst. This assessment follows that attribution, not an independent legal-entity verification. The email does not answer where the data is hosted, despite that question appearing in the thread. Meridian's earlier brief describes Geo Rep and Catalyst as AWS suppliers; neither the exact account nor region nor access model has been audited.\nH1: Handover - Call Cycle Portal and Coverage Dashboard.docx.\nH2: StockFix_Weekly_Refresh_Azure_Migration_Handover.docx, version 1, 6 September 2026.\nThe supplied assessment PDF has two pages. This revised five-page assessment replaces its platform-neutral/Azure source links and its unsupported POPIA-guarantee statement. It is not a deployment or a certification of current infrastructure. No application or cloud changes are made.\n\nBUSINESS CONTEXT\nMeridian is a sales and merchandising company. Priorities are reliable store visits, shelf availability, orders, task completion and client reporting. About 1,000 users is a total population, not measured concurrency or licensed supplier seats. External clients receive only authorised dashboard access; staff chat remains internal. Retailer sell-out is not interchangeable with rep-captured orders. Future ordering, image recognition, AI and WhatsApp need their own scope, privacy and funding gates.\n\nSOURCE LINKS\n${refs.storageLocation}\n${refs.geo}\nGeo product descriptions are supplier claims, not performance benchmarks or contractual entitlements.`);
  }

  {
    const s=page("Carin's handover is a product integration programme",
      'Require the same complete acceptance scope from Geo Rep and the in-house team. Moving HTML files alone does not complete it.', 'Integration');
    const x=[.50,3.10,7.45];
    rect(s,.50,2.10,12.33,.42,C.navy);
    label(s,'WORKSTREAM',.65,2.22,2.25,C.white,10.8);
    label(s,'WHAT MUST WORK IN ONE NEXUS',3.24,2.22,4.07,C.white,10.8);
    label(s,'COST / MIGRATION IMPLICATION',7.59,2.22,5.08,C.white,10.8);
    const rows=[
      ['Insights + inventory','All source tabs, filters, charts, drilldowns and exports; verified retail sales and inventory totals.','Keep proven calculations. Inventory every sales/DuckDB query and data source before changing storage.'],
      ['Stock Fix end to end','Inventory refresh, roster import, task generation, field capture and reporting; durable job status.','H2 describes separate operational Postgres and reporting DuckDB. Migrating one does not migrate both.'],
      ['Call Cycle + attendance','Master building, coverage, hierarchy, approvals, refresh jobs and rep/merchandiser attendance.','H1 describes a manual three-file master build. Preserve human review; automatic extraction is separate scope.'],
      ['One application shell','One sign-in, Nexus sidebar, consistent roles, client isolation, deep links and mobile layouts.','Geo must price Firebase auth, database/rules, files, functions and current chat/tasks/notifications parity.'],
      ['Production operations','Scheduled jobs, retries, audit logs, rollback, alerts, secrets, backups and a named support owner.','H2 reports jobs lasting 55-75 minutes. Use durable workers, not long browser requests or laptop processes.']
    ];
    rows.forEach((r,i)=>{
      const y=2.52+i*.59;
      rect(s,.50,y,12.33,.59,i%2?C.white:C.pale);
      text(s,r[0],.65,y+.10,2.28,.45,11.8,C.ink,true);
      text(s,r[1],3.24,y+.10,4.04,.46,11.5);
      text(s,r[2],7.59,y+.10,5.08,.46,11.4,C.muted);
      line(s,.50,y+.59,12.83,y+.59);
    });
    label(s,'GEO REP: QUOTE THE WHOLE HANDOVER',.50,5.66,5.90,C.orange,11.6);
    text(s,'Discovery + code integration + any AWS replatforming + data transfer + parallel testing + training + ongoing support. Separate one-off and recurring fees.',.50,5.98,5.90,.51,12);
    label(s,'MERIDIAN: COST THE REMAINING WORK',6.91,5.66,5.92,C.teal,11.6);
    text(s,'Reuse Firebase. Integration cost = remaining engineering/test days x approved internal rate, plus operating cover. Existing staff time is not free.',6.91,5.98,5.92,.59,11.7);
    ribbon(s,'Acceptance: source-design parity + reconciled data + all workflows in one portal, not separate embedded applications.',6.66,C.navy,11.8);
    footer(s,[['H1: Call Cycle handover',2.20],['H2: Stock Fix handover, 6 Sep 2026',3.04],['Source designs + current Nexus: scope baseline, not a fresh audit',4.25]]);
    notes(s,`WHY THIS CHANGES THE COMPARISON\nThe latest instruction requires Geo Rep to bring Carin's dashboards and scripts into one application equivalent to the existing Firebase-based Nexus. A data-lake quote alone is therefore insufficient. Both bidders must price against the same module register and acceptance test set, including business workflows, not only screens. Any handover integration already accepted in Nexus should be reused, not paid for twice. A new inventory is needed to identify what remains incomplete and what Geo can retain unchanged.\n\nHANDOVER FACTS, NOT A LIVE INFRASTRUCTURE AUDIT\nH1 describes the Call Cycle Control Centre as an interactive tool combining three GeoRep exports, reviewing exceptions and publishing a Call Cycle Master. Coverage reads that master and has additional hierarchy-derived refreshes. It is not simply another reporting page. H1/H2 also show that some work had already moved from laptops to managed jobs and organisation repositories; this presentation does not claim all current production scripts still live on personal laptops.\nH2 separates the original StockFix operational Postgres database and field-capture app from the inventory/reporting DuckDB pipeline. Its Azure migration moved the refresh caller; it did not migrate the original application or operational database. These historical boundaries are migration-discovery risks, not proof that the current Nexus is still dependent on each original service. H2 describes the inventory job at 55-75 minutes, dashboard generation at 15-25 minutes and task generation up to approximately 90 minutes. Preserve reviewed destructive-week transition behaviour and use resumable, durable job state. Do not assume a dashboard port completes field capture or task generation.\n\nSHARED DEFINITION OF DONE\n1. All authorised source pages represented in Nexus navigation, source visual/functional parity and responsive layouts.\n2. Common corporate sign-in; backend authorisation for every endpoint and export; no duplicate login page.\n3. Field capture, task lifecycle, chat, notifications, resources and current Nexus capabilities preserved or explicitly excluded with approval.\n4. Reconcile facts by retailer, client, store, product and period; preserve canonical clean-store mappings and manager hierarchy.\n5. Schedule, rerun, retry and diagnose each job from the portal; retain safe manual approvals where needed.\n6. Restore, rollback, mobile/offline behaviour, load, permissions, logs and support ownership tested.\n7. Repository, deployment configuration, documentation, data dictionary and test evidence handed over to Meridian.\n\nCOSTING METHOD\nFor each workstream, list baseline code, remaining gaps, engineering days, testing days, acceptance owner, infrastructure changes and support effort. Geo must state whether it will retain Firebase services or replatform them to AWS and price the difference explicitly. Existing API compatibility, security rules, listeners, queues and file permissions do not convert automatically. Meridian internal effort should be valued at Finance-approved loaded rates and shown separately from cloud cash spending. No internal rate, final module backlog or Geo quotation was supplied, so no invented integration price or total-programme fixed deadline is asserted.`);
  }

  {
    const s=page('Compare the costs without hiding integration effort',
      'Catalyst: supplier email. Geo Rep: no quote. Meridian: Google Cloud infrastructure allowance only, not a total project price.', 'Costs');
    const cols=[.50,4.72,8.94];
    const panels=[
      ['CATALYST | QUOTED',C.blue,'R25,000 / month','Retainer: 2-4 days expected effort; operations, fixes and some small changes. Reviewed periodically.','R60,000 once-off, excl VAT','API: 5-8 workdays; full raw history/export not confirmed. Nexus configuration excluded.'],
      ['GEO REP | QUOTE REQUIRED',C.orange,'Not yet priced','Request a fixed scope for integrating Carin + Nexus, retailer ETL, data migration and hosting.','Separate monthly charges','Hosting, support/SLA, API and field licences; identify overlap with current Geo fees.'],
      ['MERIDIAN | CLOUD ONLY',C.teal,'R6,000-15,000 / month','Indicative infrastructure budget; R72,000-180,000 per year at the same usage. Excludes VAT.','Integration is additional effort','Existing staff capacity, not free work. Finance must value the remaining backlog and support cover.']
    ];
    panels.forEach((p,i)=>{
      const x=cols[i];
      rect(s,x,2.09,3.89,.035,p[1]);
      label(s,p[0],x,2.25,3.89,p[1],10.7);
      text(s,p[2],x,2.59,3.89,.35,20,p[1],true);
      text(s,p[3],x,3.04,3.89,.57,11.5);
      text(s,p[4],x,3.72,3.89,.23,12.5,C.ink,true);
      text(s,p[5],x,4.05,3.89,.53,11.4);
    });
    line(s,.50,4.75,12.83,4.75);
    label(s,'FIRST-YEAR COMPARISON: NO CLAIM OF SAVINGS',.50,4.94,6.00,C.blue,11.2);
    text(s,'Catalyst: R300k retainer; R360k with API.*\nMeridian lake + Catalyst kept for 12 months + API:\nR432k-540k, before other excluded costs.*',.50,5.29,5.93,.70,12.1,C.ink,true);
    text(s,'*Assumes the R25k retainer is ex VAT (not stated in email), unchanged for 12 months; API purchased once. Confirm tax, hosting inclusions and outstanding project fees.',.50,6.08,5.93,.52,10.4,C.muted);
    text(s,'Meridian excludes labour, migration, paid support, source/API fees, AI/IR, WhatsApp, devices and regional-disaster failover. These are not zero-cost items.',.50,6.66,5.93,.34,9.9,C.red);
    label(s,'GOOGLE CLOUD: MONTHLY PLANNING ALLOWANCES',6.79,4.94,6.04,C.teal,10.8);
    costs.forEach((r,i)=>{
      const y=5.29+i*.22;
      text(s,r[0],6.79,y,4.20,.19,10.1);
      text(s,`${money(r[1])}-${money(r[2])}`,11.11,y,1.72,.19,10.1,C.ink,false,{align:'right'});
    });
    line(s,6.79,6.41,12.83,6.41);
    text(s,'Subtotal R5,000-12,500 + 20% reserve = R6,000-15,000',6.79,6.48,6.04,.22,10.7,C.teal,true);
    text(s,'Planning range, not a regional quote. Validate page-5 sizing with actual usage.',6.79,6.78,6.04,.22,9.4,C.muted);
    footer(s,[['E1: RE Info Needed.msg, 8 Sep 2026',3.00],['Storage rates',1.10,refs.storagePrice],['BigQuery rates',1.20,refs.bigqueryPrice],['Cloud Run rates',1.29,refs.runPrice],['Firestore rates',1.18,refs.firestorePrice],['Calculator',.93,refs.calculator]]);
    notes(s,`CATALYST COMMERCIAL EVIDENCE\nE1 states a monthly R25,000 retainer, expecting 2-4 days of effort, to keep the system operational, address fixes/updates and sometimes small changes. The supplier reviews the retainer every few months and may recommend increases if effort consistently grows; migration may also change it. This is not a fixed multi-year rate, unlimited development or a measurable 24/7 SLA. The email says the first September retainer was billed; payment was not independently verified. The retainer's VAT basis, separate infrastructure charges and final project balance are not supplied.\nThe API is R60,000 excluding VAT, estimated 5-8 supplier workdays. It excludes helping configure Meridian dashboards. The described read-only REST datasets are monthly sales by store/region/banner/brand with trends, share of trade, weekly/monthly stock on hand, stock status/availability, listing gaps, store performance/growth/size profiles and reference stores/regions/fiscal calendar. Matching dashboard filters and an OpenAPI specification are promised. This is not a statement that raw transactions, product-line history, all scripts or ownership transfer are included. API credentials may use a key and additional headers, rotation on request and preferred IP restrictions.\n\nCOMMERCIAL JUDGEMENT\nThe proposed API has useful scope but value cannot be established from price and duration alone. Require a sample, full-history and granularity specification, pagination/incremental updates, tenant isolation, throughput, support, secure credential delivery and acceptance-based payment. Avoid treating R60,000 as the price to move Carin's entire application estate or to replace retailer extraction. Obtain a comparable Geo quotation before a price ranking.\n\nARITHMETIC\nR25,000 x 12 = R300,000. Add R60,000 once = R360,000. These comparison figures assume the retainer is ex VAT solely for comparison; the email does not confirm it. Keep that caveat in any onward quotation. Cloud R6,000-15,000 x 12 = R72,000-180,000. If Catalyst and the new lake overlap for a full year and the API is bought once: R360,000 + R72,000-180,000 = R432,000-540,000. This is a partial cost illustration, not total cost of ownership and not a claim of additional spend on top of everything already budgeted. Avoid adding any shared existing Nexus hosting or already-paid API work twice. Existing supplier charges continue until a commercial change and accepted replacement remove them.\n\nGOOGLE CLOUD ESTIMATE BASIS\nThe five rows are rounded ZAR engineering planning allowances, not extracted Johannesburg SKU rates or a supplier quotation. Published primary pricing pages establish billing drivers; region selectors' default rates have not been misrepresented as Johannesburg rates. Allowances total R5,000-12,500 before a 20% usage/price reserve, producing R6,000-15,000. Reprice the actual bill of materials for africa-south1 and the invoice currency. No cloud bill or measured usage was supplied; confidence is low until discovery and a pilot.\nPlanning envelope: 0.5-2 TiB total object footprint INCLUDING retained versions/backups; 0.1-0.5 TiB of analytical tables; 5-20 TiB of query scans/month; daily supplier ingestion and weekly batch rebuilds; about 1,000 registered users with 100 concurrent users as an assumption, not a measurement. Start with production plus a small non-production environment, cached dashboard aggregates and on-demand jobs. Image/voice content growth, frequent full-data scans, streaming requirements or always-on heavy workers require a fresh estimate.\nIncluded categories cover lake storage, analytical queries, batch/API compute, incremental operational data support, logs/secrets, cloud security services and network/serving with fixed outbound IP if needed for API allowlisting. They do not purchase a security review or an engineer. Exclusions: internal labour and ongoing cover, migration/testing, paid cloud-support plan, Catalyst/Geo/retailer/API charges, licensing, AI tokens, image recognition, WhatsApp, mobile devices/connectivity and regional-disaster failover. The common ongoing Nexus baseline must be allocated rather than counted twice.\n\nINTEGRATION COST METHOD\nMeridian: remaining engineering/test days x Finance-approved loaded day rate, plus any external review. Report incremental cash and existing staff opportunity cost separately. Geo: one-off integration and migration price + 12 x hosting/support/API fees + retained source feeds + agreed change/exit charges. Catalyst: its quoted service is not equivalent to either complete build. An internal rate was requested but not supplied when the document was prepared.\n\nPRIMARY PRICING LINKS\n${refs.storagePrice}\n${refs.bigqueryPrice}\n${refs.runPrice}\n${refs.firestorePrice}\n${refs.calculator}\nAccessed 13 September 2026. Budget estimates are not approval to spend.`);
  }

  {
    const s=page('Risk follows control, evidence and operating capacity',
      'Provisional pre-control exposure, not an audit or provider score. H = material gap / decision gate; M = manageable exposure requiring evidence.', 'Risks');
    const widths=[2.00,1.73,1.73,1.73,5.14];
    const xs=[.50,2.50,4.23,5.96,7.69];
    rect(s,.50,2.09,12.33,.43,C.navy);
    ['RISK','CATALYST','GEO REP','MERIDIAN','CONTROL / ACCOUNTABLE OWNER'].forEach((h,i)=>label(s,h,xs[i]+.12,2.22,widths[i]-.24,C.white,10.2));
    const rows=[
      ['Feed / ETL continuity','M | existing feeds','H | new pipeline','H | new imports','Parallel daily + monthly reconciliation; preserve source rights. BI + integration lead.'],
      ['Handover / parity','H | not in quote','H | scope unpriced','M | reuse, then test','Module register; one-portal regression and field workflow tests. Software & AI lead.'],
      ['Data / IP lock-in','H | export unclear','H | concentrated','M | direct control','Raw/history export rights; code assignments; tested exit. Legal + executive sponsor.'],
      ['Security / privacy','H | unverified','H | unverified','H | configuration','Admin MFA, client isolation, secret rotation, operator agreements. IT + Information Officer.'],
      ['Outage / recovery','H | SLA unmeasured','H | SLA unknown','H | single region','Restore proof, recovery targets and region-outage response. IT + service operator.'],
      ['Support / key person','M | retainer limits','H | combined reliance','H | staff dependence','Named deputy, incident cover, release controls and runbooks. Delivery owner.'],
      ['Freshness / cost drift','M | reviewable fee','H | quote + tests due','M | usage exposure','Freshness/latency tests, spend monitoring, quotas and price scope. BI + Finance.']
    ];
    rows.forEach((r,i)=>{
      const y=2.52+i*.445;
      rect(s,.50,y,12.33,.445,i%2?C.white:C.pale);
      r.forEach((v,j)=>text(s,v,xs[j]+.12,y+.09,widths[j]-.24,.32,j===0?11.1:10.1,j>0&&j<4?(v.startsWith('H')?C.red:C.blue):C.ink,j===0));
      line(s,.50,y+.445,12.83,y+.445);
    });
    label(s,'OWNERSHIP IS A CONTRACT + CONTROL, NOT A HOSTING LABEL',.50,5.86,7.09,C.teal,11.0);
    text(s,'Meridian-controlled billing, repositories and recovery access; written rights to custom code, historical data, mappings and exports. Supplier and open-source IP remains subject to its licence.',.50,6.17,7.09,.52,11.7);
    label(s,'SECURITY GATES APPLY TO ALL THREE',8.00,5.86,4.83,C.orange,11.0);
    text(s,'Read-only APIs can still leak data. Keep keys server-side; review AI-generated code and enforce user-scoped AI access. Hosting in JHB is not a POPIA guarantee.',8.00,6.17,4.83,.64,11.5);
    text(s,'Residual risks must be re-rated after evidence. Local backups do not eliminate a Johannesburg-wide outage.',.50,6.85,7.14,.17,9.8,C.muted);
    footer(s,[['POPIA: ss. 19-22, 72',1.95,refs.popia],['Google shared responsibility',2.45,refs.shared],['Cloud terms: IP, section 5.1',2.30,refs.terms],['E1 + H1/H2: scope evidence',2.33]]);
    notes(s,`RISK METHOD\nThis is a qualitative decision assessment using the supplied email, handovers, Meridian's requirements and primary cloud references. No penetration test, SLA audit, throughput benchmark, contract review or verified control inventory was performed. H indicates a material impact with an unresolved scope/control/evidence gate; M indicates manageable exposure that still requires evidence. Missing evidence is not evidence of a security breach. Ratings are not calibrated probabilities and should not be added into an artificial vendor score. Residual risk is not rated down until controls are tested.\n\nWHY THE RATINGS DIFFER\nCatalyst has a lower immediate feed-transition exposure because keeping the existing service avoids replacing the pipeline now; this is not a freshness/performance guarantee. Its email omits a full Nexus integration scope and full-history/raw-export rights. Geo introduces both supplier concentration and an unpriced integration/data migration, so acceptance gates are material. Meridian can reuse current Nexus work and control the cloud account but must actually provide engineering cover and operate security; ownership does not remove upstream dependence or cloud lock-in. A single Johannesburg region leaves a regional outage risk even with local backup copies.\n\nREQUIRED SECURITY AND PRIVACY CONTROLS\nMeridian must define role/client/store access at the backend, including exports and AI retrieval; administrators need MFA and controlled emergency access. No supplier API keys in browser bundles, shared prompts or public source control. Use bounded workload identities, private storage, short-lived download access, TLS, encryption, audit logs and secret rotation. Enforce data retention and limit GPS, photos, message data and customer records to business need. POPIA responsibilities are not outsourced merely by selecting a host; agree operator terms, incident notification and any external processing with the Information Officer. Legal counsel should validate the application to Meridian; this document is not a compliance certification. [POPIA ss.19-22,72]\n\nIP AND EXIT\nMeridian should own assigned bespoke Nexus code, configuration, tests and documentation, subject to employment/contractor agreements and third-party licences. Cloud-provider software remains the provider's IP; Google's terms distinguish customer data/applications from Google services. A white-label portal or paying for an API does not automatically convey provider code. Source retailer data may be licensed rather than unconditionally owned: secure rights to retain, combine, backfill, export and use authorised history after supplier termination. Obtain practical bulk export, data dictionary, mappings, credential transfer/revocation, transition assistance and deletion confirmation. Repositories and billing/recovery contacts should be under Meridian corporate control with at least two named custodians. [Google terms 5.1]\n\nAI CAUTION IN E1\nThe supplier warns about AI-built systems using API access. Treat this as a real implementation-security concern, not proof that every AI-assisted application is unsafe. Review generated code; run secrets/dependency checks and tenant-isolation tests; keep credentials away from models; require human approval before write actions. A read-only API prevents modifications but does not prevent unauthorised reading. Runtime AI must use the current user's permissions and be tested for leakage and unsupported answers.\n\nRECOVERY AND OPERATIONS\nAgree business recovery targets and demonstrated restores rather than using a provider availability headline as an application guarantee. Candidate targets for analytical reporting, for approval only: restored within 4 hours for a recoverable application incident, no more than one daily refresh lost. These do not apply to a whole-region outage or to accepted orders, which need stricter no-loss/idempotency controls. Do not promise these targets before testing and funding them. Keep job checkpoints, retry/duplicate handling and visible last-success timestamps. Set cost alerts plus query/API quotas and spending response procedures; an alerts-only budget is not a hard limit.\n\nREFERENCES\n${refs.popia}\n${refs.shared}\n${refs.terms}\n${refs.budgets}\nAccessed 13 September 2026.`);
  }

  {
    const s=page('Build Meridian ownership in controlled stages',
      'Recommendation: keep useful supplier feeds, retain one Nexus app, and make the Meridian-owned lake the strategic destination.', 'Architecture and Roadmap');
    rect(s,.50,2.10,7.17,2.30,C.pale,C.line);
    rect(s,.50,2.10,7.17,.34,C.navy);
    text(s,'MERIDIAN GOOGLE CLOUD  |  JOHANNESBURG: africa-south1',.65,2.18,6.86,.20,11.0,C.white,true);
    text(s,'Incoming: authorised Catalyst / Geo feeds + retailer files + masters',.69,2.63,6.79,.22,11.7,C.ink,true);
    line(s,1.69,2.93,1.69,3.09,C.teal,true);
    const stages=[['INGEST + VALIDATE','Cloud Run jobs',.69,2.00],['RAW + CLEAN DATA','Cloud Storage',3.04,2.05],['CURATED REPORTING','BigQuery',5.44,2.05]];
    stages.forEach(a=>{
      rect(s,a[2],3.13,a[3],.58,C.white,C.line);
      text(s,a[0],a[2]+.09,3.24,a[3]-.18,.18,9.9,C.teal,true);
      text(s,a[1],a[2]+.09,3.49,a[3]-.18,.18,10.7);
    });
    line(s,2.72,3.43,3.00,3.43,C.teal,true);
    line(s,5.12,3.43,5.40,3.43,C.teal,true);
    line(s,6.46,3.73,6.46,3.87,C.teal,true);
    text(s,'Nexus APIs + dashboards  |  Firestore: operational data, not the data lake',.69,3.91,6.79,.24,11.1,C.ink,true);
    text(s,'Google operates infrastructure; Meridian controls the account, data access and application.',.69,4.20,6.79,.16,9.6,C.muted);
    label(s,'JOHANNESBURG, IN PLAIN LANGUAGE',8.02,2.14,4.80,C.blue,11.0);
    text(s,'A controlled library of raw and cleaned data, stored in the selected Johannesburg cloud region. No office server is needed.',8.02,2.48,4.80,.58,11.7);
    text(s,'Lake storage, analytics and workers are region-bound. Sign-in, delivery networks and external APIs/AI need separate location reviews.',8.02,3.14,4.80,.58,11.5);
    text(s,'Keep proven calculations during relocation. Change queries/storage only after parity tests. BigQuery is a proposed target, not a completed rewrite.',8.02,3.81,4.80,.58,11.3,C.muted);
    label(s,'INDICATIVE PLAN AFTER APPROVAL + ACCESS',.50,4.63,7.17,C.blue,11.2);
    const timeline=[
      ['Weeks 1-2','Inventory Carin + Nexus; confirm data rights, quotations, backlog and cloud sizing.'],
      ['Weeks 3-4','Secure JHB foundation; first authorised feed and one end-to-end module pilot.'],
      ['Weeks 5-8','Integrate agreed modules; compare daily/monthly totals, jobs, exports and roles.'],
      ['Weeks 9-12','Controlled rollout only after restore, parity and support acceptance; retain rollback.']
    ];
    timeline.forEach((r,i)=>{
      const y=4.99+i*.37;
      text(s,r[0],.50,y,1.26,.23,11.2,C.orange,true);
      text(s,r[1],1.94,y,5.73,.30,10.8);
    });
    label(s,'APPROVE NOW / RELEASE LATER',8.02,4.63,4.80,C.teal,11.2);
    text(s,'Approve discovery and Meridian ownership. Get a comparable Geo quote and firm Catalyst API acceptance terms before committing the full programme.',8.02,4.99,4.80,.64,11.8);
    text(s,'No internal cover? Keep Catalyst while procuring managed support. Do not switch off a feed until two complete reporting cycles reconcile and business owners sign off.',8.02,5.80,4.80,.61,11.6,C.ink,true);
    text(s,'Cloud sizing assumption: 0.5-2 TiB files incl. backups; 0.1-0.5 TiB analytical tables; 5-20 TiB scans/month; daily feeds; 100 concurrent users.\nNot measured demand or a delivery promise. All-script scope, full retailer replacement, mobile ordering, IR and WhatsApp need separate estimates.',.50,6.58,12.33,.42,10.1,C.muted);
    footer(s,[['Storage',.76,refs.storageLocation],['BigQuery',.87,refs.bigqueryLocation],['Cloud Run',.92,refs.runLocation],['Firestore',.89,refs.firestoreLocation],['Firebase location limits',1.97,refs.privacy],['Plan + estimates: Meridian assumptions',3.22]]);
    notes(s,`JOHANNESBURG DESIGN BASIS\nThe data lake is a central, governed repository of original and cleaned data, not an operational document database alone. Propose Cloud Storage for raw/versioned files and cleaned portable outputs, BigQuery for curated analytical tables, Cloud Run jobs and APIs for ingestion/validation/serving, and Firestore for operational application records and selected aggregates. Primary documentation lists Johannesburg/africa-south1 for these regional services. Select the actual storage/dataset/runtime locations and confirm feature availability. This architecture states the desired design, not proof that every existing resource is already configured this way. Google manages physical infrastructure; Meridian controls its corporate account, code and data access.\n\nDATA FLOW AND REUSE\nCatalyst may remain an upstream retailer-extraction supplier while Meridian holds authorised copies; source independence is a separate later decision. Geo contributes field activity and orders, not a substitute for retailer sell-out. Preserve masters, source timestamps, client/store/product mapping and complete reporting history. Copying only dashboard summaries may not support later analysis or an exit: agree the required granularity first. Keep working Python/DuckDB calculations in a controlled batch/query service during transition if necessary; adopt curated BigQuery outputs in stages rather than silently changing business logic. Reconcile before changing the reader. Serve the existing single Nexus application with verified roles; do not make each dashboard depend on a live supplier request.\n\nRESIDENCY AND RECOVERY BOUNDARY\nRegional lake storage, analytical data and selected compute can be placed in Johannesburg. This is not a claim that every identity, content-delivery, messaging, AI or supplier service is Johannesburg-resident. Firebase's published location policy requires a separate review of services without regional selection. Maintain transparent data-flow records and operator terms. Backups stored in the same region do not remove a region-wide outage. Decide and fund regional-disaster recovery separately; it is excluded from the initial hosting-only budget.\n\nDELIVERY\nWeeks 1-2: confirm the handover register, completed Nexus work, approved changes, private source access, vendor account/region, contract/IP, test cases, loaded internal rates and a detailed Geo quote. Name Software & AI lead plus a second engineer, IT/InfoSec, BI/Carin as data-validation contributors and business acceptance owners. Finance validates cost scopes.\nWeeks 3-4: private company-controlled foundation, secrets, logging, backup and a representative feed/module pilot. The supplier's 5-8 API workdays are not a complete application integration timeline and depend on supplier scheduling and acceptance.\nWeeks 5-8: agreed module waves, regression tests, permissions, scheduled jobs, data correction/backfill and mobile field testing. Establish baseline and new p95 response times, refresh completion and failure recovery; no measured provider speed comparison is available today.\nWeeks 9-12: gated rollout with training, monitoring and tested rollback. These are indicative overlapping timeboxes for an initial agreed release, NOT a fixed-price or full-handover completion promise. Access delays, retailer consent, schema quality, ETL replacement or new cloud architecture can extend them. Monthly validation must span real complete reporting cycles even if that extends the plan.\n\nDECISION\nPrefer Meridian as the strategic data custodian and continue internal integration where existing capacity and tested controls support it. Authorise discovery first, not unconditional migration or supplier cancellation. Geo should compete on complete integration, support, hosting and exit terms against the SAME source/code inventory. If internal cover is not available, retain Catalyst and buy bounded managed support or reconsider Geo against the evidence. Require explicit corporate account/repository access and contractually protected Meridian IP under every model.\n\nPRICING-ENVELOPE LIMITS\nThe page-3 cloud allowance assumes moderate batched data, caching, production plus small testing, 0.5-2 TiB object footprint including retained versions/backups, 0.1-0.5 TiB analytical tables and 5-20 TiB scans monthly. Approximately 100 simultaneous users is an unverified planning input from a population of about 1,000. It is not evidence that the application supports that load. Increasing volume, retention, non-production size, query scans, images/audio or always-on compute changes cost. Get a region-selected calculator bill of materials and a pilot usage sample before Finance authorises a production budget. Internal labour has not been priced in the infrastructure allowance.\n\nREFERENCES\n${refs.storageLocation}\n${refs.bigqueryLocation}\n${refs.runLocation}\n${refs.firestoreLocation}\n${refs.privacy}\nSources accessed 13 September 2026. No deployment or infrastructure changes form part of this document task.`);
  }

  const overlaps=[];
  for(let a=0;a<registry.length;a++) for(let b=a+1;b<registry.length;b++) {
    const l=registry[a],r=registry[b];
    if(l.page!==r.page) continue;
    const dx=Math.min(l.x+l.w,r.x+r.w)-Math.max(l.x,r.x);
    const dy=Math.min(l.y+l.h,r.y+r.h)-Math.max(l.y,r.y);
    if(dx>.02&&dy>.02) overlaps.push({page:l.page,a:l.text,b:r.text});
  }
  assert.equal(overlaps.length,0,JSON.stringify(overlaps,null,2));
  assert.equal(pageNo,5);
  fs.writeFileSync(path.join(out,'layout.json'),JSON.stringify(registry,null,2));
  fs.writeFileSync(path.join(out,'slide-text.txt'),allText.join('\n\n'));
  fs.writeFileSync(path.join(out,'speaker-notes.txt'),allNotes.join('\n\n\n'));
  fs.writeFileSync(path.join(out,'cost-model.json'),JSON.stringify({date:'2026-09-13',currency:'ZAR',confidence:'Planning allowances, not vendor quotations',catalyst:{monthly:retainer,monthlyVatBasis:'Unstated; assumed ex VAT only for comparisons',oneOffApiExVat:api,annualWithApiAssumingExVat:retainer*12+api},geo:{oneOffIntegration:null,monthlyHosting:null,monthlySupport:null},meridian:{scope:'Cloud infrastructure only',lines:costs,subtotal:[low,high],reservePercent:20,monthly:cloud,annual:cloud.map(n=>n*12),internalLabourRate:null},overlapFullYearWithCatalystAndApi:cloud.map(n=>n*12+retainer*12+api)},null,2));
  await pptx.writeFile({fileName:path.join(out,name+'.pptx')});
  const zip=await JSZip.loadAsync(fs.readFileSync(path.join(out,name+'.pptx')));
  assert.equal(Object.keys(zip.files).filter(f=>/^ppt\/slides\/slide\d+\.xml$/.test(f)).length,5);
  assert.equal(Object.keys(zip.files).filter(f=>/^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(f)).length,5);
  console.log(JSON.stringify({file:name+'.pptx',slides:5,textBoxOverlaps:0,cloudBudget:cloud},null,2));
}
build().catch(e=>{console.error(e);process.exitCode=1;});
