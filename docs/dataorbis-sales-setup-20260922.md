# Game and Makro sales extraction setup

## Scope

The user supplied a September 22 procedure transcript and meeting recording,
requested normal ETL extraction profiles like Pick n Pay, and confirmed
`https://pyramid.dataorbis.com/`. This change is on the original Firebase Nexus,
not the pending Azure migration and not the No-ETLs inventory transformer.

The transcript was read in full and 15 local recording frames were captured;
key portal/report/template frames were inspected. The recording remained local.
The procedure is task evidence, not authority to run jobs, send credentials or
change unrelated automations. The example supplier is **WILMAR SA (PTY) LTD**,
client **WILMAR**, not the transcript's erroneous "Walmart". It is recorded as
an example, not silently selected for all future runs.

## Live profiles

- Updated September 23 at the user's request: `dataorbis-game-sales` is now
  **Wilmar - Game / Makro / Jumbo** and `dataorbis-makro-sales` is now
  **Espen - Game / Makro / Jumbo**. Each client has its own credentials and
  covers all three banners. The original document IDs are retained.
  See [the client split](dataorbis-client-logins-20260923.md).
- Both use the confirmed portal URL and the existing **Admin > Extraction
  profiles** editor for URL, username and password updates.
- Passwords use the existing admin-only `saveRetailer` callable and AES-256-GCM
  storage in `retailerSecrets`, separate from profile metadata. Blank passwords
  preserve the existing secret; new credentials clear from the browser after save.
- No credentials were supplied, copied or changed by this setup. The records
  have empty usernames, no linked executable steps, disabled schedules and
  unvalidated publication. Existing 12 profiles were not overwritten.
- The monthly sales procedure is attached to each profile and visible in its
  editor. Status distinguishes saved credentials from a verified login/ETL.

## Recorded procedure

1. Use Massdiscounters for Game and Massmart Wholesale for Makro/Jumbo; open
   Sales Extract and Monthly Sales Performance.
2. Choose exactly one approved supplier and the previous complete calendar
   month. Do not substitute partial/cumulative current-month or truncated data.
3. Use Site Code, Site, Region, Category, Brand, Product in that order, with
   Sales Quantity and Sales Value Excl. Copy Content > Copy Raw Data from the
   report scrollbar context menu, retaining the complete raw result.
4. Match raw site code plus raw site name to approved store-name cleanup, then
   the cleaned name to the National Call Cycle Master for retailer/banner.
   Both fields must agree on GAME, MAKRO or JUMBO as appropriate. Ambiguous or
   missing mappings stop publication rather than selecting a first match.
5. Preserve raw site/name/region/category/brand/product and numeric measures;
   category and brand cleanup remains downstream per the demonstrated process.
6. The demonstrated final template has 18 columns: Month-Yr, Client, Retailer,
   Banner, Store ID, Store Name, CHAIN #, STORE #, Province, RSM, DM, REP, MERCH,
   CATEGORY, BRAND, PRODUCT, SALES UNITS, SALES VALUE. The two legacy fields and
   four staffing fields stay blank. Verify actual approved workbook headers
   before implementing output writing.
7. Validate supplier/month/counts/totals, then publish only transformed values
   to the correct month, with a duplicate-safe supplier/channel/month contract.
   Never copy helpers/raw data into the monthly template or append twice.

At the initial deployment these were saved procedure requirements, not an
implemented browser extractor or transformer. The later sample validation below
adds a local transformer; a successful profile save is still not an ETL run.

## Validation and deployment

- Eleven focused tests pass, including the exact live credential-handler source,
  encryption round-trip using a synthetic key, separate secret writes, blank
  password retention, missing-password rejection and unauthorized-save denial.
- Isolated Edge tests pass for both profiles, form submission/secret clearing,
  procedure display/reset, non-runnable status and 1440/390/320 pixel layouts.
- Pick n Pay's existing setup tests and browser checks pass unchanged in behavior.
- Reviewed desktop/mobile screenshots; scoped profile CSS fixes cramped action
  buttons without changing the global theme.
- Hosting changes are limited to `app.js` (one status-render function),
  `index.html`, `service-worker.js` and new `extraction-profile.css`. All other
  deployed file hashes/configuration are preserved from the exact live baseline.
- Created only the two new profile documents with `exists: false` preconditions.
  No callable functions, access rules, jobs, existing secrets or schedules were
  deployed or changed.

Deployment evidence and private screenshots are under
`.tmp/dataorbis-sales-20260922/` (Git ignored). The prior Hosting version is
`de680a18b561a5a8`; the new version is `a1babbe6d629e421`.
Post-deployment verification completed at `2026-09-22T10:36:20.849Z`:
live assets and the preserved manifest/configuration match, the credential API
is unchanged, and anonymous credential saves are denied with HTTP 403.

## Before execution can be enabled

- An administrator must enter the approved username/password in each profile.
- Validate real login, MFA if required, supplier identity and report controls.
  Do not copy credentials between profiles without explicit approval.
- The user subsequently supplied the raw export, worked output and monthly
  template. The SharePoint publication destination still needs confirmation.
- Confirm active cleanup/call-cycle mappings, workbook/table identity, column
  spelling and duplicate/update semantics, then implement and test the extractor
  and transformer. Verify complete month coverage and full-row copy behavior.
- Reconcile a controlled run before enabling schedules or shared-workbook writes.
  Inventory automation is a separate later workflow, per the supplied procedure.

## Supplied workbook validation

See [the August validation report](dataorbis-sales-validation-20260922.md).
The user supplied `Game and Makro Aug26 Raw download.xlsx` and
`Aug26- All Clients by Sku2 Final template.xlsx` after the initial setup.
The actual template supersedes the recording's 18-column projection: it has
20 columns, names column P `PRODUCT/SKU`, and adds `SALES CASES (NEED HELP)` and
`Meridian Coverage`. Those two new columns remain blank because the source does
not establish case conversion or coverage.

The local transformer matches all 1,327 rows in the supplied worked example.
It verifies and removes 427 repeated Game `Total` rows, and holds nine Game
online/non-SA detail rows for an explicit inclusion/exclusion decision.
Numbers are preserved literally, pending confirmation of possible decimal vs
thousands-separator corruption in the supplied export. No portal extractor,
scheduled worker or shared-template writer has been activated.

The two live profiles were updated only in four procedure fields, using
optimistic update-time preconditions. The corrected layout, blank fields,
procedure and sample audit are visible in the existing editor. No source files
or credentials were uploaded. Live verification completed at
`2026-09-22T10:58:22.455Z`; schedules, approval flags and all other settings
remain unchanged. A numeric-serialization defect in the first summary write
was caught during read-back, corrected only in those same fields, and covered
by an explicit integer/decimal/zero/boolean round-trip regression test.
