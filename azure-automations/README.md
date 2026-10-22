# Nexus automations on Azure (Stage 1)

Plan and costs: `../docs/azure-automations-migration-plan-20261002.md`.

## Foundations deployed 2 October 2026

Approved by the user: Azure resources and cost (about R1,000–1,300/month).
Not yet approved: the Google Workload Identity Federation link, copying secrets
to Key Vault, and the cutover order. No workload runs here yet, nothing connects
to Google, and Key Vault holds no secrets.

Deployment `stage1-foundations-20261002` of `infra/main.bicep` into
`rg-meridian-nexus-automations` (South Africa North, subscription
`02b268fe-e01a-453e-b287-eec83ccc0676`). What-if showed 39 creates, no changes.

| Resource | Name |
| --- | --- |
| Container Apps environment (consumption) | `cae-nexus-automations` |
| Container Registry (Basic, admin off) | `acrnexusautop2fzlrpwgvno2.azurecr.io` |
| Storage (no shared keys, no public blobs) | `stnexusautop2fzlrpwgvno2`: queues `georep-api`, `georep-portal`, `etl`, `insights`, `stockfix`; container `run-artifacts` |
| Key Vault (RBAC, soft delete 30 days) | `kv-nexusauto-p2fzlrpwgvn` |
| Log Analytics (30 days, 0.3 GB/day cap) | `log-nexus-automations` |
| Managed identities | `id-nexus-dispatcher`, `-georep`, `-etl`, `-insights`, `-stockfix` |
| Budget | `budget-nexus-automations`: R1,500/month; Owners alerted at 80% actual and 100% forecast |

Each identity has AcrPull on the registry, Queue and Blob Data Contributor on the
storage account, and Key Vault Secrets User on the vault (20 assignments, all
scoped to these resources). The Key Vault resource provider was registered on
the subscription for this deployment.

## Google link (2 October)

- Images in the registry: `nexus-etl/worker:gcp-2a1732a7` and
  `stockfix-pipeline:gcp-897483bd` (digests identical to the Google jobs),
  `sales-insights-pipeline:20260906-sharepoint-firebase-r2`, `tools/node:22-alpine`.
- Token audience: Entra app `Nexus Automations - Google Federation Audience`
  (`api://95e8953c-64bf-4a17-a65d-e5d531ef7837`).
- Google workload identity pool `azure-nexus-automations`, provider `entra`
  (issuer `https://sts.windows.net/<tenant>/`, that audience only, condition limited
  to this tenant and three identities). Created by the user.
- `roles/iam.workloadIdentityUser` links: `id-nexus-etl` → `nexus-inventory-etl@`,
  `id-nexus-insights` → `sales-insights-worker@`, `id-nexus-stockfix` → `stockfix-worker@`.
  No new Google data roles: each identity gets only what its job's account has today.
- Verified with `jobs/federation-check.yaml` (job `job-federation-check`, manual,
  0.25 vCPU): Azure token → Google STS → `generateAccessToken` for
  `nexus-inventory-etl@` all succeeded.
- Key Vault secrets not yet copied (Sales Insights needs the SharePoint values).

## ETL shadow test (4 October)

Job `job-nexus-etl` (`jobs/etl.yaml`): the Google image unchanged (digest 2a1732a7), 1 vCPU /
2 GiB, 30 min, no retries; a wrapper writes the Azure token and a keyless Google
external-account credentials file, then runs `node worker.cjs`. Start a run with
`node scripts/start-job.cjs job-nexus-etl ETL_RUN_ID=<id>`.

Two completed Google runs were copied to new run ids (`scripts/stage-etl-shadow.cjs`;
server-side copies, checksums verified) and run on Azure; outputs compared with
`scripts/compare-etl-shadow.cjs`:

| Google run | Azure shadow | Result |
| --- | --- | --- |
| `0c19b854…-29b4e834` Sales (aQuelle / Boxer) | `cf0d782e…-a88d1fad` | `facts.jsonl` (20.9 MB), `assignments.jsonl`, `exceptions`, `dc` identical; `sales.xlsx` differs only in the run-id cell `Audit!B29` |
| `6c4353b2…` Inventory (Ethica / Clicks) | `a9d63fc2…-0eeb367e` | `facts`, `exceptions`, `dc`, `assignments` identical; `inventory-draft.xlsx` differs only in the run-id cell |

