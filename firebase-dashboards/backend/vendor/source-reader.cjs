'use strict';
module.exports = function({db,getStorage,ExcelJS,path,NoReportDataError}) {
async function readGeoRepAttendanceSource(file, tabName, temporaryDirectory, options = {}) {
  if (!file?.storagePath) throw new Error(`The ${tabName} export is not available in secure storage.`);
  const fileName = String(file.name || `${tabName}.xlsx`).replace(/[\\/#?%*:|"<>]/g, "_");
  const sourcePath = path.join(temporaryDirectory, fileName);
  await getStorage().bucket().file(file.storagePath).download({ destination: sourcePath });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(sourcePath);
  const expected = [...geoRepAttendanceContractForTab(tabName), "Brand"];
  const sourceContract = geoRepAttendanceSourceContracts[tabName];
  if (!sourceContract) throw new Error(`No Geo Rep Attendance source contract exists for ${tabName}.`);
  let candidate = null;
  for (const worksheet of workbook.worksheets) {
    const header = geoRepAttendanceSheetHeaders(worksheet);
    if (!header) continue;
    const matches = sourceContract.required.filter((name) => header.columns.has(geoRepAttendanceCanonicalHeader(name))).length;
    const preferred = String(worksheet.name || "").toLowerCase() === sourceContract.worksheet.toLowerCase();
    if (!candidate || matches > candidate.matches || (matches === candidate.matches && preferred && !candidate.preferred)) {
      candidate = { worksheet, header, matches, preferred };
    }
  }
  if (!candidate || candidate.matches !== sourceContract.required.length) {
    throw new Error(`The downloaded ${tabName} report does not contain the required raw-data columns. The tracker was not changed.`);
  }
  const rows = [];
  const sourceRowNumbers = [];
  for (let rowNumber = candidate.header.rowNumber + 1; rowNumber <= candidate.worksheet.rowCount; rowNumber += 1) {
    const row = candidate.worksheet.getRow(rowNumber);
    const values = expected.map((name) => {
      const configured = name === "Brand" ? ["Brand", "Brands", "Brand Name"].find(h => candidate.header.columns.has(geoRepAttendanceCanonicalHeader(h))) || null : Object.prototype.hasOwnProperty.call(sourceContract.fields, name) ? sourceContract.fields[name] : name;
      if (typeof configured === "function") return configured(row, candidate.header.columns);
      if (!configured) return "";
      return geoRepAttendanceTrackerValue(geoRepAttendanceCellValue(row.getCell(candidate.header.columns.get(geoRepAttendanceCanonicalHeader(configured))), name), name);
    });
    if (values.every((value) => value === "" || value == null)) continue;
    rows.push(values);
    sourceRowNumbers.push(rowNumber);
  }
  if (!rows.length) throw new NoReportDataError(`The downloaded ${tabName} report contains no raw rows for the selected date range.`);
  const roleIndex = expected.findIndex((name) => geoRepAttendanceCanonicalHeader(name) === "ROLE");
  const audience = options.roleGroup === "merchandiser" ? "merchandiser" : "rep";
  const selectedRows = roleIndex < 0 ? [] : rows.filter((values) => geoRepAttendanceRoleGroup(values[roleIndex]) === audience);
  if (!selectedRows.length) throw new NoReportDataError(`The downloaded ${tabName} report contains no ${geoRepAttendanceRoleDescription(audience)} for the selected date range.`);
  return {
    tabName,
    headers: expected,
    rows: selectedRows,
    allRows: rows,
    salesRepRows: selectedRows,
    sourceRowNumbers: sourceRowNumbers.filter((_, i) => roleIndex >= 0 && geoRepAttendanceRoleGroup(rows[i][roleIndex]) === audience),
    roleGroup: audience,
    sourceWorksheet: candidate.worksheet.name
  };
}

function geoRepAttendanceContractForTab(tabName) {
  const headers = geoRepAttendanceRawTabContracts[tabName];
  if (!headers) throw new Error(`Unsupported Geo Rep Attendance raw tab: ${tabName}.`);
  return headers;
}

const geoRepAttendanceRawTabContracts = {
  "Strike rate": [
    "User Name", "User Code", "Manager", "Role", "User Code2", "Assigned Region(s)",
    "Schedule Count (On Calander)", "On Leave Schedules", "Schedule Count (w/o Leave)",
    "On Schedule Checkins", "Strike Rate", "Total Checkins (include additional visits)",
    "Additional Visits", "All Forms", "Unique Visit Forms", "Orders", "Returns", "Division",
    "Users Combined Check"
  ],
  Schedules: [
    "Schedule Date", "Rep Name", "User Code", "Manager", "Role", "User Code2",
    "Assigned Region(s)", "Customer Name", "Result", "Division", "GeoRep Week", "Feedback"
  ]
};

const geoRepAttendanceSourceContracts = {
  "Strike rate": {
    worksheet: "Strike rate",
    required: [
      "User Name", "User Code", "Manager", "Role", "Assigned Region(s)", "Schedule Count",
      "On Leave Schedules", "Schedule Count (w/o Leave)", "On Schedule Checkins", "Strike Rate",
      "Total Checkins", "Additional Visits", "All Forms", "Unique Visit Forms", "Orders", "Returns"
    ],
    fields: {
      "User Code2": "User Code",
      "Schedule Count (On Calander)": "Schedule Count",
      "Total Checkins (include additional visits)": "Total Checkins",
      "Division": null,
      "Users Combined Check": (values, columns) => {
        const user = geoRepAttendanceCellValue(values.getCell(columns.get("USERNAME")), "User Name");
        const code = geoRepAttendanceCellValue(values.getCell(columns.get("USERCODE")), "User Code");
        return `${user || ""}${code || ""}`.trim();
      }
    }
  },
  Schedules: {
    // Geo Rep places the schedule-level detail on the second tab of the
    // Strike Rate export. The standalone Scheduled Attendance report is still
    // delivered, but has a different non-attendance layout and is not a raw
    // source for this tracker tab.
    worksheet: "Schedules",
    required: ["Schedule Date", "User", "User Code", "Manager", "Role", "Assigned Region(s)", "Customer Name", "Result"],
    fields: {
      "Rep Name": "User",
      "User Code2": "User Code",
      "Division": null,
      "GeoRep Week": null,
      "Feedback": null
    }
  }
};

function geoRepAttendanceCellValue(cell, headerName) {
  const value = cell?.value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (value && typeof value === "object" && value.result != null) return geoRepAttendanceCellValue({ value: value.result }, headerName);
  if (typeof value === "number" || typeof value === "boolean") {
    if (/date/i.test(headerName) && typeof value === "number" && value > 20000 && value < 100000) {
      const date = spreadsheetDate(value);
      return date ? date.toISOString().slice(0, 10) : value;
    }
    return value;
  }
  return spreadsheetCellText(cell);
}

function spreadsheetDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  // Excel workbooks often store date-only cells as serial numbers. Treating a
  // serial such as 46235 as a JavaScript date string produces year 46235 and
  // excludes otherwise valid submissions from their configured date window.
  if (typeof value === "number" && Number.isFinite(value) && value > 20_000 && value < 100_000) {
    return new Date(Date.UTC(1899, 11, 30) + Math.round(value * 86_400_000));
  }
  const textValue = String(value || "").trim();
  if (!textValue) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}(?:\s|T)/.test(textValue) ? textValue.replace(" ", "T") : textValue;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function spreadsheetCellText(cell) {
  if (!cell) return "";
  const value = cell.value;
  if (value == null) return "";
  if (typeof value === "object" && value.text != null) return String(value.text).trim();
  if (typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "result")) return String(value.result ?? "").trim();
  // Some workbooks contain explicitly-null blank cells. Reading cell.text for
  // those cells makes ExcelJS call null.toString(), so use the value directly.
  return String(cell.text ?? value).trim();
}

function text(value, name, max = 500) {
  const result = String(value || "").trim();
  if (!result || result.length > max) throw new HttpsError("invalid-argument", `${name} is required.`);
  return result;
}

function geoRepAttendanceSheetHeaders(worksheet, maxRows = 10) {
  for (let rowNumber = 1; rowNumber <= Math.min(worksheet.rowCount, maxRows); rowNumber += 1) {
    const columns = new Map();
    worksheet.getRow(rowNumber).eachCell({ includeEmpty: false }, (cell, column) => {
      const key = geoRepAttendanceCanonicalHeader(spreadsheetCellText(cell));
      if (key) columns.set(key, column);
    });
    if (columns.size) return { rowNumber, columns };
  }
  return null;
}

function geoRepAttendanceCanonicalHeader(value) {
  const key = normalizeSpreadsheetText(value);
  if (key === "SCHEDULECOUNTONCALENDAR" || key === "SCHEDULECOUNTONCALENDER") return "SCHEDULECOUNTONCALANDER";
  return key;
}

function normalizeSpreadsheetText(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function geoRepAttendanceTrackerValue(value, headerName) {
  // The Rep TNA formulas compare Schedules!A directly with the date headers on
  // the reporting tabs. Write an Excel serial, not a date string, so those
  // comparisons continue to work after the protected source rows are replaced.
  const header = geoRepAttendanceCanonicalHeader(headerName);
  if (header === "SCHEDULEDATE") {
    return geoRepAttendanceExcelDateSerial(value);
  }
  if (header === "ASSIGNEDREGIONS" || header === "REGION") return geoRepAttendanceNormalizeRegion(value);
  return value;
}

function geoRepAttendanceExcelDateSerial(value) {
  const date = spreadsheetDate(value);
  if (!date) return value;
  return Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - Date.UTC(1899, 11, 30)) / 86_400_000);
}

