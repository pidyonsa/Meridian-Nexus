const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const code = fs.readFileSync(path.join(__dirname, "../../public/service-worker.js"), "utf8");
function setup(uid = "alice") {
  const events = {}, shown = [], navigations = [];
  const self = { location: { origin: "https://nexus.example" }, addEventListener: (name, handler) => { events[name] = handler; }, registration: { async showNotification(title, options) { shown.push({ title, ...options }); } }, clients: { async matchAll() { return []; }, async openWindow(url) { navigations.push(url); } } };
  const context = { self, URL, Request, Response, console };
  vm.createContext(context); vm.runInContext(code, context); context.testUid = uid;
  context.testPrefs={};vm.runInContext("chatIdentity = async key => key && key.startsWith('alerts:') ? testPrefs : testUid", context);
  const push = async data => { let work; events.push({ data: { json: () => ({ data }) }, waitUntil: promise => { work = promise; } }); await work; };
  return { events, shown, navigations, context, push };
}
test("data pushes are generic, validate room IDs and ignore other/signed-out accounts", async () => {
  const worker = setup();
  const data = { nexusChat: "1", uid: "alice", roomId: "room_123", taskId: "task_456", eventId: "event_789", kind: "reminder", text: "Private store information" };
  await worker.push({ ...data, uid: "bob" }); assert.equal(worker.shown.length, 0);
  await worker.push({ ...data, roomId: "../../private" }); assert.equal(worker.shown.length, 0);
  await worker.push(data); assert.equal(worker.shown.length, 1);
  assert.equal(worker.shown[0].body, "You have a task reminder.");
  assert.equal(JSON.stringify(worker.shown).includes("Private store information"), false);
  worker.context.testUid = null; await worker.push(data); assert.equal(worker.shown.length, 1);
});
test("notification click opens Nexus auth-protected chat, never an external URL", async () => {
  const worker = setup(); let work;
  worker.events.notificationclick({ notification: { close() {}, data: { uid: "alice", roomId: "room_123", taskId: "task_456" } }, waitUntil: promise => { work = promise; } });
  await work; assert.equal(worker.navigations[0], "https://nexus.example/?chatRoom=room_123&chatTask=task_456#chat");
  worker.context.testUid = "bob";
  worker.events.notificationclick({ notification: { close() {}, data: { uid: "alice", roomId: "room_123" } }, waitUntil: promise => { work = promise; } });
  await work; assert.equal(worker.navigations.length, 1);
});

test('notification sound follows per-account preferences and stays silent with a foreground window',async()=>{
  const worker=setup(),data={nexusChat:'1',uid:'alice',roomId:'room_123',taskId:'task_456',eventId:'task_event',kind:'task'};
  await worker.push(data);assert.equal(worker.shown.at(-1).silent,false);assert.equal(worker.shown.at(-1).body,'A staff task has been assigned to you.');
  worker.context.testPrefs={sound:false};await worker.push(data);assert.equal(worker.shown.at(-1).silent,true);
  worker.context.testPrefs={sound:true,mutedUntil:Date.now()+100000};await worker.push(data);assert.equal(worker.shown.at(-1).silent,true);
  worker.context.testPrefs={sound:true};let forwarded=0;worker.context.self.clients.matchAll=async()=>[{visibilityState:'visible',postMessage:()=>forwarded++}];
  await worker.push(data);assert.equal(worker.shown.at(-1).silent,true);assert.equal(forwarded,1);
});
test("service worker never caches API, private downloads or cross-origin requests", () => {
  const worker = setup();
  for (const [url, mode, method] of [["https://nexus.example/api/private", "cors", "GET"], ["https://nexus.example/api/private", "navigate", "GET"], ["https://nexus.example/functions", "cors", "POST"], ["https://nexus.example.attacker.invalid/", "navigate", "GET"]]) {
    let intercepted = false;
    worker.events.fetch({ request: { url, mode, method }, respondWith() { intercepted = true; } });
    assert.equal(intercepted, false);
  }
});
test("Gemini provider retry is bounded, preserves the prompt, and does not retry auth failures", async () => {
  const index = fs.readFileSync(path.join(__dirname, "../../functions/index.js"), "utf8"), source = index.slice(index.indexOf("async function askGemini("), index.indexOf("exports.askNexusAssistant ="));
  for (const mode of ["recover", "busy", "auth"]) {
    const calls = [];
    const sandbox = { AbortSignal, setTimeout: resolve => resolve(), HttpsError: class extends Error { constructor(code, message) { super(message); this.code = code; } }, geminiApiKey: { value: () => "test-only" }, fetch: async (url, options) => {
      calls.push(options.body); const ok = mode === "recover" && calls.length === 2;
      return { ok, status: mode === "auth" ? 401 : 503, json: async () => ok ? { candidates: [{ content: { parts: [{ text: "Evidence checked." }] } }] } : { error: { message: "simulated provider error" } } };
    } };
    const ask = vm.runInNewContext(`${source}\naskGemini`, sandbox);
    if (mode === "recover") assert.equal(await ask("gemini-3.5-flash", "Question", {}), "Evidence checked.");
    else await assert.rejects(ask("gemini-3.5-flash", "Question", {}), error => error.code === (mode === "auth" ? "internal" : "unavailable"));
    assert.equal(calls.length, mode === "auth" ? 1 : 2);
    if (calls.length === 2) assert.equal(calls[0], calls[1]);
  }
});
