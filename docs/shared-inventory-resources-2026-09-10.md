# Shared Inventory Resources

Deployed 10 September 2026. Scope: existing Anchor / Pick n Pay No-ETLs pipeline.

## User Workflow

Open **Resources > Shared inventory files**. The following files are loaded and assigned:

| Role | Saved source | Data rows |
| --- | --- | ---: |
| Product List | Product List.xlsx | 7,199 |
| Store name clean-up | SALES DATA STORE NAME CLEAN UP .xlsx | 37,618 |
| Store / call-cycle master | National_Call_Cycle_Masters 01.09.2026.xlsx | 19,604 |
| DC mapping | DC Mapping File.xlsx | 1,891 |
| PnP status codes | PNP Status Codes.xlsx | 23 |
| Inventory template | Inventory Template.xlsx | 0 |

The five master workbooks are unchanged copies from the previously supplied Anchor folder. The inventory template is a blank copy of the approved 17-column layout from `Transformed Inventory File- Anchor.xlsx`, retaining header/row styles and column widths but no business rows or formulas. The accepted output remains unchanged on disk.

For a new run, open **No-ETLs > New run**, upload or select the raw inventory report, confirm the existing processing rules and run. Shared masters and the template are resolved on the server and snapshotted by Storage generation before processing.

To update a master, use its pencil button in Shared inventory files and replace the file in the existing Resource. This keeps the Resource ID, updates its file version, and changes future runs without changing completed snapshots. To choose a different Resource, select it in the shared-file panel and click **Save shared files**. The displayed set revision tracks assignments, while individual file versions remain in the Resource catalogue.

Missing, archived or deleted assigned Resources block a run rather than select a different master automatically. A stale shared-set revision also requires a refresh. Rules and output approval remain explicit; this pipeline does not publish to Stock Fix or Insights.

## Implementation

- Shared assignments: server-only `etlReferenceSets/anchor-pnp-v1`, revision 1 on initial import. Six Resources have IDs `inventory-anchor-{products,stores,staffing,dc,status,template}`.
- Fresh active staff-administrator authorization remains required by the ETL callable. No new user permissions, roles, Firestore rules or IAM grants were deployed.
- Saving a set requires six distinct active XLSX Resources, bounded file sizes, validated Storage prefixes and a transaction revision check. Per-run reference overrides are rejected once shared defaults exist.
- The API resolves current Resource objects and pins generations into the existing `etl-run-inputs/{runId}/` path. The optional template participates in the run fingerprint and manifest. Historical manifests without a template remain supported.
- The worker accepts one blank `Template` sheet with the existing 17-column contract. It rejects extra sheets, changed headers, merged cells, tables, populated rows, formulas, macros and external connections. Output data are generated anew; audit/exception sheets remain controlled by the worker.
- No raw inventory run, retailer extraction or downstream publication was started during this release.

## Verification

- 23 API/worker tests passed, covering authorization, stale revisions, missing references, override rejection, replacements, pinned generations, deduplication and template validation/style preservation.
- Synthetic full-portal browser tests passed for Nexus auth/sidebar integration, six shared slots, edit-without-upload, template creation defaults, saved-set reuse after navigation, raw-only runs, processing-rule confirmation, output review/download, mobile widths 390/320 and sign-out isolation.
- Resource uploads were size- and MD5-verified against local source bytes. SHA-256 hashes are retained in the import manifest and Resource metadata. No Firebase public download tokens were added.
- Anonymous requests to the shared-settings document, template object and staffing-master object returned **403**. Anonymous ETL API access returned **401**.
- A signed-in production ETL run was not executed; UI/workflow tests used synthetic fixtures.

## Release Evidence

- Hosting: `28cb9f9bb7f6e532`, verified 2026-09-10 04:29:01 UTC. Seven assets changed; every other live asset hash was retained, including the previous Pick n Pay setup notice.
- API: `meridianetl-00003-vev`. Existing runtime account, memory, CPU, timeout, concurrency, instance limit and environment were verified unchanged.
- Worker build: `cceea1bd-390f-4e33-8f4c-95ae1c931bbe`; image tag `20260910-shared-files`, deployed by immutable digest. Only the image changed in the existing job task specification.
- Evidence: `.tmp/etl-references-20260910/`, including `resources/verified.json`, `job.after.json`, `api.after.json`, `created.json` and `verified.json`.
- Rollback: restore the prior Hosting manifest from `before.json`, the prior ETL API source and the previous worker image from `job.before.json`. Preserve the six Resource files and completed run snapshots. Coordinate the API/UI rollback because the old UI does not send a shared-set revision.

The separate full-Admin-role rollout remains outside this change and was not activated.
