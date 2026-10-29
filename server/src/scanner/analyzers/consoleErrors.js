const { generateFingerprint } = require('../fingerprinter');

/**
 * Attaches a listener to the Playwright Page to capture browser console.error() events.
 * 
 * @param {import('playwright').Page} page 
 * @param {Function} onFinding Callback invoked when a console error is captured
 */
const attachConsoleErrorAnalyzer = (page, onFinding) => {
  page.on('console', (msg) => {
    try {
      if (msg.type() !== 'error') {
        return;
      }

      const currentUrl = page.url();
      const text = msg.text();
      const location = msg.location();

      // Avoid double-counting uncaught exceptions that Playwright pageerror handles
      if (text.startsWith('Uncaught ') && location?.url) {
        return;
      }

      // Check if severe or standard
      const isHigh =
        text.toLowerCase().includes('failed to load resource') ||
        text.toLowerCase().includes('security') ||
        text.toLowerCase().includes('blocked');

      const title = `Browser Console Error: ${text.slice(0, 70)}`;
      const description = `The browser recorded an explicit console error message during page execution: "${text}"`;

      const locationStr = location?.url ? `${location.url}:${location.lineNumber || 0}` : 'inline-script';

      const fingerprint = generateFingerprint({
        category: 'console_error',
        title,
        affectedUrl: currentUrl,
        keySignature: `${text.slice(0, 120)}::${locationStr}`
      });

      const finding = {
        category: 'console_error',
        title,
        description,
        severity: isHigh ? 'High' : 'Medium',
        confidence: 'Confirmed',
        source: 'automated_crawler',
        affectedUrl: currentUrl,
        affectedComponent: location?.url ? location.url.split('/').pop() : 'Console',
        reproductionSteps: [
          `Navigate to ${currentUrl} with browser developer tools opened`,
          'Monitor Console output during page life cycle',
          `Observe error log: "${text.slice(0, 80)}..."`
        ],
        evidence: {
          consoleText: text,
          location: {
            url: location?.url || null,
            lineNumber: location?.lineNumber || null,
            columnNumber: location?.columnNumber || null
          },
          capturedAt: new Date().toISOString()
        },
        remediation:
          'Audit the front-end scripts generating this error log. Ensure all required assets, API endpoints, and DOM elements are properly resolved and initialized.',
        fingerprint
      };

      onFinding(finding);
    } catch (e) {
      console.error('[ConsoleErrorAnalyzer] Error recording finding:', e);
    }
  });
};

module.exports = {
  attachConsoleErrorAnalyzer
};
