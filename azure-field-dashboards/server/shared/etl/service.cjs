'use strict';
// ETLs on Azure: the Firebase-era meridianEtl callable (functions/meridian-etl.js, read 25 October 2026) on the same
// etlRuns / etlReferenceSets / etlApprovals documents and etl-run-inputs / etl-results Storage objects. The worker
// (Container Apps job job-nexus-etl) is unchanged: a run snapshots its inputs, writes a manifest and starts the job;
// progress, results and failures come back as JSON files the run detail reconciles.
// Downloads stream from Storage instead of 1 MB base64 chunks.
const crypto = require('node:crypto');
const {AppError} = require('../errors.cjs');
const {people} = require('../google/people.cjs');
const {CHANNELS, pipelineRegistry} = require('./pipelines.cjs');

const VERSION = 'anchor-pnp-v1';
const MAPPING_POLICY = 'pnp-nonblocking-mappings-no-liquor-20260924';
const OUTPUT_POLICY = 'pnp-raw-site-name-v1';
const ROLES = ['raw', 'products', 'stores', 'staffing', 'dc', 'status'];
const REFERENCE_ROLES = [...ROLES.slice(1), 'template'];
const SHARED_REFERENCE_ROLES = [...ROLES.slice(1), 'inventorySample', 'salesSample'];
const OPTIONAL_REFERENCE_ROLES = ['gln'];
const ID = /^[a-f0-9]{32}(?:-[a-f0-9]{8})?$/;
const DEADLINE_MS = 35 * 60 * 1000;
const OUTPUTS = {facts: 'facts.jsonl', exceptions: 'exceptions.jsonl', dc: 'dc.jsonl', assignments: 'assignments.jsonl'};
const OUTPUT_NAMES = ['inventory.xlsx', 'inventory-draft.xlsx', 'sales.xlsx', 'sales-draft.xlsx', ...Object.values(OUTPUTS)];

function validateRules(v) {
  if (![28, 30].includes(v?.salesDays) || !['unknown', 'zero-default'].includes(v.openPO) || !['D', 'G'].includes(v.bannerColumn) || !['as-of', 'exported'].includes(v.reportDate) || v.productFamily !== 'PICK N PAY CORPORATE' || v.confirmed !== true) {
    throw new AppError('invalid-argument', 'Confirm the sales estimate, missing-PO convention, banner column, report date and product-family alias.');
  }
  return {salesDays: v.salesDays, openPO: v.openPO, bannerColumn: v.bannerColumn, reportDate: v.reportDate, productFamily: v.productFamily, confirmed: true};
}

