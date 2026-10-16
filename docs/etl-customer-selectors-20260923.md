# File-Based ETL Customer Selectors

The manual/file-based ETL register has one row per retail channel, with a
Customer dropdown rather than repeated customer rows. Customer names come from
the live saved pipeline catalogue, not a hardcoded Anchor list. The initial
channel rows require a customer selection; they do not silently select Anchor.

Selecting a customer resolves that customer's channel and data-type setup.
Sales and inventory remain separate configurations. A customer not yet linked
to the selected channel opens a prefilled setup dialog instead of using another
customer's files or transformer.

The dropdown includes **Add customer**. A new customer is saved with their first
channel setup and then becomes available in all customer selectors. Existing
customers can be linked to additional channels through the same dialog. Names
are compared case-insensitively with normalized whitespace. Selecting an
existing customer/channel/type opens its saved configuration without replacing
its files, mappings or revision.

Setup and New run selectors now follow retail channel, customer and data type.
Changing selection retains the current channel/type where applicable and guards
unsaved setup edits. Readiness remains authoritative: unvalidated configurations
cannot inherit Anchor/PnP's runnable transformer.

## Verification and Release

- 26 focused API, registry, reference and portal-component tests passed.
- Full-app browser checks passed on desktop and 390/320 px mobile viewports.
- Browser coverage includes Penflex/Dynamic Brands selection, Ethica's separate
  sales and inventory setups, new customer creation, one customer on multiple
  channels, case/whitespace duplicate protection, no raw-file inheritance,
  inventory approval/download regression, portal Run regression and sign-out.
- All browser accounts and jobs are synthetic. No production extraction ran.
- `scripts/release-etl-customers.cjs` publishes only four Hosting assets from the
  current live baseline: `etls.js`, `etls.css`, `index.html`, `service-worker.js`.
- Backend functions, workers, permissions, stored references and credentials are
  not changed. Evidence and final live verification are in
  `.tmp/etl-customers-20260923/`.
