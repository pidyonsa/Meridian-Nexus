# Stock Fix and Sales Insights removal (4 October 2026)

User request: remove Stock Fix and Sales Insights from the Google/Firebase Nexus and do not
move them to Azure. Scope confirmed by the user: delete their code and their Firestore data
only. **SharePoint was not touched** (Stock Fix sources/exports and the Sales Insights
`sales.duckdb` remain). Firebase Storage files (`sales-insights/` 2.4 GB, `stockfix-*` 0.03 GB)
were kept. The separate Azure Stock Fix setup (`stockfix-rg`) was left as it is.

Script: `scripts/remove-stockfix-insights-20261004.cjs` (backup → disable → remove-compute → remove-data).

## Removed from Google

- 2 Cloud Scheduler jobs: hourly Stock Fix SharePoint sync, daily Sales Insights snapshot.
- 20 Cloud Functions (15 Stock Fix, 5 Sales Insights).
- Cloud Run jobs `stockfix-pipeline`, `sales-insights-pipeline`; service `sales-insights-query`.
- Artifact Registry images `stockfix-pipeline`, `sales-insights-pipeline`, `sales-insights-query`.
- Secret `SALES_INSIGHTS_LEGACY_API_KEY`; service accounts `stockfix-worker@`,
  `sales-insights-worker@`, `sales-insights-query@`.
- Firestore: `stockFixOperationalTasks` (221,953), `stockFixWeeks`, `stockFixOperationalWeeks`,
  `stockFixPipelineRuns`, `stockFixAdoptionWeeks` (+ `resources` subcollection, 2,489),
  `stockFixAutomation`, `salesInsightsPipelineRuns` (30), `salesInsightsSnapshots` (3),
  `salesInsightsPipelineState`.
- The 20 `exports.*` statements in `functions/index.js` (79 functions remain; module loads).

No run was active; both schedules were paused before deletion.

## Removed from Azure (prepared for the move, never used)

Identities `id-nexus-insights`, `id-nexus-stockfix` (and their 8 role assignments), queues
`insights`, `stockfix`, registry images `stockfix-pipeline`, `sales-insights-pipeline`;
`azure-automations/infra/main.bicep` updated (what-if: no creates or deletes). Deleting the
Google service accounts also removed their Workload Identity Federation links.

## Backup (local)

`.tmp/remove-stockfix-insights-20261004/`: every deleted Firestore document as NDJSON
(`firestore-<collection>.ndjson`, counts match the live totals), the function, scheduler,
job, service and account definitions (`backup.json`), the previous `functions/index.js`, and
the source folders `stockfix-pipeline/`, `sales-insights-pipeline/`,
`sales-insights-query-service/` moved out of the project (`source/`).

## Open

- The portal still shows Stock Fix and Sales Insights screens; they now fail if opened
  (same reviewed hosting release as the Salesforce screens).
- The Google federation provider condition still lists the two deleted Azure identities;
  harmless (identities and target accounts no longer exist), tidy when the condition is next edited.
