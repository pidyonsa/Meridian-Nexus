"use strict";
const http = require("node:http"), fs = require("node:fs"), path = require("node:path");
const root = path.resolve(__dirname, "../public"), staging = path.resolve(__dirname, "../.tmp/etl-release-20260909/hosting.assets.json");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".woff": "font/woff", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };
const server = http.createServer(async (request, response) => {
  try {
    if (request.method !== "GET" && request.method !== "HEAD") { response.writeHead(405); return response.end(); }
    const url = new URL(request.url, "http://localhost");
    if (/^\/__\/firebase\/(?:init\.js|12\.15\.0\/firebase-(?:app|auth|firestore|storage|functions)-compat\.js)$/.test(url.pathname)) {
      const remote = await fetch(`https://meridian-nexus.web.app${url.pathname}`);
      response.writeHead(remote.status, { "Content-Type": "text/javascript", "Cache-Control": "no-store" }); return response.end(Buffer.from(await remote.arrayBuffer()));
    }
    const name = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).slice(1);
    const file = path.resolve(root, name);
    if (!file.startsWith(root + path.sep) || !types[path.extname(file)] || !fs.existsSync(file)) { response.writeHead(404); return response.end(); }
    const staged = fs.existsSync(staging) ? JSON.parse(fs.readFileSync(staging, "utf8")) : {};
    let content = Object.hasOwn(staged, name) ? staged[name] : fs.readFileSync(file);
    // Disable service workers on the development origin so releases cannot leave stale test caches.
    if (name === "service-worker.js") content = 'self.addEventListener("install", () => self.skipWaiting()); self.addEventListener("activate", () => self.registration.unregister());';
    response.writeHead(200, { "Content-Type": types[path.extname(file)], "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch { response.writeHead(500); response.end("Local preview resource unavailable."); }
});
server.listen(0, "127.0.0.1", () => {
  const url = `http://localhost:${server.address().port}/#etls`;
  fs.mkdirSync(path.resolve(__dirname, "../.tmp/etl-local"), { recursive: true });
  fs.writeFileSync(path.resolve(__dirname, "../.tmp/etl-local/server.json"), JSON.stringify({ pid: process.pid, url }));
  console.log(url);
});