function geoRepAttendanceNormalizeRegion(value) {
  const raw = String(value || "").trim().replace(/\s+/g, " ");
  const key = normalizeSpreadsheetText(raw);
  if (key === "KWAZULUNATAL" || key === "KZN") return "Kwazulu Natal";
  if (key === "EASTLONDON") return "East London";
  if (key === "PORTELIZABETH") return "Port Elizabeth";
  if (key === "WESTERNCAPE") return "Western Cape";
  if (key === "NORTHWEST") return "North West";
  if (key === "FREESTATE") return "Free State";
  return raw;
}

function geoRepAttendanceRoleGroup(value) {
  const role = normalizeSpreadsheetText(value);
  if (!role) return "";
  if (role.includes("MERCHANDISER") || role.includes("MERCH")) return "merchandiser";
  if (role.includes("SALESREP") || role.includes("SEMIDEDICATEDSALESREP") || role.includes("TEAMLEADER")) return "rep";
  return "other";
}

function geoRepAttendanceRoleDescription(audience) {
  return audience === "merchandiser"
    ? "Merchandiser or In Car Merchandiser rows"
    : "Sales Rep, Semi-Dedicated Sales Rep, or Team Leader rows";
}

function geoRepAttendanceScheduleRowsAsObjects(source) {
  const rows = geoRepAttendanceSourceRowsAsObjects(source);
  const value = (row, names) => {
    const expected = new Set(names.map((name) => geoRepAttendanceCanonicalHeader(name)));
    const key = Object.keys(row).find((name) => expected.has(geoRepAttendanceCanonicalHeader(name)));
    return key ? row[key] : "";
  };
  return rows.map((row) => {
    const scheduleDate = value(row, ["Schedule Date"]);
    const result = String(value(row, ["Result"]) || "");
    const region = geoRepAttendanceNormalizeRegion(value(row, ["Assigned Region(s)", "Region"])) || "Unassigned";
    return {
      date: geoRepAttendanceIsoDate(scheduleDate),
      week: String(value(row, ["GeoRep Week"]) || "").trim() || geoRepAttendanceWeekLabel(scheduleDate),
      manager: String(value(row, ["Manager"]) || "Unassigned") || "Unassigned",
      userName: String(value(row, ["Rep Name", "User Name"]) || "Unassigned") || "Unassigned",
      userCode: String(value(row, ["User Code"]) || ""),
      role: String(value(row, ["Role"]) || "Unclassified") || "Unclassified",
      region,
      division: String(value(row, ["Division"]) || "").trim() || geoRepAttendanceDivisionValue(region) || "Unassigned",
      customer: String(value(row, ["Customer Name", "Store Name", "Customer"]) || ""),
      storeCode: String(value(row, ["Geo Rep Store Code", "Store Code", "Customer Code", "Customer No", "Diplomat Customer no", "Diplomat Store Code"]) || "").trim(),
      brand: String(value(row, ["Brand", "Brands", "Brand Name"]) || "").trim(),
      result,
      visited: /visited|completed|check.?in/i.test(result)
    };
  });
}

