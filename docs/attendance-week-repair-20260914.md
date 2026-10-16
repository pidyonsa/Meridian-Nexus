# Salesforce attendance recovery: 14 September 2026

## Diagnosis

- The monthly helper treated the days before the first Monday AND the following Monday-Sunday as Week 1. The 11 September bot run put 1-10 September into Week 1 (3,218 workbook actual visits).
- Correct calendar mapping: 1-6 September = Week 1; 7-13 September = Week 2; 14-20 September = Week 3. The existing five-column workbook contract is retained.
- Daily replay separately used the worker's current week as the SmartSell cycle reference. It now uses the saved SmartSell week-confirmation timestamp. Jennifer confirmed cycle Week 1 on 7 September; replaying Friday on Monday must still use that cycle, not cycle Week 4. Calendar weeks and SmartSell cycle weeks are distinct.
- Both attendance schedules had been disabled on 10 September. Jennifer remains their owner and has permission to run both jobs and manage their schedules.

## Delivered

- Scoped production-source deployment of `processExtraction`: monthly week helper, stable daily cycle reference, and audit field recording the reference date. Unrelated local work was not deployed.
- Six new regression tests, plus twenty existing source/date/retry tests, passed. Tests include Week 1/2 reconciliation, repeat-run idempotency, unchanged later weeks, and Friday replay.
- Worker gRPC timeouts exhausted its four processing slots. Applied `FIRESTORE_PREFER_REST=true` to this worker only. Revision `processextraction-00439-miz` successfully picked up both recovery jobs afterwards. Source, IAM, secrets, triggers and capacity were verified; the transport environment variable is the only additional configuration change.
- Resumed the existing 08:00 Daily weekday schedule and 09:00 Monthly daily schedule. Today's scheduled slots are represented by the explicit Friday recovery jobs, preventing duplicate launches.
- Created a high-priority task for Jennifer in her existing private conversation with Nexus Admin. No chat memberships, roles or user permissions were changed.

## Initial Source Block

At the initial check, the newest approved raw export was `Updated South Africa Attendance Report-2026-09-11-09-26-11.xlsx`. Its verified metadata covered completed attendance only through 10 September and could not establish all Friday attendance.

Both recovery jobs rejected that partial source without changing a workbook. They retain Jennifer and the original reporting dates, with bounded source retries every ten minutes for up to two hours. The initial Monthly retry is offset after Daily to reduce simultaneous shared-workbook writes. The retry and regular schedulers were verified returning HTTP 200.

- Daily job: `attendance-repair-20260914-daily`. Reference date 14 September intentionally resolves to previous business day 11 September.
- Monthly job: `attendance-repair-20260914-monthly`. Reconciles all covered weeks for 1-11 September.
- Jennifer task: `attendance-week-repair-20260914-jennifer`, status `blocked` pending the fresh export, due 14 September.

The user agreed to ask Jennifer to upload a fresh month-to-date export, with Visit Date >= 1 September, generated after Friday ended. The recovery subsequently completed as recorded below.

## Preserved Workbook

The configured SharePoint item was renamed `Rep Attendance Auto - September 2026.xlsx` and modified on Sunday 13 September, after the last recorded bot run. It already contains Week 1 = 1,435 and Week 2 = 2,239. The Daily sheet has rows through 10 September only. Those later workbook changes were not overwritten with the older export.

A read-only workbook backup, original deployed source, configuration snapshots, mutation plans, and verification logs are under `.tmp/attendance-week-repair-20260914/`. Treat them as internal operational records containing staff data. The original workbook backup SHA-256 is `713f23580bbe306acc3d7cb743d78d4118a2fa8bdbccfb309664c8e202bbab8c`.

The bot's existing pre-write backup, version checks, formula/pivot preservation and SharePoint round-trip validation remain in place. No workbook was changed using the initial incomplete source.

## Completion Verified

Jennifer uploaded `Updated South Africa Attendance Report-2026-09-14-08-47-33.xlsx`, complete through 13 September. The automatic retries selected it without needing another manual run.

- Monthly Friday recovery completed at 08:52 SAST (`DMSGPyWeJ4bIcXabEsxu`): 1-11 September, Week 1 = 1,437; Week 2 = 2,236.
- Friday Daily completed at 08:58 SAST (`RSG3ryvgk53AgpQQoGqf`): 444 planned rows and 337 attended. The 14 September SmartSell master, confirmed as cycle Week 2 that Monday, correctly resolved Friday to cycle Week 1.
- Jennifer's newer monthly update completed at 09:08 SAST (`DDnaS5Q07PTbCz9WC9K5`), covering 1-13 September. It included 47 weekend visits: Week 1 = 1,437; Week 2 = 2,283; total = 3,720. This newer result was preserved, not replaced by a duplicate Friday-only replay.
- Independent source-to-saved-workbook verification at 09:40 SAST checked Friday's Actual cells and both monthly Actual columns for all 3,973 September plan rows: zero mismatches.
- There are 123 compliant visited store codes outside Friday's planned rows. These remain separate planning/route exceptions rather than being added to the planned attendance total.
- Jennifer's private task is ready for final review, with the first three technical checks completed. No review or approval was attributed to Jennifer on her behalf.

The current verified workbook snapshot is `fresh-1789371471459/blueprint-before.xlsx` within the recovery evidence directory. Its SHA-256 is `87e888a3a369952843dcfb929695b32acec601834f2b1d143b64b71acada2064`. The detailed result is `completed-verification.json`; `scripts/verify-attendance-september-recovery.cjs` reproduces the checks.

Transport reference: [Firebase Admin Firestore settings](https://firebase.google.com/docs/reference/admin/node/firebase-admin.firestore.firestoresettings).
