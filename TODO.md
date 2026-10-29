# Meridian Nexus on Azure: to do

Started 29 October 2026; last updated 29 October 2026, 13:45 UTC. Tick items off (`[x]`) as they are done; add new ones
at the end of their section.

Live site: https://nexus.meridiangroup.co.za (Azure App Service `meridian-field-dashboards`, resource group
`rg-meridian-field-dashboards`, South Africa North). Code: this folder, built from `azure-portal` into
`azure-field-dashboards`; GitHub `pidyonsa/Meridian-Nexus`, branch `azure-migration-stage1`.

## 0. Urgent

- [ ] **Geo Rep API sync has failed every hour since 28 Oct 13:05 UTC** (`job-nexus-geo-api-sync`,
      `rg-meridian-nexus-automations`; last success 28 Oct 12:05 UTC). Every run logs: *"Geo Rep rejected the configured
      API credentials, or Open API access has not been enabled for the Meridian client. Ask Geo Rep to validate the API
      ID, API…"*. Ask Geo Rep to check the Meridian API ID/key and Open API access; if they issue new credentials,
      update the secret the job reads. Nothing in Nexus's code changed around that time. Everything that reads Geo Rep
      API data is going stale until this is fixed.

## 1. StockFix tab: release

- [x] Deploy the Adoption fixes (`a17f8a7`, deployment `c006caaa…`, 29 Oct 13:18 UTC).
- [x] Push to GitHub as `pidyonsa` (`azure-migration-stage1` and `stockfix-tab`).
- [x] Check StockFix › Adoption against https://stock-fix.replit.app/adoption/: the live data gives the same figures
      (week ending 21 Oct: Reps 106 of 180, 58.9%; Merchandisers 894 of 2,134, 41.9%; coverage 1,043 of 3,469).
- [x] Check the SharePoint data behind Overview, Leaderboard, Action impact and Store detail: the folder exists and
      was rebuilt 22 Oct 09:30 UTC, half an hour after the week ending 14 Oct was exported; 51 week files.
      `leaderboard_rollup.json` is ~140 MB, so loading was made lean (names shared in memory, two weeks kept).
- [x] `dashboard-data` is rebuilt after the weekly cycle (seen for the week ending 14 Oct).
- [x] Record the StockFix releases in `azure-field-dashboards/DEPLOYMENT_STATUS.md` (four deployments, 29 Oct).
- [x] Adoption parts that were missing: Month view, custom period, store filter, Excel exports (resources, managers,
      stores, captures) and the Captures page. Deployed 29 Oct 13:35 UTC (`e7b6c6d8…`).
- [x] StockFix › Data Admin (admin-only entry with no page): removed.
- [ ] **Look at the StockFix tab signed in** (any Meridian account) and confirm the four SharePoint tabs load with real
      data; the first open of a week downloads its file, so allow a few seconds.
- [ ] Optional, for you to add (Claude Code may not change its own permissions): to let releases deploy without a
      prompt, add this to `C:\Users\PC\.claude\settings.json` under `"permissions": {"allow": [...]}`:
      `"PowerShell(& 'C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\wbin\\az.cmd' webapp deploy --subscription 02b268fe-e01a-453e-b287-eec83ccc0676 --resource-group rg-meridian-field-dashboards --name meridian-field-dashboards --src-path dist/meridian-field-dashboards.zip *)"`

## 2. StockFix app (Replit): risks to resolve with its owners

- [ ] **Its data API has no sign-in.** `/api/live-dashboard`, `/api/adoption-snapshot`, `/api/admin/adoption-*`,
      `/api/roster/*` (and, per the handover `DEVELOPER.md` §5, the admin weekly-cycle endpoints) answer anyone with the
      address. Add authentication; then give Nexus its key through Key Vault and update
      `azure-portal/server/stockfix/adoption.cjs`.
- [ ] **Ownership**: several StockFix accounts and secrets are tied to Carin's personal logins
      (`stockfix-backend/handover/system-ownership-transfer-plan.md`). Move them to Meridian-owned accounts.
- [ ] **Secret expiry**: the backend's `GRAPH_CLIENT_SECRET` expires; find the date and set a reminder.
- [ ] **Hosting**: the app runs on Replit with its database on Neon, outside Meridian's Azure; its backend
      (`stockfix-validate`, `stockfix-rg`) is in North Europe. Decide whether to move them to Azure South Africa North.
- [ ] **Two versions of the Adoption page**: the one Replit serves is older than the code in `cpillay2404/Stockfix`,
      and they count Rep/Merchandiser adoption differently. Nexus matches the served page. If Replit is redeployed
      from the repo, recheck Nexus (`adoptionModel` in `azure-portal/server/stockfix/adoption.cjs`).
- [ ] **One weekly-cycle scheduler**: both the Azure orchestrator (every 3 min) and the Replit app's own 4-hourly cycle
      exist; confirm only one runs.
- [ ] **Unmerged branches newer than the default branches**: `Stockfix` `clean-comments`; `stockfix-backend`
      `remove-pg-code`, `fix/store-current-stable-paging`, `pspro-next`. Merge or close.

## 3. Firebase retirement (plan of 16 October: `docs/firebase-retirement-plan-20261016.md`)

Status checked 29 Oct 13:40 UTC. Azure automation jobs (`rg-meridian-nexus-automations`): dashboard publisher,
Geo Rep dispatcher and worker, run scheduler, retries, stalled-run check, ETL, daily sales API import and the hourly
Firestore → SQL sync all succeeded on their latest runs; the Geo Rep API sync is failing (section 0). On Azure since the
plan: Sales dashboard, Report automation, Resources, ETLs, Extraction profiles, Geo attendance, SharePoint inventory,
Admin › Users and permissions, StockFix.

- [ ] **Phase A, compute**: confirm SharePoint tracker updates and DataOrbis runs end to end on the Azure worker.
- [ ] **Phase B, data**: Firestore is still the system of record (the Azure Admin tools read and write it through the
      Google link; SQL holds an hourly copy). Plan the switch to SQL as the record, and Firebase Storage (~17 GB) →
      private Blob Storage, with per-collection count and content checks.
- [ ] **Phase C, portal and API**: tools that still open the Firebase-era Nexus: Call Cycle Control Centre,
      Connect › Jem, Chat, Support, Training. Move the Admin tools from Firestore/Storage to SQL/Blob; replace the
      Firestore-triggered functions.
- [ ] **Phase D, cutover** (needs your decisions first): agree a window and testers, freeze Firebase writes, final
      sync, verify, keep a read-only export in Blob cold storage, disable Firebase Hosting and functions, close the
      Google project after 30 days.
- [ ] **Decisions**: cutover window and who tests; how long to keep the Firebase archive (suggested 12 months);
      Entra admin on the SQL server for the copy.

## 4. Housekeeping

- [x] Local preview: Admin › Users now works (the preview mounts `/api/permissions` with an in-memory store); the
      browser check passes on all 15 pages at desktop and phone size.
- [x] `azure-nexus/` (never-provisioned stage-1 Cosmos edition) removed from the repo and moved to
      `C:\Users\PC\MeridianNexus - Azure - Temp Archive\azure-nexus-stage1-archived-20261029`.
- [x] Stray `grep.exe.stackdump` deleted.
- [x] StockFix reference copies deleted from the Temp Archive.
