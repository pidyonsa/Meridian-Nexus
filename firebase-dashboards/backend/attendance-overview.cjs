'use strict';
const A = require('./vendor/attendance.cjs');
const key = value => String(value || '').trim().replace(/\s+/g, ' ').normalize('NFKC').toUpperCase();

// Use the same filtered visit set and distinct-store calculation as every drilldown.
function regionalWeeks(dataset, filters = {}) {
  const regions = new Map();
  for (const row of dataset.rows) {
    if (!A.matches(row, filters)) continue;
    const identity = key(row.region), region = regions.get(identity) || {label:row.region, rows:[], weeks:new Map()};
    region.rows.push(row);
    const week = key(row.week || 'Unassigned'), group = region.weeks.get(week) || {label:row.week || 'Unassigned', rows:[]};
    group.rows.push(row); region.weeks.set(week, group); regions.set(identity, region);
  }
  return [...regions.values()].map(region => ({label:region.label, ...A.totals(region.rows),
    weeks:[...region.weeks.values()].map(week => ({label:week.label, ...A.totals(week.rows)}))
  })).sort((a,b) => a.label.localeCompare(b.label));
}
module.exports = {regionalWeeks};
