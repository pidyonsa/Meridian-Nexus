# Meridian Nexus: Azure Login, Setup and Deployment Walkthrough

Prepared 14 September 2026 against the Azure edition in this workspace and current Microsoft documentation.

This is an operator guide, not a record of a completed cloud deployment. No Azure resources, subscriptions, identities or secrets were changed while preparing it. The existing Firebase portal and Salesforce attendance automation remain running separately.

## 1. What We Are Deploying

Deploy only this folder:

~~~text
C:\Users\PC\MeridianNexus\azure-nexus
~~~

Do not deploy the entire MeridianNexus repository or the broad "MeridianNexus - Azure" copy. That copy still contains unrelated Firebase-era modules. The isolated azure-nexus folder contains the prepared Azure application and an allowlisted packaging script.

Included:

- Syndicated rep attendance and syndicated merchandiser attendance.
- MTD Overview, Daily Visits, rosters, Attendance by Store, filters, drilldowns and exports.
- Franchise Orders and its seven views.
- Administrator-only Data imports for reference and attendance workbooks.

Not included: Salesforce/dedicated attendance, standalone Call Cycle, Insights, Stock Fix, ETLs, chat, tasks, AI, support or the full original administration system. Deploying this edition will not move Jennifer's Salesforce bot.

### Service Layout

| Requirement | Prepared Azure service | Purpose |
|---|---|---|
| Staff login | Microsoft Entra ID | Meridian staff accounts and explicit app roles |
| Website and backend | Linux Azure App Service, Node 24 | Serves the dashboards and protected APIs |
| Application database | Azure Cosmos DB for NoSQL, serverless | Versioned attendance, order and reference datasets |
| Files | Azure Blob Storage | Attendance inbox, published JSON archives and retained versions |
| Credentials | Azure Key Vault | Entra application secret and authorised Geo credentials |
| Service access | Managed identity | Lets the application access Azure data without database passwords |
| Data networking | VNet, private endpoints and private DNS | Keeps Cosmos and Blob off public networks |
| Background imports | App Service WebJob | Reads Geo orders and the attendance inbox |

