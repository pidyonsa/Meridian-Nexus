const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const PptxGenJS = require("../../.tools/board-deck/node_modules/pptxgenjs");
const JSZip = require("../../functions/node_modules/jszip");

const out = __dirname;
const name = "Meridian-Nexus-In-House-Risk-and-Benefit-Assessment";
const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "Meridian | Software and AI";
pptx.company = "Meridian Group";
pptx.subject = "Meridian-led development, Johannesburg hosting and field operations";
pptx.title = "Meridian Nexus | In-House Risk and Benefit Assessment";
pptx.lang = "en-ZA";
pptx.theme = { headFontFace: "Arial", bodyFontFace: "Arial", lang: "en-ZA" };
const C = { ink: "193344", navy: "08253D", blue: "226B92", orange: "ED6B14", teal: "007D73", muted: "596F7B", line: "D4E0E5", pale: "F2F6F8", aqua: "EAF5F3", warm: "FFF3E9", red: "A63732", white: "FFFFFF" };
const logo = path.resolve(out, "../../public/assets/callcycle/meridian.png");
const png = fs.readFileSync(logo);
const logoAspect = png.readUInt32BE(16) / png.readUInt32BE(20);
const refs = {
  azureRegion: "https://learn.microsoft.com/en-us/azure/reliability/regions-list",
  firestoreRegion: "https://firebase.google.com/docs/firestore/locations",
  responsibility: "https://learn.microsoft.com/en-us/azure/security/fundamentals/shared-responsibility",
  popia: "https://inforegulator.org.za/popia/",
  geo: "https://georep.com/product-features/",
  azureCost: "https://azure.microsoft.com/en-us/pricing/calculator/",
  googleCost: "https://cloud.google.com/products/calculator"
};
let pageNo = 0;
const registry = [];
const slideText = [];
const notesText = [];
function rect(s, x, y, w, h, fill, stroke = fill) {
  s.addShape(pptx.ShapeType.rect, { x, y, w, h, fill: { color: fill }, line: { color: stroke, width: .7 } });
}
function text(s, value, x, y, w, h, size = 14, color = C.ink, bold = false, options = {}) {
  assert.ok(x >= 0 && y >= 0 && x + w <= 13.34 && y + h <= 7.51, value);
  registry.push({ page: pageNo, text: value, x, y, w, h });
  slideText.push(value);
  s.addText(value, { x, y, w, h, fontFace: "Arial", fontSize: size, color, bold, margin: 0, valign: "top", charSpacing: 0, paraSpaceAfterPt: 0, ...options });
}
function line(s, x1, y1, x2, y2, color = C.blue, arrow = false, dashed = false) {
  s.addShape(pptx.ShapeType.line, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), flipH: x2 < x1, flipV: y2 < y1, line: { color, width: 1.4, ...(arrow ? { endArrowType: "triangle" } : {}), ...(dashed ? { dashType: "dash" } : {}) } });
}
function label(s, value, x, y, w, color = C.blue, size = 11.8) {
  text(s, value, x, y, w, .23, size, color, true);
}
function link(s, value, x, y, w, url) {
  text(s, value, x, y, w, .20, 9.1, C.blue, false, { hyperlink: { url } });
}
function page(title, subtitle) {
  pageNo++;
  const s = pptx.addSlide();
  s.background = { color: C.white };
  rect(s, 0, 0, 13.333, .69, C.navy);
  rect(s, 0, .69, 13.333, .045, C.orange);
  s.addImage({ path: logo, x: .47, y: .10, w: .48 * logoAspect, h: .48 });
  text(s, "NEXUS  /  OWNERSHIP & FIELD OPERATIONS", 2.35, .24, 6.32, .22, 11.2, C.white, true);
  text(s, "CEO & MD  |  09 SEPTEMBER 2026", 9.12, .24, 3.72, .22, 10.4, "D8E5ED", false, { align: "right" });
  text(s, title, .48, .97, 12.36, .48, 27, C.ink, true);
  text(s, subtitle, .50, 1.55, 12.30, .38, 13.2, C.muted);
  line(s, .49, 7.08, 12.84, 7.08, C.line);
  text(s, "CONFIDENTIAL", .50, 7.22, 1.31, .17, 8.6, C.muted, true);
  text(s, `${pageNo} / 3`, 12.15, 7.17, .69, .24, 11.5, C.ink, true, { align: "right" });
  return s;
}
function notes(s, value) {
  s.addNotes(value);
  notesText.push(`PAGE ${pageNo}\n\n${value}`);
}
function benefit(s, title, body, x, w, color) {
  rect(s, x, 5.93, .04, .99, color);
  label(s, title, x + .15, 5.96, w - .15, color);
  text(s, body, x + .15, 6.30, w - .20, .59, 12.7);
}

