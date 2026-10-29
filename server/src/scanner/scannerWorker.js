const { chromium } = require('playwright');
const ScanJob = require('../models/ScanJob');
const Finding = require('../models/Finding');
const TargetApp = require('../models/TargetApp');
const { validateTargetUrl } = require('./ssrfGuard');
const { runCrawler } = require('./crawler');
const { attachRuntimeErrorAnalyzer } = require('./analyzers/runtimeErrors');
const { attachConsoleErrorAnalyzer } = require('./analyzers/consoleErrors');
const { attachNetworkFailureAnalyzer } = require('./analyzers/networkFailures');
const { getIO } = require('../socket');

/**
 * Safely emit real-time event to the authorized scan room
 */
const emitScanEvent = (scanId, eventName, payload) => {
  try {
    const io = getIO();
    io.to(`scan:${scanId}`).emit(eventName, payload);
  } catch (err) {
    // Socket server might be initializing or disconnected in certain runner environments
    console.warn(`[ScannerWorker] Could not emit socket event ${eventName}: ${err.message}`);
  }
};

/**
 * Executes a full automated diagnostic scan for a given ScanJob.
 * 
 * @param {string} scanId - MongoDB ObjectId string for ScanJob
 * @param {Object} options
 * @param {AbortSignal} options.abortSignal - Cancellation signal
 */
