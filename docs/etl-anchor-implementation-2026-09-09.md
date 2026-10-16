# Anchor / PnP ETLs Implementation

## Release Status

Implemented locally and staged against production Hosting version
`054d98408fcbd781`. Deployment has not occurred. The automated security review
requires explicit approval for the new service account, IAM grants, job and
container repository. No production identities, permissions, data or functions
were changed by the rejected deployment attempt.

The original source workbooks have not been edited. Existing attendance bots,
Display Compliance, Stock Fix and Insights are unchanged.

## Scope

- Native `#etls` workspace with the existing Nexus authentication and sidebar.
- Administrator-only; ordinary staff and external clients cannot read shared
  masters or use the ETL API. Existing Resources CRUD remains the file catalogue.
- Pipelines, New run, Review, Outputs and History views.
- Anchor/PnP adapter with the supplied 17-column Template schema.
- Separate DC Inventory, Store Assignments, Exceptions and Audit worksheets.
  Reference Errors is added when source masters contain Excel error cells.
- All unresolved source rows are accounted for; no arbitrary first-match joins,
  implicit zero fill, inferred exclusions or multiplication of inventory by staff.
- Column F is canonical for store names. Product matching is client/family/article
  scoped and may use exact ORIG descriptions to disambiguate product variants.
- The administrator explicitly chooses banner column D/G, report-date basis,
  DROS estimate period and missing-PO convention before submitting a run.
- Output approval requires zero unresolved store/DC exceptions and complete
  reconciliation. Approval records an audit entry; it does not feed Stock Fix or
  Insights automatically.

## Processing and Security

`Resources -> generation-pinned private input copies -> Cloud Run job -> private
output files -> authenticated review -> explicit output approval`.

`functions/meridian-etl.js` provides one callable API. It checks current Firebase
Auth claims, disabled/revoked state and the active Nexus admin profile on every
request. File paths are resolved from server-side Resources documents, never
accepted from caller-supplied Storage paths. Downloads are allowlisted and signed
for five minutes. Snapshot copies must not inherit Firebase download tokens.

`etl-worker/` contains an independently deployable Node 22 batch job. It does not
have Firestore access. Only the callable updates Firestore run/approval metadata.
The job writes progress and results into its restricted Storage prefix; the API
reconciles these statuses when runs are viewed or refreshed.

The worker enforces a 25 MB compressed file limit, ZIP expansion/entry limits,
sheet/header contracts, 25,000 raw rows and 100,000 reference rows per workbook.
Macros, external connections, embedded objects, encrypted workbooks, formula
cells and hyperlinks are rejected. Excel error cells remain missing values and
are audited. XLSX exports use literal string cells, not executable formulas.

Exact source generations are copied before processing. Content checksums, rules,
worker version and source filenames are recorded. Identical inputs/rules reuse
the same run identifier. Explicit retries of failed runs preserve history.
Resource deletion cannot remove an already-pinned input copy. Administrative
cloud access can still delete objects; bucket retention/lifecycle policy is a
separate operational decision, not silently enabled by this release.

## Proposed Cloud Resources

Project: `meridain-nexus`. Region: `us-central1`, matching the current deployment.
No account or database-region migration is included.

| Resource | Purpose / limits |
| --- | --- |
| Cloud Run job `nexus-inventory-etl` | 1 task, 1 CPU, 2 GiB, 30-minute timeout, no automatic retry |
| Service account `nexus-inventory-etl@meridain-nexus.iam.gserviceaccount.com` | Worker identity only; no Firestore, secrets or other pipeline access |
| Artifact Registry `nexus-etl` | Versioned worker container |
| Callable `meridianEtl` | 512 MiB, 1 CPU, max 3 instances, concurrency 10, 180 seconds |
| Firestore `etlRuns`, `etlApprovals` | Server-managed run/approval metadata, covered by existing default-deny client rules |

Proposed IAM additions on `meridain-nexus.firebasestorage.app`:

| Identity | Role | Prefix |
| --- | --- | --- |
| ETL worker | Storage Object Viewer | `etl-run-inputs/` |
| ETL worker | Storage Object Admin | `etl-results/` |
| Existing Nexus compute/API account | Storage Object Admin | `etl-run-inputs/` |
| Existing Nexus compute/API account | Storage Object Viewer | `etl-results/` |

The existing Nexus compute account also requires Cloud Run Jobs Executor With
Overrides **on this new job only**, to supply the run identifier. Existing IAM
bindings must be preserved. Client Storage rules do not need expansion: uploads
use the existing admin-only `portal-resources/` path; outputs are callable-only.

Cloud costs will include per-run compute, builds, stored inputs/outputs and small
Firestore metadata traffic. No schedule or continuous ETL service is introduced.
The release uses the current project and does not establish new billing terms.

## Validation Against Supplied Files

The local test uses the observed 30-day estimate, column D, an exported report
date, and unknown/blank open PO for comparison. This is a test configuration,
**not a production business-rule approval**.

| Reconciliation | Result |
| --- | ---: |
| Raw input rows | 3,462 |
| Store rows | 3,430 |
| Separate DC rows | 32 |
| Validated store rows | 1,671 |
| Store rows requiring review | 1,759 |
| Invalid DC rows | 0 |
| Source store SOH | 141,358 |
| Validated store SOH | 71,436 |
| Exception store SOH | 69,922 |
| Distinct DC SOH | 131,372 |

Issue counts overlap because a row can have more than one problem: 1,721 store
mapping issues, 1,752 missing/conflicting region mappings, 91 DC mapping issues
and eight product mapping issues. The exception workbook identifies source rows
and available reference candidates. Corrections must be made in the authoritative
references and followed by a new run; the pipeline does not guess them.

No Shoprite raw inventory workbook was supplied. Its 12,903 rows in the combined
example cannot be reproduced from the PnP raw file. July monthly sales are not
used as September four-week actual sales.

Local artifacts: `.tmp/anchor-etl-validation/anchor-pnp-DRAFT.xlsx` and
`.tmp/anchor-etl-validation/result.json`. These contain business data and are not
part of Hosting or the container build context.

## Verification and Release

- `node --test etl-worker/test/engine.test.cjs scripts/tests/etl-api.test.cjs`
- `node scripts/test-anchor-etl-real.cjs`
- `node scripts/tests/etls-browser.cjs`
- `npm audit --omit=dev` in `etl-worker` (zero known vulnerabilities at validation).

The focused suite currently passes 16 tests, including actual ZIP expansion
validation against forged compressed-size declarations. The supplied-workbook
validation and all browser checks also pass. A localhost UI server is running at
the URL recorded in `.tmp/etl-local/server.json`; cloud processing remains
unavailable until deployment is approved and verified.

Browser tests exercise actual staged Nexus markup, the sidebar, anonymous/staff
denial, explicit rule confirmation, all five tabs, draft approval blocking,
error recovery and logout races. Desktop/mobile screenshots are under
`.tmp/etl-browser-verification/`. Browser service responses are isolated test
fixtures; this is not a claim of production end-to-end verification.

`scripts/release-etls.cjs` stages the current live Hosting baseline and overlays
only the ETL additions and cache version. It does not bulk-deploy the dirty
worktree or replace any existing functions. The baseline and release metadata are
under `.tmp/etl-release-20260909/` and must be retained for comparison/rollback.

After explicit cloud approval, install/audit the isolated API dependencies, then
run `assemble`, `infrastructure`, `build`, `deployJob`, `deployApi`, `deployHosting`
and `verify`. Perform a cloud worker smoke test and authorised API tests before
the Hosting release. Do not seed files or approve a real batch implicitly.
