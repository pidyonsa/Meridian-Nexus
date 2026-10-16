"use strict";

// The one-shot read uses the user's Firebase token and the same Firestore rules
// as the live listener. It is not an administrative permission bypass.
window.NexusAdminProfiles = (() => {
  const fields = ["name", "webAddress", "username", "extractionProfileId", "extractionName", "steps", "reportVariant", "reportSchedule", "salesforceConnectedApp", "credentialsUpdatedAt", "restoration", "salesProcedure", "geoRepReportType", "salesforceReportType", "updatedAt", "createdAt"];
  function decode(value, timestamp) {
    if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([k, v]) => [k, decode(v, timestamp)]));
    if (value.arrayValue) return (value.arrayValue.values || []).map(v => decode(v, timestamp));
    if ("timestampValue" in value) return timestamp(value.timestampValue);
    if ("integerValue" in value) return Number(value.integerValue);
    for (const key of ["stringValue", "doubleValue", "booleanValue", "nullValue"]) if (key in value) return value[key];
    throw new Error("Unsupported extraction profile field.");
  }
  const denied = error => /(?:permission-denied|unauthenticated)$/.test(String(error?.code || ""));
  async function read({ user, projectId, signal, fetcher = fetch, timestamp = value => new Date(value) }) {
    if (!user || !/^[a-z][a-z0-9-]{4,62}$/.test(projectId || "")) throw new Error("Sign in again to load extraction profiles.");
    const token = await user.getIdToken();
    if (signal.aborted) throw new DOMException("Request cancelled", "AbortError");
    const response = await fetcher(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`, {
      method: "POST", signal, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "retailers" }], select: { fields: fields.map(fieldPath => ({ fieldPath })) }, limit: 1001 } })
    });
    if (!response.ok) {
      const error = new Error(response.status === 403 ? "This account is not permitted to read extraction profiles." : response.status === 401 ? "Your session has expired. Sign in again." : "Extraction profiles could not be loaded. Please retry.");
      error.code = response.status === 403 ? "permission-denied" : response.status === 401 ? "unauthenticated" : "unavailable";
      throw error;
    }
    const result = await response.json();
    if (!Array.isArray(result) || result.some(r => r.error)) throw new Error("The extraction profile response was incomplete.");
    const documents = result.filter(row => row.document).map(row => row.document);
    if (documents.length > 1000) throw new Error("Too many extraction profiles. Contact an administrator.");
    return documents.map(doc => ({ ...decode({ mapValue: { fields: doc.fields || {} } }, timestamp), id: doc.name.split("/").at(-1) }));
  }
  function start({ user, projectId, listen, onChange, timestamp, fetcher, timeoutMs = 12000 }) {
    let stopped = false, revision = 0, loaded = false, rows = [], unsubscribe = null;
    const controller = new AbortController();
    const change = (status, error = "") => { if (!stopped) onChange({ rows, status, error }); };
    const stop = () => { stopped = true; clearTimeout(timer); controller.abort(); unsubscribe?.(); };
    let expired = false;
    const timer = setTimeout(() => { expired = true; controller.abort(); }, timeoutMs);
    change("loading");
    try {
      unsubscribe = listen(snapshot => {
        if (stopped || snapshot.metadata?.fromCache) return;
        revision++;
        loaded = true;
        rows = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        change("ready");
      }, error => {
        if (stopped) return;
        if (denied(error)) {
          rows = []; change("error", "This account cannot read extraction profiles. Sign in again or ask an administrator to check access."); stop();
        } else if (loaded) change("error", "Live updates are unavailable. Retry to refresh these profiles.");
        // Before the first result, the bounded one-shot read can still succeed.
      });
    } catch (error) {
      if (denied(error)) { rows = []; change("error", "This account cannot read extraction profiles."); stop(); }
    }
    if (stopped) { unsubscribe?.(); return stop; }
    const readRevision = revision;
    const pending = read({ user, projectId, signal: controller.signal, fetcher, timestamp });
    const timeout = new Promise((_, reject) => controller.signal.addEventListener("abort", () => reject(new DOMException("Request cancelled", "AbortError")), { once: true }));
    Promise.race([pending, timeout]).then(result => {
      if (stopped || revision !== readRevision || loaded) return;
      rows = result; loaded = true; change("ready");
    }).catch(error => {
      if (stopped || revision !== readRevision || (loaded && !denied(error))) return;
      if (denied(error)) rows = [];
      change("error", expired ? "Extraction profiles timed out. Retry or check your connection." : error.message || "Extraction profiles could not be loaded.");
      if (denied(error)) stop();
    }).finally(() => clearTimeout(timer));
    return stop;
  }
  return { read, start };
})();
