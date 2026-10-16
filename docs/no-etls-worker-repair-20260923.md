# No-ETLs Worker Repair: 23 September 2026

Status: **deployed and verified**, 23 September 2026 at 13:42 SAST.
API revision: `meridianetl-00007-hoy`.
Worker digest: `sha256:d1788f6b294e9c1858c16c58b8cb392fb0e6dfe9d6a6ed2778117255ed5ff606`.
Live verification confirmed unchanged Hosting, runtime and IAM, rejected anonymous
API access, and no additional production job executions.

## Scope

The user resumed the No-ETLs inventory workspace repair and requested deployment,
leaving production manual runs for their own testing. No inventory job was started
by this release. Wilmar/DataOrbis, other automations, reference selections,
schedules, credentials, permissions and existing business outputs are unchanged.

## Confirmed Failure

The September 23 Anchor / Pick n Pay run for
`PnPSiteDaysCover_20260916150002.xlsx` failed with
`rows.flatMap is not a function`.

The deployed worker placed the loaded ExcelJS template workbook inside the same
object as the six row-based inputs. The reference-error collector iterated every
entry as an array, including that workbook object. This caused the crash before
output publication, even with valid mappings.

The original worker source was retrieved from the generation-pinned Cloud Build
archive, matched to the deployed image digest, and verified against its recorded
SHA-256. A synthetic saved-template fixture reproduces the exact exception on
that source and reconciles successfully on the repaired engine.

## Repairs

- Keep the template workbook separate from row-based inputs in the worker.
- Restrict reference-cell error collection to the six declared input schemas.
- Retain template styles, exact mappings, stock reconciliation, exceptions and
  explicit output approval. No rows or mapping errors are silently discarded.
- Add stage timing and progress records without logging workbook rows or secrets.
- Read bounded status JSON without a separate metadata request for every object.
- Overlap independent catalogue and status reads; refresh history in batches of
  at most four active runs while preserving display order and transactional status
  reconciliation.

A completed run's status lookup now reads two Storage objects instead of making
four metadata/download requests. Access is still checked on each request; no
long-lived authorisation cache or public download links were added.

## Validation

- 38 focused tests passed, including template processing, mappings, duplicate
  prevention, bounded reads, concurrent history refresh, access control,
  generation-pinned downloads and approval-state races.
- Isolated browser checks passed against the live portal asset snapshot: admin
  and staff separation, all six views, rule confirmation, review and approval
  behaviour, downloads, error recovery, sign-out and narrow mobile layouts.
- Desktop and 320px Run screenshots were inspected.
- The exact deployment container passed offline worker tests with synthetic
  pinned workbooks, both a ready output and a mapping-review output. Duplicate
  delivery does not rerun a claimed job.
- A signed-in production manual run remains intentionally outstanding.

The failed execution's Cloud Run metadata reported 1m53.6s to start. The status
request logs were mostly subsecond, and its launch API request took approximately
2.56s. This repair removes redundant status requests, not platform provisioning
time. End-to-end processing speed must be measured on the user's next manual run;
the added stage timings distinguish processing from startup.

## Release Evidence

Evidence is stored under `.tmp/etl-worker-repair-20260923/`.

- `reproduction.json`: deployed-source regression reproduction.
- `tested.json`: tested source hashes.
- `build.result.json`: successful build and offline container test results.
- `job.after.json`: deployed digest and preserved worker configuration.
- `function.after.json`: API source-only deployment revision.
- `verified.json`: final live source, access, configuration and no-run checks.

The release changes only `engine.cjs` and `worker.cjs` in the worker image, and
`meridian-etl.js` in the captured production API bundle. It does not deploy the
dirty local functions entry point or any Hosting assets. Worker CPU, memory,
timeout, retries and service identity are unchanged.

## Manual Test

1. Open `https://meridian-nexus.web.app/#etls` as an administrator.
2. In History, open the failed Anchor / Pick n Pay run and select **Retry run**.
   Retry creates a new run; the original failure remains as an audit record.
3. Alternatively, use **New run** with Anchor / Pick n Pay, select the raw XLSX,
   confirm the processing rules and start it. Identical inputs and rules reuse
   the previous run, so use Retry for the existing failed batch.
4. Check Review for stock reconciliation and mapping exceptions, then Outputs
   for the workbook. A review/draft result is not an approved final dataset.
5. Only approve when the complete output is ready and has been reviewed.

Only Anchor / Pick n Pay currently has a validated inventory transformer. Other
customer/channel setups remain unavailable for processing until their own
mappings are validated.
