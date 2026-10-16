const {once,fn} = require('./release-multi-admin.cjs');
function patch(app) {
  app = once(app,'users: "Rep Roster", stores: "Attendance by Store"','users: "Roster", stores: "Attendance by Store"');
  app = once(app,'  if (elements.attendanceWorkspaceKicker) elements.attendanceWorkspaceKicker.textContent = "Syndicated Attendance";',`  document.querySelectorAll('[data-attendance-source="geo"][data-attendance-page="users"] span').forEach(label => { label.textContent = state.attendanceDashboardAudience === "merchandiser" ? "Merchandiser Roster" : "Rep Roster"; });
  if (elements.attendanceWorkspaceKicker) elements.attendanceWorkspaceKicker.textContent = "Syndicated Attendance";`);
  app = once(app,'select("role", filters.roles || [], "Rep types")','select("role", filters.roles || [], context.audienceLabel === "Merchandiser" ? "Merchandiser types" : "Rep types")');
  app = app.replace(fn('attendancePgDivision'), `function attendancePgDivision(region) { return window.NexusAttendance.division(region); }`);
  app = once(app,'const weeklyRows = attendancePgRows(data?.scheduleAnalytics?.weekly || []);','const weeklyRows = attendancePgRows(data?.scheduleAnalytics?.weekly || [], "label", "scheduled", "attended");');
  app = once(app,'  if (container) container.innerHTML = data ? renderAttendancePgPage(buildGeoAttendancePgContext(data)) : `<section class="pg-source-page"><p class="history-empty">No Geo Rep Capture attendance is available yet.</p></section>`;',`  if (container && data?.analyticsVersion === 1) {
    const generation = nexusSessionGeneration;
    const audience = state.attendanceDashboardAudience;
    const filters = attendanceDashboardCurrentFilters();
    window.NexusAttendance.render(container, data, {
      page: state.attendanceCoveragePage, filters,
      filterBar: attendancePgFilterBar({ monthLabel: data.reportEndDate, filters: data.availableFilters, selectedFilters: filters, audienceLabel: data.audience === "merchandiser" ? "Merchandiser" : "Rep" }),
      request: payload => callFunction("getGeoRepAttendanceDashboard", { ...payload, export: true }),
      current: () => generation === nexusSessionGeneration && state.isOperator && state.attendanceDashboardData === data && JSON.stringify(filters) === JSON.stringify(attendanceDashboardCurrentFilters()) && state.attendanceDashboardAudience === audience && state.attendanceDashboardSource === "geo" && window.location.hash === "#attendance"
    });
  } else if (container) {
    container.onclick = null; container.onchange = null;
    container.innerHTML = data ? renderAttendancePgPage(buildGeoAttendancePgContext(data)) : '<section class="pg-source-page"><p class="history-empty">No Geo attendance is available yet.</p></section>';
  }`);
  const old = app.match(fn('loadAttendanceDashboard'))[0];
  let load = once(old,'  if (state.attendanceDashboardLoading) return;', '  if (state.attendanceDashboardLoading) { state.attendanceDashboardReloadRequested = true; return; }');
  load = once(load,'  try {',`  const audience = state.attendanceDashboardAudience;
  const filters = attendanceDashboardCurrentFilters();
  const current = () => generation === nexusSessionGeneration && state.attendanceDashboardSource === "geo" && audience === state.attendanceDashboardAudience && JSON.stringify(filters) === JSON.stringify(attendanceDashboardCurrentFilters());
  try {`);
  load = once(load,'      audience: state.attendanceDashboardAudience,\n      filters: attendanceDashboardCurrentFilters()\n    }, cachedDashboard(renderAttendanceDashboard, elements.attendanceDashboardStatus));\n    renderAttendanceDashboard(data);',`      audience, filters
    }, cachedDashboard(data => { if (current()) renderAttendanceDashboard(data); }, elements.attendanceDashboardStatus));
    if (!current()) return;
    renderAttendanceDashboard(data);`);
  load = once(load,'    if (generation !== nexusSessionGeneration || error.code === "cancelled") return;', '    if (!current() || error.code === "cancelled") return;');
  load = once(load,'      elements.attendanceDashboardRefresh.disabled = false;',`      elements.attendanceDashboardRefresh.disabled = false;
      if (state.attendanceDashboardReloadRequested) {
        state.attendanceDashboardReloadRequested = false;
        loadAttendanceDashboard();
      }`);
  app = once(app,old,load);
  app = once(app,'callFunction("getGeoRepAttendanceDashboard", { audience: "rep", filters: {} }, cachedDashboard(data => {','callFunction("getGeoRepAttendanceDashboard", { mode: "callcycle", audience: "rep", filters: {} }, cachedDashboard(data => {');
  // Source layout is retained. Add a filtered workbook export and use the real
  // division classification for both dedicated and syndicated Call Cycle.
  app = once(app,'  const records = sourceData.records || [];','  const records = (sourceData.records || []).map(row => ({ ...row, division: attendancePgDivision(row.region) === "UNASSIGNED" ? row.division : attendancePgDivision(row.region) }));');
  app = once(app,'  const stores = rows;','  state.callCycleExportRows = rows;\n  const stores = rows;');
  app = once(app,'  const regionalMaximum = Math.max(...region.map((item) => Number(item.value || 0)), 1);',`  const exportToolbar = document.createElement("div");
  exportToolbar.className = "callcycle-export-toolbar";
  exportToolbar.innerHTML = '<button type="button" data-callcycle-export><i class="ph ph-download-simple" aria-hidden="true"></i> Excel</button>';
  container.prepend(exportToolbar);
  const regionalMaximum = Math.max(...region.map((item) => Number(item.value || 0)), 1);`);
  // Non-overview pages return earlier; attach the same toolbar before that return.
  const early = app.split('\n').find(line=>line.includes('container.innerHTML = `${filterBar}${callCyclePageContent(state.callCyclePage,'));
  app = once(app,early,early+`\n    container.insertAdjacentHTML("afterbegin", '<div class="callcycle-export-toolbar"><button type="button" data-callcycle-export><i class="ph ph-download-simple" aria-hidden="true"></i> Excel</button></div>');`);
  app += `
document.querySelector("#attendanceCallCyclePanel")?.addEventListener("click", async event => {
  const button = event.target.closest("[data-callcycle-export]");
  if (!button || !state.isOperator) return;
  const generation = nexusSessionGeneration;
  const rows = structuredClone((state.callCycleExportRows || []).filter(row => state.callCyclePage !== "reps" || !state.callCycleSelectedRep || (row.rep || row.employeeId) === state.callCycleSelectedRep));
  const filters = structuredClone(dedicatedCallCycleFilters());
  const source = state.callCycleSource;
  button.disabled = true;
  try {
    await ensureSpreadsheetReader();
    if (generation !== nexusSessionGeneration) return;
    const workbook = XLSX.utils.book_new();
    const headers = ["Store code", "Store", "Rep", "Line / Channel Manager", "Division", "Region", "Channel", "Banner", "Frequency", "Planned calls", "Scheduled days", "Scheduled weeks"];
    const records = rows.map(r => [r.storeCode, r.store, r.rep, r.manager, r.division, r.region, r.channel, r.banner, r.frequency, Number(r.callsPerMonth || 0), Object.entries(r.weekdayVisits || {}).filter(([,v]) => Number(v)).map(([k]) => k).join(", "), Object.entries(r.smartSellWeeks || {}).filter(([,v]) => Number(v)).map(([k]) => k).join(", ")]);
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers, ...records]), "Call Cycle");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Source", source], ["Filters", JSON.stringify(filters)], ["Records", rows.length]]), "Selection");
    XLSX.writeFile(workbook, "Call-Cycle-" + source + ".xlsx");
  } catch (error) { if (generation === nexusSessionGeneration) showToast(friendlyError(error), true); }
  finally { button.disabled = false; }
});
`;
  return app;
}
module.exports = {patch};
