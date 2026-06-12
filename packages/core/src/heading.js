function checkHeadingHierarchy(category) {
  var results = [];
  var seen = new Set();
  var headingEls = [];
  var all = document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]');
  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    if (seen.has(el)) continue;
    seen.add(el);
    var tag = el.tagName.toLowerCase();
    var level;
    if (tag.match(/^h[1-6]$/)) {
      level = parseInt(tag[1]);
    } else if (el.getAttribute('role') === 'heading') {
      var al = el.getAttribute('aria-level');
      level = al ? parseInt(al) : 2;
      if (isNaN(level) || level < 1 || level > 6) level = 2;
    } else {
      continue;
    }
    headingEls.push({ element: el, level: level });
  }
  var prevLevel = 0;
  var h1Count = 0;
  for (var i = 0; i < headingEls.length; i++) {
    var h = headingEls[i].element;
    var level = headingEls[i].level;
    if (level === 1) h1Count++;
    if (prevLevel > 0 && level > prevLevel + 1) {
      var tag = h.tagName.toLowerCase();
      var id = h.id ? '#' + h.id : '';
      var cls = typeof h.className === 'string' ? h.className : (h.getAttribute('class') || '');
      var clsStr = cls ? '.' + cls.trim().split(/\s+/).filter(Boolean).join('.') : '';
      results.push({
        ruleId: 'heading-hierarchy',
        ruleName: 'Heading hierarchy not skipped',
        category: category,
        selector: tag + id + clsStr,
        description: 'Heading level skipped from h' + prevLevel + ' to h' + level + ' (' + (h.textContent || '').trim().slice(0, 40) + ')',
        severity: 'medium',
        value: 'h' + prevLevel + ' \u2192 h' + level,
        expected: 'no skipped levels'
      });
    }
    prevLevel = level;
  }
  if (h1Count === 0) {
    results.push({
      ruleId: 'heading-hierarchy',
      ruleName: 'Page should have one h1',
      category: category,
      selector: 'body',
      description: 'No h1 element found on the page',
      severity: 'high',
      value: '0 h1 elements',
      expected: '1 h1 element'
    });
  } else if (h1Count > 1) {
    results.push({
      ruleId: 'heading-hierarchy',
      ruleName: 'Page should have exactly one h1',
      category: category,
      selector: 'body',
      description: 'Multiple h1 elements found (' + h1Count + ')',
      severity: 'medium',
      value: h1Count + ' h1 elements',
      expected: '1 h1 element'
    });
  }
  return results;
}

module.exports = { checkHeadingHierarchy };