function etlService({fs, storage, invokeJob, now = () => Date.now()}) {
  const actorOf = people(fs);
  const who = async user => { const a = await actorOf(user); return {uid: a.uid, email: a.email}; };

  async function readJson(path) {
    const object = await storage.download(path);
    if (!object) return null;
    const text = await new Response(object.body).text();
    if (text.length > 2 * 1024 * 1024) throw new AppError('resource-exhausted', 'ETL status exceeds the supported size.');
    return JSON.parse(text);
  }

  async function detail(id) {
    if (!ID.test(id || '')) throw new AppError('invalid-argument', 'Choose a valid ETL run.');
    const doc = await fs.get(`etlRuns/${id}`);
    if (!doc) throw new AppError('not-found', 'ETL run not found.');
    let run = doc.data;
    const [result, progress] = await Promise.all([readJson(`etl-results/${id}/result.json`), readJson(`etl-results/${id}/progress.json`)]);
    const failure = result ? null : await readJson(`etl-results/${id}/failure.json`);
    if (result || failure || now() - Date.parse(run.createdAt) > DEADLINE_MS) {
      // A poll can overlap completion or approval: reconcile against the latest run inside a transaction.
      run = await fs.transaction(async tx => {
        const current = await tx.get(`etlRuns/${id}`);
        if (!current) throw new AppError('not-found', 'ETL run not found.');
        const latest = current.data;
        let patch;
        if (result && ['preparing', 'running', 'failed'].includes(latest.status)) patch = {status: result.status, completedAt: result.completedAt, totals: result.totals, error: null};
        else if (result && ['ready', 'review'].includes(latest.status) && latest.error) patch = {error: null};
        else if (!result && ['preparing', 'running'].includes(latest.status) && (failure || now() - Date.parse(latest.createdAt) > DEADLINE_MS)) patch = {status: 'failed', error: failure?.error || 'The worker did not finish within the run deadline. The prior approved output is unchanged.'};
        if (!patch) return latest;
        patch.updatedAt = new Date(now()).toISOString();
        tx.update(`etlRuns/${id}`, patch);
        return {...latest, ...patch};
      });
    }
    return {run, result, progress};
  }

  async function referenceSet() {
    const doc = await fs.get(`etlReferenceSets/${VERSION}`);
    return doc ? doc.data : {resources: {}, revision: 0};
  }

  async function resourceInput(role, id, {setup = false, delimited = false} = {}) {
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(id)) throw new AppError('invalid-argument', `Select the ${role} workbook from Resources.`);
    const doc = await fs.get(`portalResources/${id}`);
    const r = doc?.data;
    const extension = (setup && role === 'raw') || delimited ? /\.(xlsx|txt|csv)$/i : /\.xlsx$/i;
    if (!r || r.active === false || !r.storagePath?.startsWith(`portal-resources/${id}/`) || !extension.test(r.sourceName || '')) throw new AppError('failed-precondition', `${role}: select an active ${(setup && role === 'raw') || delimited ? 'XLSX, TXT or CSV' : 'XLSX'} resource.`);
    const meta = await storage.metadata(r.storagePath);
    if (!meta) throw new AppError('failed-precondition', `${role}: the workbook is missing from storage. Upload it again in Resources.`);
    if (Number(meta.size) < 1 || Number(meta.size) > 25 * 1024 * 1024) throw new AppError('failed-precondition', `${role}: workbook exceeds the 25 MB limit.`);
    return {resourceId: id, name: r.sourceName, title: r.title || r.sourceName, sourcePath: r.storagePath, sourceGeneration: meta.generation, size: Number(meta.size)};
  }

  const pipelines = pipelineRegistry({fs, resourceInput});

  async function catalogue() {
    const [docs, listed, references] = await Promise.all([fs.query('portalResources', {orderBy: [['updatedAt', 'desc']], limit: 500}), pipelines.list(), referenceSet()]);
    return {version: VERSION, channels: CHANNELS, pipelines: listed, roles: ROLES, referenceRoles: [...SHARED_REFERENCE_ROLES, ...OPTIONAL_REFERENCE_ROLES], referenceSet: references,
      resources: docs.map(d => ({id: d.id, ...d.data})).filter(r => r.active !== false && /\.(xlsx|txt|csv)$/i.test(r.sourceName || '') && Number(r.size) <= 25 * 1024 * 1024)
        .map(r => ({id: r.id, title: r.title, sourceName: r.sourceName, size: r.size, category: r.category, updatedAt: r.updatedAt || null, tags: r.tags || []}))};
  }

  async function history() {
    const docs = await fs.query('etlRuns', {orderBy: [['createdAt', 'desc']], limit: 50});
    const active = docs.filter(d => ['preparing', 'running'].includes(d.data.status)).slice(0, 10);
    const refreshed = new Map();
    for (let i = 0; i < active.length; i += 4) for (const [id, run] of await Promise.all(active.slice(i, i + 4).map(async d => [d.id, (await detail(d.id)).run]))) refreshed.set(id, run);
    return {runs: docs.map(d => refreshed.get(d.id) || d.data)};
  }

  async function savePipeline(user, input) { return {pipeline: await pipelines.save(input, await who(user))}; }

  async function saveReferences(user, input) {
    if (!Number.isSafeInteger(input.revision) || input.revision < 0) throw new AppError('invalid-argument', 'Reload the shared reference files before saving.');
    const actor = await who(user);
    const modern = Boolean(input.resources?.inventorySample || input.resources?.salesSample);
    const values = {};
    for (const role of modern ? SHARED_REFERENCE_ROLES : REFERENCE_ROLES) values[role] = await resourceInput(role, input.resources?.[role]);
    for (const role of OPTIONAL_REFERENCE_ROLES) if (input.resources?.[role]) values[role] = await resourceInput(role, input.resources[role]);
    if (new Set(Object.values(values).map(v => v.resourceId)).size !== Object.keys(values).length) throw new AppError('invalid-argument', 'Each reference role requires its own workbook.');
    await fs.transaction(async tx => {
      const current = await tx.get(`etlReferenceSets/${VERSION}`);
      if ((current ? current.data.revision : 0) !== input.revision) throw new AppError('already-exists', 'Another administrator changed the reference files. Reload before saving.');
      if (!modern && current?.data?.resources?.inventorySample) throw new AppError('failed-precondition', 'Refresh to manage shared transformed samples; a blank template is no longer required.');
      for (const [role, value] of Object.entries(values)) {
        const doc = await tx.get(`portalResources/${value.resourceId}`);
        if (!doc || doc.data.active === false || doc.data.storagePath !== value.sourcePath || doc.data.sourceName !== value.name) throw new AppError('already-exists', `${role}: the Resource changed while saving. Reload before saving.`);
      }
      const preserved = Object.fromEntries(OPTIONAL_REFERENCE_ROLES.filter(role => !Object.hasOwn(input.resources || {}, role) && current?.data?.resources?.[role]).map(role => [role, current.data.resources[role]]));
      tx.set(`etlReferenceSets/${VERSION}`, {resources: {...preserved, ...Object.fromEntries(Object.entries(values).map(([role, v]) => [role, v.resourceId]))}, revision: input.revision + 1, updatedAt: new Date(now()).toISOString(), updatedBy: actor});
    });
    return {referenceSet: await referenceSet()};
  }

  async function run(user, input, action = 'run') {
    const actor = await who(user);
    let pipeline = input.pipelineId === undefined ? null : await pipelines.get(input.pipelineId);
    if (input.pipelineId !== undefined && !pipeline?.runnable) throw new AppError('failed-precondition', 'This channel\'s raw format still needs validation. Shared masters and output samples are already inherited; it cannot run using another channel\'s rules.');
    let selected = input.resources, configInput = input.rules, month = input.reportMonth;
    if (action === 'retry') {
      const original = await detail(input.id);
      if (original.run.context) pipeline = await pipelines.get(original.run.pipelineId);
      if (original.run.context && !pipeline?.runnable) throw new AppError('failed-precondition', 'This run requires its own validated customer/channel transformer.');
      if (original.run.status !== 'failed') throw new AppError('failed-precondition', 'Only failed runs can be retried. Correct reference files in Resources and create a new run for mapping exceptions.');
      selected = original.run.resources; configInput = original.run.rules; month = original.run.context?.reportMonth;
    }
    const context = pipeline ? {id: pipeline.id, customer: pipeline.customer, channelId: pipeline.channelId, channel: pipeline.channel, kind: pipeline.kind, transformerVersion: pipeline.transformerVersion} : null;
    if (context && context.transformerVersion !== 'pnp-inventory-v2') context.adapterRevision = 'feedback-20260925';
    if (context?.transformerVersion === 'clicks-inventory-v1') context.articleStatusDefault = 'Active';
    if (pipeline?.reportingMonth) {
      if (typeof month !== 'string' || !/^(20\d{2})-(0[1-9]|1[0-2])$/.test(month)) throw new AppError('invalid-argument', 'Choose the reporting month covered by the raw export.');
      context.reportMonth = month;
    }
    const sales = context?.kind === 'Sales';
    const clicksStock = context?.transformerVersion === 'clicks-inventory-v1', weekly = Boolean(pipeline?.rawInputs?.[0]?.multiple);
    const config = sales ? {period: 'calendar-month', salesBasis: 'measured', ...(context?.reportMonth ? {reportMonth: context.reportMonth} : {})} : clicksStock ? {salesBasis: 'measured', openPO: 'unknown'} : validateRules(configInput || pipeline?.defaultRules);
    const rawFiles = weekly
      ? action === 'retry' ? Object.keys(selected || {}).filter(r => /^raw(?:[2-9]|1[0-2])?$/.test(r)).sort((a, b) => Number(a.slice(3) || 1) - Number(b.slice(3) || 1)).map(r => selected[r]) : [].concat(selected?.raw || [])
      : [selected?.raw];
    if (weekly && (!rawFiles.length || rawFiles.length > 12 || new Set(rawFiles).size !== rawFiles.length)) throw new AppError('invalid-argument', 'Choose one to twelve different weekly exports.');
    const runInputs = Object.fromEntries(rawFiles.map((id, i) => [i ? `raw${i + 1}` : 'raw', id]));
    if (clicksStock) for (const role of ['dcStock', 'periodSales']) runInputs[role] = selected?.[role];
    let references = null;
    if (action === 'run') {
      references = await referenceSet();
      if (references.revision) {
        const required = pipeline?.referenceRoles || (sales ? ['products', 'stores', 'staffing', 'salesSample'] : references.resources?.inventorySample ? [...ROLES.slice(1), 'inventorySample'] : REFERENCE_ROLES);
        if (required.some(role => !references.resources?.[role])) throw new AppError('failed-precondition', 'Complete the shared ETL files before starting a run.');
        if (input.referenceRevision !== references.revision) throw new AppError('failed-precondition', 'Shared reference files changed. Refresh ETLs before starting a run.');
        for (const role of [...REFERENCE_ROLES, ...SHARED_REFERENCE_ROLES, ...OPTIONAL_REFERENCE_ROLES]) if (selected?.[role] && selected[role] !== references.resources[role]) throw new AppError('invalid-argument', 'Change the shared reference files in Shared files, not in an individual run.');
        selected = {...references.resources, ...runInputs};
        const sample = references.resources[sales ? 'salesSample' : 'inventorySample'];
        if (sample) { selected.expected = sample; delete selected.template; }
      }
    }
    selected = {...selected, ...runInputs};
    if (sales && !selected?.expected) throw new AppError('failed-precondition', 'Select the shared sales transformed sample in Shared files.');
    const masters = pipeline ? pipeline.referenceRoles.filter(r => !['inventorySample', 'salesSample'].includes(r)) : sales ? ['products', 'stores', 'staffing'] : ROLES.slice(1);
    const roles = [...Object.keys(runInputs), ...masters, ...(selected?.expected ? ['expected'] : selected?.template ? ['template'] : [])];
    const inputs = {};
    for (const role of roles) inputs[role] = await resourceInput(role, selected?.[role], {delimited: weekly && /^raw\d*$/.test(role)});
    if (Object.values(inputs).reduce((sum, f) => sum + f.size, 0) > 150 * 1024 * 1024) throw new AppError('resource-exhausted', 'Combined ETL inputs exceed 150 MB. Use smaller exports.');
    const fingerprint = crypto.createHash('sha256').update(JSON.stringify({version: VERSION, mappingPolicy: MAPPING_POLICY, outputPolicy: OUTPUT_POLICY, ...(context ? {context} : {}), config, inputs})).digest('hex');
    const id = fingerprint.slice(0, 32) + (action === 'retry' ? `-${crypto.randomBytes(4).toString('hex')}` : '');
    const created = await fs.transaction(async tx => {
      if (await tx.get(`etlRuns/${id}`)) return false;
      tx.create(`etlRuns/${id}`, {id, fingerprint, version: VERSION, mappingPolicy: MAPPING_POLICY, outputPolicy: OUTPUT_POLICY, ...(context ? {context, kind: context.kind} : {}), pipelineId: context?.id || VERSION,
        client: context?.customer || 'ANCHOR', channel: context?.channel || 'Pick n Pay', status: 'preparing', rules: config, resources: Object.fromEntries(roles.map(role => [role, inputs[role].resourceId])),
        referenceRevision: references?.revision || null, sourceName: inputs.raw.name, createdAt: new Date(now()).toISOString(), createdBy: actor, requestedVia: 'azure-nexus', ...(action === 'retry' ? {retryOf: input.id} : {})});
      return true;
    });
    if (!created) return {id, reused: true};
    try {
      // Snapshot pinned generations so later Resources edits or deletions cannot change a run.
      for (const role of roles) {
        const value = inputs[role], extension = /\.(xlsx|txt|csv)$/i.exec(value.name)[1].toLowerCase(), path = `etl-run-inputs/${id}/${role}.${extension}`;
        const copy = await storage.copy(value.sourcePath, path, {sourceGeneration: value.sourceGeneration, ifGenerationMatch: 0, cacheControl: 'private, no-store', metadata: {etlRun: id, etlRole: role}});
        if (copy.metadata?.firebaseStorageDownloadTokens) throw new Error('Pinned references must not inherit public download tokens.');
        inputs[role] = {...value, path, generation: copy.generation};
      }
      const manifest = {id, version: VERSION, mappingPolicy: MAPPING_POLICY, outputPolicy: OUTPUT_POLICY, ...(context ? {context} : {}), inputs, rules: config, fingerprint, createdBy: actor};
      await storage.upload(`etl-run-inputs/${id}/manifest.json`, Buffer.from(JSON.stringify(manifest)), {type: 'application/json', cacheControl: 'private, no-store', ifGenerationMatch: 0});
      if (!invokeJob) throw new Error('The ETL worker cannot be started from this site.');
      const execution = await invokeJob(id);
      await fs.update(`etlRuns/${id}`, {status: 'running', execution: execution.name || '', startedAt: new Date(now()).toISOString(), updatedAt: new Date(now()).toISOString()});
      return {id, reused: false};
    } catch (error) {
      await fs.update(`etlRuns/${id}`, {status: 'failed', error: String(error.message || 'Unable to launch the ETL worker').slice(0, 1000), updatedAt: new Date(now()).toISOString()});
      console.error(JSON.stringify({event: 'etl-launch-failed', id, error: String(error.message).slice(0, 300)}));
      throw new AppError('unavailable', `ETL ${id} could not start. Open its run details to review or retry.`);
    }
  }

  async function approve(user, input) {
    const {run, result} = await detail(input.id);
    if (input.confirm !== true || !result || result.status !== 'ready' || !result.reconciled || result.totals.exceptionRows || result.totals.invalidDcRows || !result.totals.readyRows) throw new AppError('failed-precondition', 'Only a fully reconciled output without blocking exceptions can be approved.');
    const actor = await who(user);
    await fs.transaction(async tx => {
      const latest = (await tx.get(`etlRuns/${run.id}`)).data;
      if (latest.status === 'approved') return;
      if (latest.status !== 'ready') throw new AppError('failed-precondition', 'This run is not awaiting approval.');
      const approval = {by: actor, at: new Date(now()).toISOString(), outputSha256: result.output.sha256, fingerprint: run.fingerprint};
      tx.update(`etlRuns/${run.id}`, {status: 'approved', approval, updatedAt: approval.at});
      tx.create(`etlApprovals/${run.id}`, approval);
    });
    return detail(run.id);
  }

  async function output(user, id, file) {
    const {run, result} = await detail(id);
    if (!result) throw new AppError('failed-precondition', 'This run has no output yet.');
    const fileName = file === 'workbook' ? result.output?.name : OUTPUTS[file];
    if (!fileName || !OUTPUT_NAMES.includes(fileName)) throw new AppError('invalid-argument', 'Choose a valid output file.');
    const object = await storage.download(`etl-results/${id}/${fileName}`);
    if (!object) throw new AppError('not-found', 'The output file is missing.');
    const label = run.context ? `${run.client}-${run.channel}`.replace(/[^A-Za-z0-9 -]/g, '').slice(0, 140) : 'Anchor-PnP';
    return {...object, name: `${label}-${result.asOf || result.periodEnd || id.slice(0, 8)}-${fileName}`, type: fileName.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/x-ndjson'};
  }

  return {catalogue, history, detail, savePipeline, saveReferences, run: (user, input) => run(user, input, 'run'), retry: (user, input) => run(user, input, 'retry'), approve, output};
}

module.exports = {etlService, validateRules, VERSION};
