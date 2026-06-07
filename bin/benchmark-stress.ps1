param(
  [switch]$KeepArtifacts
)

$ProjectRoot = "C:\Users\Jaoce\liveviewer"
$LV = "node bin/liveviewer.js"
$ArtifactDir = "$ProjectRoot\benchmark-artifacts"
New-Item -ItemType Directory -Force -Path $ArtifactDir | Out-Null
$RunId = "bm-" + (Get-Date -Format "yyyyMMdd-HHmmss")

$benchmarks = @(
  @{ Name = "W3C-Tests";       Url = "https://www.w3.org/WAI/ER/tests/";                  TargetScore = 95; MinScore = 80; Tag = "bm_w3c";        Timeout = 60000; WaitUntil = "load" }
  @{ Name = "W3C-QuickRef";    Url = "https://www.w3.org/WAI/WCAG22/quickref/";           TargetScore = 99; MinScore = 90; Tag = "bm_quickref";   Timeout = 30000; WaitUntil = "networkidle" }
  @{ Name = "NBC-News";        Url = "https://www.nbcnews.com/";                          TargetScore = 70; MinScore = 50; Tag = "bm_nbc";       Timeout = 60000; WaitUntil = "load" }
  @{ Name = "GitHub";          Url = "https://github.com/";                               TargetScore = 85; MinScore = 70; Tag = "bm_github";    Timeout = 60000; WaitUntil = "load" }
  @{ Name = "Access-Board";    Url = "https://www.access-board.gov/";                     TargetScore = 99; MinScore = 95; Tag = "bm_accessbd";  Timeout = 30000; WaitUntil = "networkidle" }
  @{ Name = "web.dev";         Url = "https://web.dev/";                                  TargetScore = 99; MinScore = 95; Tag = "bm_webdev";    Timeout = 30000; WaitUntil = "networkidle" }
  @{ Name = "About-Google";    Url = "https://about.google/";                             TargetScore = 99; MinScore = 95; Tag = "bm_google";    Timeout = 30000; WaitUntil = "networkidle" }
  @{ Name = "SSA-Gov";         Url = "https://www.ssa.gov/";                              TargetScore = 99; MinScore = 95; Tag = "bm_ssa";       Timeout = 30000; WaitUntil = "networkidle" }
)

$results = @()
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  LIVEWIEWER v1.0.0 BENCHMARK STRESS TEST" -ForegroundColor Cyan
Write-Host "  Run ID: $RunId" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

foreach ($b in $benchmarks) {
  Write-Host "`n[$($b.Name)] Auditing $($b.Url)..." -ForegroundColor Yellow
  $start = Get-Date

  $output = & node "$ProjectRoot\bin\liveviewer.js" audit $b.Url --wcag "--label" $b.Tag "--timeout" $b.Timeout "--wait-until" $b.WaitUntil 2>&1
  $exit = $LASTEXITCODE

  $jsonFile = Get-ChildItem -Path "$ProjectRoot\audits" -Filter "$($b.Tag)-*.json" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  $duration = [math]::Round(((Get-Date) - $start).TotalSeconds, 1)

  $score = $null; $pass = $null; $total = $null; $failCount = $null
  $errorMsg = $null

  if (-not $jsonFile) {
    $errorMsg = "No JSON output found"
  } else {
    try {
      $data = Get-Content $jsonFile.FullName -Raw | ConvertFrom-Json
      $score = $data.wcag.score
      $pass = $data.wcag.passCount
      $total = $data.wcag.totalElements
      $failCount = $data.wcag.failCount
      # Copy to artifact dir
      Copy-Item $jsonFile.FullName "$ArtifactDir\$($b.Tag)-$RunId.json" -Force
    } catch {
      $errorMsg = "JSON parse error: $_"
    }
  }

  $thresholdOk = ($score -ne $null) -and ($score -ge $b.TargetScore)
  $minOk = ($score -ne $null) -and ($score -ge $b.MinScore)
  $status = if ($minOk) { "PASS" } else { "FAIL" }

  $results += [PSCustomObject]@{
    Name         = $b.Name
    Score        = if ($score -ne $null) { "$score%" } else { "ERROR" }
    PassCount    = $pass
    Total        = $total
    FailCount    = $failCount
    Target       = "$($b.TargetScore)%"
    MinBar       = "$($b.MinScore)%"
    Status       = $status
    Duration     = "$($duration)s"
    Detail       = $errorMsg
    Url          = $b.Url
  }

  $lineColor = if ($status -eq "PASS") { "Green" } else { "Red" }
  $scoreStr = if ($score -ne $null) { "$score% ($pass/$total pass, $failCount fail)" } else { "NO DATA" }
  Write-Host "  Score: $scoreStr  |  Target: ≥$($b.TargetScore)%  |  Status: $status  |  ${duration}s" -ForegroundColor $lineColor
}

