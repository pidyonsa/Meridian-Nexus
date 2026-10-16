# Attendance Analytics Release - 10 September 2026

## Scope

- Nexus Firebase login, sidebar and existing staff permission checks retained.
- Central division contains Free State and North West in attendance and Call Cycle views.
- Geo rep and merchandiser attendance use the verified Schedules workbook in Firebase Storage, enriched with the existing store master and the supplied National Reporting Hierarchy.xlsx.
- Full manager/team scorecards, audience-correct rosters and reporting lines replace truncated summaries. Higher-level manager filters include their mapped teams.
- Target, Actual, Not Visited and Unverified counts open their underlying source records. Daily selection, pagination and Excel export use the same filters and source version.
- Distinct missed stores are separated from missed scheduled visits. Unverified results are not silently reported as missed or completed.
- Caught up on: YYYY-MM-DD counts positively as attended against the original scheduled day. Detail and Excel preserve both scheduled and completed dates.
- Weekly attendance aggregates completed schedule records using attended, not an absent onSchedule input.
- Call Cycle retains the existing dashboard format and all plan assignments, including leave. Central classification and filtered Excel exports were added. Further Call Cycle redesign and expanded numeric drilldowns remain for the subsequent business review.
- Overlapping sticky header and narrow-screen filter/table issues addressed within the attendance workspace.

## Verified Source

The table below records the initial release, before the approved early-visit follow-up at the end of this document.

Report: Geo_Rep_Strike_Rate_Report_2026-09-01_to_2026-09-09.xlsx.
Firebase file ID: 7adec2bd-b9c2-4336-b455-4651d19ecefb.
Hierarchy: 134 unique assignments, including 133 syndicated reps and one dedicated assignment. One duplicate source row was removed. No fuzzy people mappings were invented.

| Measure | Reps | Merchandisers |
| --- | ---: | ---: |
| Staff in roster | 155 | 2,776 |
| Eligible scheduled visits | 5,660 | 24,139 |
| Attended, including catch-ups | 5,379 | 22,725 |
| Catch-ups included | 1 | 29 |
| Missed scheduled visits | 280 | 1,399 |
| Unverified early-visit results | 1 | 15 |
| Distinct stores not visited | 216 | 156 |
| Geo Strike rate reference target | 5,701 | 24,159 |
| Geo Strike rate reference actual | 5,398 | 22,753 |
| All call-plan assignments | 6,327 | 26,857 |
| All call-plan stores | 5,180 | 4,188 |

The differences between Geo's Strike rate summary and its individual Schedules records remain visible. Their exact cause is not yet established. Do not add balancing records or present the independent summary as reconciled. Leave entries are excluded from attendance targets but remain in the call plan. Early-visit entries were initially unverified; the user subsequently approved counting them positively, as recorded below.

## Access and Review

All 33 people in the workbook's NEXUS ACCESS sheet have verified viewer access: 32 new normal-staff accounts and one existing viewer. No Admin roles were granted. New accounts must use Forgot password to establish their sign-in. No passwords or invitation emails were sent.

Three workbook reps are missing from the Geo strike-rate source: Revilo Phillips, Damian Mark Bruyns and Vanessa-Lee St John. One additional mapped rep has no scheduled detail. There are 25 unmatched rep reporting lines and 187 merchandiser records whose rep-to-manager mapping needs confirmation. These are reconciliation exceptions, not manufactured attendance records.

The detailed workbook is attendance-reconciliation-2026-09-10.xlsx in this directory. The Nakita/Natasha message is a draft only, in attendance-review-message-2026-09-10.md. Retain existing reporting until the data exceptions and reporting lines are reviewed and signed off.

## Verification and Operations

- 13 automated calculation, hierarchy, source-version and permission tests passed.
- Desktop/mobile browser checks passed: manager filtering, daily drilldowns, positive catch-up status, real attendance Excel download, Call Cycle export selection, cache/logout isolation and no JavaScript page errors.
- Live normal-staff API checks passed for both audiences, including filtered detail and Excel row counts and full Call Cycle coverage. Temporary test accounts and profiles were deleted.
- Local syntax checks passed. Private hierarchy data is bundled only with the backend, not in public Hosting assets.
- Release staging and live evidence: .tmp/attendance-analytics-20260910-v4/. verified.json records the final Hosting and backend versions.
- Only getGeoRepAttendanceDashboard and five Hosting assets were released. Runtime settings, IAM, security rules, other Hosting assets and automation workers were preserved.
- Local source was updated with scoped patches, preserving unrelated pending Admin, Chat, ETL and other changes. Do not deploy the entire dirty workspace without reviewing those changes separately.

## Early-Visit Follow-Up

- User-approved rule: `Early visit on: YYYY-MM-DD` counts as attended against its scheduled day, like a caught-up visit. The actual visit date and original Geo result remain in detail and Excel; no extra target is created on the completion date.
- Only explicit results with valid calendar dates qualify. Cancellations, malformed dates and unclear results remain unverified.
- Both audiences use the same calculation for team, region, daily, weekly and store totals, filtered drilldowns and exports. The source version changed so stale detail/export requests must refresh.
- Deployed only the analytics module in `getGeoRepAttendanceDashboard`, revision `getgeorepattendancedashboard-00019-geb`. Source workbooks, authentication, IAM, runtime settings, Hosting, rules and other functions were unchanged.
- All 16 automated tests passed. Live normal-staff checks verified early visits in Actual detail and Excel for both audiences, with all group totals reconciled. Temporary verification account and profile removed.
- Current report: reps attended **5,380**, including **1 early visit**; merchandisers attended **22,740**, including **15 early visits**. Both audiences now have **0 unverified results** in this report. Missed visit/store counts and targets remain unchanged.
- Evidence: `.tmp/attendance-early-visits-20260910/`; release helper: `scripts/release-attendance-early-visits.cjs`; live checks: `node scripts/smoke-attendance-analytics.cjs --early-visits`.
- Use Refresh in Geo attendance to replace previously cached totals.
