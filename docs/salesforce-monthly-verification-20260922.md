# Salesforce Monthly Attendance: 22 September 2026

## Outcome

The latest monthly source-to-template update **completed**. The earlier failed
attempts do not describe the current workbook. No replacement job was queued,
SharePoint file overwritten, schedule changed, or production code deployed
during this investigation.

- Completed child: `jn2KcttejPBxTuFwQks8`, at 10:12:32 SAST.
- Source parent: `Z6WSnd8DlXxtRCi1IIRV`.
- Workbook: `Rep Attendance Auto - September 2026.xlsx`.
- Worksheet: `South Africa Visit Plan`.
- Source: `Updated South Africa Attendance Report-2026-09-22-09-14-43.xlsx`.
- Complete period: 1-21 September. September 22 is the export's partial day and
  remains excluded under the existing completed-day policy.
- Source bytes were checked against both the inspected SHA-256 and the
  successful run's archived source hash. SharePoint item IDs and ETags matched.
- Independent saved-workbook check at 10:36 SAST: **3,973 plan rows, zero weekly
  Actual cell mismatches**. The download used before/after ETag and size guards.
- Current workbook ETag ends `188`; the worker recorded SharePoint version
  `91.0` and a pre-write backup. A subsequent save is not attributed to a person.

| Calendar week | Saved Actual visits |
| --- | ---: |
| 1 | 1,438 |
| 2 | 2,321 |
| 3 | 2,064 |
| 4, including September 21 | 426 |
| 5, not yet covered | 0 |
| Total | **6,249** |

These are eligible, compliant, deduplicated visits matched to the plan, not the
raw export row count. The raw export has 7,084 rows inside the requested dates.

## Earlier failures

The 09:00 attempt encountered a source not yet complete through September 21.
An earlier manual workbook update failed with SharePoint `423 resourceLocked`;
another attempt encountered the application workbook lock. The later 10:12
write succeeded. No lock was forcibly cleared and no older source was replayed.

The live Monthly configuration was re-read after verification: enabled,
09:00 `Africa/Johannesburg`, all seven days, all Actual weeks. Its configuration
uses `frequency: monthly` together with `monthlyRunCadence: daily`; this is a
daily reconciliation of the month, not a once-a-month trigger. The next expected
scheduled attempt is September 23 at 09:00 SAST, subject to a complete export.

## Formula check and limits

The current file requests full recalculation on opening. XML-level inspection
found 3,234 missing target formula results and 3,897 missing MTD results in active
plan rows. Missing saved results are not equivalent to actual zeroes. Summing
only cached results from this version would understate the totals.

Installed Excel recalculated a **local, read-only audit copy**, with macros,
events and external link updates disabled. There were no workbook connections.
After recalculation, all 3,973 active rows have numeric target and MTD results;
all satisfy the template's existing `MIN(sum of Actual weeks, target)` rule:
target total 8,547; capped MTD total 6,048. The 6,249 weekly visit total is uncapped
and therefore is not the same measure as the 6,048 MTD total.

There are also **80 pre-existing `#DIV/0!` results** on the other summary sheets:
Sheet1 25, Coastal 1, Sheet2 2, Sheet4 52. They persist after recalculation.
No pivot/cache package parts are present in either inspected workbook. This
investigation does not establish when those summary structures were created or
changed. It must not claim these sheets have refreshed simply because Actual
Week cells were verified. Recalculation alone does not repair these summaries.

The local recalculated workbook was **not uploaded**. Correct weekly data was
preserved; unresolved summary formulas were not hidden with blanket IFERROR
changes. Review the intended summary formulas and their underlying source
tables before treating the entire template as error-free.

Moving hosting to Azure will not itself fix workbook locks, stale input exports,
summary formulas, or source-success versus template-success reporting.
The separate Daily cancellation/deduplication issue from the September 21
investigation has not been revalidated or repaired by this Monthly check.

## Verification artifacts

- Private evidence: `.tmp/salesforce-monthly-recovery-20260922/`.
- `verification.json`: latest independent source-to-SharePoint result.
- `local-recalculation-verification.json`: local Excel comparison and error list.
- `scripts/recover-salesforce-monthly-20260922.cjs verify jn2KcttejPBxTuFwQks8`:
  read-only repeatable source/target check.
- `scripts/inspect-monthly-excel-recalculation.ps1`: local-only Excel check.
- `scripts/verify-monthly-recalculation-20260922.cjs`: compare original values,
  formulas, calculated results and remaining error set.
- 47 focused regression/audit tests passed: dates, weeks, SharePoint source
  selection, partial-day exclusion, retries, cancellation and cache semantics.

Cloud migration remains preparation only. See
[Azure automation preparation](azure-automations-preparation-20260922.md).
