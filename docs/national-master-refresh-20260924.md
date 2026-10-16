# National Master Refresh, 24 September 2026

## Source and Scope

User-approved source: `National_Call_Cycle_Masters 23.09.2026.xlsx`.

SHA-256: `a53e2900e19e9717b509954f14f36561c264c1f4553ec5b81affe98757722aca`.

- Original workbook retained privately in Resources as **National Store Master / Call Cycle - 23 September 2026**.
- 19,163 call-cycle assignment rows, 9,668 distinct store code/name pairs.
- 79,486 merchandiser-hour rows retained in the original workbook.
- 50 rows lack a store code or name. No identifiers were invented.
- No conflicting regions within an exact code/name pair in this new master.

## Active References

One concurrency-checked Firestore commit changed 14 documents. Read-back verified every changed field.

- ETL reference set `anchor-pnp-v1`, revision 2: latest staffing and revised cleanup Resources.
- Both Geo Rep Attendance audiences: new attendance store lookup and operational week 3.
- Orders importer: new national store lookup.
- Geo Rep Capture / Dischem Triparc: retained its prior specialist lookup after compatibility review showed that the generic store projection would lose rep/manager enrichment. The campaign target list and prior lookup remain unchanged pending a field-compatible refresh.
- Approved DataOrbis August template: future-run call-cycle reference updated using the required `Sheet1` projection. Approved sales template, cleanup input and completed Wilmar workbook were not overwritten.
- Public dashboard store-region reference: latest master, preserving previously verified extra evidence only for names absent from the new master.

The original workbook remains unchanged. The ETL projection retains all call-cycle assignments. The lightweight Geo lookup contains one first-match record per store code/name pair and no employee contact fields. The actual Azure reader was verified against all 9,668 unique Geo IDs and names. Geo ID is placed before retailer code because the existing reader selects the leftmost identifier; 953 retailer codes collide across stores, whereas the Geo IDs are unique. Both original identifiers are preserved, not rewritten. Liquor is not removed from Attendance or Orders: the requested exclusion policy concerns PnP ETL mapping.

Completed jobs, output workbooks, report date ranges and run IDs remain unchanged. Salesforce calendars, SmartSell blueprints, credentials and schedules were not changed.

## ETL Mapping

Deployed policy: `pnp-exact-store-first-region-20260924`.

- Accept either the historical `Sheet1` or new `Call Cycle Master` staffing sheet; reject ambiguous duplicate candidate sheets.
- Join staffing by exact normalized master code AND name, not name alone.
- As confirmed by the user, take the first active exact-match region; preserve all associated rep and merchandiser assignments.
- Missing first-match regions remain review exceptions.
- Record conflicting-region decisions in the output's Mapping Policy sheet.
- Remove 11,148 identical complete cleanup mappings, retaining conflicting candidates.
- Apply only Tim's two explicit aliases: `EC31 / EM Mdantsane` and `EF18 / PnP EM Mdantsane City` to `EF18 / PNP MDANTSANE`.
- Preserve raw code/name pairs separately from canonical mapping fields.
- Keep unresolved product/DC mappings visible; do not turn unavailable balances into zero.

Attached versus standalone liquor is not explicitly classified in the source. No bulk liquor exclusion has been applied. Resources contains **PnP store mapping review - Tim and Nakita**, including 233 liquor candidates, missing identities, approved aliases and reference provenance. Tim/Nakita must approve the classification before those exclusions are published.

## Verification

- 47 focused engine, workbook, worker, permissions, API and reference tests passed.
- Isolated Cloud Build container worker test passed. Runtime and IAM preserved; no business run started.
- Local replay used the available **1 September** Anchor sample, not the user's 15 September draft: 3,462 inputs; 3,430 store rows and 32 DC rows; 141,358 source store SOH = 70,436 ready + 70,922 exception SOH.
- This remains a review dataset: 1,715 store-mapping, 57 region-mapping, 91 DC-mapping and 8 product-mapping issues. Issue counts overlap; they are not distinct exception rows.
- Both approved alias pairs and the DataOrbis reference parser were verified.

Evidence: `.tmp/national-master-20260924/`, `.tmp/etl-national-master-20260924/`, `.tmp/etl-mapping-policy-20260924/`.

## Azure Status

The existing restricted Attendance publisher was invoked. Final live verification at 08:10 UTC is recorded in `azure-verified.json`, against the corrected snapshot captured at 08:08:18 UTC. Both audiences show operational week 3. Visit counts and order totals reconcile to the pre-refresh baseline.

- Reps: 11,909 scheduled visits; 11,679 attended. Store identities reconcile to 6,948, versus 6,950 before master enrichment.
- Merchandisers: 54,094 scheduled visits; 50,799 attended. Store identities reconcile to 4,329, versus 4,330 before enrichment.
- Orders unchanged: 3,681 selected lines, 229 orders, 16,198 units, recorded amount 2,368,509.69. Source currency remains "Not supplied".
- Final metadata read-back passed for all 14 affected documents, including the preserved specialist campaign lookup.

Direct access by the current operator account to the private Azure Orders snapshot returned HTTP 403. No keys, impersonation or permission changes were used to bypass it. The Firebase/public-service region reference is updated, but Azure's separate Orders lookup is pending explicit approval for extending the authorized publisher. The existing Orders snapshot was left intact.

Attendance source data still ends on **21 September 2026**. Master/week refresh is not a fresh visit import.