async function build() {
  {
    const s = page("Keep Nexus in-house, with accountable support", "Johannesburg hosting is the design basis. About 1,000 users: field teams first, with office and client dashboards.");
    rect(s, 2.72, 2.10, 6.72, 3.39, C.pale, C.line);
    rect(s, 2.72, 2.10, 6.72, .44, C.navy);
    text(s, "NEXUS  |  DEDICATED MERIDIAN CLOUD  |  JOHANNESBURG", 2.92, 2.23, 6.31, .21, 11.8, C.white, true);
    text(s, "Insights  |  Stock Fix  |  Attendance  |  Call Cycle  |  Orders  |  Chat", 2.94, 2.75, 6.27, .24, 12.0, C.ink, true);

    rect(s, .50, 2.76, 1.88, .97, C.warm, "F2C2A1");
    label(s, "FIELD TEAMS", .65, 2.92, 1.58, C.orange, 11.6);
    text(s, "Sales reps +\nmerchandisers", .65, 3.24, 1.58, .40, 12.1);
    line(s, 2.41, 3.25, 2.68, 3.25, C.orange, true);
    rect(s, .50, 4.09, 1.88, .97, C.aqua, "A7D2CD");
    label(s, "OFFICE + CLIENTS", .65, 4.26, 1.59, C.teal, 10.4);
    text(s, "Assigned access\nand dashboards", .65, 4.57, 1.58, .40, 11.8);
    line(s, 2.41, 4.57, 2.68, 4.57, C.teal, true);

    rect(s, 2.94, 3.16, 2.96, .54, C.white, C.line);
    text(s, "One sign-in + access controls", 3.07, 3.33, 2.70, .23, 11.8, C.ink, true);
    rect(s, 6.13, 3.16, 3.08, .54, C.white, C.line);
    text(s, "Secure APIs + automated jobs", 6.26, 3.33, 2.82, .23, 11.8, C.ink, true);
    line(s, 5.93, 3.43, 6.10, 3.43, C.blue, true);
    line(s, 7.65, 3.73, 7.65, 3.88, C.blue);
    line(s, 3.91, 3.88, 8.22, 3.88, C.blue);
    for (const x of [3.91, 6.07, 8.22]) line(s, x, 3.88, x, 4.01, C.blue, true);
    for (const item of [
      { x: 2.94, title: "Operational data", body: "Orders, tasks, attendance", color: C.blue },
      { x: 5.10, title: "Sales analytics", body: "Validated retailer history", color: C.teal },
      { x: 7.26, title: "Photos + files", body: "Masters and visit evidence", color: C.orange }
    ]) {
      rect(s, item.x, 4.03, 1.95, .60, C.white, C.line);
      text(s, item.title, item.x + .10, 4.16, 1.75, .22, 11.9, item.color, true);
      text(s, item.body, item.x + .10, 4.43, 1.75, .17, 9.6, C.muted);
    }
    text(s, "Next: mobile ordering, image recognition, AI expansion and WhatsApp", 2.94, 4.83, 6.26, .25, 11.8, C.teal, true);
    text(s, "MFA  |  client/store isolation  |  audit logs  |  backups  |  cost controls", 2.94, 5.22, 6.26, .18, 10.4, C.muted);

    rect(s, 9.84, 2.33, 3.00, .79, C.pale, C.line);
    label(s, "GEO REP  |  EXTERNAL, AWS", 9.99, 2.48, 2.70, C.blue, 11.2);
    text(s, "Field activity + order API", 9.99, 2.80, 2.70, .23, 12.0);
    line(s, 9.80, 2.73, 9.48, 2.73, C.blue, true);
    rect(s, 9.84, 3.44, 3.00, 1.03, C.warm, "F2C2A1");
    label(s, "CATALYST  |  EXTERNAL, AWS", 9.99, 3.57, 2.70, C.orange, 10.8);
    text(s, "Retailer sales + inventory\nClicks, Shoprite | API pending", 9.99, 3.88, 2.70, .45, 11.7);
    line(s, 9.80, 3.98, 9.48, 3.98, C.orange, true, true);
    rect(s, 9.84, 4.79, 3.00, .70, C.aqua, "A7D2CD");
    label(s, "SHAREPOINT + SOURCE FILES", 9.99, 4.91, 2.70, C.teal, 10.6);
    text(s, "Attendance reports + masters", 9.99, 5.22, 2.70, .19, 11.5);
    line(s, 9.80, 5.15, 9.48, 5.15, C.teal, true);

    text(s, "Logical hosting model, not migration sign-off. Confirm the cloud platform and each resource location; dotted link = future API.", .51, 5.62, 12.30, .19, 10.4, C.muted);
    benefit(s, "OWN THE BUSINESS PLATFORM", "Meridian controls its code, data, access\nand roadmap; supplier exit stays possible.", .50, 4.00, C.orange);
    benefit(s, "DESIGN FOR THE STORE VISIT", "Prioritise coverage, shelf availability,\naccepted orders and task completion.", 4.74, 3.92, C.teal);
    benefit(s, "BUY EXPERTISE SELECTIVELY", "Keep useful Geo Rep and Catalyst services.\nAdd specialist support without handover.", 8.96, 3.88, C.blue);
    link(s, "Location checks: Azure [1]", 1.99, 7.20, 1.89, refs.azureRegion);
    link(s, "Firestore [2]", 4.04, 7.20, 1.23, refs.firestoreRegion);
    link(s, "Geo Rep capabilities [3]", 5.46, 7.20, 2.00, refs.geo);
    text(s, "Supplier roles: Meridian brief", 8.48, 7.20, 3.31, .20, 9.1, C.muted, false, { align: "right" });
    notes(s, `DECISION AND STATUS\nThis replaces the previous recommendation to move Nexus into Geo Rep-managed AWS. The current decision is whether to retain Meridian-led development and operational control in a dedicated Johannesburg-based cloud environment. Meridian reports that a new dedicated account has been created. The platform name in the latest message is ambiguous; an Azure-versus-Google Cloud clarification has been requested. This presentation therefore uses a platform-neutral Johannesburg logical architecture. It does not certify resource locations, production migration, access configuration or recovery readiness. A cloud account itself is not a region setting. No cloud infrastructure is changed by creating this presentation.\n\nBUSINESS CASE\nMeridian is a sales and merchandising company. Its primary outcomes are effective store visits, reliable ordering, shelf availability, evidence of execution and client trust. Approximately 1,000 users includes field staff, managers, directors, BI, administrators and authorised external client viewers; it does not mean 1,000 simultaneous users or paid Geo Rep seats. Establish each role count before licensing and load estimates. The recommendation is to own the differentiated product and use managed services, not to build every component or operate physical infrastructure. Ownership benefits depend on Meridian-controlled repositories, employment/contractor IP terms, data rights, corporate billing and tested exports. There is no claim of guaranteed savings or faster delivery.\n\nNEXUS AND ITS DATA\nNexus includes Insights, Stock Fix, Time & Attendance, Call Cycle, orders, automation, Resources and staff chat. Client access is limited to explicitly authorised dashboards; staff chat must not be opened to external clients. The architecture separates operational data, analytical history and files. Retailer sell-out and inventory used by Insights are not Geo Rep rep-captured order transactions. Preserve source dates, product/store identifiers, history and reconciliation. Catalyst is an external AWS supplier per Meridian's brief; its API remains pending. Its exact infrastructure and commercial terms have not been independently reviewed. Geo Rep remains an external AWS service supplier per the brief. A supplier using AWS does not by itself require Nexus to use the same cloud; assess secure API access, transfer charges and latency.\n\nJOHANNESBURG IMPLEMENTATION CHECK\nAzure South Africa North is Johannesburg [1]. Cloud Firestore supports africa-south1, Johannesburg; a provisioned database location cannot simply be edited [2]. These are alternative implementation references, not two approved hosting platforms. Nexus's existing Firebase integration is not automatically converted by opening an Azure account: identity/claims, Firestore queries and rules, Storage permissions, functions, workers, schedules and data pipelines require a separately scoped migration and equivalent controls. If the new environment is Google Cloud/Firebase, validate service-by-service locations and undertake a controlled data/application cutover as needed. Confirm managed-service availability, backup placement, identity processing and external AI/API flows before a residency statement. Select implementation services only after platform confirmation.\n\nFIELD AND FUTURE CAPABILITY\nGeo Rep publicly describes field sales, tasks, forms and offline capability [3]; the supplied pitch proposes white-labelling, hosting, support and Catalyst replacement. Those are supplier claims and proposals, not verified entitlements or delivery guarantees. Retain proven existing field tools while piloting Nexus mobile ordering. Require offline drafts, reliable queues, explicit acceptance, duplicate prevention and permission enforcement. Extend existing AI carefully; image recognition and WhatsApp are roadmap items, not asserted completed capabilities. Downstream fulfilment and task write-back require authorised APIs and acceptance testing; inbound arrows do not certify those permissions. Do not put upstream supplier availability in every dashboard request's critical path: ingest and validate data with visible freshness.\n\nREFERENCES (accessed 9 September 2026)\n[1] Azure region list: ${refs.azureRegion}\n[2] Firestore locations: ${refs.firestoreRegion}\n[3] Geo Rep product features: ${refs.geo}\nMeridian-provided Geo_Rep_Meridian_Partnership.pptx, slides 4, 6, 15, 16, 17 and 20. Supplier claims including certification, SSO, API coverage, timeline and service continuity require evidence and contractual confirmation.`);
  }

  {
    const s = page("In-house control comes with operating obligations", "The largest exposure is concentrated knowledge and support. Fund the controls before expanding business-critical use.");
    const xs = [.50, 3.13, 4.08, 10.91];
    rect(s, .50, 2.12, 12.34, .41, C.navy);
    label(s, "RISK / BUSINESS IMPACT", .65, 2.24, 2.36, C.white, 11.0);
    label(s, "LEVEL*", 3.20, 2.24, .78, C.white, 11.0);
    label(s, "REQUIRED CONTROL / ACCEPTANCE EVIDENCE", 4.21, 2.24, 6.40, C.white, 11.0);
    label(s, "PROPOSED OWNER", 11.05, 2.24, 1.64, C.white, 10.3);
    const risks = [
      ["Key-person dependency", "Absence delays fixes", "Two-person deployment and restore cover; runbooks, code review\nand a support retainer.", "Director + IT"],
      ["Client / staff data exposure", "GPS, photos and reports", "MFA, client/store isolation tests, scoped service access;\ndevice revocation and retention rules.", "Information\nOfficer + IT"],
      ["Outage / failed cutover", "Visits and jobs disrupted", "Staged releases, job alerts, versioned backups and restore drills;\nrehearse rollback and a regional-outage response.", "Cloud lead\n+ QA"],
      ["Offline work / order loss", "Poor signal or lost device", "Encrypted local queue; restart and sync tests; duplicate-safe\norders with clear pending, accepted and rejected states.", "Mobile lead\n+ Field Ops"],
      ["Supplier or data failure", "Wrong or stale actions", "API contracts, retries and freshness alerts; reconcile retailer\ntotals and store/product masters; retain export rights.", "BI + API\nowner"],
      ["AI misuse / cost growth", "Leakage, mistakes, overrun", "Permission-scoped AI; approval before actions; quality tests,\nusage limits and per-user cost monitoring.", "AI lead\n+ Finance"]
    ];
    for (let i = 0; i < risks.length; i++) {
      const y = 2.53 + i * .54;
      const [risk, impact, control, owner] = risks[i];
      rect(s, .50, y, 12.34, .54, i % 2 === 0 ? C.pale : C.white);
      line(s, .50, y + .54, 12.84, y + .54, C.line);
      text(s, risk, xs[0] + .14, y + .08, 2.42, .21, 12.3, C.ink, true);
      text(s, impact, xs[0] + .14, y + .32, 2.42, .17, 10.1, C.muted);
      text(s, "H > M", xs[1] + .08, y + .19, .73, .23, 12.0, C.red, true);
      text(s, control, xs[2] + .13, y + .08, 6.40, .43, 12.0);
      text(s, owner, xs[3] + .14, y + .11, 1.60, .38, 11.6, C.blue, true);
    }
    text(s, "*Qualitative judgement, not an audit: High before controls; Medium target only after evidence is accepted. Residual risk remains.", .51, 5.90, 12.25, .20, 10.5, C.muted);
    rect(s, .50, 6.22, 12.34, .68, C.aqua);
    text(s, "A Johannesburg account is a foundation, not a security or POPIA guarantee.", .68, 6.36, 11.98, .26, 14.0, C.teal, true);
    text(s, "Meridian still owns access, devices, data governance and incident response; external processing and regional recovery need review.", .68, 6.66, 11.98, .18, 10.6, C.ink);
    link(s, "Shared responsibility [4]", 1.98, 7.20, 2.00, refs.responsibility);
    link(s, "Information Regulator: POPIA [5]", 4.19, 7.20, 2.67, refs.popia);
    text(s, "Controls and owners are proposed, not certified", 7.79, 7.20, 4.00, .20, 9.1, C.muted, false, { align: "right" });
    notes(s, `ASSESSMENT METHOD\nThis is a strategic pre-control assessment of in-house expansion, not a penetration test, infrastructure audit or assertion that every listed control is absent. High means a plausible control failure could materially affect field operations, commercially sensitive client data, payroll/attendance evidence, order integrity or service continuity. Medium is a proposed residual target after controls are implemented and tested, not an automatic downgrade. A formal risk workshop should score likelihood and impact using Meridian's risk appetite, evidence and named accountable owners. Legal and security specialists should validate obligations and contracts.\n\n1. KEY-PERSON DEPENDENCY\nA developer or administrator absence, departure or unavailable credentials must not stop releases or recovery. Require at least two authorised people who can deploy and restore, documented setup and incident runbooks, corporate-owned repositories/accounts, peer review and regular handover rehearsals. Do not count one person using AI assistance as a second operational resource. The Director owns product and architectural accountability; that does not mean the Director alone provides engineering, QA and round-the-clock cover. Agree service hours and escalation; a two-person team alone does not establish sustainable 24/7 support.\n\n2. CLIENT / STAFF DATA\nRisks include cross-client report access, excessive administrator permissions, leaked credentials and inappropriate use of location or photographs. Test client/store/resource authorisation at the server and data layer, including exports, jobs, chat-derived tasks and AI retrieval. Require privileged MFA, prompt offboarding, narrowly scoped workload identities, protected secrets, log access review, retention schedules and device-loss procedures. Client staff should only see explicitly authorised data. Local hosting is not automatic POPIA compliance: the Information Regulator describes security safeguards and continuing responsibilities around compromises [5]. Review operator terms, notices, purposes, sensitive-data handling and external processing with Meridian's Information Officer.\n\n3. CONTINUITY AND MIGRATION\nA new account alone is not a tested production environment. Segregate development/test/production, review deployments, run automated access/data-contract/UI tests, monitor job failures and detect silent stale data. Backups need protected versions and a demonstrated restore; replicated production data is not a substitute for recovery from accidental deletion or corruption. Set business-approved recovery time and data-loss objectives, test a regional-outage scenario and ensure the chosen backup/failover placement is permitted by Meridian's residency policy. Multiple zones inside one region do not remove a whole-region risk. This Johannesburg design does not claim a second recovery region has been approved. Until regional recovery is proven, maintain a documented field/manual contingency. Gate cutover on identity, permissions, data totals, schedules, worker completion and rollback tests.\n\n4. FIELD RELIABILITY\nField network quality, battery, device storage and upload size may dominate user experience. Local hosting does not prove the application is fast. Pilot representative devices and weak networks, app restarts and a full offline shift. Test durable capture, replay, conflict resolution and duplicate-safe order submission; a captured draft must not be shown as a fulfilled or accepted order. Validate prices/products at submission. Measure p95 response time against an agreed device/network profile and load-test expected simultaneous use, not the total registered-user count. Confirm mobile security policies and device support before scale.\n\n5. SUPPLIER AND DATA DEPENDENCY\nIn-house code does not remove Geo Rep, Catalyst, retailer access or SharePoint dependency. Require contractually defined fields, export rights, API limits, change notice, incident escalation and source cadence. Monitor and reconcile feeds, retain raw lineage and distinguish order capture from retailer sales. Catalyst API access is pending. Replace retailer connectors only after authorised access, parallel-run totals, replay/recovery and operational ownership are accepted. No verified supplier performance or SLA comparison is available.\n\n6. AI AND COSTS\nTreat retrieved documents, images and chat as untrusted content, never as instructions granting access or initiating orders. Enforce user/client permissions before retrieval, redact unnecessary personal data, prohibit secret disclosure, log authorised tool use and obtain human confirmation for consequential tasks, orders and external messages. Preserve the current Gemini Flash constraint unless Meridian changes it; verify the selected model's service availability and data-processing terms separately. IR needs retailer/SKU validation data, accuracy thresholds and human review. WhatsApp requires verified identity, permitted messaging, retention and escalation. Cost exposure includes analytics scans, chat listeners, photo retention, failed retries, token use and messaging. Budget alerts alone should not be treated as enforced hard spending limits.\n\nSOURCES\n[4] Microsoft shared-responsibility guidance: ${refs.responsibility}\n[5] Information Regulator POPIA guidance: ${refs.popia}\nThese sources inform the control model; risk ratings, proposed owners and acceptance tests are Meridian-specific recommendations rather than external certifications.`);
  }

  {
    const s = page("Approve the capability, not an unconditional rebuild", "Recommended: Meridian-led development plus contracted cloud/security support. Keep suppliers where they deliver proven value.");
    rect(s, .50, 2.12, 12.34, .37, C.navy);
    label(s, "OPERATING OPTION", .65, 2.22, 2.94, C.white, 10.8);
    label(s, "BENEFIT", 3.94, 2.22, 3.13, C.white, 10.8);
    label(s, "DISADVANTAGE", 7.39, 2.22, 3.12, C.white, 10.8);
    label(s, "ASSESSMENT", 11.05, 2.22, 1.63, C.white, 10.8);
    const options = [
      ["Meridian team only", "Maximum delivery control", "Recruitment + on-call burden", "Conditional"],
      ["Meridian + specialist support", "Control with backup expertise", "Internal team + support cost", "Preferred"],
      ["Geo Rep-led delivery", "Potential delivery/support capacity", "Contract, API and exit dependence", "Quote + proof"]
    ];
    for (let i = 0; i < options.length; i++) {
      const y = 2.49 + i * .48;
      rect(s, .50, y, 12.34, .48, i === 1 ? C.aqua : (i === 0 ? C.pale : C.white));
      if (i === 1) rect(s, .50, y, .05, .48, C.teal);
      const [option, benefit, disadvantage, decision] = options[i];
      text(s, option, .65, y + .15, 3.07, .24, 12.2, C.ink, true);
      text(s, benefit, 3.94, y + .15, 3.28, .24, 11.8);
      text(s, disadvantage, 7.39, y + .15, 3.41, .24, 11.8);
      text(s, decision, 11.05, y + .15, 1.62, .24, 11.8, i === 1 ? C.teal : C.blue, true);
      line(s, .50, y + .48, 12.84, y + .48, C.line);
    }
    label(s, "COST: COMPARE THE FULL 36 MONTHS", .50, 4.24, 5.95, C.orange, 12.0);
    text(s, "Setup / migration + 36 x monthly operating cost", .50, 4.61, 5.99, .26, 14.0, C.ink, true);
    text(s, "Include people, support, cloud, supplier/API fees, devices,\nAI, image recognition and WhatsApp usage.", .50, 5.01, 5.99, .50, 13.0);
    text(s, "R10,000/month difference = R360,000 over 3 years.", .50, 5.64, 5.99, .26, 12.6, C.teal, true);
    text(s, "No verified quotes or workload estimate: savings are unproven.\nTrack cost per active field user, accepted order and visit.", .50, 6.08, 5.99, .43, 11.9, C.muted);

    line(s, 6.67, 4.24, 6.67, 6.51, C.line);
    label(s, "90-DAY ASSURANCE PLAN / PROPOSED", 6.96, 4.24, 5.87, C.blue, 12.0);
    const stages = [
      ["01", "Days 0-30", "Confirm platform, team cover and budget;\nprove access controls and backup recovery."],
      ["02", "Days 31-60", "Pilot field sync, supplier feeds and orders;\nreconcile data and test rollback."],
      ["03", "Days 61-90", "Expand after business acceptance; stage\nIR and WhatsApp behind separate gates."]
    ];
    for (let i = 0; i < stages.length; i++) {
      const y = 4.64 + i * .62;
      text(s, stages[i][0], 6.96, y + .04, .42, .24, 13.0, C.orange, true);
      text(s, stages[i][1], 7.49, y, 1.11, .24, 11.6, C.ink, true);
      text(s, stages[i][2], 8.74, y, 4.10, .43, 11.9);
    }
    rect(s, .50, 6.67, 12.34, .36, C.navy);
    text(s, "APPROVE: Meridian-led Nexus, named backup and funded support. Retain suppliers until replacements pass.", .66, 6.77, 12.00, .22, 12.4, C.white, true);
    link(s, "Cost tools: Azure [6]", 1.98, 7.20, 1.65, refs.azureCost);
    link(s, "Google Cloud [7]", 3.83, 7.20, 1.51, refs.googleCost);
    text(s, "Phases are a proposal, not a migration or feature-delivery promise", 5.69, 7.20, 6.10, .20, 9.1, C.muted, false, { align: "right" });
    notes(s, `EXECUTIVE RECOMMENDATION\nKeep Meridian Nexus product ownership, code, data rights, cloud billing, domains and release acceptance under Meridian control. Prefer Meridian-led development with bounded specialist support for cloud operations, security and recovery. This is not a recommendation for a single developer to build and support every feature, nor for replacing useful suppliers immediately. In-house-only delivery is viable only with properly funded capacity and coverage. Geo Rep-led delivery remains an alternative if internal staffing or operational acceptance fails and the supplier can meet contractual, technical and exit requirements. The assessment is qualitative; no supplier quote, independently verified performance benchmark or audited SLA supports a cheapest/fastest claim.\n\nWHAT TO APPROVE\nCEO/MD: operating model, executive sponsor, budget authority and risk appetite. Software and AI Director: roadmap, architecture, release acceptance, supplier boundaries and measurable outcomes. Fund a named engineering deputy plus agreed QA and cloud/security support. IT/security: privileged access, monitoring, incident response and restore ownership. Field Ops and BI: field acceptance, data definitions and reconciliation. Finance: full-cost model and monthly review. Information Officer: privacy, operator arrangements, retention and cross-border processing review. Meridian-owned accounts need corporate recovery contacts and separately controlled emergency access, not personal-account dependence.\n\nCOST METHOD\nThe headline is a constant-monthly illustration, not a vendor quotation or a forecast bill. Full 36-month total cost is once-off setup/migration/testing plus the sum of actual monthly costs for internal staff, contracted support, cloud environments, storage/backups, transfer, software licences, external API/retailer feeds, devices and connectivity, AI tokens, image analysis, messaging, training and exit. Use the monthly shorthand only after selecting a representative operating profile; a final model must allow growth, annual increases, peak workloads and tax/FX. Do not double-count existing salaries as both cash outlay and opportunity cost: show incremental cash spend and fully loaded economic cost separately. Unchanged Geo Rep/Catalyst fees remain in both options unless a verified commercial agreement removes them. Check whether a managed vendor fee already includes cloud hosting and support.\n\nBUDGET INPUTS NEEDED\nObtain internal loaded labour rates and available capacity; support coverage/retainer; cloud service and region selections; daily active and concurrent users; visits/orders per day; photo count, size and retention; analytics history/scans; API quotas and transfer; AI questions/tokens; image-recognition workload and WhatsApp volumes. Model low/base/peak usage. The official calculators [6,7] generate assumption-based estimates, not approved supplier prices. No service-specific ZAR bill is asserted because the platform and workload remain unconfirmed. Arithmetic sensitivity: every R10,000 of recurring monthly difference is R360,000 over 36 months, before escalation, tax and discounting. No guaranteed ROI or cost reduction is claimed.\n\nBENEFIT MEASUREMENT\nBaseline cost per active field user, cost per accepted order, time spent on administration, successful scheduled visits, time from issue to Stock Fix closure, feed freshness and client reporting accuracy. Compare actual before/after outcomes. Lower licensing or quicker bespoke changes are potential benefits only if internal development and support costs do not exceed them. Local hosting may reduce one component of latency but must be measured alongside device and mobile-network performance.\n\n90-DAY ASSURANCE PLAN\nThese are proposed time boxes after staffing and budget approval, not a promise to finish migration, mobile ordering, IR or WhatsApp in 90 days. Days 0-30: confirm the cloud platform and service locations; inventory dependencies; establish corporate account ownership, two-person cover, test/production separation, MFA, logs, costs, backup and restoration evidence. Define recovery and field-performance acceptance criteria with the business. Days 31-60: representative field pilot across users/devices/coverage conditions; validate identity/client isolation, complete-day/monthly report lineage, retail sales reconciliation, API permissions and idempotent order processing; prove rollback. Days 61-90: expand only where acceptance passes. Delay rollout where gaps persist and keep the working service available. Stage mobile/IR/AI/WhatsApp separately, with explicit privacy, accuracy, cost and human-approval gates.\n\nNO-GO / FALLBACK\nDo not cut over if client isolation fails, accepted orders can be lost/duplicated, data does not reconcile, restore/rollback is unproven, source rights are missing or support ownership is unclear. If Meridian cannot fund adequate cover, buy scoped managed support or consider a supplier-led model under an agreed SLA. Geo Rep and Catalyst must not be decommissioned merely because a new cloud account exists. Any provider-operated arrangement must protect Meridian's source/data ownership, administrative visibility, bounded access, export and exit rights.\n\nSOURCES\n[6] Azure pricing calculator: ${refs.azureCost}\n[7] Google Cloud pricing calculator: ${refs.googleCost}\nMeridian-provided Geo Rep partnership pitch: named-resource, hosting and replacement proposals, not commercial commitments. This brief updates the 8 September field-operations deck and makes no application or infrastructure changes.`);
  }

  const overlaps = [];
  for (let a = 0; a < registry.length; a++) for (let b = a + 1; b < registry.length; b++) {
    const l = registry[a], r = registry[b];
    if (l.page !== r.page) continue;
    const x = Math.min(l.x + l.w, r.x + r.w) - Math.max(l.x, r.x);
    const y = Math.min(l.y + l.h, r.y + r.h) - Math.max(l.y, r.y);
    if (x > .02 && y > .02) overlaps.push({ page: l.page, a: l.text, b: r.text });
  }
  assert.equal(overlaps.length, 0, JSON.stringify(overlaps));
  fs.writeFileSync(path.join(out, "layout.json"), JSON.stringify(registry, null, 2));
  fs.writeFileSync(path.join(out, "slide-text.txt"), slideText.join("\n\n"));
  fs.writeFileSync(path.join(out, "speaker-notes.txt"), notesText.join("\n\n\n"));
  await pptx.writeFile({ fileName: path.join(out, name + ".pptx") });
  const zip = await JSZip.loadAsync(fs.readFileSync(path.join(out, name + ".pptx")));
  assert.equal(Object.keys(zip.files).filter(file => /^ppt\/slides\/slide\d+\.xml$/.test(file)).length, 3);
  assert.equal(Object.keys(zip.files).filter(file => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(file)).length, 3);
  assert.equal(10000 * 36, 360000);
  console.log(JSON.stringify({ powerPoint: path.join(out, name + ".pptx"), slides: 3, overlappingTextBoxes: overlaps.length }));
}
build().catch(error => { console.error(error); process.exitCode = 1; });
