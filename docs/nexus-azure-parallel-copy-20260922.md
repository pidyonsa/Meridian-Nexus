# Original Nexus parallel Azure copy

## Scope

September 22, 2026: the user requested a copy of everything, including admin and
all automation, on Azure while Firebase continues working. This replaces the
earlier prepare-only scope for the requested parallel copy, but is not permission
to cut over, remove Google data or run duplicate production writers.

Specific confirmation has been requested for new private Azure storage, normal
storage/transfer charges, temporary read-only source access and separate Key
Vault secret copies. That confirmation is outstanding in this turn.

## Verified so far

- Meridian Group tenant and enabled subscription verified with the existing
  `cpillay@meridiangroup.co.za` CLI session. The new resource group does not exist.
- Current original Nexus inventory: 79 root collections, 513,613 root documents,
  22,450 stored object generations totalling 19,147,537,835 bytes, 128 functions,
  129 Cloud Run services, 3 jobs, 18 Cloud Scheduler jobs, 10 secret names and
  42 authentication users. Root document counts exclude nested records; live
  data continues to change during metadata discovery.
- Fixed Cloud Run discovery to use the v1 location list and concrete regional
  v2 service/job endpoints. Forty-two regions were readable; `me-central2`
  denied metadata access. A Cloud Asset cross-check is unavailable because that
  API is disabled. Neither new access nor API enablement was attempted.
- All 15 metadata retry/pagination, copy-plan isolation and code-archive tests
  pass. The archive-only Bicep template compiles locally. No Azure what-if or
  deployment has been run.
- At 10:08:51 UTC (12:08 SAST), independently read back 209 content-addressed
  local artifacts, 41,685,167 bytes: 128 deployed function source archives,
  107 versioned web assets across 4 Hosting sites, 4 Hosting configurations,
  2 rule sets and separately captured Firebase-generated responses. Source
  archives were checked against generation, length and MD5; versioned Hosting
  assets against release hashes; all local artifacts against SHA-256.
- Eight `/__/firebase/init.js` and `/__/firebase/init.json` responses are
  provider-generated, not release-hash-verified assets. They are preserved as
  observations and explicitly require Azure replacements. The initial mismatch
  report is retained, not erased. [Firebase reserved URLs](https://firebase.google.com/docs/hosting/reserved-urls).
- The original portal copy includes No-ETLs API revision
  `meridianetl-00006-qem`, Hosting version `de680a18b561a5a8`, and verified
  `etls.js`, `index.html`, `service-worker.js` repair assets.
- Generated a draft transfer manifest for all 22,450 known file generations.
  It retains the regional discovery errors and does not pass the complete
  inventory gate. All deployment, transfer and execution gates remain false.

## Not done

No new Azure resources, migration IAM grants, secret transfers, business-data
transfers, application deployments, scheduler changes or Firebase writes have
been made by this task. No complete, executable Azure Nexus copy exists yet.

The archive-only Bicep foundation and generation-pinned copy manifest are
preparation, not deployment. The Azure-only data/auth/API/automation adapters
and complete restoration tests remain substantial implementation work.

## Evidence

- Inventory: `.tmp/nexus-azure-migration/2026-09-22T09-54-36-247Z/`.
- Local artifacts and manifests: `.tmp/nexus-azure-copy/` (Git ignored).
- Independently verified code archive:
  `.tmp/nexus-azure-copy/2026-09-22T09-59-55-132Z-code/verified.json`.
- Architecture, safety boundaries and remaining gates:
  `azure-nexus-copy/README.md`.

Firestore's managed export includes all documents when collection filters are
omitted, but an ordinary live export may include changes made during export.
Use a supported consistent read-time checkpoint and verify it before claiming
a restorable snapshot. [Google export documentation](https://docs.cloud.google.com/firestore/native/docs/manage-data/export-import).
