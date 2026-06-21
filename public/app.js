const elements = {
  homeView: document.querySelector("#homeView"),
  filesView: document.querySelector("#filesView"),
  filesNav: document.querySelector("#filesNav"),
  installButton: document.querySelector("#installButton"),
  fileInput: document.querySelector("#fileInput"),
  uploadQueue: document.querySelector("#uploadQueue"),
  fileList: document.querySelector("#fileList"),
  fileSummary: document.querySelector("#fileSummary"),
  emptyState: document.querySelector("#emptyState"),
  listHeader: document.querySelector("#listHeader"),
  selectAll: document.querySelector("#selectAll"),
  downloadSelected: document.querySelector("#downloadSelected"),
  deleteSelected: document.querySelector("#deleteSelected"),
  deleteDialog: document.querySelector("#deleteDialog"),
  deleteDialogCopy: document.querySelector("#deleteDialogCopy"),
  toast: document.querySelector("#toast")
};

const state = {
  files: [],
  selected: new Set(),
  busy: false,
  uploadCount: 0
};

let deferredInstallPrompt = null;
let toastTimer = null;
let database = null;
let storage = null;

function showToast(message, isError = false) {
  elements.toast.textContent = message;
  elements.toast.classList.toggle("error", isError);
  elements.toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("visible"), 4400);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;"
  })[character]);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 1) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** unit);
  return `${value.toFixed(unit === 0 || value >= 10 ? 0 : 1)} ${units[unit]}`;
}