function geoRepAttendanceSourceRowsAsObjects(source) {
  const index = new Map(source.headers.map((name, position) => [geoRepAttendanceCanonicalHeader(name), position]));
  const value = (row, name) => row[index.get(geoRepAttendanceCanonicalHeader(name))] ?? "";
  return source.salesRepRows.map((row) => Object.fromEntries(source.headers.map((name) => [name, value(row, name)])));
}

function geoRepAttendanceIsoDate(value) {
  const date = spreadsheetDate(value);
  if (date) return date.toISOString().slice(0, 10);
  const textValue = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}/.test(textValue) ? textValue.slice(0, 10) : "";
}

function geoRepAttendanceWeekLabel(value) {
  const date = spreadsheetDate(value);
  if (!date) return "";
  const start = Date.UTC(2026, 3, 27);
  const current = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const days = Math.floor((current - start) / 86_400_000);
  return `Week ${(((Math.floor(days / 7) + 1) % 4) + 4) % 4 + 1}`;
}

function geoRepAttendanceDivisionValue(region) {
  const value = geoRepAttendanceNormalizeRegion(region);
  if (["Gauteng", "Mpumalanga", "Limpopo"].includes(value)) return "Inland";
  if (["East London", "Kwazulu Natal", "Port Elizabeth", "SWD", "Western Cape"].includes(value)) return "Coastal";
  if (["North West", "Free State"].includes(value)) return "Central";
  return "";
}

