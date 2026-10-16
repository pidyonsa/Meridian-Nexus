// Local-only synthetic preview. No authentication, production data or network API calls.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../public");
function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/") {
      const source = fs.readFileSync(path.join(root, "index.html"), "utf8");
      const main = source.match(/<main id="chatView"[\s\S]*?<\/main>/)[0].replace('class="chat-page view" hidden', 'class="chat-page view"');
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Meridian Chat / local test preview</title><link href="/vendor/manrope.css" rel="stylesheet"><link rel="stylesheet" href="/vendor/style.css"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/meridian-chat.css"></head><body><div class="site-shell"><div class="nexus-main unified-shell">${main}</div></div>${url.searchParams.has("enhanced") ? '<script src="/chat-tools.js"></script>' : ""}<script src="/meridian-chat.js"></script><script src="/fixture.js"></script></body></html>`);
    }
    if (/^\/vendor\/[a-zA-Z0-9_.-]+\.(css|woff2|ttf)$/.test(url.pathname)) {
      const name = path.basename(url.pathname);
      const file = path.join(__dirname, "../.tmp/chat-verification/vendor", name);
      return fs.readFile(file, (error, data) => {
        if (error) { res.writeHead(404); return res.end(); }
        res.setHeader("Content-Type", name.endsWith(".css") ? "text/css" : name.endsWith(".woff2") ? "font/woff2" : "font/ttf");
        if (name === "manrope.css") data = data.toString().replace(/https:\/\/fonts\.gstatic\.com\/[^)]+/g, value => `/vendor/${path.basename(new URL(value).pathname)}`);
        res.end(data);
      });
    }
    const file = url.pathname === "/fixture.js" ? path.join(__dirname, "fixtures/meridian-chat-preview.js") : path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (url.pathname !== "/fixture.js" && (!file.startsWith(root + path.sep) || ![".css", ".js", ".png", ".woff2", ".woff"].includes(path.extname(file)))) { res.writeHead(404); return res.end(); }
    fs.readFile(file, (error, data) => {
      if (error) { res.writeHead(404); return res.end(); }
      res.setHeader("Content-Type", ({ ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".woff2": "font/woff2" })[path.extname(file)] || "application/octet-stream");
      res.setHeader("Cache-Control", "no-store"); res.end(data);
    });
  });
}
module.exports = { createServer };
if (require.main === module) createServer().listen(Number(process.env.CHAT_PREVIEW_PORT || 8786), "127.0.0.1", () => console.log("Synthetic Meridian Chat preview: http://127.0.0.1:8786"));
