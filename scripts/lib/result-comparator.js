/**
 * Maps Liveviewer rule IDs to axe-core rule IDs.
 * axe-core is treated as the reference (ground truth).
 */
export const AXE_RULE_MAP = {
  // WCAG / Accessibility rules
  'color-contrast':     ['color-contrast'],
  'missing-alt':        ['image-alt'],
  'empty-interactive':  ['button-name', 'link-name'],
  'missing-lang':       ['html-has-lang', 'html-lang-valid'],
  'missing-label':      ['label', 'select-name', 'input-button-name'],
  'skip-navigation':    ['bypass'],

  // Design rules (no axe equivalent — use expected fixtures directly)
  'heading-hierarchy':   [],
  'font-size-legible':   [],
  'line-height-readable': [],
  'horizontal-scroll':   []
};

const REVERSE_MAP = {};
for (const [lvRule, axeRules] of Object.entries(AXE_RULE_MAP)) {
  for (const axeRule of axeRules) {
    REVERSE_MAP[axeRule] = lvRule;
  }
}

/**
 * Normalize a selector for comparison.
 * axe-core returns full path selectors (e.g. "html > body > p:nth-child(2)")
 * Liveviewer returns simple tag+class selectors (e.g. "p").
 * We extract just the last tag+classes part for matching.
 * @param {string} sel
 * @returns {string}
 */
function normalizeSelector(sel) {
  if (!sel) return '';
  // Take the last segment after " > " (axe path format)
  const parts = sel.split(' > ');
  const last = parts[parts.length - 1];
  // Remove pseudo-classes like :nth-child(2), :first-child
  const cleaned = last.replace(/:(?:nth-child|first-child|last-child|nth-of-type|first-of-type)\([^)]*\)/g, '')
    .trim();
  // Lowercase for comparison
  return cleaned.toLowerCase();
}

/**
 * Extract the tag name from a selector for rule-level (not element-level) comparison.
 */
function extractTag(sel) {
  const normalized = normalizeSelector(sel);
  return normalized.split(/[.#\s:[]/)[0] || '';
}

/**
 * Extract Liveviewer's WCAG failures as [{ ruleId, selector }].
 * @param {Array} wcagFailures
 * @returns {Array<{ruleId:string, selector:string}>}
 */
export function extractLiveviewerWcag(wcagFailures) {
  return (wcagFailures || []).map(f => ({
    ruleId: 'color-contrast',
    selector: normalizeSelector(f.selector)
  }));
}

/**
 * Extract Liveviewer's design failures as [{ ruleId, selector }].
 * @param {Array} designFailures
 * @returns {Array<{ruleId:string, selector:string}>}
 */
export function extractLiveviewerDesign(designFailures) {
  return (designFailures || []).map(f => ({
    ruleId: f.ruleId,
    selector: normalizeSelector(f.selector)
  }));
}

/**
 * Extract axe-core violations as [{ ruleId, selector }], mapped to Liveviewer rule IDs.
 * Only includes rules that have a Liveviewer equivalent.
 * @param {Array} axeViolations
 * @returns {Array<{ruleId:string, selector:string}>}
 */
export function extractAxe(axeViolations) {
  const results = [];
  for (const v of axeViolations || []) {
    const lvRule = REVERSE_MAP[v.ruleId];
    if (!lvRule) continue; // Skip rules Liveviewer doesn't implement
    results.push({
      ruleId: lvRule,
      selector: normalizeSelector(v.selector)
    });
  }
  return results;
}

/**
 * Compare two sets of results and compute TP/FP/FN.
 * @param {Array<{ruleId:string, selector:string}>} actual - Liveviewer results
 * @param {Array<{ruleId:string, selector:string}>} expected - Reference (axe or expected) results
 * @returns {{ tp:number, fp:number, fn:number, tps:Array, fps:Array, fns:Array }}
 */
export function compareResults(actual, expected) {
  const actualSet = new Set(actual.map(f => f.ruleId + '|' + f.selector));
  const expectedSet = new Set(expected.map(f => f.ruleId + '|' + f.selector));

  const tps = [];
  const fps = [];
  const fns = [];

  for (const f of expected) {
    const key = f.ruleId + '|' + f.selector;
    if (actualSet.has(key)) {
      tps.push(f);
    } else {
      fns.push(f);
    }
  }

  for (const f of actual) {
    const key = f.ruleId + '|' + f.selector;
    if (!expectedSet.has(key)) {
      fps.push(f);
    }
  }

  return {
    tp: tps.length,
    fp: fps.length,
    fn: fns.length,
    tps, fps, fns
  };
}

/**
 * Compute precision, recall, and F1 from TP/FP/FN counts.
 */
export function computeMetrics(tp, fp, fn) {
  const precision = tp + fp > 0 ? tp / (tp + fp) : 1;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 1;
  const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
  return {
    precision: +(precision * 100).toFixed(1),
    recall: +(recall * 100).toFixed(1),
    f1: +(f1 * 100).toFixed(1)
  };
}
