# Meridian Nexus: Azure Edition

This is a separate, allowlisted application. The existing portal, production environment and dirty working tree have not been deleted or deployed over.

## Scope

Retained: syndicated rep and merchandiser attendance, manager hierarchy, Central/Inland/Coastal breakdowns, daily and weekly attendance, store drilldowns, filtered Excel exports, and all seven Franchise Orders views with their existing charts and line-level drilldowns.

Excluded from the deployment ZIP: dedicated/Salesforce attendance, standalone Call Cycle, Insights, Stock Fix, ETLs, chat, AI, tasks, support, training, general automations, and the old cloud authentication/data SDKs. Reference imports are an administrator-only dialog, not another dashboard module. `PORT_MANIFEST.json` records the original hashes and the eight allowlisted extracts. The Azure runtime imports nothing from the original repository.

**Status:** local implementation and deployment preparation, not a completed live migration. A working preview uses prominently labelled synthetic data only. Live Azure sign-in, regional availability, data transfer, automatic source delivery and production reconciliation must pass before cutover.

Home, the Meridian logo and Back to portal return to `https://meridian-group-za.github.io/Meridian-Nexus/portal.html` in the same tab, including on mobile. Native browser history is not intercepted. Franchise Orders uses Previous selection for its internal drilldown return, so it remains distinct from portal navigation.

**Azure setup update, 15 September 2026:** CLI access to Meridian Group and its enabled subscription is verified. The single-tenant app registration and enterprise application now exist, with Reader/Admin definitions and assignment required. `jpinto@meridiangroup.co.za` has a verified Nexus.Admin app assignment; company-wide Reader access, sign-in testing and billable infrastructure remain pending. See [DEPLOYMENT_STATUS.md](DEPLOYMENT_STATUS.md) for the verified tenant, application IDs and remaining gates; do not create duplicate registrations.

## Architecture

```text
Assigned Meridian staff
  -> Microsoft Entra ID (single tenant, MFA/Conditional Access, app assignment)
  -> HTTPS Azure App Service (Node 24, South Africa North / Johannesburg)
       -> Attendance and Franchise Orders browser dashboards
       -> Server-side APIs and validation
       -> Managed identity -> private Cosmos DB endpoint -> versioned report data
       -> Managed identity -> private Blob endpoint -> source archives and inbox
       -> Managed identity -> Key Vault -> Geo API credentials

Hourly App Service WebJob (initially disabled)
  -> Geo Rep EPOD headers and details -> validated order snapshot
  -> Azure Blob attendance inbox -> validated detailed schedule workbook
  -> Private archive and immutable chunks -> atomic published-version switch
```

Geo Rep remains an external data provider. That does not make it an application hosting dependency. The application, database, archives and schedules run on Azure. Do not introduce a new dependency on an employee laptop to deliver attendance workbooks.

**Important source distinction:** the retained Franchise Orders adapter uses the existing Geo Open API EPOD/details contract. These are delivery/order records; a verified franchise-only classification requires the store master and source fields. Missing currencies/amounts are not invented. The detailed attendance **Schedules** export carries planned visits and results. A check-in-only feed cannot establish missed stores or targets. Direct schedule API replacement has NOT been verified against a live payload and is not silently enabled. Confirm how the Geo report producer will deliver the same detailed export to Azure before retiring the existing automation. The scheduled inbox consumer is implemented; the external report producer is not migrated by this code.

## Local Verification

From this directory, with Node 24:

```powershell
npm ci
npm test
node tests/browser.cjs
npm run preview
```

Preview defaults to `http://127.0.0.1:4180`, uses memory and synthetic fixtures, and binds only to loopback. It refuses Azure/production environments. No real staff records or secrets are shipped as fixtures. The production entry point refuses preview mode and missing Azure/Entra settings.

## Azure Setup, Step by Step

