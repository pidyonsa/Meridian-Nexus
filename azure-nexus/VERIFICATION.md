# Azure Edition Verification

Prepared 13 September 2026. This records local verification, not a cloud cutover.

- `npm test`: 19 tests passed. Includes positive early/caught-up attendance, Central division, manager-filtered detail and Excel, source version checks, cancelled/unknown-value orders, failed extraction retention, Cosmos publication ordering/ETags, role/tenant denial, workbook validation, latest filename selection and runtime dependency isolation.
- `node tests/browser.cjs`: 30 desktop/mobile dashboard combinations passed at 1366x900 and 390x844. Covered both attendance audiences, four attendance views and all seven order views, drilldowns, chart presence, import status dialog, navigation caching and independent sidebar scrolling. No browser console errors or document-level horizontal overflow. Screenshots are generated under ignored `test-results/`.
- Bicep template: compiled locally with Microsoft's Bicep CLI, no warnings. No deployment/what-if has been run against a real subscription.
- `npm audit --omit=dev`: zero reported vulnerabilities at verification time. ExcelJS's UUID dependency is explicitly updated through a compatible override and workbook exports were retested.
- Deployment ZIP: 24 allowlisted files, 104,630 bytes at packaging. Contains only application runtime, the two dashboards and assets, WebJob entry point, dependency manifests and the extraction manifest. No source workbooks, personal data fixtures, credentials, development preview, old portal or old cloud runtime SDK.
- `node scripts/verify-package.cjs`: deployment allowlist passed; all eight original source hashes still match. No old Nexus file was edited or removed. One superseded copied logo was removed only inside the new edition.
- Preview: `http://127.0.0.1:4180`, synthetic data only, loopback-only background process. Preview flags cannot enable development authentication through the production entry point.

## Required Before Production

### Setup Check, 14 September 2026

- Installed Azure CLI 2.90.0 from Microsoft's official Azure CLI release. The MSI's Microsoft Corporation Authenticode signature was valid and its SHA-256 matched the published release checksum. Installation and `az version` completed successfully.
- Recompiled `infra/main.bicep` using Azure CLI's Bicep command; compilation succeeded. This is local validation only, not a subscription what-if or deployment.
- Reran `npm test`: 19 tests passed. This does not verify Azure access, live source parity or staff sign-in.
- Windows account selection did not appear. Device-code sign-in reached Microsoft; the Meridian directory requested tenant-specific MFA. Browser portal access must not be treated as verified CLI subscription access.

### Remaining Gates

The Meridian Group tenant/subscription and app registration were verified on 15 September 2026; see [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md). Confirm available regional quota, assign and test staff access, complete cost approval, provision the infrastructure, configure Key Vault references, deploy the ZIP, transfer the real reference/report data, validate live Geo order API responses and backfill, arrange private cloud delivery of detailed attendance schedules, verify real totals/exports, enable and observe scheduled runs, configure alerts/budgets, test restores and complete manager acceptance. The current portal remains the rollback until these pass.

The attendance inbox consumer is implemented; the external Geo export producer has not been moved to Azure. Check-in-only records are not used to invent missing schedules. Subscription-specific costs, cloud authentication, Azure networking, API entitlement, production load and live business data were not verified locally.
