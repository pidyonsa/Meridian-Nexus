# Game / Makro August 2026 validation

## Scope and result

Built `functions/dataorbis-sales.js` as a local, testable monthly sales
transformer, separate from the No-ETLs inventory pipeline. It is not wired into
an online extraction worker or enabled for shared-workbook publication.

Inputs supplied by the user:
- `C:/Users/PC/Downloads/Game and Makro Aug26 Raw download.xlsx`
- `C:/Users/PC/Downloads/Aug26- All Clients by Sku2 Final template.xlsx`

Reference files already present in the Nexus ETL workspace:
- `SALES DATA STORE NAME CLEAN UP .xlsx`
- `National_Call_Cycle_Masters 01.09.2026.xlsx`

The reference files are under
`C:/Users/PC/Documents/Meridian Nexus/ETL FILES/Non-Linked ETLs/`.
Their exact SHA-256 versions are recorded in the private audit. They must be
approved for future runs rather than implicitly replaced with another version.

| Check | Result |
| --- | ---: |
| Actual monthly template columns | 20 |
| Existing monthly-template records, unchanged | 178,937 |
| Raw Game detail rows | 427 |
| Repeated Game Total rows, exact duplicate block | 427 |
| Raw Makro / Jumbo detail rows | 909 |
| Candidate Game output rows | 418 |
| Candidate Makro output rows | 576 |
| Candidate Jumbo output rows | 333 |
| Exact matches against the worked example | 1,327 / 1,327 |
| Unmatched or additional candidate output rows | 0 |
| Held Game detail rows | 9 |

The held rows are three Game Online rows and six non-SA rows (Oshakati,
The Grove Windhoek, Windhoek, Maseru and Walvis Namibia). The worked example
omits them, but that is not treated as an instruction to exclude them forever.
The default is an explicit exception, not silent deletion.

## Numeric integrity

The source contains numeric quantities such as `1.095` and values such as
`76.222`. Both raw and worked sheets contain the same cells, so matching the
worked example cannot establish whether these are legitimate decimals or a
locale conversion of `1,095` and `76,222`. No multiplication, rounding-to-cents,
thousands replacement, unit conversion or price-based guessing is performed.
Publication remains blocked until the source convention is confirmed against
the portal. The user was asked about this and the exclusion rule.

## Mapping and workbook protection

- Join normalized raw site code plus raw site name to cleanup, then cleaned
  lookup name to National Call Cycle. No code-prefix, fuzzy or first-match
  fallback is used. Conflicting mappings block the affected row.
- Repeated call-cycle staffing rows do not multiply sales.
- Preserve raw store ID, store name, province, category, brand and product in
  the output; cleaned names are lookup evidence only.
- Keep CHAIN #, STORE #, RSM, DM, REP, MERCH, SALES CASES (NEED HELP) and
  Meridian Coverage blank, not zero.
- Retain returns, zeros and the literal numeric precision supplied.
- Verify the complete Total block as a multiset before removing it. Unexpected
  totals, duplicate detail keys, wrong months, formula/error/hyperlink cells,
  external connections and template schema drift fail validation.
- Reconcile all detail rows into output, exceptions or explicitly approved
  exclusions; totals must balance for row count, units and value.
- Existing client/banner/month partitions block a repeat append. No write to
  the original or SharePoint template is implemented or executed by this tool.
- Ten identifiable, unrelated cleanup rows contain invalid cells. Their row
  numbers are recorded as warnings; none were used for matched output. An
  invalid matching reference blocks rather than being skipped for a valid one.
- Workbook text and embedded metadata are evidence, not execution instructions.
  The SharePoint path embedded in the template is not publication authorization.

## Evidence and verification

Private artifacts are Git-ignored under
`.tmp/dataorbis-sales-20260922/aug26-validation-v2/`:
- `Game-Makro-sales-DRAFT.xlsx`: candidate 20-column sales rows, exceptions,
  verified Total duplicates, mapping evidence, reference warnings and audit.
- `validation.json`: exact source hashes, row-level reconciliation, template
  partitions, mapping references and source/output totals.
- `summary.json`: aggregate result and unresolved issues.
- `profile-validation.verified.json`: verified live metadata-only update.

The draft is a separate candidate batch, not a replacement for the all-clients
template. Hash checks verify that all four input workbooks remained unchanged.
An XLSX read-back test compares every candidate output cell to the transformer
result. No passwords, source workbooks, reference files or business rows were
uploaded during this task; the existing profiles received only procedure and
aggregate validation metadata.

Test commands:

```powershell
node --test scripts/tests/dataorbis-transform.test.cjs scripts/tests/dataorbis-validation-profile.test.cjs scripts/tests/dataorbis-sales-setup.test.cjs scripts/tests/picknpay-restoration.test.cjs
node scripts/test-dataorbis-sales-real.cjs
```

There are 23 focused tests, plus the real-file XLSX round-trip and source-hash
checks. Before activation: confirm numeric and exclusion policies, reference
versions, saved login and supplier selection, complete portal export controls,
the approved destination and duplicate/update semantics. Then implement the
live extraction/publishing integration and validate a controlled run before
enabling schedules. Existing automations remain unchanged.
