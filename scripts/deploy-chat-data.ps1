param([ValidateSet('indexes', 'rules')][string]$Phase, [ValidateSet('staff-defaults', 'chat-tasks')][string]$StageName)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$stage = Join-Path $root '.tmp/chat-release'
if ($StageName) { $stage = Join-Path $stage $StageName }
$gcloud = 'C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1'
$token = (& $gcloud auth print-access-token --project=meridain-nexus --quiet) -join ''
if ($LASTEXITCODE -ne 0 -or !$token) { throw 'Authentication failed.' }
$headers = @{ Authorization = "Bearer $token"; 'x-goog-user-project' = 'meridain-nexus' }
function Api([string]$method, [string]$url, $body = $null) {
  $args = @{ Uri = $url; Method = $method; Headers = $headers; TimeoutSec = 90 }
  if ($null -ne $body) { $args.ContentType = 'application/json'; $args.Body = [Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $body -Depth 100 -Compress)) }
  try { Invoke-RestMethod @args } catch {
    $detail = $_.ErrorDetails.Message
    if (!$detail -and $_.Exception.Response) { $reader = [IO.StreamReader]::new($_.Exception.Response.GetResponseStream()); $detail = $reader.ReadToEnd(); $reader.Dispose() }
    throw "$method $url : $detail"
  }
}
function Save($data, [string]$name) { [IO.File]::WriteAllText((Join-Path $stage $name), (ConvertTo-Json -InputObject $data -Depth 100), [Text.UTF8Encoding]::new($false)) }
if ($Phase -eq 'indexes') {
  $group = if ($StageName -eq 'chat-tasks') { 'meridianChatTasks' } else { 'meridianChatRooms' }
  $url = 'https://firestore.googleapis.com/v1/projects/meridain-nexus/databases/(default)/collectionGroups/' + $group + '/indexes'
  $before = Api GET $url
  Save $before 'chat-indexes.before.json'
  if ($before.nextPageToken) { throw 'Unexpected index pagination.' }
  $definitions = (Get-Content -LiteralPath (Join-Path $root 'firestore.indexes.json') -Raw | ConvertFrom-Json).indexes | Where-Object collectionGroup -eq $group
  $existingChat = @($before.indexes | Where-Object name -match ("/collectionGroups/$group/"))
  if ($existingChat.Count -gt 0) { throw 'Chat indexes already exist; inspect before creating duplicates.' }
  $operations = @()
  foreach ($definition in $definitions) {
    $operation = Api POST $url @{ queryScope = $definition.queryScope; fields = $definition.fields }
    $operations += $operation
    Write-Output ('Created Chat index operation: ' + $operation.name)
  }
  Save $operations 'chat-indexes.operations.json'
  for ($attempt = 0; $attempt -lt 120; $attempt++) {
    $current = Api GET $url
    $chatIndexes = @($current.indexes | Where-Object name -match ("/collectionGroups/$group/"))
    if ($chatIndexes.state -contains 'NEEDS_REPAIR') { throw 'Chat index failed to build.' }
    if (@($chatIndexes | Where-Object state -eq 'READY').Count -eq @($definitions).Count) { Save $current 'chat-indexes.after.json'; Write-Output 'Both Chat indexes are READY. No other indexes changed.'; exit 0 }
    Start-Sleep -Seconds 5
  }
  throw 'Indexes are still building. Check their status before proceeding.'
}
if ($Phase -ne 'rules') { throw 'Specify indexes or rules.' }
$url = 'https://firebaserules.googleapis.com/v1/projects/meridain-nexus/releases/cloud.firestore'
$before = (Get-Content -LiteralPath (Join-Path $stage 'rules-releases.before.json') -Raw | ConvertFrom-Json).releases | Where-Object name -match '/cloud.firestore$'
$current = Api GET $url
if ($current.rulesetName -ne $before.rulesetName) { throw 'Firestore rules changed since the backup. Review instead of overwriting.' }
$source = [IO.File]::ReadAllText((Join-Path $root 'firestore.rules'))
if ($StageName -eq 'chat-tasks') {
  $priorSource = [IO.File]::ReadAllText((Join-Path $stage 'firestore.before.rules')).Replace("`r`n", "`n")
  $withoutTaskRules = [regex]::Replace($source.Replace("`r`n", "`n"), '\n    match /meridianChatTasks/\{taskId\} \{\n[^}]*?\n    \}', '')
  if ($withoutTaskRules -ne $priorSource) { throw 'Rules contain changes outside the reviewed Chat task block.' }
}
$ruleset = Api POST 'https://firebaserules.googleapis.com/v1/projects/meridain-nexus/rulesets' @{ source = @{ files = @(@{ name = 'firestore.rules'; content = $source }) } }
Save $ruleset 'firestore-ruleset.created.json'
$release = Api PATCH $url @{ release = @{ name = $before.name; rulesetName = $ruleset.name }; updateMask = 'rulesetName' }
Save $release 'firestore-release.after.json'
$verified = Api GET $url
if ($verified.rulesetName -ne $ruleset.name) { throw 'Released ruleset mismatch.' }
Write-Output ('Firestore Chat access rules released: ' + $verified.rulesetName + '. Storage rules and file-drop behavior unchanged.')
