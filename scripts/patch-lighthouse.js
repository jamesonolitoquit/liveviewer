const fs = require('fs');
const path = require('path');

const files = [
  {
    file: 'node_modules/lighthouse/report/generator/report-assets.js',
    replacements: [
      { from: "const REPORT_TEMPLATE = fs.readFileSync(moduleDir", to: "const REPORT_TEMPLATE = readFileSafe(moduleDir" },
      { from: "const REPORT_JAVASCRIPT = fs.readFileSync(moduleDir", to: "const REPORT_JAVASCRIPT = readFileSafe(moduleDir" },
    ],
    helper: true
  },
  {
    file: 'node_modules/lighthouse/report/generator/flow-report-assets.js',
    replacements: [
      { from: "const FLOW_REPORT_TEMPLATE = fs.readFileSync(", to: "const FLOW_REPORT_TEMPLATE = readFileSafe(" },
      { from: "const REGULAR_REPORT_CSS = fs.readFileSync(", to: "const REGULAR_REPORT_CSS = readFileSafe(" },
      { from: "const FLOW_REPORT_CSS = fs.readFileSync(", to: "const FLOW_REPORT_CSS = readFileSafe(" },
      { from: "const FLOW_REPORT_JAVASCRIPT = fs.readFileSync(", to: "const FLOW_REPORT_JAVASCRIPT = readFileSafe(" },
    ],
    helper: true
  }
];

const helperCode = `
function readFileSafe(relativePath) {
  try {
    return fs.readFileSync(relativePath, 'utf8');
  } catch {
    return '';
  }
}
`;

for (const { file, replacements, helper } of files) {
  const filePath = path.join(__dirname, '..', file);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${file}: not found`);
    continue;
  }
  let content = fs.readFileSync(filePath, 'utf8');

  let modified = false;
  for (const { from, to } of replacements) {
    if (content.includes(from)) {
      content = content.replace(from, to);
      modified = true;
    }
  }

  if (modified && helper) {
    content = content.replace(
      'const moduleDir = getModuleDirectory(import.meta);',
      'const moduleDir = getModuleDirectory(import.meta);\n' + helperCode.trim()
    );
  }

  if (modified) {
    content = content.replace(/, 'utf8'/g, '');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Patched ${file}`);
  } else {
    console.log(`Already patched or no changes needed: ${file}`);
  }
}
