"use strict";

const crypto = require("node:crypto");
const FILTERS = ["region", "rep", "manager", "storeName", "product", "status", "client", "banner", "channel", "brand", "category", "currency"];
const EXCEPTIONS = {unmapped: r => !r.mapped, missingRep: r => r.rep === "Unassigned", missingOrderNumber: r => !r.orderNumber, missingValues: r => r.value === null, missingUnits: r => r.quantity === null, cancelled: r => r.cancelled};
const text = (value, max = 240) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const number = value => value !== null && value !== "" && value !== undefined && Number.isFinite(Number(value)) ? Number(value) : null;
const iso = value => value?.toDate?.().toISOString() || (typeof value === "string" ? value : null);
const money = value => Math.round((value + Number.EPSILON) * 100) / 100;
const orderKey = row => crypto.createHash("sha256").update(JSON.stringify([row.storeCode || row.storeName, row.orderNumber])).digest("hex").slice(0, 24);

function date(value) {
  const source = text(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(source)) return null;
  const parsed = new Date(`${source}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === source ? source : null;
}

function selection(input, latestPeriod, HttpsError) {
  const validPeriod = /^\d{4}-(0[1-9]|1[0-2])$/.test(latestPeriod || "");
  const period = validPeriod ? latestPeriod : new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit" }).format(new Date()).replace("/", "-");
  const start = input.start === undefined ? `${period}-01` : date(input.start);
  const end = input.end === undefined ? new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0)).toISOString().slice(0, 10) : date(input.end);
  if (!start || !end || start > end || new Date(end) - new Date(start) > 366 * 86400000) throw new HttpsError("invalid-argument", "Choose a valid date range of no more than 12 months.");
  const filters = {};
  for (const key of FILTERS) {
    if (input.filters?.[key] !== undefined && typeof input.filters[key] !== "string") throw new HttpsError("invalid-argument", "Filter values must be text.");
    filters[key] = text(input.filters?.[key]);
  }
  const page = input.page === undefined ? 1 : Number(input.page);
  if (!Number.isSafeInteger(page) || page < 1 || page > 600) throw new HttpsError("invalid-argument", "Choose a valid results page.");
  const sort = input.sort || "newest";
  if (!["newest", "oldest", "value", "quantity"].includes(sort)) throw new HttpsError("invalid-argument", "Choose a valid sort order.");
  const granularity = input.granularity || "auto", exception = input.exception || "", missingFilter = input.missingFilter || "";
  if (!["auto", "day", "week", "month"].includes(granularity)) throw new HttpsError("invalid-argument", "Choose daily, weekly or monthly activity.");
  if (typeof exception !== "string" || (exception && !Object.hasOwn(EXCEPTIONS, exception))) throw new HttpsError("invalid-argument", "Choose a valid source exception.");
  if (input.exceptions !== undefined && (!Array.isArray(input.exceptions) || input.exceptions.length > 6 || input.exceptions.some(key => typeof key !== "string" || !Object.hasOwn(EXCEPTIONS,key)))) throw new HttpsError("invalid-argument", "Choose valid source exceptions.");
  const exceptions = [...new Set([...(input.exceptions || []),...(exception ? [exception] : [])])];
  if (missingFilter && !FILTERS.includes(missingFilter)) throw new HttpsError("invalid-argument", "Choose a valid missing field.");
  if (input.missingFilters !== undefined && (!Array.isArray(input.missingFilters) || input.missingFilters.length > FILTERS.length || input.missingFilters.some(key => !FILTERS.includes(key)))) throw new HttpsError("invalid-argument", "Choose valid missing fields.");
  const missingFilters = [...new Set([...(input.missingFilters || []),...(missingFilter ? [missingFilter] : [])])];
  return { start, end, filters, page, sort, granularity, exceptions, missingFilters, query: text(input.query, 120).toLowerCase(), includeCancelled: input.includeCancelled === true || exceptions.includes("cancelled"), export: input.export === true, orderKey: text(input.orderKey, 24) };
}

function normalise(document) {
  const data = document.data();
  const row = { id: document.id, orderDate: date(data.orderDate), orderNumber: text(data.orderNumber, 160), storeCode: text(data.storeCode, 120), sku: text(data.sku, 160), poNumber: text(data.poNumber, 160), quantity: number(data.quantity), value: number(data.value), unitPrice: number(data.unitPrice), mapped: data.mapped === true, importedAt: iso(data.importedAt), source: data.sourceSystem === "geo-rep-open-api" ? "Geo Rep Open API" : "Geo Rep Transaction Report" };
  for (const key of FILTERS) row[key] = text(data[key]);
  row.currency = /^[A-Z]{3}$/.test(row.currency) ? row.currency : "Not supplied";
  row.region ||= "Unmapped"; row.rep ||= "Unassigned"; row.manager ||= "Unassigned"; row.status ||= "Unspecified";
  row.cancelled = /^(cancelled|canceled|void|voided)$/i.test(row.status);
  row.orderKey = row.orderNumber ? orderKey(row) : "";
  return row;
}

function metrics(rows) {
  const knownCurrency = new Set(rows.map(r => r.currency));
  const amount = knownCurrency.size <= 1 && rows.every(r => r.value !== null) ? money(rows.reduce((s, r) => s + r.value, 0)) : null;
  const orders = new Set(rows.map(r => r.orderKey).filter(Boolean)).size;
  return { amount, orders, units: rows.every(r => r.quantity !== null) ? rows.reduce((s, r) => s + r.quantity, 0) : null, lines: rows.length, stores: new Set(rows.map(r => r.storeCode || r.storeName).filter(Boolean)).size, reps: new Set(rows.map(r => r.rep).filter(r => r !== "Unassigned")).size, averageOrder: amount !== null && orders && rows.every(r => r.orderKey) ? money(amount / orders) : null, currency: knownCurrency.size === 1 ? [...knownCurrency][0] : knownCurrency.size ? "Mixed currencies" : "Not supplied" };
}

function groups(rows, key) {
  const grouped = new Map();
  for (const row of rows) {
    const value = row[key] || "";
    if (!grouped.has(value)) grouped.set(value, []);
    grouped.get(value).push(row);
  }
  return [...grouped].map(([value, group]) => ({ label: value || "Not supplied", missing: !value, ...metrics(group) })).sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0) || b.lines - a.lines || a.label.localeCompare(b.label));
}

function activity(rows, granularity, selected) {
  const bucket = value => {
    if (granularity === "month") return value.slice(0, 7);
    if (granularity !== "week") return value;
    const day = new Date(`${value}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
    return day.toISOString().slice(0, 10);
  };
  return groups(rows.map(r => ({...r, bucket: bucket(r.orderDate)})), "bucket").sort((a,b) => a.label.localeCompare(b.label)).map(row => {
    const start = row.label.length === 7 ? `${row.label}-01` : row.label;
    const endDate = new Date(`${start}T00:00:00Z`);
    if (granularity === "month") endDate.setUTCMonth(endDate.getUTCMonth() + 1, 0);
    if (granularity === "week") endDate.setUTCDate(endDate.getUTCDate() + 6);
    const end = endDate.toISOString().slice(0, 10);
    return {...row, start: start < selected.start ? selected.start : start, end: end > selected.end ? selected.end : end};
  });
}

