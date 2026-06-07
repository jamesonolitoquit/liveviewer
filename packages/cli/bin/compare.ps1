param(
  [string]$Liveviewer = "node packages/cli/bin/liveviewer.js",
  [int]$DurationMs = 4000,
  [string]$PortfolioUrl = "https://jaostudio.vercel.app"
)

$results = @{}
$tempDir = "C:\Users\Jaoce"
$htmlPath = "$tempDir\test-smooth.html"
$recordingsDir = "recordings"

# ---- Step 1: Create test-smooth.html ----
@'
<!DOCTYPE html>
<html>
<head><title>Smooth Test</title>
<style>
  body { background: #111; color: #eee; font-family: monospace; }
  .box { width: 100px; height: 100px; background: cyan; animation: move 2s linear infinite; }
  @keyframes move { 0% { transform: translateX(0); } 100% { transform: translateX(300px); } }
</style>
</head>
<body>
  <h1>Liveviewer Test – No Jank Expected</h1>
  <div class="box"></div>
</body>
</html>
'@ | Out-File -FilePath $htmlPath -Encoding utf8

# ---- Step 2: Start Python HTTP server ----
Write-Host ">>> Starting Python HTTP server on port 8080 ..." -ForegroundColor Cyan
$serverJob = Start-Job -ScriptBlock { python -m http.server 8080 -d $using:tempDir }
Start-Sleep -Seconds 2

try {
  $testReq = Invoke-WebRequest -Uri "http://localhost:8080/test-smooth.html" -UseBasicParsing -TimeoutSec 3
  Write-Host "  Server ready." -ForegroundColor Green
} catch {
  Write-Host "  WARNING: Server may not be ready, continuing..." -ForegroundColor Yellow
}

# ---- Step 3: Define test targets ----
$targets = @(
  @{ name = "local";     url = "http://localhost:8080/test-smooth.html";  args = @("--interaction", "wait 100") }
  @{ name = "google";    url = "https://www.google.com";                  args = @("--interaction", "wait 100") }
  @{ name = "portfolio"; url = $PortfolioUrl;                            args = @("--interaction", "scroll 400", "--interaction", "wait 500", "--interaction", "hover nav a:first-child") }
)

# ---- Step 4: Run each target ----
foreach ($t in $targets) {
  Write-Host "`n>>> Recording $($t.name) ($($t.url)) ..." -ForegroundColor Cyan
  $label = "cmp_$($t.name)"
  $cmd = "$Liveviewer record $($t.url) --duration $DurationMs $($t.args -join ' ') --label $label"
  try {
    $out = Invoke-Expression $cmd 2>&1
    $tag = ($out | Select-String "Tag:\s+(.+)").Matches.Groups[1].Value.Trim()
    $jsonPath = "$recordingsDir\$tag.json"
    if (Test-Path $jsonPath) {
      $data = Get-Content $jsonPath -Raw | ConvertFrom-Json
      $m = $data.metrics
      $results[$t.name] = @{
        smoothness  = [math]::Round($m.smoothnessScore, 2)
        jankRate    = [math]::Round($m.jankRate, 2)
        meanDelta   = [math]::Round($m.meanDelta, 2)
        maxDelta    = [math]::Round($m.maxDelta, 2)
        jankFrames  = $m.jankFrames
        totalFrames = $m.totalFrames
        tag         = $tag
      }
      Write-Host ("  Tag: {0} | Smoothness: {1}% | Jank: {2}% | MeanDelta: {3}ms" -f $tag, [math]::Round($m.smoothnessScore,1), [math]::Round($m.jankRate,2), [math]::Round($m.meanDelta,2)) -ForegroundColor Green
    } else {
      $results[$t.name] = @{ error = "JSON not found for tag $tag" }
      Write-Host "  ERROR: No metadata file for tag $tag" -ForegroundColor Red
    }
  } catch {
    $results[$t.name] = @{ error = $_.Exception.Message }
    Write-Host "  ERROR: $_" -ForegroundColor Red
  }
}

# ---- Step 5: Kill Python server ----
Write-Host "`n>>> Cleaning up ..." -ForegroundColor Cyan
$serverJob | Stop-Job -ErrorAction SilentlyContinue | Remove-Job -ErrorAction SilentlyContinue
Get-Process -Name python* -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $htmlPath -Force -ErrorAction SilentlyContinue

# ---- Step 6: Print comparison table ----
Write-Host "`n=========================================================" -ForegroundColor Yellow
Write-Host "        LIVEWIEWER CONTROL COMPARISON" -ForegroundColor Yellow
Write-Host "=========================================================" -ForegroundColor Yellow
Write-Host ""

Write-Host ("{0,-15} {1,12} {2,10} {3,14} {4,12} {5,10}" -f "Target", "Smoothness", "JankRate", "MeanDelta(ms)", "MaxDelta", "Frames") -ForegroundColor White
Write-Host ("-" * 80)

foreach ($name in @("local", "google", "portfolio")) {
  $r = $results[$name]
  if (-not $r) {
    Write-Host ("{0,-15} {1,12}" -f $name, "NO DATA") -ForegroundColor Red
  } elseif ($r.error) {
    Write-Host ("{0,-15} {1,12}" -f $name, "ERROR") -ForegroundColor Red
  } else {
    $color = if ($r.smoothness -ge 90) { "Green" } elseif ($r.smoothness -ge 70) { "Yellow" } else { "Red" }
    Write-Host ("{0,-15} {1,10}% {2,9}% {3,13}ms {4,11}ms {5,9}" -f $name, $r.smoothness, $r.jankRate, $r.meanDelta, $r.maxDelta, $r.totalFrames) -ForegroundColor $color
  }
}

# ---- Step 7: Interpretation ----
Write-Host "`n=========================================================" -ForegroundColor Yellow
Write-Host "        INTERPRETATION" -ForegroundColor Yellow
Write-Host "=========================================================" -ForegroundColor Yellow

$localOk = ($results.local.smoothness -ge 95 -and $results.local.jankRate -le 1)
$googleOk = ($results.google.smoothness -ge 90)
$portfolioOk = ($results.portfolio.smoothness -ge 90)

if ($localOk) {
  Write-Host "`n  [PASS] Local control: Liveviewer is accurate (no jank on simple page)." -ForegroundColor Green
} else {
  Write-Host "`n  [FAIL] Local control: Liveviewer or environment introduces jank." -ForegroundColor Red
  Write-Host "         Check: Node version, FFmpeg, headless browser overhead." -ForegroundColor Red
}

if ($googleOk) {
  Write-Host "  [PASS] Google: Production baseline is smooth." -ForegroundColor Green
} else {
  Write-Host "  [FAIL] Google: Even a simple site has jank. Environment issue." -ForegroundColor Red
}

if ($localOk -and $googleOk) {
  if ($portfolioOk) {
    Write-Host "  [PASS] Portfolio: Meets smoothness threshold (>=90%)." -ForegroundColor Green
  } else {
    Write-Host "  [FAIL] Portfolio: Genuine performance issues detected." -ForegroundColor Yellow
    Write-Host "         Recommend: debounce scroll handlers, lazy-load images, reduce hover complexity." -ForegroundColor Yellow
  }
} elseif (-not $localOk) {
  Write-Host "  [?] Portfolio: Cannot assess until local control passes." -ForegroundColor Yellow
} elseif (-not $googleOk) {
  Write-Host "  [?] Portfolio: Cannot assess until Google control passes." -ForegroundColor Yellow
}
