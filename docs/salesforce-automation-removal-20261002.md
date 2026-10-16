# Salesforce, Display Compliance and Perfect Store removal (2 October 2026)

User request: remove all Salesforce automations, display compliance automations
and P&G Perfect Store from Firebase/Google (compute deleted, business data kept).
The separate Azure P&G hub (`rg-pg-display-compliance`: KBDII, Trax, Main Fee,
Sales Fund, Call Cycle, P&G attendance, display compliance; P&G Reports Hub;
`pg-perfectstore-mail` Logic App) is in daily use and was deliberately left alone.

## Removed (script `scripts/remove-salesforce-automations-20261002.cjs`)

- 5 Cloud Scheduler jobs: Salesforce monthly plan setup and blueprint
  provisioning (5 min), report-load retry (1 min), expired-worker finaliser
  (5 min), display compliance phase-two reconcile (15 min).
- 26 Cloud Functions: 15 Salesforce (attendance dashboard, SmartSell masters,
  blueprints, monthly plan/provisioning, connected-app test) and 11 display
  compliance (batches, phase two, channels, template folder, triggers).
- Retailers and profiles: `sales-force-p-g`, `sales-force-p-g-monthly`
  (was failing daily at 09:00), `salesforce-display-compliance-automation`,
  `p-g-perfect-store`, and their four extraction profiles.
- Stored credentials and session state for those retailers (`retailerSecrets`,
  `retailerSessions`, `salesforceMfaState`, `salesforceBrowserLeases`). Not backed up.
- The 26 `exports.*` statements in `functions/index.js` (parser-based removal;
  the module loads and exports the other 99 functions), so a later deploy cannot
  recreate them. Internal Salesforce helpers/branches remain as dead code and
  will not be ported to Azure.

Before removal: schedules disabled, jobs paused, no active runs. Configuration
backup (no secrets) and the previous `index.js`:
`.tmp/remove-salesforce-automations-20261002/`.

## Kept

Firestore business data (extraction runs, SmartSell/attendance masters, workbook
snapshots, display compliance batches), uploaded files and SharePoint outputs.

## Open

The portal (`public/app.js`, `public/index.html`, about 600 references) still
shows Salesforce, display compliance and Perfect Store screens, which now fail
when used. Local hosting files differ from live, so the UI cleanup needs a
reviewed hosting release.