`result.json` differs only in run id, completion time, timings, input copy paths and
generations, and the output file hash. Worker time on Azure was about 1.5x Google's
(54 s vs 35 s; 59 s vs 37 s) at the same size. Shadow outputs remain under
`etl-results/<shadow id>/` (not referenced by any `etlRuns` document).

Temporary storage grants for the operator (`etl-azure-test-*-20261002/20261004`) were
removed after the test; the one-off metadata job was deleted.

## ETL switch-over (4 October)

- `meridianEtl` (Google callable used by the portal) now starts `job-nexus-etl` on Azure.
  `functions/etl-azure-launcher.js` exchanges the function's Google identity token
  (audience `api://AzureADTokenExchange`) at Entra for user-assigned identity
  `id-nexus-gcp-launcher`, then starts the job with only `ETL_RUN_ID` changed. The run
  record's `execution` is `azure:<execution name>`. Inputs, outputs and the portal are unchanged.
- Trust: federated credential `google-meridian-etl` on `id-nexus-gcp-launcher`
  (issuer `https://accounts.google.com`, subject `109750794793874035125` = the function's
  service account `730011371323-compute@`). Added by the user.
- Permission: custom role `Nexus ETL Job Starter` (jobs read, start, executions read),
  assigned on `job-nexus-etl` only. Added by the user.
- Release: `scripts/release-etl-azure-launcher-20261004.cjs` — `deploy-code` gave
  `meridianetl-00014-tiq` (executor still Google), `executor azure` gave `meridianetl-00015-piw`.
  Tests: `scripts/tests/etl-azure-launcher.test.cjs` plus the existing ETL API tests.
- **Rollback:** `node scripts/release-etl-azure-launcher-20261004.cjs executor google`
  (no code change). The Cloud Run job `nexus-inventory-etl` stays in place for two weeks.

## Geo Rep worker image (4 October)

- `georep-worker/`: `build-context.cjs` downloads the **deployed** `processExtraction` bundle
  (12 files, revision `processextraction-00446-pab`) and adds only `Dockerfile` (node 22 +
  Chromium libraries) and `azure-runner.js`. The runner loads `extractionRuns/<RUN_ID>` and calls
  the unchanged handler (`processExtraction.run`) with the trigger's event shape; Google access is
  keyless through the federation pool.
- Built with ACR Tasks: `georep-worker:pab-00446` (281 MB). Job `job-georep-worker`
  (`jobs/georep-worker.yaml`, 2 vCPU / 4 GiB, 15 min, no retries, identity `id-nexus-georep`).
- Smoke test (`RUNNER_MODE=smoke`) passed: handler found, HeadlessChrome/149 started, Geo Rep
  portal page ("Geo CRM") loaded from Azure.
- Before real runs: a dedicated Google service account for the worker, the Geo Rep identity in the
  federation pool, and its 7 secrets in Key Vault (RETAILER_CREDENTIAL_KEY, SHAREPOINT_TENANT_ID,
  SHAREPOINT_CLIENT_ID, SHAREPOINT_CLIENT_SECRET, GEMINI_API_KEY, GEO_REP_OPEN_API_ID,
  GEO_REP_OPEN_API_KEY).

## Geo Rep on Azure (5 October)

- Secrets: all 7 in Key Vault (user re-copied; the first copy stored empty values). The runner reads
  them at start with `id-nexus-georep` and refuses empty values. Google access as `georep-worker@`
  (dedicated account: Firestore user; storage objectAdmin on uploads/, extraction-evidence/,
  sharepoint-workbook-backups/, geo-rep-*; viewer on portal-resources/).
- Supervised runs on Azure (`scripts/georep-canary-run.cjs`, runs created `azure-reserved`, which the
  Google trigger ignores): Orders 1–5 Oct and Attendance 1–4 Oct both completed in ~2 min, files saved,
  SharePoint uploaded, trackers and sales import queued; both dashboards refreshed on Azure.
- Dispatcher: `job-georep-dispatcher` (every 2 min, `jobs/georep-dispatcher.yaml`) starts
  `job-georep-worker` for each `azure-reserved` run; role `Nexus Geo Job Starter` on the worker job
  (assigned by the user). Tested: reserved run picked up in ~20 s, completed in ~1 min.
- Image `georep-worker:pab-00446-r6` (unique tag per build; reusing a tag served a cached image).
- Hand-off deployed (`scripts/release-georep-azure-handoff-20261005.cjs`, revision
  `processextraction-00447-zix`): Google `processExtraction` marks queued runs of retailers with
  `executor: "azure"` as `azure-reserved` (tracker steps excluded) and returns; the dispatcher starts
  the Azure worker, whose image sets `NEXUS_EXECUTOR=azure` to skip the hand-off. The deploy guard
  excused only that morning's looping blueprint batch (user-approved).
