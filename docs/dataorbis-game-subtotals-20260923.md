# Game Subtotal Exclusion

The user confirmed that Game export rows with `Total` in column A,
`date F454_YYYYMM`, are subtotals and must not enter the final monthly sales sheet.

## Rule

- Game excludes date-column `Total` rows before mapping, duplicate-detail checks,
  sales reconciliation and output generation. Matching ignores case and outer
  whitespace, but does not match other labels such as `Total sales`.
- Subtotals can aggregate multiple detail rows or occur in partial blocks; Game
  no longer requires a one-to-one duplicate of every detail row.
- Raw exports remain unchanged. Removed rows and source row numbers appear only
  in the audit workbook's `Excluded Subtotals` sheet, with reason
  `game-date-subtotal`.
- The portal's independent dated summary is still reconciled against dated
  detail. Quantity/value mismatches and exports containing only subtotals fail
  validation. Subtotals cannot inflate the monetary rounding allowance.
- Existing numeric validation, date restrictions, mapping checks, other-client
  preservation, Game Online/non-SA exclusions and duplicate-batch prevention
  remain in force.
- Makro/Jumbo's existing verified-duplicate rule is unchanged.

## August Verification

The captured Wilmar August export was replayed through the updated transformer.
All sales records, totals and the batch digest exactly match the verified output:

- 619 Game subtotal rows excluded.
- 1,516 Wilmar rows in the final file, including 607 Game rows.
- 180,453 total rows; 178,937 pre-existing rows preserved.
- Zero `Total` values in the final workbook's date column.
- `Aug26- ALL Clients by SKU.xlsx` is unchanged, SHA-256:
  `b26b90cc8c804bb1747c63193d7134b2e116b1b279966dabf8d451cdb7ba9611`.

The previously saved raw export and audit are historical evidence and are not
rewritten. Future audit workbooks use the new sheet name. No fresh portal login,
OTP request or production extraction was started.

## Validation And Release

32 focused tests passed, including aggregate/partial subtotals, case/whitespace
handling, column-specific exclusion, portal-summary reconciliation, final XLSX
read-back, other-client preservation, OTP ownership and run idempotency.

Release evidence is under `.tmp/dataorbis-subtotals-20260923/`.
Only `dataorbis-sales.js` and `dataorbis-portal.js` are replaced in a fresh snapshot
of the deployed `processExtraction` function. Hosting, No-ETLs, other function
revisions, credentials, IAM, runtime settings and the Eventarc trigger are checked
for preservation. `verified.json` records the completed live verification.
