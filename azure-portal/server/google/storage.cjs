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
    async upload(path, data, {type = 'application/octet-stream', metadata = {}} = {}) {
      // Multipart upload: JSON metadata and the bytes in one request.
      const boundary = `nexus${Date.now().toString(36)}`;
      const head = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({name: path, contentType: type, metadata})}\r\n--${boundary}\r\nContent-Type: ${type}\r\n\r\n`);
      const body = Buffer.concat([head, Buffer.from(data), Buffer.from(`\r\n--${boundary}--`)]);
      const res = await call(`https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=multipart`, {method: 'POST', headers: {'Content-Type': `multipart/related; boundary=${boundary}`}, body});
      return res.json();
    },
    async copy(from, to) {
      const res = await call(`${object(from)}/rewriteTo/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(to)}`, {method: 'POST'});
      return res.json();
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
