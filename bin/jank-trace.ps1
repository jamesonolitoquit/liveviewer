param(
  [string]$Url = "https://jaostudio.vercel.app",
  [int]$DurationMs = 6000,
  [float]$JankThreshold = 33.0
)

$liveviewer = "node C:\Users\Jaoce\liveviewer\bin\liveviewer.js"
$label = "jtrace"

# Record
Write-Host "Recording $Url for ${DurationMs}ms ..." -ForegroundColor Cyan
$out = Invoke-Expression "$liveviewer record $Url --duration $DurationMs --interaction ""scroll 400"" --interaction ""wait 500"" --interaction ""scroll 400"" --label $label" 2>&1
$tag = ($out | Select-String "Tag:\s+(.+)").Matches.Groups[1].Value.Trim()
$jsonPath = "C:\Users\Jaoce\liveviewer\recordings\$tag.json"

if (-not (Test-Path $jsonPath)) { Write-Host "ERROR: No metadata file" -ForegroundColor Red; exit 1 }

$data = Get-Content $jsonPath -Raw | ConvertFrom-Json

# Filter janky frames
$janky = $data.timing | Where-Object { $_.delta -gt $JankThreshold } | Sort-Object t

Write-Host "`n=========================================================" -ForegroundColor Yellow
Write-Host "  JANK TRACE - $Url" -ForegroundColor Yellow
Write-Host "  Tag: $tag" -ForegroundColor Yellow
Write-Host "  Threshold: >${JankThreshold}ms  |  Total: $($janky.Count) janky frames of $($data.timing.Count)" -ForegroundColor Yellow
Write-Host "=========================================================" -ForegroundColor Yellow
Write-Host ""

if ($janky.Count -eq 0) { Write-Host "No janky frames detected." -ForegroundColor Green; exit 0 }

Write-Host ("{0,3}  {1,12}  {2,10}  {3,12}" -f "#", "Timestamp(s)", "Delta(ms)", "Cumul. Time") -ForegroundColor White
Write-Host ("{0,3}  {1,12}  {2,10}  {3,12}" -f "---", "------------", "---------", "-----------")

$i = 1
foreach ($f in $janky) {
  $color = if ($f.delta -gt 100) { "Red" } elseif ($f.delta -gt 50) { "Yellow" } else { "Green" }
  Write-Host ("{0,3}  {1,9}s  {2,9}ms  {3,9}s" -f $i, [math]::Round($f.t/1000,2), [math]::Round($f.delta,1), [math]::Round($f.t/1000,2)) -ForegroundColor $color
  $i++
}

# Summary stats
$smooth = $data.metrics
Write-Host "`n=========================================================" -ForegroundColor Yellow
Write-Host "  SUMMARY" -ForegroundColor Yellow
Write-Host "=========================================================" -ForegroundColor Yellow
Write-Host ("  Smoothness: {0}%" -f [math]::Round($smooth.smoothnessScore,1))
Write-Host ("  Jank rate:  {0}%" -f [math]::Round($smooth.jankRate,2))
Write-Host ("  Mean delta: {0}ms" -f [math]::Round($smooth.meanDelta,2))
Write-Host ("  Max delta:  {0}ms" -f [math]::Round($smooth.maxDelta,1))
Write-Host ""
Write-Host "Open DevTools > Performance, record the same interaction," -ForegroundColor Gray
Write-Host "and zoom into these timestamps to find the cause." -ForegroundColor Gray
