"use strict";
const crypto = require("node:crypto");
const MAX_BYTES = 6 * 1024 * 1024;
const PREFIX = "meridian-chat-attachments/";
const MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf", txt: "text/plain", csv: "text/csv", webm: "audio/webm", ogg: "audio/ogg", m4a: "audio/mp4", mp4: "audio/mp4", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation" };
function validateAttachment(data, fail) {
  const name = String(data.name || "").trim();
  if (!name || name.length > 150 || /[\x00-\x1f/\\\u202a-\u202e\u2066-\u2069]/.test(name)) fail("Choose a valid file name.");
  const ext = name.split(".").at(-1).toLowerCase(), mime = MIME[ext];
  if (!mime) fail("Supported files: images, PDF, TXT, CSV, XLSX, DOCX, PPTX and voice recordings. Macros and executables are not accepted.");
  if (typeof data.base64 !== "string" || data.base64.length > Math.ceil(MAX_BYTES / 3) * 4 || data.base64.length % 4) fail("Invalid attachment, or file exceeds 6 MB.");
  const bytes = Buffer.from(data.base64, "base64"), hex = bytes.subarray(0, 12).toString("hex");
  if (bytes.toString("base64") !== data.base64) fail("Invalid attachment encoding.");
  if (!bytes.length || bytes.length > MAX_BYTES) fail("Each file must be between 1 byte and 6 MB.");
  const valid = mime === "image/jpeg" ? hex.startsWith("ffd8ff") : mime === "image/png" ? hex.startsWith("89504e470d0a1a0a")
    : mime === "image/webp" ? bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP"
    : mime === "application/pdf" ? bytes.toString("ascii", 0, 5) === "%PDF-"
    : mime === "audio/webm" ? hex.startsWith("1a45dfa3") : mime === "audio/ogg" ? bytes.toString("ascii", 0, 4) === "OggS"
    : mime === "audio/mp4" ? bytes.toString("ascii", 4, 8) === "ftyp" : ["xlsx", "docx", "pptx"].includes(ext) ? hex.startsWith("504b0304") : !bytes.includes(0) && !bytes.subarray(0, 2).equals(Buffer.from("MZ"));
  if (!valid) fail("The file content does not match its file type.");
  const voice = data.kind === "voice";
  if (voice && (!mime.startsWith("audio/") || !Number.isFinite(data.duration) || data.duration < 0 || data.duration > 125)) fail("Voice notes must be no longer than two minutes.");
  return { bytes, info: { name, mime, size: bytes.length, kind: voice ? "voice" : "file", duration: voice ? Math.round(data.duration) : null }, digest: crypto.createHash("sha256").update(bytes).digest("hex") };
}
function buildMedia({ db, bucket, authenticate, roomContext, limiter, fail, id, nonce, hash, now }) {
  const files = db.collection("meridianChatAttachments");
  async function upload(actor, data) {
    const { bytes, info, digest } = validateAttachment(data, fail);
    const ext = info.name.split(".").at(-1).toLowerCase();
    if (["xlsx", "docx", "pptx"].includes(ext)) {
      // Inspect the archive directory without extracting or executing document content.
      let zip; try { zip = await require("jszip").loadAsync(bytes); } catch { fail("The Office document is damaged or encrypted."); }
      const names = Object.keys(zip.files), main = { xlsx: "xl/workbook.xml", docx: "word/document.xml", pptx: "ppt/presentation.xml" }[ext];
      if (names.length > 2000 || !zip.file("[Content_Types].xml") || !zip.file(main) || names.some(name => /vbaproject|activex|embeddings|\.(exe|dll|cmd|bat|ps1|vbs|js)$/i.test(name))) fail("Use a standard Office document without macros, embedded files or active controls.");
    }
    const fileId = hash(`${actor.uid}:${nonce(data.requestId)}`), ref = files.doc(fileId);
    const objectPath = `${PREFIX}${fileId}`;
    const payloadHash = hash(JSON.stringify([data.roomId, info, digest]));
    await db.runTransaction(async tx => {
      const { room, profile } = await roomContext(tx, actor, data.roomId);
      if (room.archived || (room.type === "announcement" && room.ownerUid !== actor.uid && !require("./admin-access").isAdminProfile(profile))) fail("This conversation does not accept attachments.", "permission-denied");
      const old = await tx.get(ref);
      if (old.exists) { if (old.data().payloadHash !== payloadHash) fail("Upload identifier already used.", "already-exists"); return; }
      const quotaRef = db.collection("meridianChatUploadQuota").doc(actor.uid), quota = (await tx.get(quotaRef)).data();
      const day = new Date().toISOString().slice(0, 10), dailyBytes = quota?.day === day ? quota.bytes : 0;
      if (dailyBytes + bytes.length > 256 * 1024 * 1024) fail("Daily attachment limit reached (256 MB). Try again tomorrow.", "resource-exhausted");
      const consume = await limiter(tx, actor.uid, "upload", 12); consume();
      tx.set(quotaRef, { day, bytes: dailyBytes + bytes.length });
      tx.create(ref, { ...info, ownerUid: actor.uid, roomId: data.roomId, payloadHash, objectPath, status: "uploading", messageId: null, expiresAt: new Date(Date.now() + 86400000), createdAt: now() });
    });
    // Private objects have no Firebase download tokens or reusable public links.
    await bucket().file(objectPath).save(bytes, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { contentType: info.mime, cacheControl: "private, no-store", contentDisposition: "attachment" } }).catch(error => { if (Number(error.code) !== 412) throw error; });
    await ref.update({ status: "ready" });
    return { id: fileId, ...info };
  }
  async function download(actor, data) {
    const file = await db.runTransaction(async tx => {
      const { ref } = await roomContext(tx, actor, data.roomId);
      const message = await tx.get(ref.collection("messages").doc(id(data.messageId)));
      const value = await tx.get(files.doc(id(data.attachmentId)));
      if (!message.exists || message.data().removed || !value.exists || value.data().messageId !== message.id || value.data().roomId !== ref.id || !(message.data().attachments || []).some(a => a.id === value.id)) fail("Attachment unavailable.", "permission-denied");
      const consume = await limiter(tx, actor.uid, "download", 30); consume();
      return value.data();
    });
    if (!file.objectPath.startsWith(PREFIX)) fail("Invalid attachment.");
    const [bytes] = await bucket().file(file.objectPath).download();
    // Recheck membership after IO; never return a file to a revoked participant.
    await db.runTransaction(async tx => {
      const { ref } = await roomContext(tx, actor, data.roomId);
      const message = await tx.get(ref.collection("messages").doc(id(data.messageId)));
      if (!message.exists || message.data().removed) fail("Message removed.", "permission-denied");
    });
    return { base64: bytes.toString("base64"), name: file.name, mime: file.mime };
  }
  async function bind(tx, actor, roomId, messageId, ids) {
    if (!Array.isArray(ids) || ids.length > 3 || new Set(ids).size !== ids.length) fail("Attach up to three files.");
    const values = ids.length ? await tx.getAll(...ids.map(value => files.doc(id(value)))) : [];
    const attachments = values.map(value => {
      const file = value.data();
      if (!value.exists || file.status !== "ready" || file.ownerUid !== actor.uid || file.roomId !== roomId || file.messageId || file.expiresAt?.toMillis() <= Date.now()) fail("Upload unavailable. Remove it and attach the file again.", "failed-precondition");
      return { id: value.id, name: file.name, mime: file.mime, size: file.size, kind: file.kind, duration: file.duration };
    });
    return { attachments, commit() { values.forEach(value => tx.update(value.ref, { messageId, expiresAt: null })); } };
  }
  async function cleanup() {
    const expired = await files.where("expiresAt", "<=", new Date()).limit(100).get();
    for (const file of expired.docs) {
      // Claim before IO so cleanup cannot race a send transaction binding the upload.
      const claimed = await db.runTransaction(async tx => {
        const fresh = await tx.get(file.ref), value = fresh.data();
        if (!fresh.exists || !value.expiresAt || value.expiresAt.toMillis() > Date.now()) return false;
        tx.update(file.ref, { status: "deleting" }); return true;
      });
      if (!claimed) continue;
      await bucket().file(`${PREFIX}${file.id}`).delete({ ignoreNotFound: true });
      await file.ref.delete();
    }
  }
  return { bind, cleanup, async handler(request) {
    const actor = await authenticate(request);
    if (request.data?.action === "upload") return upload(actor, request.data);
    if (request.data?.action === "download") { const result = await download(actor, request.data); await authenticate(request); return result; }
    fail("Unsupported attachment action.");
  } };
}
module.exports = { buildMedia, validateAttachment, MAX_BYTES, PREFIX };
