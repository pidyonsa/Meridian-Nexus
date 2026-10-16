param([ValidateSet('staff-defaults', 'chat-tasks')][string]$StageName)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$stage = Join-Path $root '.tmp/chat-release'
if ($StageName) { $stage = Join-Path $stage $StageName }
if (!(Test-Path -LiteralPath (Join-Path $stage 'hosting.after.json'))) { throw 'Hosting has not been verified as released.' }
$checks = @()
$assets = @('index.html', 'app.js', 'service-worker.js', 'meridian-chat.js', 'meridian-chat.css')
foreach ($name in $assets) {
  $download = Join-Path $stage ('verified-' + $name)
  Invoke-WebRequest -Uri ('https://meridian-nexus.web.app/' + $name + '?release=' + $StageName) -OutFile $download -UseBasicParsing -TimeoutSec 60
  $expected = (Get-FileHash -LiteralPath (Join-Path $stage ('hosting-assets/' + $name)) -Algorithm SHA256).Hash
  if ((Get-FileHash -LiteralPath $download -Algorithm SHA256).Hash -ne $expected) { throw "Live asset mismatch: $name" }
  $checks += @{ check = 'live-asset'; name = $name; result = 'exact-match' }
}
function Check-Denied([string]$url, [string]$method, [string]$body, [int]$expected, [string]$label) {
  $args = @{ Uri = $url; Method = $method; UseBasicParsing = $true; TimeoutSec = 90 }
  if ($body) { $args.ContentType = 'application/json'; $args.Body = $body }
  try { $response = Invoke-WebRequest @args; $status = [int]$response.StatusCode }
  catch { if (!$_.Exception.Response) { throw }; $status = [int]$_.Exception.Response.StatusCode }
  if ($status -ne $expected) { throw "$label : expected $expected, got $status" }
  @{ check = $label; result = 'denied'; httpStatus = $status }
}
$checks += Check-Denied 'https://us-central1-meridain-nexus.cloudfunctions.net/meridianChat' POST '{"data":{"action":"bootstrap"}}' 401 'signed-out Chat callable'
$checks += Check-Denied 'https://us-central1-meridain-nexus.cloudfunctions.net/askNexusAssistant' POST '{"data":{"question":"Access check","model":"gemini-3.5-flash"}}' 403 'signed-out Nexus Assistant'
$checks += Check-Denied 'https://us-central1-meridain-nexus.cloudfunctions.net/saveAdminUser' POST '{"data":{}}' 403 'signed-out user management'
foreach ($collection in @('files', 'dashboardClients', 'dashboardUploads', 'meridianChatRooms', 'meridianChatTasks')) {
  $checks += Check-Denied ('https://firestore.googleapis.com/v1/projects/meridain-nexus/databases/(default)/documents/' + $collection + '?pageSize=1') GET '' 403 ('signed-out ' + $collection)
}
[IO.File]::WriteAllText((Join-Path $stage 'verification.json'), (ConvertTo-Json -InputObject $checks -Depth 10), [Text.UTF8Encoding]::new($false))
$checks | ConvertTo-Json -Depth 10
