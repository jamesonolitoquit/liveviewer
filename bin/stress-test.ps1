param(
  [switch]$KeepArtifacts
)

$ErrorActionPreference = "Continue"
$ProjectRoot = "C:\Users\Jaoce\liveviewer"
$LV = "node bin/liveviewer.js"
$RunId = "stress-" + (Get-Date -Format "yyyyMMdd-HHmmss")
$Results = @()
$PassCount = 0; $FailCount = 0; $SkipCount = 0; $WarnCount = 0
$StartTime = Get-Date

function Run-Stress($Name, $Cmd, [int]$ExpectedExit = 0, $TimeoutSec = 60, $Assert = $null) {
  $job = Start-Job -ScriptBlock {
    param($dir, $cmd)
    Set-Location -LiteralPath $dir
    $result = Invoke-Expression $cmd 2>&1
    $exit = $LASTEXITCODE
    $lines = @($result | ForEach-Object { "$_" })
    return @{ Output = $lines; ExitCode = $exit }
  } -ArgumentList $ProjectRoot, $Cmd

  $completed = Wait-Job $job -Timeout $TimeoutSec
  if (-not $completed) {
    Stop-Job $job; Remove-Job $job
    return [PSCustomObject]@{ Name = $Name; Status = "TIMEOUT"; Detail = "Exceeded ${TimeoutSec}s" }
  }

  $data = Receive-Job $job; Remove-Job $job

  if ($data.ExitCode -ne $ExpectedExit) {
    $detail = "Exit $($data.ExitCode) (expected $ExpectedExit)"
    if ($data.Output.Count -gt 0) { $detail += ": $($data.Output[0])" }
    return [PSCustomObject]@{ Name = $Name; Status = "FAIL"; Detail = $detail }
  }

  if ($Assert) {
    $ok = & $Assert $data.Output
    if (-not $ok) {
      return [PSCustomObject]@{ Name = $Name; Status = "FAIL"; Detail = "Assertion failed" }
    }
  }

  return [PSCustomObject]@{ Name = $Name; Status = "PASS"; Detail = "" }
}

function Assert-OutputMatch($pattern) {
  return { param($output) foreach ($l in $output) { if ($l -match $pattern) { return $true } } return $false }.GetNewClosure()
}

function Assert-FileExists($pattern) {
  return { param($output) $found = Get-ChildItem -Path "$ProjectRoot\$pattern" -ErrorAction SilentlyContinue | Select-Object -First 1; return ($found -ne $null) }.GetNewClosure()
}

function Assert-JsonKey($pattern, $key) {
  return { param($output)
    $file = Get-ChildItem -Path "$ProjectRoot\$pattern" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $file) { return $false }
    try { $json = Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json; $parts = $key -split '\.'; $cur = $json; foreach ($p in $parts) { $cur = $cur.$p }; return ($cur -ne $null) } catch { return $false }
  }.GetNewClosure()
}

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  LIVEWIEWER STRESS TEST ($RunId)" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# ===== 1. Heavy DOM (Wikipedia) =====
Write-Host "`n[1/10] Heavy DOM (Wikipedia)" -ForegroundColor Yellow
$Results += Run-Stress "audit-heavy" "$LV audit https://en.wikipedia.org/wiki/Main_Page --wcag --label $RunId-heavy-dom --timeout 60000 --wait-until load" 0 90 (Assert-JsonKey "audits\$RunId-heavy-dom-*.json" "wcag.score")
$Results += Run-Stress "extract-heavy" "$LV extract https://en.wikipedia.org/wiki/Main_Page --styles --label $RunId-heavy-dom" 0 60 (Assert-OutputMatch "Colors:")

# ===== 2. Infinite scroll + large recording =====
Write-Host "`n[2/10] Infinite scroll (reddit)" -ForegroundColor Yellow
$Results += Run-Stress "record-scroll" "$LV record https://old.reddit.com --duration 8000 --interaction `"scroll 3000`" --label $RunId-scroll" 0 90 (Assert-OutputMatch "Recording complete")

# ===== 3. Dark mode emulation =====
Write-Host "`n[3/10] Dark mode emulation" -ForegroundColor Yellow
$Results += [PSCustomObject]@{ Name = "dark-mode"; Status = "SKIP"; Detail = "No --emulate flag yet" }
$SkipCount++

# ===== 4. iframe content =====
Write-Host "`n[4/10] iframe content (cnn.com)" -ForegroundColor Yellow
$Results += Run-Stress "audit-iframes" "$LV audit https://www.cnn.com --wcag --label $RunId-iframes --timeout 60000 --wait-until load" 0 90 (Assert-JsonKey "audits\$RunId-iframes-*.json" "wcag.score")

