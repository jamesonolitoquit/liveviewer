/**
 * Security audit logic.
 * runSecurityChecks(page, context, url, responseHeaders) -> Promise<Array>
 * Handles header checks, mixed content (via page.evaluate), and cookies (via context.cookies).
 */

async function runSecurityChecks(page, context, url, responseHeaders) {
  var results = [];

  // Determine effective protocol
  var isHttps = url.indexOf('https://') === 0 || (responseHeaders['x-forwarded-proto'] || '').toLowerCase() === 'https';

  // 1. HTTPS enforcement
  if (!isHttps) {
    results.push({
      ruleId: 'https-enforced',
      ruleName: 'HTTPS should be enforced',
      category: 'security',
      selector: 'page',
      description: 'Page is served over HTTP instead of HTTPS',
      severity: 'high',
      value: 'http:// protocol',
      expected: 'https:// protocol'
    });
  }

  // 2. Strict-Transport-Security
  var hsts = responseHeaders['strict-transport-security'] || '';
  var hstsMatch = hsts.match(/max-age=(\d+)/i);
  if (!hsts || !hstsMatch || parseInt(hstsMatch[1], 10) < 31536000) {
    results.push({
      ruleId: 'hsts',
      ruleName: 'HTTP Strict-Transport-Security should be set',
      category: 'security',
      selector: 'response',
      description: !hsts
        ? 'Missing Strict-Transport-Security header'
        : 'Strict-Transport-Security max-age is ' + hstsMatch[1] + ', minimum recommended is 31536000',
      severity: 'high',
      value: hsts || 'missing',
      expected: 'max-age=\u2265 31536000; includeSubDomains'
    });
  }

  // 3. Content-Security-Policy
  var csp = responseHeaders['content-security-policy'] || '';
  if (!csp) {
    results.push({
      ruleId: 'csp',
      ruleName: 'Content-Security-Policy should be set',
      category: 'security',
      selector: 'response',
      description: 'Missing Content-Security-Policy header',
      severity: 'medium',
      value: 'missing',
      expected: 'default-src \'self\' or more restrictive'
    });
  }

  // 4. X-Frame-Options
  var xfo = (responseHeaders['x-frame-options'] || '').toUpperCase();
  if (xfo !== 'DENY' && xfo !== 'SAMEORIGIN') {
    results.push({
      ruleId: 'x-frame-options',
      ruleName: 'X-Frame-Options should be DENY or SAMEORIGIN',
      category: 'security',
      selector: 'response',
      description: !xfo
        ? 'Missing X-Frame-Options header'
        : 'X-Frame-Options is "' + xfo + '", expected DENY or SAMEORIGIN',
      severity: 'medium',
      value: xfo || 'missing',
      expected: 'DENY or SAMEORIGIN'
    });
  }

  // 5. X-Content-Type-Options
  var xcto = (responseHeaders['x-content-type-options'] || '').toLowerCase();
  if (xcto !== 'nosniff') {
    results.push({
      ruleId: 'x-content-type-options',
      ruleName: 'X-Content-Type-Options should be nosniff',
      category: 'security',
      selector: 'response',
      description: !xcto
        ? 'Missing X-Content-Type-Options header'
        : 'X-Content-Type-Options is "' + xcto + '", expected nosniff',
      severity: 'medium',
      value: xcto || 'missing',
      expected: 'nosniff'
    });
  }

  // 6. Referrer-Policy
  var rp = responseHeaders['referrer-policy'] || '';
  if (!rp) {
    results.push({
      ruleId: 'referrer-policy',
      ruleName: 'Referrer-Policy should be set',
      category: 'security',
      selector: 'response',
      description: 'Missing Referrer-Policy header',
      severity: 'low',
      value: 'missing',
      expected: 'strict-origin-when-cross-origin or similar'
    });
  }

  // 7. Permissions-Policy
  var pp = responseHeaders['permissions-policy'] || '';
  if (!pp) {
    results.push({
      ruleId: 'permissions-policy',
      ruleName: 'Permissions-Policy should be set',
      category: 'security',
      selector: 'response',
      description: 'Missing Permissions-Policy header',
      severity: 'low',
      value: 'missing',
      expected: 'geolocation=(), microphone=(), etc.'
    });
  }

  // 8. Mixed content (only when served over HTTPS)
  if (isHttps) {
    try {
      var mcResults = await page.evaluate(function() {
        var res = [];
        var httpResources = [];
        var tags = ['img', 'script', 'link', 'iframe', 'source', 'video', 'audio', 'object', 'embed'];
        for (var t = 0; t < tags.length; t++) {
          var sel = tags[t] + '[src], ' + tags[t] + '[href]';
          var els = document.querySelectorAll(sel);
          for (var i = 0; i < els.length; i++) {
            var el = els[i];
            var attr = el.src ? 'src' : 'href';
            var val = el.getAttribute(attr) || el[attr] || '';
            if (val.indexOf('http://') === 0) {
              httpResources.push(tags[t] + '[' + attr + '="' + val.slice(0, 60) + '"]');
            }
          }
        }
        if (httpResources.length > 0) {
          res.push({
            ruleId: 'mixed-content',
            ruleName: 'Page should not load HTTP resources over HTTPS',
            category: 'security',
            selector: 'page',
            description: 'Found ' + httpResources.length + ' HTTP resource(s) on HTTPS page: ' + httpResources.join(', ').slice(0, 100),
            severity: 'high',
            value: httpResources.length + ' HTTP resource(s)',
            expected: '0 HTTP resources'
          });
        }
        return res;
      });
      results = results.concat(mcResults);
    } catch (_) {}
  }

  // 9. Secure cookies — check raw Set-Cookie response headers
  var setCookieRaw = responseHeaders['set-cookie'] || '';
  var setCookieArr = Array.isArray(setCookieRaw) ? setCookieRaw : (setCookieRaw ? [setCookieRaw] : []);
  for (var si = 0; si < setCookieArr.length; si++) {
    var sc = setCookieArr[si];
    if (!sc) continue;
    var cookieName = (sc.split('=')[0] || '').trim();
    var hasSecure = sc.indexOf('Secure') !== -1;
    var hasHttpOnly = sc.indexOf('HttpOnly') !== -1;
    if (!hasSecure || !hasHttpOnly) {
      results.push({
        ruleId: 'secure-cookies',
        ruleName: 'Cookies should have Secure and HttpOnly flags',
        category: 'security',
        selector: 'cookie:' + cookieName,
        description: 'Cookie "' + cookieName + '" missing ' + (!hasSecure ? 'Secure' : 'HttpOnly') + ' flag in Set-Cookie header',
        severity: 'high',
        value: 'Secure=' + hasSecure + ' HttpOnly=' + hasHttpOnly,
        expected: 'Secure=true HttpOnly=true'
      });
    }
  }

  // Also check via context.cookies() as secondary verification (for real browser behavior)
  try {
    var cookies = await context.cookies();
    for (var ck of cookies) {
      if (!ck.secure || !ck.httpOnly) {
        // Only add if not already flagged by raw header check
        var alreadyFlagged = false;
        for (var ri = 0; ri < results.length; ri++) {
          if (results[ri].ruleId === 'secure-cookies' && results[ri].selector === 'cookie:' + ck.name) {
            alreadyFlagged = true;
            break;
          }
        }
        if (!alreadyFlagged) {
          results.push({
            ruleId: 'secure-cookies',
            ruleName: 'Cookies should have Secure and HttpOnly flags',
            category: 'security',
            selector: 'cookie:' + ck.name,
            description: 'Cookie "' + ck.name + '" missing ' + (!ck.secure ? 'Secure' : 'HttpOnly') + ' flag',
            severity: 'high',
            value: 'Secure=' + !!ck.secure + ' HttpOnly=' + !!ck.httpOnly,
            expected: 'Secure=true HttpOnly=true'
          });
        }
      }
    }
  } catch (_) {}

  return results;
}

module.exports = { runSecurityChecks };
