param(
    [Parameter(Mandatory = $true)][string]$InputWorkbook,
    [Parameter(Mandatory = $true)][string]$OutputWorkbook
)

$ErrorActionPreference = 'Stop'
$auditRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\.tmp\salesforce-monthly-recovery-20260922')) + [IO.Path]::DirectorySeparatorChar
$inputPath = (Resolve-Path -LiteralPath $InputWorkbook).Path
$outputPath = [IO.Path]::GetFullPath($OutputWorkbook)
foreach ($candidate in @($inputPath, $outputPath)) {
    if (-not $candidate.StartsWith($auditRoot, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Recalculation is restricted to local monthly audit copies.'
    }
}
if (Test-Path -LiteralPath $outputPath) { throw 'Preserve the existing audit output.' }
$originalHash = (Get-FileHash -LiteralPath $inputPath -Algorithm SHA256).Hash
$excel = $null
$book = $null
try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $excel.EnableEvents = $false
    $excel.AskToUpdateLinks = $false
    $excel.AutomationSecurity = 3
    # Open only the audit copy, read-only, with external links and macros disabled.
    $book = $excel.Workbooks.Open($inputPath, 0, $true)
    if ($book.Connections.Count -ne 0) { throw 'Connected workbooks require separate review before recalculation.' }
    $excel.CalculateFullRebuild()
    if ($excel.CalculationState -ne 0) { throw 'Excel recalculation did not finish.' }
    $book.SaveCopyAs($outputPath)
    [PSCustomObject]@{
        localOnly = $true
        readOnlySource = $book.ReadOnly
        sheets = $book.Worksheets.Count
        output = $outputPath
        outputBytes = (Get-Item -LiteralPath $outputPath).Length
    } | ConvertTo-Json -Compress
} finally {
    if ($null -ne $book) {
        $book.Close($false)
        [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($book)
    }
    if ($null -ne $excel) {
        $excel.Quit()
        [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($excel)
    }
    if ((Get-FileHash -LiteralPath $inputPath -Algorithm SHA256).Hash -ne $originalHash) {
        throw 'Read-only source hash changed.'
    }
}
