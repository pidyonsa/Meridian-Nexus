# Staff Admin Access Release

## Requested Account: Granted

The user explicitly requested Admin access for UID `auNcNaXnujgblAR9ZNzFgJFBv592`.
The enabled account already had an Admin profile, but its Firebase Auth Admin claim
was false. The grant synchronized the claim, staff account type and full Admin
permissions. Its password, enabled status and unrelated profile fields were
preserved. Existing Chat opt-out settings remain respected.

The profile update and an `accessAuditLogs` entry were committed together with an
update-time precondition. No other staff account was changed. Evidence is stored
privately in `.tmp/multi-admin-20260910/requested-grant/`.

## Portal Rollout: Deployed

Hosting version `dfae27958c6cf54a` was published and the final live checks completed
at `2026-09-10T08:19:48.040Z`. Its application tag is `20260910-multi-admin` and its
service-worker cache is `meridian-nexus-v60-multi-admin`. All 86 changed callable
endpoints are active; the other 36 deployed functions retain their original
revisions. Of 64 Hosting assets, only the three approved files changed.

`saveAdminUser` is revision `saveadminuser-00049-teg`; `deleteAdminUser` is revision
`deleteadminuser-00040-zar`. Firestore and Storage rules were published and their
live source content verified. The requested staff account was read back again
after deployment: enabled, staff profile, Admin role and Admin claim all agree.

The user separately approved the complete multi-admin production update after
being informed that it covers User Management, security rules and protected APIs.
This supersedes the earlier rollout approval block; it does not authorize unrelated
changes, account promotions or infrastructure migration.

The fresh audit found 90 callable endpoints. Only 86 require source updates.
`getOperationsWorkspace`, `meridianChat`, `meridianChatMedia` and `meridianEtl`
already have the relevant staff-aware checks and remain unchanged. Scheduled and
event workers are excluded. Each changed endpoint is staged from its own deployed
source, with runtime configuration, secrets and IAM checked after deployment.

The portal overlay changes only `app.js`, `index.html` and `service-worker.js`.
Dashboard designs, caching improvements, Chat assets, ETL assets and the remainder
of the live Hosting manifest are retained. Firestore and Storage Admin checks
require both the Admin token claim and an active, non-client staff Admin profile.
Direct browser profile writes remain denied. Private conversations still require
membership. API checks additionally verify current Auth claims and revocation.

One missing production prerequisite was found during the rollout. The Google
managed Firebase Storage service account required
`roles/firebaserules.firestoreServiceAgent` for cross-service rules. The approved
binding was added only to that service account. Its sole included permission is
`datastore.entities.get`; it grants no write or staff cloud-console access. Every
other project IAM binding and audit configuration was verified unchanged. The
initial verification stopped because Google reordered the returned bindings;
order-independent comparison then confirmed the exact intended change, without
applying another grant. Callable and worker IAM permissions remain unchanged.

## Verification

- Nine focused Admin tests passed against the staged form and access helper.
- Fifty-three Firestore emulator and backend tests passed against the staged rules
  and user-save handler, including non-reserved staff emails, stale grants,
  disabled/client accounts, concurrent mutations and self-removal protection.
- Desktop/mobile Admin form tests passed with synthetic users.
- The signed-in browser regression passed with `manager@example.test`, including
  Admin session recognition, reports, cache isolation, Chat and client rejection.
- Both rulesets passed the Firebase server-side compiler.
- Nineteen direct Storage emulator checks passed, including profile revocation,
  disabled/client accounts and unassigned evidence. A checksum-verified portable
  Temurin Java 21 runtime was used inside the workspace; system Java and PATH were
  not changed. Firebase CLI updated its emulator cache, so the existing Firestore
  test runner now supports that verified runtime/cache when its older jar is absent.
- No real staff login was impersonated. No jobs, messages or business imports were
  triggered during verification.
- The live signed-out browser loaded the new application version without
  JavaScript exceptions and kept the Admin workspace hidden.
- Eight live anonymous API checks returned HTTP 401 or 403, including user save,
  user delete, operations, Admin history, Resources and reporting endpoints.

The staff member must refresh Nexus and sign out and back in to obtain the new
session claims. A real signed-in acceptance check is left to that account holder;
verification did not involve obtaining their password or impersonating a session.

Release script: `scripts/release-multi-admin.cjs`. Its deployment phases require
the tested manifest hashes and preserve the audited live versions. Do not deploy
the dirty project-wide source directories or rules as substitutes.
