const { record, screenshot } = require('./recorder');
const { analyzeRecording, generateReport, extractFramesFromVideo } = require('./analyzer');
const { compareImages, compareFrameSequence } = require('./diff');
const { startServer } = require('./mcp');
const { audit } = require('./auditor');
const { extract, checkBrandViolations, normalizeColor } = require('./extractor');
const { recommend } = require('./recommender');
const { renderHtml } = require('./report');
const { crawl } = require('./crawler');

module.exports = {
  record,
  screenshot,
  analyzeRecording,
  generateReport,
  extractFramesFromVideo,
  compareImages,
  compareFrameSequence,
  startMcpServer: startServer,
  audit,
  extract,
  checkBrandViolations,
  normalizeColor,
  recommend,
  renderHtml,
  crawl
};
