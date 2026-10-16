"use strict";
(() => {
  const roles = { raw: "Raw data", dcStock: "DC stock", periodSales: "Period sales", gln: "GLN Master", products: "Product List", stores: "Store name clean-up", staffing: "Store / call-cycle master", dc: "DC mapping", status: "PnP status codes", inventorySample: "Inventory transformed sample", salesSample: "Sales transformed sample", expected: "Transformed sample", template: "Historical template" };
  const tabs = { pipelines: "Pipelines", portals: "Portal sales", run: "New run", setup: "Channel setup", review: "Review", outputs: "Outputs", history: "History" };
  const setupRoles = { raw: "Raw source sample" };
  const readiness = { available: "Available", "files-required": "Format validation", "mapping-required": "Format validation" };
  const activePipeline = "anchor-pnp-v1";
  const blankRules = () => ({ salesDays: 30, openPO: "unknown", bannerColumn: "D", reportDate: "as-of", productFamily: "PICK N PAY CORPORATE", confirmed: true });
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const num = value => Number(value || 0).toLocaleString("en-ZA", { maximumFractionDigits: 2 });
  const time = value => value ? new Date(value).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" }) : "Not available";
  const icon = name => `<i class="ph ph-${name}" aria-hidden="true"></i>`;
  const badge = state => `<span class="etl-state etl-${esc(state)}">${esc({ preparing: "Preparing", running: "Running", review: "Review required", ready: "Ready for approval", approved: "Approved", failed: "Failed" }[state] || state)}</span>`;
  const issue = error => `<p><strong>${esc(error.code)}</strong>: ${esc(error.detail)}</p>${error.references?.length ? `<details><summary>Reference candidates (${num(error.referenceCount || error.references.length)})</summary>${error.references.map(r => `<p>${esc(r.role)} row ${r.line}: ${esc(Object.entries(r).filter(([key]) => !["role", "line"].includes(key)).map(([key, value]) => `${key}: ${value || "(blank)"}`).join("; "))}</p>`).join("")}</details>` : ""}`;
  function mount(root, api) {
    const controller = new AbortController(); let alive = true; let timer; let sequence = 0;
    const downloadUrls = new Set();
    const state = { tab: "pipelines", busy: false, loading: true, error: "", note: "", resources: [], referenceSet: null, runs: [], selected: null, form: { resources: {}, rules: blankRules() }, approve: false, query: "",
      pipelines: [], channels: [], rowChoices: {}, pipelineId: activePipeline, filters: { search: "", customer: "", channel: "", status: "" }, historyPipeline: "", historyStatus: "", setup: null, setupDirty: false, adding: false };
    const call = (action, data = {}) => api.call({ action, ...data });
    const portals = window.MeridianEtlPortals.create(root, api.portals, render, () => { state.tab = "portals"; render(); });
    const selected = () => state.selected;
    const currentPipeline = () => state.pipelines.find(p => p.id === state.pipelineId);
    const rawInputs = () => currentPipeline()?.rawInputs || [{ role: "raw", label: "Raw data", accept: ".xlsx" }];
    const previousMonth = () => { const today = new Date(); return new Date(Date.UTC(today.getFullYear(), today.getMonth() - 1, 1)).toISOString().slice(0, 7); };
    const validRawFile = (spec, name) => spec.accept.split(",").some(extension => String(name || "").toLowerCase().endsWith(extension));
    const inputsReady = () => rawInputs().every(spec => [].concat(state.form.resources[spec.role] || []).length > 0);
    const runPipelineId = run => run.pipelineId || run.version || activePipeline;
    const resource = id => state.resources.find(r => r.id === id);
    const customerKey = name => String(name || "").trim().replace(/\s+/g, " ").toUpperCase();
    const sameCustomer = (left, right) => customerKey(left) === customerKey(right);
    const customerNames = () => [...new Map(state.pipelines.map(p => [customerKey(p.customer), p.customer])).values()].sort((a,b) => a.localeCompare(b));
    function customerOptions(value) {
      const names = customerNames(), selected = names.find(name => sameCustomer(name, value)) || value;
      return `${options(names.map(name => [name, name]), selected, "Select customer")}<option value="__new__" ${value === "__new__" ? "selected" : ""}>+ Add customer...</option>`;
    }
    function beginAdd({ customer = "", channelId = "", kind = "Inventory", newCustomer = false } = {}) {
      if (state.setupDirty && !confirm("Discard the unsaved channel setup changes?")) { render(); return; }
      state.addDraft = { customer: newCustomer ? "__new__" : customer, newCustomer: "", channelId, kind, reportName: `${kind} export` };
      state.adding = true; state.error = ""; render();
    }
    function choosePipeline(id) {
      if (!state.pipelines.some(p => p.id === id)) return;
      if (state.pipelineId !== id) state.form = { resources: {}, rules: blankRules() };
      state.pipelineId = id; state.setup = structuredClone(currentPipeline()); state.setupDirty = false; state.note = ""; state.error = "";
      const p = currentPipeline(); state.rowChoices[p.channelId] = { customer: p.customer, pipelineId: p.id };
    }
    function buttons() { return `<button type="button" data-command="refresh" title="Refresh ETL status" aria-label="Refresh ETL status">${icon("arrows-clockwise")}</button><button type="button" data-command="add-pipeline">${icon("plus")}<span>Add pipeline</span></button><button class="etl-primary" type="button" data-tab="run">${icon("play")}<span>New run</span></button>`; }
    function options(values, selectedValue, allLabel) { return `<option value="">${allLabel}</option>${values.map(([id,label]) => `<option value="${esc(id)}" ${selectedValue === id ? "selected" : ""}>${esc(label)}</option>`).join("")}`; }
    function pipelineContext() {
      const p = currentPipeline();
      const variants = state.pipelines.filter(item => item.channelId === p?.channelId && sameCustomer(item.customer, p?.customer));
      return `<div class="etl-context"><label>Retail channel<select id="etl-context-channel" data-context="channel">${state.channels.map(c => `<option value="${esc(c.id)}" ${c.id === p?.channelId ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label><label>Customer<select id="etl-context-customer" data-context="customer">${customerOptions(p?.customer)}</select></label><label>Data type<select id="etl-context-kind" data-context="pipeline">${variants.map(item => `<option value="${esc(item.id)}" ${item.id === p?.id ? "selected" : ""}>${esc(item.kind || "Inventory")}</option>`).join("")}</select></label><span class="etl-state etl-${esc(p?.status)}">${esc(readiness[p?.status] || "Select a pipeline")}</span></div>`;
    }
    function channelRow(channel, matches) {
      const choice = state.rowChoices[channel.id] || {};
      let customer = state.filters.customer || choice.customer || "";
      if ((state.filters.search || state.filters.status) && !matches.some(p => sameCustomer(p.customer, customer))) customer = matches[0]?.customer || "";
      const variants = matches.filter(p => sameCustomer(p.customer, customer));
      const p = variants.find(p => p.id === choice.pipelineId) || variants[0];
      const last = p && state.runs.find(r => runPipelineId(r) === p.id);
      const count = new Set(state.pipelines.filter(p => p.channelId === channel.id).map(p => customerKey(p.customer))).size;
      return `<tr data-channel-row="${esc(channel.id)}"><td><div class="etl-channel-name">${icon("storefront")}<strong>${esc(channel.name)}</strong></div><small>${num(count)} customer${count === 1 ? "" : "s"}</small></td><td><select id="etl-row-customer-${esc(channel.id)}" data-row-customer="${esc(channel.id)}" aria-label="Customer for ${esc(channel.name)}">${customerOptions(customer)}</select></td><td>${p ? `<select id="etl-row-kind-${esc(channel.id)}" data-row-pipeline="${esc(channel.id)}" aria-label="Data type for ${esc(customer)} / ${esc(channel.name)}">${variants.map(item => `<option value="${esc(item.id)}" ${item.id === p.id ? "selected" : ""}>${esc(item.kind || "Inventory")}</option>`).join("")}</select><small>${esc(p.reportName)}</small>` : '<span class="etl-muted">-</span>'}</td><td>${p ? `<span class="etl-state etl-${esc(p.status)}">${esc(readiness[p.status])}</span>` : '<span class="etl-muted">Select customer</span>'}</td><td>${last ? `${badge(last.status)}<small>${esc(time(last.createdAt))}</small>` : '<span class="etl-muted">-</span>'}</td><td><div class="etl-actions">${p ? `<button type="button" data-pipeline="${esc(p.id)}" data-destination="setup" title="Configure ${esc(p.customer)} / ${esc(p.channel)}" aria-label="Configure ${esc(p.customer)} / ${esc(p.channel)}">${icon("sliders-horizontal")}</button>${p.runnable ? `<button type="button" data-pipeline="${esc(p.id)}" data-destination="run">${icon("play")} New run</button>` : `<button type="button" data-pipeline="${esc(p.id)}" data-destination="setup">Set up ${icon("arrow-right")}</button>`}` : `<button type="button" data-add-channel="${esc(channel.id)}">${icon("plus")} Add customer</button>`}</div></td></tr>`;
    }
    function pipeline() {
      const f = state.filters, matches = state.pipelines.filter(p => (!f.customer || sameCustomer(p.customer,f.customer)) && (!f.channel || p.channelId === f.channel) && (!f.status || p.status === f.status) && `${p.customer} ${p.channel} ${p.reportName} ${p.kind}`.toLowerCase().includes(f.search.toLowerCase()));
      const count = state.pipelines.filter(p => p.runnable).length;
      const groups = state.channels.filter(c => matches.some(p => p.channelId === c.id));
      return `${portals.overview()}<div class="etl-register-stats" aria-label="Pipeline summary">${[["Customers",customerNames().length,"users"],["Retail channels",new Set(state.pipelines.map(p=>p.channelId)).size,"storefront"],["Available pipelines",count,"check-circle"],["Setup required",state.pipelines.length-count,"sliders-horizontal"]].map(([label,value,symbol])=>`<div>${icon(symbol)}<span>${label}<strong>${num(value)}</strong></span></div>`).join("")}</div><section class="etl-section"><div class="etl-section-heading"><div><h2>File-based ETLs</h2><p class="etl-muted">${num(groups.length)} retail channels &middot; ${num(matches.length)} customer setups</p></div><a href="#resources">${icon("files")} Resources</a></div><div class="etl-register-filters"><label class="etl-wide-search">Search<input id="etl-pipeline-search" type="search" data-filter="search" placeholder="Customer, channel or source report" value="${esc(f.search)}"></label><label>Customer<select id="etl-filter-customer" data-filter="customer">${options(customerNames().map(x=>[x,x]),f.customer,"All customers")}</select></label><label>Channel<select id="etl-filter-channel" data-filter="channel">${options(state.channels.map(c=>[c.id,c.name]),f.channel,"All channels")}</select></label><label>Readiness<select id="etl-filter-status" data-filter="status">${options(Object.entries(readiness),f.status,"All statuses")}</select></label><button type="button" data-command="clear-filters" title="Clear pipeline filters" aria-label="Clear pipeline filters">${icon("funnel-x")}</button></div>${groups.length ? `<div class="etl-table-scroll"><table class="etl-pipeline-table"><caption class="etl-sr-only">File-based ETLs by customer and retail channel</caption><thead><tr><th scope="col">Retail channel</th><th scope="col">Customer</th><th scope="col">Data type / source</th><th scope="col">Readiness</th><th scope="col">Last run</th><th scope="col">Actions</th></tr></thead><tbody>${groups.map(channel => channelRow(channel, matches.filter(p => p.channelId === channel.id))).join("")}</tbody></table></div>` : '<p class="etl-empty">No pipelines match these filters.</p>'}</section><section class="etl-section"><div class="etl-section-heading"><h2>Recent runs</h2><button type="button" data-tab="history">All recent activity ${icon("arrow-right")}</button></div>${historyTable(state.runs.slice(0, 5))}</section>`;
    }
    function historyTable(runs) {
      if (!runs.length) return `<p class="etl-empty">No ETL runs yet.</p>`;
      return `<div class="etl-table-scroll"><table><thead><tr><th>Customer / channel</th><th>Source</th><th>Started (SAST)</th><th>Status</th><th>Input rows</th><th>Ready</th><th>Exceptions</th><th></th></tr></thead><tbody>${runs.map(run => `<tr><td><strong>${esc(run.client || "Anchor")}</strong><small>${esc(run.channel || "Pick n Pay")}</small></td><td><strong>${esc(run.sourceName)}</strong><small>${esc(run.id.slice(0, 12))}</small></td><td>${esc(time(run.createdAt))}</td><td>${badge(run.status)}</td><td>${run.totals ? num(run.totals.inputRows) : "-"}</td><td>${run.totals ? num(run.totals.readyRows) : "-"}</td><td>${run.totals ? num(run.totals.exceptionRows + run.totals.invalidDcRows) : "-"}</td><td><button type="button" data-run="${esc(run.id)}" title="Open run details" aria-label="Open ${esc(run.sourceName)}">${icon("arrow-right")}</button></td></tr>`).join("")}</tbody></table></div>`;
    }
    function selectRule(name, label, options) {
      return `<label>${label}<select name="${name}" required><option value="">Choose a rule</option>${options.map(([value, text]) => `<option value="${value}" ${String(state.form.rules[name]) === value ? "selected" : ""}>${text}</option>`).join("")}</select></label>`;
    }
    function referencesReady() {
      return Boolean(state.referenceSet?.revision) && requiredReferences().every(role => state.resources.some(r => r.id === state.referenceSet.resources?.[role]));
    }
    function requiredReferences() {
      return currentPipeline()?.referenceRoles || (currentPipeline()?.kind === "Sales" ? ["products","stores","staffing","salesSample"] : ["products","stores","staffing","dc","status","inventorySample"]);
    }
    function sharedFiles() {
      return `<div class="etl-section-heading"><h2>Shared ETL files</h2><a href="#resources">${icon("files")} Resources</a></div><dl class="etl-reference-summary">${requiredReferences().map(role=>`<div><dt>${roles[role]}</dt><dd>${esc(resource(state.referenceSet?.resources?.[role])?.sourceName || "Not configured")}</dd></div>`).join("")}</dl>`;
    }
    function setupPane() {
      const p = state.setup || currentPipeline();
      if (!p) return '<p class="etl-empty">Select a customer and channel.</p>';
      if (p.runnable) return `<section class="etl-section"><div class="etl-section-heading"><h2>${esc(p.customer)} / ${esc(p.channel)}</h2><span class="etl-state etl-available">${esc(p.kind)} / Available</span></div><dl class="etl-reference-summary"><div><dt>Source report</dt><dd>${esc(p.reportName)}</dd></div><div><dt>Output</dt><dd>${p.kind === "Sales" ? "20-column sales" : "17-column inventory"} workbook</dd></div><div><dt>Shared files</dt><dd>Set v${state.referenceSet?.revision || 0}</dd></div></dl><div class="etl-actions etl-setup-actions"><button type="button" data-tab="run" class="etl-primary">${icon("play")} New run</button></div></section><section class="etl-section">${sharedFiles()}</section>`;
      return `<form id="etlSetupForm"><section class="etl-section"><div class="etl-section-heading"><div><h2>${esc(p.customer)} / ${esc(p.channel)} / ${esc(p.kind || "Inventory")}</h2><p class="etl-muted">${p.revision ? `Saved setup v${p.revision}` : "New channel setup"}${state.setupDirty ? " / Unsaved changes" : ""}</p></div><button type="submit" class="etl-primary">${icon("floppy-disk")} Save setup</button></div><p class="etl-warning">Mapping validation is required before this ETL can run. Existing outputs are unchanged.</p><label class="etl-field">Source report name<input id="etl-report-name" type="text" data-setup-field="reportName" maxlength="120" required value="${esc(p.reportName)}"></label><div class="etl-file-grid etl-setup-files">${Object.entries(setupRoles).map(([role,label])=>`<div class="etl-file-row"><label for="etl-setup-${role}">${role === "raw" ? "Raw source sample" : role === "template" ? "Output template" : label}${['raw','expected'].includes(role)?'<small>Required for mapping validation</small>':'<small>Reusable reference, where applicable</small>'}</label><select id="etl-setup-${role}" data-setup-resource="${role}"><option value="">Not assigned</option>${p.resources?.[role] && !resource(p.resources[role]) ? `<option value="${esc(p.resources[role])}" selected>Unavailable resource - replace selection</option>` : ''}${state.resources.filter(r => role === "raw" || /\.xlsx$/i.test(r.sourceName)).map(r=>`<option value="${esc(r.id)}" ${p.resources?.[role]===r.id?'selected':''}>${esc(r.title)} - ${esc(r.sourceName)}</option>`).join('')}</select><label class="etl-upload" title="Upload ${label}" aria-label="Upload ${label}">${icon("upload-simple")}<span>Upload</span><input type="file" accept="${role === 'raw' ? '.xlsx,.txt,.csv' : '.xlsx'}" data-setup-upload="${role}"></label></div>`).join('')}</div><label class="etl-field etl-setup-notes">Mapping requirements<textarea id="etl-setup-notes" data-setup-field="notes" maxlength="2000" rows="4" placeholder="Store and product keys, date fields, units, exceptions and any channel-specific rules">${esc(p.notes)}</textarea></label><div class="etl-actions"><button type="submit" class="etl-primary">${icon("floppy-disk")} Save setup</button><button type="button" data-command="reset-setup">${icon("arrow-counter-clockwise")} Discard changes</button><a href="#resources">Manage Resources ${icon("arrow-right")}</a></div></section></form>`;
    }
    function setupView() {
      return setupPane() + (currentPipeline()?.runnable ? "" : `<section class="etl-section">${sharedFiles()}</section>`);
    }
    function reconciliation(result) {
      if (result.kind === "Sales") return `<div class="etl-reconcile"><strong>${result.reconciled ? "Row, unit and value reconciliation passed" : "Reconciliation failed"}</strong><span>Units ${num(result.totals.sourceUnits)} = ready ${num(result.totals.validUnits)} + exceptions ${num(result.totals.exceptionUnits)} + excluded ${num(result.totals.excludedUnits)}</span><span>Value ${num(result.totals.sourceValue)} = ready ${num(result.totals.validValue)} + exceptions ${num(result.totals.exceptionValue)} + excluded ${num(result.totals.excludedValue)}</span></div>`;
      return `<div class="etl-reconcile"><strong>${result.reconciled ? "Row and stock reconciliation passed" : "Reconciliation failed"}</strong><span>Source store SOH ${num(result.totals.sourceStoreSOH)} = ready ${num(result.totals.validStoreSOH)} + exceptions ${num(result.totals.exceptionStoreSOH)} + excluded ${num(result.totals.excludedStoreSOH || 0)}</span><span>Unknown source SOH: ${num(result.totals.unknownStoreSOHRows)} rows. DC stock is counted separately.</span></div>`;
    }
    function addPipelineDialog() {
      const draft = state.addDraft || {};
      return `<dialog id="etlAddPipeline" aria-labelledby="etl-add-title"><form id="etlAddPipelineForm"><div class="etl-section-heading"><h2 id="etl-add-title">Add file-based ETL</h2><button type="button" data-command="cancel-add" title="Close" aria-label="Close">${icon("x")}</button></div>${state.error ? `<p class="etl-error" role="alert">${esc(state.error)}</p>` : ''}<label class="etl-field">Customer<select name="customer" id="etl-add-customer" data-add-field="customer" required autofocus>${customerOptions(draft.customer)}</select></label>${draft.customer === "__new__" ? `<label class="etl-field">New customer name<input id="etl-new-customer" data-add-field="newCustomer" type="text" maxlength="100" minlength="2" value="${esc(draft.newCustomer)}" required></label>` : ""}<label class="etl-field">Retail channel<select name="channelId" id="etl-add-channel" data-add-field="channelId" required>${options(state.channels.map(c=>[c.id,c.name]),draft.channelId,"Select channel")}</select></label><label class="etl-field">Data type<select id="etl-add-kind" data-add-field="kind"><option ${draft.kind !== "Sales" ? "selected" : ""}>Inventory</option><option ${draft.kind === "Sales" ? "selected" : ""}>Sales</option></select></label><label class="etl-field">Source report name<input name="reportName" id="etl-add-report" data-add-field="reportName" type="text" maxlength="120" minlength="2" value="${esc(draft.reportName || 'Inventory export')}" required></label><div class="etl-actions etl-setup-actions"><button class="etl-primary" type="submit">${icon("plus")} Add pipeline</button><button type="button" data-command="cancel-add">Cancel</button></div></form></dialog>`;
    }
    function runFiles() {
      return `<div class="etl-file-grid">${rawInputs().map(spec => {
        const selected = [].concat(state.form.resources[spec.role] || []);
        return `<div class="etl-file-row"><label for="etl-${spec.role}">${esc(spec.label)}</label><select id="etl-${spec.role}" data-resource="${spec.role}" ${spec.multiple ? "" : "required"}><option value="">${spec.multiple ? "Add a weekly export" : "Select a raw workbook"}</option>${state.resources.filter(r => validRawFile(spec, r.sourceName) && !Object.values(state.referenceSet?.resources || {}).includes(r.id) && (!spec.multiple || !selected.includes(r.id))).map(r => `<option value="${esc(r.id)}" ${!spec.multiple && selected.includes(r.id) ? "selected" : ""}>${esc(r.title)} - ${esc(r.sourceName)}</option>`).join("")}</select><label class="etl-upload" title="Upload ${esc(spec.label)}" aria-label="Upload ${esc(spec.label)}">${icon("upload-simple")}<span>Upload</span><input type="file" accept="${spec.accept}" data-upload="${spec.role}" ${spec.multiple ? "multiple" : ""}></label></div>${spec.multiple ? `<ul class="etl-selected-files">${selected.map(id => `<li><span>${esc(resource(id)?.sourceName || "Unavailable file")}</span><button type="button" data-remove-file="${esc(id)}" data-file-role="${spec.role}" title="Remove file" aria-label="Remove ${esc(resource(id)?.sourceName)}">${icon("x")}</button></li>`).join("")}</ul>` : ""}`;
      }).join("")}</div>${!referencesReady() ? '<p class="etl-error" role="alert">Shared files are missing or unavailable. Review the shared set in Resources.</p>' : ''}`;
    }
    function newRun() {
      if (!currentPipeline()?.runnable) return setupView();
      const p=currentPipeline();
      return `<form id="etlRunForm"><section class="etl-section"><div class="etl-section-heading"><h2>${esc(p.customer)} / ${esc(p.channel)}</h2><span class="etl-muted">${esc(p.kind)}</span></div>${p.reportingMonth ? `<label class="etl-field etl-report-month">Reporting month<input id="etl-report-month" type="month" data-report-month required min="2000-01" max="2099-12" value="${esc(state.form.reportMonth || previousMonth())}"></label>` : ""}${runFiles()}<p class="etl-muted">Shared set v${state.referenceSet?.revision || 0} &middot; ${p.kind === "Sales" ? "Calendar months / measured sales" : p.transformerVersion === "clicks-inventory-v1" ? "Source stock dates / supplied sales period" : "Source as-of date / DROS estimate"}</p><div class="etl-actions"><button class="etl-primary" type="submit" ${state.busy || !referencesReady() || !inputsReady() ? "disabled" : ""}>${icon("play")} Run ETL</button></div></section>${p.transformerVersion === "pnp-inventory-v2" ? `<section class="etl-section"><details><summary>Processing defaults</summary><div class="etl-rule-grid">${selectRule("salesDays", "Sell Out P4 Weeks", [["30", "DROS x 30 (estimate)"], ["28", "DROS x 28 (estimate)"]])}${selectRule("openPO", "Open PO when not supplied", [["unknown", "Blank / unknown"], ["zero-default", "Zero - explicit default"]])}${selectRule("bannerColumn", "Canonical banner", [["D", "Column D - Cleaned Banner"], ["G", "Column G - Cleaned Banner"]])}${selectRule("reportDate", "Report date", [["as-of", "Source as-of date"], ["exported", "Export date from filename"]])}</div></details></section>` : ''}</form><section class="etl-section"><details><summary>Shared files / v${state.referenceSet?.revision || 0}</summary>${sharedFiles()}</details></section>`;
    }
    function review() {
      const item = selected();
      if (!item) return `<p class="etl-empty">Select a run from History.</p>`;
      const { run, result, progress } = item;
      const pending = ["preparing", "running"].includes(run.status);
      return `<section class="etl-section"><div class="etl-section-heading"><div><h2>${esc(run.sourceName)}</h2><p class="etl-muted">${esc(run.id)} &middot; ${esc(time(run.createdAt))}</p></div>${badge(run.status)}</div>${pending ? `<div class="etl-progress"><div><span>${esc(progress?.stage || "Preparing background worker")}</span><span>${Math.max(0, Math.min(100, progress?.percent || 2))}%</span></div><progress max="100" value="${Math.max(0, Math.min(100, progress?.percent || 2))}" aria-label="ETL progress"></progress></div>` : ""}${run.error ? `<p class="etl-error">${esc(run.error)}</p><button type="button" data-command="retry" ${state.busy ? "disabled" : ""}>${icon("arrow-clockwise")} Retry run</button>` : ""}${result ? `<div class="etl-metrics">${[["Input rows", result.totals.inputRows], ["Ready store rows", result.totals.readyRows], ["Store exceptions", result.totals.exceptionRows], ["DC rows", result.totals.dcRows], ["DC exceptions", result.totals.invalidDcRows], ["Warning rows", result.totals.warningRows || 0], ["Excluded rows", result.totals.excludedRows || 0]].map(([label, value]) => `<div><span>${label}</span><strong>${num(value)}</strong></div>`).join("")}</div>${reconciliation(result)}<div class="etl-actions"><button type="button" data-download="workbook">${icon("download-simple")} ${result.status === "review" ? "Download draft + exceptions" : "Download validated workbook"}</button><button type="button" data-tab="outputs">View outputs ${icon("arrow-right")}</button></div>` : ""}</section>${result ? `<section class="etl-section"><h2>Blocking exceptions</h2>${Object.keys(result.issueCounts).length ? `<div class="etl-issues">${Object.entries(result.issueCounts).map(([code, count]) => `<span>${esc(code.replaceAll("_", " "))}<strong>${num(count)}</strong></span>`).join("")}</div><p class="etl-note">Showing up to 100 affected rows. The workbook contains all exceptions. Correct the reference files in Resources, then create a new run.</p><div class="etl-table-scroll"><table><thead><tr><th>Row</th><th>Site</th><th>Article</th><th>Source store</th><th>Details</th></tr></thead><tbody>${result.exceptionPreview.map(row => `<tr><td>${row.line}</td><td>${esc(row.siteCode)}</td><td>${esc(row.article)}</td><td>${esc(row.rawName)}</td><td>${row.errors.map(issue).join("")}</td></tr>`).join("")}</tbody></table></div>` : `<p class="etl-success">No blocking exceptions.</p>`}</section>` : ""}`;
    }
    function outputs() {
      const item = selected();
      if (!item?.result) return `<p class="etl-empty">Select a completed run from History.</p>`;
      const { run, result } = item;
      return `<section class="etl-section"><div class="etl-section-heading"><h2>${esc(run.client || "Anchor")} / ${esc(run.channel || "Pick n Pay")} output</h2>${badge(run.status)}</div>${result.kind === "Sales" ? `<p class="etl-note">${esc(result.periodStart)} to ${esc(result.periodEnd)} &middot; Calendar-month sales / measured units and value</p>` : `<p class="etl-note">Inventory as of ${esc(result.asOf)} &middot; Week Ending ${esc(result.reportDate)} &middot; ${esc(result.rules.salesBasis || `DROS x ${result.rules.salesDays} estimate`)}</p>`}${result.status === "review" ? `<p class="etl-warning">DRAFT: ${num(result.totals.exceptionRows + result.totals.invalidDcRows)} source rows require review. This is not a complete approved dataset.</p>` : ""}<div class="etl-actions">${[["workbook", "Excel workbook"], ["facts", result.kind === "Sales" ? "Sales JSONL" : "Inventory JSONL"], ["exceptions", "Exceptions JSONL"], ["dc", "DC inventory"], ["assignments", "Staffing"]].map(([file, label]) => `<button type="button" data-download="${file}">${icon("download-simple")} ${label}</button>`).join("")}</div>${run.status === "ready" ? `<div class="etl-approval"><label class="etl-check"><input type="checkbox" data-approve-check ${state.approve ? "checked" : ""}><span>I reviewed the output, warnings, exclusions and estimate conventions.</span></label><button class="etl-primary" type="button" data-command="approve" ${state.approve && !state.busy ? "" : "disabled"}>${icon("check-circle")} Approve output</button></div>` : run.approval ? `<p class="etl-success">Approved by ${esc(run.approval.by.email)} on ${esc(time(run.approval.at))}.</p>` : ""}<p class="etl-note">Output approval is recorded in ETLs. Stock Fix and Insights are not updated by this pipeline.</p></section><section class="etl-section"><h2>${result.kind === "Sales" ? "Sales" : "Inventory"} preview</h2><p class="etl-muted">First ${result.preview.length} of ${num(result.totals.outputRows ?? result.totals.readyRows)} output rows.</p><div class="etl-table-scroll"><table class="etl-preview"><thead><tr>${result.headers.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${result.preview.map(row => `<tr>${row.map(value => `<td>${value === null ? "" : esc(value)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></section><section class="etl-section"><h2>Pinned references</h2><div class="etl-table-scroll"><table><thead><tr><th>Role</th><th>Workbook</th><th>Generation</th><th>SHA-256</th></tr></thead><tbody>${Object.entries(result.inputs).map(([role, file]) => `<tr><td>${esc(roles[role] || role.replace(/^raw/, "Weekly export "))}</td><td>${esc(file.name)}</td><td>${esc(file.sourceGeneration)}</td><td><code>${esc(result.checksums[role])}</code></td></tr>`).join("")}</tbody></table></div></section>`;
    }
    function policyReview() {
      const result = selected()?.result;
      if (!["pnp-nonblocking-mappings-no-liquor-20260924","shared-sales-mappings-v1","feedback-sales-mappings-v1","clicks-inventory-mappings-v1"].includes(result?.mappingPolicy)) return "";
      const counts = Object.entries(result.warningCounts);
      const warnings = result.warningPreview || [], exclusions = result.exclusionPreview || [];
      return `<section class="etl-section"><h2>Accepted mapping warnings</h2><div class="etl-issues">${counts.map(([code, count]) => `<span>${esc(code.replaceAll("_", " "))}<strong>${num(count)}</strong></span>`).join("")}</div><p class="etl-note">${num(result.totals.warningRows || 0)} source rows with non-blocking mapping warnings. Unavailable mapped values remain blank; raw store and article identifiers are retained.</p>${warnings.length ? `<div class="etl-table-scroll"><table><thead><tr><th>Row</th><th>Site</th><th>Article</th><th>Outcome</th><th>Details</th></tr></thead><tbody>${warnings.map(row => `<tr><td>${num(row.line)}</td><td>${esc(row.siteCode)}</td><td>${esc(row.article)}</td><td>${esc(row.outcome)}</td><td>${row.errors.map(issue).join("")}</td></tr>`).join("")}</tbody></table></div>` : ""}<h2>${result.kind === "Sales" || result.adapter === "clicks-inventory-v1" ? "Excluded rows" : "Excluded Pick n Pay Liquor"}</h2><p class="etl-note">${num(result.totals.excludedRows || 0)} source rows; ${result.kind === "Sales" ? `${num(result.totals.excludedUnits)} units / ${num(result.totals.excludedValue)} value excluded from sales output.` : `${num(result.totals.excludedStoreSOH || 0)} stock units excluded from inventory output.`}</p>${exclusions.length ? `<div class="etl-table-scroll"><table><thead><tr><th>Row</th><th>Site</th><th>Source store</th><th>Article</th><th>${result.kind === "Sales" ? "Units" : "Store SOH"}</th><th>Value</th><th>Reason</th></tr></thead><tbody>${exclusions.map(row => `<tr><td>${num(row.line)}</td><td>${esc(row.siteCode)}</td><td>${esc(row.rawName)}</td><td>${esc(row.article)}</td><td>${num(result.kind === "Sales" ? row.units : row.soh)}</td><td>${result.kind === "Sales" ? num(row.value) : ""}</td><td>${esc(row.reason)}</td></tr>`).join("")}</tbody></table></div>` : ""}<p class="etl-note">Full warning audit: Accepted Warnings sheet in the workbook. Preview limited to 100 rows per section.</p></section>`;
    }
    function render() {
      if (!alive) return;
      const focused = root.contains(document.activeElement) ? document.activeElement : null, focusId = focused?.id, caret = focused?.selectionStart;
      root.innerHTML = `<header class="etl-header"><div><p class="etl-eyebrow">DATA OPERATIONS</p><h1>ETLs</h1><p>Sales and inventory</p></div><div class="etl-actions">${buttons()}</div></header><nav class="etl-tabs" aria-label="ETL views">${Object.entries(tabs).map(([key, label]) => `<button type="button" data-tab="${key}" aria-current="${state.tab === key ? "page" : "false"}" class="${state.tab === key ? "active" : ""}">${label}</button>`).join("")}</nav><div class="etl-body" aria-busy="${state.busy || state.loading}">${state.error && !state.adding ? `<p class="etl-error" role="alert">${esc(state.error)}</p>` : ""}${state.note ? `<p class="etl-notice" role="status">${esc(state.note)}</p>` : ""}${state.loading ? `<p class="etl-empty" role="status">Loading ETLs...</p>` : `${['run','setup'].includes(state.tab) ? pipelineContext() : ''}${state.tab === "pipelines" ? pipeline() : state.tab === "portals" ? portals.view() : state.tab === "run" ? newRun() : state.tab === "setup" ? setupView() : state.tab === "review" ? review() + policyReview() : state.tab === "outputs" ? outputs() + policyReview() : `<section class="etl-section"><div class="etl-section-heading"><div><h2>Run history</h2><p class="etl-muted">Latest ${num(state.runs.length)} runs</p></div></div><div class="etl-history-filters"><label>Search<input id="etl-history-search" type="search" placeholder="Source, customer or channel" aria-label="Find a run" value="${esc(state.query)}" data-history-search></label><label>Pipeline<select data-history-pipeline>${options(state.pipelines.map(p=>[p.id,`${p.customer} / ${p.channel} / ${p.kind || "Inventory"}`]),state.historyPipeline,"All pipelines")}</select></label><label>Status<select data-history-status>${options(['preparing','running','review','ready','approved','failed'].map(s=>[s,s === 'review' ? 'Review required' : s.charAt(0).toUpperCase()+s.slice(1)]),state.historyStatus,"All statuses")}</select></label></div>${historyTable(state.runs.filter(r => (!state.historyPipeline || runPipelineId(r) === state.historyPipeline) && (!state.historyStatus || r.status === state.historyStatus) && `${r.sourceName} ${r.client} ${r.channel} ${r.status} ${r.id}`.toLowerCase().includes(state.query.toLowerCase())))}</section>`}`}</div>${state.adding ? addPipelineDialog() : ''}`;
      if (state.adding) root.querySelector('dialog').showModal();
      if (state.busy || state.loading) root.querySelectorAll('button,input,select,textarea').forEach(e => { e.disabled = true; });
      if (focusId) { const field = document.getElementById(focusId); if (field && !field.disabled) { field.focus({preventScroll:true}); if (caret !== null && typeof caret === 'number' && ['text','search'].includes(field.type)) field.setSelectionRange(caret,caret); } }
    }
    function schedulePoll() {
      clearTimeout(timer);
      if (alive && selected() && ["preparing", "running"].includes(selected().run.status)) timer = setTimeout(() => openRun(selected().run.id, false), 6000);
    }
    function recordDetail(detail) {
      state.selected = detail;
      state.runs = [detail.run, ...state.runs.filter(r => r.id !== detail.run.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    async function openRun(id, changeTab = true) {
      const request = ++sequence;
      try {
        const detail = await call("detail", { id });
        if (!alive || request !== sequence) return;
        recordDetail(detail);
        if (changeTab) { state.tab = "review"; state.approve = false; }
        state.error = ""; render(); schedulePoll();
      } catch (error) { if (alive && request === sequence) { state.error = error.message; render(); clearTimeout(timer); timer = setTimeout(() => openRun(id, false), 15000); } }
    }
    async function refresh() {
      state.error = "";
      try {
        const [catalogue, history] = await Promise.all([call("catalogue"), call("history")]);
        if (!alive) return;
        state.resources = catalogue.resources; state.runs = history.runs;
        state.pipelines = catalogue.pipelines || []; state.channels = catalogue.channels || [];
        if (!state.setupDirty) state.setup = structuredClone(currentPipeline() || null);
        state.referenceSet = catalogue.referenceSet || null;
        if (!state.referenceSet) for (const role of Object.keys(roles).filter(r => !["raw", "template"].includes(r))) if (!state.form.resources[role]) state.form.resources[role] = state.resources.find(r => r.tags?.includes(`etl-anchor-${role}`))?.id || "";
        for (const spec of rawInputs()) {
          const existing = [].concat(state.form.resources[spec.role] || []).filter(id => state.resources.some(r => r.id === id));
          state.form.resources[spec.role] = spec.multiple ? existing : existing[0] || "";
        }
        if (selected()) await openRun(selected().run.id, false);
      } catch (error) { state.error = error.message; }
      finally { state.loading = false; render(); }
    }
    async function command(task) {
      if (state.busy) return;
      state.busy = true; state.error = ""; render();
      try { await task(); } catch (error) { state.error = error.message || "The ETL action failed."; }
      finally { state.busy = false; render(); }
    }
    async function downloadOutput(id, file) {
      const parts = []; let offset = 0, generation, first;
      while (alive) {
        const result = await call("download", { id, file, offset, ...(generation ? { generation } : {}) });
        if (!alive) return;
        if (!Number.isSafeInteger(result.size) || result.size < 0 || result.size > 64 * 1024 * 1024 || result.offset !== offset || !result.generation || typeof result.dataBase64 !== "string") throw new Error("The download response was invalid. Retry the download.");
        if (first && (result.size !== first.size || result.generation !== generation)) throw new Error("The output changed. Retry the download.");
        first ||= result; generation = result.generation;
        const bytes = Uint8Array.from(atob(result.dataBase64), character => character.charCodeAt(0));
        if (bytes.length > 1024 * 1024 || offset + bytes.length > result.size || (result.nextOffset === null ? offset + bytes.length !== result.size : result.nextOffset !== offset + bytes.length || result.nextOffset <= offset)) throw new Error("The output download was incomplete. Retry the download.");
        parts.push(bytes); offset += bytes.length;
        if (result.nextOffset === null) break;
        state.note = `Downloading ${Math.round(offset * 100 / result.size)}%`; render();
      }
      if (!alive) return;
      const url = URL.createObjectURL(new Blob(parts, { type: first.contentType })); downloadUrls.add(url);
      const link = document.createElement("a"); link.href = url; link.download = first.name; link.click();
      setTimeout(() => { URL.revokeObjectURL(url); downloadUrls.delete(url); }, 60000);
      state.note = "Download ready.";
    }
    root.addEventListener("click", event => {
      const button = event.target.closest("button"); if (!button || button.disabled) return;
      if (button.dataset.removeFile) { state.form.resources[button.dataset.fileRole] = [].concat(state.form.resources[button.dataset.fileRole] || []).filter(id => id !== button.dataset.removeFile); render(); return; }
      if (button.dataset.tab) { state.tab = button.dataset.tab === 'run' && !currentPipeline()?.runnable ? 'setup' : button.dataset.tab; state.note = ""; render(); return; }
      if (button.dataset.pipeline) {
        if (state.setupDirty && !confirm('Discard the unsaved channel setup changes?')) return;
        choosePipeline(button.dataset.pipeline); state.tab = button.dataset.destination; render(); return;
      }
      if (button.dataset.command === 'clear-filters') { state.filters = {search:'',customer:'',channel:'',status:''}; render(); return; }
      if (button.dataset.command === 'add-pipeline') { beginAdd({customer:state.filters.customer,channelId:state.filters.channel}); return; }
      if (button.dataset.addChannel) { beginAdd({channelId:button.dataset.addChannel,newCustomer:true}); return; }
      if (button.dataset.command === 'cancel-add') { state.adding = false; state.error = ''; render(); return; }
      if (button.dataset.command === 'reset-setup') { choosePipeline(state.pipelineId); render(); return; }
      if (button.dataset.run) { openRun(button.dataset.run); return; }
      if (button.dataset.download) command(() => downloadOutput(selected().run.id, button.dataset.download));
      if (button.dataset.command === "refresh") command(async () => { await Promise.all([refresh(), portals.refresh()]); });
      if (button.dataset.command === "approve") command(async () => {
        const request = ++sequence;
        clearTimeout(timer);
        const detail = await call("approve", { id: selected().run.id, confirm: state.approve });
        if (!alive || request !== sequence) return;
        recordDetail(detail); state.approve = false;
      });
      if (button.dataset.command === "retry") command(async () => { const result = await call("retry", { id: selected().run.id }); await openRun(result.id); });
    }, { signal: controller.signal });
    root.addEventListener("change", event => {
      const element = event.target;
      if (state.busy) return;
      if (element.dataset.filter) { state.filters[element.dataset.filter] = element.value; render(); return; }
      if (element.dataset.rowCustomer) {
        const channelId = element.dataset.rowCustomer, customer = element.value;
        if (customer === '__new__') { beginAdd({channelId,newCustomer:true}); return; }
        const p = state.pipelines.find(p => p.channelId === channelId && sameCustomer(p.customer,customer));
        if (customer && !p) { beginAdd({channelId,customer}); return; }
        state.rowChoices[channelId] = {customer,pipelineId:p?.id};
        if (state.filters.customer) state.filters.customer = customer;
        if (p && state.filters.status && p.status !== state.filters.status) state.filters.status = '';
        if (p && !`${p.customer} ${p.channel} ${p.reportName} ${p.kind}`.toLowerCase().includes(state.filters.search.toLowerCase())) state.filters.search = '';
        render(); return;
      }
      if (element.dataset.rowPipeline) {
        const p = state.pipelines.find(p => p.id === element.value && p.channelId === element.dataset.rowPipeline);
        if (p) state.rowChoices[p.channelId] = {customer:p.customer,pipelineId:p.id};
        render(); return;
      }
      if (element.dataset.context) {
        const current = currentPipeline(), channelId = element.dataset.context === 'channel' ? element.value : current?.channelId;
        const customer = element.dataset.context === 'customer' ? element.value : current?.customer;
        if (!customer) { render(); return; }
        if (customer === '__new__') { beginAdd({channelId,kind:current?.kind,newCustomer:true}); return; }
        const variants = state.pipelines.filter(p=>p.channelId === channelId && sameCustomer(p.customer,customer));
        const next = element.dataset.context === 'pipeline' ? variants.find(p=>p.id === element.value) : variants.find(p=>p.kind === current?.kind) || variants[0];
        if (!next) { beginAdd({channelId,customer,kind:current?.kind}); return; }
        if (state.setupDirty && !confirm('Discard the unsaved channel setup changes?')) { render(); return; }
        choosePipeline(next.id);
        if (state.tab === 'run' && !currentPipeline()?.runnable) state.tab = 'setup';
        render(); return;
      }
      if (element.dataset.setupResource) { state.setup.resources[element.dataset.setupResource] = element.value; state.setupDirty = true; return; }
      if (element.hasAttribute('data-history-pipeline')) { state.historyPipeline = element.value; render(); return; }
      if (element.hasAttribute('data-history-status')) { state.historyStatus = element.value; render(); return; }
      if (element.dataset.addField) { state.addDraft[element.dataset.addField] = element.value; if (element.dataset.addField === 'customer') render(); return; }
      if (element.hasAttribute("data-report-month")) { state.form.reportMonth = element.value; return; }
      if (element.dataset.resource) {
        const spec = rawInputs().find(s => s.role === element.dataset.resource);
        if (spec?.multiple) {
          const list = [].concat(state.form.resources[spec.role] || []);
          if (element.value && !list.includes(element.value)) {
            if (list.length >= spec.maxFiles) state.error = `Choose at most ${spec.maxFiles} weekly exports.`;
            else state.form.resources[spec.role] = [...list, element.value];
          }
        } else state.form.resources[element.dataset.resource] = element.value;
        render(); return;
      }
      if (Object.hasOwn(state.form.rules, element.name)) state.form.rules[element.name] = element.type === "checkbox" ? element.checked : element.name === "salesDays" ? Number(element.value) : element.value;
      if (element.hasAttribute("data-approve-check")) { state.approve = element.checked; render(); }
      if (element.hasAttribute("data-history-search")) { state.query = element.value; render(); }
      if ((element.dataset.upload || element.dataset.setupUpload) && element.files?.[0]) {
        const files = [...element.files]; const role = element.dataset.upload || element.dataset.setupUpload, setupUpload = !!element.dataset.setupUpload;
        command(async () => {
          const spec = setupUpload ? { accept: ".xlsx,.txt,.csv" } : rawInputs().find(s => s.role === role);
          if (!spec || files.some(file => !validRawFile(spec, file.name) || file.size <= 0 || file.size > 25 * 1024 * 1024)) throw new Error("Choose supported source files up to 25 MB each.");
          if (spec.multiple ? [].concat(state.form.resources[role] || []).length + files.length > spec.maxFiles : files.length !== 1) throw new Error("Too many files for this input.");
          for (const file of files) {
          state.note = `Uploading ${file.name}...`; render();
          const resource = await api.upload(role, file, currentPipeline());
          if (!alive) return;
          if (setupUpload) { state.setup.resources[role] = resource.id; state.setupDirty = true; }
          else state.form.resources[role] = spec.multiple ? [...[].concat(state.form.resources[role] || []), resource.id] : resource.id;
          state.resources = [resource, ...state.resources.filter(r => r.id !== resource.id)];
          state.note = `${file.name} saved to Resources.`;
          }
          await refresh();
        });
      }
    }, { signal: controller.signal });
    root.addEventListener('input', event => {
      if (state.busy) return;
      const element = event.target;
      if (element.dataset.filter === 'search') { state.filters.search = element.value; render(); }
      if (element.hasAttribute('data-history-search')) { state.query = element.value; render(); }
      if (element.dataset.setupField) { state.setup[element.dataset.setupField] = element.value; state.setupDirty = true; }
      if (element.dataset.addField) state.addDraft[element.dataset.addField] = element.value;
    }, {signal:controller.signal});
    root.addEventListener('cancel', event => { if (event.target.id === 'etlAddPipeline') { event.preventDefault(); if (!state.busy) { state.adding = false; state.error = ''; render(); } } }, {signal:controller.signal,capture:true});
    root.addEventListener("submit", event => {
      if (event.target.id === 'etlAddPipelineForm' || event.target.id === 'etlSetupForm') {
        event.preventDefault(); const adding = event.target.id === 'etlAddPipelineForm';
        const draft = state.addDraft || {};
        const requested = (draft.customer === '__new__' ? draft.newCustomer : draft.customer) || '';
        const customer = customerNames().find(name => sameCustomer(name,requested)) || requested.trim().replace(/\s+/g,' ');
        const data = adding ? {customer,channelId:draft.channelId,kind:draft.kind,reportName:draft.reportName,revision:0,resources:{},notes:''} : structuredClone(state.setup);
        const existing = adding && state.pipelines.find(p => sameCustomer(p.customer,customer) && p.channelId === data.channelId && (p.kind || 'Inventory') === data.kind);
        if (existing) { state.adding = false; choosePipeline(existing.id); state.tab = 'setup'; state.note = 'This customer setup already exists. Its files and mappings have been kept.'; render(); return; }
        command(async () => {
          const result = await call('savePipeline', data); if (!alive) return;
          state.pipelines = [result.pipeline,...state.pipelines.filter(p=>p.id !== result.pipeline.id)];
          if (adding && state.filters.customer) state.filters.customer = result.pipeline.customer;
          state.adding = false; choosePipeline(result.pipeline.id); state.tab = 'setup'; state.note = result.pipeline.runnable ? 'Setup saved with shared files. Ready for raw data.' : 'Setup saved with shared files. Raw-format validation remains pending.';
        }); return;
      }
      if (event.target.id !== "etlRunForm") return; event.preventDefault();
      command(async () => {
        if (!currentPipeline()?.runnable) throw new Error('This channel has no validated transformer.');
        if (!inputsReady()) throw new Error("Select all required raw inputs.");
        const result = await call("run", { ...(state.referenceSet ? { resources: Object.fromEntries(rawInputs().map(s => [s.role, state.form.resources[s.role]])), rules: state.form.rules, referenceRevision: state.referenceSet.revision } : state.form), ...(currentPipeline()?.reportingMonth ? { reportMonth: state.form.reportMonth || previousMonth() } : {}), pipelineId: state.pipelineId });
        state.note = result.reused ? "The same inputs and rules already have a run. Showing that run." : "Background ETL started.";
        await openRun(result.id);
      });
    }, { signal: controller.signal });
    render(); refresh(); portals.refresh();
    return { updatePortal: portals.update, stop() { alive = false; portals.stop(); sequence++; clearTimeout(timer); controller.abort(); downloadUrls.forEach(url => URL.revokeObjectURL(url)); downloadUrls.clear(); root.textContent = ""; } };
  }
  window.MeridianEtls = { mount };
})();
