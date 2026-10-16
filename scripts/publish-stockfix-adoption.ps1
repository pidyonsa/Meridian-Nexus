param(
  [Parameter(Mandatory = $true)][string]$WorkbookPath,
  [Parameter(Mandatory = $true)][string]$Week,
  [Parameter(Mandatory = $true)][string]$StoragePath,
  [string]$ProjectId = "meridain-nexus"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $WorkbookPath)) {
  throw "Workbook not found: $WorkbookPath"
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$book = $excel.Workbooks.Open($WorkbookPath, $null, $true)
$rows = New-Object System.Collections.Generic.List[object]

try {
  $sheet = $book.Worksheets.Item(1)
  $used = $sheet.UsedRange
  $headers = @{}
  for ($column = 1; $column -le $used.Columns.Count; $column++) {
    $headers[[string]$sheet.Cells.Item(1, $column).Text.Trim().ToLowerInvariant()] = $column
  }

  foreach ($required in @("resource", "resource type", "region", "manager", "captures", "adoption")) {
    if (-not $headers.ContainsKey($required)) {
      throw "Missing required Adoption column: $required"
    }
  }

  for ($rowNumber = 2; $rowNumber -le $used.Rows.Count; $rowNumber++) {
    $resource = [string]$sheet.Cells.Item($rowNumber, $headers["resource"]).Text
    if ([string]::IsNullOrWhiteSpace($resource)) { continue }

    $resourceType = [string]$sheet.Cells.Item($rowNumber, $headers["resource type"]).Text
    $region = [string]$sheet.Cells.Item($rowNumber, $headers["region"]).Text
    $manager = [string]$sheet.Cells.Item($rowNumber, $headers["manager"]).Text
    $captures = 0.0
    [void][double]::TryParse((([string]$sheet.Cells.Item($rowNumber, $headers["captures"]).Text) -replace "[^0-9.-]", ""), [ref]$captures)
    $adoptionText = [string]$sheet.Cells.Item($rowNumber, $headers["adoption"]).Text
    $adoption = 0.0
    [void][double]::TryParse(($adoptionText -replace "[^0-9.-]", ""), [ref]$adoption)
    if ($adoption -le 1 -and $adoptionText -notmatch "%") { $adoption *= 100 }

    $role = if ($resourceType -match "(?i)merch") { "Merchandiser" } elseif ($resourceType -match "(?i)rep") { "Rep" } else { "Other" }
    $rows.Add([pscustomobject]@{
      resource = $resource.Trim()
      resourceType = ($(if ($resourceType) { $resourceType } else { "Unclassified" })).Trim()
      region = ($(if ($region) { $region } else { "Unassigned" })).Trim()
      manager = ($(if ($manager) { $manager } else { "Unassigned" })).Trim()
      captures = [math]::Round($captures, 2)
      adoption = [math]::Max(0, [math]::Min(100, $adoption))
      role = $role
    })
  }
} finally {
  $book.Close($false)
  $excel.Quit()
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($sheet)
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($book)
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
}

if (-not $rows.Count) { throw "No usable Adoption rows found." }

function ConvertTo-FirestoreFields($row) {
  return @{
    resource = @{ stringValue = $row.resource }
    resourceType = @{ stringValue = $row.resourceType }
    region = @{ stringValue = $row.region }
    manager = @{ stringValue = $row.manager }
    captures = @{ doubleValue = $row.captures }
    adoption = @{ doubleValue = $row.adoption }
    role = @{ stringValue = $row.role }
  }
}

$token = gcloud auth print-access-token
$httpHeaders = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }
$baseUrl = "https://firestore.googleapis.com/v1/projects/$ProjectId/databases/(default)/documents"

for ($offset = 0; $offset -lt $rows.Count; $offset += 350) {
  $writes = @()
  $slice = @($rows | Select-Object -Skip $offset -First 350)
  foreach ($row in $slice) {
    $bytes = [Text.Encoding]::UTF8.GetBytes("$($row.resource)|$($row.resourceType)|$($row.region)|$($row.manager)")
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
      $id = ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace("-", "").ToLowerInvariant().Substring(0, 32)
    } finally {
      $sha.Dispose()
    }
    $writes += @{
      update = @{
        name = "projects/$ProjectId/databases/(default)/documents/stockFixAdoptionWeeks/$Week/resources/$id"
        fields = ConvertTo-FirestoreFields $row
      }
    }
  }
  Invoke-RestMethod -Method Post -Headers $httpHeaders -Uri "$($baseUrl):batchWrite" -Body (@{ writes = $writes } | ConvertTo-Json -Depth 12 -Compress) | Out-Null
}

$sourceName = [IO.Path]::GetFileName($StoragePath)
$now = [DateTime]::UtcNow.ToString("o")
$summary = @{
  fields = @{
    week = @{ stringValue = $Week }
    status = @{ stringValue = "published" }
    sourceName = @{ stringValue = $sourceName }
    storagePath = @{ stringValue = $StoragePath }
    rowCount = @{ integerValue = "$($rows.Count)" }
    sourceProvider = @{ stringValue = "Firebase Storage" }
    publishedAt = @{ timestampValue = $now }
    updatedAt = @{ timestampValue = $now }
    schemaVersion = @{ integerValue = "1" }
  }
}
Invoke-RestMethod -Method Patch -Headers $httpHeaders -Uri "$($baseUrl)/stockFixAdoptionWeeks/$Week" -Body ($summary | ConvertTo-Json -Depth 12 -Compress) | Out-Null

$active = @($rows | Where-Object { $_.adoption -gt 0 }).Count
$rep = @($rows | Where-Object { $_.role -eq "Rep" })
$merch = @($rows | Where-Object { $_.role -eq "Merchandiser" })
[pscustomobject]@{
  week = $Week
  rows = $rows.Count
  active = $active
  captures = [math]::Round((($rows | Measure-Object captures -Sum).Sum), 0)
  repTotal = $rep.Count
  repActive = @($rep | Where-Object { $_.adoption -gt 0 }).Count
  merchTotal = $merch.Count
  merchActive = @($merch | Where-Object { $_.adoption -gt 0 }).Count
  storagePath = $StoragePath
} | ConvertTo-Json -Compress
