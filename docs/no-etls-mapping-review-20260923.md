# Anchor/PnP Mapping Review

## User Decision

Keep liquor stores eligible. Leave conflicting matches for review; do not select
the first XLOOKUP result or exclude liquor stores to force a mapping.

## Findings

Input: `C:/Users/PC/Downloads/Anchor-PnP-2026-09-15-inventory-draft.xlsx`.
Original run: `544d7302e2729c1938aad0bcd0fe1449`.

The original store and staffing references are locally available. Their SHA-256
values exactly match the original run's Audit sheet, so the review can separate
the original reference decisions from the user's embedded updated references.

Code plus source name is not always unique. For example, `WC18` and `Claremont`
resolve to both `PNP SUPER CLAREMONT` and `PICK N PAY LIQUOR CLAREMONT`.
Both also exist in the active national call cycle. XLOOKUP returns the first
candidate, whereas the pipeline correctly refuses an ambiguous canonical store.

The original draft contains:

- 1,745 store-mapping warnings.
- 1,774 region warnings, including 1,745 cascading warnings caused by the
  unresolved store rather than a separately checked region. 29 remain for review.
- 87 DC-mapping and 8 product-mapping warnings, not changed by this repair.
- 1,707 accepted inventory rows and 1,781 unresolved source rows. Diagnostic
  changes do not make those unresolved rows eligible for approval.

The embedded references differ on four source keys:

- `EC31 / EM Mdantsane`: an added unique alias affecting seven source rows.
- `GD57 / Local Fleurhof`: an added unique alias affecting eight source rows.
- `GC07 / The Glen`: changed candidates, still conflicting.
- `GF44 / Family Upington`: previously unique, conflicting in the attachment.

These differences are documented, not automatically published to Resources.

## Repair

- Use an explicit normalized code/name tuple index with the same exact-name
  preference and unique-code fallback as before. Do not change eligible banners.
- Group store reference candidates by distinct canonical code/name/banner.
  Repeated aliases can no longer occupy all 12 preview slots and hide a liquor
  candidate. Include alias counts and representative source row numbers.
- Defer region validation when the canonical store is unresolved or invalid.
  Keep the store error, unresolved stock, review status and approval block.
- Add source-key and candidate-count columns to new exception workbooks. The
  inventory Template remains the same 17-column contract.

## Validation And Release

40 tests passed. A real historical source replay against the previous deployed
engine confirms identical inventory facts, totals, assignments, DC facts,
unresolved source rows, reconciliation and approval state. The deployed container
also passes offline ready, missing-store and supermarket/liquor-conflict cases.

Only `engine.cjs` changes in the production worker. Its manifest contract,
resources, approved references, runtime limits, IAM, portal and other functions
remain unchanged. No production inventory run is started by the release.

Evidence: `.tmp/etl-mapping-diagnostics-20260923/verified.json`.
Review workbook:
`.tmp/anchor-pnp-mapping-review-20260923/Anchor-PnP-2026-09-15-mapping-review.xlsx`.

The user's original workbook is unchanged. The September 15 raw source was not
reprocessed; the new workbook is a mapping review, not an approved inventory file.
The existing historical draft remains as recorded. Correct the approved
references, then create a new run: Retry is only available for failed runs, and
identical inputs reuse the original run.
