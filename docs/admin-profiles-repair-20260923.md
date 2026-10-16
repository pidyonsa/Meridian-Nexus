# Admin extraction-profile loading repair

## Findings

- The live `retailers` collection still contains the Game and Makro/Jumbo
  profiles. No records needed to be recreated.
- The user identified `admin@nexus.co.za`. Read-only checks confirmed that the
  account is enabled, its authentication claim is `admin: true`, and its
  `adminUsers` record satisfies the deployed Firestore admin rules.
- The deployed UI initialized the list to zero and "No extraction profiles
  configured" before any authoritative read. It depended exclusively on a live
  Firestore listener; failure produced only a transient toast, and a stalled
  connection could leave the false empty state indefinitely.
- The exact user's network failure could not be observed remotely. Full-page
  tests reproduce the misleading zero state when the live feed is stalled and
  verify recovery through a normal authenticated one-shot read.

## Changes

- Added a bounded one-shot Firestore REST query using the signed-in user's
  Firebase ID token. It uses the same database and security rules, not an admin
  service credential. A selected field list excludes stored secret documents.
- Kept live updates; ignore cache-only empty snapshots and stale responses.
- Show explicit loading, failure and timeout states, with a retry action.
  Only a successful, empty server response means no profiles are configured.
- Cancel reads and ignore callbacks on sign-out or account change. Access
  denial clears the list and never falls back to broader permissions.
- Refresh the list after saving. Existing workflow selections remain available
  when the separate step-list subscription has not loaded, so a credential
  edit cannot accidentally unlink a saved workflow.
- Existing malformed unnamed profile documents were not deleted or modified.

## Verification and release

- Ten focused loader tests passed: authenticated projection, stalled stream,
  cached-empty response, response ordering, denial, logout, timeout, empty
  success and malformed/oversized results.
- Full deployed-page Edge tests passed with synthetic auth and data: profile
  loading while the stream stalls, editing, password clearing, post-save
  refresh, preservation of linked steps, retry, denial and sign-out.
- Reviewed desktop and mobile screenshots. Test code does not use a real
  user's token or password.
- Deployment cloned the exact live Hosting manifest and configuration. Only
  `app.js`, `index.html`, `service-worker.js` and new `admin-profile-loader.js`
  changed. Unrelated local changes were not deployed.
- Prior release: `a1babbe6d629e421`. New release: `a87ad7056c61884b`.
- Live asset/configuration verification completed at
  `2026-09-22T22:19:38.318Z` (23 September in South Africa).
- Firestore rules, account permissions, passwords, backend functions, database
  records and schedules were not changed.

Private evidence is Git-ignored under `.tmp/admin-profiles-20260923/`.
The user should refresh the portal with Ctrl+Shift+R, then open
Admin > Extraction profiles. A persistent access or transport failure is now
displayed in the list rather than presented as zero configured profiles.