# Summary report
Write-Host "`n$("=" * 70)" -ForegroundColor Cyan
Write-Host "  BENCHMARK STRESS TEST RESULTS" -ForegroundColor Cyan
Write-Host "$("=" * 70)" -ForegroundColor Cyan
Write-Host ""
Write-Host ("{0,-16} {1,8} {2,8} {3,8} {4,8} {5,8} {6,8}" -f "SITE", "SCORE", "PASS", "TOTAL", "FAIL", "TARGET", "STATUS") -ForegroundColor White
Write-Host ("-" * 70)

$allPass = $true
foreach ($r in $results) {
  $color = if ($r.Status -eq "PASS") { "Green" } else { "Red" }
  if ($r.Status -ne "PASS") { $allPass = $false }
  $scoreDisplay = if ($r.Score) { $r.Score } else { "ERR" }
  Write-Host ("{0,-16} {1,8} {2,8} {3,8} {4,8} {5,8} {6,8}" -f $r.Name, $scoreDisplay, $r.PassCount, $r.Total, $r.FailCount, $r.Target, $r.Status) -ForegroundColor $color
}

Write-Host ("-" * 70)
$verdict = if ($allPass) { "ALL BENCHMARKS PASSED" } else { "SOME BENCHMARKS FAILED" }
Write-Host "  VERDICT: $verdict" -ForegroundColor $(if ($allPass) { "Green" } else { "Red" })
Write-Host "  Artifacts saved to: $ArtifactDir"

# Write report to file
$reportLines = @()
$reportLines += "# Liveviewer v1.0.0 Benchmark Stress Test Results"
$reportLines += ""
$reportLines += "**Run ID:** $RunId  "
$reportLines += "**Date:** $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  "
$reportLines += ""
$reportLines += "| Site | Score | Pass/Total | Failures | Target | Status | Duration |"
$reportLines += "|------|-------|------------|----------|--------|--------|----------|"
foreach ($r in $results) {
  $scoreDisplay = if ($r.Score) { $r.Score } else { "ERROR" }
  $reportLines += "| $($r.Name) | $scoreDisplay | $($r.PassCount)/$($r.Total) | $($r.FailCount) | ≥$($r.Target) | $($r.Status) | $($r.Duration) |"
}
$reportLines += ""
$reportLines += "**Overall Verdict:** $verdict  "
$reportLines += ""
if (-not $allPass) {
  $reportLines += "## Failures Details"
  $reportLines += ""
  foreach ($r in $results) {
    if ($r.Status -ne "PASS" -and $r.Detail) {
      $reportLines += "- **$($r.Name)**: $($r.Detail)"
    }
  }
  $reportLines += ""
}
$reportLines += "---"
$reportLines += "_Generated by Liveviewer benchmark-stress.ps1_"
$reportStream = $reportLines -join "`n"
Set-Content -Path "$ArtifactDir\benchmark-report.md" -Value $reportStream
Write-Host "`nReport saved to: $ArtifactDir\benchmark-report.md"

# Cleanup
if (-not $KeepArtifacts) {
  Write-Host "`nCleaning up audit artifacts..." -ForegroundColor DarkGray
  foreach ($b in $benchmarks) {
    Get-ChildItem -Path "$ProjectRoot\audits" -Filter "$($b.Tag)-*.json" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
    Get-ChildItem -Path "$ProjectRoot\audits" -Filter "$($b.Tag)-*.png" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
  }
}

if (-not $allPass) { exit 1 }
