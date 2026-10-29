const { isScopeAllowed, validateTargetUrl } = require('./ssrfGuard');
const { analyzeLinksOnPage, recordBrokenLinkFinding } = require('./analyzers/brokenLinks');
const { analyzeSecurityHeaders } = require('./analyzers/securityHeaders');
const { analyzePerformanceTiming } = require('./analyzers/performanceTiming');
const { analyzeAccessibility } = require('./analyzers/accessibility');

/**
 * Executes a controlled, read-only BFS crawl of the target application.
 * Respects maxPages, maxDepth, rateLimitRps, and cancellation signals.
 * 
 * @param {Object} params
 * @param {import('playwright').Page} params.page - Active Playwright page
 * @param {string} params.startUrl - Root URL to begin crawl
 * @param {Object} params.scope - Authorized scope configuration
 * @param {string} params.scope.allowedHost
 * @param {boolean} params.scope.allowSubdomains
 * @param {number} params.scope.maxDepth
 * @param {number} params.scope.maxPages
 * @param {number} params.rateLimitRps
 * @param {AbortSignal} params.abortSignal
 * @param {Function} params.onFinding
 * @param {Function} params.onProgress
 * @returns {Promise<{ pagesScanned: number, pagesDiscovered: number, visitedUrls: string[] }>}
 */
const runCrawler = async ({
  page,
  startUrl,
  scope,
  rateLimitRps = 2,
  abortSignal,
  onFinding,
  onProgress
}) => {
  const maxPages = Math.min(scope.maxPages || 25, 100);
  const maxDepth = Math.min(scope.maxDepth || 3, 10);
  const allowedHost = scope.allowedHost;
  const allowSubdomains = !!scope.allowSubdomains;

  const queue = [{ url: startUrl, depth: 0, referrer: null, anchorText: null }];
  const visited = new Set();
  const discovered = new Set([startUrl]);

  let pagesScanned = 0;
  const requestDelayMs = Math.max(Math.floor(1000 / (rateLimitRps || 2)), 100);

  let initialHeadersChecked = false;

  while (queue.length > 0 && pagesScanned < maxPages) {
    if (abortSignal?.aborted) {
      const abortError = new Error('Scan cancelled by user');
      abortError.name = 'AbortError';
      throw abortError;
    }

    const currentItem = queue.shift();
    const { url, depth, referrer, anchorText } = currentItem;

    if (visited.has(url)) {
      continue;
    }

    // SSRF Revalidation before navigating to each internal URL
    const ssrfCheck = await validateTargetUrl(url);
    if (!ssrfCheck.valid) {
      console.warn(`[Crawler] Skipping URL due to SSRF safety check: ${url} (${ssrfCheck.error})`);
      continue;
    }

    visited.add(url);
    pagesScanned++;

    // Emit live progress before loading
    onProgress({
      pagesScanned,
      pagesDiscovered: discovered.size,
      currentUrl: url,
      currentStage: `CRAWLING (${pagesScanned}/${Math.min(discovered.size, maxPages)})`,
      progress: Math.min(Math.round((pagesScanned / Math.min(discovered.size, maxPages)) * 90), 90)
    });

    try {
      // Navigate to target URL with read-only GET request
      const response = await page.goto(url, {
        waitUntil: 'load',
        timeout: 25000
      });

      if (!response) {
        continue;
      }

      const status = response.status();

      // Check for broken link if navigation returned 404 or >= 400
      if (status === 404 && referrer) {
        recordBrokenLinkFinding({
          sourceUrl: referrer,
          targetUrl: url,
          statusCode: status,
          anchorText,
          onFinding
        });
      }

      // Security headers check (primary origin evaluation)
      if (!initialHeadersChecked && (url === startUrl || pagesScanned === 1)) {
        analyzeSecurityHeaders(response, onFinding);
        initialHeadersChecked = true;
      }

      // Performance Navigation Timing check
      await analyzePerformanceTiming(page, onFinding);

      // Accessibility audit via axe-core
      await analyzeAccessibility(page, onFinding);

      // Extract new internal links if we haven't reached maxDepth
      if (depth < maxDepth && pagesScanned < maxPages) {
        const foundLinks = await analyzeLinksOnPage(page, {
          allowedHost,
          allowSubdomains,
          onFinding
        });

        for (const childUrl of foundLinks) {
          if (!discovered.has(childUrl)) {
            discovered.add(childUrl);
            if (!visited.has(childUrl) && queue.length + pagesScanned < maxPages * 2) {
              queue.push({
                url: childUrl,
                depth: depth + 1,
                referrer: url,
                anchorText: null
              });
            }
          }
        }
      }
    } catch (navError) {
      // Check if navigation aborted intentionally
      if (abortSignal?.aborted) {
        const abortErr = new Error('Scan cancelled by user');
        abortErr.name = 'AbortError';
        throw abortErr;
      }

      console.warn(`[Crawler] Navigation issue on ${url}: ${navError.message}`);
    }

    // Rate-limiting pause between page crawls
    if (queue.length > 0 && pagesScanned < maxPages) {
      await new Promise((resolve) => setTimeout(resolve, requestDelayMs));
    }
  }

  return {
    pagesScanned,
    pagesDiscovered: discovered.size,
    visitedUrls: Array.from(visited)
  };
};

module.exports = {
  runCrawler
};
