const pixelmatchMod = require('pixelmatch');
const pixelmatch = pixelmatchMod.default || pixelmatchMod;
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function compareImages(imgAPath, imgBPath, options = {}) {
  const threshold = options.threshold || 0.1;
  const alpha = options.alpha !== undefined ? options.alpha : 0.3;
  const diffOutput = options.diffOutput || null;

  const { data: dataA, info: infoA } = await sharp(imgAPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data: dataB, info: infoB } = await sharp(imgBPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (infoA.width !== infoB.width || infoA.height !== infoB.height) {
    const maxW = Math.max(infoA.width, infoB.width);
    const maxH = Math.max(infoA.height, infoB.height);
    const resizedA = await sharp(imgAPath).ensureAlpha().resize(maxW, maxH).raw().toBuffer();
    const resizedB = await sharp(imgBPath).ensureAlpha().resize(maxW, maxH).raw().toBuffer();
    const diffBuf = Buffer.alloc(maxW * maxH * 4);
    const mismatched = pixelmatch(resizedA, resizedB, diffBuf, maxW, maxH, {
      threshold,
      alpha,
      includeAA: true
    });
    if (diffOutput) {
      await sharp(diffBuf, { raw: { width: maxW, height: maxH, channels: 4 } })
        .png()
        .toFile(diffOutput);
    }
    const totalPixels = maxW * maxH;
    return {
      mismatchedPixels: mismatched,
      totalPixels,
      mismatchPercent: Math.round((mismatched / totalPixels) * 10000) / 100,
      width: maxW,
      height: maxH,
      resized: true
    };
  }

  const diffBuf = Buffer.alloc(infoA.width * infoA.height * 4);
  const mismatched = pixelmatch(dataA, dataB, diffBuf, infoA.width, infoA.height, {
    threshold,
    alpha,
    includeAA: true
  });

  if (diffOutput) {
    const diffDir = path.dirname(diffOutput);
    fs.mkdirSync(diffDir, { recursive: true });
    await sharp(diffBuf, { raw: { width: infoA.width, height: infoA.height, channels: 4 } })
      .png()
      .toFile(diffOutput);
  }

  const totalPixels = infoA.width * infoA.height;
  return {
    mismatchedPixels: mismatched,
    totalPixels,
    mismatchPercent: Math.round((mismatched / totalPixels) * 10000) / 100,
    width: infoA.width,
    height: infoA.height,
    resized: false
  };
}

async function compareFrameSequence(frames, options = {}) {
  const results = [];
  for (let i = 1; i < frames.length; i++) {
    const diffOpts = {
      ...options,
      diffOutput: options.diffDir
        ? path.join(options.diffDir, `diff_${String(i - 1).padStart(5, '0')}.png`)
        : null
    };
    const result = await compareImages(frames[i - 1], frames[i], diffOpts);
    results.push({
      frameA: i - 1,
      frameB: i,
      ...result
    });
  }
  return results;
}

module.exports = { compareImages, compareFrameSequence };
