$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$token = (& 'C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1' auth print-access-token --project=meridain-nexus --quiet) -join ''
if ($LASTEXITCODE -ne 0 -or !$token) { throw 'Authentication failed.' }
$fields = @('role', 'accountType', 'disabled', 'chatAccess.audience', 'chatAccess.workRole', 'permissions.chatEnabled') | ForEach-Object { @{ fieldPath = $_ } }
$body = @{ structuredQuery = @{ from = @(@{ collectionId = 'adminUsers' }); select = @{ fields = $fields }; limit = 1001 } } | ConvertTo-Json -Depth 15 -Compress
$result = Invoke-RestMethod -Uri 'https://firestore.googleapis.com/v1/projects/meridain-nexus/databases/(default)/documents:runQuery' -Method Post -Headers @{ Authorization = "Bearer $token"; 'x-goog-user-project' = 'meridain-nexus' } -ContentType 'application/json' -Body $body -TimeoutSec 60
$documents = @($result | Where-Object document)
if ($documents.Count -gt 1000) { throw 'More than 1000 profiles; use a paged audit.' }
$counts = [ordered]@{ profiles = $documents.Count; defaultEligibleStaff = 0; clientProfiles = 0; disabledProfiles = 0; optedOutStaff = 0; unclassifiedProfiles = 0 }
$unclassified = @()
foreach ($entry in $documents) {
  $p = $entry.document.fields
  if ($p.accountType.stringValue -eq 'client' -or $p.role.stringValue -eq 'client' -or $p.chatAccess.mapValue.fields.audience.stringValue -eq 'external' -or $p.chatAccess.mapValue.fields.workRole.stringValue -eq 'Client') { $counts.clientProfiles++; continue }
  if ($p.disabled.booleanValue -eq $true) { $counts.disabledProfiles++; continue }
  if ($p.permissions.mapValue.fields.chatEnabled.booleanValue -eq $false) { $counts.optedOutStaff++; continue }
  if ($p.accountType.stringValue -eq 'staff' -or $p.role.stringValue -in @('admin', 'normal')) { $counts.defaultEligibleStaff++ } else { $counts.unclassifiedProfiles++; $unclassified += $entry.document }
}
if ($unclassified.Count) {
  $ids = @($unclassified | ForEach-Object { ($_.name -split '/')[-1] })
  $lookupBody = @{ localId = $ids } | ConvertTo-Json -Compress
  $lookup = Invoke-RestMethod -Uri 'https://identitytoolkit.googleapis.com/v1/projects/meridain-nexus/accounts:lookup' -Method Post -Headers @{ Authorization = "Bearer $token"; 'x-goog-user-project' = 'meridain-nexus' } -ContentType 'application/json' -Body $lookupBody -TimeoutSec 60
  $candidates = @($unclassified | ForEach-Object {
    $document = $_; $id = ($document.name -split '/')[-1]; $account = $lookup.users | Where-Object localId -eq $id
    $claims = if ($account.customAttributes) { $account.customAttributes | ConvertFrom-Json } else { @{} }
    [pscustomobject]@{ name = $document.name; updateTime = $document.updateTime; authExists = [bool]$account; authDisabled = $account.disabled -eq $true; isClient = $claims.chatClient -eq $true -or $claims.nexusRole -eq 'client'; staffClaim = $claims.operator -eq $true -or $claims.nexusRole -eq 'normal' -or ($claims.admin -eq $true -and $account.email -eq 'admin@nexus.co.za'); profileRole = $document.fields.role.stringValue }
  })
  [IO.File]::WriteAllText((Join-Path $root '.tmp/chat-release/staff-defaults/classification-candidates.json'), (ConvertTo-Json -InputObject $candidates -Depth 5), [Text.UTF8Encoding]::new($false))
  $candidates | Select-Object authExists,authDisabled,isClient,staffClaim,profileRole | ConvertTo-Json
}
$json = $counts | ConvertTo-Json
[IO.File]::WriteAllText((Join-Path $root '.tmp/chat-release/staff-defaults/staff-counts.json'), $json, [Text.UTF8Encoding]::new($false))
$json
