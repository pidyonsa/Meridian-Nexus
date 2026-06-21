const port = process.argv[2];
const publish = process.argv.includes("--publish");
const verifyOnly = process.argv.includes("--verify-only");
const targets = [
  { client: "Agroserve", name: "Inventory Agroserve 17.06.2026.xlsx" },
  { client: "Anchor", name: "Inventory Anchor 17.06.2026.xlsx" },
  { client: "Aquelle", name: "Inventory aQuelle 17.06.2026.xlsx" },
  { client: "Aspen", name: "Inventory Aspen 17.06.2026.xlsx" },
  { client: "Lindt", name: "Inventory Lindt 17.06.2026.xlsx" }
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let pages = [];
for (let attempt = 0; attempt < 60; attempt += 1) {
  try {
    pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
    if (pages.some((candidate) => candidate.type === "page")) break;
  } catch {}
  await sleep(500);
}
const page = pages.find((candidate) => candidate.type === "page");
if (!page) throw new Error("No browser page was available.");
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
let id = 0;
const waiting = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !waiting.has(message.id)) return;
  const callbacks = waiting.get(message.id);
  waiting.delete(message.id);
  if (message.error) callbacks.reject(new Error(message.error.message)); else callbacks.resolve(message.result);
});
const command = (method, params = {}) => new Promise((resolve, reject) => {
  const requestId = ++id;
  waiting.set(requestId, { resolve, reject });
  socket.send(JSON.stringify({ id: requestId, method, params }));
});
await command("Runtime.enable");
await sleep(9000);
for (const target of verifyOnly ? [] : targets) {
  const metadataExpression = `(async () => {
    for (let attempt = 0; attempt < 40 && (!database || !storage); attempt += 1) await new Promise(r => setTimeout(r, 250));
    const query = await database.collection("files").where("name", "==", ${JSON.stringify(target.name)}).get();
    if (query.empty) throw new Error("Cloud source not found");
    const documents = query.docs.slice().sort((a, b) => (b.data().createdAt?.toMillis?.() || 0) - (a.data().createdAt?.toMillis?.() || 0));
    const metadata = documents[0].data();
    const url = await storage.ref(metadata.storagePath).getDownloadURL();
    return { name: metadata.name, size: metadata.size, type: metadata.type, url };
  })()`;
  const metadataResult = await command("Runtime.evaluate", { expression: metadataExpression, awaitPromise: true, returnByValue: true });
  if (metadataResult.exceptionDetails) throw new Error(`${target.client}: ${metadataResult.exceptionDetails.exception?.description || metadataResult.exceptionDetails.text}`);
  const metadata = metadataResult.result.value;
  const response = await fetch(metadata.url);
  if (!response.ok) throw new Error(`${target.client}: source download failed with ${response.status}`);
  const encoded = Buffer.from(await response.arrayBuffer()).toString("base64");
  const expression = `(async () => {
    const binary = atob(${JSON.stringify(encoded)});
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    const file = new File([bytes], ${JSON.stringify(metadata.name)}, { type: ${JSON.stringify(metadata.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")} });
    const parsed = await parseSourceFile(file);
    const calculated = buildSnapshot(parsed.rows, parsed.mapping, ${JSON.stringify(target.client)}, ${JSON.stringify(metadata.name)}, "inventory");
    if (${publish}) {
      state.pendingDataset = parsed;
      elements.adminClient.value = ${JSON.stringify(target.client)};
      elements.sourceType.value = "inventory";
      await publishPendingDataset();
      const saved = await database.collection("dashboardClients").doc(slugify(${JSON.stringify(target.client)})).get();
      if (!saved.exists || saved.data().dashboardType !== "inventory" || state.pendingDataset) throw new Error("Dashboard publication was not confirmed");
    }
    return { client: ${JSON.stringify(target.client)}, source: ${JSON.stringify(metadata.name)}, size: ${Number(metadata.size)}, rows: parsed.rows.length, sheet: parsed.sheetName, mapping: parsed.mapping, stock: calculated.totalStock, stores: calculated.stores, skus: calculated.skus, availability: calculated.availabilityRate, published: ${publish} };
  })()`;
  const evaluated = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (evaluated.exceptionDetails) throw new Error(`${target.client}: ${evaluated.exceptionDetails.exception?.description || evaluated.exceptionDetails.text}`);
  console.log(JSON.stringify(evaluated.result.value));
}
const verificationExpression = `(async () => {
  for (let attempt = 0; attempt < 40 && state.dashboardClients.length < ${targets.length}; attempt += 1) await new Promise(r => setTimeout(r, 250));
  const expected = ${JSON.stringify(targets.map((target) => target.client.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")))};
  const documents = await Promise.all(expected.map(async clientId => {
    const document = await database.collection("dashboardClients").doc(clientId).get();
    return { clientId, exists: document.exists, dashboardType: document.data()?.dashboardType, rowCount: document.data()?.rowCount };
  }));
  elements.dashboardTypeFilter.value = "inventory";
  elements.clientFilter.value = expected[0];
  renderDashboard();
  return {
    clientFilter: expected.every(clientId => [...elements.clientFilter.options].some(option => option.value === clientId)),
    dashboardTypeFilter: [...elements.dashboardTypeFilter.options].map(option => option.value),
    filteredStatus: elements.dataStatus.querySelector("strong").textContent,
    documents
  };
})()`;
const verification = await command("Runtime.evaluate", { expression: verificationExpression, awaitPromise: true, returnByValue: true });
if (verification.exceptionDetails) throw new Error(verification.exceptionDetails.exception?.description || verification.exceptionDetails.text);
console.log(JSON.stringify({ verification: verification.result.value }));
socket.close();
