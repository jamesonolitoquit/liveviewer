const { record, screenshot } = require('./recorder');
const { analyzeRecording, generateReport, extractFramesFromVideo } = require('./analyzer');
const { compareImages, compareFrameSequence } = require('./diff');
const { startServer } = require('./mcp');

module.exports = {
  record,
  screenshot,
  analyzeRecording,
  generateReport,
  extractFramesFromVideo,
  compareImages,
  compareFrameSequence,
  startMcpServer: startServer
};
