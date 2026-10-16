# Meridian Nexus: Data and Application Options

Five-page executive assessment and editable five-slide PowerPoint, updated 13 September 2026. The original supplied PDF is preserved. No Nexus code, permissions or cloud infrastructure was changed.

## Decision Scope

1. Retain Catalyst's data service while Meridian continues integrating the Nexus application.
2. Ask Geo Rep to integrate Carin's handovers and the current Nexus capabilities into one application, operate the data service and host it.
3. Continue Meridian-led integration of the existing Firebase application with a Meridian-controlled Google Cloud data lake in Johannesburg.

The recommendation is a conditional strategic preference for option 3, retaining supplier feeds during transition. Geo is a valid alternative pending a complete comparable quote and operating evidence. A data-hosting price is not an application-integration price, and copying data does not replace retailer ETL.

## Evidence Read

- User-supplied `Meridian-Nexus-In-House-Risk-and-Benefit-Assessment.pdf`: two pages, including a statement implying a POPIA guarantee. The new document replaces that with a qualified security/privacy position.
- User-supplied `RE Info Needed.msg`: supplier response by Nikita Turck on 8 September 2026 at 17:48, forwarded by Jaco Jooste on 9 September. Supplier is identified as Catalyst by Meridian; the sender's domain is MAD9000. The email quotes R25,000/month and R60,000 excluding VAT for a read-only API. No API credential values were present or used. Only the relevant commercial facts are reproduced, not the private email chain/signatures.
- `Handover - Call Cycle Portal and Coverage Dashboard.docx`: master-building workflow versus reporting, hierarchy sources and backend refresh responsibilities.
- `StockFix_Weekly_Refresh_Azure_Migration_Handover.docx`, version 1, 6 September 2026: separate operational and reporting databases, source pipelines, long-running jobs and remaining manual approvals. Historical handover facts are not labelled as a fresh production audit.
- Downloaded Sales Insights source directory and the existing Nexus integration context. No claim that all current modules were re-tested for this document.

## Commercial Qualifications

- The R25,000 retainer expects 2-4 days/month, is reviewable and may change. VAT basis and hosting inclusions are not stated. The comparative R300,000/year and R360,000 with API assume the retainer is ex VAT, unchanged, and the API is purchased once. Confirm before budgeting.
- The R60,000 API estimate is 5-8 supplier workdays, not a timeline or price for the complete Nexus integration. Dashboard configuration is excluded. Full raw history, row-level grain, bulk export, rate limits, incremental change handling, security evidence, support measurements and IP/exit terms need confirmation.
- Geo integration, replatforming, data migration, cloud hosting, licences, support and exit costs are unknown, not zero.
- Meridian R6,000-15,000/month is an indicative cloud infrastructure allowance only, excluding VAT. It is not a provider quote or a regional-SKU calculation. Internal integration and support effort are additional; no approved day rate was supplied. Cost the verified remaining backlog using Finance-approved loaded rates, distinguishing existing salary allocation from new cash costs.
- The cloud allowance excludes labour, migration/testing, paid support, supplier/API fees, AI/IR/WhatsApp, devices/connectivity and regional-disaster failover. Do not count shared existing Nexus infrastructure twice.
- If Catalyst continues for a full year, the API is purchased and the lake runs for a full year: R432,000-540,000 before the exclusions and subject to the same retainer VAT assumption. This is not total cost of ownership or a guaranteed savings case.

## Cloud Estimate Method

Rounded monthly ZAR allowances, not SKU prices:

| Component | Lower | Upper |
| --- | ---: | ---: |
| Lake files, history and backup storage | 600 | 1,500 |
| BigQuery storage and analytical queries | 1,000 | 3,000 |
| APIs, ETL jobs and operational data | 1,800 | 4,000 |
| Logs, secrets and security services | 600 | 1,500 |
| Network, serving and fixed outbound IP | 1,000 | 2,500 |
| Subtotal | 5,000 | 12,500 |
| 20% reserve | 1,000 | 2,500 |
| Monthly planning budget | 6,000 | 15,000 |

Planning envelope: 0.5-2 TiB total object footprint including retained versions/backups; 0.1-0.5 TiB analytical tables; 5-20 TiB query scans/month; daily feeds and weekly batch jobs; 1,000 registered users with 100 simultaneous users assumed; production plus a small test environment and cached aggregates. These are unverified sizing assumptions. Reprice the actual resources in Johannesburg and the applicable billing currency after discovery and a pilot. No default-region prices have been passed off as Johannesburg rates.

## Sources

Primary public references accessed 13 September 2026. Linked on relevant slides and explained in the PowerPoint notes:

- [Cloud Storage locations](https://docs.cloud.google.com/storage/docs/locations), [BigQuery locations](https://docs.cloud.google.com/bigquery/docs/locations), [Cloud Run locations](https://docs.cloud.google.com/run/docs/locations), [Firestore locations](https://firebase.google.com/docs/firestore/locations): Johannesburg regional-service availability and architectural boundary.
- [Storage pricing](https://cloud.google.com/storage/pricing), [BigQuery pricing](https://cloud.google.com/bigquery/pricing), [Cloud Run pricing](https://cloud.google.com/run/pricing), [Firestore pricing](https://cloud.google.com/firestore/pricing), [calculator](https://cloud.google.com/products/calculator): charge categories and estimate validation, not evidence that the document's planning allowances are quotations.
- [Google Cloud terms](https://cloud.google.com/terms), section 5.1: customer application/data IP distinguished from provider services. Custom-code ownership and licensed retailer-data rights still need contractual validation.
- [Shared responsibility](https://docs.cloud.google.com/architecture/framework/security/shared-responsibility-shared-fate): Meridian retains application and access-control duties.
- [Firebase privacy and locations](https://firebase.google.com/support/privacy): the Johannesburg lake design must not imply that all identity, delivery, messaging and external processing is region-bound.
- [POPIA](https://www.justice.gov.za/legislation/acts/2013-004.pdf), sections 19-22 and 72: security, operator and external-processing review. The presentation is not legal advice or a compliance certification.
- [Cloud budgets](https://docs.cloud.google.com/billing/docs/how-to/budgets): alerts-only budgets are monitoring, not a guaranteed spending limit.
- [Geo Rep features](https://georep.com/product-features/): supplier product descriptions, not independently measured service capability, a migration commitment or a quotation.

## Build and Verify

Run `node docs/nexus-options-2026-09-13/build.cjs`, then `powershell -NoProfile -File docs/nexus-options-2026-09-13/export.ps1` from the workspace. Uses the existing PptxGenJS installation and Microsoft PowerPoint.

The builder verifies five slides, five speaker-note pages, arithmetic, canvas bounds and text-box intersections. PowerPoint checks actual text bounds before PDF export. Inspect all five rendered PNGs. `cost-model.json` is a reproducible arithmetic record; unknown costs are null, not zero.
