const CACHE = "meridian-nexus-20260924-fresh-navigation";
const SHELL = ["/etl-portals.js?v=20260923-unified-etls","/admin-profile-loader.js?v=20260923-dataorbis-run-options","/extraction-profile.css?v=20260922-dataorbis-sales","/attendance-exclusions.js?v=20260916-attendance-exclusions","/attendance-exclusions.css?v=20260916-attendance-exclusions","/job-status.js?v=20260911-job-status","/job-status.css?v=20260911-job-status","/meridian-support.js?v=20260911-support","/meridian-support.css?v=20260911-support","/attendance-analytics.js?v=20260910-attendance-analytics4","/attendance-analytics.css?v=20260910-attendance-analytics4","/","/styles.css?v=20260907-insights-stability","/app.js?v=20260923-unified-etls","/nexus-load-cache.js?v=20260910-fast-pages","/attendance-job-summaries.css?v=20260909-job-summaries","/franchise-orders.js?v=20260911-franchise-drilldowns","/franchise-orders.css?v=20260911-franchise-drilldowns","/meridian-chat.js?v=20260910-fast-pages","/meridian-chat.css?v=20260909-chat-etl","/manifest.webmanifest","/assets/icons/icon-192.png","/assets/icons/icon-512.png","/chat-tools.js?v=20260909-chat-etl","/etls.js?v=20260923-etl-customers","/etls.css?v=20260923-etl-customers","/etl-references.css?v=20260910-shared-files","/etl-references.js?v=20260910-shared-files"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("meridian-nexus-") && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  const target = new URL(event.request.url);
  const navigation = event.request.mode === "navigate" && ["/", "/index.html"].includes(target.pathname);
  const shell = SHELL.some(path => new URL(path, self.location.origin).pathname === target.pathname);
  const lazy = [
    "/sales-insights-source/dashboard.dc.html", "/sales-insights-source/support.js",
    "/sales-insights-source/province-map.html", "/assets/callcycle/region-footprint.html",
    "/sales-insights-source/assets/sa-provinces.topo.json", "/user-management.css",
    "/assets/callcycle/meridian.png", "/assets/callcycle/pg.png",
    "/sales-insights-source/assets/meridian-logo-white.png",
    "/sales-insights-source/assets/meridian-logo.png", "/sales-insights-source/assets/meridian-mark.png",
    "/assets/icons/favicon-32.png", "/assets/icons/apple-touch-icon.png"
  ].includes(target.pathname) || /^\/__\/firebase\/12\.15\.0\/firebase-[a-z-]+\.js$/.test(target.pathname);
  if (!navigation && !shell && !lazy) return;
  const key = navigation ? "/" : event.request;
  const cached = caches.open(CACHE).then(cache => cache.match(key)).catch(() => undefined);
  const versioned = !navigation && (target.searchParams.has("v") || target.pathname.startsWith("/__/firebase/12.15.0/"));
  const refresh = async () => {
    const response = await fetch(new Request(event.request, { cache: navigation ? "no-cache" : "default" }));
    if (response.ok && response.type !== "opaque") {
      const copy = response.clone();
      await caches.open(CACHE).then(cache => cache.put(key, copy)).catch(() => {});
    }
    return response;
  };
  // Only public shell assets enter Cache Storage. Private callable/Firestore
  // requests, downloaded files and chat media always bypass this handler.
  if (navigation) {
    // A cached document can pin an old versioned ETL script after deployment.
    const network = refresh();
    event.waitUntil(network.then(() => {}, () => {}));
    event.respondWith(network.then(async response => response.ok ? response : await cached || response)
      .catch(async () => await cached || Response.error()));
    return;
  }
  const network = cached.then(hit => hit && versioned ? null : refresh());
  event.waitUntil(network.then(() => {}, () => {}));
  event.respondWith(cached.then(async hit => hit || await network || Response.error()).catch(() => Response.error()));
});

function chatIdentity(key = "activeUid") {
  return new Promise(resolve => {
    const request = indexedDB.open("meridian-chat-local-v1", 1);
    request.onupgradeneeded = () => { request.result.createObjectStore("outbox", { keyPath: "id" }); request.result.createObjectStore("meta"); };
    request.onerror = () => resolve(null);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction("meta"), read = tx.objectStore("meta").get(key);
      read.onsuccess = () => resolve(read.result || null); read.onerror = () => resolve(null); tx.oncomplete = () => db.close();
    };
  });
}
self.addEventListener("push", event => {
  event.waitUntil((async () => {
    let payload; try { payload = event.data?.json()?.data; } catch { return; }
    if (payload?.nexusChat !== "1" || !payload.uid || payload.uid !== await chatIdentity()) return;
    if (!/^[a-zA-Z0-9_-]{1,160}$/.test(payload.roomId || "") || (payload.taskId && !/^[a-zA-Z0-9_-]{1,160}$/.test(payload.taskId))) return;
    const settings=await chatIdentity('alerts:'+payload.uid)||{};
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const foreground=windows.some(client=>client.visibilityState==='visible');
    if(payload.uid!==await chatIdentity())return;
    windows.forEach(client=>client.postMessage({type:'nexus-chat-push',uid:payload.uid}));
    await self.registration.showNotification("Meridian Nexus", { body: payload.kind === "reminder" ? "You have a task reminder." : payload.kind === "task" ? "A staff task has been assigned to you." : "You have a new staff message.", icon: "/assets/icons/icon-192.png", tag: payload.eventId, renotify: false, silent: foreground||settings.sound===false||settings.mutedUntil>Date.now(), data: { uid: payload.uid, roomId: payload.roomId, taskId: payload.taskId || "" } });
  })());
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const data = event.notification.data;
    if (!data || data.uid !== await chatIdentity()) return;
    const url = new URL("/", self.location.origin); url.searchParams.set("chatRoom", data.roomId); if (data.taskId) url.searchParams.set("chatTask", data.taskId); url.hash = "chat";
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const client = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (client) { await client.navigate(url.href); await client.focus(); } else await self.clients.openWindow(url.href);
  })());
});
