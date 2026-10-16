# ETL Testing Feedback: 28 September 2026

Scope: the rows marked "fix" in the ETL testing feedback, plus the aQuelle month rule.

## Changes

| Pipeline | Change |
| --- | --- |
| aQuelle / Boxer sales | `UNKNOWN` or blank Brand becomes `AQUELLE`. PRODUCT/SKU is `Description` + `SizeDesc` (e.g. `AQUELLE MINERAL WATER STILL 500 ML`). |
| aQuelle / Boxer, Game, Makro sales | Reporting month comes from each row's own date (Boxer `Year`/`Month`, Game `LoadDate`, Makro `EndDate`). The selected run month is used only when the row has no date. Invalid dates are blocking exceptions. Rows are no longer excluded for falling outside the selected month. |
| Universal Paper / Shoprite Group sales | Brand lookup matches Product List `ORIG` against the Shoprite article description (without Sales UOM), then description + UOM, then `Article`, then `Article Description`. CLIENT `UNIVERSAL` or `UNIVERSAL PAPER` is accepted. Rows whose matches disagree on Brand stay blank with a warning. |

Shared ETL reference set `anchor-pnp-v1` revision 6: `products` now points to `resource-c7a92937-9f22-4912-b409-1dbc2c3d00ef` (Product List uploaded 28 September 10:43), replacing `inventory-anchor-products` (10 September). This Product List is shared by every ETL.

## Release

- Worker image `worker:20260928-feedback-fixes`, `sha256:c694d20c1f3d51e398cea266729caa7c6fdead35d4fc40fa6b943b584b196b59`, built and tested in Cloud Build `7540a55f-fcd4-4c4d-a398-5272461b8b14`. Cloud Run job `nexus-inventory-etl` generation 12.
- Clicks inventory is shipped unchanged from the 25 September release. The local "Article Description P&G PL = Article Description" change is not released; that item was assigned to Tim (Product List update).
- Before/after records: `.tmp/etl-feedback-release-20260928/`.

The new Product List could not be read from this workstation (storage permissions), so the Universal brand match on real data is verified only by the first portal run.

## Follow-up 29 September: Boxer out of memory

Boxer runs `844999d6…` and `0c19b854…` failed with "did not finish within the run deadline". Cause: the JavaScript heap ran out (~1.1 GB) while writing the review workbook, because source-date months raised Boxer output from ~5.7k to 67,695 rows and the sales workbook was built in memory. The sales export (`sales.cjs`, shared by all sales ETLs) now streams rows with the ExcelJS WorkbookWriter. The output is unchanged: same sheets, values, formats, widths, freeze panes and filters. Peak heap for the full Boxer file is 233 MB locally.

Image `worker:20260929-streamed-sales-export`, `sha256:ac417c8e7fd8da4ab8f102d8dfd7242536eccfabb238f3137c2407db1e543280`, Cloud Build `c1dead8a-48b1-48ab-a140-0243a8b89a9d`, job generation 13. Records: `.tmp/etl-boxer-oom-release-20260929/`.

Universal Paper check: run `a5dc5826…` (revision 6, new Product List) has 2,087 warning rows versus 25,381 on the old Product List (`fb2f8b4a…`), with the same 25,267 ready rows. Brands now resolve for most rows.

## Follow-up 29 September: Ethica / Clicks inventory DC date

- DC SOH date column: `CALENDAR_DATE` (new Ethica export) or `FIN_WK_START` (older exports).
- DC date rule: a DC row needs a valid date. It no longer has to be on or before the earliest store-stock date. The 28-09-2026 runs `9039e9e8…` and `51c74018…` rejected all 120 DC rows under the old rule. DC dates more than 7 days from the store-stock as-of date are included with a `DC_DATE_GAP` warning. Missing or invalid DC dates still block as `DC_DATE_INVALID`.
- Image `worker:20260929-clicks-dc-date`, `sha256:20b2b1e930816353b29d10b4599d5ff63006ddd06fa5020a5fc59ed8e5946932`, Cloud Build `79a5068a-f9ad-4df4-be99-aca9d261235e`, job generation 14. It is built from the generation-13 release; the unreleased "Article Description P&G PL" change is still excluded. Records: `.tmp/etl-clicks-dc-date-release-20260929/`.

## Follow-up 29 September: Ethica / Clicks inventory zero defaults

- Sell Out P4 Weeks is `0`, not blank, when the store/SKU has no rows in the supplied sales export. The `SALES_MAPPING` warning is kept so unmatched pairs stay visible. Invalid or duplicate sales rows still block as `SALES_INVALID`.
- Open PO Qty is `0` on every Clicks row (`openPO: zero-default`).
- Supplying DC SOH is `0`, not blank, when the store/SKU has no unique supplying DC/SKU balance, with a `DC_MAPPING` warning. This also covers DC rows rejected as invalid, which still appear as exceptions. Image `worker:20260929-clicks-dc-zero`, `sha256:2a1732a7f160627968dda81ac85da7e7c737ff272d7176ec46718c11089f9d17`, Cloud Build `fc3b1037-ac4f-4569-9629-bfed5992a94e`, job generation 16. Records: `.tmp/etl-clicks-dc-zero-release-20260929/`.
- Image `worker:20260929-clicks-zero-defaults`, `sha256:9cc77013f4608a0e146cd65146ca88cd0e01b5336acb8c00031fe6194cd5fb0f`, Cloud Build `c0ca4024-0e51-49b5-91cc-bb9542df7005`, job generation 15. Records: `.tmp/etl-clicks-zero-defaults-release-20260929/`.

## Retest

Start new runs (not Retry) for aQuelle Boxer, Game and Makro and for Universal Paper / Shoprite Group. Refresh ETLs first, because the reference revision changed.
