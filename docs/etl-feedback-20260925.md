# ETL Testing Feedback: 25 September 2026

Scope: the visible "Steps and mapping required" sheet in `ETL Testing Feeedback.xlsx`.
Portal-download automations, credentials, OTP handling and schedules are unchanged.

## Implemented

| Pipeline | Raw inputs | Changes |
| --- | --- | --- |
| Ethica / Clicks sales | Daily sales workbook | Select required headers regardless of extra `ui` formula columns or pivot sheets. Aggregate measured units and value by month. |
| Ethica / Clicks inventory | Store SOH, DC SOH, period sales | Join supplying DC and SKU, join measured store/SKU sales, map product attributes, retain raw store names and source stock dates. No DROS estimate. |
| aQuelle / Boxer sales | `Data` sheet | Select reporting month, preserve StoreID/Store, use size plus description for SKU, and measured units/value. |
| aQuelle / Game sales | Up to 12 weekly TXT/CSV/XLSX exports | ZA and EKHAMANZI records, LoadDate reporting month, VIV/AQUELLE brands, material description SKU. Distinct sale types retained. |
| aQuelle / Makro sales | Up to 12 weekly TXT/CSV/XLSX exports | MAIN and EKHAMANZI records, EndDate reporting month, trim Main Store, description plus sales unit SKU. |
| Universal Paper / Shoprite Group sales | `SC Report` | Selected monthly units, GLN store ID/banner, cleaned category, product ORIG brand lookup, units x inclusive price / 1.15. |
| Saldanha / Shoprite and Checkers sales | `Separate View` | GLN B2B-site mapping, selected month, SALDANHA brand/CANNED FISH category, units x inclusive price / 1.15. Output Client is UNIVERSAL PAPER, as explicitly confirmed. |

The first `GLN Report` worksheet is used exclusively. Columns A:G are the source mapping; duplicate lookup headings later in the worksheet are ignored. Existing Excel errors are recorded, not converted into store IDs, regions or zero balances.

All runs inherit shared masters and transformed-sample headers. No blank output template is required. GLN is required only for the applicable Shoprite sales pipelines. Weekly export row-count footers are checked; selecting the same weekly file twice is rejected.

Following user confirmation on 25 September, new Clicks inventory runs default Article Status to `Active`. Clicks supplies no status indicator, so the workbook audit records this as an assumption. Historical runs retain their pinned rule; a new run is needed to produce the updated workbook.

## Local Source Validation

All eight source cases reconcile their input rows and measures across included, excluded and review rows. Outputs are local validation workbooks, not approved production runs.

| Case | Result | Blocking source rows |
| --- | --- | ---: |
| Ethica / Clicks sales | Ready | 0 |
| Ethica / Clicks inventory | Draft for review | 34 |
| aQuelle / Boxer | Ready | 0 |
| aQuelle / Game | Ready | 0 |
| aQuelle / Makro | Ready | 0 |
| Universal Paper / Shoprite Group | Draft for review | 114 |
| Saldanha / Shoprite | Ready | 0 |
| Saldanha / Checkers | Ready | 0 |

The exact failed Clicks sales upload now produces 6,956 monthly output rows from 19,158 source records: 21,647 units and R3,106,407.62, identical to the original export without the added helper column.

Clicks inventory has 33 missing/non-numeric stock quantities and two duplicate-key rows, with one overlapping issue: 34 affected rows in total. These cannot be corrected by inventing quantities or removing records.

Universal Paper has 114 rows with ambiguous GLN store mappings; 32 also repeat complete source records. For example, SHOPRITE BRITS maps to two different GLN site IDs. These require reference/source review. Unavailable product brands and regions remain blank with warnings.

## Manual Retest

1. Refresh Nexus and open ETLs, then select the customer, retail channel and data type.
2. Open New run. Select the reporting month where shown, using the month actually covered by the export.
3. Upload only the listed raw inputs. Clicks inventory needs three files; weekly Game/Makro sales accepts multiple files together.
4. Review reconciliation, warnings and exclusions. Download the workbook and inspect Exceptions for any blocking data issues.
5. Approve only after reviewing a ready output. This does not update Insights or Stock Fix automatically.

Use New run or Retry for the formerly failed Clicks upload. Previously approved outputs remain unchanged.
