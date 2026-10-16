# Admin and Chat Repair

## Production status

Published the scoped Admin user-save repair on 9 September 2026:

- `saveAdminUser`: `saveadminuser-00048-qum`.
- Hosting: `6e4d47443e20147c`; app tag `20260909-admin-user-repair`.
- Three Hosting assets changed: the Admin form logic, inline save status and
  service-worker cache version. The remaining 55 assets are unchanged.
- Existing function IAM, environment, secrets, capacity and runtime configuration
  are preserved. No rules, accounts, roles, bucket policies or unrelated functions
  were changed. No synthetic account was created in production.

The production form previously dereferenced `event.submitter` outside its error
handler. Keyboard/programmatic submission now has a safe fallback, concurrent
submissions are blocked, and save errors remain visible in the form. Known Auth
failures are translated into actionable messages without provider internals.
When Auth succeeds but profile/claim/audit persistence fails, the returned account
UID lets the administrator explicitly retry an update instead of creating a duplicate.
A lost response before that UID is received still requires selecting the existing
account; this is not a distributed transaction or full creation-idempotency system.

## Administrator role

Production intentionally allows full Administrator access only to
`admin@nexus.co.za`, across frontend, backend and rules. The form previously offered
that role for any email, while its generic error formatter hid the backend's
explanation. The new form explains the restriction before submitting.

Recent production logs showed a 403 followed by a 200, not a general user-creation
outage. Logs do not expose the requested role, so that sequence alone does not prove
the exact cause of the user's attempt. Clarification was requested: creating staff
from Admin versus granting another person full Administrator access.

Multiple administrators have NOT been enabled. That is a separate, deliberate
authorization change requiring consistent updates to claims, profile checks,
Firestore/Storage rules, chat/AI guards and protection against removing the last admin.

## Chat and AI

The enhancements described in `chat-enhancements-2026-09-09.md` remain local/staged,
not published: attachments, voice, offline outbox, device push, task reminders,
private follow-up memory and reviewed task creation. Existing groups, replies,
reactions and message-to-task remain unchanged in production.

This repair added AI permission checks before returning cached job answers and
again after a model response. Deleted/reassigned jobs invalidate access even if the
user's menu permissions are unchanged. Reviewed drafts also recheck source-job
ownership transactionally before becoming shared tasks.

Production activation still needs approval for the chat/AI release, message trigger,
five-minute scheduler, Web Push configuration, and runtime object-admin access only
to `meridian-chat-attachments/`. No broad bucket grant or public download access is
proposed. Real push/reminder delivery and private Storage transfers need smoke tests
after activation. Type/signature checking is not antivirus scanning.

## Verification

- `node scripts/test-meridian-chat.cjs`: 51 backend and Firestore emulator tests
  passed, including three additional Admin-save cases. The suite uses the actual
  Firebase `HttpsError` class to verify structured partial-save recovery details.
- `node --test scripts/tests/admin-user-save.test.cjs scripts/tests/assistant-job-access.test.cjs scripts/tests/chat-worker.test.cjs`:
  16 tests passed.
- `node scripts/tests/admin-user-browser.cjs`: staged form, Enter/null submitter,
  explicit role validation and partial-update workflow; synthetic data only.
- `node scripts/tests/chat-enhancements-browser.cjs`: offline persistence/retries,
  attachments, simulated recording, AI review, reminders, mobile and account isolation.
- Seven mocked AI prompt-contract checks passed again. The seven live synthetic
  Gemini checks from the earlier chat implementation remain recorded separately;
  mocked checks do not measure live model quality.
- All three live Admin assets match staged bytes. Anonymous `saveAdminUser` calls
  return 403. No real employee account was created or modified for verification.

## Release files

Baseline and staged bundles: `.tmp/admin-chat-repair-20260909/`.
`scope-manifest.json` documents the narrow overlays. The preparation script asserts
that reversing its modified function blocks exactly restores each live baseline.
The full local `functions/index.js`, `public/` and pending ETLs must not be bulk deployed.

The initial Hosting baseline is now superseded by this Admin release. Before chat
publication, verify the current live version against `admin-hosting.after.json` and
preserve any newer unrelated changes. The deployment helper deliberately refuses
chat Hosting publication until infrastructure approval and checks are handled.

Local synthetic chat preview: http://localhost:57653/?enhanced#chat
