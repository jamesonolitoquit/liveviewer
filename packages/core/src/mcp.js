const readline = require('readline');
const { record, screenshot } = require('./recorder');
const { analyzeRecording, generateReport } = require('./analyzer');

const TOOLS = [
  {
    name: 'liveviewer_record',
    description: 'Record a live website and capture frame-by-frame timing data at true 60fps resolution. Returns JSON with: tag (unique id), url, duration, viewport, metrics (totalFrames, meanDelta, maxDelta, jankFrames, jankRate, smoothnessScore 0-100), videoPath, metadataPath. Use when asked to "record a page", "check animation smoothness", "measure performance", or "detect jank". Accepts optional interactions array for click/hover/type/scroll before recording.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to record' },
        duration: { type: 'number', description: 'Recording duration in milliseconds (default: 5000)', default: 5000 },
        width: { type: 'number', description: 'Viewport width (default: 1280)', default: 1280 },
        height: { type: 'number', description: 'Viewport height (default: 800)', default: 800 },
        label: { type: 'string', description: 'A label for this recording', default: 'recording' },
        headless: { type: 'boolean', description: 'Run headless (default: true)', default: true },
        interactions: { type: 'array', description: 'Array of interaction objects performed before recording: {type:"click"|"hover"|"type"|"scroll"|"wait"|"screenshot", selector?, x?, y?, text?, ms?}', items: { type: 'object' } }
      },
      required: ['url']
    }
  },
  {
    name: 'liveviewer_screenshot',
    description: 'Take a high-quality full-page or element-level screenshot with performance metadata. Returns JSON with: filepath, metrics (url, title, lcp in ms or null, imageCount, brokenImages, missingAlt). Use when asked to "take a screenshot", "capture a page", "check images", or "audit design". Optionally pass a CSS selector to screenshot a specific element.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to screenshot' },
        width: { type: 'number', description: 'Viewport width (default: 1280)', default: 1280 },
        height: { type: 'number', description: 'Viewport height (default: 800)', default: 800 },
        fullPage: { type: 'boolean', description: 'Capture full page (default: true)', default: true },
        label: { type: 'string', description: 'A label for this screenshot', default: 'shot' },
        selector: { type: 'string', description: 'CSS selector for element-level screenshot (optional). Captures only that element if provided.' }
      },
      required: ['url']
    }
  },
  {
    name: 'liveviewer_analyze',
    description: 'Analyze a previous recording by extracting and diffing frames from the captured video. Returns a plain-text report with: frame timing metrics (totalFrames, meanDelta, jankFrames, smoothnessScore), visual diff analysis (avgMismatchPercent, maxMismatchPercent), and any detected issues. Use after liveviewer_record to get frame-by-frame visual regression data. The recordingTag comes from the "tag" field of liveviewer_record result.',
    inputSchema: {
      type: 'object',
      properties: {
        recordingTag: { type: 'string', description: 'The tag of a previous recording (from the "tag" field of liveviewer_record result)' },
        fps: { type: 'number', description: 'Frames per second to extract from video (default: 10). Higher = more granular but slower.', default: 10 },
        maxFrames: { type: 'number', description: 'Maximum number of frames to extract (default: 100)', default: 100 },
        threshold: { type: 'number', description: 'pixelmatch sensitivity threshold 0-1 where 0 = exact match (default: 0.1). Higher = less sensitive to small changes.', default: 0.1 }
      },
      required: ['recordingTag']
    }
  }
];

function sendMessage(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function handleRequest(msg) {
  const id = msg.id;
  const method = msg.method;
  const params = msg.params || {};

  switch (method) {
    case 'initialize': {
      sendMessage({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '0.1.0',
          capabilities: {
            tools: {},
            resources: {}
          },
          serverInfo: {
            name: 'liveviewer',
            version: '0.1.0'
          }
        }
      });
      break;
    }

    case 'tools/list': {
      sendMessage({
        jsonrpc: '2.0',
        id,
        result: { tools: TOOLS }
      });
      break;
    }

    case 'tools/call': {
      handleToolCall(id, params.name, params.arguments || {});
      break;
    }

    case 'notifications/initialized': {
      break;
    }

    default: {
      sendMessage({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` }
      });
    }
  }
}

async function handleToolCall(id, toolName, args) {
  try {
    switch (toolName) {
      case 'liveviewer_record': {
        const result = await record(args.url, {
          duration: args.duration || 5000,
          viewport: { width: args.width || 1280, height: args.height || 800 },
          label: args.label || 'recording',
          headless: args.headless !== false,
          interactions: args.interactions || []
        });
        sendMessage({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify({
                tag: result.tag,
                url: result.url,
                duration: result.duration,
                viewport: result.viewport,
                metrics: result.metrics,
                videoPath: result.videoPath,
                metadataPath: `recordings/${result.tag}.json`
              }, null, 2)
            }]
          }
        });
        break;
      }

      case 'liveviewer_screenshot': {
        const result = await screenshot(args.url, {
          viewport: { width: args.width || 1280, height: args.height || 800 },
          fullPage: args.fullPage !== false,
          label: args.label || 'shot',
          selector: args.selector || null
        });
        sendMessage({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify({
                filepath: result.filepath,
                metrics: result.metrics,
                metadataPath: `screenshots/${result.filename.replace('.png', '.json')}`
              }, null, 2)
            }]
          }
        });
        break;
      }

      case 'liveviewer_analyze': {
        const metaPath = `recordings/${args.recordingTag}.json`;
        if (!require('fs').existsSync(metaPath)) {
          throw new Error(`Recording metadata not found: ${metaPath}`);
        }
        const recordingData = JSON.parse(require('fs').readFileSync(metaPath, 'utf-8'));
        const analysis = await analyzeRecording(recordingData, {
          fps: args.fps || 10,
          maxFrames: args.maxFrames || 100,
          diffThreshold: args.threshold || 0.1
        });
        const report = await generateReport(analysis);
        sendMessage({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{
              type: 'text',
              text: report.report
            }]
          }
        });
        break;
      }

      default: {
        sendMessage({
          jsonrpc: '2.0',
          id,
          error: { code: -32602, message: `Unknown tool: ${toolName}` }
        });
      }
    }
  } catch (err) {
    sendMessage({
      jsonrpc: '2.0',
      id,
      error: { code: -32000, message: err.message }
    });
  }
}

function startServer() {
  const rl = readline.createInterface({ input: process.stdin });

  rl.on('line', (line) => {
    try {
      const msg = JSON.parse(line);
      handleRequest(msg);
    } catch (err) {
      console.error('Invalid JSON-RPC message:', line, err.message);
    }
  });

  rl.on('close', () => {
    process.exit(0);
  });

  process.stdin.on('end', () => {
    process.exit(0);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer, TOOLS };
