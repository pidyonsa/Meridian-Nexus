# Daily Geo Rep Attendance Publishing

## Scope

The user requested the syndicated Geo Rep capture to update every day at 06:00
SAST and explicitly approved an automatic, restricted, keyless Attendance
publisher. This does not authorize the full Nexus migration. That migration
remains preparation-only; Salesforce schedule changes remain paused.

## Diagnosis

- The existing `geo-rep-attendance-for-reps` schedule was enabled at **01:00**,
  not 06:00, in `Africa/Johannesburg`.
- The 22 September 01:00 import successfully downloaded the 1-21 September
  workbook and updated both source dashboard documents by 01:10 SAST.
- Azure still served the 21 September recovery snapshot, covering 1-20 September.
  Source downloads did not previously publish a new Azure snapshot.
- The shared extraction scheduler also skipped this Geo Rep job on the first
  day of each month, although its existing date calculation already correctly
  selects the previous month through its final day.

## Implementation

- Existing download configuration: **06:00 Africa/Johannesburg, every day**,
  month-to-yesterday. The separate retired merchandiser job stays disabled:
  both audiences are produced by the same capture, avoiding duplicate downloads.
- Only the obsolete first-day guard and its comment were removed from the exact
  deployed `runScheduledExtractions` source. All other archive files, scheduler
  logic, runtime settings and permissions were retained. The matching local
  source edit preserves the rest of the dirty worktree.
- Private `publishAzureAttendance` function, Node 22, 2 GiB, one maximum instance,
  concurrency one, no minimum instances. Cloud Scheduler checks every five
  minutes, with bounded retries, and requires authenticated invocation.
- The publisher waits for both tracker runs to complete and for their dates and
  source file identifiers to agree. Only allowlisted Attendance fields and its
  referenced workbook/master are read; source originals are never modified.
- Generation-pinned workbook reads, SHA-256 verification, source revision
  rechecks and the unchanged dashboard calculation engine validate publication.
- Both audience totals must reconcile. Future dates and backwards imports are
  rejected. Unchanged sources do not write another snapshot.
- Existing Orders documents and files are retained, not reimported. Old
  Attendance workbooks are removed only from the new snapshot, not from storage.
- A new immutable Azure snapshot is uploaded and read-back verified before
  `current.json` is replaced with an ETag condition. Concurrent updates or
  failures leave the previous pointer intact. Prior immutable snapshots remain
  available for rollback.
- The live dashboard application was not redeployed or restarted.

The 06:00 time starts the download, not a promise of completed data at exactly
06:00. Publication follows successful import, normally at the next five-minute
check. On 22 September, complete daily data means **through 21 September**.

## Identities

- Google: `azure-attendance-publisher@meridain-nexus.iam.gserviceaccount.com`.
- Azure user-assigned identity: `attendance-publisher`, existing dashboard
  resource group, South Africa North.
- Google subject: `114167990654783167245`.
- Azure client ID: `b3a970dc-0587-4c54-9fb7-3bda2cbd8a48`.
- Azure principal ID: `0f65e84c-0627-4bcf-8f38-a06470474872`.
- Federation binds that exact Google subject and issuer to
  `api://AzureADTokenExchange`. No client secret, service-account key, SAS or
  storage key is used.
- Google custom document permission: `datastore.entities.get`, without list,
  query or write permissions. Firestore IAM is not a per-document boundary;
  fixed document selection is enforced by the isolated publisher code.
- Storage custom permission: `storage.objects.get`, conditioned to XLSX uploads
  and attendance-master paths. Runtime narrows uploads further to the Geo Rep
  Strike Rate filename contract and references in the completed import.
- Azure custom role permits blob **read/write only**, without delete or account
  keys, assigned only on the existing private `dashboard-data` container.
- The dashboard's existing read-only managed identity is unchanged. No human
  operator data roles were added.

Federation follows Microsoft's [Google Cloud workload identity guidance](https://learn.microsoft.com/en-us/entra/workload-id/workload-identity-federation-google-cloud).

## Operations

Verified on 22 September:

- The scheduled 07:55 UTC invocation published successfully at 07:56 UTC
  (09:56 SAST), without restarting the public app.
- The next automatic 08:00 UTC check returned HTTP 200 with `unchanged`,
  preserving the same snapshot. Both scheduler jobs are enabled and healthy.
- Snapshot SHA-256:
  `d603714160697e6bbe704385ccdb4c72167be4e0f53890fe80fe025c5822615c`.
- Publisher revision: `publishazureattendance-00002-dis`.
- Shared scheduler revision: `runscheduledextractions-00058-lev`.
- Reps: 11,909 scheduled, 11,679 attended; 21 September: 896 / 867.
- Merchandisers: 54,094 scheduled, 50,799 attended; 21 September: 3,308 / 3,045.
- Live report versions, counts, all three daily detail statuses and Excel rows
  reconcile. Saved exclusion revision 2 is retained for both audiences.
- Orders totals and version match the previous verified Azure snapshot.
- 68 unit/integration tests and 22 live daily browser checks passed, including
  filters, drilldowns, exports and 1366/390/320-pixel layouts. Desktop and mobile
  screenshots were inspected.
- Initial invocation permission propagation and a Firestore JSON response-size
  bound caused failed publisher attempts. Those attempts retained the old
  snapshot. The corrected bounded reader is deployed and the scheduled run
  succeeded; no permissions were broadened to work around those failures.

Source and publisher still run in the existing Google project. Azure serves
reports independently from its last verified snapshot if Google fails; this
work is not a claim of a Google-independent extraction system.

The source tracker updates also reported an existing SharePoint formula-refresh
warning (`unsupportedWorkbook`). The raw workbook writes and dashboard imports
completed. That separate Excel recalculation issue is not repaired by publishing
the validated Geo Rep source to Azure.

Deployment and verification tooling:

- `scripts/deploy-azure-attendance-publisher.cjs`
- `azure-field-dashboards/attendance-publisher/`
- `azure-field-dashboards/scripts/verify-attendance-publishing.cjs`
- Private evidence: `.tmp/azure-attendance-publisher-20260922/`, ignored by Git.

To pause Azure publication, pause only the `azure-attendance-publisher` Cloud
Scheduler job. Do not pause the shared extraction scheduler. A rollback must
restore the previous verified Azure pointer with an ETag precondition; do not
delete source files or snapshots. The original source archive and schedule
configuration are preserved in private evidence for targeted rollback.