function formatDate(timestamp) {
  if (!timestamp) return "Just now";
  const date = typeof timestamp.toDate === "function" ? timestamp.toDate() : new Date(timestamp);
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function fileLabel(file) {
  const extension = file.name.includes(".") ? file.name.split(".").pop() : "file";
  return extension.slice(0, 4).toUpperCase();
}

function fileType(file) {
  return file.type || "Unknown file type";
}

function setViewFromHash() {
  const showFiles = window.location.hash === "#files";
  elements.homeView.hidden = showFiles;
  elements.filesView.hidden = !showFiles;
  elements.filesNav.classList.toggle("active", showFiles);
  elements.filesNav.setAttribute("aria-current", showFiles ? "page" : "false");
  document.title = showFiles ? "Files | Meridian Nexus" : "Meridian Nexus";
}

function renderFiles() {
  const existingIds = new Set(state.files.map((file) => file.id));
  state.selected.forEach((id) => { if (!existingIds.has(id)) state.selected.delete(id); });

  elements.fileList.innerHTML = state.files.map((file) => `
    <article class="file-row" data-file-id="${file.id}">
      <label class="checkbox-wrap">
        <input class="file-checkbox" type="checkbox" data-id="${file.id}" ${state.selected.has(file.id) ? "checked" : ""} />
        <span class="checkmark"></span><span class="sr-only">Select ${escapeHtml(file.name)}</span>
      </label>
      <div class="file-name-cell">
        <span class="file-type-icon">${escapeHtml(fileLabel(file))}</span>
        <span><strong title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</strong><small>${escapeHtml(fileType(file))}</small></span>
      </div>
      <span class="file-size">${formatBytes(file.size)}</span>
      <time class="file-date">${formatDate(file.createdAt)}</time>
      <button class="icon-button download-one" type="button" data-id="${file.id}" aria-label="Download ${escapeHtml(file.name)}" title="Download">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v12m0 0 5-5m-5 5-5-5M5 20h14" /></svg>
      </button>
    </article>
  `).join("");

  const count = state.files.length;
  elements.fileSummary.textContent = count === 1 ? "1 file" : `${count} files`;
  elements.emptyState.hidden = count > 0;
  elements.listHeader.hidden = count === 0;
  updateSelectionControls();
}

function updateSelectionControls() {
  const selectedCount = state.selected.size;
  const allSelected = state.files.length > 0 && selectedCount === state.files.length;
  elements.selectAll.checked = allSelected;
  elements.selectAll.indeterminate = selectedCount > 0 && !allSelected;
  elements.downloadSelected.disabled = selectedCount === 0 || state.busy;
  elements.deleteSelected.disabled = selectedCount === 0 || state.busy;
  elements.downloadSelected.querySelector("span").textContent = selectedCount ? `Download (${selectedCount})` : "Download selected";
  elements.deleteSelected.querySelector("span").textContent = selectedCount ? `Delete (${selectedCount})` : "Delete selected";
}

function createUploadItem(file) {
  const item = document.createElement("div");
  item.className = "upload-item";
  item.innerHTML = `<strong>${escapeHtml(file.name)}</strong><span>Preparing…</span><div class="progress-track"><div class="progress-bar"></div></div>`;
  elements.uploadQueue.append(item);
  elements.uploadQueue.hidden = false;
  state.uploadCount += 1;
  return item;
}

function finishUploadItem(item, message, failed = false) {
  const status = item.querySelector("span");
  status.textContent = message;
  if (failed) status.style.color = "#ff9d90";
  window.setTimeout(() => {
    item.remove();
    state.uploadCount -= 1;
    if (state.uploadCount === 0) elements.uploadQueue.hidden = true;
  }, failed ? 5000 : 1800);
}

function uniqueId() {
  return window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeStorageName(name) {
  const cleaned = name.replace(/[\\/]/g, "_").replace(/[\u0000-\u001f]/g, "").trim();
  return (cleaned || "unnamed-file").slice(-240);
}

function uploadFile(file) {
  return new Promise((resolve) => {
    const item = createUploadItem(file);
    const status = item.querySelector("span");
    const progress = item.querySelector(".progress-bar");
    const fileId = uniqueId();
    const storagePath = `uploads/${fileId}/${safeStorageName(file.name)}`;
    const reference = storage.ref(storagePath);
    const metadata = {
      contentType: file.type || "application/octet-stream",
      contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      customMetadata: { originalName: file.name, fileId }
    };
    const task = reference.put(file, metadata);

    task.on("state_changed", (snapshot) => {
      const percent = snapshot.totalBytes ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) : 0;
      progress.style.width = `${percent}%`;
      status.textContent = `${percent}% · ${formatBytes(snapshot.bytesTransferred)} of ${formatBytes(snapshot.totalBytes)}`;
    }, (error) => {
      finishUploadItem(item, "Upload failed", true);
      showToast(`${file.name}: ${friendlyError(error)}`, true);
      resolve(false);
    }, async () => {
      try {
        await database.collection("files").doc(fileId).set({
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
          storagePath,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        progress.style.width = "100%";
        finishUploadItem(item, "Uploaded");
        resolve(true);
      } catch (error) {
        await reference.delete().catch(() => {});
        finishUploadItem(item, "Could not save file record", true);
        showToast(`${file.name}: ${friendlyError(error)}`, true);
        resolve(false);
      }
    });
  });
}

async function uploadFiles(files) {
  if (!storage || !database) {
    showToast("File storage is not available. Refresh and try again.", true);
    return;
  }
  if (!files.length) return;
  elements.fileInput.disabled = true;
  const results = await Promise.all(files.map(uploadFile));
  elements.fileInput.disabled = false;
  elements.fileInput.value = "";
  const completed = results.filter(Boolean).length;
  if (completed) showToast(completed === 1 ? "File uploaded." : `${completed} files uploaded.`);
}

function friendlyError(error) {
  const code = error?.code || "";
  if (code.includes("unauthorized") || code.includes("permission-denied")) return "access is not permitted";
  if (code.includes("canceled")) return "upload cancelled";
  if (code.includes("quota")) return "storage quota exceeded";
  if (code.includes("network")) return "network connection lost";
  return error?.message || "an unexpected error occurred";
}

async function getDownloadUrl(file) {
  return storage.ref(file.storagePath).getDownloadURL();
}

function triggerDownload(url, index = 0) {
  window.setTimeout(() => {
    const frame = document.createElement("iframe");
    frame.hidden = true;
    frame.src = url;
    document.body.append(frame);
    window.setTimeout(() => frame.remove(), 120000);
  }, index * 350);
}

async function downloadFiles(files) {
  if (!files.length) return;
  state.busy = true;
  updateSelectionControls();
  try {
    const results = await Promise.allSettled(files.map(getDownloadUrl));
    const urls = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
    urls.forEach(triggerDownload);
    if (urls.length) showToast(urls.length === 1 ? "Download started." : `${urls.length} downloads started.`);
    if (urls.length !== files.length) showToast(`${files.length - urls.length} file downloads failed.`, true);
  } finally {
    state.busy = false;
    updateSelectionControls();
  }
}

async function deleteFiles(files) {
  state.busy = true;
  updateSelectionControls();
  const results = await Promise.allSettled(files.map(async (file) => {
    try {
      await storage.ref(file.storagePath).delete();
    } catch (error) {
      if (error?.code !== "storage/object-not-found") throw error;
    }
    await database.collection("files").doc(file.id).delete();
    state.selected.delete(file.id);
  }));
  const deleted = results.filter((result) => result.status === "fulfilled").length;
  const failed = results.length - deleted;
  state.busy = false;
  updateSelectionControls();
  if (deleted) showToast(deleted === 1 ? "File deleted." : `${deleted} files deleted.`);
  if (failed) showToast(`${failed} file${failed === 1 ? "" : "s"} could not be deleted.`, true);
}

function selectedFiles() {
  return state.files.filter((file) => state.selected.has(file.id));
}

function initialiseFirebase() {
  try {
    database = firebase.firestore();
    storage = firebase.storage();
    database.collection("files").onSnapshot((snapshot) => {
      state.files = snapshot.docs.map((document) => ({ id: document.id, ...document.data() })).sort((left, right) => {
        const leftTime = left.createdAt?.toMillis?.() || 0;
        const rightTime = right.createdAt?.toMillis?.() || 0;
        return rightTime - leftTime;
      });
      renderFiles();
    }, (error) => {
      elements.fileSummary.textContent = "Could not load files";
      elements.emptyState.hidden = false;
      elements.emptyState.querySelector("h3").textContent = "Files are unavailable";
      elements.emptyState.querySelector("p").textContent = friendlyError(error);
      showToast(`Could not load files: ${friendlyError(error)}`, true);
    });
  } catch (error) {
    elements.fileSummary.textContent = "Storage unavailable";
    showToast("Firebase could not be initialised.", true);
  }
}

elements.fileInput.addEventListener("change", () => uploadFiles([...elements.fileInput.files]));
elements.selectAll.addEventListener("change", () => {
  state.selected = elements.selectAll.checked ? new Set(state.files.map((file) => file.id)) : new Set();
  renderFiles();
});
elements.fileList.addEventListener("change", (event) => {
  if (!event.target.matches(".file-checkbox")) return;
  if (event.target.checked) state.selected.add(event.target.dataset.id);
  else state.selected.delete(event.target.dataset.id);
  updateSelectionControls();
});
elements.fileList.addEventListener("click", (event) => {
  const button = event.target.closest(".download-one");
  if (!button) return;
  const file = state.files.find((candidate) => candidate.id === button.dataset.id);
  if (file) downloadFiles([file]);
});
elements.downloadSelected.addEventListener("click", () => downloadFiles(selectedFiles()));
elements.deleteSelected.addEventListener("click", () => {
  const count = state.selected.size;
  elements.deleteDialogCopy.textContent = `${count} selected file${count === 1 ? "" : "s"} will be permanently removed. This action cannot be undone.`;
  elements.deleteDialog.showModal();
});
elements.deleteDialog.addEventListener("close", () => {
  if (elements.deleteDialog.returnValue === "default") deleteFiles(selectedFiles());
});

window.addEventListener("hashchange", setViewFromHash);
window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); deferredInstallPrompt = event; });
window.addEventListener("appinstalled", () => { deferredInstallPrompt = null; showToast("Meridian Nexus was installed successfully."); });
elements.installButton.addEventListener("click", async () => {
  if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true) {
    showToast("Meridian Nexus is already installed.");
  } else if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
  } else {
    showToast("Use your browser menu to install Meridian Nexus.");
  }
});

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch(() => {}));
setViewFromHash();
renderFiles();
window.addEventListener("load", initialiseFirebase, { once: true });
