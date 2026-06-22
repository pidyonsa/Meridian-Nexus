const elements = {
  homeView: document.querySelector("#homeView"),
  adminPage: document.querySelector("#adminPage"),
  filesView: document.querySelector("#filesView"),
  filesNav: document.querySelector("#filesNav"),
  adminNav: document.querySelector("#adminNav"),
  filesDialog: document.querySelector("#filesDialog"),
  closeFilesDialog: document.querySelector("#closeFilesDialog"),
  closeAdminPage: document.querySelector("#closeAdminPage"),
  openAdminAction: document.querySelector("#openAdminAction"),
  installButton: document.querySelector("#installButton"),
  fileInput: document.querySelector("#fileInput"),
  dropZone: document.querySelector("#dropZone"),
  dropZoneTitle: document.querySelector("#dropZoneTitle"),
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
  toast: document.querySelector("#toast"),
  clientFilter: document.querySelector("#clientFilter"),
  dashboardTypeFilter: document.querySelector("#dashboardTypeFilter"),
  dataStatus: document.querySelector("#dataStatus"),
  dataStatusCopy: document.querySelector("#dataStatusCopy"),
  metricStock: document.querySelector("#metricStock"),
  metricStores: document.querySelector("#metricStores"),
  metricSkus: document.querySelector("#metricSkus"),
  metricAvailability: document.querySelector("#metricAvailability"),
  trendChart: document.querySelector("#trendChart"),
  stockDonut: document.querySelector("#stockDonut"),
  healthScore: document.querySelector("#healthScore"),
  healthyCount: document.querySelector("#healthyCount"),
  lowCount: document.querySelector("#lowCount"),
  outCount: document.querySelector("#outCount"),
  clientBars: document.querySelector("#clientBars"),
  riskTable: document.querySelector("#riskTable"),
  riskCount: document.querySelector("#riskCount"),
  adminClient: document.querySelector("#adminClient"),
  customClientField: document.querySelector("#customClientField"),
  customClient: document.querySelector("#customClient"),
  sourceType: document.querySelector("#sourceType"),
  adminFileInput: document.querySelector("#adminFileInput"),
  adminDropZone: document.querySelector("#adminDropZone"),
  adminDropTitle: document.querySelector("#adminDropTitle"),
  sourcePreview: document.querySelector("#sourcePreview"),
  publishDataset: document.querySelector("#publishDataset"),
  adminHistory: document.querySelector("#adminHistory"),
  extractionStatus: document.querySelector("#extractionStatus"), extractionStatusTitle: document.querySelector("#extractionStatusTitle"), extractionStatusCopy: document.querySelector("#extractionStatusCopy"),
  adminLogin: document.querySelector("#adminLogin"), adminLoginForm: document.querySelector("#adminLoginForm"), adminLoginEmail: document.querySelector("#adminLoginEmail"), adminLoginPassword: document.querySelector("#adminLoginPassword"),
  adminWorkspace: document.querySelector("#adminWorkspace"), adminSessionName: document.querySelector("#adminSessionName"), adminLogout: document.querySelector("#adminLogout"),
  retailerForm: document.querySelector("#retailerForm"), retailerId: document.querySelector("#retailerId"), retailerName: document.querySelector("#retailerName"), retailerWebAddress: document.querySelector("#retailerWebAddress"), retailerUsername: document.querySelector("#retailerUsername"), retailerPassword: document.querySelector("#retailerPassword"), retailerFormTitle: document.querySelector("#retailerFormTitle"), retailerList: document.querySelector("#retailerList"), newRetailer: document.querySelector("#newRetailer"), deleteRetailer: document.querySelector("#deleteRetailer"),
  extractionSteps: document.querySelector("#extractionSteps"), addExtractionStep: document.querySelector("#addExtractionStep"), runRetailer: document.querySelector("#runRetailer"), runExtraction: document.querySelector("#runExtraction"),
  adminUserForm: document.querySelector("#adminUserForm"), adminUserId: document.querySelector("#adminUserId"), adminUserName: document.querySelector("#adminUserName"), adminUserSurname: document.querySelector("#adminUserSurname"), adminUserEmail: document.querySelector("#adminUserEmail"), adminUserPassword: document.querySelector("#adminUserPassword"), adminUserDisabled: document.querySelector("#adminUserDisabled"), adminUserFormTitle: document.querySelector("#adminUserFormTitle"), adminUserList: document.querySelector("#adminUserList"), newAdminUser: document.querySelector("#newAdminUser"), deleteAdminUser: document.querySelector("#deleteAdminUser")
};

const state = {
  files: [],
  selected: new Set(),
  busy: false,
  uploadCount: 0,
  dashboardClients: [],
  dashboardUploads: [],
  retailers: [],
  adminUsers: [],
  extractionSteps: [],
  pendingDataset: null
};

let deferredInstallPrompt = null;
let toastTimer = null;
let database = null;
let storage = null;
let auth = null;
let cloudFunctions = null;
let adminUnsubscribers = [];
let dragDepth = 0;
let adminDragDepth = 0;

const CLIENTS = ["Agroserve","Alpen","Anchor","Aquelle","Aspen","Butterfly","Cape Cookies","Davidoff","Duracell","Dynamic Brands","Ethica","Lindt","Magalies","Penflex","PMI","Racefoods","SCJ","Sir Fruit","Sodastream","SOIL","Wilmar"];
const DASHBOARD_TYPES = { inventory: "Inventory", sales: "Sales" };

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
  const showAdmin = window.location.hash === "#admin";
  elements.homeView.hidden = showAdmin;
  elements.adminPage.hidden = !showAdmin;
  if (showFiles && !elements.filesDialog.open) elements.filesDialog.showModal();
  if (!showFiles && elements.filesDialog.open) elements.filesDialog.close();
  elements.filesNav.classList.toggle("active", showFiles);
  elements.filesNav.setAttribute("aria-expanded", String(showFiles));
  elements.adminNav.classList.toggle("active", showAdmin);
  document.title = showFiles ? "Files | Meridian Nexus" : showAdmin ? "Admin | Meridian Nexus" : "Meridian Nexus";
}

