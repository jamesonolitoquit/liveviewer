const MIN_TOUCH_TARGET = 24;
const RECOMMENDED_TOUCH_TARGET = 44;
const REFLOW_WIDTH = 320;
const MOBILE_BREAKPOINT = 768;

async function runMobileChecks(page, viewport) {
  var isMobile = viewport && viewport.width <= MOBILE_BREAKPOINT;
  var results = [];

  if (isMobile) {
    results.push(...await checkTouchTargets(page));
    results.push(...await checkTapSpacing(page));
    results.push(...await checkViewportZoom(page));
  }

  results.push(...await checkOrientationLock(page));
  results.push(...await checkReflow(page, viewport));
  results.push(...await checkMobileFontSize(page));

  return results;
}

async function checkTouchTargets(page) {
  return await page.evaluate(function(opts) {
    var minTouch = opts.minTouch;
    var recTouch = opts.recTouch;
    var res = [];
    var targets = document.querySelectorAll(
      'a[href], button, input[type="submit"], input[type="button"], input[type="reset"], ' +
      'input[type="checkbox"], input[type="radio"], select, textarea, ' +
      '[role="button"], [role="link"], [role="tab"], [role="menuitem"], ' +
      '[onclick], [tabindex]:not([tabindex="-1"])'
    );
    var seen = new Set();
    for (var i = 0; i < targets.length; i++) {
      var el = targets[i];
      var rect = el.getBoundingClientRect();
      var w = Math.round(rect.width);
      var h = Math.round(rect.height);
      var tag = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className ? '.' + el.className.split(' ')[0] : '');
      var key = tag + '|' + w + 'x' + h;
      if (seen.has(key)) continue;
      seen.add(key);
      if (w < recTouch || h < recTouch) {
        var sev = (w < minTouch || h < minTouch) ? 'medium' : 'low';
        var desc = (w < minTouch || h < minTouch)
          ? 'Touch target ' + tag + ' is ' + w + 'x' + h + 'px — below minimum 24x24px (WCAG 2.5.8)'
          : 'Touch target ' + tag + ' is ' + w + 'x' + h + 'px — below recommended 44x44px (WCAG 2.5.8)';
        res.push({
          ruleId: 'touch-target-size',
          ruleName: 'Touch targets should be at least 24x24px (44x44px recommended)',
          category: 'mobile',
          selector: tag,
          description: desc,
          severity: sev,
          value: w + 'x' + h + 'px',
          expected: '>=' + recTouch + 'x' + recTouch + 'px'
        });
      }
    }
    return res;
  }, { minTouch: MIN_TOUCH_TARGET, recTouch: RECOMMENDED_TOUCH_TARGET });
}

async function checkTapSpacing(page) {
  return await page.evaluate(function() {
    var res = [];
    var targets = document.querySelectorAll(
      'a[href], button, input[type="submit"], input[type="button"], input[type="reset"], ' +
      '[role="button"], [role="link"]'
    );
    for (var i = 0; i < targets.length; i++) {
      var a = targets[i];
      var ra = a.getBoundingClientRect();
      for (var j = i + 1; j < targets.length; j++) {
        var b = targets[j];
        var rb = b.getBoundingClientRect();
        if (ra.left >= rb.right || ra.right <= rb.left || ra.top >= rb.bottom || ra.bottom <= rb.top) continue;
        var overlapW = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        var overlapH = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (overlapW < 0 || overlapH < 0) continue;
        var gapX = Math.max(0, Math.max(ra.left, rb.left) - Math.min(ra.right, rb.right));
        var gapY = Math.max(0, Math.max(ra.top, rb.top) - Math.min(ra.bottom, rb.bottom));
        var hasGap = gapX > 0 || gapY > 0;
        if (!hasGap && overlapW > 0 && overlapH > 0) {
          var tagA = a.tagName.toLowerCase() + (a.id ? '#' + a.id : '');
          var tagB = b.tagName.toLowerCase() + (b.id ? '#' + b.id : '');
          res.push({
            ruleId: 'tap-spacing',
            ruleName: 'Touch targets should not overlap',
            category: 'mobile',
            selector: tagA + ', ' + tagB,
            description: 'Touch targets ' + tagA + ' and ' + tagB + ' overlap (' + overlapW + 'x' + overlapH + 'px)',
            severity: 'medium',
            value: 'overlapping targets',
            expected: 'minimum 4px gap between touch targets'
          });
        }
      }
    }
    return res;
  });
}

