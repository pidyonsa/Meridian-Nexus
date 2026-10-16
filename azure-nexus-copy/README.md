# Original Nexus: isolated Azure copy

This directory covers the full original Nexus, including admin and automation.
It is not the limited `azure-nexus/` dashboard prototype and is not a replacement
for the live `azure-field-dashboards/` service.

## Operating boundary

- Firebase remains authoritative and serves existing users without a cutover.
- Destination: Meridian Group, subscription
  `02b268fe-e01a-453e-b287-eec83ccc0676`, new group
  `rg-meridian-nexus-copy`, Johannesburg (`southafricanorth`).
- Copied schedules, event consumers, live workbook writes, email/push delivery
  and dashboard publication stay disabled. Do not replay historical queued jobs.
- Separate storage and secrets from the portal runtime. Never use a public
  container, storage account keys or credentials embedded in an archive URL.
- Copy all database subcollections, source object generations, admin role
  records, audit/history and deployed code. Preserve unknown fields and typed
  Firestore values. Do not silently omit large records or failed objects.
- Do not migrate Firebase passwords, sessions or refresh tokens. Validate Entra
  identity-to-user mapping and negative authorization tests before enabling admin.
- Connection decryption keys and vendor credentials need separate Key Vault
  versions and restricted access, not app settings in plaintext or source control.

## Preparation tools

`scripts/nexus-azure-inventory.cjs` captures a new metadata inventory without
overwriting previous evidence. Regional failures remain explicit. Root document
counts are not full database counts because they exclude subcollections.

`scripts/nexus-azure-archive-code.cjs` saves the exact deployed Cloud Function
source archives, Hosting assets and rules as local content-addressed artifacts.
It validates source generations, size/MD5 and Hosting release hashes, including
the current admin interface and No-ETLs repair. It does not execute the copied
application. It does not yet archive container image layers or secret values.
Firebase's generated initialization responses are saved separately, explicitly
not release-hash verified or suitable for Azure reuse. The independent verifier
`scripts/verify-nexus-azure-code-archive.cjs <archive-directory>` checks all local
artifacts again without executing them.

`scripts/nexus-azure-copy-plan.cjs <inventory-directory>` creates a manifest
with collision-safe generation-specific object destinations. `--draft` records
incomplete discovery but never passes the inventory-complete gate. Every
execution and transfer gate is initially false. Generated evidence is ignored
by Git under `.tmp/nexus-azure-copy/`.

`infra/archive.bicep` is an undeployed archive-only foundation. Its network
endpoints are IP restricted, HTTPS/Entra authenticated, with anonymous and
shared-key blob access disabled. These are not private endpoints. Only an
explicit migration IP is permitted; no runtime, queues, timers, secret values
or secret-access grants are included. Temporary blob permissions exclude delete
and are restricted to the new containers. Remove the recorded assignments and
migration IP exception after verification. Key Vault purge protection lasts 90
days and cannot be bypassed for immediate teardown.

Deployment must verify tenant, subscription, group name, operator identity and
an exact public IPv4 address (not CIDR /0), then run Azure what-if. Do not deploy
into an existing resource group. Confirm charges and temporary source access
before provisioning or transferring business records.

## Remaining implementation

1. Resolve unavailable-region discovery and collect all external producer,
   container image, Eventarc/Pub/Sub and live index/auth configuration metadata.
2. Obtain a full, consistent Firestore export including nested and orphaned
   subcollections. Record the export read time and reconcile counts and types.
   A live ordinary export alone is not proof of a single consistent checkpoint.
3. Copy to isolated Azure containers with bounded streaming, resumable immutable
   destinations, source generation preconditions and destination read-back checks.
   Verify every file and report every missing generation. Retain Google originals.
4. Copy required credentials directly to Key Vault without console output; record
   names/versions only. Preserve encrypted connection data with the corresponding
   protected key, and verify restoration without logging plaintext.
5. Port the full API, realtime data, storage and auth contracts to Azure; restore
   the database into an appropriate transactional store. An opaque archive or
   copied frontend still pointing to Firestore is not an independent Azure app.
6. Adapt callable/event functions and Cloud Run workers to Azure queues/jobs,
   preserving admin checks, cancellation, idempotency and workbook concurrency.
   Firebase-emitted events must not invoke the Azure copy.
7. Validate all modules and all automations against isolated output destinations,
   including No-ETLs rules, scheduled/manual Attendance, month boundary and
   formula calculation. Run restore and reader/admin/unassigned access tests.
8. Provide the separate Azure URL only after authentication and isolation pass.
   No cutover or disabling Firebase is authorized by this parallel-copy request.

See `docs/nexus-azure-parallel-copy-20260922.md` for actual execution status.
