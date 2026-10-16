# Azure Deployment Status

Verified 15 September 2026. The original Nexus remains unchanged. The temporary Firebase dashboards received a separate Hosting-only navigation update on this date. No Azure hosting, database, storage account, network, vault or resource group has been provisioned for this edition.

A separate **temporary public Azure host** is now deployed in `rg-meridian-field-dashboards`, using the existing public Firebase data service. See [its deployment record](../azure-field-dashboards/DEPLOYMENT_STATUS.md). This does not complete the authenticated Azure-only migration described below, and does not change this edition's Entra roles or deployment gates.

## Portal Navigation

Home, the Meridian logo, Back to portal and the mobile home/back links now navigate in the same tab to `https://meridian-group-za.github.io/Meridian-Nexus/portal.html`. Native browser history is unchanged. The Franchise Orders drilldown return is labelled Previous selection and still restores the previous report selection.

The isolated Azure and temporary Firebase editions passed 58 local navigation checks across 1366, 390 and 320 pixel widths. Each edition also passed its 30-view desktop/mobile dashboard suite. The Azure deployment ZIP was rebuilt and verified: 24 allowlisted files, with all eight original source hashes unchanged. These local checks do not constitute an Azure deployment or live Entra sign-in test.

## Verified Target

| Setting | Verified value |
| --- | --- |
| Directory | Meridian Group (`meridiangroup.co.za`) |
| Tenant ID | `cbe83df2-b350-4dab-8d5f-f78d21fe7d27` |
| Subscription | Azure subscription 1 |
| Subscription ID | `02b268fe-e01a-453e-b287-eec83ccc0676` |
| Subscription status | Enabled; `PayAsYouGo_2014-09-01`; spending limit Off |
| Location | `southafricanorth`, South Africa North, Johannesburg |
| Setup identity | Carin Pillay, `cpillay@meridiangroup.co.za`; directory member |
| Proposed resource group | `rg-meridian-nexus-azure`; does not yet exist |

Meridian Group and SGRP Meridian are different directories. SGRP Meridian (`9a44d8ba-779d-427e-8825-33e62f0fc776`) only exposed a guest identity and no accessible Azure subscription for this account. Do not use it for this deployment. Tenant-specific MFA completed successfully for Meridian Group. Live subscription and effective resource-management permission checks passed; no existing permissions or MFA policies were changed.

## Sign-In Registration

Created and read back in Meridian Group:

| Setting | Verified value |
| --- | --- |
| Name | Meridian Nexus Azure |
| Application/client ID | `748c496f-5033-415d-9d3f-f2bb85de1d71` |
| Application object ID | `40a74fbb-eeb6-4bbd-badd-4676bafecd56` |
| Enterprise application object ID | `63942481-5a74-4ad5-be7e-a61b1ce0ed12` |
| Audience | Single tenant, `AzureADMyOrg` |
| Roles | `Nexus.Reader`, `Nexus.Admin` from `infra/entra-roles.json` |
| Assignment required | Yes |
| Staff/group assignments | `jpinto@meridiangroup.co.za` assigned `Nexus.Admin`; company-wide Reader configuration pending |
| Named application owners | None; awaiting approved technical owners |
| Requested API permissions | None |
| Credentials and redirect URI | Not created/configured; complete during Key Vault and callback setup |

These identifiers are not credentials. Never store client secrets, access tokens, MFA codes or Geo API keys in this document. App roles are not Azure subscription administrator permissions. Confirm named technical ownership rather than assuming all dashboard administrators should control the app registration.

### Verified Admin Assignment

On 15 September 2026, the user explicitly selected `jpinto@meridiangroup.co.za` for Nexus Admin access. Microsoft Graph confirmed Jeorge Pinto is an enabled Member in Meridian Group, with that exact email and sign-in name.

- User object ID: `afca6266-22ec-450a-93ed-604b621b7721`.
- App role: `Nexus.Admin`, ID `4973d086-0a70-4503-87ed-b1df70a92d6c`.
- Assignment ID: `ZmLKr-wiCkWT7WBLYht3IYbH6MoE2TVJrJtQwpMZXOg`, created at approximately 07:37:51 UTC.
- A separate Microsoft Graph read confirmed the exact user, role and enterprise application after creation.
- No Azure subscription role, directory administrator role or app-owner permission was granted. Staff sign-in testing must wait for hosting and callback configuration.

The proposed Reader scope is active `@meridiangroup.co.za` staff accounts managed in Meridian Group, excluding guests and disabled accounts. Company-wide Reader access has not been granted. Check the relevant Entra licenses before configuring automatic group assignment; do not substitute an email-only check for verified tenant identity and app authorization.

## Sequence

1. **Complete:** Azure CLI 2.90.0 installed; Meridian Group MFA and live subscription access verified.
2. **Partial:** app registration, enterprise application and Reader/Admin definitions created; `jpinto@meridiangroup.co.za` has a verified `Nexus.Admin` assignment. Company-wide Reader configuration, named technical owners and access tests remain outstanding.
3. **Pending:** complete the cost estimate; agree a monthly budget, cost owner and alert email; create budget alerts. Alerts are not a spending cap.
4. **Pending:** create the dedicated resource group and run a subscription-backed infrastructure what-if. Local Bicep compilation has passed, but no what-if or infrastructure deployment has run.
5. **Pending:** register the remaining required providers, then deploy approved infrastructure. Microsoft.Web and Microsoft.Storage are registered; Microsoft.DocumentDB, Microsoft.Network and Microsoft.KeyVault were NotRegistered at verification. Region listing is not proof of SKU availability or quota.
6. **Pending:** configure the app callback and place approved secrets directly into Key Vault; verify references and staff authentication.
7. **Pending:** carry forward the verified temporary-dashboard filter fixes into this isolated edition, rerun tests, build the allowlisted ZIP, deploy and test reader/admin/unassigned access.
8. **Pending:** import masters and full attendance schedules; reconcile live Geo order source fields, completeness, totals, filters and exports. The retained EPOD adapter still needs live reconciliation against the intended franchise transaction source.
9. **Pending:** migrate the cloud report producer, verify private inbox delivery and scheduled runs, set monitoring, test restoration and obtain business sign-off before cutover.

## Next Inputs

- Named Meridian technical owners for the app registration and deployment.
- Monthly Azure budget in rand, cost owner and alert email address.

Do not create billable services before the cost review. Do not retire the existing automation or portal while the source-delivery and reconciliation gates remain open.
