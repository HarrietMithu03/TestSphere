const { generateFingerprint } = require('../fingerprinter');

/**
 * Standard security header rules to evaluate against HTTP responses
 */
const SECURITY_HEADER_CHECKS = [
  {
    header: 'content-security-policy',
    name: 'Content-Security-Policy',
    severity: 'Medium',
    description: 'Restricts sources of executable scripts, stylesheets, and images to mitigate Cross-Site Scripting (XSS) and data injection.',
    recommended: "default-src 'self'; script-src 'self'; object-src 'none';",
    validate: (val) => Boolean(val && val.trim().length > 0)
  },
  {
    header: 'strict-transport-security',
    name: 'Strict-Transport-Security (HSTS)',
    severity: 'Medium',
    httpsOnly: true,
    description: 'Enforces encrypted HTTPS connections and protects against protocol downgrade attacks and cookie hijacking.',
    recommended: 'max-age=31536000; includeSubDomains',
    validate: (val) => Boolean(val && val.includes('max-age='))
  },
  {
    header: 'x-content-type-options',
    name: 'X-Content-Type-Options',
    severity: 'Low',
    description: 'Prevents MIME-type sniffing, mitigating attacks that trick browsers into interpreting non-executable files as JavaScript or CSS.',
    recommended: 'nosniff',
    validate: (val) => Boolean(val && val.toLowerCase().trim() === 'nosniff')
  },
  {
    header: 'x-frame-options',
    name: 'X-Frame-Options',
    severity: 'Medium',
    description: 'Guards against Clickjacking by controlling whether the page can be embedded inside an <iframe> or <frame>.',
    recommended: 'DENY or SAMEORIGIN',
    validate: (val) => {
      if (!val) return false;
      const lower = val.toLowerCase().trim();
      return lower === 'deny' || lower === 'sameorigin';
    }
  },
  {
    header: 'referrer-policy',
    name: 'Referrer-Policy',
    severity: 'Low',
    description: 'Controls how much referrer information (URL parameters, query paths) is included with outbound requests.',
    recommended: 'strict-origin-when-cross-origin',
    validate: (val) => Boolean(val && val.trim().length > 0)
  }
];

/**
 * Evaluates origin response headers for standard security hygiene.
 * 
 * @param {import('playwright').Response} response 
 * @param {Function} onFinding Callback to report a missing or weak security header
 */
const analyzeSecurityHeaders = (response, onFinding) => {
  try {
    const url = response.url();
    const headers = response.headers();
    const isHttps = url.startsWith('https://');

    for (const check of SECURITY_HEADER_CHECKS) {
      if (check.httpsOnly && !isHttps) {
        continue;
      }

      const headerVal = headers[check.header];
      const isValid = check.validate(headerVal);

      if (!isValid) {
        const isMissing = !headerVal;
        const title = isMissing
          ? `Missing Security Header: ${check.name}`
          : `Misconfigured Security Header: ${check.name}`;

        const description = isMissing
          ? `The server response does not include the '${check.name}' header. ${check.description}`
          : `The header '${check.name}' is set to an insecure or unrecognized value: "${headerVal}". ${check.description}`;

        const fingerprint = generateFingerprint({
          category: 'security_header',
          title,
          affectedUrl: url,
          keySignature: `${check.header}::${isMissing ? 'missing' : headerVal}`
        });

        const finding = {
          category: 'security_header',
          title,
          description,
          severity: check.severity,
          confidence: 'Confirmed',
          source: 'automated_crawler',
          affectedUrl: url,
          affectedComponent: check.name,
          reproductionSteps: [
            `Send an HTTP GET request to ${url}`,
            `Inspect response headers returned by the origin server`,
            `Verify '${check.name}' header is ${isMissing ? 'missing entirely' : `present but weak ("${headerVal}")`}`
          ],
          evidence: {
            headerName: check.name,
            status: isMissing ? 'missing' : 'weak',
            observedValue: headerVal || null,
            recommendedValue: check.recommended,
            timestamp: new Date().toISOString()
          },
          remediation: `Configure your web server (e.g. Nginx, Cloudflare, Apache, Express helmet) to send '${check.name}: ${check.recommended}'.`,
          fingerprint
        };

        onFinding(finding);
      }
    }
  } catch (error) {
    console.error('[SecurityHeadersAnalyzer] Error evaluating headers:', error.message);
  }
};

module.exports = {
  analyzeSecurityHeaders
};
