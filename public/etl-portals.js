"use strict";
(() => {
  const clients = [
    { id: "dataorbis-game-sales", name: "Wilmar", channel: "Game / Makro / Jumbo", portal: "DataOrbis", output: "MonthYY- ALL Clients by SKU.xlsx", group: "dataorbis-workbook" },
    { id: "dataorbis-makro-sales", name: "Espen", channel: "Game / Makro / Jumbo", portal: "DataOrbis", output: "MonthYY- ALL Clients by SKU.xlsx", group: "dataorbis-workbook" },
    { id: "picknpay", name: "Pick n Pay", channel: "Pick n Pay", portal: "Pick n Pay supplier portal", output: "Portal sales export", group: "picknpay" }
  ];
  const isProfile = id => clients.some(client => client.id === id);
  const terminal = new Set(["completed", "failed", "cancelled", "skipped_duplicate", "no-data"]);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const icon = name => `<i class="ph ph-${name}" aria-hidden="true"></i>`;
  const date = value => value ? new Date(value).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg", dateStyle: "medium", timeStyle: "short" }) : "";
  function create(root, api, changed, open) {
    const controller = new AbortController(); let alive = true, request = 0;
    const today = new Date(Date.now() + 7200000);
    const state = { workspace: null, error: "", note: "", loading: true, busy: false, selected: clients[0].id,
      month: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1)).toISOString().slice(0, 7) };
    const profile = id => state.workspace?.profiles?.find(p => p.id === id);
    const runs = id => (state.workspace?.runs || []).filter(r => r.retailerId === id);
    const active = id => runs(id).find(r => !terminal.has(r.status));
    const conflictingRun = id => {
      const selected = clients.find(c => c.id === id);
      return selected && clients.some(c => c.group === selected.group && active(c.id));
    };
    const canRun = id => isProfile(id) && !state.loading && !state.error && profile(id)?.ready === true && !profile(id)?.setupRequired && !conflictingRun(id);
    function update(workspace) { if (!alive) return; state.workspace = workspace; state.loading = false; state.error = ""; changed(); }
    async function refresh() {
      const seq = ++request;
      try { const workspace = await api.load(); if (alive && seq === request) update(workspace); }
      catch (error) { if (alive && seq === request) { state.error = error.message || "Portal jobs could not be loaded."; state.loading = false; changed(); } }
    }
    function status(id) {
      const running = active(id);
      if (state.loading) return "Loading";
      if (!state.workspace) return "Unavailable";
      if (running) return running.status.replaceAll("_", " ");
      return profile(id)?.ready === true && !profile(id)?.setupRequired ? "Manual run available" : "Setup required";
    }
    function overview() {
      return `<section class="etl-section"><div class="etl-section-heading"><div><h2>Portal sales</h2><p class="etl-muted">Pick n Pay &middot; Game / Makro / Jumbo</p></div><button type="button" data-portal-open="${esc(state.selected)}">Jobs and reports ${icon("arrow-right")}</button></div>${state.error ? `<p class="etl-error" role="alert">${esc(state.error)}</p>` : ""}<div class="etl-portal-clients">${clients.map(c => `<article class="etl-portal-client"><div class="etl-section-heading"><h3>${icon("lock-key")} ${c.name}</h3><span class="etl-state ${profile(c.id)?.ready ? "etl-available" : "etl-files-required"}">${esc(status(c.id))}</span></div><p>Monthly sales &middot; ${esc(c.channel)}</p><div class="etl-actions"><button type="button" data-portal-open="${c.id}" ${state.loading ? "disabled" : ""}>${icon("play")} ${profile(c.id)?.ready ? "Run / reports" : "Review setup"}</button><button type="button" data-portal-credentials="${c.id}" title="Manage ${c.name} login in Extraction profiles">${icon("key")} Login settings</button></div></article>`).join("")}</div></section>`;
    }
    function view() {
      const id = state.selected, client = clients.find(c => c.id === id), p = profile(id), current = active(id);
      const clientRuns = runs(id), ids = new Set(clientRuns.map(r => r.id));
      const reports = (state.workspace?.reports || []).filter(r => r.retailerId === id || ids.has(r.extractionRunId));
      const prompts = (state.workspace?.prompts || []).filter(p => ids.has(p.runId));
      const disabled = state.busy || state.loading;
      return `<section class="etl-section"><div class="etl-section-heading"><div><h2>Portal sales</h2><p class="etl-muted">${esc(client.channel)}</p></div><button type="button" data-portal-refresh title="Refresh portal jobs" aria-label="Refresh portal jobs" ${disabled ? "disabled" : ""}>${icon("arrows-clockwise")}</button></div><div class="etl-portal-selector" role="group" aria-label="Portal client">${clients.map(c => `<button type="button" data-portal-select="${c.id}" aria-pressed="${id === c.id}">${c.name}</button>`).join("")}</div>${state.error ? `<p class="etl-error" role="alert">${esc(state.error)}</p>` : ""}${state.note ? `<p class="etl-notice" role="status">${esc(state.note)}</p>` : ""}<div class="etl-portal-run"><div><h3>${esc(client.name)} monthly sales</h3><dl class="etl-reference-summary"><div><dt>Portal</dt><dd>${esc(p?.portal || client.portal)}</dd></div><div><dt>Workflow</dt><dd>${esc(status(id))}</dd></div><div><dt>Schedule</dt><dd>${p?.scheduleEnabled ? "Configured" : "Manual only"}</dd></div><div><dt>Output</dt><dd>${esc(client.output)}</dd></div></dl><button class="etl-setup-actions" type="button" data-portal-credentials="${id}">${icon("key")} Login settings</button></div><form id="etlPortalRun"><label class="etl-field" for="etl-portal-month">Reporting month<input id="etl-portal-month" type="month" value="${esc(state.month)}" required ${disabled ? "disabled" : ""}></label><button type="submit" class="etl-primary" ${disabled || !canRun(id) ? "disabled" : ""}>${icon("play")} ${state.busy ? "Please wait" : "Run monthly sales"}</button>${!state.loading && (!p?.ready || p?.setupRequired) ? '<p class="etl-warning">Workflow validation is outstanding. Running is unavailable.</p>' : current ? '<p class="etl-notice">A job is in progress.</p>' : conflictingRun(id) ? '<p class="etl-notice">Another client job is using the monthly workbook.</p>' : ""}</form></div></section>${prompts.length ? `<section class="etl-section"><h2>Verification required</h2>${prompts.map(p => `<div class="etl-portal-prompt"><p>${esc(p.message || "Enter the current portal OTP in Nexus.")}</p><button type="button" data-portal-prompt="${esc(p.id)}">${icon("shield-check")} Enter OTP</button></div>`).join("")}</section>` : ""}<section class="etl-section"><div class="etl-section-heading"><h2>Latest reports</h2><span class="etl-muted">${esc(client.name)}</span></div>${["error", "unavailable", "restricted"].includes(state.workspace?.reportsStatus) ? '<p class="etl-error">Reports could not be loaded. Refresh to retry.</p>' : reports.length ? `<ul class="etl-portal-reports">${reports.map(r => `<li><div><strong>${esc(r.originalName || r.name)}</strong><small>${esc(date(r.completedAt || r.createdAt))}</small></div><button type="button" data-portal-download="${esc(r.id)}" ${disabled ? "disabled" : ""}>${icon("download-simple")} Download</button></li>`).join("")}</ul>` : '<p class="etl-empty">No completed reports for this client.</p>'}</section><section class="etl-section"><h2>Portal run history</h2>${clientRuns.length ? `<div class="etl-table-scroll"><table><thead><tr><th>Started (SAST)</th><th>Period</th><th>Status</th><th>Details</th><th>Actions</th></tr></thead><tbody>${clientRuns.map(r => `<tr><td>${esc(date(r.createdAt))}</td><td>${esc(r.reportMonth || r.reportStartDate || "Default period")}</td><td><span class="etl-state">${esc(r.status.replaceAll("_", " "))}</span></td><td>${esc(r.message || "")}</td><td>${!terminal.has(r.status) ? `<button type="button" data-portal-abort="${esc(r.id)}" ${disabled ? "disabled" : ""}>${icon("stop")} Stop</button>` : ""}</td></tr>`).join("")}</tbody></table></div>` : '<p class="etl-empty">No portal runs for this client.</p>'}</section>`;
    }
    async function action(task) {
      if (state.busy || !alive) return;
      state.busy = true; state.error = ""; state.note = ""; changed();
      try { await task(); } catch (error) { if (alive) state.error = error.message || "The portal action failed."; }
      finally { if (alive) { state.busy = false; changed(); } }
    }
    root.addEventListener("click", event => {
      const b = event.target.closest("button"); if (!b || b.disabled) return;
      const id = b.dataset.portalOpen || b.dataset.portalSelect;
      if (id && clients.some(c => c.id === id)) { state.selected = id; state.note = ""; open(); return; }
      if (b.hasAttribute("data-portal-refresh")) { action(refresh); return; }
      if (b.dataset.portalCredentials && clients.some(c => c.id === b.dataset.portalCredentials)) action(() => api.configure(b.dataset.portalCredentials));
      if (b.dataset.portalPrompt) {
        const prompt = state.workspace?.prompts?.find(p => p.id === b.dataset.portalPrompt);
        if (prompt) action(() => api.verify(prompt));
      }
      if (b.dataset.portalDownload) {
        const file = state.workspace?.reports?.find(r => r.id === b.dataset.portalDownload);
        if (file) action(() => api.download(file));
      }
      if (b.dataset.portalAbort && runs(state.selected).some(r => r.id === b.dataset.portalAbort) && confirm("Stop this portal job? No new report will be delivered.")) action(async () => { await api.abort(b.dataset.portalAbort); if (alive) await refresh(); });
    }, { signal: controller.signal });
    root.addEventListener("change", event => { if (event.target.id === "etl-portal-month") state.month = event.target.value; }, { signal: controller.signal });
    root.addEventListener("submit", event => {
      if (event.target.id !== "etlPortalRun") return;
      event.preventDefault();
      if (!canRun(state.selected)) return;
      const id = state.selected, month = state.month;
      action(async () => {
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Choose a valid reporting month.");
        const [year, m] = month.split("-").map(Number);
        const result = await api.start({ retailerId: id, reportStartDate: `${month}-01`, reportEndDate: new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10) });
        if (!alive) return;
        await refresh();
        state.note = result.reused ? "This month's completed job already exists. Its report has not been duplicated." : "Job queued. Enter the OTP in the Nexus verification popup when requested.";
      });
    }, { signal: controller.signal });
    return { overview, view, refresh, update, stop() { alive = false; request++; controller.abort(); } };
  }
  window.MeridianEtlPortals = { create, isProfile };
})();
