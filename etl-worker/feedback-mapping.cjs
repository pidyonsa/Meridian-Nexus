"use strict";
const { clean, norm } = require("./engine.cjs");
const key = (...values) => JSON.stringify(values.map(norm));
function index(rows, select) {
  const map = new Map(); for (const row of rows) { const id = select(row); if (!map.has(id)) map.set(id, []); map.get(id).push(row); } return map;
}
function unique(rows, select) { return rows.length && new Set(rows.map(row => key(...select(row)))).size === 1 ? rows[0] : null; }
const issue = (code, detail) => ({ code, detail });
const counts = rows => rows.reduce((counts, row) => { for (const error of row.errors) counts[error.code] = (counts[error.code] || 0) + 1; return counts; }, {});
const shoprite = value => /^(SHOPRITE|CHECKERS|USAVE|MEDIRITE)(?:\s|$)/.test(norm(value));
function mapper(data, channel) {
  const eligible = value => channel === "SHOPRITE GROUP" ? shoprite(value) : norm(value) === norm(channel);
  const stores = (data.stores || []).filter(r => eligible(r.v[0])), staff = (data.staffing || []).filter(r => eligible(r.v[3]) && !/^(NO|N|FALSE|0|INACTIVE)$/.test(norm(r.v[4])));
  const byCode = index(stores, r => norm(r.v[1])), byName = index(stores, r => norm(r.v[2])), byPair = index(stores, r => key(r.v[1], r.v[2])), people = index(staff, r => key(r.v[0], r.v[1]));
  return (code, name, mode = "pair") => {
    const errors = [], warnings = [];
    let matches = mode === "name" ? byName.get(norm(name)) || [] : ["code", "code-name"].includes(mode) ? byCode.get(norm(code)) || [] : byPair.get(key(code, name)) || [];
    if (mode === "code-name") { const exact = matches.filter(r => norm(r.v[2]) === norm(name)); if (exact.length) matches = exact; }
    const store = unique(matches, r => [r.v[3], r.v[4], r.v[5]]);
    if (matches.length && !store) errors.push(issue("STORE_MAPPING", "Conflicting canonical stores; review the shared store clean-up master."));
    else if (!store) warnings.push(issue("STORE_MAPPING", "No store alias; source store name retained and unavailable mapped fields left blank."));
    const assignments = store ? people.get(key(store.v[4], store.v[5])) || [] : [], region = clean(assignments[0]?.v[7]);
    if (!region) warnings.push(issue("REGION_MAPPING", "No region on the first active exact master-store match; left blank."));
    return { store, region, errors, warnings, assignments: assignments.map(r => ({ siteCode: clean(code), canonicalName: clean(store.v[5]), employeeId: clean(r.v[8]), name: clean(r.v[9]), role: clean(r.v[10]), managerCode: clean(r.v[13]), manager: clean(r.v[14]) })) };
  };
}
module.exports = { key, index, unique, issue, counts, shoprite, mapper };
