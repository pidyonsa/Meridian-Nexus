# DataOrbis client-specific logins

The user clarified that Wilmar and Espen have separate portal credentials,
each covering Game, Makro and Jumbo, and that OTP entry is required during the
process. The existing two channel-based setup profiles were converted to two
client-based profiles, not six separate logins.

| Client | Visible profile | Retained document ID |
| --- | --- | --- |
| WILMAR | Wilmar - Game / Makro / Jumbo | dataorbis-game-sales |
| ESPEN | Espen - Game / Makro / Jumbo | dataorbis-makro-sales |

Both connections use `https://pyramid.dataorbis.com`. Credentials are edited at
Nexus Admin > Extraction profiles using the existing username/password form.
The existing backend saves encrypted credentials to separate
`retailerSecrets/{profileId}` records. A blank password retains that profile's
existing password; there is no cross-client credential fallback.

## Safeguards

- Before applying, both usernames were blank, neither profile had saved
  credential metadata or a secret record, and neither had executable steps or
  an enabled schedule. Only secret-presence metadata was queried; no password
  values or encrypted payloads were read.
- Kept both original IDs to avoid migrating secrets or breaking references.
- An atomic, update-time-guarded commit changed only `name`, `extractionName`,
  `salesProcedure` and `restoration`. No credential, schedule, workflow-link,
  access-rule or backend-function changes were made.
- Each procedure now has Game's Massdiscounters report and Makro/Jumbo's
  Massmart Wholesale report, limited to that profile's client.
- Exact portal supplier labels still require verification. Client selection is
  not inferred from another client's sample or from a saved browser session.
- Wilmar retains its August reconciliation. Espen is explicitly marked
  `client-sample-required`; Wilmar's 1,327 matches are not Espen validation.

## OTP Status

Both profiles record interactive OTP as required, scoped to the run owner and
not reusable. The existing `waitForAutomationPromptValue` / `fillOtp` framework
creates prompts with the run ID, profile ID/name and owner; the submission API
checks run access and the prompt owner. OTPs are not profile passwords.

This change records the requirement and uses the existing prompt design. It
does **not** claim a tested DataOrbis challenge selector or executable workflow.
The portal's challenge stage and supplier/report controls still need a live
test after the user enters each client's credentials. Neither profile is linked
to runnable steps; schedules and publication remain disabled.

## Verification

- Eight focused tests cover client/channel scope, non-reusable OTP policy,
  correct sample ownership, credential-preservation guards and the actual
  credential handler's encryption and separate secret IDs using synthetic data.
- The deployed editor was tested with both new profiles at 1440, 390 and 320
  pixels, covering edits, password clearing/retention and procedure display.
- Live read-back verified both profile names, three-banner coverage, separate
  client identities and unchanged unrelated fields at
  `2026-09-23T07:15:06.623Z`.

The ignored audit and screenshots are under
`.tmp/dataorbis-clients-20260923/`. No new Hosting deployment was needed; the
existing profile loader reads the updated records.
