# Meridian Chat Enhancements

## Delivery status

Implemented locally on 9 September 2026. No production functions, Hosting release,
IAM bindings, notification keys or rules were deployed during this task.
The existing production account is unchanged. ETL infrastructure approval remains separate.

Follow-up: the separate Admin-save repair is live; chat activation remains pending.
See `admin-chat-repair-2026-09-09.md` for the current Hosting baseline, additional
job-ownership checks for cached AI answers/task drafts, and release prerequisites.

## Included

- Attachments: three per message, 6 MB each. Images, PDF, TXT, CSV, XLSX, DOCX,
  PPTX and audio. File signatures are checked; standard Office containers are
  inspected for matching document structure and common macro/embedded-file entries.
- Voice: permission-based microphone recording, two-minute limit, preview, cancel,
  playback and download. Microphone tracks and media URLs are released on exit.
- Offline sending: IndexedDB outbox, stable request IDs, ordered retries per room,
  reconnect recovery, retry/delete controls and account-switch protection. Text
  and file blobs survive reload; they are never submitted as another account.
- Push: explicit browser opt-in, device-specific disable, generic lock-screen text,
  current membership checks, duplicate suppression, deep links and invalid-token cleanup.
- Task reminders: editable Johannesburg date/time, five-minute dispatch cycle,
  current assignee only, cancellation on completion and no repeated alert for a
  progress-note edit. Actual receipt depends on browser/network availability.
- AI: Gemini Flash only; server-owned private follow-up history, latest permitted
  evidence for each question, permission-change invalidation, short provider retry,
  editable task proposals and explicit confirmation before task creation.
- Existing groups, replies, reactions, staff-only eligibility, administrator grants
  and message-to-task flows are preserved.

## Security and retention

Private objects live under `meridian-chat-attachments/` in the existing Nexus
bucket. Browser Storage access is denied, including for administrators. Authenticated
callables upload/download bytes; no public URLs, signed download URLs or Firebase
download tokens are issued. Files become readable only after being bound to a
message in the same room. Removed messages and removed participants cannot download.
Already downloaded files cannot be remotely recalled.

Upload allowance: 12 requests/minute and 256 MB/day per user. Abandoned uploads
expire after 24 hours; removed attachments are queued for deletion. The scheduled
worker deletes their objects and metadata. Successfully sent, nonremoved files
remain with the conversation. Agree a company-wide retention policy before broad rollout.

The local outbox holds at most 50 messages / 30 MB, for at most seven days. It
contains unsent content only, never Firebase auth tokens or received message archives.
Sign-out/account changes clear other-user queues. This is browser storage, not an
encrypted corporate archive; staff must secure their devices and sign out on shared ones.
Sending resumes while Chat is open and authenticated; closed-browser background
sending and full offline sign-in are not promised.

AI history is one private session per user, at most six question/answer pairs, with
a 30-minute expiry and scheduled deletion. Clear-session invalidates pending results.
Permission changes invalidate both memory and task drafts. Group messages are not
automatically included in AI prompts. Only reviewed task fields are shared with a
chosen conversation, not the private AI transcript. Client accounts remain excluded.

Type/signature checks are **not malware scanning**. Office checks do not prove that
arbitrary documents are safe. Before wider enterprise file sharing, agree antivirus,
DLP and retention controls; keep device protection enabled and do not open unexpected
files. Cloud antivirus/quarantine is not implemented by this release.

## Verification

Run the local emulator suite with `node scripts/test-meridian-chat.cjs`.
The expanded suite passes 48 backend/rules tests, and
`node --test scripts/tests/chat-worker.test.cjs` passes four push/cache/retry tests.
Run UI regressions with `node scripts/tests/meridian-chat-browser.cjs` and
`node scripts/tests/chat-enhancements-browser.cjs`.

The enhanced browser suite verifies offline persistence, retries after lost
responses, file transfer, simulated microphone recording and preview, AI follow-up
IDs, editable drafts, Johannesburg reminder conversion, notification setup state,
390/320 px layouts and account isolation. It uses synthetic fixtures only.

`node scripts/tests/assistant-answer-evals.cjs` tests prompt contracts with a mock.
`--live` separately tests the real configured Gemini Flash model with synthetic data.
All seven live cases passed on 9 September: arithmetic/source/period, fresh evidence
over stale history, missing attendance, restricted training, untrusted-data
instructions, stale-data disclosure, and valid task draft structure.
Provider overload appeared in the first run; one bounded retry was added and the
full suite rerun successfully. This is regression evidence, not a correctness guarantee.

Artifacts are in `.tmp/chat-enhancements-verification/`, including screenshots and
`assistant-evals-live.json`. No real employee/customer dataset was used in live evaluations.
Real FCM delivery, production Storage IAM and mobile OS notification delivery still
require post-deployment validation. iOS/PWA/browser restrictions must be checked
on Meridian's actual managed devices.

## Production activation

This worktree contains unrelated pending changes. **Do not bulk-deploy `functions/`
or `public/`, and do not reuse the old first-time chat release scripts unchanged.**

1. Snapshot current live function revisions, Hosting assets and rules. Build a
   scoped release from that baseline; assert no unrelated exports/assets change.
2. Deploy the chat module using `functions/chat-entry.js` as the package entry,
   with `meridian-chat.js`, `chat-media.js`, `chat-notifications.js`,
   `assistant-memory.js`, `firebase-admin`, `firebase-functions` and `jszip`.
   Exports: existing `meridianChat`; new `meridianChatMedia`,
   `notifyMeridianChatMessage`, `deliverMeridianChatReminders`.
3. Separately port only the reviewed assistant access, workspace gating, memory and
   provider-call changes into the **current live** `askNexusAssistant` source. Include
   its existing secrets/configuration unchanged plus the supporting modules. Do not
   replace its entire source with a possibly stale local index.
4. Obtain approval for object-admin access to **only**
   `meridian-chat-attachments/` in `meridain-nexus.firebasestorage.app` for the Nexus
   runtime service account `730011371323-compute@developer.gserviceaccount.com`.
   Preserve every existing bucket IAM condition and do not make any object public.
5. Configure Firebase Web Push certificates in the existing project. Set the public
   key as `CHAT_WEB_PUSH_PUBLIC_KEY` on `meridianChat`. The private key stays managed
   by Firebase. Verify FCM sending permission for the runtime service account, and
   Eventarc/Scheduler service-agent permissions for the two background functions.
   Do not add broad project-wide roles simply to work around a missing permission.
6. Publish only the server-deny rules for the new private collections and Storage
   prefix, preserving all existing attendance/chat grants. Existing default-deny
   rules already block direct access. New queries use single-field indexes.
7. Overlay `chat-tools.js`, chat JS/CSS, its three script/style references, the
   `syncMeridianChat` identity hook and service-worker changes onto live Hosting.
   Retain the existing Nexus sidebar/auth and cache-bust the changed app file.
8. Verify actual uploads, membership removal, offline reconnect, opt-in push,
   sign-out notification suppression, due reminders and AI with authorised staff
   accounts. Roll back only these scoped changes if smoke checks fail.

No new server can access user microphones: recording is browser-side and requires
user permission. Background functions have explicit instance, memory and time bounds.

## References

- [Firebase web push setup](https://firebase.google.com/docs/cloud-messaging/js/client)
  describes the public VAPID key and browser permission requirements.
- [Firebase web message delivery](https://firebase.google.com/docs/cloud-messaging/js/receive)
  describes foreground/background delivery and service-worker integration.
- [MDN MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
  documents recording lifecycle and supported-format checks.