async function geoRepAttendanceStoreMasterEnrichment(audience, directory) {
  const configCollection = audience === "merchandiser" ? "geoRepMerchandiserAttendanceConfig" : "geoRepAttendanceConfig";
  const configDocument = await db.collection(configCollection).doc("current").get();
  const configuredId = optionalText(configDocument.data()?.storeMasterId, 80) || geoRepAttendanceStoreMasterId;
  const masterDocument = await db.collection("attendanceStoreMasters").doc(configuredId).get();
  if (!masterDocument.exists || !masterDocument.data()?.storagePath) return { master: null, byCode: new Map(), byName: new Map() };
  const master = masterDocument.data();
  const parsed = await readGeoRepSalesStoreMaster(master, directory);
  const byCode = new Map();
  const byName = new Map();
  parsed.entries.forEach((entry) => {
    if (entry.storeCode) byCode.set(salesDashboardNormalise(entry.storeCode), entry);
    if (entry.storeName) byName.set(salesDashboardNormalise(entry.storeName), entry);
  });
  return { master: { id: configuredId, name: master.name || master.sourceName || "Attendance Store Master", storeCount: parsed.entries.length, sheetName: parsed.sheetName }, byCode, byName };
}

function optionalText(value, max = 500) {
  return String(value || "").trim().slice(0, max);
}

const geoRepAttendanceStoreMasterId = "geo-rep-attendance-store-master";

async function readGeoRepSalesStoreMaster(master, directory) {
  const sourcePath = await downloadSalesDashboardWorkbook(master.storagePath, directory, master.sourceName || "geo-rep-orders-store-master.xlsx");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(sourcePath);
  let selected = null;
  workbook.worksheets.forEach((sheet) => {
    const candidate = salesDashboardSheetHeaders(sheet, (headers) => {
      const storeName = salesDashboardHeaderIndex(headers, ["Store Name", "Meridian Store Name", "Customer Name", "Customer"]);
      const storeCode = salesDashboardHeaderIndex(headers, ["Geo Rep Store Code", "Diplomat Customer no", "Store Code", "Customer Code", "Diplomat Store Code", "Meridian Store Code"]);
      const region = salesDashboardHeaderIndex(headers, ["Region", "Region Name"]);
      if (region < 0 || (storeName < 0 && storeCode < 0)) return null;
      return { score: 30 + (storeName >= 0 ? 10 : 0) + (storeCode >= 0 ? 10 : 0), storeName, storeCode, region,
        rep: salesDashboardHeaderIndex(headers, ["Rep", "Sales Rep", "Representative", "Merchandiser"]),
        client: salesDashboardHeaderIndex(headers, ["Client", "Client Name", "Customer Group"]),
        banner: salesDashboardHeaderIndex(headers, ["Banner", "Banner Name", "Retail Banner"]),
        channel: salesDashboardHeaderIndex(headers, ["Channel", "Channel Name", "Retail Channel"]),
        division: salesDashboardHeaderIndex(headers, ["Division", "Business Division"]) };
    });
    if (candidate && (!selected || candidate.score > selected.score)) selected = { sheet, ...candidate };
  });
  if (!selected) throw new Error("The Geo Rep Capture Orders Store Master needs a Region column and either Store Name or Store Code.");
  const entries = new Map();
  let sourceRows = 0;
  let excludedRows = 0;
  const duplicateKeys = new Set();
  selected.sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= selected.rowNumber) return;
    sourceRows += 1;
    const values = (row.values || []).slice(1);
    const storeName = salesDashboardCleanText(salesDashboardValue(values, selected.storeName));
    const storeCode = salesDashboardCleanText(salesDashboardValue(values, selected.storeCode), 120);
    const region = salesDashboardCleanText(salesDashboardValue(values, selected.region), 120);
    const rep = salesDashboardCleanText(salesDashboardValue(values, selected.rep), 160);
    const client = salesDashboardCleanText(salesDashboardValue(values, selected.client), 120);
    const banner = salesDashboardCleanText(salesDashboardValue(values, selected.banner), 120);
    const channel = salesDashboardCleanText(salesDashboardValue(values, selected.channel), 120);
    const division = salesDashboardCleanText(salesDashboardValue(values, selected.division), 120);
    if (!region || (!storeName && !storeCode)) {
      excludedRows += 1;
      return;
    }
    const entry = { storeName, storeCode, region, rep, client, banner, channel, division };
    if (storeCode) {
      const key = `code:${salesDashboardNormalise(storeCode)}`;
      if (entries.has(key)) duplicateKeys.add(key);
      entries.set(key, entry);
    }
    if (storeName) {
      const key = `name:${salesDashboardNormalise(storeName)}`;
      if (entries.has(key)) duplicateKeys.add(key);
      entries.set(key, entry);
    }
  });
  const uniqueEntries = [...new Map([...entries.values()].map((entry) => [`${entry.storeCode}|${entry.storeName}|${entry.region}`, entry])).values()];
  if (!uniqueEntries.length) throw new Error("The Geo Rep Capture Orders Store Master has no usable store and region rows.");
  return {
    entries: uniqueEntries,
    sheetName: selected.sheet.name,
    sourceRows,
    excludedRows,
    duplicateKeyCount: duplicateKeys.size
  };
}

