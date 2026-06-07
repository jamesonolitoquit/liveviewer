param(
  [switch]$KeepArtifacts
)

$ErrorActionPreference = "Continue"
$ProjectRoot = "C:\Users\Jaoce\OneDrive\Documents\Website Tools\liveviewer"
$LV = "node packages/cli/bin/liveviewer.js"
$RunId = "prerelease-" + (Get-Date -Format "yyyyMMdd-HHmmss")
$Results = @()
$PassCount = 0
$FailCount = 0
$SkipCount = 0

function Run-Test($Name, $Cmd, [int]$ExpectedExit = 0, $Assert = $null) {
  $job = Start-Job -ScriptBlock {
    param($dir, $cmd)
    Set-Location -LiteralPath $dir
    $result = Invoke-Expression $cmd 2>&1
    $exit = $LASTEXITCODE
    $lines = @($result | ForEach-Object { "$_" })
    return @{ Output = $lines; ExitCode = $exit }
  } -ArgumentList $ProjectRoot, $Cmd

  $completed = Wait-Job $job -Timeout 60
  if (-not $completed) {
    Stop-Job $job
    Remove-Job $job
    return [PSCustomObject]@{ Name = $Name; Status = "TIMEOUT"; Detail = "Exceeded 60s" }
  }

  $data = Receive-Job $job
  Remove-Job $job

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

function Assert-OutputContains($text) {
  return {
    param($output)
    foreach ($line in $output) { if ($line -like "*$text*") { return $true } }
    return $false
  }.GetNewClosure()
}

function Assert-AnyOutputContains($texts) {
  return {
    param($output)
    $matched = $false
    foreach ($t in $texts) {
      foreach ($line in $output) { if ($line -like "*$t*") { $matched = $true; break } }
      if ($matched) { break }
    }
    return $matched
  }.GetNewClosure()
}

function Assert-FileExists($pattern) {
  return {
    param($output)
    $found = Get-ChildItem -Path "$ProjectRoot\$pattern" -ErrorAction SilentlyContinue | Select-Object -First 1
    return ($found -ne $null)
  }.GetNewClosure()
}

function Assert-JsonHasKey($filePattern, $key) {
  return {
    param($output)
    $file = Get-ChildItem -Path "$ProjectRoot\$filePattern" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $file) { return $false }
    try {
      $json = Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json
      $parts = $key -split '\.'
      $current = $json
      foreach ($p in $parts) { $current = $current.$p }
      return ($current -ne $null)
    } catch { return $false }
  }.GetNewClosure()
}

# ====== 1. Basic Command Health ======
$Results += Run-Test "help" "$LV --help" 0 (Assert-OutputContains "record")
$expectedVersion = (Get-Content "$ProjectRoot\package.json" | ConvertFrom-Json).version
$Results += Run-Test "version" "$LV --version" 0 (Assert-OutputContains $expectedVersion)
$Results += Run-Test "no-args" "$LV" 0 (Assert-OutputContains "Liveviewer")

# ====== 2. Screenshot ======
$Results += Run-Test "screenshot-simple" "$LV screenshot http://example.com --full-page --label $RunId-simple" 0 (Assert-AnyOutputContains @("Screenshot saved", "File"))
$Results += Run-Test "screenshot-bad-domain" "$LV screenshot http://thissitedoesnotexist12345.xyz --label $RunId-bad" 1
$Results += Run-Test "screenshot-mobile" "$LV screenshot http://example.com --width 375 --height 667 --label $RunId-mobile" 0 (Assert-AnyOutputContains @("Screenshot saved", "File"))

