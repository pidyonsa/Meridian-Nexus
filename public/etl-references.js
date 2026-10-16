"use strict";
(() => {
  const roles = { products: "Product List", stores: "Store name clean-up", staffing: "Store / call-cycle master", dc: "DC mapping", status: "PnP status codes", inventorySample: "Inventory transformed sample", salesSample: "Sales transformed sample", gln: "GLN Master (Shoprite sales)" };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  function mount(root, api) {
    const controller = new AbortController(); let alive = true, sequence = 0;
    const state = { resources: [], selections: {}, revision: 0, loaded: false, busy: false, dirty: false, error: "", note: "" };
    function render() {
      if (!alive) return;
      root.innerHTML = `<header class="etl-ref-heading"><div><h2>Shared ETL files</h2><p>All clients and retail channels${state.revision ? ` &middot; Saved set v${state.revision}` : ""}</p></div><div class="etl-ref-actions"><button type="button" data-ref-refresh class="icon-button" title="Reload shared files" aria-label="Reload shared files" ${state.busy ? "disabled" : ""}><i class="ph ph-arrows-clockwise" aria-hidden="true"></i></button><button type="button" data-ref-save class="primary-action" ${state.busy || !state.loaded || !state.dirty || Object.keys(roles).some(r => r !== "gln" && !state.selections[r]) ? "disabled" : ""}>Save shared files</button></div></header>${state.error ? `<p class="etl-ref-error" role="alert">${esc(state.error)}</p>` : ""}${state.note ? `<p role="status">${esc(state.note)}</p>` : ""}${!state.loaded ? '<p role="status">Loading shared files...</p>' : `<div class="etl-ref-grid">${Object.entries(roles).map(([role, label]) => {
        const selected = state.selections[role], resource = state.resources.find(r => r.id === selected);
        return `<div class="etl-ref-row"><label for="ref-${role}">${label}</label><select id="ref-${role}" data-ref-role="${role}" ${state.busy ? "disabled" : ""}><option value="">Select an existing resource</option>${selected && !resource ? `<option value="${esc(selected)}" selected>Unavailable resource - choose a replacement</option>` : ""}${state.resources.map(r => `<option value="${esc(r.id)}" ${selected === r.id ? "selected" : ""}>${esc(r.title)} / ${esc(r.sourceName)}</option>`).join("")}</select><div class="etl-ref-actions"><button type="button" class="icon-button" data-ref-edit="${role}" ${!resource || state.busy ? "disabled" : ""} title="Replace or edit ${label}" aria-label="Replace or edit ${label}"><i class="ph ph-pencil-simple" aria-hidden="true"></i></button><button type="button" class="icon-button" data-ref-add="${role}" ${state.busy ? "disabled" : ""} title="Add ${label}" aria-label="Add ${label}"><i class="ph ph-upload-simple" aria-hidden="true"></i></button></div></div>`;
      }).join("")}</div>`}`;
    }
    async function refresh(preserve = true) {
      const request = ++sequence;
      try {
        const data = await api.call({ action: "catalogue" });
        if (!alive || request !== sequence) return;
        state.resources = data.resources.filter(r => /\.xlsx$/i.test(r.sourceName || ""));
        if (!preserve || !state.dirty) {
          state.revision = data.referenceSet?.revision || 0;
          state.selections = Object.fromEntries(Object.entries(data.referenceSet?.resources || {}).filter(([role]) => Object.hasOwn(roles, role)));
          if (!state.revision) for (const role of Object.keys(roles)) {
            const matches = state.resources.filter(r => r.tags?.includes(`etl-anchor-${role}`));
            if (matches.length === 1) state.selections[role] = matches[0].id;
          }
          state.dirty = !state.revision && Object.keys(state.selections).length > 0;
        }
        state.loaded = true; state.error = "";
      } catch (e) { if (alive && request === sequence) state.error = e.message || "Shared files could not be loaded."; }
      render();
    }
    root.addEventListener("change", event => {
      if (!event.target.dataset.refRole || state.busy) return;
      state.selections[event.target.dataset.refRole] = event.target.value;
      state.dirty = true; state.note = "Unsaved shared-file changes."; render();
    }, { signal: controller.signal });
    root.addEventListener("click", async event => {
      const button = event.target.closest("button"); if (!button || button.disabled || state.busy) return;
      if (button.hasAttribute("data-ref-refresh")) { state.note = ""; await refresh(false); return; }
      if (button.dataset.refEdit || button.dataset.refAdd) {
        const role = button.dataset.refEdit || button.dataset.refAdd;
        try { await api.edit(role, button.dataset.refEdit ? state.selections[role] : ""); }
        catch (e) { if (alive) { state.error = e.message || "Resource editor could not open."; render(); } }
        return;
      }
      if (!button.hasAttribute("data-ref-save")) return;
      state.busy = true; state.error = ""; render();
      try {
        const data = await api.call({ action: "saveReferences", resources: state.selections, revision: state.revision });
        if (!alive) return;
        state.revision = data.referenceSet.revision; state.selections = data.referenceSet.resources; state.dirty = false;
        state.note = "Shared ETL files saved for all clients and channels.";
      } catch (e) { if (alive) state.error = e.message || "Shared files could not be saved."; }
      finally { state.busy = false; render(); }
    }, { signal: controller.signal });
    render(); refresh();
    return { refresh, stop() { alive = false; sequence++; controller.abort(); root.textContent = ""; } };
  }
  window.MeridianEtlReferences = { mount, roles };
})();