1. Sign in yourself at **https://portal.azure.com**. Use Meridian's directory. Do not send anyone your password, MFA code, recovery code or client secret. `gatewayadminportal.azure.com` is Power BI/Fabric gateway administration; it cannot provision this web application. A gateway is not required for these cloud-to-cloud APIs.
2. Open **Subscriptions**. Confirm a Meridian-owned billing subscription is visible. Record the subscription ID and tenant ID, not credentials. Provisioning needs Contributor plus permission to create role assignments (for example Owner or User Access Administrator). Entra application registration/assignment also needs the appropriate directory permissions. Gateway access alone is insufficient.
3. Install [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli-windows) or use PowerShell in Azure Cloud Shell. Run `az login --tenant YOUR_TENANT_ID`, then `az account list --output table`. Sign in interactively. If Windows does not show the account-selection dialog, run `az login --tenant YOUR_TENANT_ID --use-device-code --allow-no-subscriptions` and complete the Microsoft device sign-in, including MFA. Signing into the Azure portal alone does not authorize the CLI. Wait for the command to finish, then verify the Meridian tenant and an enabled billing subscription; a successful directory-only login is not sufficient to deploy. Run `scripts/azure-preflight.ps1 -SubscriptionId YOUR_SUBSCRIPTION_ID` for read-only checks. Azure CLI 2.90.0 was installed and verified on this computer on 14 September 2026. Reopen PowerShell to refresh PATH after installation, or invoke `& 'C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd'` directly.
4. In **Microsoft Entra ID > App registrations**, create a NEW app called `Meridian Nexus Azure`, accounts in this directory only. Add the two roles in `infra/entra-roles.json`. Configure ID tokens for the web sign-in flow. In its **Enterprise application > Properties**, set **Assignment required = Yes**. Assign only Meridian staff users/groups to `Nexus.Reader` or `Nexus.Admin`; do not assign guests or clients. Assign two named administrators and apply Meridian's MFA/Conditional Access policy. Record its application/client ID.
5. Create a NEW resource group in **South Africa North**, for example `rg-meridian-nexus-azure`. Do not reuse a resource group containing an unrelated production application. The application uses a dedicated VNet and private data endpoints; check that `10.42.0.0/16` does not conflict with Meridian networking before connecting it to other networks.
6. Review the Azure calculator for App Service B1, Cosmos DB serverless, Blob storage, two private endpoints, private DNS, Key Vault and backups. B1 is a validation starting point, not a tested sizing commitment for 1,000 users. Set a subscription/resource-group budget with alerts and assign a cost owner. Costs depend on ingestion volume and retention; no subscription-specific price has been verified here.
7. Run a no-change infrastructure review:

```powershell
.\scripts\deploy.ps1 -SubscriptionId YOUR_SUBSCRIPTION_ID -ResourceGroup rg-meridian-nexus-azure -EntraClientId YOUR_APP_CLIENT_ID -SecretsOfficerObjectId YOUR_ENTRA_USER_OBJECT_ID
```

8. Once names, ownership, costs and the what-if output are approved, rerun the same command with `-Apply`. Record the deployment outputs. This creates hosting, a managed identity, Cosmos DB, private Blob storage, backups, Key Vault, a VNet/private DNS, and scoped data permissions. It does NOT create an Entra app registration, migrate users or transfer data. API and schedule permissions are not granted to arbitrary Microsoft accounts.
9. Add a Web redirect URI to the Entra app: `https://OUTPUT_APP_NAME.azurewebsites.net/.auth/login/aad/callback`. Create an app secret in Entra and place its VALUE directly in Key Vault as `entra-client-secret`. Place the existing authorised Geo credentials in `geo-api-id` and `geo-api-key`. Use Key Vault's portal and an approved secret expiry policy; do not put values in code, shell history or chat. The template grants only the specified secrets officer write access and the web app read access. Verify all three Key Vault references resolve.
10. Build and deploy only this edition:

```powershell
npm test
npm run package
az webapp deploy --subscription YOUR_SUBSCRIPTION_ID --resource-group rg-meridian-nexus-azure --name OUTPUT_APP_NAME --src-path .\dist\meridian-nexus-azure.zip --type zip
```

11. Verify successful sign-in for an assigned reader/admin and denial for an unassigned account. APIs validate the signed Entra ID token's issuer, audience, expiry, tenant and app roles, not just an untrusted principal header. Then load approved store and hierarchy workbooks using **Data imports**. Import the real schedule report for each retained audience/month and reconcile the exact totals against the original Nexus. Existing passwords are NOT transferred; staff sign in through Entra.
12. In **App Service > Environment variables**, enable `GEO_ORDERS_ENABLED=true` only after a controlled live import has passed. For a historic order month use `GEO_IMPORT_PERIOD=YYYY-MM`, run the WebJob manually, verify results, repeat for required history, then remove this override. The default scheduled order window is the current month; automated rolling historical corrections are a separate follow-up. Check EPOD completeness and classification with Geo before relying on the report for business decisions.
13. Arrange a Meridian-owned cloud report producer to write workbooks to the Blob inbox below. Grant it a separate managed identity with only the required data permissions, and private network connectivity. Do not make Blob public to ease uploads. The current browser automation must remain available until this delivery is confirmed. Set `ATTENDANCE_INBOX_ENABLED=true`, validate a manual WebJob run, then set `WEBJOBS_DISABLE_SCHEDULE=0` to enable the hourly UTC schedule. Verify Always On and successful runs after a restart. If Azure's regional/runtime WebJobs support differs in this subscription, leave scheduling disabled and deploy the same worker through Azure Functions/Container Apps Jobs after testing.
14. Assign alert owners and configure Azure Monitor for HTTP 5xx, failed WebJobs, missing expected reports, Cosmos throttling and budgets. Test a data restore and retain the prior portal as rollback until managers sign off. Point a new hostname to this edition first; do not replace the existing public hostname prematurely.

