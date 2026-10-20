/* Private browser state: no auth tokens, downloaded files or received messages. */
(function () {
  "use strict";
  const MAX_BYTES = 6 * 1024 * 1024, MAX_QUEUE_BYTES = 30 * 1024 * 1024;
  let database, activeUid = null, identityRevision = 0, identityReady = Promise.resolve();
  const open = () => database ||= new Promise((resolve, reject) => {
    const request = indexedDB.open("meridian-chat-local-v1", 1);
    request.onupgradeneeded = () => { request.result.createObjectStore("outbox", { keyPath: "id" }); request.result.createObjectStore("meta"); };
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  async function transaction(stores, run) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(stores, "readwrite"); let result;
      tx.oncomplete = () => resolve(result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error("Local queue cancelled."));
      run(tx, value => { result = value; });
    });
  }
  async function identity(uid) {
    if (uid === activeUid && database) return identityReady;
    const previous = activeUid;
    activeUid = uid; const revision = ++identityRevision;
    if (previous && previous !== uid) localStorage.removeItem(`mc-push-enabled-${previous}`);
    identityReady = transaction(["outbox", "meta"], tx => {
      if (revision !== identityRevision) { tx.abort(); return; }
      tx.objectStore("meta").put(uid || "", "activeUid");
      const cursor = tx.objectStore("outbox").openCursor();
      cursor.onsuccess = () => { const row = cursor.result; if (!row) return; if (row.value.uid !== uid || row.value.createdAt < Date.now() - 7 * 86400000) row.delete(); row.continue(); };
    });
    await identityReady;
    if (!uid && revision === identityRevision) await disablePush().catch(() => {});
  }
  async function list(uid) {
    return transaction(["outbox"], (tx, done) => { const read = tx.objectStore("outbox").getAll(); read.onsuccess = () => done(read.result.filter(row => row.uid === uid).sort((a, b) => a.createdAt - b.createdAt)); });
  }
  async function add(uid, data, files) {
    await identityReady;
    if (uid !== activeUid) throw new Error("Your account changed. Reopen Chat.");
    const entry = { id: `${uid}:${data.requestId}`, uid, data, files: files.map(file => ({ ...file, uploadId: crypto.randomUUID() })), createdAt: Date.now(), status: "queued", error: "", attempts: 0 };
    return transaction(["outbox", "meta"], (tx, done) => {
      const read = tx.objectStore("outbox").getAll(), identity = tx.objectStore("meta").get("activeUid");
      identity.onsuccess = () => { if (identity.result !== uid) tx.abort(); };
      read.onsuccess = () => {
        const previous = read.result.filter(row => row.uid === uid);
        const bytes = [...previous, entry].reduce((n, row) => n + row.files.reduce((sum, file) => sum + file.blob.size, 0), 0);
        if (previous.length >= 50 || bytes > MAX_QUEUE_BYTES) { tx.abort(); return; }
        tx.objectStore("outbox").put(entry); done(entry);
      };
    }).catch(error => { throw new Error(`Message not queued. Local storage may be full (50 messages / 30 MB maximum). ${error.message}`); });
  }
  async function update(entry) {
    return transaction(["outbox", "meta"], tx => {
      const identity = tx.objectStore("meta").get("activeUid"), old = tx.objectStore("outbox").get(entry.id);
      old.onsuccess = () => { if (identity.result === entry.uid && old.result && activeUid === entry.uid) tx.objectStore("outbox").put(entry); };
    });
  }
  const remove = id => transaction(["outbox"], tx => tx.objectStore("outbox").delete(id));
  const base64 = blob => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(",")[1]); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); });
  function queue(uid, service, changed, valid) {
    let running = false;
    async function flush() {
      if (running || !navigator.onLine || !valid() || activeUid !== uid) return;
      running = true;
      const work = async () => {
        const blockedRooms = new Set();
        for (const row of await list(uid)) {
          if (!valid() || activeUid !== uid || !navigator.onLine) break;
          if (blockedRooms.has(row.data.roomId)) continue;
          if (row.status === "failed" || row.nextAttempt > Date.now()) { blockedRooms.add(row.data.roomId); continue; }
          if (row.createdAt < Date.now() - 7 * 86400000) { await remove(row.id); continue; }
          row.status = "sending"; await update(row); changed();
          try {
            const attachments = [];
            for (const file of row.files) {
              if (!valid() || activeUid !== uid) return;
              const uploaded = await service.media({ action: "upload", roomId: row.data.roomId, requestId: file.uploadId, name: file.name, kind: file.kind, duration: file.duration, base64: await base64(file.blob) });
              attachments.push(uploaded.id);
            }
            if (!valid() || activeUid !== uid) return;
            await service.call({ ...row.data, ...(attachments.length ? { attachmentIds: attachments } : {}) });
            await remove(row.id);
          } catch (error) {
            const transient = !navigator.onLine || /unavailable|deadline-exceeded|internal|resource-exhausted|network/i.test(`${error.code} ${error.message}`);
            row.attempts++; row.status = transient ? "queued" : "failed"; row.error = error.message || "Could not send.";
            row.nextAttempt = Date.now() + Math.min(300000, 5000 * 2 ** Math.min(row.attempts, 6));
            await update(row); blockedRooms.add(row.data.roomId);
          }
          changed();
        }
      };
      try { if (navigator.locks) await navigator.locks.request(`meridian-chat-send-${uid}`, { ifAvailable: true }, lock => lock && work()); else await work(); }
      finally { running = false; changed(); }
    }
    return { flush, async retry(id) { const row = (await list(uid)).find(row => row.id === id); if (row) { row.status = "queued"; row.nextAttempt = 0; await update(row); } await flush(); }, async remove(id) { if ((await list(uid)).some(row => row.id === id && row.status !== "sending")) await remove(id); changed(); } };
  }
  function fileInput(file, kind = "file", duration = null) {
    if (!file.size || file.size > MAX_BYTES) throw new Error("Each attachment must be between 1 byte and 6 MB.");
    if (!/\.(jpe?g|png|webp|pdf|txt|csv|xlsx|docx|pptx|webm|ogg|m4a|mp4)$/i.test(file.name)) throw new Error("Choose an image, PDF, TXT, CSV, XLSX, DOCX, PPTX or voice file.");
    return { blob: file, name: file.name, kind, duration, localId: crypto.randomUUID() };
  }
  function recorder(ready, changed, error) {
    let stream, media, cancelled = false, timer, started, chunks = [], size = 0;
    const cancel = () => { cancelled = true; clearInterval(timer); if (media?.state === "recording") media.stop(); stream?.getTracks().forEach(track => track.stop()); };
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error("Voice recording is unavailable in this browser.");
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (cancelled) { stream.getTracks().forEach(track => track.stop()); return; }
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find(value => MediaRecorder.isTypeSupported(value));
      if (!mime) throw new Error("No supported voice recorder format is available.");
      media = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 48000 });
      media.ondataavailable = event => { size += event.data.size; if (size > MAX_BYTES) { cancel(); error(new Error("Voice note exceeds 6 MB.")); } else chunks.push(event.data); };
      media.onerror = () => { cancel(); error(new Error("Recording failed. Please retry.")); };
      media.onstop = () => {
        clearInterval(timer); stream.getTracks().forEach(track => track.stop());
        if (cancelled) return;
        const duration = Math.min(125, (Date.now() - started) / 1000), extension = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
        ready(fileInput(new File(chunks, `Voice-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`, { type: mime }), "voice", duration));
      };
      started = Date.now(); media.start(1000); changed(0);
      timer = setInterval(() => { const seconds = Math.floor((Date.now() - started) / 1000); changed(seconds); if (seconds >= 120 && media.state === "recording") media.stop(); }, 500);
    })().catch(value => { const wasCancelled = cancelled; cancel(); if (!wasCancelled) error(value); });
    return { cancel, stop() { if (media?.state === "recording") { media.stop(); return true; } cancel(); return false; } };
  }
  async function pushWorkerIdentity(uid) {
    const registration = await navigator.serviceWorker.ready;
    return registration;
  }
  async function disablePush() {
    if (!("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager?.getSubscription();
    await subscription?.unsubscribe();
    const notifications = await registration?.getNotifications(); notifications?.forEach(n => n.close());
  }
  async function enablePush(uid, publicKey, service) {
    if (!publicKey) throw new Error("Push notifications await Firebase Web Push configuration. Task due dates remain available in My Tasks.");
    if (!("Notification" in window) || !("serviceWorker" in navigator)) throw new Error("Push notifications are unavailable in this browser.");
    if (await Notification.requestPermission() !== "granted") throw new Error("Notifications were not allowed. You can change this in browser settings.");
    if (!window.firebase?.messaging) await new Promise((resolve, reject) => { const script = document.createElement("script"); script.src = `https://www.gstatic.com/firebasejs/${firebase.SDK_VERSION}/firebase-messaging-compat.js`; script.onload = resolve; script.onerror = () => reject(new Error("Could not load Firebase Messaging.")); document.head.append(script); });
    const registration = await pushWorkerIdentity(uid);
    if (activeUid !== uid) throw new Error("Your account changed.");
    const token = await firebase.messaging().getToken({ vapidKey: publicKey, serviceWorkerRegistration: registration });
    const deviceId = localStorage.getItem(`mc-device-${uid}`) || crypto.randomUUID();
    if (activeUid !== uid) { await disablePush(); throw new Error("Your account changed."); }
    await service.call({ action: "notifications", deviceId, token, enabled: true });
    if (activeUid !== uid) { await disablePush(); throw new Error("Your account changed."); }
    localStorage.setItem(`mc-device-${uid}`, deviceId);
    localStorage.setItem(`mc-push-enabled-${uid}`, "true");
    return deviceId;
  }
  async function settings(uid, value) {
    await identityReady;
    if (!uid || uid !== activeUid) return;
    await transaction(['meta'], tx => {
      const store=tx.objectStore('meta'),read=store.get('activeUid');
      read.onsuccess=()=>{if(read.result===uid&&activeUid===uid)store.put({sound:value.sound!==false,mutedUntil:Number(value.mutedUntil)||0},'alerts:'+uid);};
    });
  }
  window.MeridianChatTools = { identity, settings, list, add, queue, fileInput, recorder, enablePush, disablePush, base64, MAX_BYTES };
})();
