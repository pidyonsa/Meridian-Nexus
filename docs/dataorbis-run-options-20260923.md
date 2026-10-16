# DataOrbis run selection and connection check

## Findings

- Both client profiles now have saved usernames and separate password records.
  The Wilmar credentials were saved at 07:27 UTC on September 23; Espen at
  07:26 UTC. No credentials were changed during this investigation.
- Both profiles still have zero executable steps and no extractionProfileId.
  The Operations endpoint deliberately filters out profiles without steps.
  The earlier client split created connections, not a working portal extractor.
- The local Wilmar sample transformer does not make an online run executable.
  Portal export, supplier/month verification, OTP handling within an extraction,
  and final publication remain unfinished.

## Scoped frontend correction

Admins now see the two client connections in Report Automation > Run job with
`Setup required`. Their saved connection state is shown, but Run and scheduling
remain disabled. Normal-user access and the server-approved profile list are
unchanged. Already-approved profiles win over stale local setup metadata.

Only app.js and its HTML/service-worker cache tags are deployed, using the
exact live Hosting manifest rather than the dirty local application tree.
The baseline is `a87ad7056c61884b`; release evidence is under
`.tmp/dataorbis-run-options-20260923/`.

Six focused selector tests and ten profile-loader regressions pass. Synthetic
full-page Edge checks verify both options, disabled Run, hidden scheduling,
desktop/mobile views, profile editing, access denial and logout. No real
credentials are used by browser tests.

## Live connection validation

The user approved entering the OTP in Nexus during validation. Wilmar's saved
password was decrypted only in process memory and submitted only to the
confirmed HTTPS DataOrbis portal. Espen's credentials were not used.

The portal advanced from login to `/totp-insert-code.html`, which requests a
six-digit Authenticator code in six separate inputs. The check then created an
owner-only Nexus OTP prompt for the previously confirmed admin UID. The prompt
timed out after seven minutes without a submitted code. It is now closed and
the validation record is cancelled, explicitly stating no report export or
template update occurred. No authenticated report-folder access was verified.

The local diagnostic script is not a deployed extraction workflow. It never
queues the cloud extraction worker, exports reports, changes schedules, or
writes a monthly workbook. It validates the deployed non-queued worker guard
before creating any diagnostic record, deletes consumed OTP values, closes
prompts, and shuts down its isolated browser. No credentials are written to
disk, logs, screenshots or these notes.

## Output request

The user requests the final filename `MonthYY- ALL Clients by SKU.xlsx`, for
example `Aug26- ALL Clients by SKU.xlsx` for the August 2026 reporting period.
Use the report month, not the execution date. The destination was described as
"here" without a path/link, so a folder clarification has been requested.
No destination has been assumed, no draft has been relabelled as final, and no
workbook has been published. Existing other-client rows must remain intact when
the combined monthly output is eventually implemented and validated.
