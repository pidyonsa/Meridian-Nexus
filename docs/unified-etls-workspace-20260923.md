# Combined ETLs Workspace

## Scope

The existing `#etls` workspace is now labelled **ETLs** in its heading, browser
title and Nexus navigation. The existing light inventory-workspace styling is
retained. No Firebase-to-Azure migration is part of this change.

The first section contains separate Wilmar and Espen portal entries covering
Game, Makro and Jumbo. The Portal sales view includes reporting month, manual
Run, status/history, Stop, verification and completed report downloads.
Login settings opens that client's existing Admin extraction profile, without
copying passwords or creating a second credential store. OTP submission uses
the existing Nexus modal and authenticated callable.

## File-Based Setups

The catalogue contains 24 setup records across eight source clients:

| Client | Added source/channel setups |
| --- | --- |
| Anchor | Existing ten inventory channel entries retained |
| aQuelle | Boxer, Game and Makro sales |
| Dynamic Brands | PnP inventory; Shoprite Group inventory and sales |
| Ethica | Clicks inventory and sales |
| Magalies | Shoprite Group inventory and sales |
| Penflex | PnP inventory |
| Saldanha | Shoprite and Checkers sales |
| Universal Paper | Shoprite Group monthly sales |

These records are based on the supplied local `Non-Linked ETLs` folders and
source workbook headings. They are setup defaults, not validated transformers.
Source and expected-output files can be linked/uploaded through Channel setup.
Local samples have **not** been uploaded or substituted into approved Resources
automatically. Each record has review requirements; mappings and compatible
reporting periods still require validation before execution can be enabled.

Sales and inventory setups have distinct identities. Existing inventory IDs
remain unchanged. Raw TXT/CSV files may be staged for setup only. Reference
workbooks and the executable Anchor/PnP worker remain XLSX-only.

## Safeguards

- Only Anchor/PnP is a runnable file-based inventory transformer.
- Portal readiness comes from the existing authenticated Operations response.
  Espen is not made runnable by this UI change.
- Duplicate monthly submissions are disabled while a portal job is active;
  the existing backend monthly lock and duplicate-result checks still apply.
- Portal date selection sends the complete calendar month, including leap years.
- Reports use the existing authenticated, generation-pinned chunk downloader.
- Existing jobs, source files, saved workbooks, credentials, schedules, mapping
  references, liquor eligibility and exception-approval rules are unchanged.
- No extraction or OTP request is triggered by mounting or deploying this page.

## Verification

- 32 API, reference, catalogue and report-download tests passed.
- Three portal component tests passed: client separation, credential/OTP adapter
  routing, month boundaries, duplicate suppression, escaped labels, service
  errors and session cleanup.
- Isolated full-app browser checks passed at 1440, 390 and 320 px: admin/staff
  access, title/navigation, portal Run payload, readiness blocking, setup edits,
  inventory review/approval, download assembly, overflow and sign-out isolation.
- Browser job calls were mocked. A live DataOrbis login/OTP was not performed.

## Release

`scripts/release-unified-etls.cjs` builds from the current deployed source and
Hosting manifest. Only `etl-pipelines.js` and three setup-file changes in
`meridian-etl.js` are added to the existing ETL callable. The worker is untouched.
Only six Hosting assets are changed/added; unrelated dirty local files are not
published. Runtime configuration, access controls and other function revisions
are checked against the captured baseline.

Release evidence: `.tmp/unified-etls-20260923/`. Final live status is recorded in
`verified.json` after source, CDN, manifest, runtime and IAM checks complete.