The template places regional resources in South Africa North, which Microsoft identifies as Johannesburg. Directory services and public DNS are not regional databases; this is not a claim that every Microsoft or Geo service operates exclusively in Johannesburg. [Microsoft region list](https://learn.microsoft.com/en-us/azure/reliability/regions-list).

Cosmos DB is the database implemented by this edition. Creating Azure SQL or PostgreSQL instead will not make the existing adapter work without changes.

## 2. Sign In to the Correct Portal

1. Open [Azure Portal](https://portal.azure.com).
2. Sign in with your own Meridian work account.
3. Complete Microsoft's MFA prompt yourself.
4. Check the directory shown under your account. If necessary, use the directory switcher to select Meridian's directory.
5. Search for **Subscriptions** using the portal's top search bar.
6. Open the subscription that Meridian will own and pay for. Confirm its status is Enabled and that Finance recognises its billing arrangement.

The first checkpoint is: **I can see an enabled Meridian subscription in the intended Meridian directory.**

If no subscription is visible, check the directory and subscription filters first. Ask the existing Azure/billing administrator to grant access or arrange an approved company subscription. A Microsoft 365 login alone does not establish Azure spending authority. Do not open a personal billing account to work around missing company access.

The previously mentioned gatewayadminportal.azure.com relates to Power BI gateway management. It is not the hosting deployment portal for this app. No on-premises gateway is needed for the current cloud API/Blob architecture. [Microsoft Power BI URL purposes](https://learn.microsoft.com/en-us/fabric/security/power-bi-allow-list-urls).

Never send passwords, MFA/device codes, recovery codes, access tokens or secret values in chat, email or screenshots. Subscription, tenant and application IDs are identifiers, not passwords, but still share them only with the deployment team.

## 3. Confirm Permissions and Ownership

In **Subscriptions > the Meridian subscription > Access control (IAM) > View my access**, check what you can manage.

The deployment needs permission to create the resources and their role assignments. An administrator can create the new resource group, then grant you Contributor plus scoped role-assignment authority for that group. Owner is sufficient but broader than necessary; prefer scoped and time-limited access. Contributor alone cannot create Azure RBAC assignments. Entra app registration, user assignment and consent are separate directory permissions. [Azure role definitions](https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles/privileged).

Ask IT to help if you cannot create an app registration, assign staff or approve sign-in. Do not request permanent Global Administrator simply to deploy a web app.

Record these non-secret values:

| Value | Where to find it |
|---|---|
| Tenant ID | Microsoft Entra ID > Overview |
| Subscription ID | Subscriptions > selected subscription > Overview |
| Your user Object ID | Microsoft Entra ID > Users > your account > Overview |
| Application Client ID | Created in step 6 |
| Resource group | New group created in step 8 |

The user Object ID is not the app's Object ID or Application Client ID. The template uses it to give the designated secrets officer permission to provision Key Vault secrets.

Name two Meridian custodians for the application registration, Azure environment and source repository. The company must retain billing, recovery and deployment access if one person is absent.

## 4. Install the Local Command-Line Tool

These instructions use **Windows PowerShell on this PC**, where the application files already exist. Do not paste Windows paths into browser Cloud Shell; that is a separate machine.

Azure CLI was not available on PATH during this check. Node is already installed, and all 19 Azure-edition unit/integration tests passed locally on 14 September.

In PowerShell:

~~~powershell
winget install --exact --id Microsoft.AzureCLI
~~~

Complete any approved installer prompts. Close and reopen PowerShell afterwards, then run:

~~~powershell
az version
node --version
npm.cmd --version
~~~

Node should be version 24.x for this edition. Use npm.cmd in PowerShell to avoid npm.ps1 execution-policy issues. If WinGet is unavailable, use Microsoft's official Azure CLI installer or ask IT; do not disable corporate security policy. [Azure CLI installation](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli-windows).

## 5. Log In Through the CLI

Use the same Meridian directory and subscription as in the portal. Replace the placeholder strings with the recorded IDs:

~~~powershell
$TenantId = 'REPLACE-WITH-MERIDIAN-TENANT-ID'
$SubscriptionId = 'REPLACE-WITH-MERIDIAN-SUBSCRIPTION-ID'
$ResourceGroup = 'rg-meridian-nexus-azure'
$Prefix = 'meridian-nexus'

az login --tenant $TenantId
~~~

Complete the Microsoft sign-in window yourself. If the normal interactive window fails, the documented alternative is:

~~~powershell
az login --tenant $TenantId --use-device-code
~~~

Use that alternative only if Meridian's sign-in policy permits it. Enter the device code only into the Microsoft sign-in flow you initiated; do not send it here. Do not bypass Conditional Access. [Interactive CLI authentication](https://learn.microsoft.com/en-us/cli/azure/authenticate-azure-cli-interactively).

Select and verify the subscription:

~~~powershell
az account list --query '[].{Name:name,Id:id,Tenant:tenantId,State:state}' --output table
az account set --subscription $SubscriptionId
az account show --query '{Name:name,Id:id,Tenant:tenantId,State:state}' --output table
az ad signed-in-user show --query '{Name:displayName,ObjectId:id}' --output table
~~~

Check every value. If the directory or subscription is wrong, stop here.

Set your user Object ID and move into the isolated application:

~~~powershell
$SecretsOfficerObjectId = 'REPLACE-WITH-YOUR-MERIDIAN-USER-OBJECT-ID'
Set-Location -LiteralPath 'C:\Users\PC\MeridianNexus\azure-nexus'
.\scripts\azure-preflight.ps1 -SubscriptionId $SubscriptionId
az webapp list-runtimes --os linux --output table
~~~

Confirm the runtime list includes Node 24 LTS. The Bicep template specifies NODE|24-lts. A listed region/runtime does not guarantee subscription quota or regional capacity. Deployment validation must still pass. [App Service Node configuration](https://learn.microsoft.com/en-us/azure/app-service/configure-language-nodejs).

These checks do not deploy the application. If PowerShell refuses a reviewed local script, use IT's approved script-execution process; do not disable execution policy machine-wide.

## 6. Create the Staff Sign-In Application

In the Azure portal:

1. Search **Microsoft Entra ID**.
2. Open **App registrations > New registration**.
3. Name it **Meridian Nexus Azure**.
4. Select **Accounts in this organizational directory only**.
5. Leave Redirect URI blank for now; the infrastructure will generate the exact hostname.
6. Select **Register**.
7. Record **Application (client) ID** and verify the Directory (tenant) ID matches Meridian.
8. Add the approved Meridian custodians under **Owners**.

Set the ID in your PowerShell session:

~~~powershell
$EntraClientId = 'REPLACE-WITH-APPLICATION-CLIENT-ID'
~~~

### Create the Two Application Roles

Under the new app registration, open **App roles > Create app role** twice. The values below are the exact values expected by the local backend:

| Field | Reader role | Administrator role |
|---|---|---|
| Display name | Nexus Reader | Nexus Administrator |
| Allowed member types | Users/Groups | Users/Groups |
| Value | Nexus.Reader | Nexus.Admin |
| Description | View syndicated attendance and Franchise Orders | View dashboards and import approved source workbooks |
| Enabled | Yes | Yes |

The reference definitions are in azure-nexus/infra/entra-roles.json. Creating the roles through the portal may generate different role GUIDs; the backend authorises by the Value strings above. Do not alter an unrelated app's roles. [Microsoft app roles](https://learn.microsoft.com/en-us/entra/identity-platform/howto-add-app-roles-in-apps).

### Restrict Who Can Sign In

1. Open **Microsoft Entra ID > Enterprise applications** and find this application by its Client ID.
2. Under **Properties**, set **Assignment required? = Yes** and save.
3. Under **Users and groups > Add user/group**, assign yourself and a second approved staff administrator to **Nexus Administrator**.
4. Assign one ordinary staff test account to **Nexus Reader**.
5. Leave a separate staff test account unassigned so we can test denial.
6. Do not assign guests, clients or uncontrolled groups. Where group assignment is unavailable under the tenant's licensing, assign named users instead.

Assignment and app-role validation are both required. Do not turn Assignment required off to resolve a login error. [Microsoft application access management](https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/what-is-access-management).

Ask IT to apply the approved MFA/Conditional Access policy to the application and handle any consent request after reviewing permissions. The current app does not need blanket access to Microsoft mail, files or all users.

**Access boundary:** this edition's Reader role can view the retained datasets, not just a selected region/client. There is no per-client or per-territory authorisation layer in this port. Do not onboard external clients or staff who require restricted rows until that scope is implemented and tested. Nexus.Admin is an application import role, not an Azure infrastructure administrator role.

## 7. Review Costs Before Creating the Services

Use the [Azure Pricing Calculator](https://azure.microsoft.com/en-us/pricing/calculator/) and the actual subscription agreement. Select South Africa North for regional services and the relevant billing currency.

Price the current template, not an unrelated generic website:

- Linux App Service B1 with Always On, initially one instance.
- Cosmos DB for NoSQL serverless: expected request units, stored data and the chosen backup policy.
- Blob Storage Standard LRS: inbox files, JSON archives, retained versions, transactions and recovery retention.
- Two private endpoints, private DNS and network traffic.
- Key Vault operations.
- Monitoring, log ingestion/retention and any added alerts or availability tests.
- Any additional Entra licences, fixed outbound IP/NAT, private Key Vault endpoint or production scaling required by Meridian policy.

B1 is a pilot starting point, not a proven sizing decision for 1,000 users. Do not assume that serverless means the whole environment is free when idle: App Service and private networking have standing costs.

There is no verified Azure monthly price for this project yet. Do not reuse the previous Google Cloud allowance as an Azure quotation. Finance should approve a budget before step 10.

Under **Cost Management + Billing > the selected subscription > Budgets**, create the approved monthly budget with alerts, for example at 50%, 80% and 100%. Send alerts to the named technical and Finance owners. Budget alerts do not automatically cap spending or stop the application. [Microsoft budget guidance](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/tutorial-acm-create-budgets).

## 8. Create a New Resource Group

This step changes the selected Azure subscription. Have the subscription owner create the group if you do not have permission.

~~~powershell
az group exists --subscription $SubscriptionId --name $ResourceGroup
~~~

If it returns true, inspect that group before proceeding. Use a different new group name if it contains unrelated workloads. For a confirmed new name:

~~~powershell
az group create --subscription $SubscriptionId --name $ResourceGroup --location southafricanorth --tags Application=MeridianNexus Edition=Azure Environment=Pilot --output table
~~~

Ask the subscription administrator to check/register the providers required by the template if they are not already registered:

~~~powershell
az provider show --namespace Microsoft.Web --query registrationState --output tsv
az provider show --namespace Microsoft.DocumentDB --query registrationState --output tsv
az provider show --namespace Microsoft.Storage --query registrationState --output tsv
az provider show --namespace Microsoft.Network --query registrationState --output tsv
az provider show --namespace Microsoft.KeyVault --query registrationState --output tsv
~~~

An authorised administrator can register only a missing provider, for example:

~~~powershell
az provider register --namespace Microsoft.Web --wait
~~~

Also have IT check that the template's 10.42.0.0/16 VNet range does not conflict with planned company networking. Do not connect or peer networks without that review.

## 9. Preview the Infrastructure Changes

Create the deployment parameter set. It contains identifiers, not secrets:

~~~powershell
$Deploy = @{
    SubscriptionId = $SubscriptionId
    ResourceGroup = $ResourceGroup
    EntraClientId = $EntraClientId
    SecretsOfficerObjectId = $SecretsOfficerObjectId
    Prefix = $Prefix
}

.\scripts\deploy.ps1 @Deploy
~~~

Without -Apply, the script compiles the template and runs Azure what-if. It does not create the application/data resources. The resource group and budget from earlier steps are separate changes.

Review these expected creations:

- App Service plan and Linux web app with a managed identity.
- Cosmos account, nexus database and snapshots container.
- Storage account and private sources container.
- Key Vault and scoped secrets access.
- VNet, two private endpoints and private DNS links.
- Application-to-data role assignments and App Service authentication settings.

Stop if the output targets the wrong subscription/group, changes unrelated resources, proposes unexpected deletes, reports forbidden locations or exceeds the approved design. A successful what-if is not a guarantee that every capacity or policy check will pass during creation.

## 10. Create the Infrastructure

**This is the billable deployment step. Run only after the design, scope and cost review.**

~~~powershell
.\scripts\deploy.ps1 @Deploy -Apply
~~~

Wait for completion and inspect **Resource group > Deployments > nexus-azure**. A failed deployment may leave some billable resources behind; inspect the specific error before retrying. Do not delete the whole group as a troubleshooting shortcut.

Read the outputs:

~~~powershell
az deployment group show --subscription $SubscriptionId --resource-group $ResourceGroup --name nexus-azure --query properties.outputs --output json
~~~

Record webAppName, url, vaultName, storageAccount, cosmosAccount and managedIdentityObjectId. Set these from the actual output, not from an invented hostname:

~~~powershell
$AppName = 'REPLACE-WITH-webAppName'
$AppUrl = 'REPLACE-WITH-url'
$VaultName = 'REPLACE-WITH-vaultName'
~~~

At this point, hosting exists but sign-in and data loading are not complete. Geo orders, the attendance inbox and automatic scheduling are intentionally disabled.

## 11. Finish Login and Provision Secrets

### Entra Redirect URI

Open the new **App registration > Authentication > Add a platform > Web**. Enter this exact URI using the deployed hostname:

~~~text
https://ACTUAL-APP-NAME.azurewebsites.net/.auth/login/aad/callback
~~~

Under the Web authentication settings, enable **ID tokens** for the App Service sign-in flow if not already enabled. Save. Use the same single-tenant registration already supplied to the deployment. Do not create a second registration from the App Service Authentication wizard. [Microsoft App Service authentication](https://learn.microsoft.com/en-us/azure/app-service/configure-authentication-provider-aad).

### Entra Application Secret

1. Open **App registration > Certificates & secrets > Client secrets > New client secret**.
2. Give it an identifiable description and an expiry allowed by Meridian policy.
3. Copy the newly displayed **Value**, not the Secret ID, directly into Key Vault in the next step.
4. Record the owner and expiry reminder in Meridian's approved secret-management process. Do not record the value in the deployment guide, code or chat.

### Three Key Vault Secrets

Open the deployed **Key Vault > Objects > Secrets > Generate/Import**. Create:

| Exact secret name | Value supplied securely |
|---|---|
| entra-client-secret | Value of the new Entra application secret |
| geo-api-id | Meridian's authorised Geo Open API client ID |
| geo-api-key | Meridian's authorised Geo Open API key |

Use the designated secrets-officer account. RBAC propagation may take time. An Azure resource-management role does not automatically grant permission to read secret values.

The template already sets App Service references to those secret names and grants the web app's managed identity read access. Check their reference status under **App Service > Environment variables/Configuration > App settings**. Do not reveal their resolved values. [Key Vault references](https://learn.microsoft.com/en-us/azure/app-service/app-service-key-vault-references).

If Geo credentials are not yet approved, complete staff login but keep the Geo import disabled. Do not substitute Salesforce credentials, another company's key or a developer's personal account.

### Verify the Security Settings

Check the deployed resources against the template:

- App Service: HTTPS Only, Always On, Node 24 LTS and system-assigned identity enabled.
- Authentication: Microsoft provider uses the correct tenant/client ID; token store enabled; unauthenticated APIs return 401.
- Cosmos and Blob: public network access disabled; private endpoints approved and DNS linked to the app's VNet.
- Blob anonymous access and shared-key access disabled.
- Key Vault: Entra RBAC and purge protection enabled. Its endpoint is initially public HTTPS with authenticated RBAC, not a private endpoint.
- FTP and SCM basic publishing credentials disabled.
- NEXUS_PREVIEW must not be present; NODE_ENV must be production.

The website itself is internet-reachable but its data APIs require staff authentication. It is not a VPN-only website. If Meridian requires private web ingress or a private Key Vault, pause for that additional networking design and cost review.

Do not enable public database/storage access to fix connectivity. App Service VNet integration is the intended data path. [Microsoft VNet integration](https://learn.microsoft.com/en-us/azure/app-service/overview-vnet-integration).

## 12. Build and Deploy Only This Edition

In PowerShell, from the isolated application directory, run each command separately. Stop if any fails:

~~~powershell
Set-Location -LiteralPath 'C:\Users\PC\MeridianNexus\azure-nexus'
npm.cmd ci
npm.cmd test
npm.cmd run package
node scripts/verify-package.cjs
Get-FileHash -LiteralPath '.\dist\meridian-nexus-azure.zip' -Algorithm SHA256
~~~

The packaging script includes runtime code, the two dashboard modules, assets and the WebJob. It excludes preview fixtures, local workbooks, credentials and the old portal. Retain the ZIP and its checksum as release evidence.

Deploy that ZIP to the new App Service:

~~~powershell
az webapp deploy --subscription $SubscriptionId --resource-group $ResourceGroup --name $AppName --src-path '.\dist\meridian-nexus-azure.zip' --type zip
~~~

The template enables server-side dependency building and starts the app with npm start. Check deployment logs if installation/build fails. [Microsoft ZIP deployment](https://learn.microsoft.com/en-us/azure/app-service/deploy-zip).

Use an up-to-date Azure CLI with Entra-based deployment support. Keep basic publishing authentication disabled; do not enable it merely to make an old CLI work. [Deployment with basic authentication disabled](https://learn.microsoft.com/en-us/azure/app-service/configure-basic-auth-disable).

Do not run firebase deploy, deploy the repository root, upload a whole folder of reports, or create a publish-profile password for this procedure.

## 13. Test the Live Site Before Importing Business Data

Open the output AppUrl in a browser. Check the unauthenticated health endpoint:

~~~powershell
Invoke-RestMethod -Uri "$AppUrl/healthz"
~~~

Expected result: status = ok. This only proves the web process is serving requests, not that authentication or databases work.

Complete these tests:

| Test | Expected result |
|---|---|
| Visit /api/session in a signed-out private window | Denied, normally HTTP 401 |
| Sign in as assigned Nexus Administrator | Session succeeds; Data imports is visible |
| Sign in as assigned Nexus Reader | Dashboards available; no import permission |
| Sign in as an unassigned ordinary staff account | Denied |
| Sign in from another tenant or with a guest/client account not assigned | Denied |
| Open a dashboard before loading data | A genuine empty/not-loaded result, never synthetic business totals |

Use **Sign in with Microsoft** or the app's /.auth/login/aad route. Existing Firebase passwords and permission records are not copied. Staff sign in using their assigned Meridian Microsoft accounts.

If a role changes, sign out and sign back in to obtain a fresh session. Do not weaken backend role checks to make an old session work.

## 14. Import References and Attendance

The current manual import route is inside the new app, not Azure's Cosmos Data Explorer.

1. Sign in as a Nexus Administrator.
2. Click **Data imports** near the bottom of the Nexus sidebar.
3. Choose **Store master**, select the approved XLSX and click **Validate and import**.
4. Choose **Reporting hierarchy** and import the approved hierarchy workbook.
5. Choose **Syndicated rep schedules**, select the report month and import its complete detailed Geo schedule workbook.
6. Repeat for **Syndicated merchandiser schedules** with the matching audience/report.
7. Review the imported row counts and open both attendance audiences.

The source status table displays the latest stored month for each dataset, not all history. The import result reports the number of rows accepted. Do not treat successful upload alone as business reconciliation.

### Accepted Source Shape

| Source | Required columns | Important optional columns |
|---|---|---|
| Store master | Store Code; Store Name | Rep, Manager, Region, Banner, Channel, Client |
| Hierarchy | Rep/Name; Line Manager/Manager | Regional Manager, General Manager, Head, Region, Division |
| Detailed schedules | Schedule Date; Rep Name/User Name; Customer Name/Store Name; Role; Result | GeoRep Week, User Code, Store Code, Region, Manager |

Only the first matching reference worksheet is imported. Confirm that the chosen workbook's structure is supported; do not assume every bespoke formula or sheet is interpreted. Load the store master before report imports. If it changes, reimport the affected reports to apply enrichment again. Hierarchy changes are applied when attendance is read.

Current limits: 8 MB compressed XLSX, 100 MB expanded content, 100,000 source rows, and 10,000 rows per export. Larger volumes need a deliberate implementation change, not repeated uploads that accidentally replace a month's snapshot.

Each attendance workbook must represent the complete intended month snapshot. A single-day incremental file is not a substitute. Early visits and caught-up visits count positively against their scheduled day, following the agreed business rule. Leave is excluded; unknown statuses are not invented as attended or missed.

Compare targets, actuals, distinct missed stores, Central/Inland/Coastal totals, manager filters and exported lines with the existing portal using the same source, date range and filters. Keep evidence of the source filename, period and business sign-off.

The manual route archives normalised JSON through the data store; it does not retain the uploaded original XLSX as a separate raw-file archive. Retain original source workbooks through Meridian's approved records process. The automated inbox retains the original blobs.

## 15. Connect and Test Geo Franchise Orders

This edition reads Geo's EPOD headers and details. Credentials alone do not prove that the returned records represent franchise orders correctly. Before acceptance, confirm endpoint access, date semantics, store mapping, cancellations, line quantities, values/currency and the required franchise classification with Geo and the business owner.

The server-side connector uses Meridian's existing Geo API routes. It does not send API credentials to the browser. Do not test private endpoints with keys in a URL or chat message.

For a controlled first import, keep scheduling disabled and enable only orders:

~~~powershell
az webapp config appsettings set --subscription $SubscriptionId --resource-group $ResourceGroup --name $AppName --settings GEO_ORDERS_ENABLED=true ATTENDANCE_INBOX_ENABLED=false WEBJOBS_DISABLE_SCHEDULE=1 GEO_IMPORT_PERIOD=2026-09 --output none
~~~

Replace 2026-09 with the agreed month. Settings changes can restart the app, so do this before opening the pilot to ordinary staff.

Open **App Service > WebJobs**, find **nexus-sync**, select **Run**, and inspect its logs. The command-line equivalent is:

~~~powershell
az webapp webjob triggered run --subscription $SubscriptionId --resource-group $ResourceGroup --name $AppName --webjob-name nexus-sync
~~~

Starting the job is not proof of completion. Wait for the run to finish, inspect sync-completed and the order result, and verify the imported month under Data imports. A no-data result retains the previous dataset; it does not prove that a requested historical month was loaded. [Microsoft WebJob run command](https://learn.microsoft.com/en-us/cli/azure/webapp/webjob/triggered).

If the WebJob command is rejected by deployment authentication, use the authenticated Azure portal and verify runtime support. Do not turn on basic publishing credentials as a shortcut.

Check every Franchise Orders view, totals, graph drilldowns and Excel exports against the Geo source. Do not substitute EPOD delivery dates for order dates without agreement. Unknown amounts/currencies must remain identifiable rather than fabricated.

For backfill, change GEO_IMPORT_PERIOD to each required month, run once, wait for completion and reconcile before proceeding. Once backfill is complete, remove the override:

~~~powershell
az webapp config appsettings delete --subscription $SubscriptionId --resource-group $ResourceGroup --name $AppName --setting-names GEO_IMPORT_PERIOD --output none
~~~

Without that override the scheduled importer refreshes the current month. Rolling corrections to prior months are not automatically implemented. Agree a controlled correction/backfill process before relying on historical completeness.

The current template does not reserve a fixed outbound public IP. If Geo requires an IP allowlist, agree stable egress and its cost with IT before the live connection; do not assume the private data endpoints also solve outbound API addressing.

## 16. Connect Automatic Attendance Delivery

**This is the main unfinished integration, not something solved by clicking Deploy.** The Azure consumer exists, but the process that obtains the detailed Geo Schedules export and delivers it to Azure has not been migrated or verified.

We need either an authorised schedule API supplying equivalent full detail, or a Meridian-owned cloud report producer delivering the existing export. Check-ins alone cannot establish planned visits, missed stores or targets. The Salesforce source workflow is unrelated and must not be redirected here.

The destination is the private Blob container named **sources**. Blob names inside that container must look like:

~~~text
inbox/attendance/rep/2026-09/GeoRep-Schedules-20260914083000.xlsx
inbox/attendance/merchandiser/2026-09/GeoRep-Schedules-2026-09-14T083000.xlsx
~~~

Do not add an extra sources/ prefix inside the container. The filename timestamp is the real export time in SAST. Do not rename an old workbook to make it appear fresh. The consumer selects the latest export per audience/month, handles many older files, rejects ambiguous latest timestamps and does not silently revert to an older file if the newest fails validation.

The external producer needs a separate approved identity and private network connectivity. Scope its write access to the intended inbox, using an appropriate storage role/condition or a separately designed upload service. Do not give it the web application's identity or broad archive/database access. This producer permission and networking are not created by the current template.

A normal laptop or default Cloud Shell session will not necessarily reach this private container. Manual pilot uploads should use the authenticated Nexus Data imports route. For the automated path, arrange approved VNet connectivity rather than temporarily making Blob public.

After the producer has delivered a real test workbook, enable the inbox while keeping the timer disabled:

~~~powershell
az webapp config appsettings set --subscription $SubscriptionId --resource-group $ResourceGroup --name $AppName --settings ATTENDANCE_INBOX_ENABLED=true WEBJOBS_DISABLE_SCHEDULE=1 --output none
az webapp webjob triggered run --subscription $SubscriptionId --resource-group $ResourceGroup --name $AppName --webjob-name nexus-sync
~~~

This run also imports orders if GEO_ORDERS_ENABLED remains true. Avoid overlapping manual imports of the same dataset/month during validation. Confirm success for each enabled source, not just a job-start notification.

Keep the old attendance producer available until Azure source delivery and reconciliation have passed. A manually uploaded pilot is not yet fully automatic.

## 17. Enable the Hourly Schedule

Proceed only after both enabled import paths pass manual runs and have named owners:

~~~powershell
az webapp config appsettings set --subscription $SubscriptionId --resource-group $ResourceGroup --name $AppName --settings WEBJOBS_DISABLE_SCHEDULE=0 --output none
~~~

The current settings.job expression is **0 0 * * * ***: hourly at minute zero using the default UTC schedule. SAST is UTC+2. Always On must remain enabled. Linux code WebJobs are supported in Microsoft's current guidance, but we still need to verify the actual Node runtime/job behaviour in this subscription. [WebJobs overview](https://learn.microsoft.com/en-us/azure/app-service/overview-webjobs), [WebJob setup](https://learn.microsoft.com/en-us/azure/app-service/webjobs-create).

Verify a run after app restart and at least two subsequent scheduled refreshes. Inspect new report timestamps, row counts and errors. If this deployment's runtime or authentication does not support the intended job operation, leave the schedule disabled and implement/test a separate supported worker. Do not claim the automation is live because the site loads.

## 18. Monitoring, Recovery and Cutover

The current Bicep template does not create a complete monitoring/alerting solution, CI/CD pipeline, custom hostname or tested disaster-recovery procedure. These are explicit launch tasks.

### Operational Checks

Set up Azure Monitor alert delivery to a named IT owner and backup. Include app availability/HTTP 5xx, failed imports, missing expected report arrivals, Cosmos throttling, storage errors and unusual costs. Missing-report alerts require an explicit freshness check; generic website uptime will not detect stale attendance.

Keep logs useful without recording credentials or complete staff/source rows. Configure retention and budget the monitoring costs. Review CPU/memory, refresh duration and concurrent dashboard use before scaling beyond the pilot.

### Recovery Checks

The template requests seven-day continuous Cosmos backup and 30-day Blob deletion protection/versioning. Verify those settings were accepted by Azure. Published JSON archives and dataset chunks are retained by the application, but there is no end-user restore button or automatic archive cleanup yet.

Test restoration into an isolated recovery environment before cutover. A database restore may require reconnecting an account, its permissions and private endpoint; it is not just a UI refresh. Assign an engineer to document and rehearse the actual recovery commands. Do not experiment by restoring over the pilot or deleting production records.

This template is single-region and uses LRS Blob storage. It does not provide recovery from an entire Johannesburg-region outage. Approve regional-disaster recovery separately if required.

### Release and Rollback

Keep a last-known-good Azure ZIP, checksum, configuration record and source/reconciliation evidence. During an issue, disable the timer first to prevent further scheduled publications:

~~~powershell
az webapp config appsettings set --subscription $SubscriptionId --resource-group $ResourceGroup --name $AppName --settings WEBJOBS_DISABLE_SCHEDULE=1 --output none
~~~

This prevents future timed starts; it does not necessarily cancel an already-running job. Inspect that run before modifying datasets or taking further action.

An application rollback redeploys a reviewed prior ZIP; it does not undo database writes. Data recovery is a separate controlled procedure. Keep the existing Firebase URL available until business owners approve the Azure edition. Do not delete the original repository, cloud resources, source files or temporary archive as part of deployment.

### Custom Domain and Future Releases

Use the generated azurewebsites.net URL for the pilot. Later, IT can configure a new Meridian-owned hostname through **App Service > Custom domains**, validate DNS and bind HTTPS. Add the exact custom-domain callback in Entra and update PUBLIC_ORIGIN to the chosen canonical origin. This value protects imports, so an uncoordinated hostname change can break legitimate uploads. Maintain a single canonical origin and test redirects and sign-in.

For ongoing releases, put the isolated edition in a Meridian-controlled repository, retain its lockfile and deployment manifest, and configure reviewed deployment automation using workload identity federation rather than a shared password. This pipeline is not already installed by the current deploy script.

### Launch Acceptance

- Meridian tenant, subscription, billing and two named custodians confirmed.
- Assigned reader/admin access and unassigned-user denial tested live.
- Cosmos and Blob remain private; identity permissions and secret references verified.
- Real rep and merchandiser reports reconcile, including positive early/caught-up visits and manager exports.
- All seven order views reconcile with authorised Geo records and agreed franchise classification.
- Required historical months imported and verified.
- Attendance cloud producer connected and tested without reliance on an employee laptop.
- Scheduled imports survive restart and subsequent runs; freshness/error alerts reach an owner.
- Load/mobile checks, backups, restore rehearsal and rollback evidence accepted.
- Business owners approve the pilot before the existing reporting process is retired.

## 19. Common Problems

| Symptom | Check first | Do not do |
|---|---|---|
| No subscriptions visible | Correct directory, subscription filters and Azure access from IT | Open a personal account as a workaround |
| az is not recognised | Reopen PowerShell after installing the official CLI | Download an unknown CLI package |
| Role-assignment deployment fails | Scoped RBAC assignment permissions and tenant IDs | Grant the whole company Owner |
| Region, SKU or quota error | South Africa North capacity, subscription quotas and policy | Silently deploy the data elsewhere |
| Login redirect mismatch | Exact deployed HTTPS callback in the correct registration | Use wildcard callbacks |
| Consent or assignment error | IT approval and Nexus.Reader/Nexus.Admin assignment | Disable assignment or MFA |
| Signed-in account still denied | Correct app role, tenant and a newly signed-in session | Trust a browser-supplied admin flag |
| Key Vault reference unresolved | Secret name, secret Value, managed identity role and expiry | Paste secrets into frontend code |
| Cosmos/Blob timeout or 403 | Private DNS, VNet integration, endpoint approval and data role | Enable public storage/database access |
| Deployment fails with basic auth off | Current CLI and authenticated deployment logs | Enable publishing passwords by default |
| App runs but reports are empty | Correct dataset/month imported, source role and job outcome | Fill missing figures with preview data |
| Attendance workbook rejected | Required columns, whole-month scope, actual export timestamp and size | Rename old data or suppress validation |
| Orders stop on a failed page/detail | Geo contract, pagination, rate limits and entitlement | Publish partial results as complete |
| Timer never runs | WebJob present, Always On, enable flags, runtime and logs | Assume a successful web deployment means scheduled jobs work |
| Uploads fail after changing hostname | Entra callback and matching PUBLIC_ORIGIN | Remove the same-origin validation |

## First Interactive Checkpoint

Start with steps 2 and 3. Tell the deployment team whether you can see an enabled Meridian subscription and what access role you have. A screenshot of the subscription overview or the CLI's limited account summary is sufficient after hiding billing/contact details. Do not share a password, MFA code, secret, token or full authentication log.

The remaining commands can then be followed against the confirmed account rather than guessed identifiers. No production cutover should be represented as complete until the live acceptance checklist passes.
