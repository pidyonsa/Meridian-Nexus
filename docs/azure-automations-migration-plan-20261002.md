# Nexus automations to Azure: plan and cost (2 October 2026)

Status: **Stage 1 foundations deployed 2 October** (resources and cost approved;
see `../azure-automations/README.md`). Google link, secrets and cutover order
still awaiting approval; no workload runs on Azure yet.
Goal (user, 2 October): move the running cost from Google to Azure. Approach
chosen: **two stages**. Stage 1 moves the automations (about 75% of the Google
bill); new state that Stage 1 introduces lives in Azure, not Firebase. Stage 2
moves Firestore, Firebase Storage, login and the portal, then the Google project
is closed. Until Stage 2, the portal, login (Firebase Auth), Firestore and
Firebase Storage stay on Google.

## Current Google cost (estimate, 30 days to 2 October)

From Cloud Monitoring usage at Google list prices (not the invoice):

| Service | Usage | Approx. R/month | Share |
| --- | --- | --- | --- |
| Automation compute | `processExtraction` 2.28 M instance-s at 2 vCPU / 8 GiB; Open API sync 0.6 M; rest small | 2,800–3,000 | ~75% |
| Firestore | 35.9 M reads, 16.3 M writes, 5.4 GB | 450–850 | ~15–20% |
| Firebase Storage | 17.4 GB stored, 161 GB egress | ~300 | ~7% |
| Scheduler, Hosting, Auth, secrets, builds | small | ~100 | ~2% |
| **Total** | | **~3,700–4,300** | |

The 161 GB of Storage egress for 17 GB stored suggests repeated downloads of the
same objects; investigate in Stage 1 whatever the target cloud. Salesforce, display compliance and Perfect Store
were removed first (see `salesforce-automation-removal-20261002.md`), which also
removes the Salesforce workbook-calculation blocker in
`azure-automations-preparation-20260922.md`.

## What moves

| Family | Today (Google) | Measured load | Azure target |
| --- | --- | --- | --- |
| Geo Rep blueprint batch | `runScheduledExtractions` → `processExtraction`, API-based form reports | ~201 runs/day, ~3.5 min each, 06:00–09:40 | Queue-driven Container Apps job, 1 vCPU / 2 GiB, max 4 parallel |
| Geo Rep portal downloads | `processExtraction` (Puppeteer + Chromium, 8 GiB, 2 CPU): Attendance 11:30, Orders 12:00, Compliance Audit, Form by Sheet, DataOrbis | 2–5 runs/day, ~5 min | Chromium Container Apps job, 2 vCPU / 4 GiB, max 1 per Geo login |
| Attendance trackers and publishers | Tracker updates (SharePoint workbooks), `publishAzureAttendance`, `refreshPublicFranchiseOrders` | 2–4 runs/day, 1–3 min | Same job image; publishers write the existing Azure dashboard blob directly |
| Geo Rep API sync and retries | Open API sync (30 min), sales API import (08:00), blueprint/campaign retries (15 min) | Short, frequent | Timers in the dispatcher, work in the API job |
| ETL | `meridianEtl` → Cloud Run job `nexus-inventory-etl` (1 vCPU / 2 GiB) | 32 runs/30 days, avg 3 min | Same image as a Container Apps job |
| Sales Insights | Daily 07:20 snapshot → job `sales-insights-pipeline` (4 vCPU / 8 GiB); service `sales-insights-query` | 28 runs/30 days, avg 2.4 min | Container Apps job + scale-to-zero container app |
| Stock Fix | Hourly SharePoint sync; job `stockfix-pipeline` (4 vCPU / 8 GiB, 2 h limit) | 5 runs/30 days, avg 8 min, max 32 | Container Apps job; hourly timer in dispatcher |
| Chat/support jobs | Reminders (5 min), support upload cleanup (03:40) | Short | Timers in the dispatcher |
| Control plane | `runScheduledExtractions` (1 min), `detectStalledExtractionRuns` (2 min) | Always on | One small always-on dispatcher app (0.25 vCPU / 0.5 GiB) |

Stays on Google in this phase: user-facing callables (start/abort/retry runs,
saves, dashboards), Firestore-triggered handlers tied to portal writes
(file uploads, imports, chat notifications), Hosting and Auth. Workers keep
reading and writing Firestore and Firebase Storage, so the portal sees runs exactly
as today. A queued run is claimed by either Google or Azure, never both, through
a per-family `executor` flag checked in a Firestore transaction.

## Azure design

- Resource group `rg-meridian-nexus-automations`, South Africa North, separate
  from the live dashboard plan.
- Container Apps environment (consumption), Azure Container Registry (Basic),
  Storage queues for work items, Log Analytics, Key Vault.
