# Normal Staff Attendance and Call Cycle Access

Production project remains `meridain-nexus`. No migration or automation rerun.

## Released

- Added `attendance` navigation permission to five existing normal staff profiles missing it. All other profile fields and permissions were preserved using update-time preconditions. Client and disabled profiles were excluded.
- Added read-only Firestore access to published attendance dashboards, coverage stores/visits, blueprint update summaries, workbook snapshots and snapshot row chunks. Requires an assigned, enabled normal staff profile and staff claims. Administrative configuration, source masters, writes and other workspaces remain restricted.
- Removed the automation execution permission dependency from both Geo Rep attendance readers. They now require an enabled internal staff profile with attendance viewing permission; existing administrator access is retained.
- Removed admin-only navigation click guards and the frontend Geo Rep automation gate from Attendance and Call Cycle. Both Dedicated and Syndicated views use the existing `attendance` permission. This does not introduce a separate Call Cycle permission or grant automation execution rights.
- Existing Salesforce readers already accept normal operator tokens without retailer execution permissions and were left unchanged. Their older server guard does not enforce per-menu revocation; migrating them to the newer attendance-specific guard remains a separate hardening item.

## Verification

- 38 Firestore/access regression tests passed, including read/list access, write denial, disabled/client denial, and menu revocation.
- Four isolated backend attendance-view guard tests passed.
- Full Nexus browser fixture passed as a normal user with no Geo Rep automation assignment: both attendance sources, attendance page tabs, both Call Cycle sources and all four Call Cycle tabs, Job Summaries, sign-out and denied access. Desktop/mobile screenshots are private under `.tmp/job-summaries-verification/`.
- All four live attendance callable endpoints returned 403 to anonymous requests.
- Exact live hosting assets were checked against staged content; 55 unrelated assets were preserved.
- Browser tests used synthetic data and stubbed authentication, not a real staff member's live session.

## Release References

- Firestore ruleset: `0e57baf5-83ff-40b2-bcc4-32a6b6955905`.
- Geo Rep dashboard revision: `getgeorepattendancedashboard-00013-wax`.
- Geo Rep worksheet revision: `getgeorepattendanceworksheetview-00004-foz`.
- Hosting version: `054d98408fcbd781`.
- App cache tag: `20260909-attendance-staff-access`; service worker cache v52.
- Scoped release scripts: `scripts/release-attendance-staff-access.cjs` and `scripts/release-attendance-view-hosting.cjs`.
- Private live-source backups and verification records: `.tmp/attendance-staff-access/`.

Users should reload Nexus to refresh their account workspace permissions and receive the updated navigation code. Storage rules were not broadened; the readers retain their existing controlled server-side workbook access.
