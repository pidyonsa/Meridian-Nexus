# No-ETLs inventory workspace repair: 22 September 2026

Status: **deployed and verified**, September 22 at 11:43 SAST.

- API: `meridianetl-00006-qem`.
- Hosting: `de680a18b561a5a8`.
- Live: https://meridian-nexus.web.app/#etls

## Scope

The user confirmed the original Nexus **No-ETLs inventory workspace** only.
Salesforce/Geo Rep automation, Attendance, Orders, Azure migration, customer
mapping rules, shared reference selections and business-output approval are
outside this repair. No new identities, access grants or schedules are created.

## Live audit

- The deployed `meridianEtl` source matched the local ETL module before editing.
- Baseline API revision: `meridianetl-00005-tat`.
- Baseline Hosting version: `7bf06997f0508031`.
- No `etlRuns` business records or custom channel setups were present.
- The worker had one successful synthetic execution from September 9; this is
  not evidence that a real customer batch has been processed or approved.
- Shared reference set `anchor-pnp-v1` remains configured at revision 1, with
  products, stores, staffing, DC, status and template Resource identifiers.
- Fully paginated error-log lookup for September 18 through the audit found no
  ERROR entries for `meridianEtl`, `savePortalResource` or `nexus-inventory-etl`.
  The first broad log lookup was incomplete; only the later complete lookup is
  used for that conclusion.
- The existing runtime retains its prefix-scoped portal-resource read and ETL
  input/output access. The earlier September 10 permissions fix is still present.
- The operator's account cannot read the private reference objects. That is not
  evidence of a runtime permission failure. Access was not broadened to bypass
  this boundary; current reference workbook bytes were not independently read.

## Reproduced defects and repairs

1. A delayed successful worker result changed a failed run back to Review/Ready
   but retained the old error. The UI therefore still offered Retry. Completed
   output reconciliation now clears that stale error.
2. The 35-minute deadline could mark an already Ready/Review run failed when its
   output metadata was absent. Only Preparing/Running states may now time out.
3. Status polling read a run, awaited Storage, then updated from the stale read.
   A concurrent approval could be overwritten. Reconciliation now re-reads the
   run inside a Firestore transaction and preserves terminal/approved states.
4. Approving in Outputs updated only the selected detail, leaving History and
   the pipeline's latest-run indicator stale. The UI now updates both together,
   invalidates older detail requests, and stops an outstanding poll.

Three new API regression tests failed against the baseline and pass with the
repair. Browser coverage now explicitly requires immediate Approved status in
History, using a reconciled synthetic fixture with zero exceptions.

These are verified code defects, not a claim that they caused an observed
customer job failure: no business run history was present during this audit.

## Validation

- 33 focused tests: engine reconciliation, template safety, permissions,
  generation-pinned downloads, references, channel setup and status regressions.
- Isolated browser checks passed using the staged live portal baseline: all six
  tabs, admin/staff separation, rule confirmation, draft approval blocking,
  approved-history synchronization, downloads, error recovery and sign-out.
- Desktop, 390px and 320px screenshots were produced; desktop and narrow mobile
  screenshots were inspected. No layout/theme redesign is included.
- Headless Edge initially timed out in the restricted process environment. The
  isolated run outside that environment passed; this was not a live-site failure.
- No real inventory batch was started, no test administrator created, and no
  business output approved. Signed-in production upload/run verification remains
  distinct from the isolated browser tests and deployed-source checks.
- Live verification matched every deployed API source file and the complete
  Hosting asset manifest, including unchanged assets. Anonymous catalogue access
  returned HTTP 401 / UNAUTHENTICATED. All 27 service-worker precache paths exist
  in the release manifest. Function runtime settings, API/job IAM and worker
  configuration were checked and preserved.

## Release controls

`scripts/release-etls-repair-20260922.cjs` starts from the exact live source and
asset manifests. Only `meridian-etl.js` changes in the function bundle. Hosting
changes only `etls.js` and its references/cache version in `index.html` and
`service-worker.js`; every other asset hash is retained.

Function settings, identity and IAM are checked before/after deployment. Worker
configuration and IAM are preserved. API and Hosting revision checks stop the
release if another deployment changes the baseline. No bulk deployment of the
dirty working tree is performed.

Release evidence and original rollback source/manifests are retained under
`.tmp/etl-repair-20260922/`. Final deployment identifiers and successful live
verification are recorded in `function.after.json`, `hosting-created.json` and
`verified.json`. Local asset references were updated without replacing unrelated
worktree edits. A rollback should restore only this API's baseline source and the
three changed assets, after checking for later releases; do not restore the entire
old portal over newer work.

## Remaining business readiness

- Only Anchor / Pick n Pay has a validated transformer. Other channel setup
  screens cannot safely execute using Pick n Pay mappings. Each needs its own
  raw sample, expected output, authoritative references and mapping validation.
- The previously supplied September 1 PnP sample yielded 1,759 store exceptions.
  That is an older local validation result, not a new live run or current master
  check. Correct missing/conflicting store, region, DC and product mappings in
  authoritative reference files, then run again. Do not guess or silently drop
  those rows to obtain an approvable output.
- Per-run estimate/date/PO conventions and final output approval remain explicit
  administrator decisions. This repair does not publish data into Stock Fix or
  Sales Insights or enable automatic processing.