- Identity: one user-assigned managed identity per family. Google access uses
  Workload Identity Federation (no exported Google keys) with Firestore/Storage
  roles scoped like today's service accounts. SharePoint keeps the existing Entra
  app (secret moved to Key Vault). Geo Rep and DataOrbis credentials stay encrypted
  in Firestore; only the decryption key moves to Key Vault.
- Schedules stay in SAST business time: the dispatcher reads each retailer's
  `reportSchedule` exactly as `runScheduledExtractions` does (Attendance 11:30,
  Orders 12:00, blueprint 06:00).
- Keep the Geo protections learned this week: one Geo login session at a time,
  Attendance/Orders after the blueprint batch, Orders refresh pointer, publisher
  date checks.

## Cutover order (each needs its own go-ahead)

1. **Foundations:** resource group, registry, environment, identities, Workload
   Identity Federation, Key Vault, alerts. No business writes.
2. **ETL, Sales Insights, Stock Fix:** already containers; lowest coupling.
   Shadow-run into isolated outputs, compare, then switch the trigger.
3. **Geo Rep API family:** blueprint batch, API sync and retries. Shadow one
   day's batch to a test folder, compare workbook hashes and row counts, then
   switch `executor` for `geo-rep`.
4. **Geo portal downloads, trackers and publishers:** Chromium job. Shadow
   Attendance and Orders into test outputs for two days before switching.
5. **Control plane and chat jobs:** move the dispatcher timers last, then disable
   the matching Google schedulers.

Per family: disable the Google trigger, drain active runs, switch, verify two
scheduled cycles (and a month boundary for monthly work). Rollback is to flip
`executor` back and re-enable the Google trigger; old functions stay deployed
until the family has been stable for two weeks.

## Monthly cost estimate (South Africa North, excluding VAT)

Rates from the Azure retail price API on 2 October 2026 (FX about R16.45/USD):
vCPU $0.000024/s, memory $0.000003/GiB-s, after the free 180,000 vCPU-s and
360,000 GiB-s per month.

| Item | Basis | Approx. R/month |
| --- | --- | --- |
| Container compute | ~1.5 M vCPU-s and ~3.0 M GiB-s, mostly the blueprint batch | 650 |
| Always-on dispatcher | 0.25 vCPU / 0.5 GiB, mostly idle | 100 |
| Container Registry Basic | R2.74/day | 85 |
| Storage queues, blobs, Key Vault | Low volume | 40 |
| Log Analytics | ~3 GB/month ingestion | 140 |
| Cross-cloud traffic | Firestore/Storage reads from Azure (Google egress) | 40–150 |
| **Total** | | **about R1,000–1,300** |

Google compute charges for each family drop as it is switched off; Firestore,
Storage, Hosting and Auth charges continue. No budget alert exists on this
subscription today; the plan adds one at R1,500/month.

## Stage 2: data, login and portal (after Stage 1 is stable)

| Google today | Azure target | Notes |
| --- | --- | --- |
| Firestore (79 collections, 5.4 GB) | Azure Cosmos DB for NoSQL, serverless | Closest document model; collection-by-collection copy with counts and hashes; dual-read check before switch |
| Firebase Storage (17.4 GB) | Blob Storage (private) | Copy by prefix; keep object paths so file records stay valid |
| Firebase Auth | Microsoft Entra ID | Staff sign in with company accounts; map existing roles |
| Callable functions (~70) | Azure API on Container Apps | Same request/response shapes so the portal changes little |
| Firestore listeners (live run progress, chat) | Azure Web PubSub or short polling | Decide per screen |
| Firestore-triggered functions | Queue messages raised by the API/workers | Replaces document triggers |
| Hosting | Azure Static Web Apps (Standard) | Same domain options |

Stage 2 Azure estimate: Cosmos DB serverless ~R600 (about 150 M request units
from today's read/write volume), Static Web Apps ~R150, API compute ~R150–300,
Blob/egress ~R50, real-time messaging R0–800 depending on the choice: about
**R950–1,900/month**. After cutover the Google bill should drop to near zero and
the project can be closed (after a retention export).

**Combined after both stages:** about R2,000–3,200/month on Azure, against
~R3,700–4,300/month on Google today.

## Decisions needed (Stage 1)

1. Approve the resource group and the cost range above.
2. Approve the Google Workload Identity Federation pool and scoped roles for the
   Azure identities.
3. Approve moving the SharePoint app secret and the retailer credential key to
   Azure Key Vault.
4. Confirm the order (recommended: ETL/Sales Insights/Stock Fix first; Geo Rep
   API second; Geo portal downloads after two days of matching shadow runs).
