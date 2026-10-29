const { generateFingerprint, normalizeUrl } = require('../fingerprinter');
const { isScopeAllowed } = require('../ssrfGuard');

/**
 * Extracts and tests internal links discovered on the current page.
 * Validates only links within the authorized crawl scope to prevent SSRF or unauthorized external calls.
 * 
 * @param {import('playwright').Page} page 
 * @param {Object} options
 * @param {string} options.allowedHost
 * @param {boolean} options.allowSubdomains
 * @param {Function} options.onFinding Callback when a broken link is discovered
 * @returns {Promise<string[]>} Array of valid internal URLs discovered for further crawling
 */
const analyzeLinksOnPage = async (page, { allowedHost, allowSubdomains = false, onFinding }) => {
  const discoveredInternalUrls = [];
  const currentUrl = page.url();

  try {
    // Extract anchor links and text from the DOM
    const rawLinks = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      return anchors.map((a) => ({
        href: a.href,
        text: (a.textContent || '').trim().slice(0, 100),
        rawAttr: a.getAttribute('href') || ''
      }));
    });

    for (const linkItem of rawLinks) {
      const { href, text, rawAttr } = linkItem;

      // Skip empty, javascript:, mailto:, tel:, #anchors
      if (
        !href ||
        href.startsWith('javascript:') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        rawAttr.startsWith('#')
      ) {
        continue;
      }

      // Check if within allowed scope
      if (!isScopeAllowed(href, allowedHost, allowSubdomains)) {
        continue; // Out of scope, do not test or crawl
      }

      const normalizedHref = normalizeUrl(href);
      if (!discoveredInternalUrls.includes(normalizedHref)) {
        discoveredInternalUrls.push(normalizedHref);
      }
    }
  } catch (error) {
    console.error('[BrokenLinksAnalyzer] Failed to extract links from page:', error.message);
  }

  return discoveredInternalUrls;
};

/**
 * Records a confirmed broken link finding when an internal URL returns HTTP 404 or connection refused.
 * 
 * @param {Object} params
 * @param {string} params.sourceUrl
 * @param {string} params.targetUrl
 * @param {number} params.statusCode
 * @param {string} [params.anchorText]
 * @param {Function} params.onFinding
 */
const recordBrokenLinkFinding = ({ sourceUrl, targetUrl, statusCode, anchorText = '', onFinding }) => {
  const title = `Broken Internal Link: HTTP ${statusCode} at ${targetUrl}`;
  const description = `Page ${sourceUrl} contains a hyperlink to ${targetUrl} that returned status HTTP ${statusCode} (Not Found).`;

  const fingerprint = generateFingerprint({
    category: 'broken_link',
    title,
    affectedUrl: sourceUrl,
    keySignature: `${normalizeUrl(targetUrl)}::${statusCode}`
  });

  const finding = {
    category: 'broken_link',
    title,
    description,
    severity: 'Medium',
    confidence: 'Confirmed',
    source: 'automated_crawler',
    affectedUrl: sourceUrl,
    affectedComponent: 'Anchor Link',
    reproductionSteps: [
      `Navigate to source page: ${sourceUrl}`,
      `Locate hyperlink pointing to: ${targetUrl}${anchorText ? ` with anchor text "${anchorText}"` : ''}`,
      `Click or request the link target`,
      `Observe HTTP ${statusCode} response`
    ],
    evidence: {
      sourceUrl,
      targetUrl,
      statusCode,
      anchorText: anchorText || null,
      timestamp: new Date().toISOString()
    },
    remediation:
      'Update the anchor href to point to the correct active path, or remove the obsolete link from the source page templates.',
    fingerprint
  };

  onFinding(finding);
};

module.exports = {
  analyzeLinksOnPage,
  recordBrokenLinkFinding
};