- **Switched 5 October 11:05:** `executor: "azure"` on `geo-rep-attendance-for-reps` and
  `geo-rep-sales-transactions`. Rollback: delete the `executor` field on the retailer.
- Found: blueprint folder-refresh runs loop on Google event redelivery for up to 24 h because
  `processGeoRepBlueprintFolderRefresh` ignores run status (4 runs from the 06:00 batch restarted every
  ~15 min). Likely a large share of `processExtraction` compute; fix before moving the blueprint batch.
- **Loop fix deployed 7 October** (`scripts/release-blueprint-loop-fix-20261005.cjs`, revision
  `processextraction-00448-kes`): the folder refresh re-reads the run, stops if it already finished, and
  marks it failed after 3 starts (`folderRefreshAttempts`). Also applied to local `functions/index.js`.
- Scheduled Azure runs since the switch: 5 and 6 October Attendance 11:30 and Orders 12:00 all completed
  on Azure; trackers updated on Google; dashboards current.

## Firebase retirement, Phase A (16 October)

Plan: `docs/firebase-retirement-plan-20261016.md`.

- Blueprint batch (`geo-rep`, ~200 runs at 06:00) switched to `executor: "azure"`; the dispatcher keeps at
  most `MAX_PARALLEL=4` Azure runs active. First Azure batch 17 October. Test run
  `azure-canary-blueprint-mvalj00c` matched Google (23 answer rows).
- Trackers: the dispatcher gives tracker runs 4 vCPU / 8 GiB (image `georep-worker:pab-00448-r8`). Test
  `azure-canary-tracker-mvam8deu` (Merchandiser T&A) completed in 1 min with the same result as Google's
  15 October run (2,899 Strike Rate and 41,480 Scheduled Attendance rows; the Excel Online formula-refresh
  size warning appears on Google too). Hand-off v2 (`scripts/release-georep-handoff-trackers-20261016.cjs`)
  removes the tracker exclusion; prepared on `processextraction-00448-kes`, deploy is run by the user.
- Dashboard publishers moved: `job-dashboard-publisher` (`jobs/dashboard-publisher.yaml`, every 5 min,
  image `dashboard-publisher:p4-r2-2` built by `dashboard-publisher/build-context.cjs` from the deployed
  `publishAzureAttendance` and `refreshPublicFranchiseOrders` bundles) runs the Orders snapshot refresh,
  then the Attendance and Orders publish. Google access as `georep-worker@`; blob writes as the existing
  `attendance-publisher` identity (no new permissions). The only code change makes the token source a
  parameter (`publishAll`, `runRefresh`). First run: both dashboards already current. Google schedulers
  `public-franchise-orders-publisher` and `azure-attendance-publisher` PAUSED (state saved in
  `.tmp/publisher-move-20261016/`). Rollback: resume both Google schedulers and set the Azure job to manual.
- Scheduled functions moved: image `nexus-scheduled:s58-r1` (`scheduled/`, built by `scheduled/build-context.cjs`
  from the deployed bundles: four code sets, each unchanged with its own lock file; `scheduled-runner.cjs` calls
  the onSchedule handler; secrets from Key Vault only where Google mounts them). Moved one at a time with
  `scripts/move-scheduled.cjs pause|run|enable|resume <job>` (Google scheduler paused first, because two retries
  and one scheduler path are not safe to run twice at once):

  | Azure job (cron UTC) | Google function(s) | First Azure run |
  | --- | --- | --- |
  | `job-nexus-run-scheduler` (`* * * * *`, 0.25 vCPU) | runScheduledExtractions | ok, 3.6 s (35 s with image pull) |
  | `job-nexus-stalled-runs` (`*/2`) | detectStalledExtractionRuns | ok, 4 s |
  | `job-nexus-retries` (`*/15`) | the three retry* functions | ok |
  | `job-nexus-geo-api-sync` (`5 * * * *`, 1 vCPU / 2 GiB, 55 min) | runScheduledGeoRepOpenApiSync | see below |
  | `job-nexus-sales-api-import` (`0 6 * * *` = 08:00 SAST) | runScheduledGeoRepSalesDashboardApiImport | ok; "no-data" for October, same as Google's 08:00 run |

  Differences on Azure (audit 16 October): the Geo API functions try Google Secret Manager first, get 403 and
  use the Key Vault values, so keys rotated in the portal must also be updated in Key Vault. The sales import
  reports errors in `integrationHealth/geo-rep-sales-api`, not the exit code.
