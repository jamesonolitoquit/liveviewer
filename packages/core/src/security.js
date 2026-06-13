function parseCsp(csp) {
  var result = { hasDefaultSrc: false, defaultSrcAllowsAll: false, hasUnsafeInline: false, hasUnsafeEval: false, hasFetchDirectives: false, hasBaseUri: false, hasFormAction: false };
  if (!csp) return result;
  var fetchDirs = ['default-src', 'script-src', 'style-src', 'img-src', 'connect-src', 'font-src', 'frame-src', 'media-src', 'object-src', 'manifest-src', 'worker-src'];
  var directives = csp.split(';');
  for (var di = 0; di < directives.length; di++) {
    var dir = directives[di].trim();
    var parts = dir.split(/\s+/);
    if (parts.length === 0) continue;
    var name = parts[0].toLowerCase();
    var values = parts.slice(1).join(' ');
    if (fetchDirs.indexOf(name) !== -1) {
      result.hasFetchDirectives = true;
    }
    if (name === 'default-src') {
      result.hasDefaultSrc = true;
      if (values.trim() === '*') result.defaultSrcAllowsAll = true;
    }
    if (name === 'script-src') {
      if (values.indexOf("'unsafe-inline'") !== -1) result.hasUnsafeInline = true;
      if (values.indexOf("'unsafe-eval'") !== -1) result.hasUnsafeEval = true;
    }
    if (name === 'base-uri') result.hasBaseUri = true;
    if (name === 'form-action') result.hasFormAction = true;
  }
  return result;
}

function parsePermissionsPolicy(pp) {
  if (!pp) return { missing: true, hasStar: false };
  var features = pp.split(',');
  for (var fi = 0; fi < features.length; fi++) {
    var feature = features[fi].trim();
    var parenStart = feature.indexOf('(');
    if (parenStart === -1) continue;
    var value = feature.slice(parenStart + 1, feature.lastIndexOf(')'));
    if (value && value.trim() === '*') return { missing: false, hasStar: true };
  }
  return { missing: false, hasStar: false };
}

function isValidReferrerPolicy(value) {
  var valid = ['', 'strict-origin-when-cross-origin', 'strict-origin', 'same-origin', 'no-referrer', 'origin-when-cross-origin', 'origin', 'unsafe-url', 'no-referrer-when-downgrade'];
  return valid.indexOf(value.toLowerCase()) !== -1;
}

