# Nexus OTP Repair, 23 September 2026

## Live Fix

- Final Hosting version: `e71182bdede9576b`, verified at 09:36 UTC.
- Only `app.js`, `index.html` and `service-worker.js` changed on Hosting. All other deployed assets, backend functions, IAM, passwords and schedules were preserved.
- OTP submission has immediate sending feedback, a duplicate-submit guard, bounded response waiting and inline errors.
- Handled prompt IDs cannot reopen from stale workspace responses. An older workspace refresh cannot dismiss a newer prompt.
- Owner-only authenticated HTTP polling supplements the Firestore live channel, including outside Report Automation. The query excludes submitted OTP values and uses the signed-in user's token and existing security rules.
- Retry prompts stay inside Nexus. A new prompt and fresh code are required after a portal rejection. Codes are removed from the prompt after consumption.

## Validation

- Eight focused connection/readiness tests passed.
- Synthetic browser checks passed at 1440, 390 and 320px, covering duplicate submission, stale snapshots, overlapping prompts, HTTP fallback and the real six-field submission helper, including a leading-zero code.
- An unsupported combined-key command in the first retry was replaced with input selection and verified in the browser fixture.
- DataOrbis accepted the fresh Nexus-entered OTP for diagnostic run `dataorbis-wilmar-connection-3aa66bd7-c6f6-4c82-a635-555a342b9593`.
- Opened both Public Content folders: Massdiscounters Supplier Reports and Massmart Wholesale Supplier Reports.
- Opened Sales Extract and Monthly Sales Performance in both. Both monthly report pages returned data and exposed Sales Quantity / Sales Value Excl.
- Game monthly screenshot: `.tmp/dataorbis-live-validation-20260923/portal-1790156657374.png`.
- Release evidence and synthetic screenshots: `.tmp/dataorbis-otp-race-20260923/`.

## Remaining Work

This was a connection check, not a monthly extraction. No raw export or final workbook was published. The diagnostic is closed without marking a monthly job complete.

The default report is an aggregate across multiple months with Supplier set to All selected. The portal workflow must explicitly select Wilmar, the approved complete month and the required store/product dimensions before exporting. Row completeness, numeric conventions, mapping exceptions and final publication still require validation. The final destination folder remains unconfirmed. The all-admin monthly Run button must not be enabled merely because login now succeeds.

No-ETLs performance fixes remain paused and undeployed, per the user's interruption.
