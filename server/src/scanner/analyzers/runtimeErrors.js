const { generateFingerprint } = require('../fingerprinter');

/**
 * Attaches a listener to the Playwright Page to detect uncaught JavaScript runtime exceptions.
 * 
 * @param {import('playwright').Page} page 
 * @param {Function} onFinding Callback invoked when a runtime error is captured
 */
const attachRuntimeErrorAnalyzer = (page, onFinding) => {
  page.on('pageerror', (error) => {
    try {
      const currentUrl = page.url();
      const errorMessage = error?.message || String(error);
      const errorStack = error?.stack || '';
      const errorName = error?.name || 'Error';

      // Determine severity based on error name
      const isCritical =
        errorName === 'SyntaxError' ||
        errorMessage.includes('is not defined') ||
        errorMessage.includes('Cannot read properties of undefined');

      const title = `Uncaught JavaScript Exception: ${errorName}`;
      const description = `The browser encountered an unhandled JavaScript exception while executing client scripts: ${errorMessage}`;

      const fingerprint = generateFingerprint({
        category: 'runtime_error',
        title,
        affectedUrl: currentUrl,
        keySignature: `${errorName}::${errorMessage.slice(0, 100)}`
      });

      const finding = {
        category: 'runtime_error',
        title,
        description,
        severity: isCritical ? 'Critical' : 'High',
        confidence: 'Confirmed',
        source: 'automated_crawler',
        affectedUrl: currentUrl,
        affectedComponent: errorName,
        reproductionSteps: [
          `Navigate to ${currentUrl} in a standard browser`,
          'Wait for initial DOMContentLoaded and client bundle script execution',
          `Observe uncaught '${errorName}' in browser runtime context`
        ],
        evidence: {
          errorName,
          message: errorMessage,
          stackTrace: errorStack ? errorStack.slice(0, 1500) : null,
          capturedAt: new Date().toISOString()
        },
        remediation:
          'Review the client-side JavaScript source code where this exception was raised. Add defensive null checks or wrap fragile operations in try-catch blocks to prevent breaking the application UI.',
        fingerprint
      };

      onFinding(finding);
    } catch (e) {
      console.error('[RuntimeErrorAnalyzer] Error recording finding:', e);
    }
  });
};

module.exports = {
  attachRuntimeErrorAnalyzer
};
