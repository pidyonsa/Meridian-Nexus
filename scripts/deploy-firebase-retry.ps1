param(
    [int]$MaxAttempts = 8,
    [int]$RetryDelaySeconds = 8,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$FirebaseArgs
)

if (-not $FirebaseArgs -or $FirebaseArgs.Count -eq 0) {
    throw "Usage: .\\scripts\\deploy-firebase-retry.ps1 firebase arguments"
}

 $previousNodeOptions = $env:NODE_OPTIONS
 $env:NODE_OPTIONS = "$previousNodeOptions --tls-max-v1.2".Trim()
 $exitCode = 1

try {
  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
      Write-Host "Firebase attempt $attempt of $MaxAttempts" -ForegroundColor Cyan
      $output = & firebase @FirebaseArgs 2>&1
      $output | ForEach-Object { Write-Host $_ }

      if ($LASTEXITCODE -eq 0) {
          $exitCode = 0
          break
      }

      $exitCode = $LASTEXITCODE
      $joined = $output -join "`n"
      $isTransientNetworkFailure = $joined -match "UND_ERR_CONNECT_TIMEOUT|Connect Timeout Error|Failed to make request to https://"
      if (-not $isTransientNetworkFailure -or $attempt -eq $MaxAttempts) {
          break
      }

      Write-Host "A Google API connection timed out. Retrying in $RetryDelaySeconds seconds..." -ForegroundColor Yellow
      Start-Sleep -Seconds $RetryDelaySeconds
  }
} finally {
  $env:NODE_OPTIONS = $previousNodeOptions
}

exit $exitCode
