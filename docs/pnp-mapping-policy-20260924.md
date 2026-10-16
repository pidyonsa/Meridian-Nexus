# Anchor / Pick n Pay Mapping Policy

Policy: `pnp-nonblocking-mappings-no-liquor-20260924`.

## Approved Scope

Applies only to new Anchor / Pick n Pay inventory runs. Does not alter the
shared national master, other customers, DataOrbis extraction, Attendance,
Orders, or schedules.

- DC, product and region mapping errors are non-blocking warnings.
- Missing PnP site-code aliases are non-blocking warnings. Preserve the raw
  site code/name and article code/description; do not invent canonical values.
- Unknown DC balances remain blank, never zero.
- Exclude all identifiable Pick n Pay Liquor candidates and source rows,
  including standalone liquor stores, per the latest instruction. This
  supersedes the earlier policy to retain standalone liquor for this adapter.
- Exact source code/name aliases are considered before code-only fallback.
  A liquor row cannot fall back to a supermarket sharing its code.
- Conflicting non-liquor canonical mappings, invalid numeric data, duplicate
  source rows, invalid identifiers/dates/profiles and unresolved statuses
  remain blocking. A source row containing invalid quantities is not hidden
  by the liquor exclusion.

## Outputs and Approval

The workbook includes Accepted Warnings and Excluded Stores sheets alongside
Exceptions. Review and Outputs show bounded previews with the complete audit
retained in the workbook. SOH reconciliation includes excluded liquor stock:

`source = included + blocking exceptions + excluded liquor`

Approval remains an explicit administrator action. Warnings alone do not block
approval; real blocking exceptions still do. No automatic Stock Fix or Insights
publication is added.

The server pins the policy in each manifest and run fingerprint. New runs do
not reuse old drafts. Existing manifests without the new policy keep their
previous behavior; historical workbooks and approvals are not rewritten.

## Local Replay

Source: `PnPSiteDaysCover_20260902082929- PNP INVENTORY RAW.xlsx`, inventory as
of 1 September 2026, with the 23 September national master and the active
24 September cleanup mapping. This is not a live September 15 rerun.

- 3,462 source rows: 3,430 store rows plus 32 DC rows.
- 3,355 ready store rows, up from 1,645 under the previous policy.
- 75 blocking rows across 11 source store identities.
- 152 rows have accepted mapping warnings; warning categories can overlap.
- No explicit liquor source rows in this sample; liquor candidate removal
  resolves ambiguity without deleting supermarket inventory.
- Source store SOH 141,358 = included 138,911 + blocking 2,447 + excluded 0.
- Separate DC SOH 131,372. Reconciliation passed.

Remaining source stores: GG18 Tembisa (6 rows), KC03 Umhlanga Crescent (8),
GC74 Secunda Mall (8), WF09 Family Ceres (7), EF33 Family Newton Park (7),
GH52 Family Sasolburg (8), EC23 Southernwood (5), KC60 Kloof (8),
KC59 Westville Junction (8), WD23 Willowbridge (8), WD02 Kenilworth Campus (2).
These are non-liquor code/name/banner conflicts, not waived missing aliases.

Local evidence: `.tmp/pnp-policy-validation-20260924/`.
Scoped release evidence: `.tmp/pnp-mapping-policy-20260924/`.
Release script: `scripts/release-pnp-mapping-policy.cjs`.
No real business run is started by the release script. After deployment,
refresh Nexus and create a New run for Anchor / Pick n Pay.

## Deployment Verified

- Hosting: `0b46c4b9a44f9959`.
- ETL API: `meridianetl-00009-rok`.
- Worker image digest: `sha256:ccdb68e2fb49ed1785771029dffb42205a9e22cee5f38ce2936ee9f9324467fa`.
- Build: `49058b25-30ee-4f4f-ad92-4c089cec8691`.
- 56 focused tests passed; cloud container fixture tests passed offline.
- Mocked browser flows passed at 1440, 390 and 320 pixels, including
  warnings, liquor exclusion totals, downloads, approval and sign-out.
- Live source/assets, runtime settings, IAM and other automation function
  revisions verified unchanged except the scoped ETL changes.
- No production business run or approval performed by this release.
