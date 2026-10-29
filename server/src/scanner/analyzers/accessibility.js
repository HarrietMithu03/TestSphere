const AxeBuilder = require('@axe-core/playwright').default;
const { generateFingerprint } = require('../fingerprinter');

/**
 * Runs axe-core accessibility audit on the active page and reports WCAG rule violations.
 * 
 * @param {import('playwright').Page} page 
 * @param {Function} onFinding Callback invoked when an accessibility issue is identified
 */
const analyzeAccessibility = async (page, onFinding) => {
  try {
    const currentUrl = page.url();

    const builder = new AxeBuilder({ page }).withTags([
      'wcag2a',
      'wcag2aa',
      'wcag21a',
      'wcag21aa'
    ]);

    const results = await builder.analyze();
    if (!results || !results.violations || results.violations.length === 0) {
      return [];
    }

    const impactSeverityMap = {
      critical: 'Critical',
      serious: 'High',
      moderate: 'Medium',
      minor: 'Low'
    };

    for (const violation of results.violations) {
      const severity = impactSeverityMap[violation.impact] || 'Medium';
      const ruleId = violation.id;
      const title = `Accessibility Violation: ${violation.help || ruleId}`;
      const description = `${violation.description} (WCAG tags: ${violation.tags.slice(0, 3).join(', ')})`;

      const primaryNode = violation.nodes?.[0];
      const targetSelector = primaryNode?.target?.join(' ') || 'DOM Element';

      const fingerprint = generateFingerprint({
        category: 'accessibility',
        title,
        affectedUrl: currentUrl,
        keySignature: `${ruleId}::${targetSelector.slice(0, 80)}`
      });

      const finding = {
        category: 'accessibility',
        title,
        description,
        severity,
        confidence: 'Confirmed',
        source: 'automated_crawler',
        affectedUrl: currentUrl,
        affectedComponent: targetSelector.slice(0, 100),
        reproductionSteps: [
          `Open page at ${currentUrl}`,
          `Locate element matching selector: ${targetSelector}`,
          `Inspect element against WCAG requirement: ${ruleId} (${violation.help})`
        ],
        evidence: {
          ruleId,
          impact: violation.impact,
          helpUrl: violation.helpUrl,
          totalAffectedElements: violation.nodes?.length || 1,
          sampleNodes: (violation.nodes || []).slice(0, 3).map((n) => ({
            target: n.target,
            html: n.html?.slice(0, 200),
            failureSummary: n.failureSummary
          })),
          timestamp: new Date().toISOString()
        },
        remediation: `${violation.help}. Ensure all interactive elements conform to WCAG contrast, labeling, and ARIA guidelines. Guidance: ${violation.helpUrl}`,
        fingerprint
      };

      onFinding(finding);
    }

    return results.violations;
  } catch (err) {
    console.warn(`[AccessibilityAnalyzer] Error evaluating page accessibility: ${err.message}`);
    return [];
  }
};

module.exports = {
  analyzeAccessibility
};
