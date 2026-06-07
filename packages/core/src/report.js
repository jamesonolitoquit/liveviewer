const fs = require('fs');
const path = require('path');

function renderHtml(auditData, options = {}) {
  const { extractData, output } = options;
  const tplPath = path.join(__dirname, '..', 'templates', 'report.hbs');
  let html = fs.readFileSync(tplPath, 'utf-8');

  const wcag = auditData.wcag || {};
  const passCount = wcag.passCount || 0;
  const totalElements = wcag.totalElements || 0;
  const failCount = wcag.failCount || 0;
  const score = wcag.score || 0;
  const scoreClass = score >= 90 ? 'good' : score >= 70 ? 'ok' : 'bad';
  const failClass = failCount > 0 ? 'severity-high' : '';

  html = replaceAll(html, '{{url}}', escHtml(auditData.url || ''));
  html = replaceAll(html, '{{score}}', score);
  html = replaceAll(html, '{{scoreClass}}', scoreClass);
  html = replaceAll(html, '{{passCount}}', passCount);
  html = replaceAll(html, '{{totalElements}}', totalElements);
  html = replaceAll(html, '{{failCount}}', failCount);
  html = replaceAll(html, '{{failClass}}', failClass);
  html = replaceAll(html, '{{date}}', new Date().toISOString().replace('T', ' ').slice(0, 19));

  // Failures section
  let failuresHtml = '';
  if (wcag.failures && wcag.failures.length > 0) {
    let rows = '';
    for (const f of wcag.failures) {
      const sevClass = f.contrastRatio < 3 ? 'severity-high' : 'severity-medium';
      const label = f.contrastRatio < 3 ? 'HIGH' : 'MEDIUM';
      rows += '<tr>';
      rows += `<td style="max-width:240px;overflow:hidden;text-overflow:ellipsis;" title="${escAttr(f.selector)}">${escHtml(f.selector)}</td>`;
      rows += `<td class="${sevClass}">${f.contrastRatio}:1 ${label}</td>`;
      rows += `<td>${f.required}:1</td>`;
      rows += `<td><code>${escHtml(f.foreground)}</code></td>`;
      rows += `<td><code>${escHtml(f.background)}</code></td>`;
      rows += `<td>${escHtml((f.text || '').slice(0, 80))}</td>`;
      rows += '</tr>';
    }
    failuresHtml = `<section>
  <h2>Contrast Failures <span class="badge badge-fail">${failCount} issues</span></h2>
  <div style="overflow-x:auto;">
  <table>
    <thead><tr><th>Element</th><th>Ratio</th><th>Required</th><th>Foreground</th><th>Background</th><th>Text</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  </div>
</section>`;
  }
  html = replaceAll(html, '{{failuresSection}}', failuresHtml);

  // Violations section
  const violations = (extractData && extractData.violations) || null;
  let violationsHtml = '';
  if (violations && (violations.colors.length > 0 || violations.fonts.length > 0)) {
    const totalViolations = violations.colors.length + violations.fonts.length;
    let body = '';

    if (violations.colors.length > 0) {
      body += `<h3 style="font-size:0.875rem;font-weight:600;margin:0 0 0.75rem;">Colors</h3>`;
      for (const c of violations.colors) {
        body += `<div class="violation-item"><p><strong>${escHtml(c.value)}</strong> used <strong>${c.count}x</strong> — not in brand palette</p>`;
        body += `<div class="rec">${escHtml(c.recommendation)}`;
        if (c.selectors && c.selectors.length > 0) {
          body += ` — e.g. <code>${escHtml(c.selectors[0])}</code>`;
        }
        body += `</div></div>`;
      }
    }

    if (violations.fonts.length > 0) {
      body += `<h3 style="font-size:0.875rem;font-weight:600;margin:1rem 0 0.75rem;">Fonts</h3>`;
      for (const f of violations.fonts) {
        body += `<div class="violation-item"><p><strong>"${escHtml(f.value)}"</strong> used <strong>${f.count}x</strong> — not in approved list</p>`;
        body += `<div class="rec">${escHtml(f.recommendation)}</div></div>`;
      }
    }

    violationsHtml = `<section>
  <h2>Design System Violations <span class="badge badge-warn">${totalViolations} issues</span></h2>
  ${body}
</section>`;
  }
  html = replaceAll(html, '{{violationsSection}}', violationsHtml);

  // Screenshot section
  const screenshotPath = auditData.filepath || '';
  let screenshotHtml = '';
  if (screenshotPath) {
    screenshotHtml = `<section>
  <h2>Screenshot</h2>
  <img class="screenshot" src="${escAttr(screenshotPath)}" alt="Audit screenshot" />
</section>`;
  }
  html = replaceAll(html, '{{screenshotSection}}', screenshotHtml);

  // Write output
  const outputPath = output
    ? path.resolve(output)
    : path.join(
        path.dirname(path.resolve(auditData.filepath || 'audit.json')),
        'report.html'
      );

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html, 'utf-8');
  return outputPath;
}

function replaceAll(str, token, value) {
  return str.split(token).join(String(value));
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = { renderHtml };