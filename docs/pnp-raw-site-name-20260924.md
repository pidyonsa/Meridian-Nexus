# Anchor / Pick n Pay Raw Site Name

Request: template Site Name must come from the raw inventory file, not the
store master.

## Output Contract

- Template column E, `Site Name`, uses the raw Sheet1 column C,
  `Site Description`, preserving the source text, case and spacing.
- Blank raw names remain blank; no fallback to the master name is introduced.
- Canonical store code/name remains available separately in facts, exceptions
  and staff assignment records. Store matching, region enrichment, liquor
  exclusions and approved non-blocking warning rules are unchanged.
- The other 16 template columns and all stock/row reconciliations are unchanged.

The API pins `outputPolicy: pnp-raw-site-name-v1` in each new run, its input
manifest and its fingerprint. Reusing the same raw file and processing rules
creates a new run instead of returning an existing canonical-name workbook.

Manifests without an output policy retain `pnp-master-site-name-v1` behavior.
Completed reports and approvals are not rewritten. Generate a New run to
obtain the updated workbook. No automatic production run is started by this
release.

## Verification

58 focused engine, worker, API and reference tests passed. Fixtures cover
literal text, whitespace, empty raw names, missing store mappings, unchanged
canonical relationships, Excel export, preview and JSONL outputs, and reuse
of earlier run fingerprints.

Local replay used the 1 September inventory sample and the user-corrected
store file uploaded on 24 September. Every one of the 3,421 exported Site Names
was checked against its original raw row after reopening the XLSX; 3,352 names
differed from the previous output. All other columns, totals, exceptions,
warnings and staffing assignments matched the previous transformation.

Release script: `scripts/release-pnp-raw-site-name.cjs`.
Test and deployment evidence: `.tmp/pnp-raw-site-name-20260924/`.
Only the inventory worker and `meridianEtl` API change. Hosting, Resources,
credentials, schedules and other automation functions are not changed.