function report(rows, selected, latestPeriod) {
  const inRange = rows.filter(r => r.orderDate && r.orderDate >= selected.start && r.orderDate <= selected.end);
  const options = Object.fromEntries(FILTERS.map(key => [key, [...new Set(inRange.map(r => r[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b))]));
  const filtered = inRange.filter(row => FILTERS.every(key => !selected.filters[key] || row[key] === selected.filters[key]) && (selected.missingFilters || []).every(key => !row[key]) && (selected.exceptions || []).every(key => EXCEPTIONS[key](row)) && (!selected.query || [row.orderNumber,row.poNumber,row.storeName,row.storeCode,row.product,row.sku,row.rep].join(" ").toLowerCase().includes(selected.query)) && (!selected.orderKey || row.orderKey === selected.orderKey));
  const cancelled = filtered.filter(r => r.cancelled);
  const visible = selected.includeCancelled ? filtered : filtered.filter(r => !r.cancelled);
  const totals = metrics(visible);
  const by = Object.fromEntries(["region", "product", "storeName", "rep", "status", "manager"].map(key => [key, groups(visible, key)]));
  const trendKey = selected.granularity && selected.granularity !== "auto" ? selected.granularity : new Date(selected.end) - new Date(selected.start) <= 62 * 86400000 ? "day" : "month";
  const dailyTrend = activity(visible, "day", selected);
  const trend = trendKey === "day" ? dailyTrend : activity(visible, trendKey, selected);
  const warnings = [];
  if (totals.currency === "Not supplied" && visible.length) warnings.push("Currency is not supplied by the imported ledger. Amounts are shown without a currency symbol.");
  if (totals.currency === "Mixed currencies") warnings.push("Select one currency to calculate comparable order amounts.");
  if (!inRange.some(r => r.client || r.banner || r.channel)) warnings.push("Franchise classification is not supplied. This report includes the available Geo Rep orders, not a verified franchise-only subset.");
  const invalidDates = rows.filter(r => !r.orderDate).length;
  const missingValues = visible.filter(r => r.value === null).length;
  if (invalidDates) warnings.push(`${invalidDates} ledger lines have invalid dates and are excluded.`);
  if (missingValues) warnings.push(`${missingValues} lines have no recorded amount; amount totals are unavailable.`);
  const latestImport = rows.map(r => r.importedAt).filter(Boolean).sort().at(-1) || null;
  if (latestImport && Date.now() - new Date(latestImport) > 48 * 3600000) warnings.push("The latest imported data is more than 48 hours old. Refresh reads Nexus; it does not run the Geo Rep import.");
  const sorted = [...visible].sort((a,b) => (selected.sort === "value" ? (b.value ?? -Infinity) - (a.value ?? -Infinity) : selected.sort === "quantity" ? (b.quantity ?? -Infinity) - (a.quantity ?? -Infinity) : selected.sort === "oldest" ? a.orderDate.localeCompare(b.orderDate) : b.orderDate.localeCompare(a.orderDate)) || a.id.localeCompare(b.id));
  const pages = Math.max(1, Math.ceil(sorted.length / 50));
  const page = Math.min(selected.page, pages);
  return {
    source: "Geo Rep transaction ledger / Nexus Firestore", latestPeriod, latestImport,
    selection: {...selected, page}, options, totals, by, trend, dailyTrend, trendKey,
    quality: { warnings, cancelled: metrics(cancelled), unmapped: visible.filter(r => !r.mapped).length, missingRep: visible.filter(r => r.rep === "Unassigned").length, missingOrderNumber: visible.filter(r => !r.orderNumber).length, missingUnits: visible.filter(r => r.quantity === null).length, invalidDates, missingValues, sourceRows: rows.length, datesWithOrders: dailyTrend.length },
    table: { rows: selected.export ? sorted : sorted.slice((page - 1) * 50, page * 50), total: sorted.length, pages, page },
  };
}

function createReader({db, getAuth, HttpsError}) {
  // Cache only the common source snapshot, never identity or permission decisions.
  let cached = null;
  async function authorise(request) {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to Nexus.");
    const user = await getAuth().getUser(request.auth.uid).catch(() => null);
    const profileDoc = await db.collection("adminUsers").doc(request.auth.uid).get();
    const profile = profileDoc.exists ? profileDoc.data() : null;
    const claims = user?.customClaims || {};
    const revoked = user?.tokensValidAfterTime && Number(request.auth.token?.auth_time || 0) * 1000 < new Date(user.tokensValidAfterTime).getTime();
    if (!user || user.disabled || revoked || !profile || profile.disabled || claims.chatClient || claims.nexusRole === "client" || profile.role === "client" || profile.accountType === "client" || profile.chatAccess?.audience === "external") throw new HttpsError("permission-denied", "An active Nexus staff account is required.");
    const admin = claims.admin === true && request.auth.token?.admin === true && require("./admin-access").isAdminProfile(profile);
    if (!admin && (!(claims.operator === true || claims.nexusRole === "normal") || !profile.permissions?.allowedNavigationIds?.includes("franchiseorder"))) throw new HttpsError("permission-denied", "Franchise Order access has not been assigned to your account.");
  }
  return async request => {
    await authorise(request);
    const input = request.data || {};
    const latest = await db.collection("salesTransactions").orderBy("periodKey", "desc").limit(1).get();
    const latestPeriod = latest.docs[0]?.data().periodKey || new Date().toISOString().slice(0,7);
    const selected = selection(input, latestPeriod, HttpsError);
    const key = `${selected.start.slice(0,7)}:${selected.end.slice(0,7)}`;
    if (!cached || cached.key !== key || cached.until < Date.now() || input.refresh === true) {
      const snapshot = await db.collection("salesTransactions").where("periodKey", ">=", selected.start.slice(0,7)).where("periodKey", "<=", selected.end.slice(0,7)).limit(30001).get();
      if (snapshot.size > 30000) throw new HttpsError("resource-exhausted", "This range exceeds 30,000 order lines. Choose a shorter period; no partial totals were returned.");
      cached = { key, until: Date.now() + 60000, rows: snapshot.docs.map(normalise) };
    }
    const result = report(cached.rows, selected, latestPeriod);
    if (selected.export && result.table.total > 10000) throw new HttpsError("resource-exhausted", "Exports are limited to 10,000 lines. Narrow the filters before exporting.");
    // Keep grouped responses bounded; their totals still cover all selected rows.
    result.groupCounts = Object.fromEntries(Object.entries(result.by).map(([key, rows]) => [key, rows.length]));
    for (const key of Object.keys(result.by)) result.by[key] = result.by[key].slice(0, 500);
    return result;
  };
}

module.exports = {createReader, selection, normalise, report, metrics};
