const { generateFingerprint } = require('../fingerprinter');

/**
 * Extracts browser Navigation Timing metrics and records performance findings if thresholds are exceeded.
 * 
 * @param {import('playwright').Page} page 
 * @param {Function} onFinding Callback to report performance findings
 * @returns {Promise<Object>} The collected performance metrics
 */
const analyzePerformanceTiming = async (page, onFinding) => {
  try {
    const timing = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      if (!nav) return null;

      const ttfb = Math.round(nav.responseStart - nav.requestStart);
      const domContentLoaded = Math.round(nav.domContentLoadedEventEnd - nav.startTime);
      const loadTime = Math.round(nav.loadEventEnd - nav.startTime);

      return {
        ttfb: ttfb > 0 ? ttfb : 0,
        domContentLoaded: domContentLoaded > 0 ? domContentLoaded : 0,
        loadTime: loadTime > 0 ? loadTime : 0,
        transferSize: nav.transferSize || 0,
        encodedBodySize: nav.encodedBodySize || 0
      };
    });

    if (!timing) {
      return null;
    }

    const currentUrl = page.url();

    // Threshold 1: Excessive Page Load Time (> 3500 ms)
    if (timing.loadTime > 3500) {
      const title = `Elevated Page Load Time: ${timing.loadTime}ms`;
      const description = `The page took ${timing.loadTime}ms to complete loading, exceeding the recommended 3500ms threshold for optimal user experience.`;

      const fingerprint = generateFingerprint({
        category: 'performance',
        title,
        affectedUrl: currentUrl,
        keySignature: 'high_page_load_time'
      });

      onFinding({
        category: 'performance',
        title,
        description,
        severity: timing.loadTime > 7000 ? 'Medium' : 'Low',
        confidence: 'Suspected', // Heuristic observation based on current network conditions
        source: 'automated_crawler',
        affectedUrl: currentUrl,
        affectedComponent: 'Page Navigation',
        reproductionSteps: [
          `Navigate to ${currentUrl}`,
          `Measure window.performance NavigationTiming API metrics`,
          `Observe loadEventEnd duration of ${timing.loadTime}ms`
        ],
        evidence: {
          metrics: timing,
          thresholdMs: 3500,
          timestamp: new Date().toISOString()
        },
        remediation:
          'Audit large JavaScript bundles, defer non-critical CSS/scripts, compress images, and utilize HTTP caching to reduce page load latency.',
        fingerprint
      });
    }

    // Threshold 2: High Server Response Time / TTFB (> 1500 ms)
    if (timing.ttfb > 1500) {
      const title = `High Time to First Byte (TTFB): ${timing.ttfb}ms`;
      const description = `Initial server response time (TTFB) was ${timing.ttfb}ms, indicating potential backend database contention, complex server-side queries, or cold start latency.`;

      const fingerprint = generateFingerprint({
        category: 'performance',
        title,
        affectedUrl: currentUrl,
        keySignature: 'high_ttfb'
      });

      onFinding({
        category: 'performance',
        title,
        description,
        severity: 'Low',
        confidence: 'Suspected',
        source: 'automated_crawler',
        affectedUrl: currentUrl,
        affectedComponent: 'Origin Server',
        reproductionSteps: [
          `Request ${currentUrl}`,
          `Calculate responseStart - requestStart via Navigation Timing`,
          `Observe TTFB duration of ${timing.ttfb}ms`
        ],
        evidence: {
          metrics: timing,
          thresholdMs: 1500,
          timestamp: new Date().toISOString()
        },
        remediation:
          'Implement server-side caching (Redis, CDN edge caching), optimize database queries, or increase server resources to reduce backend response latency.',
        fingerprint
      });
    }

    return timing;
  } catch (error) {
    console.error('[PerformanceAnalyzer] Error evaluating timing:', error.message);
    return null;
  }
};

module.exports = {
  analyzePerformanceTiming
};
