const { compareFrameSequence } = require('./diff');
const path = require('path');
const fs = require('fs');
const { execSync, exec } = require('child_process');

async function analyzeRecording(output, options = {}) {
  const {
    extractFrames = true,
    fps = 10,
    compareFrames = true,
    diffDir = null,
    diffThreshold = 0.1,
    maxFrames = 100
  } = options;

  if (!output.videoPath || !fs.existsSync(output.videoPath)) {
    throw new Error('Video file not found at: ' + output.videoPath);
  }

  const recordingDir = path.dirname(output.videoPath);
  const framesDir = path.join(recordingDir, 'frames');
  const diffsDir = diffDir || path.join(recordingDir, 'diffs');

  const result = {
    ...output,
    analysis: {
      frames: [],
      diffs: [],
      metrics: output.metrics || {}
    }
  };

  if (extractFrames) {
    const extracted = await extractFramesFromVideo(output.videoPath, framesDir, fps, maxFrames);
    result.analysis.frames = extracted;
  }

  if (compareFrames && result.analysis.frames.length > 1) {
    fs.mkdirSync(diffsDir, { recursive: true });
    const diffs = await compareFrameSequence(result.analysis.frames, {
      threshold: diffThreshold,
      diffDir: diffsDir
    });
    result.analysis.diffs = diffs;

    const totalMismatch = diffs.reduce((sum, d) => sum + d.mismatchPercent, 0);
    const avgMismatch = diffs.length > 0 ? totalMismatch / diffs.length : 0;
    const maxMismatch = diffs.length > 0 ? Math.max(...diffs.map(d => d.mismatchPercent)) : 0;

    result.analysis.aggregate = {
      totalFramePairs: diffs.length,
      avgMismatchPercent: Math.round(avgMismatch * 100) / 100,
      maxMismatchPercent: Math.round(maxMismatch * 100) / 100,
      totalDiffsGenerated: diffs.filter(d => d.mismatchPercent > 0).length
    };
  }

  const metaPath = path.join(recordingDir, `${output.tag}-analysis.json`);
  fs.writeFileSync(metaPath, JSON.stringify(result, null, 2));

  return result;
}

async function extractFramesFromVideo(videoPath, outputDir, fps = 10, maxFrames = 100) {
  fs.mkdirSync(outputDir, { recursive: true });

  const ffmpeg = findFfmpeg();
  if (!ffmpeg) {
    throw new Error(
      'FFmpeg not found. Install FFmpeg (https://ffmpeg.org) or add it to PATH.'
    );
  }

  const pattern = path.join(outputDir, 'frame_%05d.png');

  const cmd = `"${ffmpeg}" -i "${videoPath}" -vf "fps=${fps}" -frames:v ${maxFrames} "${pattern}" -y -loglevel error`;

  execSync(cmd, { timeout: 60000, stdio: 'pipe', shell: true, windowsHide: true });

  const frames = fs.readdirSync(outputDir)
    .filter(f => f.startsWith('frame_') && f.endsWith('.png'))
    .sort()
    .map(f => path.join(outputDir, f));

  return frames;
}

function findFfmpeg() {
  try {
    const cmd = process.platform === 'win32'
      ? 'where ffmpeg 2>nul'
      : 'which ffmpeg 2>/dev/null';
    const result = execSync(cmd, {
      encoding: 'utf-8',
      timeout: 5000,
      windowsHide: true
    });
    const trimmed = result.trim().split('\n')[0].trim();
    if (trimmed) return trimmed;
  } catch (e) {}

  try {
    const ff = require('ffmpeg-static');
    if (ff) return ff;
  } catch (e) {}

  return null;
}

async function generateReport(analysisResult, options = {}) {
  const report = [];

  report.push('=== Liveviewer Visual Analysis Report ===');
  report.push(`URL: ${analysisResult.url}`);
  report.push(`Duration: ${analysisResult.duration}ms`);
  report.push(`Viewport: ${analysisResult.viewport.width}x${analysisResult.viewport.height}`);
  report.push('');

  if (analysisResult.analysis.metrics) {
    const m = analysisResult.analysis.metrics;
    report.push('--- Frame Timing Metrics ---');
    report.push(`Total frames captured: ${m.totalFrames}`);
    report.push(`Recording duration: ${Math.round(m.duration)}ms`);
    report.push(`Mean frame delta: ${m.meanDelta}ms (target: 16.6ms for 60fps)`);
    report.push(`Max frame delta: ${m.maxDelta}ms`);
    report.push(`Jank frames (>50ms): ${m.jankFrames} (${m.jankRate}%)`);
    report.push(`Smoothness score: ${m.smoothnessScore}/100`);
    report.push('');
  }

  if (analysisResult.analysis.aggregate) {
    const a = analysisResult.analysis.aggregate;
    report.push('--- Visual Diff Analysis ---');
    report.push(`Frame pairs compared: ${a.totalFramePairs}`);
    report.push(`Average visual change: ${a.avgMismatchPercent}%`);
    report.push(`Maximum visual change: ${a.maxMismatchPercent}%`);
    report.push(`Frames with changes detected: ${a.totalDiffsGenerated}`);
    report.push('');
  }

  if (analysisResult.analysis.frames.length > 0) {
    report.push(`Frames extracted: ${analysisResult.analysis.frames.length}`);
    report.push(`Frames directory: ${path.dirname(analysisResult.analysis.frames[0])}`);
  }

  if (analysisResult.analysis.diffs.length > 0) {
    report.push(`Diff images: ${analysisResult.analysis.diffs.length}`);
  }

  report.push('');

  const totalIssues = (analysisResult.analysis.metrics?.jankFrames || 0);
  const avgMismatch = analysisResult.analysis.aggregate?.avgMismatchPercent || 0;

  if (totalIssues > 0 || avgMismatch > 10) {
    report.push('⚠ Issues detected:');
    if (analysisResult.analysis.metrics?.jankFrames > 0) {
      report.push(`  - ${analysisResult.analysis.metrics.jankFrames} janky frames detected`);
    }
    if (avgMismatch > 10) {
      report.push(`  - High visual volatility (${avgMismatch}% avg change between frames)`);
    }
  } else {
    report.push('✓ No significant issues detected.');
  }

  const reportText = report.join('\n');

  const reportPath = path.join(
    path.dirname(analysisResult.videoPath || '.'),
    `${analysisResult.tag}-report.txt`
  );
  fs.writeFileSync(reportPath, reportText);

  return { report: reportText, reportPath };
}

module.exports = { analyzeRecording, extractFramesFromVideo, generateReport };
