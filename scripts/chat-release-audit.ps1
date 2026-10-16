param([ValidateSet('staff-defaults', 'chat-tasks')][string]$StageName)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$stage = Join-Path $root '.tmp/chat-release'
if ($StageName) { $stage = Join-Path $stage $StageName }
if (Test-Path -LiteralPath (Join-Path $stage 'hosting.before.json')) { throw 'Release backup already exists; use it rather than overwriting the baseline.' }
New-Item -ItemType Directory -Path $stage -Force | Out-Null
$gcloud = 'C:/Users/PC/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.ps1'
$token = (& $gcloud auth print-access-token --project=meridain-nexus --quiet) -join ''
if ($LASTEXITCODE -ne 0 -or !$token) { throw 'Unable to authenticate the release audit.' }
$headers = @{ Authorization = "Bearer $token"; 'x-goog-user-project' = 'meridain-nexus' }
function Get-Api([string]$url) {
  try { Invoke-RestMethod -Uri $url -Headers $headers -Method Get -TimeoutSec 60 }
  catch {
    $detail = $_.ErrorDetails.Message
    if (!$detail -and $_.Exception.Response) { $reader = [IO.StreamReader]::new($_.Exception.Response.GetResponseStream()); $detail = $reader.ReadToEnd(); $reader.Dispose() }
    throw "$url : $detail"
  }
}
function Save-Json($value, [string]$name) { [IO.File]::WriteAllText((Join-Path $stage $name), (ConvertTo-Json -InputObject $value -Depth 100), [Text.UTF8Encoding]::new($false)) }
$releases = Get-Api 'https://firebaserules.googleapis.com/v1/projects/meridain-nexus/releases?pageSize=100'
if ($releases.nextPageToken) { throw 'Unexpected rules pagination; review before continuing.' }
Save-Json $releases 'rules-releases.before.json'
foreach ($release in $releases.releases) {
  if ($release.name -match '/cloud.firestore$|/firebase.storage/meridain-nexus.firebasestorage.app$') {
    $rules = Get-Api ('https://firebaserules.googleapis.com/v1/' + $release.rulesetName)
    $kind = if ($release.name -match '/cloud.firestore$') { 'firestore' } else { 'storage' }
    Save-Json $rules ($kind + '-ruleset.before.json')
    if ($rules.source.files.Count -ne 1) { throw 'Unexpected multi-file ruleset.' }
    [IO.File]::WriteAllText((Join-Path $stage ($kind + '.before.rules')), $rules.source.files[0].content, [Text.UTF8Encoding]::new($false))
  }
}
$live = Get-Api 'https://firebasehosting.googleapis.com/v1beta1/projects/meridain-nexus/sites/meridian-nexus/channels/live'
Save-Json $live 'hosting.before.json'
$files = Get-Api ('https://firebasehosting.googleapis.com/v1beta1/' + $live.release.version.name + '/files?pageSize=1000')
if ($files.nextPageToken) { throw 'Unexpected hosting pagination.' }
Save-Json $files 'hosting-files.before.json'
foreach ($name in @('index.html', 'app.js', 'service-worker.js')) {
  Invoke-WebRequest -Uri ('https://meridian-nexus.web.app/' + $name) -OutFile (Join-Path $stage ('live-' + $name)) -UseBasicParsing -TimeoutSec 60
}
$function = (& $gcloud functions describe saveAdminUser --gen2 --region=us-central1 --project=meridain-nexus --format=json) -join "`n"
if ($LASTEXITCODE -ne 0) { throw 'Cannot read saveAdminUser configuration.' }
[IO.File]::WriteAllText((Join-Path $stage 'saveAdminUser.before.json'), $function, [Text.UTF8Encoding]::new($false))
$counts = @{}
foreach ($collection in @('fileDropRooms', 'fileDrops', 'files', 'dashboardClients', 'dashboardUploads')) {
  $body = @{ structuredAggregationQuery = @{ structuredQuery = @{ from = @(@{ collectionId = $collection }) }; aggregations = @(@{ alias = 'total'; count = @{} }) } } | ConvertTo-Json -Depth 12 -Compress
  $result = Invoke-RestMethod -Uri 'https://firestore.googleapis.com/v1/projects/meridain-nexus/databases/(default)/documents:runAggregationQuery' -Headers $headers -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 60
  $counts[$collection] = @($result)[0].result.aggregateFields.total.integerValue
}
$body = @{ structuredAggregationQuery = @{ structuredQuery = @{ from = @(@{ collectionId = 'fileDropRooms' }); where = @{ fieldFilter = @{ field = @{ fieldPath = 'expiresAt' }; op = 'GREATER_THAN'; value = @{ timestampValue = [DateTime]::UtcNow.ToString('o') } } } }; aggregations = @(@{ alias = 'total'; count = @{} }) } } | ConvertTo-Json -Depth 15 -Compress
$result = Invoke-RestMethod -Uri 'https://firestore.googleapis.com/v1/projects/meridain-nexus/databases/(default)/documents:runAggregationQuery' -Headers $headers -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 60
$counts['activeFileDropRooms'] = @($result)[0].result.aggregateFields.total.integerValue
Save-Json $counts 'legacy-counts.json'
[pscustomobject]@{ hostingVersion = $live.release.version.name; functionRevision = ($function | ConvertFrom-Json).serviceConfig.revision; legacyCounts = $counts; backupDirectory = $stage } | ConvertTo-Json -Depth 10
