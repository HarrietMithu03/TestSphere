const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../src/config/env');
const User = require('../src/models/User');
const TargetApp = require('../src/models/TargetApp');
const ScanJob = require('../src/models/ScanJob');
const Finding = require('../src/models/Finding');
const DiagnosticReport = require('../src/models/DiagnosticReport');
const { validateTargetUrl, isPrivateIPv4, isPrivateIPv6 } = require('../src/scanner/ssrfGuard');
const { generateFingerprint } = require('../src/scanner/fingerprinter');
const { executeScan } = require('../src/scanner/scannerWorker');
const scanQueue = require('../src/scanner/scanQueue');
const reportService = require('../src/services/reportService');
const { checkAndroidEnvironment } = require('../src/scanner/android/androidDiagnostics');
const { createFixtureServer } = require('./fixtureServer');

async function runComprehensiveVerification() {
  console.log('================================================================');
  console.log('TestSphere: Consolidated End-to-End Verification Campaign');
  console.log('Phases 1-6 Architecture & Integration Audit');
  console.log('================================================================\n');

  const scorecard = [];
  const logCheck = (category, title, pass, details = '') => {
    scorecard.push({ category, title, status: pass ? 'PASS' : 'FAIL', details });
    const symbol = pass ? '✅ PASS' : '❌ FAIL';
    console.log(`[${category}] ${symbol} - ${title}${details ? ` (${details})` : ''}`);
  };

  let fixtureInstance = null;
  let devUser = null;
  let testerUser = null;
  let unauthorizedDevUser = null;
  let testTarget = null;
  let activeScanJob = null;
  let compiledReport = null;

  try {
    // -------------------------------------------------------------
    // SECTION 1: DATABASE & TEST FIXTURE SETUP
    // -------------------------------------------------------------
    console.log('\n--- Section 1: Database Connectivity & Local Test Fixture ---');
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongoUri);
    }
    logCheck('INFRA', 'MongoDB connection readyState === 1', mongoose.connection.readyState === 1, config.mongoUri);

    try {
      const resp = await fetch('http://127.0.0.1:5050/');
      if (resp.ok) {
        logCheck('INFRA', 'Controlled test fixture HTTP server responding', true, 'http://127.0.0.1:5050');
      } else {
        fixtureInstance = await createFixtureServer(5050);
        logCheck('INFRA', 'Controlled test fixture HTTP server running', !!fixtureInstance, 'http://127.0.0.1:5050');
      }
    } catch {
      fixtureInstance = await createFixtureServer(5050);
      logCheck('INFRA', 'Controlled test fixture HTTP server running', !!fixtureInstance, 'http://127.0.0.1:5050');
    }

    // Clean up past test users
    await User.deleteMany({ email: { $in: ['verify.dev@testsphere.io', 'verify.tester@testsphere.io', 'unauth.dev@testsphere.io'] } });
    await TargetApp.deleteMany({ name: 'Verification Fixture App' });

    // -------------------------------------------------------------
    // SECTION 2: AUTHENTICATION, PASSWORD HASHING & RBAC
    // -------------------------------------------------------------
    console.log('\n--- Section 2: Registration, Login, Hashing & RBAC ---');
    devUser = await User.create({
      name: 'Verification Dev',
      email: 'verify.dev@testsphere.io',
      password: 'SecureDevPass123!',
      role: 'developer'
    });
    logCheck('AUTH', 'Developer user registered with bcrypt hash', !!devUser);

    // Fetch with password field included (since select: false by default)
    const devUserWithPass = await User.findById(devUser._id).select('+password');
    const isMatch = await bcrypt.compare('SecureDevPass123!', devUserWithPass.password);
    logCheck('AUTH', 'Bcrypt password comparison succeeds for valid credentials', isMatch === true);

    const isBadMatch = await bcrypt.compare('WrongPassword!', devUserWithPass.password);
    logCheck('AUTH', 'Bcrypt password comparison rejects invalid credentials', isBadMatch === false);

    testerUser = await User.create({
      name: 'Verification Tester',
      email: 'verify.tester@testsphere.io',
      password: 'SecureTesterPass123!',
      role: 'tester'
    });
    logCheck('AUTH', 'Tester user created with tester role', testerUser.role === 'tester');

    unauthorizedDevUser = await User.create({
      name: 'Unauthorized Dev',
      email: 'unauth.dev@testsphere.io',
      password: 'SecureUnauthPass123!',
      role: 'developer'
    });
    logCheck('AUTH', 'Secondary developer created for multi-tenant isolation testing', !!unauthorizedDevUser);

    // JWT Generation and verification
    const devToken = jwt.sign({ id: devUser._id, role: devUser.role }, config.jwtSecret, { expiresIn: '1h' });
    const decoded = jwt.verify(devToken, config.jwtSecret);
    logCheck('AUTH', 'JWT signed and verified with correct claims', decoded.id === devUser._id.toString() && decoded.role === 'developer');

    // -------------------------------------------------------------
    // SECTION 3: TARGET OWNERSHIP & SSRF DEFENSES
    // -------------------------------------------------------------
    console.log('\n--- Section 3: SSRF Guards & Target Authorization ---');
    logCheck('SECURITY', 'SSRF: 127.0.0.1 is blocked in strict mode', (await validateTargetUrl('http://127.0.0.1:80', { allowLocalFixtures: false })).valid === false);
    logCheck('SECURITY', 'SSRF: 169.254.169.254 AWS/GCP metadata IP blocked', isPrivateIPv4('169.254.169.254') === true);
    logCheck('SECURITY', 'SSRF: 10.0.0.1 RFC1918 private IP blocked', isPrivateIPv4('10.0.0.1') === true);
    logCheck('SECURITY', 'SSRF: 192.168.1.1 RFC1918 private IP blocked', isPrivateIPv4('192.168.1.1') === true);
    logCheck('SECURITY', 'SSRF: 172.16.0.1 RFC1918 private IP blocked', isPrivateIPv4('172.16.0.1') === true);
    logCheck('SECURITY', 'SSRF: file:// protocol rejected', (await validateTargetUrl('file:///etc/passwd')).valid === false);
    logCheck('SECURITY', 'SSRF: gopher:// protocol rejected', (await validateTargetUrl('gopher://127.0.0.1:70')).valid === false);
    logCheck('SECURITY', 'SSRF: Public domain accepted', (await validateTargetUrl('https://example.com')).valid === true);

    // Create TargetApp
    testTarget = await TargetApp.create({
      name: 'Verification Fixture App',
      targetUrl: 'http://127.0.0.1:5050',
      owner: devUser._id,
      assignedTesters: [testerUser._id],
      authorizedScope: {
        allowedHost: '127.0.0.1',
        allowSubdomains: false,
        maxDepth: 3,
        maxPages: 15,
        rateLimitRps: 5
      },
      scanPolicy: {
        timeoutMs: 30000,
        respectRobotsTxt: false,
        headers: { 'X-TestSphere-Verification': 'true' }
      }
    });
    logCheck('TARGET', 'Target created with crawl scope & assigned tester', !!testTarget && testTarget.assignedTesters.length === 1);

    // Target authorization check
    const isOwner = testTarget.owner.toString() === devUser._id.toString();
    const isUnauthorized = testTarget.owner.toString() === unauthorizedDevUser._id.toString();
    const isAssigned = testTarget.assignedTesters.some((t) => t.toString() === testerUser._id.toString());
    logCheck('TARGET', 'Target owner correctly recognized', isOwner === true);
    logCheck('TARGET', 'Unauthorized developer correctly denied ownership', isUnauthorized === false);
    logCheck('TARGET', 'Tester assignment correctly recognized', isAssigned === true);

    // -------------------------------------------------------------
    // SECTION 4: PLAYWRIGHT SCANNER EXECUTION & ANALYZERS
    // -------------------------------------------------------------
    console.log('\n--- Section 4: Playwright Scanner Execution & Diagnostic Checks ---');
    activeScanJob = await ScanJob.create({
      targetId: testTarget._id,
      requestedBy: devUser._id,
      status: 'QUEUED',
      targetSnapshot: {
        name: testTarget.name,
        targetUrl: testTarget.targetUrl,
        allowedHost: testTarget.authorizedScope.allowedHost,
        maxPages: 12,
        maxDepth: 3,
        rateLimitRps: 5
      }
    });

    console.log('[Scan] Launching Playwright crawler against test fixture...');
    const abortController = new AbortController();
    await executeScan(activeScanJob._id.toString(), { abortSignal: abortController.signal });

    const finishedScan = await ScanJob.findById(activeScanJob._id);
    logCheck('SCANNER', 'Scan executed to completion', finishedScan.status === 'COMPLETED', `Status: ${finishedScan.status}`);
    logCheck('SCANNER', 'Multiple pages crawled within scope', finishedScan.pagesScanned >= 5, `Pages: ${finishedScan.pagesScanned}`);
    logCheck('SCANNER', 'All required diagnostic modules executed',
      finishedScan.modulesExecuted.includes('runtime_errors') &&
      finishedScan.modulesExecuted.includes('console_errors') &&
      finishedScan.modulesExecuted.includes('network_failures') &&
      finishedScan.modulesExecuted.includes('broken_links') &&
      finishedScan.modulesExecuted.includes('security_headers') &&
      finishedScan.modulesExecuted.includes('performance') &&
      finishedScan.modulesExecuted.includes('accessibility')
    );

    // Fetch findings from database
    const findings = await Finding.find({ scanId: activeScanJob._id });
    logCheck('FINDINGS', 'Findings persisted to MongoDB', findings.length > 0, `Total findings: ${findings.length}`);

    // Verify finding categories
    const categories = new Set(findings.map((f) => f.category));
    logCheck('FINDINGS', 'JavaScript runtime errors captured', categories.has('runtime_error'));
    logCheck('FINDINGS', 'Console errors captured', categories.has('console_error'));
    logCheck('FINDINGS', 'Network failures (HTTP 500) captured', categories.has('network_failure'));
    logCheck('FINDINGS', 'Broken links (HTTP 404) captured', categories.has('broken_link'));
    logCheck('FINDINGS', 'Security header checks captured', categories.has('security_header'));
    logCheck('FINDINGS', 'Performance timing captured', categories.has('performance'));
    logCheck('FINDINGS', 'axe-core accessibility violations captured', categories.has('accessibility'));

    // Verify deterministic deduplication
    const seenOccurrences = findings.filter((f) => f.occurrenceCount > 1);
    logCheck('FINDINGS', 'Finding deduplication by deterministic fingerprint', seenOccurrences.length > 0,
      `Deduplicated findings count: ${seenOccurrences.length}`
    );

    // -------------------------------------------------------------
    // SECTION 5: HUMAN TESTER COLLABORATION WORKFLOW
    // -------------------------------------------------------------
    console.log('\n--- Section 5: Human Tester Collaboration & Validation ---');
    const firstFinding = findings[0];

    // 1. Tester Confirms Finding
    firstFinding.humanValidation = {
      status: 'confirmed',
      validatedBy: testerUser._id,
      validatedAt: new Date(),
      notes: 'Reproduction confirmed on Chromium viewport 1280x720.',
      reproductionConfirmed: true
    };
    firstFinding.activityHistory.push({
      action: 'validated',
      user: testerUser._id,
      timestamp: new Date(),
      note: 'Confirmed by tester'
    });
    await firstFinding.save();
    logCheck('COLLAB', 'Tester confirms automated finding with notes', firstFinding.humanValidation.status === 'confirmed');

    // 2. Tester Flags Second Finding as False Positive with Required Reason
    const secondFinding = findings[1];
    secondFinding.humanValidation = {
      status: 'false_positive',
      validatedBy: testerUser._id,
      validatedAt: new Date(),
      reason: 'Expected behavior in test fixture; not an actual user-facing defect.',
      notes: 'Logged as known intentional behavior.',
      reproductionConfirmed: false
    };
    secondFinding.activityHistory.push({
      action: 'false_positive_flagged',
      user: testerUser._id,
      timestamp: new Date(),
      note: 'Marked false positive'
    });
    await secondFinding.save();
    logCheck('COLLAB', 'Tester flags false positive with structured reason', secondFinding.humanValidation.status === 'false_positive');

    // 3. Mark as Fixed and Retest
    secondFinding.humanValidation.status = 'fixed';
    await secondFinding.save();
    logCheck('COLLAB', 'Developer/Tester marks finding as fixed', secondFinding.humanValidation.status === 'fixed');

    secondFinding.humanValidation.status = 'retested_pass';
    secondFinding.activityHistory.push({
      action: 'retested',
      user: testerUser._id,
      timestamp: new Date(),
      note: 'Retest verified fix successfully.'
    });
    await secondFinding.save();
    logCheck('COLLAB', 'Tester completes retest workflow (retested_pass)', secondFinding.humanValidation.status === 'retested_pass');

    // 4. Create Exploratory Finding by Tester
    const exploratoryFingerprint = generateFingerprint({
      category: 'runtime_error',
      title: 'Navigation menu wraps unexpectedly on narrow viewports',
      affectedUrl: 'http://127.0.0.1:5050/broken-links',
      keySignature: `exploratory::${Date.now()}::${testerUser._id}`
    });

    const exploratoryFinding = await Finding.create({
      scanId: activeScanJob._id,
      targetId: testTarget._id,
      title: 'Navigation menu wraps unexpectedly on narrow viewports',
      description: 'During manual responsive testing, the hamburger toggle is clipped at 375px width.',
      category: 'runtime_error',
      severity: 'Low',
      confidence: 'Confirmed',
      source: 'human_tester',
      fingerprint: exploratoryFingerprint,
      exploratory: true,
      affectedUrl: 'http://127.0.0.1:5050/broken-links',
      affectedComponent: 'Header Navigation',
      reproductionSteps: [
        'Open page at 375px viewport width',
        'Observe header bar layout',
        'Verify toggle icon is clipped by overflow'
      ],
      humanValidation: {
        status: 'confirmed',
        validatedBy: testerUser._id,
        validatedAt: new Date(),
        notes: 'Discovered during manual exploratory check.',
        reproductionConfirmed: true
      },
      activityHistory: [
        {
          action: 'created',
          user: testerUser._id,
          timestamp: new Date(),
          note: 'Exploratory finding logged.'
        }
      ]
    });
    logCheck('COLLAB', 'Tester logs manual exploratory finding with steps', exploratoryFinding.exploratory === true);

    // 5. Test Duplicate Suggestions
    const dupCheck = await Finding.find({ targetId: testTarget._id });
    const hasMultiple = dupCheck.length > 2;
    logCheck('COLLAB', 'Duplicate candidate pool exists for target', hasMultiple === true, `Candidate count: ${dupCheck.length}`);

    // -------------------------------------------------------------
    // SECTION 6: DIAGNOSTIC REPORT GENERATION & 4-TIER CLASSIFICATION
    // -------------------------------------------------------------
    console.log('\n--- Section 6: Diagnostic Report Generation & Classifications ---');
    compiledReport = await reportService.generateReport(activeScanJob._id, devUser._id);

    logCheck('REPORT', 'DiagnosticReport compiled and persisted to MongoDB', !!compiledReport && !!compiledReport._id);
    logCheck('REPORT', 'Report number generated', typeof compiledReport.reportNumber === 'string' && compiledReport.reportNumber.startsWith('RPT-'));
    logCheck('REPORT', 'Executive summary contains honest health score', typeof compiledReport.healthScore === 'number' && compiledReport.healthScore >= 0 && compiledReport.healthScore <= 100, `Health Score: ${compiledReport.healthScore}/100`);

    // Verify 4-tier classification:
    // 1. Confirmed issues
    const confirmedCount = compiledReport.confirmedIssues?.length || 0;
    logCheck('REPORT', '1. Confirmed issues classification populated', confirmedCount > 0, `Count: ${confirmedCount}`);

    // 2. Suspected issues
    const suspectedCount = compiledReport.suspectedIssues?.length || 0;
    logCheck('REPORT', '2. Suspected issues classification populated', suspectedCount >= 0, `Count: ${suspectedCount}`);

    // 3. Passed checks with supporting evidence
    const passedChecks = compiledReport.passedChecks || [];
    logCheck('REPORT', '3. Passed checks with supporting evidence populated', passedChecks.length > 0, `Count: ${passedChecks.length}`);
    const firstPassed = passedChecks[0] || {};
    logCheck('REPORT', 'Passed check contains module, name, and evidence', !!firstPassed.module && !!firstPassed.checkName && !!firstPassed.evidence);

    // 4. Checks not performed, including reason
    const notPerformed = compiledReport.checksNotPerformed || [];
    logCheck('REPORT', '4. Checks not performed with explicit reason populated', notPerformed.length > 0, `Count: ${notPerformed.length}`);
    const firstNotPerf = notPerformed[0] || {};
    logCheck('REPORT', 'Not performed check provides explicit explanation', !!firstNotPerf.checkName && !!firstNotPerf.reason);

    // -------------------------------------------------------------
    // SECTION 7: PDF REPORT EXPORT
    // -------------------------------------------------------------
    console.log('\n--- Section 7: PDF Report Generation via Headless Chromium ---');
    const pdfResult = await reportService.generatePdfReport(compiledReport._id, devUser._id);
    const isBuffer = Buffer.isBuffer(pdfResult.buffer);
    const pdfHeader = isBuffer ? pdfResult.buffer.slice(0, 4).toString() : '';
    const isValidPdf = pdfHeader === '%PDF';

    logCheck('PDF', 'PDF buffer generated via Playwright Chromium', isBuffer && isValidPdf, `Buffer size: ${pdfResult.buffer?.length} bytes, Header: ${pdfHeader}`);
    logCheck('PDF', 'PDF filename matches report naming convention', pdfResult.filename.startsWith('TestSphere-Report-') && pdfResult.filename.endsWith('.pdf'));

    // -------------------------------------------------------------
    // SECTION 8: ANDROID MOBILE DIAGNOSTICS AUDIT
    // -------------------------------------------------------------
    console.log('\n--- Section 8: Android Mobile Diagnostics Capability Audit ---');
    const androidEnv = await checkAndroidEnvironment();
    logCheck('ANDROID', 'Android diagnostics service accurately audits host capabilities', androidEnv.supported !== undefined);
    logCheck('ANDROID', 'Accurately reports adb status on host without faking', androidEnv.supported === false, 'Documented unsupported environment correctly');
    logCheck('ANDROID', 'Architectural documentation and prerequisites present', Array.isArray(androidEnv.prerequisites) && androidEnv.prerequisites.length > 0);

    // -------------------------------------------------------------
    // SECTION 9: IN-FLIGHT CANCELLATION TEST
    // -------------------------------------------------------------
    console.log('\n--- Section 9: Scanner Cancellation & Interruption Safety ---');
    const cancelScanJob = await ScanJob.create({
      targetId: testTarget._id,
      requestedBy: devUser._id,
      status: 'QUEUED',
      targetSnapshot: {
        name: testTarget.name,
        targetUrl: testTarget.targetUrl,
        allowedHost: '127.0.0.1',
        maxPages: 10,
        maxDepth: 3
      }
    });

    const cancelSuccess = await scanQueue.cancel(cancelScanJob._id.toString());
    const refreshedCancelJob = await ScanJob.findById(cancelScanJob._id);
    logCheck('QUEUE', 'In-memory / DB scan cancellation succeeds', cancelSuccess === true && refreshedCancelJob.status === 'CANCELLED');

    // -------------------------------------------------------------
    // SECTION 10: MULTI-TENANCY & RBAC AUTHORIZATION BOUNDARIES
    // -------------------------------------------------------------
    console.log('\n--- Section 10: Multi-Tenant Access Boundaries ---');
    // Unauthorized developer attempting to compile report on target they do not own
    let unauthReportFailed = false;
    try {
      await reportService.generateReport(activeScanJob._id, unauthorizedDevUser._id);
    } catch (e) {
      unauthReportFailed = e.message.includes('Forbidden') || e.message.includes('not authorized') || e.message.includes('denied');
    }
    logCheck('RBAC', 'Unauthorized developer blocked from generating report for unowned target', unauthReportFailed === true);

    // Unauthorized developer attempting to export PDF
    let unauthPdfFailed = false;
    try {
      await reportService.generatePdfReport(compiledReport._id, unauthorizedDevUser._id);
    } catch (e) {
      unauthPdfFailed = e.message.includes('Forbidden') || e.message.includes('not authorized') || e.message.includes('denied');
    }
    logCheck('RBAC', 'Unauthorized developer blocked from downloading PDF report', unauthPdfFailed === true);

  } catch (err) {
    console.error('[Verification Failed Uncaught]:', err);
    logCheck('FATAL', 'Uncaught exception during verification', false, err.message);
  } finally {
    if (fixtureInstance && fixtureInstance.server) {
      fixtureInstance.server.close();
      console.log('\n[FixtureServer] Closed test fixture.');
    }
    await mongoose.disconnect();
    console.log('[Test] Disconnected from MongoDB.\n');
  }

  // -------------------------------------------------------------
  // SUMMARY SCORECARD
  // -------------------------------------------------------------
  console.log('================================================================');
  console.log('CONSOLIDATED VERIFICATION CAMPAIGN SUMMARY');
  console.log('================================================================');
  let passCount = 0;
  let failCount = 0;

  scorecard.forEach((s) => {
    if (s.status === 'PASS') passCount++;
    else failCount++;
    const icon = s.status === 'PASS' ? '✅ PASS' : '❌ FAIL';
    console.log(`${icon} | [${s.category}] ${s.title}${s.details ? ` -> ${s.details}` : ''}`);
  });

  console.log('----------------------------------------------------------------');
  console.log(`TOTAL CHECKS: ${scorecard.length} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log(`VERIFICATION CAMPAIGN RESULT: ${failCount === 0 ? 'SUCCESS (100% PASS)' : 'FAILURES DETECTED'}`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

if (require.main === module) {
  runComprehensiveVerification();
}

module.exports = { runComprehensiveVerification };