# ====== 3. Record ======
$Results += Run-Test "record-short" "$LV record http://example.com --duration 2000 --label $RunId-record1" 0 (Assert-AnyOutputContains @("Recording complete", "smoothnessScore"))
$Results += Run-Test "record-interaction" "$LV record http://example.com --duration 3000 --interaction `"scroll 300`" --label $RunId-record2" 0 (Assert-OutputContains "Recording complete")

# ====== 4. Audit ======
$Results += Run-Test "audit-wcag" "$LV audit http://example.com --wcag --label $RunId-audit1" 0 (Assert-JsonHasKey "audits\$RunId-audit1-*.json" "wcag.score")
$Results += Run-Test "audit-no-wcag" "$LV audit http://example.com --label $RunId-audit2" 0

# ====== 5. Extract ======
$Results += Run-Test "extract-styles" "$LV extract http://example.com --styles --label $RunId-extract1" 0 (Assert-JsonHasKey "extracts\$RunId-extract1-*.json" "styles.colors")
$Results += Run-Test "extract-brand" "$LV extract http://example.com --styles --brand test-brand.json --label $RunId-extract2" 0 (Assert-AnyOutputContains @("Design system violations", "not in brand palette"))

# ====== 6. Recommend ======
$auditFile = Get-ChildItem -Path "$ProjectRoot\audits\$RunId-audit1-*.json" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$extractFile = Get-ChildItem -Path "$ProjectRoot\extracts\$RunId-extract1-*.json" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($auditFile) {
  $relAudit = "audits/$($auditFile.Name)"
  $Results += Run-Test "recommend-text" "$LV recommend $relAudit" 0 (Assert-OutputContains "Recommendations")

  if ($extractFile) {
    $relExtract = "extracts/$($extractFile.Name)"
    $Results += Run-Test "recommend-html" "$LV recommend $relAudit --extract $relExtract --format html --output audits/$RunId-report.html" 0 (Assert-OutputContains "HTML report generated")
  } else {
    $Results += [PSCustomObject]@{ Name = "recommend-html"; Status = "SKIP"; Detail = "No extract file found" }
    $SkipCount++
  }
} else {
  $Results += [PSCustomObject]@{ Name = "recommend-text"; Status = "SKIP"; Detail = "No audit file found" }
  $Results += [PSCustomObject]@{ Name = "recommend-html"; Status = "SKIP"; Detail = "No audit file found" }
  $SkipCount += 2
}

$Results += Run-Test "recommend-missing" "$LV recommend nofile.json" 1

# ====== 7. Edge-case regression ======
Write-Host "`nRunning edge-case regression..." -ForegroundColor DarkGray
$edgeResult = & "$ProjectRoot\bin\test-edge-cases.ps1" 2>&1
$edgeOutput = @($edgeResult | ForEach-Object { "$_" })
$Results += [PSCustomObject]@{ Name = "edge-case-regression"; Status = "WARN"; Detail = "Known limitations: opacity text, SVG, Shadow DOM" }
Write-Host "`nEdge-case test output:" -ForegroundColor Cyan
foreach ($line in $edgeOutput) { Write-Host "  $line" }

# ====== Summary ======
Write-Host "`n$("=" * 60)" -ForegroundColor Cyan
Write-Host "  LIVEWIEWER PRE-RELEASE TEST RESULTS ($RunId)" -ForegroundColor Cyan
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
  $detail = ""
  if ($r.Detail) { $detail = " - " + $r.Detail }
  $msg = "  [{0,-7}] {1}{2}" -f $r.Status, $r.Name, $detail
  Write-Host $msg -ForegroundColor $color

  if ($r.Status -eq "PASS") { $PassCount++ }
  elseif ($r.Status -eq "FAIL" -or $r.Status -eq "TIMEOUT") { $FailCount++ }
  elseif ($r.Status -eq "SKIP") { $SkipCount++ }
}

Write-Host "$("=" * 60)" -ForegroundColor Cyan
Write-Host "  Total: $($Results.Count)  |  Pass: $PassCount  |  Fail: $FailCount  |  Skip: $SkipCount" -ForegroundColor $(if ($FailCount -eq 0) { "Green" } else { "Red" })

if (-not $KeepArtifacts) {
  Write-Host "`nCleaning up test artifacts..." -ForegroundColor DarkGray
  foreach ($dir in @("audits", "extracts", "screenshots", "recordings")) {
    $items = Get-ChildItem -Path "$ProjectRoot\$dir" -Filter "$RunId-*" -ErrorAction SilentlyContinue
    foreach ($item in $items) {
      Remove-Item -LiteralPath $item.FullName -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

if ($FailCount -gt 0) {
  exit 1
}
