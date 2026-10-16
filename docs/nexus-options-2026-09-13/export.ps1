$ErrorActionPreference = 'Stop'
$folder = $PSScriptRoot
$name = 'Meridian-Nexus-Data-and-Application-Options-2026-09-13'
$inputPath = Join-Path $folder ($name + '.pptx')
$pdfPath = Join-Path $folder ($name + '.pdf')
$imageFolder = Join-Path $folder 'rendered'
New-Item -ItemType Directory -Path $imageFolder -Force | Out-Null
$app = $null
$presentation = $null
try {
    $app = New-Object -ComObject PowerPoint.Application
    $presentation = $app.Presentations.Open($inputPath, $true, $false, $false)
    if ($presentation.Slides.Count -ne 5) { throw 'Expected exactly five slides.' }
    $overflow = @()
    foreach ($slide in $presentation.Slides) {
        foreach ($shape in $slide.Shapes) {
            if ($shape.HasTextFrame -eq -1 -and $shape.TextFrame2.HasText -eq -1) {
                $range = $shape.TextFrame2.TextRange
                if ($range.BoundHeight -gt ($shape.Height + 1.5) -or $range.BoundWidth -gt ($shape.Width + 1.5)) {
                    $overflow += [PSCustomObject]@{ Slide=$slide.SlideIndex; Text=$range.Text; Height=$shape.Height; BoundHeight=$range.BoundHeight; Width=$shape.Width; BoundWidth=$range.BoundWidth }
                }
            }
        }
    }
    ConvertTo-Json -InputObject @($overflow) -Depth 4 | Set-Content -LiteralPath (Join-Path $folder 'powerpoint-layout-check.json') -Encoding UTF8
    $presentation.Export($imageFolder, 'PNG', 1600, 900)
    if ($overflow.Count -gt 0) {
        $overflow | ConvertTo-Json -Depth 4
        throw 'Fix text overflow before PDF export.'
    }
    $presentation.SaveAs($pdfPath, 32)
    [PSCustomObject]@{ Slides=$presentation.Slides.Count; TextOverflow=$overflow.Count; PDF=$pdfPath; Images=$imageFolder } | ConvertTo-Json
} finally {
    if ($presentation) { $presentation.Close() }
    if ($app) { $app.Quit() }
    if ($presentation) { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($presentation) }
    if ($app) { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($app) }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
