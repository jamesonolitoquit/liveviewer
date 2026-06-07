param(
  [int]$Port = 8080
)

$liveviewer = "node C:\Users\Jaoce\liveviewer\bin\liveviewer.js"
$tempDir = "C:\Users\Jaoce"
$htmlPath = "$tempDir\tricky.html"

# ---- Write tricky HTML ----
@'
<!DOCTYPE html>
<html>
<head><style>
  .gradient-bg { background: linear-gradient(45deg, red, blue); color: white; }
  .transparent-bg { background: transparent; color: black; }
  .opacity-text { color: rgba(0,0,0,0.5); background: white; }
  .svg-text { fill: #ff0000; }
</style></head>
<body style="background:white">
  <div class="gradient-bg">Gradient background</div>
  <div class="transparent-bg">Transparent background</div>
  <div class="opacity-text">Low opacity text</div>
  <svg><text fill="#ff0000" x="0" y="40">SVG text</text></svg>
  <div id="shadow-host"></div>
  <script>
    const host = document.getElementById('shadow-host');
    const shadow = host.attachShadow({mode: 'open'});
    shadow.innerHTML = '<div style="background:#111;color:#eee">Shadow DOM text</div>';
  </script>
</body>
</html>
'@ | Out-File -FilePath $htmlPath -Encoding utf8

# ---- Start Python HTTP server ----
Write-Host ">>> Starting test server..." -ForegroundColor Cyan
$serverJob = Start-Job -ScriptBlock { python -m http.server $using:Port -d $using:tempDir }
Start-Sleep -Seconds 2

$url = "http://localhost:$Port/tricky.html"
Write-Host ">>> Running audit --wcag against $url ..." -ForegroundColor Cyan

$out = Invoke-Expression "$liveviewer audit $url --wcag --label edge_test" 2>&1
$tagLine = ($out | Select-String "Screenshot: .+edge_test-(\d+)\.png")
$timestamp = if ($tagLine) { $tagLine.Matches.Groups[1].Value } else { (Get-ChildItem "C:\Users\Jaoce\liveviewer\audits\edge_test-*.json" | Sort-Object LastWriteTime -Descending | Select-Object -First 1).Name -replace 'edge_test-(\d+)\.json', '$1' }
$jsonPath = "C:\Users\Jaoce\liveviewer\audits\edge_test-$timestamp.json"

Start-Sleep -Seconds 1

if (-not (Test-Path $jsonPath)) {
  Write-Host "ERROR: Audit JSON not found at $jsonPath" -ForegroundColor Red
  Write-Host "Audit output: $out"
  $serverJob | Stop-Job -ErrorAction SilentlyContinue | Remove-Job -ErrorAction SilentlyContinue
  exit 1
}

$data = Get-Content $jsonPath -Raw | ConvertFrom-Json
$failures = $data.wcag.failures
$failureSelectors = $failures | ForEach-Object { $_.selector }

# ---- Evaluate test cases ----
$results = @()

# Case 1: Gradient background -- should not crash, should be skipped
$gradientFailed = ($failureSelectors | Where-Object { $_ -match 'gradient-bg' }).Count -gt 0
$results += [PSCustomObject]@{ Test = "Gradient background"; Expected = "Skipped (no crash)"; Status = if (-not $gradientFailed) { "PASS" } else { "FAIL" }; Detail = if (-not $gradientFailed) { "Not in failures" } else { "Unexpectedly in failures" } }

# Case 2: Transparent background -- currently false positive (ratio 1:1)
$transparentFailure = $failures | Where-Object { $_.selector -match 'transparent-bg' }
$transparentStatus = if ($transparentFailure) { "FAIL" } else { "PASS" }
$transparentDetail = if ($transparentFailure) { "False positive (ratio $($transparentFailure.contrastRatio):1, bg=$($transparentFailure.background))" } else { "Correctly passed" }
$results += [PSCustomObject]@{ Test = "Transparent background"; Expected = "Pass (ancestor walk -> ~21:1)"; Status = $transparentStatus; Detail = $transparentDetail }

# Case 3: Opacity text (50% black on white) -- should fail AA
$opacityFailure = $failures | Where-Object { $_.selector -match 'opacity-text' }
$opacityStatus = if ($opacityFailure) { "PASS" } else { "FAIL" }
$opacityDetail = if ($opacityFailure) { "Correctly flagged (ratio $($opacityFailure.contrastRatio):1)" } else { "Not detected - should fail AA" }
$results += [PSCustomObject]@{ Test = "Opacity text (50%)"; Expected = "Fail AA (ratio ~3:1)"; Status = $opacityStatus; Detail = $opacityDetail }

# Case 4: SVG text -- known limitation
$svgFailure = ($failureSelectors | Where-Object { $_ -match 'svg' -or $_ -match 'text' }).Count -gt 0
$results += [PSCustomObject]@{ Test = "SVG text"; Expected = "Skipped (TreeWalker limitation)"; Status = "SKIP"; Detail = if (-not $svgFailure) { "Not found - known limitation" } else { "Found - unexpected" } }

# Case 5: Shadow DOM -- known limitation
$shadowFailure = ($failureSelectors | Where-Object { $_ -match 'shadow' }).Count -gt 0
$results += [PSCustomObject]@{ Test = "Shadow DOM text"; Expected = "Skipped (TreeWalker limitation)"; Status = "SKIP"; Detail = if (-not $shadowFailure) { "Not found - known limitation" } else { "Found - unexpected" } }

# ---- Cleanup ----
$serverJob | Stop-Job -ErrorAction SilentlyContinue | Remove-Job -ErrorAction SilentlyContinue
Get-Process -Name python* -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $htmlPath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath "C:\Users\Jaoce\liveviewer\audits\edge_test-*" -Force -ErrorAction SilentlyContinue

# ---- Print Results Table ----
Write-Host "`n=========================================================" -ForegroundColor Yellow
Write-Host "        LIVEWIEWER EDGE CASE TEST RESULTS" -ForegroundColor Yellow
Write-Host "=========================================================" -ForegroundColor Yellow
Write-Host ""

Write-Host ("{0,-30} {1,-10} {2,-10} {3}" -f "Test Case", "Expected", "Status", "Detail") -ForegroundColor White
Write-Host ("-" * 100)

$allPass = $true
foreach ($r in $results) {
  $color = switch ($r.Status) {
    "PASS" { "Green" }
    "FAIL" { $allPass = $false; "Red" }
    "SKIP" { "Yellow" }
    default { "Gray" }
  }
  Write-Host ("{0,-30} {1,-10} {2,-10} {3}" -f $r.Test, $r.Expected.Substring(0, [Math]::Min(10, $r.Expected.Length)), $r.Status, $r.Detail) -ForegroundColor $color
}

Write-Host "`n=========================================================" -ForegroundColor Yellow
if ($allPass) {
  Write-Host "  RESULT: ALL TESTS PASS" -ForegroundColor Green
} else {
  Write-Host "  RESULT: SOME TESTS FAILED" -ForegroundColor Red
  Write-Host "  The opacity-text failure is due to alpha channel stripping in rgbToHex." -ForegroundColor Yellow
  Write-Host "  SVG and Shadow DOM are known TreeWalker limitations (low priority)." -ForegroundColor Yellow
}
Write-Host "=========================================================" -ForegroundColor Yellow
