const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const PptxGenJS = require("../../.tools/board-deck/node_modules/pptxgenjs");
const JSZip = require("../../functions/node_modules/jszip");

const out = __dirname;
const name = "Meridian-Nexus-Field-Operations-Executive-Brief";
const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "Meridian | Software and AI";
pptx.subject = "Field-first Nexus and Geo Rep-managed AWS hosting";
pptx.title = "Meridian Nexus | Field Operations Executive Brief";
pptx.company = "Meridian Group";
pptx.lang = "en-ZA";
pptx.theme = { headFontFace: "Arial", bodyFontFace: "Arial", lang: "en-ZA" };
const C = { ink: "183544", navy: "08253D", blue: "226B92", orange: "F37017", teal: "008782", muted: "5B6E7B", line: "D4E0E5", pale: "F2F6F8", aqua: "EAF5F3", warm: "FFF3E9", white: "FFFFFF" };
const logo = path.resolve(out, "../../public/assets/callcycle/meridian.png");
const logoHeader = fs.readFileSync(logo);
const logoAspect = logoHeader.readUInt32BE(16) / logoHeader.readUInt32BE(20);
const refs = {
  region: "https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions.html",
  geo: "https://georep.com/product-features/",
  access: "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_common-scenarios_third-party.html",
  pricing: "https://aws.amazon.com/pricing/",
  calculator: "https://calculator.aws/"
};
const registry = [];
const pageText = [];
let pageNo = 0;
function rect(s, x, y, w, h, fill, line = fill, radius = false) {
  s.addShape(radius ? pptx.ShapeType.roundRect : pptx.ShapeType.rect, { x, y, w, h, rectRadius: .06, radius: .06, fill: { color: fill }, line: { color: line, width: .8 } });
}
function text(s, value, x, y, w, h, size = 14, color = C.ink, bold = false, options = {}) {
  assert.ok(x >= 0 && y >= 0 && x + w <= 13.34 && y + h <= 7.51, value);
  registry.push({ page: pageNo, text: value, x, y, w, h });
  pageText.push(value);
  s.addText(value, { x, y, w, h, fontFace: "Arial", fontSize: size, color, bold, margin: 0, breakLine: false, valign: "top", charSpacing: 0, paraSpaceAfterPt: 0, ...options });
}
function line(s, x1, y1, x2, y2, color = C.blue, arrow = false, dash = false) {
  s.addShape(pptx.ShapeType.line, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2-x1), h: Math.abs(y2-y1), flipH: x2 < x1, flipV: y2 < y1, line: { color, width: 1.5, ...(arrow ? { endArrowType: "triangle" } : {}), ...(dash ? { dashType: "dash" } : {}) } });
}
function page(title, subtitle, section) {
  pageNo++;
  const s = pptx.addSlide();
  s.background = { color: C.white };
  rect(s, 0, 0, 13.333, .70, C.navy);
  rect(s, 0, .70, 13.333, .045, C.orange);
  s.addImage({ path: logo, x: .46, y: .11, w: .49 * logoAspect, h: .49 });
  text(s, "NEXUS  /  FIELD OPERATIONS", 2.40, .24, 5.25, .23, 11.8, C.white, true);
  text(s, "CEO & MD  |  08 SEPTEMBER 2026", 9.18, .24, 3.65, .23, 10.6, "D8E5ED", false, { align: "right" });
  text(s, title, .48, .97, 12.37, .46, 28, C.ink, true);
  text(s, subtitle, .50, 1.54, 12.2, .42, 13.8, C.muted);
  line(s, .48, 7.08, 12.86, 7.08, C.line);
  if (pageNo !== 3) text(s, "CONFIDENTIAL  |  " + section, .50, 7.20, 10.8, .18, 8.6, C.muted);
  text(s, `${pageNo} / 3`, 12.10, 7.15, .74, .25, 11.5, C.ink, true, { align: "right" });
  return s;
}
function label(s, value, x, y, w, color = C.blue) { text(s, value, x, y, w, .24, 11.7, color, true); }
function noteLink(s, value, x, y, w, link) { text(s, value, x, y, w, .24, 9.2, C.blue, false, { hyperlink: { url: link } }); }
function column(s, title, body, x, y, w, color = C.blue, size = 13.5, h = 1.18) {
  rect(s, x, y, .04, 1.54, color);
  label(s, title, x + .15, y + .02, w - .18, color);
  text(s, body, x + .15, y + .40, w - .20, h, size);
}

