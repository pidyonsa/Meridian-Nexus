"use strict";
const crypto = require("node:crypto");
const { GoogleAuth } = require("google-auth-library");
const { resourceStorageError } = require("./resource-storage-error");
const { CHANNELS, createPipelineRegistry } = require("./etl-pipelines");
const VERSION = "anchor-pnp-v1";
const MAPPING_POLICY = "pnp-nonblocking-mappings-no-liquor-20260924";
const OUTPUT_POLICY = "pnp-raw-site-name-v1";
const JOB = "projects/meridain-nexus/locations/us-central1/jobs/nexus-inventory-etl";
const ROLES = ["raw", "products", "stores", "staffing", "dc", "status"];
const REFERENCE_ROLES = [...ROLES.slice(1), "template"];
const SHARED_REFERENCE_ROLES = [...ROLES.slice(1), "inventorySample", "salesSample"];
const OPTIONAL_REFERENCE_ROLES = ["gln"];
const ID = /^[a-f0-9]{32}(?:-[a-f0-9]{8})?$/;
function validateRules(value, fail = message => { throw new Error(message); }) {
  if (![28, 30].includes(value?.salesDays) || !["unknown", "zero-default"].includes(value.openPO) || !["D", "G"].includes(value.bannerColumn) || !["as-of", "exported"].includes(value.reportDate) || value.productFamily !== "PICK N PAY CORPORATE" || value.confirmed !== true) fail("Confirm the sales estimate, missing-PO convention, banner column, report date and product-family alias.");
  return { salesDays: value.salesDays, openPO: value.openPO, bannerColumn: value.bannerColumn, reportDate: value.reportDate, productFamily: value.productFamily, confirmed: true };
}
function createApi({ db, getAuth, bucket, HttpsError, invokeJob }) {
  const fail = (code, message) => { throw new HttpsError(code, message); };
  async function authorise(request) {
    if (!request.auth) fail("unauthenticated", "Sign in to Nexus.");
    const user = await getAuth().getUser(request.auth.uid).catch(() => null);
    const profile = await db.collection("adminUsers").doc(request.auth.uid).get();
    const data = profile.exists ? profile.data() : null;
    const claims = user?.customClaims || {};
    const revoked = user?.tokensValidAfterTime && Number(request.auth.token?.auth_time || 0) * 1000 < new Date(user.tokensValidAfterTime).getTime();
    if (!user || user.disabled || revoked || request.auth.token?.admin !== true || claims.admin !== true || !require("./admin-access").isAdminProfile(data) || claims.chatClient || claims.nexusRole === "client") fail("permission-denied", "Only an active Nexus administrator can manage ETLs and shared master data.");
    return { uid: user.uid, email: user.email };
  }
  async function json(path) {
    try {
      // Read one byte beyond the limit to reject oversized files without a
      // separate metadata round trip on every status poll.
      const [bytes] = await bucket.file(path).download({ start: 0, end: 2 * 1024 * 1024, validation: false });
      if (bytes.length > 2 * 1024 * 1024) throw new Error("ETL status exceeds the supported size.");
      return JSON.parse(bytes);
    } catch (error) { if (Number(error.code) === 404) return null; throw resourceStorageError(error,HttpsError,"ETL progress and output files"); }
  }
  async function detail(id) {
    if (!ID.test(id || "")) fail("invalid-argument", "Choose a valid ETL run.");
    const ref = db.collection("etlRuns").doc(id); const document = await ref.get();
    if (!document.exists) fail("not-found", "ETL run not found.");
    let run = document.data();
    const [result, progress] = await Promise.all([json(`etl-results/${id}/result.json`), json(`etl-results/${id}/progress.json`)]);
    const failure = result ? null : await json(`etl-results/${id}/failure.json`);
    if (result || failure || Date.now() - Date.parse(run.createdAt) > 35 * 60 * 1000) {
      // A poll can overlap completion or approval. Reconcile against the latest
      // run inside a transaction, never overwrite it from the earlier read.
      run = await db.runTransaction(async transaction => {
        const current = await transaction.get(ref);
        if (!current.exists) fail("not-found", "ETL run not found.");
        const latest = current.data();
        let patch;
        if (result && ["preparing", "running", "failed"].includes(latest.status)) {
          patch = { status: result.status, completedAt: result.completedAt, totals: result.totals, error: null };
        } else if (result && ["ready", "review"].includes(latest.status) && latest.error) {
          patch = { error: null };
        } else if (!result && ["preparing", "running"].includes(latest.status) && (failure || Date.now() - Date.parse(latest.createdAt) > 35 * 60 * 1000)) {
          patch = { status: "failed", error: failure?.error || "The worker did not finish within the run deadline. The prior approved output is unchanged." };
        }
        if (!patch) return latest;
        patch.updatedAt = new Date().toISOString();
        transaction.update(ref, patch);
        return { ...latest, ...patch };
      });
    }
    return { run, result, progress };
  }
  async function referenceSet() {
    const doc = await db.collection("etlReferenceSets").doc(VERSION).get();
    return doc.exists ? doc.data() : { resources: {}, revision: 0 };
  }
  async function resourceInput(role, id, { setup = false, delimited = false } = {}) {
    if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,160}$/.test(id)) fail("invalid-argument", `Select the ${role} workbook from Resources.`);
    const document = await db.collection("portalResources").doc(id).get();
    const resource = document.exists ? document.data() : null;
    const extension = (setup && role === "raw") || delimited ? /\.(xlsx|txt|csv)$/i : /\.xlsx$/i;
    if (!resource || resource.active === false || !resource.storagePath?.startsWith(`portal-resources/${id}/`) || !extension.test(resource.sourceName || "")) fail("failed-precondition", `${role}: select an active ${setup && role === "raw" ? "XLSX, TXT or CSV" : "XLSX"} resource.`);
    const [metadata] = await bucket.file(resource.storagePath).getMetadata().catch(error=>{throw resourceStorageError(error,HttpsError,`${role} workbook`);});
    if (Number(metadata.size) < 1 || Number(metadata.size) > 25 * 1024 * 1024) fail("failed-precondition", `${role}: workbook exceeds the 25 MB limit.`);
    return { resourceId: id, name: resource.sourceName, title: resource.title || resource.sourceName, sourcePath: resource.storagePath, sourceGeneration: metadata.generation, size: Number(metadata.size) };
  }
  const pipelines = createPipelineRegistry({ db, fail, resourceInput, authorise });
  return async request => {
    const actor = await authorise(request); const input = request.data || {};
    if (input.action === "catalogue") {
      const [docs, listedPipelines, references] = await Promise.all([
        db.collection("portalResources").orderBy("updatedAt", "desc").limit(500).get(), pipelines.list(), referenceSet()
      ]);
      return { version: VERSION, channels: CHANNELS, pipelines: listedPipelines, roles: ROLES, referenceRoles: [...SHARED_REFERENCE_ROLES, ...OPTIONAL_REFERENCE_ROLES], referenceSet: references, resources: docs.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(r => r.active !== false && /\.(xlsx|txt|csv)$/i.test(r.sourceName || "") && Number(r.size) <= 25 * 1024 * 1024).map(r => ({ id: r.id, title: r.title, sourceName: r.sourceName, size: r.size, category: r.category, updatedAt: r.updatedAt?.toDate?.().toISOString() || r.updatedAt || null, tags: r.tags || [] })) };
    }
    if (input.action === "savePipeline") return { pipeline: await pipelines.save(input, request, actor) };
    if (input.action === "saveReferences") {
      if (!Number.isSafeInteger(input.revision) || input.revision < 0) fail("invalid-argument", "Reload the shared reference files before saving.");
      const modern = Boolean(input.resources?.inventorySample || input.resources?.salesSample);
      const required = modern ? SHARED_REFERENCE_ROLES : REFERENCE_ROLES;
      const values = {};
      for (const role of required) values[role] = await resourceInput(role, input.resources?.[role]);
      for (const role of OPTIONAL_REFERENCE_ROLES) if (input.resources?.[role]) values[role] = await resourceInput(role, input.resources[role]);
      if (new Set(Object.values(values).map(v => v.resourceId)).size !== Object.keys(values).length) fail("invalid-argument", "Each reference role requires its own workbook.");
      await authorise(request);
      await db.runTransaction(async transaction => {
        const ref = db.collection("etlReferenceSets").doc(VERSION), current = await transaction.get(ref);
        if ((current.exists ? current.data().revision : 0) !== input.revision) fail("aborted", "Another administrator changed the reference files. Reload before saving.");
        if (!modern && current.data()?.resources?.inventorySample) fail("failed-precondition", "Refresh Resources to manage shared transformed samples; a blank template is no longer required.");
        for (const [role, value] of Object.entries(values)) {
          const doc = await transaction.get(db.collection("portalResources").doc(value.resourceId));
          if (!doc.exists || doc.data().active === false || doc.data().storagePath !== value.sourcePath || doc.data().sourceName !== value.name) fail("aborted", `${role}: the Resource changed while saving. Reload before saving.`);
        }
        const preserved = Object.fromEntries(OPTIONAL_REFERENCE_ROLES.filter(role => !Object.hasOwn(input.resources, role) && current.data()?.resources?.[role]).map(role => [role, current.data().resources[role]]));
        transaction.set(ref, { resources: { ...preserved, ...Object.fromEntries(Object.entries(values).map(([role, value]) => [role, value.resourceId])) }, revision: input.revision + 1, updatedAt: new Date().toISOString(), updatedBy: actor });
      });
      return { referenceSet: await referenceSet() };
    }
    if (input.action === "history") {
      const docs = await db.collection("etlRuns").orderBy("createdAt", "desc").limit(50).get();
      const active = docs.docs.filter(document => ["preparing", "running"].includes(document.data().status)).slice(0, 10);
      const refreshed = new Map();
      for (let i = 0; i < active.length; i += 4) {
        const batch = await Promise.all(active.slice(i, i + 4).map(async document => [document.id, (await detail(document.id)).run]));
        for (const [id, run] of batch) refreshed.set(id, run);
      }
      return { runs: docs.docs.map(document => refreshed.get(document.id) || document.data()) };
    }
    if (input.action === "detail") return detail(input.id);
    if (input.action === "run" || input.action === "retry") {
      let pipeline = input.pipelineId === undefined ? null : await pipelines.get(input.pipelineId);
      if (input.pipelineId !== undefined && !pipeline?.runnable) fail("failed-precondition", "This channel's raw format still needs validation. Shared masters and output samples are already inherited; it cannot run using another channel's rules.");
      let selected = input.resources; let configInput = input.rules; let month = input.reportMonth;
      if (input.action === "retry") {
        const original = await detail(input.id);
        if (original.run.context) pipeline = await pipelines.get(original.run.pipelineId);
        if (original.run.context && !pipeline?.runnable) fail("failed-precondition", "This run requires its own validated customer/channel transformer.");
        if (original.run.status !== "failed") fail("failed-precondition", "Only failed runs can be retried. Correct reference files in Resources and create a new run for mapping exceptions.");
        selected = original.run.resources; configInput = original.run.rules; month = original.run.context?.reportMonth;
      }
      const context = pipeline ? { id: pipeline.id, customer: pipeline.customer, channelId: pipeline.channelId, channel: pipeline.channel, kind: pipeline.kind, transformerVersion: pipeline.transformerVersion } : null;
      if (context && context.transformerVersion !== "pnp-inventory-v2") context.adapterRevision = "feedback-20260925";
      if (context?.transformerVersion === "clicks-inventory-v1") context.articleStatusDefault = "Active";
      if (pipeline?.reportingMonth) {
        if (typeof month !== "string" || !/^(20\d{2})-(0[1-9]|1[0-2])$/.test(month)) fail("invalid-argument", "Choose the reporting month covered by the raw export.");
        context.reportMonth = month;
      }
      const sales = context?.kind === "Sales";
      const clicksStock = context?.transformerVersion === "clicks-inventory-v1", weekly = Boolean(pipeline?.rawInputs?.[0]?.multiple);
      const config = sales ? { period: "calendar-month", salesBasis: "measured", ...(context?.reportMonth ? { reportMonth: context.reportMonth } : {}) } : clicksStock ? { salesBasis: "measured", openPO: "unknown" } : validateRules(configInput || pipeline?.defaultRules, message => fail("invalid-argument", message));
      let rawFiles = weekly ? input.action === "retry" ? Object.keys(selected || {}).filter(r => /^raw(?:[2-9]|1[0-2])?$/.test(r)).sort((a,b) => Number(a.slice(3) || 1) - Number(b.slice(3) || 1)).map(r => selected[r]) : [].concat(selected?.raw || []) : [selected?.raw];
      if (weekly && (!rawFiles.length || rawFiles.length > 12 || new Set(rawFiles).size !== rawFiles.length)) fail("invalid-argument", "Choose one to twelve different weekly exports.");
      const runInputs = Object.fromEntries(rawFiles.map((id, i) => [i ? `raw${i + 1}` : "raw", id]));
      if (clicksStock) for (const role of ["dcStock", "periodSales"]) runInputs[role] = selected?.[role];
      let references = null;
      if (input.action === "run") {
        references = await referenceSet();
        if (references.revision) {
          const required = pipeline?.referenceRoles || (sales ? ["products", "stores", "staffing", "salesSample"] : references.resources?.inventorySample ? [...ROLES.slice(1), "inventorySample"] : REFERENCE_ROLES);
          if (required.some(role => !references.resources?.[role])) fail("failed-precondition", "Complete the shared ETL files in Resources before starting a run.");
          if (input.referenceRevision !== references.revision) fail("failed-precondition", "Shared reference files changed. Refresh ETLs before starting a run.");
          for (const role of [...REFERENCE_ROLES, ...SHARED_REFERENCE_ROLES, ...OPTIONAL_REFERENCE_ROLES]) if (selected?.[role] && selected[role] !== references.resources[role]) fail("invalid-argument", "Change the shared reference files in Resources, not in an individual run.");
          selected = { ...references.resources, ...runInputs };
          const sample = references.resources[sales ? "salesSample" : "inventorySample"];
          if (sample) { selected.expected = sample; delete selected.template; }
        }
      }
      selected = { ...selected, ...runInputs };
      if (sales && !selected?.expected) fail("failed-precondition", "Select the shared sales transformed sample in Resources.");
      const masters = pipeline ? pipeline.referenceRoles.filter(r => !["inventorySample", "salesSample"].includes(r)) : sales ? ["products", "stores", "staffing"] : ROLES.slice(1);
      const roles = [...Object.keys(runInputs), ...masters, ...(selected?.expected ? ["expected"] : selected?.template ? ["template"] : [])];
      const inputs = {};
      for (const role of roles) inputs[role] = await resourceInput(role, selected?.[role], { delimited: weekly && /^raw\d*$/.test(role) });
      if (Object.values(inputs).reduce((sum, file) => sum + file.size, 0) > 150 * 1024 * 1024) fail("resource-exhausted", "Combined ETL inputs exceed 150 MB. Use smaller exports.");
      const fingerprint = crypto.createHash("sha256").update(JSON.stringify({ version: VERSION, mappingPolicy: MAPPING_POLICY, outputPolicy: OUTPUT_POLICY, ...(context ? { context } : {}), config, inputs })).digest("hex");
      const id = fingerprint.slice(0, 32) + (input.action === "retry" ? `-${crypto.randomBytes(4).toString("hex")}` : "");
      const ref = db.collection("etlRuns").doc(id);
      const created = await db.runTransaction(async transaction => {
        if ((await transaction.get(ref)).exists) return false;
        transaction.create(ref, { id, fingerprint, version: VERSION, mappingPolicy: MAPPING_POLICY, outputPolicy: OUTPUT_POLICY, ...(context ? { context, kind: context.kind } : {}), pipelineId: context?.id || VERSION, client: context?.customer || "ANCHOR", channel: context?.channel || "Pick n Pay", status: "preparing", rules: config, resources: Object.fromEntries(roles.map(role => [role, inputs[role].resourceId])), referenceRevision: references?.revision || null, sourceName: inputs.raw.name, createdAt: new Date().toISOString(), createdBy: actor, ...(input.action === "retry" ? { retryOf: input.id } : {}) });
        return true;
      });
      if (!created) return { id, reused: true };
      try {
        // Snapshot generations so later Resources edits/deletions cannot change a run.
        for (const role of roles) {
          const value = inputs[role]; const extension = /\.(xlsx|txt|csv)$/i.exec(value.name)[1].toLowerCase(); const path = `etl-run-inputs/${id}/${role}.${extension}`;
          const [copy] = await bucket.file(value.sourcePath, { generation: value.sourceGeneration }).copy(bucket.file(path), { preconditionOpts: { ifGenerationMatch: 0 }, cacheControl: "private, no-store", metadata: { etlRun: id, etlRole: role } });
          const [metadata] = await copy.getMetadata();
          if (metadata.metadata?.firebaseStorageDownloadTokens) throw new Error("Pinned references must not inherit public download tokens.");
          inputs[role] = { ...value, path, generation: metadata.generation };
        }
        const manifest = { id, version: VERSION, mappingPolicy: MAPPING_POLICY, outputPolicy: OUTPUT_POLICY, ...(context ? { context } : {}), inputs, rules: config, fingerprint, createdBy: actor };
        await bucket.file(`etl-run-inputs/${id}/manifest.json`).save(JSON.stringify(manifest), { resumable: false, contentType: "application/json", preconditionOpts: { ifGenerationMatch: 0 }, metadata: { cacheControl: "private, no-store" } });
        const execution = invokeJob ? await invokeJob(id) : await (await new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] }).getClient()).request({ url: `https://run.googleapis.com/v2/${JOB}:run`, method: "POST", data: { overrides: { containerOverrides: [{ env: [{ name: "ETL_RUN_ID", value: id }] }] } } });
        await ref.update({ status: "running", execution: execution.data?.name || execution.name || "", startedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        return { id, reused: false };
      } catch (error) {
        await ref.update({ status: "failed", error: String(error.message || "Unable to launch the ETL worker").slice(0, 1000), updatedAt: new Date().toISOString() });
        console.error("ETL launch failed", { id, code: error.code || "unknown" });
        if([401,403,7,16].includes(Number(error.code)))throw resourceStorageError(error,HttpsError,"ETL input snapshots or the background worker");
        fail("internal", `ETL ${id} could not start. Open its run details to review or retry.`);
      }
    }
    if (input.action === "approve") {
      const { run, result } = await detail(input.id);
      if (input.confirm !== true || !result || result.status !== "ready" || !result.reconciled || result.totals.exceptionRows || result.totals.invalidDcRows || !result.totals.readyRows) fail("failed-precondition", "Only a fully reconciled output without blocking exceptions can be approved.");
      await db.runTransaction(async transaction => {
        const ref = db.collection("etlRuns").doc(run.id); const latest = (await transaction.get(ref)).data();
        if (latest.status === "approved") return;
        if (latest.status !== "ready") fail("failed-precondition", "This run is not awaiting approval.");
        const approval = { by: actor, at: new Date().toISOString(), outputSha256: result.output.sha256, fingerprint: run.fingerprint };
        transaction.update(ref, { status: "approved", approval, updatedAt: approval.at });
        transaction.create(db.collection("etlApprovals").doc(run.id), approval);
      });
      return detail(run.id);
    }
    if (input.action === "download") {
      const { run, result } = await detail(input.id);
      if (!result) fail("failed-precondition", "This run has no output yet.");
      const fileName = input.file === "workbook" ? result.output.name : ({ facts: "facts.jsonl", exceptions: "exceptions.jsonl", dc: "dc.jsonl", assignments: "assignments.jsonl" })[input.file];
      if (!fileName || !["inventory.xlsx", "inventory-draft.xlsx", "sales.xlsx", "sales-draft.xlsx", "facts.jsonl", "exceptions.jsonl", "dc.jsonl", "assignments.jsonl"].includes(fileName)) fail("invalid-argument", "Choose a valid output file.");
      const objectPath = `etl-results/${input.id}/${fileName}`;
      const [metadata] = await bucket.file(objectPath).getMetadata().catch(error=>{throw resourceStorageError(error,HttpsError,"the ETL output file");});
      const size = Number(metadata.size), offset = input.offset ?? 0, generation = String(metadata.generation || "");
      if (!Number.isSafeInteger(size) || size < 0 || size > 64 * 1024 * 1024) fail("resource-exhausted", "This output exceeds the supported 64 MB download limit.");
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > size) fail("invalid-argument", "Choose a valid download offset.");
      if (!generation || (offset > 0 && input.generation !== generation) || (input.generation && input.generation !== generation)) fail("failed-precondition", "The output changed. Start the download again.");
      const end = Math.min(size, offset + 1024 * 1024);
      // Bounded authenticated reads avoid signing grants and reusable download links.
      const [bytes] = end > offset ? await bucket.file(objectPath, { generation }).download({ start: offset, end: end - 1, validation: false }).catch(error=>{throw resourceStorageError(error,HttpsError,"the ETL output file");}) : [Buffer.alloc(0)];
      if (bytes.length !== end - offset) fail("data-loss", "The output download was incomplete. Retry the download.");
      await authorise(request);
      const label = run.context ? `${run.client}-${run.channel}`.replace(/[^A-Za-z0-9 -]/g, "").slice(0, 140) : "Anchor-PnP";
      return { dataBase64: bytes.toString("base64"), offset, size, generation, nextOffset: end < size ? end : null, name: `${label}-${result.asOf}-${fileName}`, contentType: fileName.endsWith(".xlsx") ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/x-ndjson" };
    }
    fail("invalid-argument", "Unsupported ETL action.");
  };
}
module.exports = { createApi, validateRules, VERSION, ROLES, REFERENCE_ROLES };