# ===== 5. CSS Grid + subgrid =====
Write-Host "`n[5/10] CSS Grid (gridbyexample.com)" -ForegroundColor Yellow
$Results += Run-Stress "extract-grid" "$LV extract https://gridbyexample.com --styles --label $RunId-grid" 0 45 (Assert-OutputMatch "Colors:")

# ===== 6. CSS custom properties =====
Write-Host "`n[6/10] CSS custom properties (tailwindcss)" -ForegroundColor Yellow
$Results += Run-Stress "audit-cssvars" "$LV audit https://tailwindcss.com --wcag --label $RunId-cssvars" 0 60 (Assert-JsonKey "audits\$RunId-cssvars-*.json" "wcag.score")
$Results += Run-Stress "extract-cssvars" "$LV extract https://tailwindcss.com --styles --label $RunId-cssvars" 0 45 (Assert-OutputMatch "Colors:")

# ===== 7. Lazy-loaded content =====
Write-Host "`n[7/10] Lazy-loaded content (unsplash)" -ForegroundColor Yellow
$Results += Run-Stress "record-lazy" "$LV record https://unsplash.com --duration 6000 --interaction `"scroll 1000`" --label $RunId-lazy" 0 90 (Assert-OutputMatch "Recording complete")
$Results += Run-Stress "audit-lazy" "$LV audit https://unsplash.com --wcag --label $RunId-lazy" 0 60 (Assert-JsonKey "audits\$RunId-lazy-*.json" "wcag.score")

# ===== 8. High contrast mode =====
Write-Host "`n[8/10] High contrast mode" -ForegroundColor Yellow
$Results += [PSCustomObject]@{ Name = "high-contrast"; Status = "SKIP"; Detail = "Requires OS-level setting" }
$SkipCount++

# ===== 9. Slow network =====
Write-Host "`n[9/10] Slow network" -ForegroundColor Yellow
$Results += [PSCustomObject]@{ Name = "slow-network"; Status = "SKIP"; Detail = "No --throttle flag yet" }
$SkipCount++

# ===== 10. Massive JSON =====
Write-Host "`n[10/10] Large recording JSON" -ForegroundColor Yellow
$Results += Run-Stress "record-long" "$LV record https://www.apple.com --duration 15000 --label $RunId-long" 0 120 (Assert-OutputMatch "Recording complete")

# ===== Summary =====
$Elapsed = (Get-Date) - $StartTime
Write-Host "`n$("=" * 60)" -ForegroundColor Cyan
Write-Host "  STRESS TEST RESULTS ($RunId)" -ForegroundColor Cyan
Write-Host "$("=" * 60)" -ForegroundColor Cyan

foreach ($r in $Results) {
  $color = switch ($r.Status) {
    "PASS"   { "Green" }
    "FAIL"   { "Red" }
    "SKIP"   { "Yellow" }
    "WARN"   { "Yellow" }
    "TIMEOUT"{ "Red" }
    default  { "White" }
  }
  $detail = if ($r.Detail) { " - $($r.Detail)" } else { "" }
  $msg = "  [{0,-7}] {1}{2}" -f $r.Status, $r.Name, $detail
  Write-Host $msg -ForegroundColor $color

  if ($r.Status -eq "PASS") { $PassCount++ }
  elseif ($r.Status -eq "FAIL" -or $r.Status -eq "TIMEOUT") { $FailCount++ }
  elseif ($r.Status -eq "SKIP") { $SkipCount++ }
  elseif ($r.Status -eq "WARN") { $WarnCount++ }
}

Write-Host "$("=" * 60)" -ForegroundColor Cyan
Write-Host "  Elapsed: $($Elapsed.Minutes)m $($Elapsed.Seconds)s" -ForegroundColor Cyan
$overall = if ($FailCount -eq 0) { "GREEN" } else { "RED" }
Write-Host "  Overall: $overall  |  Pass: $PassCount  |  Fail: $FailCount  |  Skip: $SkipCount  |  Warn: $WarnCount" -ForegroundColor $(if ($FailCount -eq 0) { "Green" } else { "Red" })

# Cleanup
if (-not $KeepArtifacts) {
  Write-Host "`nCleaning up artifacts..." -ForegroundColor DarkGray
  foreach ($dir in @("audits", "extracts", "screenshots", "recordings")) {
    $items = Get-ChildItem -Path "$ProjectRoot\$dir" -Filter "$RunId-*" -ErrorAction SilentlyContinue
    foreach ($item in $items) { Remove-Item -LiteralPath $item.FullName -Recurse -Force -ErrorAction SilentlyContinue }
  }
}

if ($FailCount -gt 0) { exit 1 }
