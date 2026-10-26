'use strict';
// Microsoft Graph for SharePoint, as the Firebase-era functions used it (sharePointAccessToken / graphRequest /
// downloadSharePointPathBuffer): the Meridian SharePoint app's client-credentials token, with its tenant, client id
// and secret read from Key Vault by the site's identity (approved 26 Oct 2026).
const GRAPH = 'https://graph.microsoft.com/v1.0';

// Each path segment URL-encoded, slashes kept (drive item paths such as "Power BI - PG/Training").
const encodeGraphPath = path => String(path).split('/').filter(Boolean).map(encodeURIComponent).join('/');

function graphClient({vault, fetchImpl = fetch}) {
  if (!vault) return null;
  let cached = null;
  async function token() {
    if (cached && cached.expires > Date.now()) return cached.token;
    const [tenant, clientId, secret] = await Promise.all(['sharepoint-tenant-id', 'sharepoint-client-id', 'sharepoint-client-secret'].map(n => vault.cached(n)));
    const res = await fetchImpl(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({client_id: clientId, client_secret: secret, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials'})});
    if (!res.ok) throw new Error(`SharePoint sign-in failed (${res.status}).`);
    const body = await res.json();
    cached = {token: body.access_token, expires: Date.now() + Math.max(60, Number(body.expires_in || 3600) - 300) * 1000};
    return cached.token;
  }
  async function request(path, {method = 'GET', body, headers = {}, raw = false} = {}) {
    for (let attempt = 1; ; attempt++) {
      const res = await fetchImpl(path.startsWith('https://') ? path : `${GRAPH}${path}`, {method, headers: {Authorization: `Bearer ${await token()}`, ...(body && !Buffer.isBuffer(body) ? {'Content-Type': 'application/json'} : {}), ...headers}, ...(body ? {body: Buffer.isBuffer(body) ? body : JSON.stringify(body)} : {})});
      if (res.ok) return raw ? res : res.status === 204 ? null : res.json();
      if (attempt < 4 && [429, 503, 504].includes(res.status)) { await new Promise(r => setTimeout(r, Number(res.headers.get('retry-after') || attempt * 2) * 1000)); continue; }
      const error = new Error(`Microsoft Graph ${res.status}: ${(await res.text()).slice(0, 300)}`);
      error.status = res.status;
      throw error;
    }
  }
  return {
    request,
    // Every page of a collection (follows @odata.nextLink), up to max items.
    async all(path, max = 5000) {
      const items = [];
      let next = path;
      while (next && items.length < max) { const page = await request(next); items.push(...(page.value || [])); next = page['@odata.nextLink']; }
      return items.slice(0, max);
    },
    async download(driveId, itemPath) {
      const res = await request(`/drives/${driveId}/root:/${encodeGraphPath(itemPath)}:/content`, {raw: true});
      return Buffer.from(await res.arrayBuffer());
    },
    async downloadItem(driveId, itemId) {
      const res = await request(`/drives/${driveId}/items/${itemId}/content`, {raw: true});
      return Buffer.from(await res.arrayBuffer());
    }
  };
}

module.exports = {graphClient, encodeGraphPath};
