param(
  [string]$Url = "https://jaostudio.vercel.app",
  [int]$DurationMs = 4000,
  [string]$Label = "audit"
)

$liveviewer = "node C:\Users\Jaoce\liveviewer\bin\liveviewer.js"
$results = @{ url = $Url; timestamp = (Get-Date -Format "o"); tests = @{}; overall = "PASS" }

# ---- Test 1: Screenshot ----
$shotOut = Invoke-Expression "$liveviewer screenshot $Url --full-page --label ${Label}_shot"
$shotFile = ($shotOut | Select-String "File:\s+(.+)").Matches.Groups[1].Value.Trim()
$shotJsonPath = $shotFile -replace '\.png$', '.json'
if (Test-Path $shotJsonPath) {
  $shot = Get-Content $shotJsonPath -Raw | ConvertFrom-Json
  $results.tests.screenshot = @{
    title = $shot.metrics.title
    missingAltCount = $shot.metrics.missingAlt
    brokenImagesCount = $shot.metrics.brokenImages
    lcp = $shot.metrics.lcp
    imageCount = $shot.metrics.imageCount
    passed = ($shot.metrics.missingAlt -eq 0 -and $shot.metrics.brokenImages -eq 0)
  }
} else {
  $results.tests.screenshot = @{ error = "No metadata file found"; passed = $false }
}

# ---- Test 2: Record ----
$recOut = Invoke-Expression "$liveviewer record $Url --duration $DurationMs --interaction ""scroll 400"" --interaction ""wait 500"" --interaction ""hover nav a:first-child"" --interaction ""screenshot mid_scroll"" --label ${Label}_rec"
$recTag = ($recOut | Select-String "Tag:\s+(.+)").Matches.Groups[1].Value.Trim()
$recJsonPath = "C:\Users\Jaoce\liveviewer\recordings\$recTag.json"
if (Test-Path $recJsonPath) {
  $rec = Get-Content $recJsonPath -Raw | ConvertFrom-Json
  $results.tests.recording = @{
    smoothnessScore = $rec.metrics.smoothnessScore
    jankRate = $rec.metrics.jankRate
    meanFrameDelta = $rec.metrics.meanDelta
    maxFrameDelta = $rec.metrics.maxDelta
    jankFrames = $rec.metrics.jankFrames
    totalFrames = $rec.metrics.totalFrames
    recordingTag = $rec.tag
    passed = ($rec.metrics.smoothnessScore -ge 90 -and $rec.metrics.jankRate -le 5 -and $rec.metrics.meanDelta -le 20 -and $rec.metrics.maxDelta -le 100)
  }
} else {
  $results.tests.recording = @{ error = "No metadata file found"; passed = $false }
}

# ---- Test 3: Analyze ----
$anaOut = Invoke-Expression "$liveviewer analyze $recTag"
$anaJsonPath = "C:\Users\Jaoce\liveviewer\recordings\$recTag.json"
if (Test-Path $anaJsonPath) {
  $ana = Get-Content $anaJsonPath -Raw | ConvertFrom-Json
  if ($results.tests.recording.passed) {
    $scoreDiff = [math]::Abs($ana.metrics.smoothnessScore - $rec.metrics.smoothnessScore)
    $jankDiff = [math]::Abs($ana.metrics.jankRate - $rec.metrics.jankRate)
    $results.tests.analyze = @{
      smoothnessScore = $ana.metrics.smoothnessScore
      jankRate = $ana.metrics.jankRate
      meanFrameDelta = $ana.metrics.meanDelta
      maxFrameDelta = $ana.metrics.maxDelta
      scoreDeviation = [math]::Round($scoreDiff, 2)
      jankDeviation = [math]::Round($jankDiff, 2)
      passed = ($scoreDiff -le 2 -and $jankDiff -le 2)
    }
  } else {
    $results.tests.analyze = @{ skipped = "Recording failed, skipping consistency check"; passed = $true }
  }
} else {
  $results.tests.analyze = @{ error = "No metadata file found for analyze"; passed = $false }
}

# ---- Overall ----
$allPassed = $true
foreach ($t in $results.tests.PSObject.Properties.Value) { if (-not $t.passed) { $allPassed = $false } }
$results.overall = if ($allPassed) { "PASS" } else { "FAIL" }

$results | ConvertTo-Json -Depth 5