- Geo Rep API sync: on Google every run was cut off after ~24 min, so form submissions (since 6 Oct), answers
  (since 20 Aug) and EPODs never completed. One Azure catch-up run (6 h limit, 16 Oct 07:53–13:46 UTC) synced
  975,231 records across all 8 groups. A normal run (24 h overlap) then took 35 min, longer than the 30-min
  interval, so the job runs hourly at :05 with a 55-min limit (enabled 19 October; it was left on manual from
  16 October, so the first run catches up those days).
- Left on Google until Phase C: `deliverMeridianChatReminders` (needs Firebase Auth and FCM; under
  `georep-worker@` reminders would be dropped silently) and `cleanupMeridianSupportUploads` (deletes
  `support-ticket-attachments/`). Both are replaced when the portal leaves Firebase.
- DataOrbis: never run, both retailers' schedules off. Reads inputs from `dataorbis-inputs/`, so
  `georep-worker@` needs read access there before `executor: "azure"` is set on `dataorbis-game-sales` and
  `dataorbis-makro-sales`.

## Tidy-ups (4 October)

- Deleted three malformed `retailers` documents (ids starting `updateMask.fieldPaths=` /
  `.fieldPaths=`; only a `reportSchedule`, no runs); backup in `.tmp/tidy-20261004/`.
- Marked run `c8RlgES4SURnCf9O2O7H` (stuck "running" since 11 September) as failed.
- `azure-field-dashboards/scripts/verify-live.cjs` and `verify-azure-live.cjs` now check the
  Azure snapshot service and live consistency instead of fixed 21 September totals; both pass.

## Cost changes (21–22 October, user-approved)

Jobs are not in `infra/main.bicep`; these are live settings. Pre-change job definitions were saved before
the update (`az containerapp job show` output).

- Blueprint batch (`retailers/geo-rep`) runs Mondays 06:00 only: `daysOfWeek: [1]` via
  `../scripts/blueprint-weekly-20261021.cjs` (`rollback` argument restores all seven days). Runs fetch
  month-to-date, so days after the last Monday of a month are not captured.
- 22 October: Geo Rep blueprint feature retired (user decision). Schedule disabled
  (`../scripts/blueprint-off-20261022.cjs`); `job-nexus-retries` now runs only
  `retryLockedGeoRepCampaignDetails`; Google functions `saveGeoRepBlueprint`,
  `generateGeoRepBlueprintPopulation`, `retry{Failed,Locked}GeoRepBlueprintUpdates` and their two schedulers
  deleted. Data archived then deleted (`../scripts/blueprint-archive-20261022.cjs`): 339 `geoRepBlueprints`,
  373 `geoRepBlueprintUpdates`, 1 `geoRepBlueprintFolders`, 10,814 blueprint `extractionRuns`, 92 `files`
  records. Archive (raw Firestore docs + the 92 storage objects, 63 MB):
  `stnexusautop2fzlrpwgvno2/archive/blueprint-archive-20261022.tar.gz` (private; MD5
  `MU8aKfUawxhO28w+iqYkPw==`). The 92 objects are still in the Firebase bucket.
- `job-georep-worker`: `NODE_OPTIONS=--max-old-space-size=3072` (size unchanged, 2 CPU / 4Gi). 17–21 Oct,
  21–23 blueprint folder-refresh runs a day died with "JavaScript heap out of memory" and were left
  "running". Do not shrink the worker: on Consumption 1 CPU forces 2Gi. Tracker runs (4 CPU / 8Gi
  override) inherit the same 3 GB heap; raise it for them in the dispatcher if trackers move here.
- `job-georep-dispatcher`: every 5 minutes (was every 2). A pass takes ~30 s; Attendance/Orders may start
  up to 5 min after they are queued.
- `job-nexus-geo-api-sync`: 0.5 CPU / 1Gi (was 1 / 2Gi); peak use ~0.1 CPU / 250 MB, normal run ~15 min.

Rollback: `az containerapp job update -g rg-meridian-nexus-automations -n <job>` with
`--remove-env-vars NODE_OPTIONS`, `--cron-expression "*/2 * * * *"` or `--cpu 1 --memory 2Gi`.

Redeploy or review changes:

```powershell
az deployment group what-if -g rg-meridian-nexus-automations --template-file infra/main.bicep
az deployment group create -g rg-meridian-nexus-automations --template-file infra/main.bicep
```