async function build() {
  // Page 1: Meridian owns the product; Geo Rep operates the proposed AWS platform.
  {
    const s = page("Meridian Nexus, built around the store visit", "Sales reps and merchandisers are the primary users. Managers and clients use the evidence to guide action.", "1. NEXUS TARGET ARCHITECTURE");
    rect(s, 2.95, 2.11, 5.75, 2.89, C.pale, C.line);
    rect(s, 2.95, 2.11, 5.75, .42, C.navy);
    text(s, "MERIDIAN NEXUS  |  AWS, GEO REP-OPERATED", 3.12, 2.22, 5.36, .23, 11.8, C.white, true);

    rect(s, .50, 2.36, 2.03, 1.10, C.warm, "F8C6A1");
    label(s, "FIELD AGENTS", .65, 2.50, 1.73, C.orange);
    text(s, "Geo Rep mobile + API\nNexus Field proposed", .65, 2.85, 1.73, .46, 11.6);
    line(s, 2.54, 2.91, 2.91, 2.91, C.orange, true);
    rect(s, .50, 3.79, 2.03, 1.10, C.aqua, "A7D2CD");
    label(s, "OFFICE + CLIENTS", .65, 3.94, 1.73, C.teal);
    text(s, "Nexus web dashboards\nExisting sidebar retained", .65, 4.27, 1.73, .48, 11.1);
    line(s, 2.54, 4.32, 2.91, 4.32, C.teal, true);

    rect(s, 3.15, 2.78, 2.48, .63, C.white, C.line);
    text(s, "Secure APIs + sign-in", 3.31, 2.98, 2.16, .22, 12.2, C.ink, true);
    rect(s, 5.90, 2.78, 2.58, .63, C.white, C.line);
    text(s, "Workflows + background jobs", 6.04, 2.98, 2.31, .22, 11.0, C.ink, true);
    line(s, 5.65, 3.09, 5.87, 3.09, C.blue, true);
    line(s, 7.19, 3.42, 7.19, 3.57, C.blue);
    line(s, 3.98, 3.57, 7.65, 3.57, C.blue);
    for (const x of [3.98, 5.82, 7.65]) line(s, x, 3.57, x, 3.72, C.blue, true);
    const dataNodes = [
      { x: 3.15, title: "Orders + tasks", body: "Operational database", color: C.blue },
      { x: 4.99, title: "Photos + files", body: "Amazon S3", color: C.orange },
      { x: 6.83, title: "Sales + inventory", body: "Analytics data layer", color: C.teal }
    ];
    for (const item of dataNodes) {
      rect(s, item.x, 3.75, 1.65, .70, C.white, C.line);
      text(s, item.title, item.x + .09, 3.89, 1.48, .23, 11.4, item.color, true);
      text(s, item.body, item.x + .09, 4.18, 1.48, .19, 9.2, C.muted);
    }
    text(s, "Client isolation  |  Monitoring  |  Backups  |  Protected credentials", 3.15, 4.68, 5.35, .19, 9.8, C.muted);
    text(s, "What field teams need", 9.04, 2.14, 3.73, .33, 18, C.ink, true);
    label(s, "SALES REPS", 9.05, 2.67, 3.73, C.orange);
    text(s, "Call cycle and store context;\nquotes, orders and returns;\nclear approval and fulfilment status.", 9.05, 3.02, 3.73, .73, 13.2);
    label(s, "MERCHANDISERS", 9.05, 3.91, 3.73, C.teal);
    text(s, "Attendance, shelf availability,\nprice and promotion checks;\nStock Fix tasks with photo proof.", 9.05, 4.24, 3.73, .73, 13.2);

    column(s, "FIELD VALUE", "Accepted orders, verified shelf work\nand clear ownership of follow-ups.\nMeasure coverage, availability\nand task closure.", .50, 5.26, 4.00, C.orange, 13.2, 1.0);
    column(s, "NON-NEGOTIABLE", "Offline capture, reliable photo sync,\none sign-in and client/store access.\nAbout 1,000 total users; field, office\nand client licence split to confirm.", 4.74, 5.26, 3.90, C.teal, 13.0, 1.0);
    column(s, "HOSTING DECISION", "Move Nexus to AWS with Geo Rep.\nMeridian-owned account recommended;\ncontrolled provider access. Account\nownership and operating scope: TBC.", 8.96, 5.26, 3.88, C.blue, 12.7, 1.0);
    noteLink(s, "Target architecture, not a completed migration. AWS SA Region: Cape Town (af-south-1); Geo Rep region to confirm. [1]", .51, 6.85, 11.72, refs.region);
    s.addNotes(`PRESENTATION PURPOSE\nMeridian is a sales and merchandising business, not principally a software or dashboard business. The primary design problem is helping sales reps and merchandisers complete a productive store visit under variable network coverage. Managers, directors, BI teams and external clients need trustworthy evidence and exceptions. Approximately 1,000 users is the total across roles, not an approved field licence quantity.\n\nARCHITECTURE STATUS\nThe diagram is a logical target, not an assertion that Nexus has migrated. The user has selected AWS hosting operated by Geo Rep. Account ownership is unresolved. Recommend an AWS account controlled by Meridian, with delegated Geo Rep access. Geo Rep's proposal calls the future white-labelled app Nexus Field; it is not an independently verified live Meridian product. Mobile-to-Nexus data flows through the agreed Geo Rep API; do not assume the existing mobile app writes directly to a new Nexus database.\n\nTECHNICAL SCOPE\nNexus currently depends on Firebase Auth, Firestore, Storage and Functions. Full AWS migration requires identity and claims mapping, API and background-job ports, data conversion, file movement, equivalent tenant permissions and parallel-run validation. A copied front end or an AWS web host alone does not remove these dependencies. Candidate implementation: a secured web front end, API and container/job services, a transactional database, S3 evidence storage and a separate analytical data layer. Do not force sales-history workloads into the operational task database. Final service selection, limits and region availability require Geo Rep's technical design.\n\nOWNERSHIP\nKeep Meridian repositories, release approval, domains, data export and budget visibility under Meridian control. Provider access should use narrowly scoped roles, temporary credentials and audit trails, not shared root credentials. If Geo Rep insists on its own account, require a clearly isolated environment, direct export arrangements, tested exit and a named support responsibility matrix before approval.\n\nFUTURE ORDERING\nOrder capture is distinct from retailer sell-out. Validate product, price, customer and availability at submission; preserve an offline draft and an idempotency key, then show pending/accepted/rejected states. Never treat an offline draft as accepted fulfilment.\n\nSOURCES\nMeridian brief and supplied Geo_Rep_Meridian_Partnership.pptx, especially slides 4, 6, 15, 16 and 20. AWS regional location [1]: ${refs.region}\nThird-party role guidance: ${refs.access}\nThe supplier's region is not yet verified. No live infrastructure change was made for this presentation.`);
  }

  // Page 2: distinguish supplier capability claims from Meridian acceptance.
  {
    const s = page("Geo Rep should run the field experience", "Build on the existing product; accept the mobile-to-Nexus workflow only after a representative field pilot.", "2. GEO REP DELIVERY AND ACCEPTANCE");
    rect(s, .50, 2.10, 12.34, 2.23, C.pale);
    rect(s, .73, 2.64, 2.95, 1.01, C.white, "E8B28B");
    text(s, "FIELD MOBILE APP", .91, 2.82, 2.60, .25, 14.5, C.orange, true);
    text(s, "Offline visits, photos and orders\nNexus Field branding proposed", .91, 3.19, 2.60, .39, 11.7);
    line(s, 3.71, 3.15, 4.19, 3.15, C.orange, true);
    rect(s, 4.23, 2.29, 4.41, 1.95, C.white, C.blue);
    label(s, "EXTERNAL GEO REP  |  AWS", 4.43, 2.45, 4.00, C.blue);
    text(s, "Field records and mobile sync\nVisits, attendance, forms, tasks, orders", 4.43, 2.96, 4.00, .58, 13.2, C.ink, true);
    text(s, "Existing product; Meridian API scope to confirm", 4.43, 3.73, 4.00, .18, 10.2, C.muted);
    line(s, 8.67, 3.15, 9.18, 3.15, C.blue, true);
    text(s, "API", 8.69, 2.79, .44, .18, 9.5, C.blue, true, { align: "center" });
    rect(s, 9.22, 2.64, 3.38, 1.01, C.aqua, "A7D2CD");
    text(s, "MERIDIAN NEXUS  |  AWS", 9.40, 2.83, 3.00, .24, 12.7, C.teal, true);
    text(s, "Exceptions, Insights and client evidence", 9.40, 3.21, 3.00, .36, 11.8);
    line(s, 10.91, 3.69, 10.91, 4.11, C.teal, false, true);
    line(s, 10.91, 4.11, 8.66, 4.11, C.teal, true, true);
    text(s, "Task / order write-back\nAPI access to prove", 8.76, 3.69, 2.02, .38, 9.4, C.muted);
    noteLink(s, "Geo Rep advertises offline field capture and sales [2]. API access, LMS feeds, SSO and white-label rights require confirmation.", .52, 4.47, 12.20, refs.geo);

    column(s, "BENEFIT / DISADVANTAGE", "Reuse established field workflows.\nReduce duplicate capture and app\nswitching. Trade-off: dependence\non the supplier, its API and licences.", .50, 4.96, 3.95, C.orange, 13.0, 1.06);
    column(s, "PILOT ACCEPTANCE", "Capture offline for a full shift.\nRecover photo queues after restart.\nRetry without duplicate orders.\nTest speed on actual field devices.", 4.74, 4.96, 3.95, C.teal, 13.0, 1.06);
    column(s, "SECURITY + SERVICE", "Client isolation; encrypted device data.\nLost-device controls; scoped GPS use.\nNamed support and incident SLAs.\nProve backups and restoration.", 8.96, 4.96, 3.88, C.blue, 12.7, 1.06);
    rect(s, .50, 6.57, 12.34, .40, C.aqua);
    text(s, "Geo Rep operates the service; Meridian retains product decisions, data access and release acceptance.", .68, 6.69, 11.98, .23, 12.4, C.teal, true);
    s.addNotes(`WHY THE FIELD EMPHASIS MATTERS\nThe provider proposal says Geo Rep already supports Meridian's field operation. Its public product pages describe schedules, forms, tasks, sales capture and offline use. These are supplier statements, not proof that every capability, API or commercial entitlement is included for Meridian. The proposed Nexus Field name is white-labelling, not automatically ownership of Geo Rep's platform or source code.\n\nPILOT DESIGN\nUse sales reps and merchandisers across representative stores, regions, devices and connectivity conditions; include supervisors and client-specific permission scenarios. Agree sample size and pilot dates with Meridian and Geo Rep. Proposed acceptance tests: complete a shift offline; persist drafts and photo upload queues through application restart; reconcile submissions after reconnection without silent loss; avoid duplicate orders using idempotent submission; retain failed/pending states users can understand; and check that a person can only see assigned client/store data. Measure battery use, data consumption, crashes and p95 screen/action latency. Suggested initial targets for negotiation, not supplier commitments: cached daily work opens within two seconds on agreed devices, and queued activity begins syncing within one minute of stable connectivity. Agree payload and network conditions first.\n\nPERFORMANCE ASSESSMENT\nThere is no validated end-to-end mobile, concurrent-user or production SLA benchmark in this presentation. Login-page transfer time does not establish field performance. The prior small API-read sample is not a contractual speed measure and is not used here to certify the supplier. Require documented rate limits, cursor/delta pagination, webhook availability, retry-after handling, endpoint coverage and resumable synchronization. Do not put heavy upstream API requests in the critical path of every screen.\n\nSECURITY AND SUPPORT\nDevice loss and offline local data are key risks. Require encrypted cached business data, short-lived sessions, a clear revocation process, device management policy and reauthentication controls. Location data should serve agreed attendance/visit purposes with proportionate access and retention; location alone is not proof of productive work. Minimise incidental personal data in shelf photos. Human users and AI tools must respect client/store permissions. Inspect current security assurance reports for the correct entity, scope and exceptions rather than accepting logos as certification evidence. Contract support coverage, response and restoration objectives, escalation, backup ownership and restoration drills.\n\nAI / IMAGE RECOGNITION / WHATSAPP\nTreat these as phased integrations, not accepted deliverables merely because they appear in the pitch. Keep Gemini Flash as the current Nexus AI constraint unless Meridian explicitly changes it. Region, privacy, service access and cost must be checked before production. IR needs Meridian retailer/SKU ground truth, confidence thresholds and human review before commercial compliance reporting. WhatsApp needs identity verification, appropriate messaging permissions, retention controls and escalation. AI can draft a task; consequential orders and external messages need authorised confirmation.\n\nSOURCES\nGeo Rep product pages [2]: ${refs.geo}\nMeridian-supplied Geo_Rep_Meridian_Partnership.pptx slides 4, 11-17 and 20. Supplier six-week AI and uninterrupted-transition claims are not accepted timelines or service guarantees.`);
  }

  // Page 3: keep retailer sell-out distinct from field captures and future orders.
  {
    const s = page("Catalyst data must drive action in store", "Retailer sales and inventory identify the issue; the field visit verifies it, resolves it and provides evidence.", "3. CATALYST, COMMERCIALS AND DECISION");
    const nodes = [
      { x: .50, w: 2.38, title: "RETAILERS", body: "Clicks, Shoprite + others\nSales + inventory exports", color: C.orange, fill: C.warm },
      { x: 3.28, w: 2.57, title: "CATALYST  |  AWS", body: "External service provider\nAPI access pending", color: C.blue, fill: C.pale },
      { x: 6.25, w: 2.82, title: "NEXUS  |  AWS", body: "Validate store / product data\nInsights + Stock Fix priorities", color: C.teal, fill: C.aqua },
      { x: 9.47, w: 3.37, title: "FIELD EXECUTION", body: "Task, shelf check and photo proof\nManager confirms closure", color: C.orange, fill: C.warm }
    ];
    for (const item of nodes) {
      rect(s, item.x, 2.54, item.w, 1.31, item.fill, C.line);
      text(s, item.title, item.x + .16, 2.77, item.w - .30, .25, 13.3, item.color, true);
      text(s, item.body, item.x + .16, 3.23, item.w - .30, .44, 11.6);
    }
    label(s, "RETAILER SOURCE", .51, 2.16, 2.70, C.muted);
    label(s, "SUPPLIER BOUNDARY", 3.29, 2.16, 2.75, C.muted);
    label(s, "MERIDIAN BUSINESS RULES", 6.26, 2.16, 3.00, C.muted);
    label(s, "GEO REP MOBILE / NEXUS FIELD", 9.48, 2.16, 3.37, C.muted);
    for (let i = 0; i < nodes.length - 1; i++) line(s, nodes[i].x + nodes[i].w + .025, 3.18, nodes[i + 1].x - .035, 3.18, C.blue, true);
    line(s, 11.10, 3.89, 11.10, 4.17, C.teal);
    line(s, 11.10, 4.17, 7.69, 4.17, C.teal, true);
    text(s, "Completion evidence returns to Nexus", 8.53, 4.30, 4.04, .23, 11.1, C.teal);
    text(s, "Retailer sell-out is not rep-captured orders. Show source dates; daily feeds are not real-time.", .53, 4.45, 7.72, .37, 11.9, C.muted);

    column(s, "BENEFITS + RISKS", "Focus visits on stock and sales gaps.\nRisk: stale feeds, retailer access\nchanges and incorrect SKU mapping.\nRetain source lineage and retry alerts.", .50, 4.98, 3.94, C.orange, 12.6, 1.04);
    column(s, "COSTS: QUOTE REQUIRED", "36-month total: AWS + field licences\n+ support + retailer feeds + migration\n+ AI, image recognition and WhatsApp.\nTrack cost per field user / store visit.", 4.74, 4.98, 3.95, C.teal, 12.6, 1.04);
    column(s, "APPROVAL GATES", "1  Pilot Stock Fix; retain current service.\n2  Reconcile feeds and test recovery.\n3  Prove ordering, then AI / IR / WhatsApp.\nReplace Catalyst only after acceptance.", 8.96, 4.98, 3.88, C.blue, 12.1, 1.04);
    rect(s, .50, 6.58, 12.34, .41, C.navy);
    text(s, "Approve a scoped Geo Rep-managed AWS pilot, not an unconditional platform handover.", .70, 6.69, 11.94, .25, 13.0, C.white, true);
    noteLink(s, "AWS consumption is usage-priced [3]; supplier fees, volumes and an approved budget remain unconfirmed.", .53, 7.19, 10.90, refs.pricing);
    // Replace the normal footer label on this page to leave room for the cost source.
    s.addNotes(`CATALYST ROLE AND EVIDENCE\nMeridian states that Catalyst is an external AWS-hosted supplier that automates retailer sales and inventory collection, including Clicks and Shoprite. Its API access is pending. This is a logical integration diagram, not an audited view of Catalyst's infrastructure. Do not assume specific endpoints, update cadence, retail coverage, retention, service region, prices or handover rights. The supplied Geo Rep proposal lists replacing Catalyst as a workstream; it does not establish that the replacement already exists.\n\nDATA CONTRACT\nObtain authorised retailer access, source file/API formats, business definitions, identifiers, delivery schedule, backfill coverage, cancellations/corrections, data ownership and error handling. Map Meridian store and product masters before creating tasks. Reconcile retailer totals and selected client/store/SKU samples against the handed-over Insights source. Preserve raw source versions, freshness and quality status. Field orders are not retailer sell-out; shelf observations, system stock and actual sale are different measures. A daily source is not real-time and cannot support current availability claims without an explicit timestamp and definition.\n\nFUTURE MIGRATION OF CATALYST'S FUNCTION\nRetain the existing supplier until a replacement passes retail-access authorisation, historical reconciliation, fresh-feed comparison, recovery from missed runs, alerting and support acceptance. Dual-run a controlled retailer subset before decommissioning. Obtain the right to use the connector code and maintain source access; moving a function does not mean ownership of a supplier's company or product.\n\nCOST AND VALUE\nNo supplier quote or workload-sized AWS estimate is available. The previous general cloud allowances were illustrative and are not adopted as a field-operations budget. Request comparable 36-month pricing for setup/migration, AWS consumption, active field/mobile licences, manager/client access, white-label/API entitlements, support, retailer feeds, connectivity and device management, AI tokens, images, WhatsApp messages, backup/egress, and exit/export assistance. Distinguish once-off costs, recurring commitments and variable consumption; identify taxes and overage rates. Ask whether a managed package includes AWS consumption to avoid double-counting. Build low/base/peak cases with actual concurrent users, visits, orders, image count/size/retention, sync traffic, warehouse scans and message volumes. About 1,000 total users is not automatically 1,000 chargeable Geo Rep seats. Cost per accepted order, active field user and completed visit should be compared against a measured baseline, not claimed ROI.\n\nDECISION OPTIONS\nPreferred: Meridian-owned AWS account and repositories, operated by Geo Rep under a scoped agreement and Meridian release acceptance. Alternative: a dedicated Meridian environment in Geo Rep's AWS account only if isolation, access, security, budgets and a tested exit are adequate. Retained in-house delivery remains a fallback if the provider cannot meet these conditions. AWS alone does not prove better application performance or lower total cost.\n\nPHASES\nFirst prove an end-to-end Stock Fix cycle: retailer signal, validated task, mobile execution, evidence, closure and reporting. Then complete SSO/access, historical reconciliation and recovery acceptance. Add mobile ordering only after price/availability checks, duplicate prevention and approval routing are proven. Add IR, Gemini Flash AI and WhatsApp with dataset-based evaluation and human approval for consequential actions. Timelines are to be scoped; no unconditional cutover or zero-downtime guarantee is asserted.\n\nSOURCES\nCatalyst description: Meridian brief. Geo Rep proposed replacement: supplied pitch slides 17 and 20. AWS pricing [3]: ${refs.pricing}\nWorkload estimate: ${refs.calculator}\nAWS role model: ${refs.access}`);
  }

  // The third page uses a linked pricing footer instead of the generic footer text.
  const overlap = [];
  for (let a=0; a<registry.length; a++) for(let b=a+1; b<registry.length; b++) {
    const l=registry[a], r=registry[b];
    if(l.page !== r.page) continue;
    const x = Math.min(l.x+l.w,r.x+r.w)-Math.max(l.x,r.x);
    const y = Math.min(l.y+l.h,r.y+r.h)-Math.max(l.y,r.y);
    if(x>.02 && y>.02) overlap.push({ page:l.page, a:l.text, b:r.text });
  }
  assert.equal(overlap.length, 0, JSON.stringify(overlap));
  fs.writeFileSync(path.join(out, "layout.json"), JSON.stringify(registry, null, 2));
  fs.writeFileSync(path.join(out, "slide-text.txt"), pageText.join("\n\n"));
  await pptx.writeFile({ fileName: path.join(out, name + ".pptx") });
  const zip = await JSZip.loadAsync(fs.readFileSync(path.join(out, name + ".pptx")));
  assert.equal(Object.keys(zip.files).filter(file => /^ppt\/slides\/slide\d+\.xml$/.test(file)).length, 3);
  console.log(JSON.stringify({ powerPoint: path.join(out, name + ".pptx"), slides: 3, overlappingTextBoxes: overlap.length }));
}
build().catch(error => { console.error(error); process.exitCode=1; });
