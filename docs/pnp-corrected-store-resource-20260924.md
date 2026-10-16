# Corrected Pick n Pay Store Resource

User request: replace the active store name clean-up Resource with the supplied
corrected workbook and confirm when Anchor / Pick n Pay can be rerun.

Source: `C:/Users/PC/Downloads/OneDrive_2_9-24-2026/SALES DATA STORE NAME CLEAN UP .xlsx`.
SHA-256: `a0a63c1cb161f9b4f7a13b8f8af1b51918ca2cbb7e07d74e68172c82077f0cbd`.
Size: 2,033,683 bytes; 37,602 mapping rows. Uploaded byte-for-byte unchanged.

## Active Reference

- Existing Resource ID: `inventory-anchor-stores`.
- Title: Store name clean-up - corrected 24 September 2026.
- Anchor/PnP reference-set revision: 3 (previously 2).
- The previous private file and historical Resource versions are retained.
- Existing completed runs, their pinned references and approvals are unchanged.
- No business ETL run or output approval was started by this update.
- No application code deployment, schedule or permission change is required.

## Validation

The source passed the deployed worker's workbook/schema checks. Ten existing
Excel error cells are preserved and reported in the workbook's reference-error
audit; they were not silently replaced with invented values.

Local replay uses the available Anchor inventory sample as of 1 September
2026, not a new production run. Other local references match the active Resource
hashes, including the 23 September national call-cycle master.

- 3,462 input rows: 3,430 store rows and 32 DC rows.
- 3,421 ready store rows; 9 blocking rows, down from 75.
- 152 rows have accepted non-blocking mapping warnings.
- Store SOH reconciles: 141,358 = ready 141,000 + blocking 358 + excluded 0.
- DC SOH remains separate at 131,372.

Two remaining source-store conflicts in the corrected workbook:

| Source Store | Clean-up Rows | Conflict | Affected Inventory Rows |
| --- | --- | --- | --- |
| EF33 / Family Newton Park | 15725 and 35146 | Canonical code EC03 versus EF33, both named PNP FAMILY NEWTON PARK | 7 |
| WD02 / Kenilworth Campus | 19040, 19041 and 35631 | Blank canonical code versus WD02, both named PICK N PAY CAMPUS KENILWORTH | 2 |

These are not waived missing-alias warnings. The supplied workbook is activated
as requested without choosing a canonical code on the user's behalf. Manual
reruns are available, but these rows still require review before final approval
when present in the selected raw inventory file.

## Evidence

Update script: `scripts/replace-pnp-cleanup-20260924.cjs`.
Audit, upload checksum, validation workbook and live metadata verification:
`.tmp/pnp-corrected-stores-20260924/`.

The storage object is create-only and private, with no public download token.
Resource and reference revision are activated atomically using update-time
preconditions. Refresh Nexus ETLs, select Pick n Pay / Anchor, then New run.
