'use strict';
// Google Cloud Storage (JSON API) for the Firebase-era Nexus bucket: report downloads, shared resources and ETL inputs,
// which the Google-side workers still read. Files pass through the Azure server (no signed URLs to hand out).
const BUCKET = 'meridain-nexus.firebasestorage.app';

function storage({bucket = BUCKET, token, fetchImpl = fetch}) {
  const object = path => `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}`;
  async function call(url, init = {}, {allow404 = false} = {}) {
    const res = await fetchImpl(url, {...init, headers: {Authorization: `Bearer ${await token()}`, ...(init.headers || {})}});
    if (res.ok || (allow404 && res.status === 404)) return res;
    throw new Error(`Storage ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return {
    bucket,
    async metadata(path) { const res = await call(object(path), {}, {allow404: true}); return res.status === 404 ? null : res.json(); },
    // The object's body as a web stream plus its metadata headers, or null when it does not exist.
    async download(path) {
      const res = await call(`${object(path)}?alt=media`, {}, {allow404: true});
      return res.status === 404 ? null : {body: res.body, type: res.headers.get('content-type') || 'application/octet-stream', size: Number(res.headers.get('content-length')) || null};
    },
    // ifGenerationMatch: 0 writes only when the object does not exist yet.
    async upload(path, data, {type = 'application/octet-stream', metadata = {}, cacheControl, contentDisposition, ifGenerationMatch} = {}) {
      // Multipart upload: JSON metadata and the bytes in one request.
      const boundary = `nexus${Date.now().toString(36)}`;
      const head = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({name: path, contentType: type, metadata, ...(cacheControl ? {cacheControl} : {}), ...(contentDisposition ? {contentDisposition} : {})})}\r\n--${boundary}\r\nContent-Type: ${type}\r\n\r\n`);
      const body = Buffer.concat([head, Buffer.from(data), Buffer.from(`\r\n--${boundary}--`)]);
      const res = await call(`https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=multipart${ifGenerationMatch === undefined ? '' : `&ifGenerationMatch=${ifGenerationMatch}`}`, {method: 'POST', headers: {'Content-Type': `multipart/related; boundary=${boundary}`}, body});
      return res.json();
    },
    // Server-side copy, optionally of one pinned generation and only if the target does not exist (ifGenerationMatch: 0).
    async copy(from, to, {sourceGeneration, ifGenerationMatch, metadata, cacheControl} = {}) {
      let token = '';
      for (;;) {
        const query = new URLSearchParams(Object.entries({sourceGeneration, ifGenerationMatch, rewriteToken: token}).filter(([, v]) => v !== undefined && v !== ''));
        const body = metadata || cacheControl ? JSON.stringify({...(metadata ? {metadata} : {}), ...(cacheControl ? {cacheControl} : {})}) : undefined;
        const res = await call(`${object(from)}/rewriteTo/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(to)}?${query}`, {method: 'POST', ...(body ? {headers: {'Content-Type': 'application/json'}, body} : {})});
        const out = await res.json();
        if (out.done) return out.resource;
        token = out.rewriteToken;
      }
    },
    async list(prefix, max = 1000) {
      const items = [];
      let pageToken = '';
      do {
        const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o?prefix=${encodeURIComponent(prefix)}&maxResults=${Math.min(1000, max)}${pageToken ? `&pageToken=${pageToken}` : ''}`;
        const page = await (await call(url)).json();
        items.push(...(page.items || []));
        pageToken = page.nextPageToken || '';
      } while (pageToken && items.length < max);
      return items;
    },
    async remove(path) { await call(object(path), {method: 'DELETE'}, {allow404: true}); }
  };
}

module.exports = {storage, BUCKET};
