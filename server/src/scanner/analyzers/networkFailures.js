const { generateFingerprint, normalizeUrl } = require('../fingerprinter');

/**
 * Attaches listeners to the Playwright Page to capture failed network requests and HTTP 4xx/5xx responses.
 * 
 * @param {import('playwright').Page} page 
 * @param {Function} onFinding Callback invoked when a network failure is detected
 */
const attachNetworkFailureAnalyzer = (page, onFinding) => {
  // 1. Capture low-level network connection failures (ERR_CONNECTION_REFUSED, DNS failures, etc.)
  page.on('requestfailed', (request) => {
    try {
      const pageUrl = page.url();
      const requestUrl = request.url();
      const failure = request.failure();
      const failureText = failure?.errorText || 'Unknown Network Failure';
      const resourceType = request.resourceType();

      // Don't report aborted requests initiated intentionally (e.g. navigation cancellation)
      if (failureText === 'net::ERR_ABORTED') {
        return;
      }

      const title = `Network Request Failed: ${failureText}`;
      const description = `The browser could not complete an HTTP request to ${requestUrl} (${resourceType}). Reason: ${failureText}`;

      const fingerprint = generateFingerprint({
        category: 'network_failure',
        title,
        affectedUrl: pageUrl,
        keySignature: `${request.method()}::${normalizeUrl(requestUrl)}::${failureText}`
      });

      const finding = {
        category: 'network_failure',
        title,
        description,
        severity: 'High',
        confidence: 'Confirmed',
        source: 'automated_crawler',
        affectedUrl: pageUrl,
        affectedComponent: resourceType,
        reproductionSteps: [
          `Navigate to ${pageUrl}`,
          `Trigger or allow client request for ${resourceType} resource: ${requestUrl}`,
          `Observe connection failure: ${failureText}`
        ],
        evidence: {
          requestMethod: request.method(),
          requestUrl,
          resourceType,
          failureReason: failureText,
          timestamp: new Date().toISOString()
        },
        remediation:
          'Verify that the requested resource hostname is reachable, firewall rules permit traffic, and the remote endpoint is actively listening on the target port.',
        fingerprint
      };

      onFinding(finding);
    } catch (e) {
      console.error('[NetworkFailureAnalyzer] Error on requestfailed:', e);
    }
  });

  // 2. Capture HTTP 4xx and 5xx responses
  page.on('response', (response) => {
    try {
      const status = response.status();
      // Only interested in HTTP errors (400-599)
      if (status < 400) {
        return;
      }

      const request = response.request();
      const pageUrl = page.url();
      const requestUrl = response.url();
      const resourceType = request.resourceType();
      const statusText = response.statusText();

      // Skip 404 for top-level HTML navigation (handled by brokenLinks analyzer with richer context)
      if (resourceType === 'document' && status === 404) {
        return;
      }

      const isServerFault = status >= 500;
      const isAuthBarrier = status === 401 || status === 403;

      let severity = 'Medium';
      let confidence = 'Confirmed';

      if (isServerFault) {
        severity = 'High';
        confidence = 'Confirmed';
      } else if (isAuthBarrier) {
        severity = 'Low';
        confidence = 'Suspected'; // Distinguish heuristic observation from confirmed bug
      }

      const title = `HTTP ${status} ${statusText || 'Error'} on ${resourceType}`;
      const description = isServerFault
        ? `The server returned an internal failure (HTTP ${status}) while serving ${resourceType} at ${requestUrl}.`
        : `The server responded with client error HTTP ${status} for ${resourceType} at ${requestUrl}.`;

      const fingerprint = generateFingerprint({
        category: 'network_failure',
        title,
        affectedUrl: pageUrl,
        keySignature: `${request.method()}::${normalizeUrl(requestUrl)}::${status}`
      });

      const finding = {
        category: 'network_failure',
        title,
        description,
        severity,
        confidence,
        source: 'automated_crawler',
        affectedUrl: pageUrl,
        affectedComponent: resourceType,
        reproductionSteps: [
          `Load page at ${pageUrl}`,
          `Inspect network activity for ${request.method()} ${requestUrl}`,
          `Verify HTTP response status code is ${status} (${statusText})`
        ],
        evidence: {
          requestMethod: request.method(),
          requestUrl,
          statusCode: status,
          statusText,
          resourceType,
          timestamp: new Date().toISOString()
        },
        remediation: isServerFault
          ? 'Inspect backend server logs for unhandled exceptions or crashes associated with this request endpoint. Return proper 4xx validation or handle internal errors gracefully.'
          : 'Check if the endpoint path or query parameters are correct and whether valid authentication is expected for this resource.',
        fingerprint
      };

      onFinding(finding);
    } catch (e) {
      console.error('[NetworkFailureAnalyzer] Error on response:', e);
    }
  });
};

module.exports = {
  attachNetworkFailureAnalyzer
};