async function checkViewportZoom(page) {
  return await page.evaluate(function() {
    var res = [];
    var meta = document.querySelector('meta[name="viewport"]');
    if (meta) {
      var content = (meta.getAttribute('content') || '').toLowerCase();
      if (content.indexOf('user-scalable=no') !== -1 || content.indexOf('user-scalable=0') !== -1) {
        res.push({
          ruleId: 'viewport-zoom',
          ruleName: 'Viewport should allow user zoom',
          category: 'mobile',
          selector: 'meta[name="viewport"]',
          description: 'Viewport meta tag disables zoom with user-scalable=no, preventing users from resizing text',
          severity: 'high',
          value: 'user-scalable=no',
          expected: 'user-scalable=yes or omit user-scalable'
        });
      }
      if (content.indexOf('maximum-scale=1') !== -1 || content.indexOf('maximum-scale=1.0') !== -1) {
        res.push({
          ruleId: 'viewport-zoom',
          ruleName: 'Viewport should not restrict maximum scale',
          category: 'mobile',
          selector: 'meta[name="viewport"]',
          description: 'Viewport meta tag sets maximum-scale=1, preventing pinch-to-zoom',
          severity: 'medium',
          value: 'maximum-scale=1',
          expected: 'maximum-scale >= 2 or omit maximum-scale'
        });
      }
    }
    return res;
  });
}

async function checkOrientationLock(page) {
  return await page.evaluate(function() {
    var res = [];
    var orientationLocked = false;

    var stylesheets = document.querySelectorAll('style');
    for (var si = 0; si < stylesheets.length; si++) {
      var text = stylesheets[si].textContent || '';
      if (/(orientation|rotate)\s*:/.test(text) && /lock|portrait|landscape/.test(text)) {
        orientationLocked = true;
      }
    }

    var screenLocked = window.screen &&
      window.screen.orientation &&
      window.screen.orientation.type &&
      window.screen.orientation.type.indexOf('landscape') !== -1 &&
      document.querySelector('meta[name="x-ua-compatible"]');
    if (screenLocked) orientationLocked = true;

    if (orientationLocked) {
      res.push({
        ruleId: 'orientation-lock',
        ruleName: 'Page should not lock screen orientation',
        category: 'mobile',
        selector: 'style, script',
        description: 'Page locks screen orientation or uses orientation API — fails WCAG 1.3.4 (Orientation)',
        severity: 'medium',
        value: 'orientation lock detected',
        expected: 'page works in both portrait and landscape'
      });
    }
    return res;
  });
}

async function checkReflow(page, viewport) {
  var isNarrow = viewport && viewport.width <= MOBILE_BREAKPOINT;
  if (!isNarrow) return [];

  var originalSize = viewport;
  var reflowViewport = { width: REFLOW_WIDTH, height: originalSize.height };

  try {
    await page.setViewportSize(reflowViewport);
    await page.evaluate(function() { return new Promise(function(resolve) { requestAnimationFrame(function() { setTimeout(resolve, 300); }); }); });

    var results = await page.evaluate(function() {
      var res = [];
      var scrollW = Math.max(
        document.documentElement.scrollWidth,
        document.body ? document.body.scrollWidth : 0,
        document.documentElement.offsetWidth,
        document.body ? document.body.offsetWidth : 0
      );
      var winW = window.innerWidth;
      if (scrollW > winW + 1) {
        res.push({
          ruleId: 'reflow',
          ruleName: 'Content should not require horizontal scrolling at 320px width',
          category: 'mobile',
          selector: 'html',
          description: 'Page requires horizontal scrolling at 320px viewport width (' + scrollW + 'px content vs ' + winW + 'px viewport) — fails WCAG 1.4.10 Reflow',
          severity: 'high',
          value: scrollW + 'px content width',
          expected: 'content <= ' + winW + 'px at 320px viewport'
        });
      }
      return res;
    });

    await page.setViewportSize(originalSize);
    await page.evaluate(function() { return new Promise(function(resolve) { requestAnimationFrame(function() { setTimeout(resolve, 200); }); }); });

    return results;
  } catch (e) {
    try { await page.setViewportSize(originalSize); } catch (_) {}
    return [];
  }
}

async function checkMobileFontSize(page) {
  return await page.evaluate(function() {
    var res = [];
    var bodyText = document.querySelectorAll('p, li, span, div, a, button, label, input, textarea, select, h1, h2, h3, h4, h5, h6');
    var seen = new Set();
    for (var i = 0; i < bodyText.length; i++) {
      var el = bodyText[i];
      var cs = window.getComputedStyle(el);
      var fs = parseFloat(cs.fontSize);
      if (isNaN(fs) || fs === 0) continue;
      var tag = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className ? '.' + el.className.split(' ')[0] : '');
      var key = tag + '|' + fs;
      if (seen.has(key)) continue;
      seen.add(key);
      if (fs < 12 && el.tagName.match(/^(P|LI|SPAN|DIV|A|BUTTON|LABEL|INPUT|TEXTAREA|SELECT)$/)) {
        res.push({
          ruleId: 'mobile-font-size',
          ruleName: 'Body text should be at least 12px on mobile',
          category: 'mobile',
          selector: tag,
          description: 'Text element ' + tag + ' has font-size ' + fs + 'px — too small for mobile readability',
          severity: 'medium',
          value: fs + 'px',
          expected: '>= 12px'
        });
      }
    }
    return res;
  });
}

module.exports = { runMobileChecks, checkTouchTargets, checkTapSpacing, checkViewportZoom, checkOrientationLock, checkReflow, checkMobileFontSize };