async function runSecurityChecks(page, context, url, responseHeaders) {
  var results = [];

  var isPrivate = /^https?:\/\/(localhost|127\.0\.0\.1|::1|0\.0\.0\.0)([:\/]|$)/i.test(url);
  if (isPrivate) return results;

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

  // 2. Strict-Transport-Security (tiered severity)
  var hsts = responseHeaders['strict-transport-security'] || '';
  var hstsMatch = hsts.match(/max-age=(\d+)/i);
  if (!hsts || !hstsMatch) {
    results.push({
      ruleId: 'hsts',
      ruleName: 'HTTP Strict-Transport-Security should be set',
      category: 'security',
      selector: 'response',
      description: 'Missing Strict-Transport-Security header',
      severity: 'high',
      value: 'missing',
      expected: 'max-age=\u2265 31536000; includeSubDomains'
    });
  } else if (parseInt(hstsMatch[1], 10) < 31536000) {
    results.push({
      ruleId: 'hsts',
      ruleName: 'HSTS max-age is shorter than recommended',
      category: 'security',
      selector: 'response',
      description: 'Strict-Transport-Security max-age is ' + hstsMatch[1] + ', minimum recommended is 31536000',
      severity: 'medium',
      value: 'max-age=' + hstsMatch[1],
      expected: 'max-age=\u2265 31536000'
    });
  }
  if (hstsMatch && hsts.indexOf('includeSubDomains') === -1) {
    results.push({
      ruleId: 'hsts',
      ruleName: 'HSTS should include includeSubDomains',
      category: 'security',
      selector: 'response',
      description: 'Strict-Transport-Security is missing includeSubDomains directive; subdomains remain unprotected',
      severity: 'medium',
      value: 'includeSubDomains missing',
      expected: 'max-age=\u2265 31536000; includeSubDomains'
    });
  }

  // 3. Content-Security-Policy (content validation)
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
  } else {
    var cspParsed = parseCsp(csp);
    if (cspParsed.defaultSrcAllowsAll) {
      results.push({
        ruleId: 'csp',
        ruleName: 'CSP default-src is too permissive',
        category: 'security',
        selector: 'response',
        description: 'Content-Security-Policy has default-src * which bypasses all protections',
        severity: 'medium',
        value: 'default-src *',
        expected: 'default-src \'self\' or more restrictive'
      });
      } else if (!cspParsed.hasFetchDirectives) {
      results.push({
        ruleId: 'csp',
        ruleName: 'CSP lacks default-src directive',
        category: 'security',
        selector: 'response',
        description: 'Content-Security-Policy is present but has no default-src directive',
        severity: 'low',
        value: 'no default-src',
        expected: 'default-src \'self\' or more restrictive'
      });
    }
    if (cspParsed.hasUnsafeInline) {
      results.push({
        ruleId: 'csp',
        ruleName: 'CSP should not allow unsafe-inline in script-src',
        category: 'security',
        selector: 'response',
        description: 'Content-Security-Policy allows \'unsafe-inline\' in script-src, which bypasses CSP protections for inline scripts',
        severity: 'medium',
        value: 'unsafe-inline present',
        expected: 'nonce-, hash-, or \'strict-dynamic\' based CSP'
      });
    }
    if (cspParsed.hasUnsafeEval) {
      results.push({
        ruleId: 'csp',
        ruleName: 'CSP should not allow unsafe-eval in script-src',
        category: 'security',
        selector: 'response',
        description: 'Content-Security-Policy allows \'unsafe-eval\' in script-src, which allows eval() execution',
        severity: 'low',
        value: 'unsafe-eval present',
        expected: 'no \'unsafe-eval\' in script-src'
      });
    }
    if (!cspParsed.hasBaseUri) {
      results.push({
        ruleId: 'csp',
        ruleName: 'CSP should include base-uri directive',
        category: 'security',
        selector: 'response',
        description: 'Content-Security-Policy is missing base-uri directive, which prevents base tag injection attacks',
        severity: 'low',
        value: 'base-uri missing',
        expected: 'base-uri \'self\' or similar'
      });
    }
    if (!cspParsed.hasFormAction) {
      results.push({
        ruleId: 'csp',
        ruleName: 'CSP should include form-action directive',
        category: 'security',
        selector: 'response',
        description: 'Content-Security-Policy is missing form-action directive, which helps prevent form-jacking attacks',
        severity: 'low',
        value: 'form-action missing',
        expected: 'form-action \'self\' or similar'
      });
    }
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

  // 6. Referrer-Policy (content validation)
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
  } else if (rp.toLowerCase() === 'unsafe-url') {
    results.push({
      ruleId: 'referrer-policy',
      ruleName: 'Referrer-Policy should not be unsafe-url',
      category: 'security',
      selector: 'response',
      description: 'Referrer-Policy is unsafe-url which leaks the full URL to all origins',
      severity: 'medium',
      value: 'unsafe-url',
      expected: 'strict-origin-when-cross-origin or similar'
    });
  } else if (rp.toLowerCase() === 'no-referrer-when-downgrade') {
    results.push({
      ruleId: 'referrer-policy',
      ruleName: 'Referrer-Policy is set to browser default',
      category: 'security',
      selector: 'response',
      description: 'Referrer-Policy is no-referrer-when-downgrade (browser default); consider strict-origin-when-cross-origin',
      severity: 'info',
      value: 'no-referrer-when-downgrade',
      expected: 'strict-origin-when-cross-origin or similar'
    });
  }

  // 7. Permissions-Policy (content validation)
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
  } else {
    var ppParsed = parsePermissionsPolicy(pp);
    if (ppParsed.hasStar) {
      results.push({
        ruleId: 'permissions-policy',
        ruleName: 'Permissions-Policy allows all origins for some features',
        category: 'security',
        selector: 'response',
        description: 'Permissions-Policy allows * for at least one feature; use restricted origins instead',
        severity: 'low',
        value: 'features with * allowed',
        expected: 'restricted feature policies'
      });
    }
  }

  // 8. Cross-Origin-Opener-Policy
  var coop = responseHeaders['cross-origin-opener-policy'] || '';
  var validCoop = ['same-origin', 'same-origin-allow-popups', 'unsafe-none'];
  if (!coop) {
    results.push({
      ruleId: 'cross-origin-opener-policy',
      ruleName: 'Cross-Origin-Opener-Policy should be set',
      category: 'security',
      selector: 'response',
      description: 'Missing Cross-Origin-Opener-Policy header',
      severity: 'low',
      value: 'missing',
      expected: 'same-origin or same-origin-allow-popups'
    });
  } else if (coop.toLowerCase() !== 'same-origin' && coop.toLowerCase() !== 'same-origin-allow-popups') {
    results.push({
      ruleId: 'cross-origin-opener-policy',
      ruleName: 'COOP should be same-origin or same-origin-allow-popups',
      category: 'security',
      selector: 'response',
      description: 'Cross-Origin-Opener-Policy is "' + coop + '", expected same-origin or same-origin-allow-popups',
      severity: 'low',
      value: coop,
      expected: 'same-origin or same-origin-allow-popups'
    });
  }

  // 9. Cross-Origin-Embedder-Policy
  var coep = responseHeaders['cross-origin-embedder-policy'] || '';
  if (!coep) {
    results.push({
      ruleId: 'cross-origin-embedder-policy',
      ruleName: 'Cross-Origin-Embedder-Policy should be set',
      category: 'security',
      selector: 'response',
      description: 'Missing Cross-Origin-Embedder-Policy header',
      severity: 'low',
      value: 'missing',
      expected: 'require-corp'
    });
  } else if (coep.toLowerCase() !== 'require-corp') {
    results.push({
      ruleId: 'cross-origin-embedder-policy',
      ruleName: 'COEP should be require-corp',
      category: 'security',
      selector: 'response',
      description: 'Cross-Origin-Embedder-Policy is "' + coep + '", expected require-corp',
      severity: 'low',
      value: coep,
      expected: 'require-corp'
    });
  }

  // 10. Cross-Origin-Resource-Policy
  var corp = responseHeaders['cross-origin-resource-policy'] || '';
  if (!corp) {
    results.push({
      ruleId: 'cross-origin-resource-policy',
      ruleName: 'Cross-Origin-Resource-Policy should be set',
      category: 'security',
      selector: 'response',
      description: 'Missing Cross-Origin-Resource-Policy header',
      severity: 'low',
      value: 'missing',
      expected: 'same-origin or same-site'
    });
  }

  // 11. Expect-CT
  var ect = responseHeaders['expect-ct'] || '';
  if (!ect) {
    results.push({
      ruleId: 'expect-ct',
      ruleName: 'Expect-CT should be set (deprecated but recommended for legacy)',
      category: 'security',
      selector: 'response',
      description: 'Missing Expect-CT header',
      severity: 'info',
      value: 'missing',
      expected: 'max-age=86400, enforce'
    });
  }

  // 12. Mixed content (only when served over HTTPS)
  if (isHttps) {
    try {
      var mcResults = await page.evaluate(() => {
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

  // 13. Secure cookies
  var setCookieRaw = responseHeaders['set-cookie'] || '';
  var setCookieArr = Array.isArray(setCookieRaw) ? setCookieRaw : (setCookieRaw ? [setCookieRaw] : []);
  for (var si = 0; si < setCookieArr.length; si++) {
    var sc = setCookieArr[si];
    if (!sc) continue;
    var cookieName = (sc.split('=')[0] || '').trim();
    var hasSecure = sc.indexOf('Secure') !== -1;
    var hasHttpOnly = sc.indexOf('HttpOnly') !== -1;
    var hasSameSite = sc.indexOf('SameSite') !== -1;
    var sameSiteNone = sc.indexOf('SameSite=None') !== -1;
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
    if (!hasSameSite) {
      results.push({
        ruleId: 'secure-cookies',
        ruleName: 'Cookies should have SameSite attribute',
        category: 'security',
        selector: 'cookie:' + cookieName,
        description: 'Cookie "' + cookieName + '" missing SameSite attribute; set SameSite=Lax for CSRF protection',
        severity: 'low',
        value: 'SameSite missing',
        expected: 'SameSite=Lax or SameSite=Strict'
      });
    } else if (sameSiteNone) {
      results.push({
        ruleId: 'secure-cookies',
        ruleName: 'SameSite=None requires Secure flag',
        category: 'security',
        selector: 'cookie:' + cookieName,
        description: 'Cookie "' + cookieName + '" uses SameSite=None but may miss pre-requisites; ensure Secure flag and cross-site use is intentional',
        severity: 'info',
        value: 'SameSite=None',
        expected: 'SameSite=Lax or SameSite=Strict for most cookies'
      });
    }
  }

  try {
    var cookies = await context.cookies();
    for (var ck of cookies) {
      if (!ck.secure || !ck.httpOnly) {
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
