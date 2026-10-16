(() => {
  let nexusSession = { signedIn: false, isAdmin: false, role: "" };
  const tools = [
    { view: "sales", label: "Sales dashboard", description: "Review current-month Geo Rep Capture orders by region, rep, store and product.", status: "Admin only", color: "#63c5ff", icon: "<path d=\"M4 20h16M7 16v-5m5 5V7m5 9v-8\"></path>" },
    { view: "attendance", label: "Call Cycle", description: "Review Syndicated and Dedicated Call Cycle data from verified workbook copies.", status: "Available", color: "#77d39d", icon: "<path d=\"M8 20v-8m4 8V4m4 16v-5m4 5V9\"></path>" },
    { view: "stockfix", label: "Stock Fix dashboard", description: "Review Stock Fix tasks, capture progress and issue classifications from SharePoint output data.", status: "Available", color: "#ffd36a", icon: "<path d=\"M4 7h16M6 7v12h12V7M9 11h6M9 15h4\"></path><path d=\"m17 4 3 3-3 3\"></path>" },
    { view: "automation", label: "Report automation", description: "Run, schedule and deliver verified report extractions.", status: "Available", color: "#8fd6a8", icon: "<path d=\"m13 2-9 12h7l-2 8 9-12h-7l2-8Z\"></path>" },
    { view: "admin", label: "Admin", description: "Manage extraction profile connections, extraction steps and secure access.", status: "Admin only", color: "#f2955c", icon: "<path d=\"M4 20h16M6 17V8l6-4 6 4v9M9 17v-5h6v5\"></path>" }
  ];

  const icon = (tool, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${tool.icon}</svg>`;

  function navigate(view) {
    window.parent.postMessage({ type: "meridian-nexus-navigation", view }, window.location.origin);
  }

  function makeMenuItem(tool) {
    const item = document.createElement("a");
    item.href = `/#${tool.view}`;
    item.target = "_top";
    item.className = "nx-nav nexus-bridge-menu";
    item.dataset.nexusBridge = tool.view;
    item.innerHTML = `${icon(tool)}<span style="flex:1;">${tool.label}</span><span style="width:7px;height:7px;border-radius:50%;background:${tool.color};"></span>`;
    item.addEventListener("click", () => navigate(tool.view));
    return item;
  }

  function makeModuleCard(tool) {
    const card = document.createElement("a");
    card.href = `/#${tool.view}`;
    card.target = "_top";
    card.className = "nx-opt link nexus-bridge-card";
    card.dataset.nexusBridgeCard = tool.view;
    card.style.cssText = "display:flex;flex-direction:column;padding:13px;border-radius:11px;background:rgba(8,22,44,.5);border:1px solid rgba(28,63,107,.8);cursor:pointer;";
    card.innerHTML = `<div style="display:flex;align-items:center;gap:11px;"><div style="width:38px;height:38px;display:grid;place-items:center;border-radius:10px;color:${tool.color};background:${tool.color}22;border:1px solid ${tool.color}55;">${icon(tool, 19)}</div><div style="font-size:14.5px;font-weight:600;color:#f3f7fc;">${tool.label}</div></div><div style="margin-top:10px;font-size:11.5px;line-height:1.45;color:#9dc4ec;">${tool.description}</div><span style="align-self:flex-start;margin-top:12px;padding:3px 10px;border-radius:20px;background:${tool.color}22;border:1px solid ${tool.color}55;font-size:10.5px;font-weight:700;color:${tool.color};">${tool.status}</span>`;
    card.addEventListener("click", () => navigate(tool.view));
    return card;
  }

  function addMenuItems() {
    const menuItem = document.querySelector(".nx-nav");
    const menu = menuItem?.parentElement;
    if (!menu || menu.querySelector("[data-nexus-bridge]")) return;
    tools.forEach((tool) => menu.append(makeMenuItem(tool)));
  }

  function addModuleCards() {
    const heading = [...document.querySelectorAll("h2")].find((item) => item.textContent.trim() === "Workspace Modules");
    const container = heading?.parentElement;
    const grid = [...(container?.children || [])].find((item) => item !== heading && item.style.display === "grid");
    if (!grid || grid.querySelector("[data-nexus-bridge-card]")) return;
    tools.forEach((tool) => grid.append(makeModuleCard(tool)));
  }

  function replaceExactText(from, to) {
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      if (node.nodeValue && node.nodeValue.trim() === from) node.nodeValue = node.nodeValue.replace(from, to);
    });
  }

  function syncLegacyAccessLabels() {
    if (!nexusSession.signedIn) return;
    const adminLabel = nexusSession.isAdmin ? "Admin access enabled" : "Ask an admin for access";
    const statusLabel = nexusSession.isAdmin ? "Available to admins" : "Restricted";
    replaceExactText("Restricted - admin only", adminLabel);
    replaceExactText("Admin only", statusLabel);
    const name = nexusSession.displayName || nexusSession.email || "";
    if (name) {
      replaceExactText("Meridian User", name);
      const initials = name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "M";
      replaceExactText("M", initials);
    }
  }

  function updateModuleCounts() {
    const moduleLabel = [...document.querySelectorAll("div")].find((item) => item.textContent.trim() === "Modules in Nexus");
    const availableLabel = [...document.querySelectorAll("div")].find((item) => item.textContent.trim() === "Available to use");
    if (moduleLabel?.previousElementSibling) moduleLabel.previousElementSibling.textContent = "12";
    if (availableLabel?.previousElementSibling) availableLabel.previousElementSibling.textContent = "7";
  }

  function enhancePortal() {
    addMenuItems();
    addModuleCards();
    updateModuleCounts();
    syncLegacyAccessLabels();
  }

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin || event.data?.type !== "meridian-nexus-session") return;
    nexusSession = {
      signedIn: event.data.signedIn === true,
      isAdmin: event.data.isAdmin === true || event.data.role === "admin",
      role: event.data.role || "",
      displayName: event.data.displayName || "",
      email: event.data.email || ""
    };
    enhancePortal();
  });

  window.parent.postMessage({ type: "meridian-nexus-portal-ready" }, window.location.origin);

  const observer = new MutationObserver(enhancePortal);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  enhancePortal();
})();
