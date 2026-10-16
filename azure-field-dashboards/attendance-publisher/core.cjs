'use strict';
const zlib = require('node:zlib');
const {validate, hash} = require('../server/snapshot-data.cjs');
const MAX_BLOB = 30 * 1024 * 1024;
const IDS = ['current', 'merchandisers'];
function checkSources(source, now = new Date()) {
  const reports = IDS.map(id => source.documents['geoRepAttendanceDashboard/' + id]);
  const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Africa/Johannesburg', year:'numeric', month:'2-digit', day:'2-digit'}).format(now);
  for (const report of reports) {
    if (!report || !Array.isArray(report.rows) || !report.rows.length || !/^\d{4}-\d{2}-01$/.test(report.reportStartDate || '') ||
        !/^\d{4}-\d{2}-\d{2}$/.test(report.reportEndDate || '') || report.reportEndDate < report.reportStartDate || report.reportEndDate >= today ||
        report.reportStartDate.slice(0, 7) !== report.reportEndDate.slice(0, 7) || !report.source?.schedules?.fileId) throw Error('Incomplete attendance source');
  }
  if (reports[0].reportStartDate !== reports[1].reportStartDate || reports[0].reportEndDate !== reports[1].reportEndDate ||
      reports[0].source.schedules.fileId !== reports[1].source.schedules.fileId) throw Error('Attendance audiences are from different imports');
  return reports[0].reportEndDate;
}
function unpackSnapshot(pointer, bytes) {
  if (pointer.schema !== 1 || !/^[a-f0-9]{64}$/.test(pointer.sha256) || pointer.blob !== 'snapshots/' + pointer.sha256 + '.json.gz' ||
      !Number.isInteger(pointer.bytes) || pointer.bytes > MAX_BLOB || bytes.length !== pointer.bytes || hash(bytes) !== pointer.sha256) throw Error('Azure baseline checksum mismatch');
  const snapshot = validate(JSON.parse(zlib.gunzipSync(bytes, {maxOutputLength:128 * 1024 * 1024})));
  if (snapshot.capturedAt !== pointer.capturedAt) throw Error('Azure baseline generation mismatch');
  return snapshot;
}
function mergeAttendance(baseline, source, now) {
  const through = checkSources(source, now), next = structuredClone(baseline);
  for (const id of IDS) {
    const previous = baseline.documents['geoRepAttendanceDashboard/' + id];
    if (through < previous.reportEndDate) throw Error('Attendance source would move backwards');
    const fileId = previous.source.schedules.fileId;
    delete next.documents['files/' + fileId];
  }
  for (const key of Object.keys(next.documents)) {
    if (/^geoRep(?:Merchandiser)?AttendanceConfig\//.test(key) || key.startsWith('attendanceStoreMasters/')) delete next.documents[key];
  }
  Object.assign(next.documents, source.documents);
  Object.assign(next.files, source.files);
  const referenced = new Set(Object.values(next.documents).map(doc => doc.storagePath).filter(Boolean));
  for (const key of Object.keys(next.files)) if (!referenced.has(key)) delete next.files[key];
  next.sourceUpdates = {...next.sourceUpdates, ...source.versions};
  next.capturedAt = now.toISOString();
  return validate(next);
}
async function publish({source, blobs, verifyReports, now = () => new Date()}) {
  const current = await blobs.read('current.json'), pointer = JSON.parse(current.bytes);
  if (!current.etag) throw Error('Azure pointer has no concurrency token');
  const selected = await source.load();
  const through = checkSources(selected, now());
  const sourceVersion = hash(JSON.stringify(Object.entries(selected.versions).sort(([a], [b]) => a.localeCompare(b))));
  if (pointer.attendanceSourceVersion === sourceVersion) return {status:'unchanged', through, capturedAt:pointer.capturedAt};
  if (!/^snapshots\/[a-f0-9]{64}\.json\.gz$/.test(pointer.blob || '')) throw Error('Invalid Azure baseline path');
  const baseline = unpackSnapshot(pointer, (await blobs.read(pointer.blob)).bytes);
  selected.files = await source.workbooks(selected);
  const next = mergeAttendance(baseline, selected, now());
  const attendance = await verifyReports(next);
  // Do not publish a mixed import if the bot or an administrator changed its inputs.
  await source.verify(selected);
  const bytes = zlib.gzipSync(Buffer.from(JSON.stringify(next)), {level:9}), sha256 = hash(bytes);
  if (bytes.length > MAX_BLOB) throw Error('Attendance snapshot exceeds size limit');
  const blob = 'snapshots/' + sha256 + '.json.gz';
  await blobs.write(blob, bytes, {'If-None-Match':'*'});
  if (hash((await blobs.read(blob)).bytes) !== sha256) throw Error('Published snapshot read-back failed');
  const updated = {...pointer, schema:1, blob, sha256, bytes:bytes.length, capturedAt:next.capturedAt,
    attendanceThrough:through, attendanceSourceVersion:sourceVersion, attendance,
    attendanceSchedule:{time:'06:00', timeZone:'Africa/Johannesburg', publishChecks:'every 5 minutes', range:'month-to-yesterday'}};
  // Keep Orders untouched and reject concurrent pointer updates instead of losing them.
  await blobs.write('current.json', Buffer.from(JSON.stringify(updated)), {'If-Match':current.etag});
  return {status:'published', through, capturedAt:updated.capturedAt, sha256, attendance};
}
module.exports = {publish, checkSources, mergeAttendance, unpackSnapshot};
