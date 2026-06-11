async function runLegalChecks(page) {
  return page.evaluate(() => {
    var results = [];
    var text = document.body ? document.body.innerText || '' : '';
    var html = document.documentElement ? document.documentElement.innerHTML || '' : '';
    var lowText = text.toLowerCase();
    var lowHtml = html.toLowerCase();

    // 1. Cookie consent
    var cookieSelectors = [
      '#cookie-banner', '#cookie-consent', '#cookie-notice', '.cookie-banner',
      '.cookie-consent', '.cookie-notice', '.cc-banner', '.cc-window',
      '[class*="cookie"]', '[id*="cookie"]', '[class*="Cookie"]', '[id*="Cookie"]',
      '#gdpr-banner', '.gdpr-banner', '#gdpr-consent', '.gdpr-consent',
      '#notice-bar', '.notice-bar', '#consent-banner', '.consent-banner'
    ];
    var found = false;
    for (var ci = 0; ci < cookieSelectors.length; ci++) {
      if (document.querySelector(cookieSelectors[ci])) { found = true; break; }
    }
    if (!found) {
      // Fallback: look for text patterns
      var cookiePatterns = [
        'cookie', 'cookies', 'this site uses', 'we use cookies',
        'accept cookies', 'cookie policy', 'cookie notice',
        'gdpr', 'consent to cookies'
      ];
      for (var ti = 0; ti < cookiePatterns.length; ti++) {
        if (lowText.indexOf(cookiePatterns[ti]) !== -1) { found = true; break; }
      }
    }
    if (!found) {
      results.push({
        ruleId: 'cookie-consent', ruleName: 'Cookie consent banner should be present',
        category: 'legal', selector: 'body',
        description: 'No cookie consent banner or notice detected on the page',
        severity: 'medium', value: 'not found', expected: 'cookie consent mechanism present'
      });
    }

    // 2. Privacy policy link
    var privacyFound = false;
    var links = document.querySelectorAll('a[href*="privacy"], a[href*="privacy-policy"], a[href*="privacy" i]');
    if (links.length > 0) { privacyFound = true; }
    if (!privacyFound) {
      var anchors = document.querySelectorAll('a');
      for (var ai = 0; ai < anchors.length; ai++) {
        var a = anchors[ai];
        var linkText = (a.textContent || '').toLowerCase();
        if (linkText.indexOf('privacy') !== -1) { privacyFound = true; break; }
      }
    }
    if (!privacyFound) {
      results.push({
        ruleId: 'privacy-policy', ruleName: 'Privacy policy link should be present',
        category: 'legal', selector: 'body',
        description: 'No link to privacy policy found on the page',
        severity: 'medium', value: 'not found', expected: 'link to privacy policy'
      });
    }

    // 3. Imprint / Impressum link
    var imprintFound = false;
    var imprintTerms = ['imprint', 'impressum', 'legal notice', 'legal mention'];
    var anchors2 = document.querySelectorAll('a');
    for (var bi = 0; bi < anchors2.length; bi++) {
      var b = anchors2[bi];
      var bText = (b.textContent || '').toLowerCase();
      var bHref = (b.getAttribute('href') || '').toLowerCase();
      for (var ti = 0; ti < imprintTerms.length; ti++) {
        if (bText.indexOf(imprintTerms[ti]) !== -1 || bHref.indexOf(imprintTerms[ti]) !== -1) {
          imprintFound = true; break;
        }
      }
      if (imprintFound) break;
    }
    if (!imprintFound) {
      results.push({
        ruleId: 'imprint', ruleName: 'Imprint / Impressum link should be present',
        category: 'legal', selector: 'body',
        description: 'No link to imprint or impressum found on the page',
        severity: 'low', value: 'not found', expected: 'link to imprint/impressum'
      });
    }

    // 4. Terms of service link
    var tosFound = false;
    var tosTerms = ['terms of service', 'terms & conditions', 'terms and conditions', 'terms of use', 'tos', 't&c'];
    var anchors3 = document.querySelectorAll('a');
    for (var ci = 0; ci < anchors3.length; ci++) {
      var c = anchors3[ci];
      var cText = (c.textContent || '').toLowerCase();
      var cHref = (c.getAttribute('href') || '').toLowerCase();
      for (var ti = 0; ti < tosTerms.length; ti++) {
        if (cText.indexOf(tosTerms[ti]) !== -1 || cHref.indexOf(tosTerms[ti]) !== -1) {
          tosFound = true; break;
        }
      }
      if (tosFound) break;
    }
    if (!tosFound) {
      results.push({
        ruleId: 'terms-of-service', ruleName: 'Terms of service link should be present',
        category: 'legal', selector: 'body',
        description: 'No link to terms of service found on the page',
        severity: 'low', value: 'not found', expected: 'link to terms of service'
      });
    }

    // 5. Data collection notice (heuristic)
    var dataNoticeTerms = [
      'we collect', 'your data', 'personal data', 'personal information',
      'data protection', 'data collection', 'we store', 'your information',
      'how we use your', 'data privacy', 'information we collect'
    ];
    var dataFound = false;
    for (var ti = 0; ti < dataNoticeTerms.length; ti++) {
      if (lowText.indexOf(dataNoticeTerms[ti]) !== -1 || lowHtml.indexOf(dataNoticeTerms[ti]) !== -1) {
        dataFound = true; break;
      }
    }
    if (!dataFound) {
      results.push({
        ruleId: 'data-collection-notice', ruleName: 'Data collection notice should be present',
        category: 'legal', selector: 'body',
        description: 'No data collection / privacy notice text detected',
        severity: 'info', value: 'not found', expected: 'text about data collection or privacy'
      });
    }

    return { failures: results, totalChecks: 5 };
  });
}

module.exports = { runLegalChecks };
