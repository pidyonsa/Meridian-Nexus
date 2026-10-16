# Latest Reports Repair

The verified Wilmar final workbook and audit already existed in private Storage
and the `files` collection. Latest reports depended on a separate legacy Files
listener rather than the periodically refreshed Operations response. It could
therefore show the default empty message independently of the completed run.
Its unconditional SharePoint Connected badge was also incorrect for Nexus files.

The old download action used the browser Storage SDK. The live `/uploads` read
rule still depended on temporary access that expired on 20 July 2026.

## Changes

- Operations loads at most 24 file records referenced by its newest completed
  runs, returning safe report metadata for active internal admins only.
- Latest reports and the Admin delivery list render that response. They no
  longer depend on the browser Files subscription. Loading, unavailable,
  restricted and genuinely empty states are distinguished.
- The existing admin resource-download callable accepts an extraction-report
  kind. It rechecks the active admin profile, source, completed run membership
  and private object path before returning an authenticated file chunk. Chunks
  are limited to 4 MiB, pinned to one Storage generation and checked for length.
  The browser assembles the original file and preserves its filename.
- Normal users, disabled accounts, external/client accounts, incomplete runs
  and unrelated files do not gain download access.
- Storage rules, IAM, workbook objects and business records are unchanged. No
  extraction, portal login or OTP request is started.

## Verification

Nine focused tests cover listing, bounded reads, access rejection, path and
range validation, generation changes and rendering with an empty Files state.
The captured deployed sources receive only their own endpoint patch and the
new report helper; the dirty local main application is not deployed wholesale.

An isolated browser uses the actual saved Wilmar metadata to display:

- `Aug26- ALL Clients by SKU.xlsx`
- `Wilmar Aug26 validation audit.xlsx`

Desktop, 390px and 320px checks cover rendering and download-button wiring.
The browser download API is mocked, not a real admin session. An authenticated
production download must be confirmed in the user's Nexus session.

The real saved August workbook was also passed through the range reader locally:
three chunks, 10,102,605 bytes. Reassembly matches its verified SHA-256 exactly:
`b26b90cc8c804bb1747c63193d7134b2e116b1b279966dabf8d451cdb7ba9611`.

Release evidence, hashes, screenshots and live verification are under
`.tmp/operations-reports-20260923-chunks/`. The release checks unchanged Hosting assets,
function runtime/IAM settings and extraction/No-ETLs revisions, and confirms
anonymous callable requests remain denied.

The initial listing release is retained under `.tmp/operations-reports-20260923/`.
An additional read-only IAM check found no signing role on the existing download
service account. Authenticated range downloads replace signing without granting
any new IAM role or creating persistent download tokens/public file links.
