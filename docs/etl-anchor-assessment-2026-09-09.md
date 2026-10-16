# ETLs Workspace: Anchor Inventory Assessment

Implementation follow-up: see [ETL implementation status](etl-anchor-implementation-2026-09-09.md)
for the completed local build, validation results and pending deployment approval.

Status: read-only assessment and proposed design. No ETLs portal page, production
job, data import or rules deployment has been made by this assessment. The source
workbooks were not changed. Business rules below need confirmation before an
automatically published result can be considered correct.

Source folder: `C:/Users/PC/Documents/Meridian Nexus/ETL FILES/Non-Linked ETLs/ANCHOR`.

## Verified Inputs

| Workbook | Data rows | Purpose |
| --- | ---: | --- |
| PnPSiteDaysCover_20260902082929- PNP INVENTORY RAW.xlsx | 3,462 | PnP site/article inventory and rate of sale |
| Transformed Inventory File- Anchor.xlsx | 16,273 | Expected 17-column export layout and comparison example |
| Product List.xlsx | 7,199 | Standard product attributes; 53 Anchor reference rows |
| SALES DATA STORE NAME CLEAN UP .xlsx, Sheet1 | 37,618 | Retailer aliases; column F is the user-approved canonical store name |
| National_Call_Cycle_Masters 01.09.2026.xlsx | 19,604 | Store coverage, region and resource/manager assignments |
| DC Mapping File.xlsx, Sheet1 | 1,891 | Channel-specific store-to-DC mapping, including 489 PnP rows |
| PNP Status Codes.xlsx | 23 | Raw article status to approved cleaned status |
| Jul26- All Clients by Sku2.xlsx | 204,376 | July sales reference, not automatically September four-week actual sales |

The store clean-up workbook also has other sheets; the specified canonical-name
contract is Sheet1 column F, `Cleaned Store NAME`. Its column E is
`Cleaned Store Code`. Column D and column G both have a `Cleaned Banner` header,
so an importer must use an explicit column contract, not silently resolve a
duplicate header by position or overwrite one value with the other.

## Important Differences in the Example

1. The transformed file is multi-channel: 3,370 PnP rows and 12,903 Shoprite-group
   rows. The latter span Shoprite, Checkers, Usave and related banners. The folder
   does not contain the corresponding Shoprite-group raw inventory source.
2. All 3,370 PnP output site/article pairs match rows in the raw source, and all
   retain the source SOH quantity and raw site description. This does not enforce
   the requested column-F canonical name. For example, `Family Cornwall View`
   should map to `PNP FAMILY CORNWALL` under the supplied clean-up file.
3. All 3,370 PnP `Sell Out P4 Weeks` values match `DROS Qty * 30`, within 0.011
   units. This is evidence of the example's calculation, not approval that a
   30-day estimate represents actual four-week sales. A 28-day estimate also is
   not actual observed sales. Keep the measure's basis explicit.
4. The raw source has 3,430 store rows plus 32 distribution-centre rows. The
   example excludes the 32 DC rows from store detail and also omits 60 store rows.
   Those 60 exclusions need reconciliation; they must not be silently copied.
5. The raw `Week Ending Date` is `01/09/2026`; the filename timestamp is
   `2026-09-02 08:29:29`; the entire output is labelled `2026-09-02`. Inventory
   as-of date, file export time and reporting batch date are separate facts.
6. Every PnP output `Open PO Qty` is zero, but the supplied PnP raw file does not
   contain an open-PO quantity. Zero versus unknown/not supplied needs an approved
   export rule. Do not silently invent a measured zero.
7. Master joins are not automatically one-to-one. The Anchor/PnP product list
   contains article `183524` with both barcode `60087157` and `6001323106923`.
   A lookup by article code alone is ambiguous. Product List `ORIG` aliases may
   disambiguate the raw description and must be included in the approved matching
   contract; the inspected example selects barcode `60087157`. Broad store-alias
   matches also produce conflicting target records; the source
   channel/alias family and collision policy must be explicit.
8. The call-cycle master contains multiple resources per store. This is often a
   valid staffing relationship, not duplicate inventory. A direct unqualified
   join would multiply stock. The 17-column example itself has no rep or manager
   columns.

The automated checks are observational comparisons, not a complete recreation of
the previous ETL. The raw and transformed inventory files contain no Excel
formulas explaining the transformation. These inventory workbooks also have
no embedded query/connection parts detected by the initial ZIP inspection.

## Recommended Portal Design

Add one `ETLs` destination in the existing Nexus navigation, with no embedded
second sidebar and the current Nexus authentication. Suggested views:

- Pipelines: customer, channel, data type, status and approved mapping version.
- Run ETL: choose the profile, upload raw workbooks, select pinned master versions.
- Review: unmatched stores/products, conflicting mappings, excluded rows and
  before/after values. Corrections become approved mapping versions.
- Outputs: preview/download the standard export and publish approved datasets.
- Run History: progress, input/output/rejected counts, stock totals, actor,
  references, changes, retries and prior versions.

Reference files should use the existing Resources catalogue rather than another
unrelated upload system. Add explicit roles for store aliases, product aliases,
DC mapping, status mapping and inventory templates. A run must pin exact file
versions and checksums. Existing resource deletion/trimming must not invalidate
the inputs needed to reproduce an approved ETL run: snapshot dependencies under
the run or protect referenced versions from deletion.

