param([string]$SubscriptionId)
$ErrorActionPreference = 'Stop'
if (-not (Get-Command az -ErrorAction SilentlyContinue)) { throw 'Azure CLI is not installed. Use Azure Cloud Shell or install Microsoft.AzureCLI with winget.' }
# Read-only: never signs in with or prints a password.
if ($SubscriptionId) {
    az account show --subscription $SubscriptionId --query '{name:name,id:id,tenantId:tenantId,state:state}' --output table
} else {
    az account list --query '[].{name:name,id:id,tenantId:tenantId,state:state}' --output table
}
if ($LASTEXITCODE -ne 0) { throw 'Sign in using az login and select the Meridian tenant first.' }
az account list-locations --query "[?name=='southafricanorth'].{name:name,displayName:displayName}" --output table
if ($LASTEXITCODE -ne 0) { throw 'Could not verify South Africa North access.' }