async function downloadSalesDashboardWorkbook(storagePath, directory, filename) {
  const destination = path.join(directory, filename.replace(/[^a-z0-9._-]/gi, "_") || "source.xlsx");
  await getStorage().bucket().file(storagePath).download({ destination });
  return destination;
}

function salesDashboardSheetHeaders(sheet, matcher) {
  let best = null;
  for (let rowNumber = 1; rowNumber <= Math.min(sheet.rowCount, 30); rowNumber += 1) {
    const values = (sheet.getRow(rowNumber).values || []).slice(1).map((value) => String(value || "").trim());
    const candidate = matcher(values);
    if (candidate && (!best || candidate.score > best.score)) best = { ...candidate, rowNumber, headers: values };
  }
  return best;
}

function salesDashboardHeaderIndex(headers, aliases) {
  const wanted = aliases.map(salesDashboardNormalise);
  return headers.findIndex((header) => wanted.includes(salesDashboardNormalise(header)));
}

function salesDashboardNormalise(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function salesDashboardCleanText(value, max = 240) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function salesDashboardValue(values, index) {
  return index >= 0 ? values[index] : null;
}

function geoRepAttendanceEnrichScheduleRows(scheduleRows, enrichment) {
  const stats = { matchedByCode: 0, matchedByName: 0, unmatched: 0, bannerMapped: 0, channelMapped: 0 };
  const rows = (scheduleRows || []).map((row) => {
    const codeKey = row.storeCode ? salesDashboardNormalise(row.storeCode) : "";
    const nameKey = row.customer ? salesDashboardNormalise(row.customer) : "";
    const matched = (codeKey && enrichment.byCode.get(codeKey)) || (nameKey && enrichment.byName.get(nameKey)) || null;
    if (matched) {
      if (codeKey && enrichment.byCode.get(codeKey)) stats.matchedByCode += 1;
      else stats.matchedByName += 1;
    } else stats.unmatched += 1;
    const banner = String(matched?.banner || "").trim();
    const channel = String(matched?.channel || "").trim();
    if (banner) stats.bannerMapped += 1;
    if (channel) stats.channelMapped += 1;
    return {
      ...row,
      storeCode: row.storeCode || String(matched?.storeCode || "").trim(),
      storeName: row.customer || String(matched?.storeName || "").trim(),
      region: row.region === "Unassigned" ? (String(matched?.region || "").trim() || row.region) : row.region,
      division: String(matched?.division || "").trim() || row.division || geoRepAttendanceDivisionValue(row.region) || "Unassigned",
      banner: banner || "Unassigned",
      channel: channel || "Unassigned"
    };
  });
  return { rows, stats };
}
return {readGeoRepAttendanceSource,geoRepAttendanceScheduleRowsAsObjects,geoRepAttendanceStoreMasterEnrichment,geoRepAttendanceEnrichScheduleRows};
};
