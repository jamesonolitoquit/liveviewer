async function runLegalChecks(page, context) {
  // Part 1: Browser-side checks (DOM + CMP APIs)
  var browserResults = await page.evaluate(function() {
    var results = [];
    var text = document.body ? document.body.innerText || '' : '';
    var lowText = text.toLowerCase();

    // --- Cookie consent (selectors + CMP APIs) ---
    var cookieSelectors = [
      '#cookie-banner', '#cookie-consent', '#cookie-notice', '.cookie-banner',
      '.cookie-consent', '.cookie-notice', '.cc-banner', '.cc-window',
      '[class*="cookie"]', '[id*="cookie"]', '[class*="Cookie"]', '[id*="Cookie"]',
      '#gdpr-banner', '.gdpr-banner', '#gdpr-consent', '.gdpr-consent',
      '#notice-bar', '.notice-bar', '#consent-banner', '.consent-banner',
      '#cn-banner', '.cn-banner', '#cmp-banner', '.cmp-banner',
      '.osano-cm-window', '#onetrust-banner', '.otCenterRounded',
      '#iubenda-cs-banner', '.iubenda-banner', '.fc-consent-root',
      '#didomi-popup', '.didomi-popup', '#tarteaucitronRoot',
      '#cookie-law-info-bar', '.cli-bar', '.cli-banner',
      '#cookies-eu-banner', '.cookies-eu-banner'
    ];
    var bannerFound = false;
    for (var ci = 0; ci < cookieSelectors.length; ci++) {
      if (document.querySelector(cookieSelectors[ci])) { bannerFound = true; break; }
    }
    if (!bannerFound) {
      var cookiePatterns = [
        'cookie', 'cookies', 'this site uses', 'we use cookies',
        'accept cookies', 'cookie policy', 'cookie notice',
        'gdpr', 'consent to cookies'
      ];
      for (var ti = 0; ti < cookiePatterns.length; ti++) {
        if (lowText.indexOf(cookiePatterns[ti]) !== -1) { bannerFound = true; break; }
      }
    }

    // CMP API detection (TCF 2.0, Cookiebot, OneTrust, Osano, iubenda, Didomi, CookieScript)
    var cmpFound = typeof window.__tcfapi !== 'undefined' ||
                   typeof window.Cookiebot !== 'undefined' ||
                   typeof window.OneTrust !== 'undefined' ||
                   typeof window.Osano !== 'undefined' ||
                   typeof window._iub !== 'undefined' ||
                   typeof window.didomiConfig !== 'undefined' ||
                   typeof window.UC_UI !== 'undefined' ||
                   typeof window.cookieconsent !== 'undefined' ||
                   typeof window.CookieConsent !== 'undefined';
    // Check for CMP wrapper DOM elements
    if (!cmpFound) {
      var cmpSelectors = [
        '#cmp', '.cmp-wrapper', '[data-cmp]',
        '.ot-sdk-show-settings', '#ot-sdk-btn',
        '#cookiescript_inject', '.cookiescript_inject',
        '#usercentrics-root', '.usercentrics-root',
        '#cookiebanner', '.consent-management'
      ];
      for (var si = 0; si < cmpSelectors.length; si++) {
        if (document.querySelector(cmpSelectors[si])) { cmpFound = true; break; }
      }
    }

    var hasConsent = bannerFound || cmpFound;
    if (!hasConsent) {
      results.push({
        ruleId: 'cookie-consent', ruleName: 'Cookie consent banner should be present',
        category: 'legal', selector: 'body',
        description: 'No cookie consent mechanism detected on the page',
        severity: 'medium', value: 'not found', expected: 'cookie consent mechanism present'
      });
    }

    // --- Consent revocation (Cookie Settings link) ---
    var revokeTerms = [
      'cookie settings', 'manage consent', 'cookie preferences',
      'consent preferences', 'change cookie settings', 'manage cookies',
      'cookie options', 'update consent', 'cookie choices',
      'parametres des cookies', 'gerer les cookies',
      'configuracion de cookies', 'gestionar cookies',
      'impostazioni dei cookie', 'gestisci cookie',
      'configuracoes de cookies', 'gerenciar cookies',
      'cookie-einstellungen', 'cookie-einstellung',
      'consentimiento de cookies'
    ];
    var revokeSelectors = [
      '#ot-sdk-btn', '.ot-sdk-show-settings',
      '#cookiescript_reopen', '.cookiescript_reopen',
      '.cc-revoke', '.cookie-settings',
      '[data-cc="c-settings"]', '#cn-revoke',
      '#cookie-settings', '.cookie_settings'
    ];
    var revokeFound = false;
    var allClickable = document.querySelectorAll('a, button, [role="button"], .cookie-settings, #cookie-settings');
    for (var ri = 0; ri < allClickable.length; ri++) {
      var ra = allClickable[ri];
      var rText = (ra.textContent || '').toLowerCase();
      for (var ti = 0; ti < revokeTerms.length; ti++) {
        if (rText.indexOf(revokeTerms[ti]) !== -1) { revokeFound = true; break; }
      }
      if (revokeFound) break;
    }
    if (!revokeFound) {
      for (var si = 0; si < revokeSelectors.length; si++) {
        if (document.querySelector(revokeSelectors[si])) { revokeFound = true; break; }
      }
    }
    if (!revokeFound) {
      results.push({
        ruleId: 'consent-revocation',
        ruleName: 'Cookie consent revocation should be possible',
        category: 'legal', selector: 'body',
        description: 'No "Cookie Settings" or consent management link found to allow users to change cookie preferences',
        severity: 'low', value: 'not found', expected: 'link or button to manage cookie consent'
      });
    }

    // --- Privacy policy link ---
    var privacyFound = false;
    var privacyLinks = document.querySelectorAll('a[href*="privacy" i], a[href*="datenschutz" i], a[href*="confidentialite" i], a[href*="privacidad" i]');
    if (privacyLinks.length > 0) { privacyFound = true; }
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

    // --- Imprint / Impressum (15 languages) ---
    var imprintTerms = [
      'imprint', 'impressum', 'legal notice', 'legal mention',
      'mentions legales', 'aviso legal', 'nota legal',
      'note legali', 'aviso legal',
      'juridische kennisgeving', 'informacja prawna',
      'juridiskt meddelande', 'juridisk meddelelse',
      'oikeudellinen huomautus', 'rechtliche hinweise'
    ];
    var imprintFound = false;
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

    // --- Terms of service (15+ languages) ---
    var tosTerms = [
      'terms of service', 'terms & conditions', 'terms and conditions',
      'terms of use', 'tos', 't&c',
      'conditions d\'utilisation', 'conditions generales',
      'terminos y condiciones', 'terminos del servicio',
      'termini e condizioni', 'termini del servizio',
      'termos de servico', 'termos e condicoes',
      'algemene voorwaarden', 'gebruiksvoorwaarden',
      'regulamin', 'warunki korzystania',
      'anvandarvillkor', 'vilkår og betingelser',
      'kayttoehdot',
      'allgemeine geschaftsbedingungen', 'allgemeine geschäftsbedingungen', 'agb', 'nutzungsbedingungen',
      'termen si conditii',
      'podmínky sluzby',
      'regulamin korzystania', 'warunki swiadczenia'
    ];
    var tosFound = false;
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

    // --- Data collection notice (tightened patterns) ---
    // Removed overly broad patterns: 'your data', 'your information', 'we collect', 'we store', 'privacy policy'
    // Keep specific data-processing phrases distinct from the privacy-policy link check
    var dataNoticeTerms = [
      'we collect personal', 'personal data', 'data protection',
      'how we use your data', 'how we use your information',
      'privacy statement', 'data privacy',
      'information we collect', 'data we collect',
      'we process your personal', 'we protect your data',
      'privacy notice', 'data processing',
      'we do not collect', 'we do not share your data'
    ];
    var dataFound = false;
    // Check footers and main content areas first (stronger signal)
    var privacyAreas = document.querySelectorAll('footer, main, [role="main"], #privacy, .privacy, [class*="privacy"], [id*="privacy"]');
    for (var pi = 0; pi < privacyAreas.length; pi++) {
      var areaText = (privacyAreas[pi].textContent || '').toLowerCase();
      for (var ti = 0; ti < dataNoticeTerms.length; ti++) {
        if (areaText.indexOf(dataNoticeTerms[ti]) !== -1) { dataFound = true; break; }
      }
      if (dataFound) break;
    }
    // Fallback: full page scan
    if (!dataFound) {
      for (var ti = 0; ti < dataNoticeTerms.length; ti++) {
        if (lowText.indexOf(dataNoticeTerms[ti]) !== -1) { dataFound = true; break; }
      }
    }
    if (!dataFound) {
      results.push({
        ruleId: 'data-collection-notice', ruleName: 'Data collection notice should be present',
        category: 'legal', selector: 'body',
        description: 'No data collection or privacy notice text detected',
        severity: 'info', value: 'not found', expected: 'text about data collection or privacy practices'
      });
    }

    return { failures: results, hasConsent: hasConsent };
  });

  // Part 2: Playwright cookie inspection
  try {
    var cookies = await context.cookies();
    var trackingPatterns = [
      '_ga', '_gid', '_fbp', '_clck', '_hj', '_pk',
      '_gcl', '_gali', '_pin', '_tt', '_tw',
      'ads_prefs', 'personalization_id', 'uid',
      '__utm', '_ga_', '_gac_'
    ];
    var trackingCookies = [];
    for (var ci = 0; ci < cookies.length; ci++) {
      var c = cookies[ci];
      var cLow = c.name.toLowerCase();
      for (var ti = 0; ti < trackingPatterns.length; ti++) {
        if (cLow.indexOf(trackingPatterns[ti]) !== -1) {
          trackingCookies.push(c.name);
          break;
        }
      }
    }
    // If tracking cookies exist WITHOUT any consent mechanism, escalate severity
    if (trackingCookies.length > 0 && !browserResults.hasConsent) {
      var existing = false;
      for (var fi = 0; fi < browserResults.failures.length; fi++) {
        if (browserResults.failures[fi].ruleId === 'cookie-consent') {
          browserResults.failures[fi].severity = 'high';
          browserResults.failures[fi].description = 'No consent mechanism found but ' + trackingCookies.length + ' tracking cookie(s) detected (' + trackingCookies.join(', ').slice(0, 80) + ')';
          existing = true;
          break;
        }
      }
      if (!existing) {
        browserResults.failures.push({
          ruleId: 'cookie-consent', ruleName: 'Cookie consent banner should be present',
          category: 'legal', selector: 'page',
          description: trackingCookies.length + ' tracking cookie(s) detected without a consent mechanism',
          severity: 'high', value: trackingCookies.length + ' tracking cookies', expected: 'cookie consent with opt-in before tracking cookies'
        });
      }
    }
  } catch (_) {}

  return { failures: browserResults.failures, totalChecks: 6 };
}

module.exports = { runLegalChecks };
