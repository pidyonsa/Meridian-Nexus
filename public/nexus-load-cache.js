(function (global) {
  "use strict";
  const reports = new Set([
    "getStockFixDashboard", "getStockFixAdoptionDashboard", "getSalesforceAttendanceDashboard",
    "getGeoRepAttendanceDashboard", "getSalesInsightsDashboard", "getSalesInsightsRoute",
    "getGeoRepSalesDashboard", "getTrainingHubDashboard", "getFranchiseOrderDashboard", "getPortalResources"
  ]);
  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
    return value;
  }
  const denied = error => /permission-denied|unauthenticated/.test(error?.code || "");
  const cancelled = () => Object.assign(new Error("The Nexus session changed. Reopen this page."), { code: "cancelled" });
  function create({ scope, fetch, now = Date.now, maxEntries = 24, maxBytes = 24 * 1024 * 1024, freshMs = 60000, staleMs = 300000 }) {
    let identity = "", epoch = 0, bytes = 0;
    const entries = new Map(), pending = new Map();
    const stats = { hits: 0, requests: 0, joined: 0 };
    function clear() { epoch++; entries.clear(); pending.clear(); bytes = 0; }
    function sync() { const next = scope() || ""; if (next !== identity) { clear(); identity = next; } return next; }
    function remove(key) { bytes -= entries.get(key)?.size || 0; entries.delete(key); }
    function put(key, value) {
      const json = JSON.stringify(value), size = json.length * 2;
      if (size > maxBytes) return;
      remove(key);
      while (entries.size && (entries.size >= maxEntries || bytes + size > maxBytes)) remove(entries.keys().next().value);
      entries.set(key, { json, size, at: now() }); bytes += size;
    }
    async function read(name, data = {}, options = {}) {
      const session = sync(), version = epoch;
      const cacheable = !!session && reports.has(name) && !data.export;
      const coalesce = !!session && (cacheable || name === "getOperationsWorkspace" || name === "getAdminExtractionRunHistory");
      const current = () => session === sync() && (!cacheable || version === epoch);
      const key = JSON.stringify([name, stable(data)]);
      const cached = cacheable ? entries.get(key) : null;
      if (cached && now() - cached.at > staleMs) remove(key);
      if (cached && !options.force && now() - cached.at <= staleMs) {
        const fresh = now() - cached.at < freshMs;
        stats.hits++;
        if (fresh) return JSON.parse(cached.json);
        options.onCached?.(JSON.parse(cached.json), { at: cached.at, refreshing: true });
      }
      let work = coalesce && pending.get(key);
      if (work) stats.joined++;
      else {
        stats.requests++;
        work = Promise.resolve().then(() => {
          if (!current()) throw cancelled();
          return fetch(name, data);
        }).then(value => {
          if (!current()) throw cancelled();
          if (cacheable) {
            put(key, value);
            if (name === "getStockFixDashboard" && !data.week && value.selectedWeek) put(JSON.stringify([name, stable({ ...data, week: value.selectedWeek })]), value);
          }
          return value;
        }).catch(error => {
          if (denied(error) && session === sync()) clear();
          throw error;
        }).finally(() => { if (pending.get(key) === work) pending.delete(key); });
        if (coalesce) pending.set(key, work);
      }
      // Each consumer receives its own copy; renderers sometimes modify filter arrays.
      const value = await work;
      if (!current()) throw cancelled();
      return cacheable ? structuredClone(value) : value;
    }
    return { read, clear, stats, sync };
  }
  global.NexusLoadCache = { create, denied };
})(typeof window === "undefined" ? globalThis : window);
