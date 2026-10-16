# Stock Fix and Firestore connection repair

## Confirmed cause

The Stock Fix request at 2026-09-08 07:13 UTC failed because the callable's
runtime identity could not read the published weekly source in Firebase Storage.
Cloud Logging recorded `storage.objects.get` denied (403); the unhandled error
became HTTP 500 at `getStockFixDashboard`.

The bucket policy gave the Stock Fix worker access, but did not give the Nexus
compute identity read access to `stockfix-source/`.

## Repair

- Added `roles/storage.objectViewer` for
  `730011371323-compute@developer.gserviceaccount.com`, conditioned on the object
  resource name starting with
  `projects/_/buckets/meridain-nexus.firebasestorage.app/objects/stockfix-source/`.
- No public access, write access, bucket-wide object access, or Firestore rules
  changes were added.
- Source-read 403/404 failures now produce a specific callable
  `failed-precondition` error. Other failures still propagate; a failed read is
  not presented as an empty, successful dashboard.
- Firestore uses forced long polling with a 25-second idle timeout and
  auto-detection explicitly disabled. Settings are applied before listeners.
- Updated the app cache version. No dashboard design or navigation changes.

## Browser diagnostics

`ERR_BLOCKED_BY_CLIENT` is consistent with a browser blocker. The asynchronous
message-channel text is consistent with extension messaging. The exact extension
cannot be identified from these logs. QUIC idle timeouts and expired Listen
sessions are transport failures, not evidence that a Firestore collection is
missing. Long polling does not control browser QUIC or bypass a blocker.

References:
- [Firestore polling timeout](https://firebase.google.com/docs/reference/js/firestore.experimentallongpollingoptions)
- [Chrome extension messaging](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)

## Verification and release scope

- Eight focused Node tests pass for source-read errors, successful reads,
  transient-error propagation, initialization order and cache references.
- Syntax checks pass for both edited JavaScript files and staged backend source.
- An extension-free Edge check against Firebase 12.15.0 confirmed the settings
  are accepted and startup has no uncaught application errors. No user was signed
  in or impersonated in that test.
- Hosting was staged from the live release: three assets changed and 50 other
  published files retained. Backend staging used the deployed source archive and
  changed only `readStockFixFirebaseWeekSummary`.
- The Stock Fix function update completed successfully. Final Hosting release
  `86c4b8f5f83d3b65` was verified by file hash: exactly the intended three assets
  changed, all 50 others and Hosting configuration remain identical. Reserved
  Firebase initialization assets were restored by their original hashes.
- The final production browser check passed. An unauthenticated callable request
  still receives the existing 403 `Nexus operations access is required.` response.
- A complete authenticated Stock Fix data load still requires verification in
  the user's existing Nexus session. Runtime impersonation was unavailable to
  the diagnostic CLI; no additional impersonation privileges were granted.

Test commands:

```powershell
node --test scripts/tests/stockfix-connectivity.test.cjs
node scripts/check-firestore-connectivity.cjs
node scripts/check-firestore-connectivity.cjs --live
```

## Follow-up: direct Stock Fix startup

The next browser trace showed only a blocked `TYPE=terminate` request during the
explicit fresh-claims check at sign-in, plus extension-style messaging errors.
The fresh-claims check remains in place; these warnings are not suppressed.

A separate direct-navigation bug was reproduced: the initial `#stockfix` route
could run before auth was resolved and was not reloaded after sign-in finished.
`configureAdminSession` now resumes Stock Fix loading after the claims and
workspace checks, and only if the user is still on `#stockfix`.

Five additional tests cover successful startup, navigating away while auth
loads, the normal-user landing route, unauthorised claims and sign-out. All 13
tests pass. Hosting release `e46ce62a7c054c35` contains only the app change and
the two cache-reference updates; all 50 other files retain their original hashes.
No backend, access policy or browser-protection changes were made in this follow-up.