const executeScan = async (scanId, { abortSignal }) => {
  const scanJob = await ScanJob.findById(scanId).populate('targetId');
  if (!scanJob) {
    console.error(`[ScannerWorker] ScanJob ${scanId} not found.`);
    return;
  }

  const target = scanJob.targetId;
  if (!target) {
    scanJob.status = 'FAILED';
    scanJob.errorSummary = 'Target application is missing or was deleted.';
    await scanJob.save();
    emitScanEvent(scanId, 'scan:failed', { scanId, error: scanJob.errorSummary });
    return;
  }

  const startTime = new Date();
  scanJob.status = 'RUNNING';
  scanJob.startTime = startTime;
  scanJob.currentStage = 'INITIALIZING';
  scanJob.progress = 5;
  scanJob.modulesExecuted = [
    'runtime_errors',
    'console_errors',
    'network_failures',
    'broken_links',
    'security_headers',
    'performance',
    'accessibility'
  ];
  await scanJob.save();

  emitScanEvent(scanId, 'scan:started', scanJob.toJSON());

  // Check early cancellation
  if (abortSignal?.aborted) {
    scanJob.status = 'CANCELLED';
    scanJob.currentStage = 'CANCELLED';
    scanJob.endTime = new Date();
    scanJob.durationMs = scanJob.endTime - startTime;
    await scanJob.save();
    emitScanEvent(scanId, 'scan:cancelled', scanJob.toJSON());
    return;
  }

  // Stage 1: Pre-flight SSRF and Safety Verification
  scanJob.currentStage = 'DNS_SECURITY_CHECK';
  scanJob.progress = 10;
  await scanJob.save();
  emitScanEvent(scanId, 'scan:progress', {
    scanId,
    stage: 'DNS_SECURITY_CHECK',
    progress: 10,
    message: 'Validating DNS and enforcing network isolation...'
  });

  const ssrfResult = await validateTargetUrl(target.targetUrl);
  if (!ssrfResult.valid) {
    scanJob.status = 'FAILED';
    scanJob.endTime = new Date();
    scanJob.durationMs = scanJob.endTime - startTime;
    scanJob.errorSummary = `Safety Guard Rejected: ${ssrfResult.error}`;
    await scanJob.save();

    emitScanEvent(scanId, 'scan:failed', {
      scanId,
      error: scanJob.errorSummary,
      stage: 'DNS_SECURITY_CHECK'
    });
    return;
  }

  // In-memory deduplication map: fingerprint -> Finding document
  const findingsMap = new Map();

  const handleFinding = (findingData) => {
    const { fingerprint } = findingData;

    if (findingsMap.has(fingerprint)) {
      // Deduplicate: increment count and record occurrence
      const existing = findingsMap.get(fingerprint);
      existing.occurrenceCount = (existing.occurrenceCount || 1) + 1;
      existing.occurrences.push({
        url: findingData.affectedUrl,
        timestamp: new Date(),
        extraInfo: findingData.evidence
      });
    } else {
      // New distinct finding
      const newFinding = {
        ...findingData,
        scanId: scanJob._id,
        targetId: target._id,
        occurrenceCount: 1,
        occurrences: [
          {
            url: findingData.affectedUrl,
            timestamp: new Date(),
            extraInfo: findingData.evidence
          }
        ]
      };
      findingsMap.set(fingerprint, newFinding);

      // Emit live finding event over Socket.IO
      emitScanEvent(scanId, 'scan:finding', newFinding);
    }
  };

  let browser = null;
  let context = null;

  try {
    // Stage 2: Launch Isolated Browser
    scanJob.currentStage = 'BROWSER_INITIALIZATION';
    scanJob.progress = 15;
    await scanJob.save();
    emitScanEvent(scanId, 'scan:progress', {
      scanId,
      stage: 'BROWSER_INITIALIZATION',
      progress: 15,
      message: 'Launching isolated Chromium browser worker...'
    });

    browser = await chromium.launch({
      headless: true
    });

    context = await browser.newContext({
      userAgent: target.scanPolicy?.userAgent || 'TestSphere-Diagnostics/1.0 (+https://testsphere.io/bot)',
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: true
    });

    const page = await context.newPage();

    // Attach Analyzers
    attachRuntimeErrorAnalyzer(page, handleFinding);
    attachConsoleErrorAnalyzer(page, handleFinding);
    attachNetworkFailureAnalyzer(page, handleFinding);

    // Optional Authenticated Test Session Initialization
    const authConfig = target.scanPolicy?.authConfig;
    if (authConfig && authConfig.type === 'custom_header' && authConfig.customHeader?.name) {
      await context.setExtraHTTPHeaders({
        [authConfig.customHeader.name]: authConfig.customHeader.value || ''
      });
    } else if (authConfig && authConfig.type === 'test_credentials' && authConfig.testAccount?.loginUrl) {
      try {
        scanJob.currentStage = 'AUTHENTICATING_TEST_SESSION';
        await scanJob.save();
        emitScanEvent(scanId, 'scan:progress', {
          scanId,
          stage: 'AUTHENTICATING_TEST_SESSION',
          progress: 18,
          message: 'Establishing authenticated test session...'
        });

        await page.goto(authConfig.testAccount.loginUrl, { waitUntil: 'load', timeout: 25000 });
        if (authConfig.testAccount.usernameSelector && authConfig.testAccount.username) {
          await page.fill(authConfig.testAccount.usernameSelector, authConfig.testAccount.username);
        }
        if (authConfig.testAccount.passwordSelector && authConfig.testAccount.password) {
          await page.fill(authConfig.testAccount.passwordSelector, authConfig.testAccount.password);
        }
        if (authConfig.testAccount.submitSelector) {
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'load', timeout: 20000 }).catch(() => {}),
            page.click(authConfig.testAccount.submitSelector).catch(() => {})
          ]);
        }
      } catch (authErr) {
        console.warn(`[ScannerWorker] Authenticated login attempt failed: ${authErr.message}`);
      }
    }

    // Stage 3: Crawling and Analysis
    scanJob.currentStage = 'CRAWLING_AND_ANALYSIS';
    scanJob.progress = 20;
    await scanJob.save();

    const crawlResult = await runCrawler({
      page,
      startUrl: target.targetUrl,
      scope: {
        allowedHost: target.authorizedScope?.allowedHost || new URL(target.targetUrl).hostname,
        allowSubdomains: !!target.authorizedScope?.allowSubdomains,
        maxDepth: target.authorizedScope?.maxDepth || 3,
        maxPages: target.authorizedScope?.maxPages || 25
      },
      rateLimitRps: target.scanPolicy?.rateLimitRps || 2,
      abortSignal,
      onFinding: handleFinding,
      onProgress: async (crawlProgress) => {
        scanJob.pagesScanned = crawlProgress.pagesScanned;
        scanJob.pagesDiscovered = crawlProgress.pagesDiscovered;
        scanJob.progress = crawlProgress.progress;
        scanJob.currentStage = crawlProgress.currentStage;
        await scanJob.save();

        emitScanEvent(scanId, 'scan:progress', {
          scanId,
          ...crawlProgress
        });
      }
    });

    scanJob.pagesScanned = crawlResult.pagesScanned;
    scanJob.pagesDiscovered = crawlResult.pagesDiscovered;

    // Stage 4: Finalize and Persist Findings
    scanJob.currentStage = 'FINALIZING';
    scanJob.progress = 95;
    await scanJob.save();

    emitScanEvent(scanId, 'scan:progress', {
      scanId,
      stage: 'FINALIZING',
      progress: 95,
      message: 'Processing findings and updating target metrics...'
    });

    // Bulk save deduplicated findings
    const findingsList = Array.from(findingsMap.values());
    if (findingsList.length > 0) {
      await Finding.insertMany(findingsList, { ordered: false }).catch((err) => {
        // Some duplicates might collide on unique index if re-run, ignore duplicate key errors
        if (err.code !== 11000) {
          console.warn('[ScannerWorker] Bulk insert finding warning:', err.message);
        }
      });
    }

    // Summarize Findings
    const summary = {
      total: findingsList.length,
      critical: findingsList.filter((f) => f.severity === 'Critical').length,
      high: findingsList.filter((f) => f.severity === 'High').length,
      medium: findingsList.filter((f) => f.severity === 'Medium').length,
      low: findingsList.filter((f) => f.severity === 'Low').length,
      info: findingsList.filter((f) => f.severity === 'Info').length,
      confirmed: findingsList.filter((f) => f.confidence === 'Confirmed').length,
      suspected: findingsList.filter((f) => f.confidence === 'Suspected').length
    };

    const endTime = new Date();
    const durationMs = endTime - startTime;

    scanJob.status = 'COMPLETED';
    scanJob.currentStage = 'COMPLETED';
    scanJob.progress = 100;
    scanJob.endTime = endTime;
    scanJob.durationMs = durationMs;
    scanJob.findingsSummary = summary;
    await scanJob.save();

    // Update TargetApp metrics
    const penalty = summary.critical * 25 + summary.high * 15 + summary.medium * 5 + summary.low * 1;
    const computedHealthScore = Math.max(0, Math.min(100, 100 - penalty));

    target.lastScanAt = endTime;
    target.healthScore = computedHealthScore;
    target.stats.totalScans = (target.stats.totalScans || 0) + 1;
    target.stats.openFindings = summary.total;
    target.stats.criticalIssues = summary.critical;
    await target.save();

    emitScanEvent(scanId, 'scan:completed', {
      scanId,
      durationMs,
      pagesScanned: scanJob.pagesScanned,
      findingsSummary: summary,
      completedAt: endTime.toISOString()
    });
  } catch (error) {
    if (error.name === 'AbortError' || abortSignal?.aborted) {
      // Scan was safely cancelled
      const endTime = new Date();
      scanJob.status = 'CANCELLED';
      scanJob.currentStage = 'CANCELLED';
      scanJob.endTime = endTime;
      scanJob.durationMs = endTime - startTime;

      // Save any findings collected before cancellation
      const findingsList = Array.from(findingsMap.values());
      if (findingsList.length > 0) {
        await Finding.insertMany(findingsList, { ordered: false }).catch(() => {});
      }

      await scanJob.save();
      emitScanEvent(scanId, 'scan:cancelled', {
        scanId,
        message: 'Scan was safely cancelled by user request.'
      });
    } else {
      console.error(`[ScannerWorker] Scan failed with error:`, error);
      const endTime = new Date();
      scanJob.status = 'FAILED';
      scanJob.currentStage = 'FAILED';
      scanJob.endTime = endTime;
      scanJob.durationMs = endTime - startTime;
      scanJob.errorSummary = error.message || 'Unexpected scanner failure during execution.';
      await scanJob.save();

      emitScanEvent(scanId, 'scan:failed', {
        scanId,
        error: scanJob.errorSummary
      });
    }
  } finally {
    // Cleanup browser resources
    if (context) {
      await context.close().catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
};

module.exports = {
  executeScan
};
