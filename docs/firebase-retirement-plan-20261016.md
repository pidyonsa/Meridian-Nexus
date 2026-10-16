# Retire Nexus Firebase, everything on Azure (plan, 16 October 2026)

Decision (user, 16 October): retire the Nexus Firebase/Google project completely and run all of
Nexus on Azure. Live database: Azure SQL `free-sql-db-6809066` (Standard S2). Test/fallback:
`nexus-test-free` (free offer). Public address: https://nexus.meridiangroup.co.za.

## Already on Azure

| Area | State |
| --- | --- |
| Attendance and Orders dashboards | Azure App Service, custom domain + managed certificate |
| Geo Rep Attendance (11:30) and Orders (12:00) downloads | Azure worker since 5 Oct (hand-off + dispatcher) |
| Geo Rep blueprint batch (06:00, ~200 runs) | Switched to Azure 16 Oct, first batch 17 Oct |
| ETL processing | Azure job since 4 Oct |

## Still on Google, and where it goes

| Google piece | Azure replacement | Phase |
| --- | --- | --- |
| SharePoint tracker updates (processExtraction tracker modes) | Same Azure worker (drop the tracker exclusion from the hand-off) | A |
| Azure publishers (`publishAzureAttendance`, `refreshPublicFranchiseOrders`) | Azure jobs; later the dashboards read SQL directly | A/B |
| Scheduler and control plane (`runScheduledExtractions`, stalled-run checks, retries) | Azure dispatcher reads retailer schedules in SAST | A |
| DataOrbis and other portal downloads | Same worker, same switch | A |
| Firestore (73 collections, ~440,000 documents) | Azure SQL S2 (JSON document tables, then normalised where useful); copy also to `nexus-test-free` | B |
| Firebase Storage (~17 GB) | Azure Blob Storage (private), same object paths | B |
| Portal callables (~70 functions: admin, ETL, chat, support, files, dashboards) | Azure API (App Service / Container Apps), same request/response shapes, reading SQL + Blob | C |
| Firebase Auth (42 users, password sign-in) | Microsoft Entra ID: 41 users already have Meridian accounts; roles via Entra groups | C |
| Portal hosting (`meridian-nexus.web.app`) | Azure at nexus.meridiangroup.co.za | C |
| Chat real-time updates and notifications | Polling or Azure Web PubSub; email/Teams for notifications | C |
| Secret Manager | Azure Key Vault (7 secrets already copied) | done |

## Phases

- **A: finish moving compute (1–2 weeks).** Trackers, publishers, scheduler, DataOrbis. After A,
  Google runs only the portal back end and data.
- **B: data (1–2 weeks, overlaps A).** Initial copy Firestore → SQL S2 and Storage → Blob, then an
  hourly incremental sync (by document update time) until cutover, with per-collection count and
  content checks. Needs: Entra admin on the SQL server and network access for the copy job.
- **C: portal and API (3–5 weeks).** Port the callables to an Azure API on SQL/Blob; switch the portal
  from the Firebase SDK to Microsoft sign-in (MSAL) and the Azure API; serve it at
  nexus.meridiangroup.co.za next to the dashboards. Run in parallel with Firebase and test with
  the 5 active users.
- **D: cutover and retirement (1 week).** Freeze Firebase writes in an agreed window, final sync,
  switch users to the Azure portal, verify. Keep a read-only Firebase export (Firestore + Storage)
  in Azure Blob cold storage. Disable Firebase Hosting, delete functions and schedules, and close the
  Google project after a 30-day safety period.

## Cost after retirement (monthly, ex VAT)

About R3,600–4,100 on Azure for Nexus (including SQL S2 ~R1,770), replacing Google's
~R3,700–4,300. Google drops to R0 once the project is closed.

## Decisions needed

1. The one `@nexus.co.za` user: Entra guest invitation or a Meridian account.
2. A cutover window (for example a Friday evening) and who tests with us beforehand.
3. How long to keep the Firebase archive (suggested 12 months in cold storage, a few rand a month).
4. Database access for the copy (Entra admin on the SQL server).
