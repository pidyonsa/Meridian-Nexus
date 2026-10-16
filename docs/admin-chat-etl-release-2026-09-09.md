# Admin, Chat and ETL Release Status

September 10 update: the user explicitly approved the full multi-admin rollout.
The fresh audit and release are tracked in `multi-admin-release-2026-09-10.md` and
`.tmp/multi-admin-20260910/`. The historical approval-block notes below describe
September 9 only. Do not reuse those older function bundles for the new rollout.

## Admin Access: Implemented, Production Rollout Pending

Requested policy: an existing active staff administrator may give another staff member full Admin access. No single email address should reserve the role. Clients remain excluded; staff cannot promote themselves.

Implemented locally:

- Fresh staff profile and Firebase Auth claim checks for administrator requests, including disabled accounts and revoked sessions.
- Explicit Admin assignment in User Management and full administrator capabilities across the portal.
- Serialized account changes and self-demotion/self-disable protection, so simultaneous administrator changes cannot remove all administrators through the application.
- Firestore and Storage rules requiring an active staff Admin profile as well as the token claim.
- Tests for non-reserved staff emails, stale claims, external accounts, concurrent account changes, self-removal and keyboard form submission.

Only the `getOperationsWorkspace` pilot was deployed as part of the cross-portal access rollout: `getoperationsworkspace-00027-wuj`. Its runtime, secrets and trigger configuration were preserved.

A read-only check confirmed the existing bootstrap administrator has an enabled `admin` profile compatible with the pilot guard. This was not an authenticated browser-session test and did not change the account.

The automated approval review rejected the broad remaining callable rollout. Do not retry it indirectly or in smaller batches without explicit approval for that production scope. The requested specific approval was sent to the user; no response had arrived when this note was written.

The production Admin form and rules remain at their existing baseline. No staff account was created, promoted, disabled or deleted for verification.

### Resume Carefully

The later, separately approved chat/AI feature deployment changed `meridianChat` and `askNexusAssistant` after the original 88-callable audit. Re-audit those current revisions before preparing or deploying the complete role rollout. Do not restore their old source bundles. Two new callable endpoints, `meridianChatMedia` and `meridianEtl`, already use current staff/profile checks.

Never deploy the entire dirty local `functions/index.js`, Hosting directory or rules files. Existing function source bundles differ, so preserve each endpoint's own current source, runtime settings, secrets and IAM. Do not modify scheduled Salesforce, Stock Fix, display-compliance or other automation workers as part of the role rollout.

## Chat and AI Backend: Deployed

| Endpoint | Revision |
| --- | --- |
| `meridianChat` | `meridianchat-00004-juq` |
| `meridianChatMedia` | `meridianchatmedia-00001-zos` |
| `notifyMeridianChatMessage` | `notifymeridianchatmessage-00001-zuf` |
| `deliverMeridianChatReminders` | `delivermeridianchatreminders-00001-qal` |
| `askNexusAssistant` | `asknexusassistant-00016-zok` |

Features include private attachments, voice-note recording, retry-safe offline sends, private follow-up memory and editable AI task drafts requiring explicit confirmation. Existing groups, replies, reactions and message-to-task flows are retained.

Chat remains staff-only, subject to account eligibility, administrator opt-out and conversation membership. Administrators do not gain unrestricted access to other people's private conversations.

The reminder scheduler runs every five minutes through an OIDC-authenticated private endpoint. Successful scheduled HTTP 200 responses were verified; anonymous invocation returns HTTP 403. Chat/media/ETL anonymous callable requests return HTTP 401; unsigned-in AI requests return HTTP 403.

### Push Prerequisite Still Missing

Browser notification delivery still needs the project's public Web Push VAPID certificate key, plus permission and opt-in on each device. The UI reports notification configuration as unavailable when the key is missing. The user was asked for the public key only; do not request or store its private key in the browser.

Reminder scheduling is deployed, but this is not proof of notification delivery to an actual device. No unsolicited messages or test push notifications were sent to staff. Offline messages retry when Chat is open and authenticated, not as guaranteed closed-browser background sending.

### Security Boundaries

- Attachment objects use `meridian-chat-attachments/` and server-side membership checks. No public object access, Firebase download token or reusable signed attachment URL is exposed.
- File size/type/signature and archive limits are enforced. This is not a malware-scanning service; a dedicated malware scanner remains a separate hardening task.
- Push payloads use generic text and identifiers, not message bodies or customer details.
- Private media, tokens, draft and memory collections are denied to direct browser access by the existing default-deny rules.
- New Storage IAM grants are prefix-scoped. The runtime account's inherited project-level Editor role was not removed or replaced; prefix-scoped additions do not constrain permissions inherited from other roles. Review that legacy broad role separately.

