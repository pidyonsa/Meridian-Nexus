# Syndicated attendance exclusions

Location: **Admin > Geo attendance > Attendance exclusions**.

Only active Nexus staff administrators can view or change these settings. No
exclusions are enabled merely by deploying this feature.

## Managing names

Choose **Staff member only** to exclude that person's attendance, or **Manager
and reporting team** to exclude people under that manager in the reporting
hierarchy. Select reps, merchandisers or both. Enter the full name and optionally
a reason, then preview and confirm before saving.

Matching ignores case and repeated whitespace, but requires a full-name match.
For staff members with identical names, supply the optional staff code; this
matches the code instead of the name. Manager/team exclusions use names and the
resolved reporting hierarchy, including merchandiser-to-rep assignments.

Preview shows matches against the latest staff source, not an estimated number
of visits. An unmatched rule may still match a future upload. Duplicate rules
are skipped; imports add to the existing list, never replace it.

Disable an entry to restore its records temporarily, or remove the entry to
restore them permanently. Another matching enabled rule can still exclude that
person. Recent changes show the administrator, time, action and revision.

## Excel import

Use the downloadable XLSX template or a single column of full names. Template
columns are `Name`, `Type`, `Audience`, `Staff Code`, and `Reason`.

- `Name` is required.
- `Type`: `person` or `manager`.
- `Audience`: `rep`, `merchandiser` or `both`.
- Blank type/audience cells use the selections on the import form.
- Staff codes must be stored as text to preserve leading zeroes.
- One nonempty worksheet, maximum 500 entries per upload and 1 MB per file.
- Maximum 1,000 stored exclusions. Formulas, macros and linked content are rejected.

## Reporting scope

The same server-side policy is applied to Syndicated Attendance totals, charts,
rosters, filters, reconciliation, drilldowns and Excel downloads. It applies to
the authenticated Nexus dashboard and the public Firebase/Azure attendance
viewer. Refresh an already open dashboard after saving; short viewer caches
can take about a minute to expire. An export from an older policy revision is
rejected so it cannot silently disagree with the displayed totals.

This is a reversible reporting filter, not deletion or a data-access boundary.
Source workbooks, raw imports and automation are unchanged. Dedicated Attendance,
Call Cycle, Franchise Orders and user permissions are unaffected.

## Storage and security

Settings live at `geoRepAttendanceConfig/current.dashboardExclusions`; audit
records are in its `exclusionAudit` subcollection. The callable
`manageSyndicatedAttendanceExclusions` verifies current Firebase Auth and Nexus
staff-admin status on every request. Browser writes remain denied by the existing
Firestore rules. Transactions reject conflicting administrator revisions and
write the policy and audit record together.

The public viewer exposes no exclusion-management endpoint. It reads the policy
server-side, keeps the raw source cache intact, and includes the policy revision
in attendance versions. Call Cycle continues to use its original unfiltered plan.