## Source Contracts

Attendance inbox names contain the **actual export timestamp in SAST**, not the upload timestamp:

```text
sources/inbox/attendance/rep/2026-09/GeoRep-Schedules-20260913083000.xlsx
sources/inbox/attendance/merchandiser/2026-09/GeoRep-Schedules-2026-09-13T083000.xlsx
```

The consumer scans all blobs, selects the newest timestamp per audience/report month, rejects ambiguous newest names, ignores future/temp files, checks ETags, and does not fall back to an older workbook if the latest is invalid. Each file must contain the **whole intended month's schedule snapshot**, not just an incremental day's rows. A report producer must not rename an old report to make it appear newer. The folder month is checked against schedule rows.

Required schedule columns: Schedule Date; Rep Name or User Name; Customer Name or Store Name; Role; Result. Strongly recommended: GeoRep Week, User Code, Store Code, Region, Manager. Excel dates or ISO `YYYY-MM-DD` are accepted; ambiguous dates fail validation. GeoRep Week is used when supplied; otherwise the existing Nexus four-week cycle anchored on 27 April 2026 is retained. Confirm that operational anchor before cutover. Optional strike-rate summaries are retained as comparison data, not substituted for schedule detail. Early and caught-up results count positively against the scheduled day. Leave is excluded; unknown statuses are not counted as missed or attended.

Store master required: Store Code and Store Name; optional Rep, Manager, Region, Banner, Channel and Client. Hierarchy required: Rep/Name and Line Manager/Manager; optional Regional Manager, General Manager, Head, Region and Division. The first matching reference worksheet is imported. Preview its headers and contents before loading; this reader does not reproduce every bespoke formula or multiple-sheet layout from the old application. Reference data is retained in the database and not requested on every report import. Hierarchy changes affect attendance immediately; store enrichment is applied on the next report import.

Imports are capped at 8 MB compressed / 100 MB expanded, 100,000 source rows and 10,000 rows per Excel/CSV export. Unexpected schemas, failed pages/details, empty imports and validation errors keep the previous version. Source archives and old chunks are deliberately retained. Define a business retention policy and add garbage collection with restore testing before historical volumes grow; Cosmos logical partitions and in-memory report aggregation are not an unlimited data lake.

## Security and Cutover Gates

- No secrets, source staff records, original portal, old cloud SDK or synthetic fixtures in the deployment ZIP. Managed identity accesses Cosmos and Blob; shared keys/public Blob access are disabled.
- Cosmos and Blob are private-network-only. Key Vault is initially a public HTTPS endpoint secured by Entra RBAC to let the secrets officer provision values; move it to a private endpoint if corporate policy requires network isolation. This distinction is intentional, not a claim that every service endpoint is private.
- Signed staff app roles protect every API. Public shell assets contain no business data; unauthenticated API requests return 401 instead of redirecting background fetches to an HTML sign-in page. Admin imports additionally require a same-origin request. CSP, HTTPS, no-store API responses, size limits and XLSX expansion checks are enabled. No persistent browser cache stores attendance/order data.
- Do not retire the current portal or remove its directories until live imports, staff access, all dashboard views, source totals, exports, concurrent refreshes, mobile layouts, restore and the scheduled report producer have passed acceptance. Bicep compile and local tests are not proof of a successful Azure deployment.
- Pending external inputs: Meridian subscription/tenant confirmation, regional quota and billing approval, Entra admin assignment, secure Geo credentials, real source/history reconciliation, and attendance cloud delivery. No cloud resources or user accounts have been changed by creating this folder.

## Microsoft References

[Azure hosting portal](https://portal.azure.com), [Power BI gateway URL purpose](https://learn.microsoft.com/en-us/fabric/security/power-bi-allow-list-urls), [Node App Service](https://learn.microsoft.com/en-us/azure/app-service/quickstart-nodejs), [App Service authentication](https://learn.microsoft.com/en-us/azure/app-service/configure-authentication-provider-aad), [injected OAuth tokens](https://learn.microsoft.com/en-us/azure/app-service/configure-authentication-oauth-tokens), [Cosmos managed identity](https://learn.microsoft.com/en-us/azure/cosmos-db/how-to-javascript-get-started), [WebJobs scheduling](https://learn.microsoft.com/en-us/azure/app-service/webjobs-create), [Azure pricing calculator](https://azure.microsoft.com/en-us/pricing/calculator/).