function openFilesWorkspace() {
  if (!elements.filesDialog.open) elements.filesDialog.showModal();
  elements.filesNav.classList.add("active");
  elements.filesNav.setAttribute("aria-expanded", "true");
  document.title = "Files | Meridian Nexus";
  if (window.location.hash !== "#files") window.location.hash = "files";
}

function closeFilesWorkspace() {
  if (elements.filesDialog.open) elements.filesDialog.close();
  if (window.location.hash === "#files") {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#home`);
  }
  elements.filesNav.classList.remove("active");
  elements.filesNav.setAttribute("aria-expanded", "false");
  document.title = "Meridian Nexus";
}

function openAdminWorkspace() {
  if (window.location.hash !== "#admin") window.location.hash = "admin";
  else setViewFromHash();
}

function closeAdminWorkspace() {
  if (window.location.hash === "#admin") window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#home`);
  setViewFromHash();
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
  item.innerHTML = `<strong>${escapeHtml(file.name)}</strong><span>Preparing...</span><div class="progress-track"><div class="progress-bar"></div></div>`;
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
      status.textContent = `${percent}% - ${formatBytes(snapshot.bytesTransferred)} of ${formatBytes(snapshot.totalBytes)}`;
    }, (error) => {
      finishUploadItem(item, "Upload failed", true);
      showToast(`${file.name}: ${friendlyError(error)}`, true);
      resolve(false);
    }, async () => {
      try {
        const uploadedSize = Number(task.snapshot.metadata.size);
        if (!Number.isFinite(uploadedSize) || uploadedSize !== file.size) {
          throw new Error(`Upload verification failed: expected ${file.size} bytes, Storage received ${uploadedSize} bytes.`);
        }
        await database.collection("files").doc(fileId).set({
          name: file.name,
          size: uploadedSize,
          type: file.type || "application/octet-stream",
          storagePath,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        progress.style.width = "100%";
        finishUploadItem(item, "Uploaded");
        resolve(true);
      } catch (error) {
        await reference.delete().catch(() => {});
        finishUploadItem(item, "Upload verification failed", true);
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
  const uploadableFiles = files.filter((file) => file instanceof File && file.size > 0);
  const skippedCount = files.length - uploadableFiles.length;
  if (!uploadableFiles.length) {
    showToast("No file content was found. Drop a folder again to upload the files inside it.", true);
    return;
  }
  if (skippedCount) showToast(`${skippedCount} empty folder placeholder${skippedCount === 1 ? " was" : "s were"} skipped.`);
  elements.fileInput.disabled = true;
  const results = new Array(uploadableFiles.length);
  let nextFileIndex = 0;
  const workerCount = Math.min(3, uploadableFiles.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextFileIndex < uploadableFiles.length) {
      const index = nextFileIndex;
      nextFileIndex += 1;
      results[index] = await uploadFile(uploadableFiles[index]);
    }
  }));
  elements.fileInput.disabled = false;
  elements.fileInput.value = "";
  const completed = results.filter(Boolean).length;
  if (completed) showToast(completed === 1 ? "File uploaded." : `${completed} files uploaded.`);
}

function containsFiles(event) {
  return [...(event.dataTransfer?.types || [])].includes("Files");
}

function setDropZoneActive(active) {
  elements.dropZone.classList.toggle("is-dragging", active);
  elements.dropZoneTitle.textContent = active ? "Release to upload files" : "Drag and drop files or folders here";
}

