"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm"), path = require("node:path");
const file = process.env.NEXUS_SW_FILE || path.resolve(__dirname, "../../public/service-worker.js");
function worker({ hit, response = new Response("current"), failNetwork = false, failCache = false } = {}) {
  const listeners = {}, requests = [], writes = [];
  vm.runInNewContext(fs.readFileSync(file, "utf8"), {
    self: { location: { origin: "https://nexus.test" }, addEventListener: (name, handler) => { listeners[name] = handler; } },
    caches: { open: async () => { if (failCache) throw Error("cache unavailable"); return { match: async () => hit, put: async (key, value) => writes.push([key, await value.text()]) }; } },
    URL, Request, Response,
    fetch: async request => { requests.push(request); if (failNetwork) throw Error("offline"); return response; }
  });
  return {
    requests, writes,
    async get(url = "/", { mode = "navigate", method = "GET" } = {}) {
      const waits = []; let result;
      const request = new Request(new URL(url, "https://nexus.test"), { method });
      Object.defineProperty(request, "mode", { value: mode });
      listeners.fetch({ request, respondWith: value => { result = value; }, waitUntil: value => waits.push(value) });
      const value = await result; await Promise.all(waits); return value;
    }
  };
}
test("online navigation returns current HTML on the first request, not the cached form", async () => {
  const sw = worker({ hit: new Response("old setup") });
  assert.equal(await (await sw.get("/?refresh=1#etls")).text(), "current");
  assert.equal(sw.requests[0].cache, "no-cache"); assert.deepEqual(sw.writes, [["/", "current"]]);
});
test("offline navigation and temporary server errors retain the public shell fallback", async () => {
  for (const options of [{ failNetwork: true }, { response: new Response("unavailable", { status: 503 }) }]) {
    const sw = worker({ hit: new Response("offline shell"), ...options });
    assert.equal(await (await sw.get("/index.html")).text(), "offline shell"); assert.equal(sw.writes.length, 0);
  }
  assert.equal((await worker({ failNetwork: true }).get()).type, "error");
  assert.equal((await worker({ response: new Response("unavailable", { status: 503 }) }).get()).status, 503);
});
test("unavailable Cache Storage does not break a successful online page", async () => {
  assert.equal(await (await worker({ failCache: true }).get()).text(), "current");
});
test("versioned public assets remain cache-first", async () => {
  const sw = worker({ hit: new Response("versioned asset") });
  assert.equal(await (await sw.get("/etls.js?v=release", { mode: "cors" })).text(), "versioned asset");
  assert.equal(sw.requests.length, 0);
});
test("private APIs, files, cross-origin requests and writes bypass the cache", async () => {
  const sw = worker();
  for (const url of ["/api/orders", "/private/report.xlsx", "https://firestore.googleapis.com/channel"]) {
    assert.equal(await sw.get(url, { mode: "cors" }), undefined);
  }
  assert.equal(await sw.get("/", { method: "POST" }), undefined);
  assert.equal(sw.requests.length, 0); assert.equal(sw.writes.length, 0);
});
