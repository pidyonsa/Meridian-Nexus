# Retailer Sales Extractions: Pick n Pay Restoration and Handover Assessment

Date: 9 September 2026. Status: connection setup restored; extraction is not yet verified or enabled.

## Sources Reviewed

- `C:\Users\PC\Downloads\ETLS\Sales Data Extraction Manual.docx`: 11 end-to-end workflows and a dependencies section.
- `C:\Users\PC\Downloads\ETLS\Sales Data Extraction Steps.xlsx`: matching procedure sheets, Dependencies, an image-only `Game(Pyramid` sheet, and empty `Game (SalesForce` / `Makro(SalesForce` placeholders. Empty sheets are not working automations.
- Historical Nexus commit `f66d8fa` (multi-profile PicknPay report centre) and the current extraction runner.
- Production Firestore metadata: the original 21-step `picknpay-sales-extraction-steps` remains, but `retailers/picknpay`, its credentials and its saved portal client list were absent. No retained runs were found under the audited Pick n Pay IDs or that step-set ID.
- Public [current Pick n Pay login](https://www.pnpportal.co.za/pnp_app/Account/Login) and [historical login](https://www.pnpportal.co.za/pnp/Login.aspx), inspected without signing in. Both expose an email security-code flow and terms/privacy acceptance. Whether MFA occurs for every session is not established.

The attachments describe the previous human/Catalyst process. They do not authorize accepting portal terms, bypassing MFA, uploading data to Catalyst, or publishing unverified sales.

## What Was Restored

- The Pick n Pay Sales connection setup in **Admin > Extraction profiles**.
- The existing historical workflow is preserved, not overwritten. Its original client is **STAEDTLER SA (PTY) LTD**, not Anchor and not every accessible client.
- The restored connection is intentionally unlinked, has no credentials, and has scheduling disabled. The existing backend rejects running an unlinked profile; it is excluded from runnable Report automation profiles.
- Admin displays the outstanding setup state. Enter credentials only through the existing secure Admin form, never in chat or source code.
- No retailer session, extraction, scheduled run, Catalyst upload or Insights publication was started. No other automation, access policy, rule or secret was changed.

Release verification:

- Hosting version `63396e1623332313`, verified 2026-09-09 20:30:17 UTC. Only `app.js`, `index.html` and the service-worker cache version changed; all other production asset hashes were retained.
- `retailers/picknpay` restored with an existence precondition and reread verification. Original step-set update time was unchanged. Evidence: `.tmp/picknpay-restoration-20260909/verified.json` and `hosting/verified.json`.
- Four focused tests passed: non-runnable defaults, backend queue rejection, exact Hosting patch isolation, and setup-state clearing. Synthetic browser checks passed for the existing editor hooks, missing/saved credentials and status layout at 1440, 390 and 320 pixels. No signed-in retailer integration test was possible.
- Source SHA-256: DOCX `b92c9bd0b4fd830cc893c20b71e6c221590323f5a072b62d8142b64172a1fb9a`; XLSX `ffd1040f3e2092557f120bc3c1b73d0622369ec62aa6fbda89538ad0bae899f4`.

This is a setup restoration, **not** a claim that the old multi-client batch centre or its exports are already operational. Saved credentials and an approved client are required to verify and finish activation.

## Pick n Pay Workflow to Activate

1. An authorized administrator supplies the retailer credentials through Nexus and confirms the client profile(s).
2. Review the portal's terms acceptance with the account owner. Support a human-owned email-code prompt if requested; do not automate acceptance or infer/reuse codes.
3. Read available profiles after login. Match an explicitly approved profile by its stable portal ID and verify the selected client before exporting. Do not select all clients by default.
4. Follow **Sales and inventory > Sales - Overview > left-most new Excel export > Last month > Export > Download**.
5. If that export is unavailable, use the documented **Sales - per day per store**, an explicit full calendar month, all stores and **South Africa only**, once its controls and export schema have been verified.
6. Freeze the requested month at queue time in Africa/Johannesburg. If a retry crosses a month boundary, stop or use a verified explicit-date export; do not silently reinterpret "Last month".
7. Validate a completed workbook, client, period, expected columns, units/value totals and row counts. Keep the raw source unchanged, with checksum, source profile, reporting month and run ID.
8. Store the verified raw export in a private, approved raw-sales location. Do not send raw downloads straight to the final monthly Sales template or Insights.
9. Transform with approved product/store masters, reconcile, review exceptions, then publish an approved dataset version through the existing Insights ingestion contract.

The old batch code could choose another available period or an existing Excel report when a new export failed. That behavior must **not** be restored: it can produce the wrong month. The handover's alternative is an explicit full-month report, not "latest available".

## Additional Extractions

All 11 flows are candidates for Nexus integration, but none is proven end-to-end by instructions alone. Complexity below is a relative assessment, not an implementation estimate.

| Workflow | Acquisition and MFA | Transformation in handover | What is needed for Nexus |
| --- | --- | --- | --- |
| Shoprite | Supplier Reports Portal, Vendor Article Sales report 6; client login plus email OTP; South Africa; six-month export | Catalyst Shoprite Sales, category/brand review, monthly template | Approved vendor scope, account/MFA owner, raw and expected files. Reconcile six-month overlaps rather than append duplicates. Higher complexity. |
| Pick n Pay | Approved client profile; Last month export; explicit full-month/all-stores/South Africa fallback | Catalyst Pick n Pay Sales, category/brand review; DC placeholder no longer used | Re-enter credentials, verify current portal/MFA and client IDs, obtain raw sales and Catalyst output pair, approve destination. Existing 21-step starting point. |
| Dischem | Client/month-specific Sales sheet; Sales by Store by Article Brand > Send to Excel; Microsoft sign-in | Catalyst Dischem Sales; category, brand and banner review | Authorized tenant account, export interaction/schema validation, raw/output pair and masters. MFA policy must be confirmed. |
| Spar | Unify+ plus email access code; Store Ranking; selected client products/month; SA; Kwikspar, Spar, Superspar; Excel export | Catalyst Spar Sales; category review | Approved brand/article list, MFA owner, raw/output pair, export completion checks. Higher complexity. |
| Aspen/Wilmar Game and Makro | DataOrbis/Pyramid; supplier-employee OTP; monthly supplier reports; reorganize pivot and copy raw data | Combine channels; remove aggregate totals; Site Code + Site mapping; monthly template | Approved supplier access and MFA owner, raw extracts, validated pivot/export alternative, clean-up and expected combined output. Do not silently drop unmatched stores. |
| aQuelle Game | Shared monthly `MassDiscounters_Delta_WE` text files | Refresh `AQUELLE GAME.xlsx` Power Query; select month; store/banner join; plantcode to call-cycle province | Approved shared folder/API access, all monthly source files, the actual query workbook/M code, expected output. Verify delta and week/month semantics before adding values. |
| aQuelle Makro | Shared monthly `Makro_Delta_WE` files | Refresh `aquelle Makro.xlsx`; select month; Makro banner; Site Code to call-cycle province | Source folder, query workbook/M code, raw/output pair, master versions; same delta/deduplication checks as Game. |
| aQuelle Boxer | Shared latest sales file, then select requested month | Description + SizeDescr product; client aQuelle; retailer/banner Boxer; template units/value | Approved source folder, actual schema and sample, expected output; validate contained month, not filename alone. Relatively straightforward file adapter. |
| Ethica/Sanofi Clicks | File received from Ethica; no portal download specified | SKU_NUMBER to Product List; store clean-up to call cycles; daily to monthly totals; ETHICA/SANOFI, Clicks | Controlled upload/SharePoint intake or explicitly approved mailbox, raw/output pair, product/store masters. Good early file-adapter candidate. |
| Universal Paper Shoprite | Emailed workbook, `SC Report`, desired month's unit column | VALUE = Price Incl * Units / 1.15; Article + Sales UOM product; product brand; category cleanup; province join | Raw/output pair, selected-month column mapping, approved formula/rounding and category-cleaning rules. The 1.15 rule is from this handover, not a universal sales rule. Good early candidate. |
| Saldanha Shoprite | Emailed workbook, A:W, selected month's units/value | Refresh `SALDANHA.xlsx` Power Query; fixed SALDANHA brand/client; SHOPRITE GROUP; province join | Raw/output pair, query workbook/M code, clean-up/call-cycle masters and approved source intake. |

## Required Inputs

1. **Monthly Sales template** from the handover's `01 All Clients (monthly)` SharePoint folder, including a completed/reconciled example. This is not the 17-column Anchor inventory template.
2. **Product List.xlsx**. The dependency sheet specifies matching product description to `ORIG` for category/brand where applicable. Clicks uses a SKU lookup. Keys must be scoped to client/channel as needed; preserve leading zeros and detect duplicates.
3. **SALES DATA STORE NAME CLEAN UP .xlsx**. Match retailer/banner plus source store identity to the approved canonical name. Preserve the user's existing column-F canonical-name rule; confirm the supplied version before assuming identical columns.
4. **National_Call_Cycle_Masters 01.09.2026.xlsx** or its approved successor for province/banner. Use the right code/name join for each workflow. Do not infer province from spelling or silently choose one of duplicate master rows.
5. **Actual Power Query workbooks**: `AQUELLE GAME.xlsx`, `aquelle Makro.xlsx`, `SALDANHA.xlsx`, plus referenced query dependencies. Screenshots do not contain the executable transformations. The call-cycle link in the workbook is relative to a personal SharePoint path and must be resolved/approved before a service can use it.
6. At least **one raw export and its accepted transformed output per channel/client schema**, with a second month or edge-case sample before scheduling. Instructions/screenshot files alone are insufficient for exact mapping and reconciliation.
7. Authorized account/client scope, MFA owners, delivery/source folders and automation schedules. A browser sharing link is not proof of service-account access.

The supplied `Downloads\ETLS` folder contains only the two procedure documents. Product/store reference files already examined for Anchor No-ETLs can be reused where their versions and keys are approved for sales; they do not replace the missing sales raw/output pairs or the actual Power Query workbooks.

The manual marks Sales-template columns G, H, J, K, L, M, S and T as unused. Preserve template compatibility until the actual workbook and downstream ingestion schema are reviewed; do not delete fields based only on their letters.

## Nexus Design

```text
Retailer portal / approved file intake
    -> private immutable raw-sales object + Firestore run manifest
    -> versioned channel-specific transform worker
       + Product List + store clean-up + National Call Cycle masters
    -> exception quarantine + reconciliation + reviewed output
    -> approved dataset version -> current Insights ingestion
```

- Reuse Nexus authentication, sidebar, Admin configuration, job logs, Resources, and the existing No-ETLs review pattern. Do not add another login or a nested portal.
- Keep raw workbooks and large line-level artifacts in private object storage. Firestore holds permissions, configuration, jobs, lineage and dataset pointers. Do not load every raw row into Firestore merely to replicate a workbook.
- Keep retailer sell-out, Geo Rep captured orders, and Anchor inventory/DROS estimates separate. Geo Rep transactions and DROS-derived values are not replacements for these sales sources.
- Use client/channel/report/period/source-version identities. Reruns replace or version that scope after reconciliation; never deduplicate only by a filename or append overlapping history blindly.
- Missing category, brand, store or province mappings remain visible exceptions. Do not fabricate dimensions, discard nonmatching business rows or multiply facts through duplicate master joins.
- Compare units and value totals at raw, normalized and final stages. Treat returns/credits and zero sales explicitly. Keep decimals and round only according to the approved output contract.
- Approval and an atomic published-version pointer keep a failed refresh from replacing the last good Insights dataset. Recheck caller permissions server-side for run, review, download and publish actions.
- Secrets stay server-side. Restrict source/destination hosts and Storage prefixes, keep MFA responses short-lived and owner-scoped, and avoid credentials/OTP codes in logs or screenshots.
- No automatic emails, OTP retries, CAPTCHA bypasses, public file links or Catalyst uploads. Retain protected source/version records for audit and define retention separately.

## Recommended Order and Release Gates

1. Reconnect **one Pick n Pay client** and verify the full previous month, including current MFA behavior. Keep schedules disabled during commissioning.
2. Implement the Pick n Pay sales transform against its raw/accepted-output pair and the correct Sales template. Reconcile it before any Insights publication.
3. Add file-first **Ethica Clicks, aQuelle Boxer, Universal Paper Shoprite**, once samples and mappings are available.
4. Port **Game/Makro/Saldanha Power Query** logic from the actual query files with regression fixtures.
5. Add the remaining **Shoprite, Dischem, Spar, DataOrbis** portal adapters one at a time, with explicit client scope and human MFA handling.

Release tests: correct client and month; duplicate/overlapping exports; month-boundary retry; missing/late/corrupt source; source changes mid-download; absent/ambiguous master keys; duplicate join multiplication; negative/zero values; unit/value reconciliation; permission denial; reviewed publication; rollback to the previous dataset version.

**Immediate blocker:** Pick n Pay credentials and confirmation of the first client. **Full Catalyst replacement blocker:** actual source/expected-output samples, Sales template and Power Query logic. The existing Insights data source remains unchanged until a replacement reconciles successfully.