function fileFromEntry(entry) {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

function entriesFromReader(reader) {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

async function filesFromEntry(entry) {
  if (entry.isFile) return [await fileFromEntry(entry)];
  if (!entry.isDirectory) return [];
  const reader = entry.createReader();
  const entries = [];
  let batch = [];
  do {
    batch = await entriesFromReader(reader);
    entries.push(...batch);
  } while (batch.length);
  const nestedFiles = await Promise.all(entries.map(filesFromEntry));
  return nestedFiles.flat();
}

async function filesFromDrop(dataTransfer) {
  const items = [...(dataTransfer?.items || [])].filter((item) => item.kind === "file");
  const entries = items.map((item) => item.webkitGetAsEntry?.()).filter(Boolean);
  if (entries.length) {
    const nestedFiles = await Promise.all(entries.map(filesFromEntry));
    return nestedFiles.flat();
  }
  return [...(dataTransfer?.files || [])];
}

function openFilePicker() {
  if (!elements.fileInput.disabled) elements.fileInput.click();
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

function slugify(value) {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "client";
}

function numberValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function compactNumber(value) {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(Number(value) || 0);
}

function normalHeader(value) {
  return String(value).toLowerCase().replace(/[_\-/]+/g, " ").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

const FIELD_ALIASES = {
  date: ["date","week","period","report date","inventory date","sales date","week ending","month"],
  store: ["store","store name","site","outlet","branch","customer name","location"],
  sku: ["sku","product","product code","item","item code","barcode","material","description","product name"],
  stock: ["stock","inventory","soh","stock on hand","quantity","qty","units","closing stock","current stock"],
  sales: ["sales","sales value","revenue","turnover","net sales","sales units","units sold"],
  cover: ["days cover","weeks cover","cover","woc","stock cover"]
};

function detectColumns(headers) {
  const normalized = headers.map((header) => ({ original: header, value: normalHeader(header) }));
  return Object.fromEntries(Object.entries(FIELD_ALIASES).map(([field, aliases]) => {
    const exact = normalized.find((header) => aliases.includes(header.value));
    const partial = normalized.find((header) => aliases.some((alias) => header.value.includes(alias) || alias.includes(header.value)));
    return [field, (exact || partial)?.original || null];
  }));
}

function parseDateValue(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value;
  if (typeof value === "number" && window.XLSX?.SSF) {
    const parts = XLSX.SSF.parse_date_code(value);
    if (parts) return new Date(parts.y, parts.m - 1, parts.d);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function periodLabel(value, index) {
  const date = parseDateValue(value);
  if (!date) return `Period ${index + 1}`;
  return new Intl.DateTimeFormat(undefined, { month: "short", year: "2-digit" }).format(date);
}

function buildSnapshot(rows, mapping, clientName, sourceName, dashboardType = "inventory") {
  const stores = new Set();
  const skus = new Set();
  const periodTotals = new Map();
  const risks = new Map();
  let totalStock = 0;
  let totalSales = 0;
  let healthy = 0;
  let low = 0;
  let out = 0;
  rows.forEach((row, index) => {
    const store = (String(row[mapping.store] ?? "Unknown store").trim() || "Unknown store").slice(0, 160);
    const sku = (String(row[mapping.sku] ?? "Unknown product").trim() || "Unknown product").slice(0, 200);
    const stock = mapping.stock ? numberValue(row[mapping.stock]) : 0;
    const sales = mapping.sales ? numberValue(row[mapping.sales]) : 0;
    const cover = mapping.cover ? numberValue(row[mapping.cover]) : null;
    const date = mapping.date ? parseDateValue(row[mapping.date]) : null;
    const periodKey = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` : `row-${Math.floor(index / Math.max(1, Math.ceil(rows.length / 8)))}`;
    stores.add(store);
    skus.add(sku);
    totalStock += stock;
    totalSales += sales;
    periodTotals.set(periodKey, (periodTotals.get(periodKey) || 0) + (mapping.stock ? stock : sales));
    let status = "healthy";
    if (stock <= 0 && mapping.stock) { out += 1; status = "out"; }
    else if (mapping.stock && ((cover !== null && cover > 0 && cover <= 2) || stock <= 10)) { low += 1; status = "low"; }
    else healthy += 1;
    if (status !== "healthy") {
      const key = `${store}||${sku}`;
      const existing = risks.get(key) || { store, sku, stock: 0, status };
      existing.stock += stock;
      if (status === "out") existing.status = "out";
      risks.set(key, existing);
    }
  });
  const observations = Math.max(1, healthy + low + out);
  const trend = [...periodTotals.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([key, value], index) => ({ label: key.startsWith("row-") ? periodLabel(null, index) : periodLabel(`${key}-01`, index), value: Math.round(value * 100) / 100 }));
  const topRisks = [...risks.values()].sort((a, b) => (a.status === b.status ? a.stock - b.stock : a.status === "out" ? -1 : 1)).slice(0, 20).map((risk) => ({ ...risk, stock: Math.round(risk.stock * 100) / 100 }));
  return {
    clientId: slugify(clientName), clientName, dashboardType, sourceName, rowCount: rows.length,
    totalStock: Math.round(totalStock * 100) / 100, totalSales: Math.round(totalSales * 100) / 100,
    stores: stores.size, skus: skus.size, availabilityRate: Math.round(((healthy + low) / observations) * 1000) / 10,
    stockHealth: { healthy, low, out }, trend, topRisks
  };
}

async function parseSourceFile(file) {
  if (!window.XLSX) throw new Error("Spreadsheet reader did not load. Check the connection and refresh.");
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!["xlsx","xls","xlsb","csv"].includes(extension)) throw new Error("Admin accepts Excel or CSV source files.");
  if (file.size > 250 * 1024 * 1024) throw new Error("This browser-based dashboard source is limited to 250 MB. Split larger datasets into client periods.");
  elements.adminDropTitle.textContent = "Reading and validating source...";
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("The workbook has no worksheets.");
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null, raw: true });
  if (!rows.length) throw new Error("The first worksheet contains no data rows.");
  const headers = Object.keys(rows[0]);
  const mapping = detectColumns(headers);
  if (!mapping.stock && !mapping.sales) throw new Error("No stock, quantity, sales or revenue column could be identified.");
  return { file, rows, mapping, sheetName };
}

function selectedClientName() {
  return elements.adminClient.value === "__new" ? elements.customClient.value.trim() : elements.adminClient.value;
}

function dashboardTypeFor(dataset) {
  if (elements.sourceType.value !== "auto") return elements.sourceType.value;
  return dataset?.mapping.stock ? "inventory" : "sales";
}

function dashboardTypeOf(snapshot) {
  return DASHBOARD_TYPES[snapshot.dashboardType] ? snapshot.dashboardType : "inventory";
}

function dashboardDocumentId(clientId, dashboardType) {
  return dashboardType === "inventory" ? clientId : `${clientId}--${dashboardType}`;
}

function renderSourcePreview() {
  const pending = state.pendingDataset;
  if (!pending) { elements.sourcePreview.hidden = true; elements.publishDataset.disabled = true; return; }
  const mappings = Object.entries(pending.mapping).filter(([, value]) => value);
  const dashboardType = dashboardTypeFor(pending);
  elements.sourcePreview.innerHTML = `<div class="preview-title"><strong>${escapeHtml(pending.file.name)}</strong><span>${pending.rows.length.toLocaleString()} rows - ${escapeHtml(pending.sheetName)} - ${DASHBOARD_TYPES[dashboardType]} dashboard</span></div><div class="mapping-grid">${mappings.map(([field, column]) => `<span>${escapeHtml(field)}<strong>${escapeHtml(column)}</strong></span>`).join("")}</div>${!pending.mapping.store || !pending.mapping.sku ? `<p class="preview-warning">Some location or product fields were not detected. The dashboard will group missing values as unknown.</p>` : ""}`;
  elements.sourcePreview.hidden = false;
  elements.publishDataset.disabled = !selectedClientName();
}

async function chooseAdminFile(file) {
  if (!file) return;
  state.pendingDataset = null;
  renderSourcePreview();
  try {
    state.pendingDataset = await parseSourceFile(file);
    elements.adminDropTitle.textContent = "Source ready to publish";
    renderSourcePreview();
  } catch (error) {
    elements.adminDropTitle.textContent = "Drop a source file here";
    showToast(friendlyError(error), true);
  }
}

function aggregateSnapshots(snapshots) {
  const combined = { totalStock: 0, totalSales: 0, stores: 0, skus: 0, availabilityRate: 0, stockHealth: { healthy: 0, low: 0, out: 0 }, trend: [], topRisks: [] };
  const periods = new Map();
  let weightedAvailability = 0;
  let totalRows = 0;
  snapshots.forEach((item) => {
    combined.totalStock += numberValue(item.totalStock); combined.totalSales += numberValue(item.totalSales); combined.stores += numberValue(item.stores); combined.skus += numberValue(item.skus);
    const rows = numberValue(item.rowCount); totalRows += rows; weightedAvailability += numberValue(item.availabilityRate) * rows;
    ["healthy","low","out"].forEach((key) => { combined.stockHealth[key] += numberValue(item.stockHealth?.[key]); });
    (item.trend || []).forEach((point) => periods.set(point.label, (periods.get(point.label) || 0) + numberValue(point.value)));
    combined.topRisks.push(...(item.topRisks || []).map((risk) => ({ ...risk, clientName: item.clientName })));
  });
  combined.availabilityRate = totalRows ? weightedAvailability / totalRows : 0;
  combined.trend = [...periods.entries()].slice(-12).map(([label, value]) => ({ label, value }));
  combined.topRisks = combined.topRisks.slice(0, 20);
  return combined;
}

function renderTrend(points) {
  if (!points?.length) { elements.trendChart.innerHTML = `<div class="chart-empty">Upload source data to build the trend.</div>`; return; }
  const width = 760, height = 240, padX = 36, padY = 22;
  const values = points.map((point) => numberValue(point.value));
  const max = Math.max(...values, 1), min = Math.min(...values, 0), range = Math.max(1, max - min);
  const coords = points.map((point, index) => ({ x: padX + (index * (width - padX * 2) / Math.max(1, points.length - 1)), y: padY + ((max - numberValue(point.value)) / range) * (height - padY * 2), ...point }));
  const line = coords.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${padX},${height - padY} ${line} ${coords.at(-1).x},${height - padY}`;
  elements.trendChart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Stock trend"><defs><linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8a18" stop-opacity=".28"/><stop offset="1" stop-color="#ff8a18" stop-opacity="0"/></linearGradient></defs>${[0,1,2,3].map((lineIndex) => `<line class="chart-grid" x1="${padX}" y1="${padY + lineIndex * 60}" x2="${width - padX}" y2="${padY + lineIndex * 60}"/>`).join("")}<polygon class="chart-area" points="${area}"/><polyline class="chart-line" points="${line}"/>${coords.map((point, index) => `<circle class="chart-point" cx="${point.x}" cy="${point.y}" r="4"><title>${escapeHtml(point.label)}: ${numberValue(point.value).toLocaleString()}</title></circle>${(index === 0 || index === coords.length - 1 || coords.length < 7) ? `<text class="chart-label" x="${point.x}" y="${height - 4}" text-anchor="middle">${escapeHtml(point.label)}</text>` : ""}`).join("")}</svg>`;
}

function renderDashboard() {
  const selectedClient = elements.clientFilter.value || "all";
  const selectedType = elements.dashboardTypeFilter.value || "all";
  const visible = state.dashboardClients.filter((dashboard) =>
    (selectedClient === "all" || dashboard.clientId === selectedClient)
    && (selectedType === "all" || dashboardTypeOf(dashboard) === selectedType)
  );
  const data = aggregateSnapshots(visible);
  const hasData = visible.length > 0;
  elements.metricStock.textContent = hasData ? compactNumber(data.totalStock) : "--";
  elements.metricStores.textContent = hasData ? data.stores.toLocaleString() : "--";
  elements.metricSkus.textContent = hasData ? data.skus.toLocaleString() : "--";
  elements.metricAvailability.textContent = hasData ? `${data.availabilityRate.toFixed(1)}%` : "--";
  elements.dataStatus.className = `data-status ${hasData ? "ready" : "empty"}`;
  elements.dataStatus.querySelector("strong").textContent = hasData ? `${visible.length} client dashboard${visible.length === 1 ? "" : "s"} live` : "No dashboard data yet";
  elements.dataStatusCopy.textContent = hasData ? `Updated from ${visible.reduce((sum, item) => sum + numberValue(item.rowCount), 0).toLocaleString()} source rows` : "Open Admin to publish the first Excel or CSV source.";
  renderTrend(data.trend);
  const healthTotal = data.stockHealth.healthy + data.stockHealth.low + data.stockHealth.out;
  const healthyPercent = healthTotal ? (data.stockHealth.healthy / healthTotal) * 100 : 0;
  const lowPercent = healthTotal ? (data.stockHealth.low / healthTotal) * 100 : 0;
  elements.stockDonut.style.background = healthTotal ? `conic-gradient(#37c983 0 ${healthyPercent}%,#ffad26 ${healthyPercent}% ${healthyPercent + lowPercent}%,#f15e55 ${healthyPercent + lowPercent}% 100%)` : "conic-gradient(#284b69 0 100%)";
  elements.healthScore.textContent = healthTotal ? `${Math.round(healthyPercent)}%` : "--";
  elements.healthyCount.textContent = data.stockHealth.healthy.toLocaleString(); elements.lowCount.textContent = data.stockHealth.low.toLocaleString(); elements.outCount.textContent = data.stockHealth.out.toLocaleString();
  elements.clientBars.innerHTML = visible.length ? visible.slice().sort((a,b) => numberValue(b.availabilityRate) - numberValue(a.availabilityRate)).slice(0,8).map((client) => `<div class="client-bar"><span title="${escapeHtml(client.clientName)} - ${DASHBOARD_TYPES[dashboardTypeOf(client)]}">${escapeHtml(client.clientName)}</span><div class="client-bar-track"><i style="width:${Math.max(2,Math.min(100,numberValue(client.availabilityRate)))}%"></i></div><strong>${numberValue(client.availabilityRate).toFixed(0)}%</strong></div>`).join("") : `<div class="chart-empty">No client dashboards match these filters.</div>`;
  elements.riskCount.textContent = `${data.topRisks.length} item${data.topRisks.length === 1 ? "" : "s"}`;
  elements.riskTable.innerHTML = data.topRisks.length ? data.topRisks.slice(0,8).map((risk) => `<tr><td>${escapeHtml(risk.store)}</td><td title="${escapeHtml(risk.sku)}">${escapeHtml(risk.sku)}</td><td>${numberValue(risk.stock).toLocaleString()}</td><td><span class="status-pill ${risk.status === "low" ? "low" : ""}">${risk.status === "low" ? "Low stock" : "Out of stock"}</span></td></tr>`).join("") : `<tr><td colspan="4" class="table-empty">${hasData ? "No priority exceptions in this view." : "No source data published."}</td></tr>`;
}

function renderClientOptions() {
  const current = elements.clientFilter.value;
  const clients = [...new Map(state.dashboardClients.map((client) => [client.clientId, client.clientName])).entries()];
  elements.clientFilter.innerHTML = `<option value="all">All clients</option>${clients.map(([clientId, clientName]) => `<option value="${escapeHtml(clientId)}">${escapeHtml(clientName)}</option>`).join("")}`;
  if ([...elements.clientFilter.options].some((option) => option.value === current)) elements.clientFilter.value = current;
  const names = [...new Set([...CLIENTS, ...state.dashboardClients.map((client) => client.clientName)])].sort((a,b) => a.localeCompare(b));
  const adminCurrent = elements.adminClient.value;
  elements.adminClient.innerHTML = `${names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}<option value="__new">+ Add a new client</option>`;
  if ([...elements.adminClient.options].some((option) => option.value === adminCurrent)) elements.adminClient.value = adminCurrent;
  renderDashboard();
}

function renderAdminHistory() {
  elements.adminHistory.innerHTML = state.dashboardUploads.length ? state.dashboardUploads.slice(0,12).map((upload) => `<article class="history-item"><strong title="${escapeHtml(upload.sourceName)}">${escapeHtml(upload.sourceName)}</strong><span class="history-client">${escapeHtml(upload.clientName)} - ${DASHBOARD_TYPES[upload.dashboardType || upload.sourceType] || "Inventory"}</span><span>${numberValue(upload.rowCount).toLocaleString()} rows - ${formatBytes(numberValue(upload.size))} - ${formatDate(upload.createdAt)}</span></article>`).join("") : `<p class="history-empty">No dashboard sources published yet.</p>`;
}

async function publishPendingDataset() {
  const pending = state.pendingDataset;
  const clientName = selectedClientName();
  if (!pending || !clientName || !database || !storage) return;
  elements.publishDataset.disabled = true;
  elements.publishDataset.querySelector("span").textContent = "Publishing dashboard...";
  const uploadId = uniqueId();
  const clientId = slugify(clientName);
  const dashboardType = dashboardTypeFor(pending);
  const dashboardId = dashboardDocumentId(clientId, dashboardType);
  const storagePath = `dashboard-source/${clientId}/${uploadId}/${safeStorageName(pending.file.name)}`;
  const reference = storage.ref(storagePath);
  try {
    const snapshot = buildSnapshot(pending.rows, pending.mapping, clientName, pending.file.name, dashboardType);
    const uploadTask = reference.put(pending.file, { contentType: pending.file.type || "application/octet-stream", customMetadata: { clientId, dashboardType } });
    await new Promise((resolve, reject) => uploadTask.on("state_changed", (progress) => {
      const percent = progress.totalBytes ? Math.round(progress.bytesTransferred / progress.totalBytes * 100) : 0;
      elements.publishDataset.querySelector("small").textContent = `Uploading source - ${percent}%`;
    }, reject, resolve));
    if (Number(uploadTask.snapshot.metadata.size) !== pending.file.size) throw new Error("The uploaded source size could not be verified.");
    const batch = database.batch();
    batch.set(database.collection("dashboardClients").doc(dashboardId), { ...snapshot, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    batch.set(database.collection("dashboardUploads").doc(uploadId), { clientId, clientName, dashboardType, sourceName: pending.file.name, size: pending.file.size, rowCount: pending.rows.length, storagePath, status: "published", createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    await batch.commit();
    state.pendingDataset = null; elements.adminFileInput.value = ""; elements.adminDropTitle.textContent = "Drop another source file here"; renderSourcePreview();
    showToast(`${clientName} dashboard published from ${pending.rows.length.toLocaleString()} rows.`);
  } catch (error) {
    await reference.delete().catch(() => {});
    showToast(`Dashboard publish failed: ${friendlyError(error)}`, true);
  } finally {
    elements.publishDataset.querySelector("span").textContent = "Publish client dashboard";
    elements.publishDataset.querySelector("small").textContent = "Source and calculated snapshot will be saved";
    elements.publishDataset.disabled = !state.pendingDataset || !selectedClientName();
  }
}

const STEP_ACTIONS = {
  navigate: "Open web address", fillUsername: "Enter username", fillPassword: "Enter password",
  click: "Click element", waitFor: "Wait for element", wait: "Wait seconds", select: "Select option", download: "Click to download"
};

function newStep(action = "click") {
  return { id: uniqueId(), action, selector: "", value: "" };
}

function renderExtractionSteps() {
  elements.extractionSteps.innerHTML = state.extractionSteps.length ? state.extractionSteps.map((step, index) => `<div class="extraction-step" draggable="true" data-step-id="${escapeHtml(step.id)}"><span class="step-number">${String(index + 1).padStart(2,"0")}</span><span class="drag-handle" title="Drag to reorder">&#8942;&#8942;</span><select class="step-action" aria-label="Step ${index + 1} action">${Object.entries(STEP_ACTIONS).map(([value,label]) => `<option value="${value}" ${step.action === value ? "selected" : ""}>${label}</option>`).join("")}</select><input class="step-selector" value="${escapeHtml(step.selector)}" placeholder="CSS selector (for example #login)" aria-label="Step ${index + 1} selector"/><input class="step-value" value="${escapeHtml(step.value)}" placeholder="URL, seconds or option value" aria-label="Step ${index + 1} value"/><button class="remove-step" type="button" title="Delete step" aria-label="Delete step ${index + 1}">&times;</button></div>`).join("") : `<p class="history-empty">Add the first step for this extraction.</p>`;
}

function readStepsFromEditor() {
  state.extractionSteps = [...elements.extractionSteps.querySelectorAll(".extraction-step")].map((row) => ({ id: row.dataset.stepId, action: row.querySelector(".step-action").value, selector: row.querySelector(".step-selector").value.trim(), value: row.querySelector(".step-value").value.trim() }));
  return state.extractionSteps;
}

function resetRetailerForm() {
  elements.retailerForm.reset(); elements.retailerId.value = ""; elements.retailerFormTitle.textContent = "Add retailer extraction"; elements.deleteRetailer.hidden = true;
  state.extractionSteps = [newStep("navigate"), newStep("fillUsername"), newStep("fillPassword"), newStep("click"), newStep("download")];
  renderExtractionSteps();
}

function editRetailer(id) {
  const retailer = state.retailers.find((item) => item.id === id); if (!retailer) return;
  elements.retailerId.value = retailer.id; elements.retailerName.value = retailer.name; elements.retailerWebAddress.value = retailer.webAddress; elements.retailerUsername.value = retailer.username; elements.retailerPassword.value = ""; elements.retailerFormTitle.textContent = retailer.extractionName; elements.deleteRetailer.hidden = false;
  state.extractionSteps = (retailer.steps || []).map((step) => ({ ...step })); renderExtractionSteps();
  elements.retailerList.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.id === id));
}

function renderRetailers() {
  elements.retailerList.innerHTML = state.retailers.length ? state.retailers.map((item) => `<button type="button" data-id="${escapeHtml(item.id)}"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.extractionName || `${item.name} + Sales extraction`)} - ${(item.steps || []).length} steps</small></button>`).join("") : `<p class="history-empty">No retailers configured.</p>`;
  const current = elements.runRetailer.value;
  elements.runRetailer.innerHTML = state.retailers.length ? state.retailers.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.extractionName)}</option>`).join("") : `<option value="">No extraction available</option>`;
  if (state.retailers.some((item) => item.id === current)) elements.runRetailer.value = current;
  elements.runExtraction.disabled = !state.retailers.length;
}

function resetAdminUserForm() {
  elements.adminUserForm.reset(); elements.adminUserId.value = ""; elements.adminUserFormTitle.textContent = "Create admin user"; elements.deleteAdminUser.hidden = true;
}

function editAdminUser(uid) {
  const user = state.adminUsers.find((item) => item.uid === uid); if (!user) return;
  elements.adminUserId.value = uid; elements.adminUserName.value = user.name; elements.adminUserSurname.value = user.surname; elements.adminUserEmail.value = user.email; elements.adminUserPassword.value = ""; elements.adminUserDisabled.checked = user.disabled === true; elements.adminUserFormTitle.textContent = `${user.name} ${user.surname}`; elements.deleteAdminUser.hidden = uid === auth.currentUser?.uid;
}

function renderAdminUsers() {
  elements.adminUserList.innerHTML = state.adminUsers.length ? state.adminUsers.map((user) => `<button type="button" data-id="${escapeHtml(user.uid)}"><strong>${escapeHtml(user.name)} ${escapeHtml(user.surname)}</strong><small>${escapeHtml(user.email)}${user.disabled ? " - Disabled" : ""}</small></button>`).join("") : `<p class="history-empty">No administrators found.</p>`;
}

async function callFunction(name, data) {
  const result = await cloudFunctions.httpsCallable(name)(data);
  return result.data;
}

function clearAdminSubscriptions() { adminUnsubscribers.forEach((unsubscribe) => unsubscribe()); adminUnsubscribers = []; }

function subscribeAdminData() {
  clearAdminSubscriptions();
  adminUnsubscribers.push(database.collection("retailers").onSnapshot((snapshot) => { state.retailers = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a,b) => a.name.localeCompare(b.name)); renderRetailers(); }));
  adminUnsubscribers.push(database.collection("adminUsers").onSnapshot((snapshot) => { state.adminUsers = snapshot.docs.map((doc) => doc.data()).sort((a,b) => a.email.localeCompare(b.email)); renderAdminUsers(); }));
}

function renderExtractionRun(run) {
  if (!run) { elements.extractionStatus.hidden = true; return; }
  elements.extractionStatus.hidden = false; elements.extractionStatus.className = `extraction-status ${run.status}`;
  elements.extractionStatusTitle.textContent = run.status === "completed" ? "Extraction complete" : run.status === "failed" ? "Extraction failed" : `Extracting ${run.retailerName || "retailer"} file`;
  elements.extractionStatusCopy.textContent = run.message || "Preparing extraction...";
  if (["completed","failed"].includes(run.status)) window.setTimeout(() => { elements.extractionStatus.hidden = true; }, 12000);
}

async function configureAdminSession(user) {
  if (!user) { clearAdminSubscriptions(); elements.adminLogin.hidden = false; elements.adminWorkspace.hidden = true; return; }
  const token = await user.getIdTokenResult(true);
  if (token.claims.admin !== true) { await auth.signOut(); showToast("This account is not authorised for Nexus Admin.", true); return; }
  elements.adminLogin.hidden = true; elements.adminWorkspace.hidden = false; elements.adminSessionName.textContent = user.displayName || user.email; subscribeAdminData();
}

function initialiseFirebase() {
  try {
    database = firebase.firestore();
    storage = firebase.storage();
    auth = firebase.auth();
    cloudFunctions = firebase.app().functions("us-central1");
    auth.onAuthStateChanged((user) => configureAdminSession(user).catch((error) => showToast(friendlyError(error), true)));
    storage.setMaxUploadRetryTime(24 * 60 * 60 * 1000);
    storage.setMaxOperationRetryTime(10 * 60 * 1000);
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
    database.collection("dashboardClients").onSnapshot((snapshot) => {
      state.dashboardClients = snapshot.docs.map((document) => ({ id: document.id, ...document.data() })).sort((a,b) => String(a.clientName).localeCompare(String(b.clientName)));
      renderClientOptions();
    }, (error) => {
      elements.dataStatus.className = "data-status empty";
      elements.dataStatus.querySelector("strong").textContent = "Dashboard data unavailable";
      elements.dataStatusCopy.textContent = friendlyError(error);
    });
    database.collection("dashboardUploads").onSnapshot((snapshot) => {
      state.dashboardUploads = snapshot.docs.map((document) => ({ id: document.id, ...document.data() })).sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      renderAdminHistory();
    });
    database.collection("extractionRuns").orderBy("createdAt", "desc").limit(1).onSnapshot((snapshot) => renderExtractionRun(snapshot.empty ? null : snapshot.docs[0].data()));
  } catch (error) {
    elements.fileSummary.textContent = "Storage unavailable";
    showToast("Firebase could not be initialised.", true);
  }
}

elements.adminClient.innerHTML = `${CLIENTS.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")}<option value="__new">+ Add a new client</option>`;
elements.adminNav.addEventListener("click", openAdminWorkspace);
elements.openAdminAction.addEventListener("click", openAdminWorkspace);
elements.closeAdminPage.addEventListener("click", closeAdminWorkspace);
elements.adminLoginForm.addEventListener("submit", async (event) => { event.preventDefault(); try { await auth.signInWithEmailAndPassword(elements.adminLoginEmail.value.trim(), elements.adminLoginPassword.value); elements.adminLoginPassword.value = ""; } catch (error) { showToast(`Sign in failed: ${friendlyError(error)}`, true); } });
elements.adminLogout.addEventListener("click", () => auth.signOut());
document.querySelectorAll("[data-admin-tab]").forEach((button) => button.addEventListener("click", () => { document.querySelectorAll("[data-admin-tab]").forEach((item) => item.classList.toggle("active", item === button)); document.querySelectorAll("[data-admin-panel]").forEach((panel) => { const active = panel.dataset.adminPanel === button.dataset.adminTab; panel.classList.toggle("active", active); panel.hidden = !active; }); }));
elements.newRetailer.addEventListener("click", resetRetailerForm);
elements.addExtractionStep.addEventListener("click", () => { readStepsFromEditor(); state.extractionSteps.push(newStep()); renderExtractionSteps(); });
elements.extractionSteps.addEventListener("input", readStepsFromEditor);
elements.extractionSteps.addEventListener("click", (event) => { const button = event.target.closest(".remove-step"); if (!button) return; readStepsFromEditor(); const id = button.closest(".extraction-step").dataset.stepId; state.extractionSteps = state.extractionSteps.filter((step) => step.id !== id); renderExtractionSteps(); });
let draggedStepId = null;
elements.extractionSteps.addEventListener("dragstart", (event) => { const row = event.target.closest(".extraction-step"); if (!row) return; readStepsFromEditor(); draggedStepId = row.dataset.stepId; row.classList.add("dragging"); event.dataTransfer.effectAllowed = "move"; });
elements.extractionSteps.addEventListener("dragend", (event) => { event.target.closest(".extraction-step")?.classList.remove("dragging"); draggedStepId = null; });
elements.extractionSteps.addEventListener("dragover", (event) => { event.preventDefault(); const target = event.target.closest(".extraction-step"); if (!target || target.dataset.stepId === draggedStepId) return; const from = state.extractionSteps.findIndex((step) => step.id === draggedStepId), to = state.extractionSteps.findIndex((step) => step.id === target.dataset.stepId); const [moved] = state.extractionSteps.splice(from, 1); state.extractionSteps.splice(to, 0, moved); renderExtractionSteps(); });
elements.retailerList.addEventListener("click", (event) => { const button = event.target.closest("button[data-id]"); if (button) editRetailer(button.dataset.id); });
elements.retailerForm.addEventListener("submit", async (event) => { event.preventDefault(); const submit = event.submitter; submit.disabled = true; try { const result = await callFunction("saveRetailer", { id: elements.retailerId.value, name: elements.retailerName.value, webAddress: elements.retailerWebAddress.value, username: elements.retailerUsername.value, password: elements.retailerPassword.value, steps: readStepsFromEditor() }); elements.retailerId.value = result.id; elements.retailerPassword.value = ""; elements.deleteRetailer.hidden = false; showToast("Retailer and sales extraction saved."); } catch (error) { showToast(friendlyError(error), true); } finally { submit.disabled = false; } });
elements.deleteRetailer.addEventListener("click", async () => { if (!elements.retailerId.value || !window.confirm("Delete this retailer and its encrypted login credentials?")) return; try { await callFunction("deleteRetailer", { id: elements.retailerId.value }); resetRetailerForm(); showToast("Retailer deleted."); } catch (error) { showToast(friendlyError(error), true); } });
elements.runExtraction.addEventListener("click", async () => { elements.runExtraction.disabled = true; try { await callFunction("startExtraction", { retailerId: elements.runRetailer.value }); closeAdminWorkspace(); showToast("Retailer extraction queued."); } catch (error) { showToast(friendlyError(error), true); } finally { elements.runExtraction.disabled = !state.retailers.length; } });
elements.newAdminUser.addEventListener("click", resetAdminUserForm);
elements.adminUserList.addEventListener("click", (event) => { const button = event.target.closest("button[data-id]"); if (button) editAdminUser(button.dataset.id); });
elements.adminUserForm.addEventListener("submit", async (event) => { event.preventDefault(); const submit = event.submitter; submit.disabled = true; try { const result = await callFunction("saveAdminUser", { uid: elements.adminUserId.value, name: elements.adminUserName.value, surname: elements.adminUserSurname.value, email: elements.adminUserEmail.value, password: elements.adminUserPassword.value, disabled: elements.adminUserDisabled.checked }); elements.adminUserId.value = result.uid; elements.adminUserPassword.value = ""; elements.deleteAdminUser.hidden = result.uid === auth.currentUser?.uid; showToast("Administrator updated in Firebase Authentication and Nexus."); } catch (error) { showToast(friendlyError(error), true); } finally { submit.disabled = false; } });
elements.deleteAdminUser.addEventListener("click", async () => { if (!elements.adminUserId.value || !window.confirm("Permanently delete this administrator?")) return; try { await callFunction("deleteAdminUser", { uid: elements.adminUserId.value }); resetAdminUserForm(); showToast("Administrator deleted."); } catch (error) { showToast(friendlyError(error), true); } });
elements.clientFilter.addEventListener("change", renderDashboard);
elements.dashboardTypeFilter.addEventListener("change", renderDashboard);
elements.adminClient.addEventListener("change", () => {
  elements.customClientField.hidden = elements.adminClient.value !== "__new";
  renderSourcePreview();
  if (!elements.customClientField.hidden) elements.customClient.focus();
});
elements.customClient.addEventListener("input", renderSourcePreview);
elements.sourceType.addEventListener("change", renderSourcePreview);
elements.adminFileInput.addEventListener("change", () => chooseAdminFile(elements.adminFileInput.files[0]));
elements.adminDropZone.addEventListener("click", () => elements.adminFileInput.click());
elements.adminDropZone.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); elements.adminFileInput.click(); } });
elements.adminDropZone.addEventListener("dragenter", (event) => { if (!containsFiles(event)) return; event.preventDefault(); adminDragDepth += 1; elements.adminDropZone.classList.add("is-dragging"); elements.adminDropTitle.textContent = "Release to analyse source"; });
elements.adminDropZone.addEventListener("dragover", (event) => { if (!containsFiles(event)) return; event.preventDefault(); event.dataTransfer.dropEffect = "copy"; });
elements.adminDropZone.addEventListener("dragleave", (event) => { if (!containsFiles(event)) return; adminDragDepth = Math.max(0, adminDragDepth - 1); if (!adminDragDepth) { elements.adminDropZone.classList.remove("is-dragging"); elements.adminDropTitle.textContent = state.pendingDataset ? "Source ready to publish" : "Drop a source file here"; } });
elements.adminDropZone.addEventListener("drop", (event) => { event.preventDefault(); adminDragDepth = 0; elements.adminDropZone.classList.remove("is-dragging"); chooseAdminFile(event.dataTransfer.files[0]); });
elements.publishDataset.addEventListener("click", publishPendingDataset);

elements.fileInput.addEventListener("change", () => uploadFiles([...elements.fileInput.files]));
elements.dropZone.addEventListener("click", openFilePicker);
elements.dropZone.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  openFilePicker();
});
elements.dropZone.addEventListener("dragenter", (event) => {
  if (!containsFiles(event)) return;
  event.preventDefault();
  dragDepth += 1;
  setDropZoneActive(true);
});
elements.dropZone.addEventListener("dragover", (event) => {
  if (!containsFiles(event)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
});
elements.dropZone.addEventListener("dragleave", (event) => {
  if (!containsFiles(event)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) setDropZoneActive(false);
});
elements.dropZone.addEventListener("drop", async (event) => {
  event.preventDefault();
  dragDepth = 0;
  setDropZoneActive(false);
  try {
    const files = await filesFromDrop(event.dataTransfer);
    if (files.length) await uploadFiles(files);
    else showToast("The dropped folder does not contain any files.", true);
  } catch (error) {
    showToast(`Could not read the dropped folder: ${friendlyError(error)}`, true);
  }
});
document.addEventListener("dragover", (event) => {
  if ((elements.filesDialog.open || !elements.adminPage.hidden) && containsFiles(event)) event.preventDefault();
});
document.addEventListener("drop", (event) => {
  if (elements.filesDialog.open && containsFiles(event) && !event.target.closest("#dropZone")) {
    event.preventDefault();
    showToast("Drop files inside the highlighted upload area.");
  }
  if (!elements.adminPage.hidden && containsFiles(event) && !event.target.closest("#adminDropZone")) {
    event.preventDefault();
    showToast("Drop the spreadsheet inside the Admin source area.");
  }
});
elements.filesNav.addEventListener("click", openFilesWorkspace);
elements.closeFilesDialog.addEventListener("click", closeFilesWorkspace);
elements.filesDialog.addEventListener("close", () => {
  if (window.location.hash === "#files") closeFilesWorkspace();
});
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

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").then((registration) => registration.update()).catch(() => {});
  });
}
setViewFromHash();
renderFiles();
renderClientOptions();
resetRetailerForm();
resetAdminUserForm();
renderAdminHistory();
window.addEventListener("load", initialiseFirebase, { once: true });
