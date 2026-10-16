param(
    [Parameter(Mandatory=$true)][string]$SubscriptionId,
    [Parameter(Mandatory=$true)][string]$ResourceGroup,
    [Parameter(Mandatory=$true)][string]$EntraClientId,
    [Parameter(Mandatory=$true)][string]$SecretsOfficerObjectId,
    [string]$Prefix = 'meridian-nexus',
    [switch]$Apply
)
$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
function Invoke-Azure { & az @args; if ($LASTEXITCODE -ne 0) { throw 'Azure command failed; deployment stopped.' } }
if (-not (Get-Command az -ErrorAction SilentlyContinue)) { throw 'Install Azure CLI or run the commands in Azure Cloud Shell.' }
Invoke-Azure account show --subscription $SubscriptionId --query '{subscription:name,id:id,tenantId:tenantId}' --output table
Invoke-Azure bicep build --file (Join-Path $Root 'infra/main.bicep') --stdout > $null
# The resource group must be explicitly created by the operator after verifying ownership.
$common = @('--subscription',$SubscriptionId,'--resource-group',$ResourceGroup,'--template-file',(Join-Path $Root 'infra/main.bicep'),'--parameters',"prefix=$Prefix","entraClientId=$EntraClientId","secretsOfficerObjectId=$SecretsOfficerObjectId")
Invoke-Azure deployment group what-if @common
if (-not $Apply) { Write-Host 'What-if only. No resources changed. Review costs and run with -Apply when approved.'; return }
Invoke-Azure deployment group create @common --name 'nexus-azure' --query properties.outputs --output json
Write-Host 'Infrastructure created. Configure Entra redirect URI, staff assignments and Key Vault secrets before deploying the application ZIP. Background imports remain disabled.'