## ETL Backend: Deployed

- Callable: `meridianEtl`, revision `meridianetl-00002-sux`.
- Cloud Run job: `nexus-inventory-etl`, one task, one CPU, 2 GiB, no automatic application retries.
- Worker identity: `nexus-inventory-etl@meridain-nexus.iam.gserviceaccount.com`.
- Worker reads only the granted `etl-run-inputs/` prefix and writes to the granted `etl-results/` prefix. No Firestore role was granted to the worker.
- API runtime can invoke this job with overrides and read its output using the separately configured scoped grants.

The Anchor/Pick n Pay adapter preserves the 17-column template, uses store-name clean-up column F, retains identifier zero-padding, separates distribution-centre quantities, reconciles stock, and blocks approval while exceptions remain.

The operator must explicitly confirm the banner column, report-date basis, missing-open-PO convention and DROS estimate period. Estimated sales are not relabelled as actual sales. No output is automatically published into Insights or Stock Fix.

Synthetic cloud execution `nexus-inventory-etl-lhxl4` completed successfully with one store row, one DC row and zero exceptions. No real inventory files were processed and no business output was approved. The initial `gcloud run jobs execute` attempt failed before launch because the CLI sent an unsupported `priorityTier` field; the successful retry used the same documented Cloud Run REST call as the Nexus API.

The synthetic result was verified from the successful execution and its worker logs, plus the API runtime's output-read IAM binding. Direct result download was not verified: the CLI identity cannot read this private output and lacks `iam.serviceAccounts.getAccessToken` to impersonate the API account. No extra human read access or impersonation grant was added. A signed-in administrator's real workbook upload/run/download flow remains a production acceptance check.

The initial signed-link download implementation was replaced before closing the release: ETL downloads now use authenticated chunks of at most 1 MiB, pin/check the object generation, recheck the administrator before returning bytes, and reconstruct a local browser download. The total output limit is 64 MiB. No signing or impersonation permission is needed. Tests cover chunk reconstruction, changed generations, invalid ranges, revoked Admin access, output size limits and the absence of signed URLs.

## Portal Release and Verification

The combined portal is assembled from live Hosting version `6e4d47443e20147c`, not by copying the dirty local portal. Eight assets change: the shell, application integration, service worker, two ETL assets and three chat assets. All other Hosting asset hashes and dashboard files are preserved.

Release scripts and evidence:

- `scripts/release-chat-etl-portal.cjs`: assemble, isolated AI deployment, guarded Hosting publication and verification.
- `scripts/verify-chat-etl-portal.cjs`: Admin form, ETL and chat browser suites; pins the tested asset hashes.
- `scripts/smoke-etl-cloud.cjs`: synthetic-only worker verification with a resumable operation record.
- `scripts/release-etl-downloads.cjs`: tested three-asset follow-up for authenticated downloads; no other portal assets change.
- `.tmp/approved-admin-chat-etl-20260909/`: original live sources, configuration and rules backups, deployed revisions, browser evidence and release manifests.
- `.tmp/etl-release-20260909/`: worker configuration, IAM backups, synthetic execution and result verification.

Verification completed before publication:

- 53 local Firestore-emulator security/backend tests using the isolated, pinned chat SDKs.
- 35 focused Admin, assistant, service-worker and ETL tests; the subsequent download fix adds two ETL cases, with all seven ETL API tests passing.
- Admin promotion/self-removal browser checks for the unpublished Admin feature.
- Production-baseline Admin save regression checks.
- ETL five-tab routing, anonymous/normal-staff denial, reconciliation, review gating, sign-out and desktop/mobile layouts.
- Chat attachments, fake-microphone voice recording, offline persistence, idempotent retries, reviewed AI task creation and account isolation.
- Both new isolated chat and ETL API packages report zero known npm dependency vulnerabilities at install time. This does not certify every legacy function dependency or all runtime security.

The combined feature release `b3ca0f78717c445e` was published and its full asset manifest verified. The follow-up download release `3476bf28670044fe` was published and verified at 2026-09-09 19:58 UTC; it is the final live Hosting version for this work. Its evidence is under `etl-downloads/created.json` and `etl-downloads/verified.json`. The broader full-Admin rollout and real-device push delivery remain pending independently of these feature releases.