Start with the complete Anchor/PnP path. Add Shoprite and other channels as
separate tested input adapters feeding the same canonical inventory model. Client
rules are approved configurations, not copied and diverging scripts. Do not
automatically classify other retailers as supported from a common column name.

## Mapping Contract

| Standard output | Proposed authoritative source or rule |
| --- | --- |
| Week Ending | Approved reporting-date rule; retain raw as-of and export time separately |
| Banner | Explicit approved clean-up column and retailer-family mapping |
| Region | Approved store master; report conflicts with DC region instead of overriding silently |
| Site Code | Retain retailer site code for template compatibility; keep canonical Meridian code separately |
| Site Name | Sheet1 column F of the store-name clean-up workbook |
| Barcode, Brand, Category | Product List using approved client/channel/article mapping and ORIG source-description aliases where needed |
| Article | Source article identifier mapped to the standard product; retain identifiers as text |
| Article Description, Article Description P&G PL | Product List; retain existing export headers until a schema change is approved |
| Supplying DC SOH | Store-to-DC mapping plus the raw DC/SKU inventory at the matching snapshot |
| Store SOH | PnP raw `SOH Qty` for store rows, without staffing join multiplication |
| Sell Out P4 Weeks | Confirm 30-day estimate, 28-day estimate, or actual dated four-week sales |
| Article Status | PNP Status Codes `Cleaned Description`; preserve leading-zero and alphanumeric codes |
| CLIENT | Validated Product List client, cross-checked against the selected ETL profile |
| Open PO Qty | A real source feed or an explicitly approved missing-value/default convention |

Product article codes must be scoped to channel and customer: the same numeric
article can mean different products at different retailers. Where the product
master uses `PICK N PAY CORPORATE` as a reference family for Family/Hyper stores,
that family relationship must be an explicit approved mapping, not a fallback
that ignores the banner. Use exact reviewed aliases first; suggestions based on
similar names can go to Review, never directly to publication.

Keep distinct inventory facts for store stock and DC stock. DC stock repeated on
each store's compatibility-export row must not be summed as though each store
owns a separate DC balance. Store-to-person assignments are a separate relation,
with role and effective dates; rep/manager enrichment must not duplicate facts.

## Data and Processing Architecture

`Nexus upload -> protected Storage inputs -> batch worker -> validation/review -> approved output -> controlled dashboard publisher`.

- Firebase Storage: unchanged input files, pinned master snapshots, downloadable
  Excel exports, machine-readable detail and exception reports.
- Firestore: profile configuration, approvals, job state, audit metadata, compact
  metrics and dataset pointers. Do not put a whole workbook in one document.
- Cloud Run job: deterministic transformation, validation and export. Reuse the
  existing Nexus manifest-driven batch pattern, but use a separate ETL worker
  identity and paths rather than expanding unrelated Stock Fix permissions.
- Existing Firebase auth: server-checked ETL view/run/review/publish permissions,
  customer/channel scope, and admin-controlled master changes. External clients
  should not receive global masters or other customers' raw files.
- For cross-customer analytics at larger volumes, assess a columnar analytical
  store separately. Do not make a database migration a prerequisite for the
  initial ETL workflow.

Cloud Run jobs support run-to-completion tasks, execution logs, schedules and
configurable retry limits: [Google Cloud Run jobs](https://docs.cloud.google.com/run/docs/create-jobs).
Firestore documents have a 1 MiB maximum size, reinforcing the file/metadata
separation: [Firestore limits](https://firebase.google.com/docs/firestore/quotas).
Storage can retain noncurrent object versions, but these still need lifecycle
and deletion policies: [Object Versioning](https://docs.cloud.google.com/storage/docs/object-versioning).

## Publication Gates

Every input row must be accounted for as a store output, a DC fact, a deliberately
excluded record with a reason, or an exception. Reconcile stock by SKU/channel
before approval. Record missing mappings and collisions separately; never use
an arbitrary first-match lookup, blanket zero fill or an unreported inner join.

Use a job identity based on customer, channel, inventory snapshot, input hash,
mapping version and all master versions. A repeated upload must not add duplicate
stock. Corrections create a new dataset version; they do not overwrite history.
Publish the current dataset pointer only after the entire validated output is
available. A failed or incomplete ETL must leave the last approved dashboard
dataset untouched.

Keep Excel output layout compatible with the 17-column Template sheet unless
additional staff columns are explicitly approved. Provide an exception/reconciliation
report separately. Treat potentially formula-like source text as literal export
text; do not execute workbook macros, external connections or arbitrary uploaded
transformation code. Enforce file, sheet, row, cell-length and decompression limits.

## Decisions Requested

1. Confirm the PnP sales calculation and whether it is an estimate or actual sales.
2. Confirm whether to retain 17 export columns or add rep and manager columns.
3. Supply the original transformation procedure/script and remaining channel raw
   files, especially the rationale for the 60 missing PnP store rows.
4. During mapping review, approve the reporting-date convention, product barcode
   conflicts, store-alias priority, staffing role selection and missing PO policy.

Evidence files and read-only analysis scripts:
`scripts/inspect-anchor-etl.cjs`, `scripts/analyse-anchor-mappings.cjs`, and private
`.tmp/anchor-etl-analysis/`. Source rows with staff names/emails were not copied
into this recommendation.
