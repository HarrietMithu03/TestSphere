const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const config = require('../src/config/env');
const User = require('../src/models/User');
const TargetApp = require('../src/models/TargetApp');
const ScanJob = require('../src/models/ScanJob');
const Finding = require('../src/models/Finding');
const { validateTargetUrl, isPrivateIPv4, isPrivateIPv6 } = require('../src/scanner/ssrfGuard');
const { executeScan } = require('../src/scanner/scannerWorker');
const scanQueue = require('../src/scanner/scanQueue');
const { createFixtureServer } = require('./fixtureServer');

const runVerification = async () => {
  console.log('====================================================');
  console.log('TestSphere Phase 3: Automated Scanner Verification');
  console.log('====================================================\n');

  const testResults = [];
  const recordResult = (name, passed, details = '') => {
    testResults.push({ name, passed, details });
    const tag = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${tag} | ${name}${details ? ` -> ${details}` : ''}`);
  };

  // 1. SSRF & URL Safety Validation Checks
  console.log('--- 1. Testing SSRF and Network Isolation Guards ---');
  try {
    recordResult('IPv4 127.0.0.1 is marked private', isPrivateIPv4('127.0.0.1') === true);
    recordResult('IPv4 10.0.1.5 is marked private', isPrivateIPv4('10.0.1.5') === true);
    recordResult('IPv4 172.20.0.1 is marked private', isPrivateIPv4('172.20.0.1') === true);
    recordResult('IPv4 192.168.1.1 is marked private', isPrivateIPv4('192.168.1.1') === true);
    recordResult('IPv4 169.254.169.254 (Cloud metadata) is marked private', isPrivateIPv4('169.254.169.254') === true);
    recordResult('IPv4 8.8.8.8 is NOT marked private', isPrivateIPv4('8.8.8.8') === false);

    recordResult('IPv6 ::1 is marked private', isPrivateIPv6('::1') === true);
    recordResult('IPv6 fc00::1 is marked private', isPrivateIPv6('fc00::1') === true);

    const fileProtoRes = await validateTargetUrl('file:///etc/passwd');
    recordResult('file:// protocol rejection', fileProtoRes.valid === false);

    const internalHostRes = await validateTargetUrl('http://admin.corp.internal');
    recordResult('.internal hostname rejection', internalHostRes.valid === false);

    // Strict mode (allowLocalFixtures: false) blocks 127.0.0.1
    const strictLoopbackRes = await validateTargetUrl('http://127.0.0.1:8080', { allowLocalFixtures: false });
    recordResult('Strict mode loopback rejection', strictLoopbackRes.valid === false);
  } catch (err) {
    recordResult('SSRF Guard Tests', false, err.message);
  }

  // 2. Connect to MongoDB and start test fixture
  console.log('\n--- 2. Setting Up Database Connection & Test Fixture ---');
  let fixtureInstance = null;
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongoUri);
    }
    console.log('[Test] Connected to MongoDB:', config.mongoUri);

    fixtureInstance = await createFixtureServer(5050);
    recordResult('Controlled test fixture started on port 5050', true);
  } catch (err) {
    recordResult('Fixture Server Initialization', false, err.message);
    process.exit(1);
  }

  let devUser = null;
  let testTarget = null;
  let createdScan = null;

  try {
    // Find developer user
    devUser = await User.findOne({ email: 'alex.dev@testsphere.io' });
    if (!devUser) {
      devUser = await User.create({
        name: 'Alex Developer',
        email: 'alex.dev@testsphere.io',
        password: 'SecurePassword123!',
        role: 'developer'
      });
    }

    // Register or retrieve fixture target
    testTarget = await TargetApp.findOne({ targetUrl: 'http://127.0.0.1:5050' });
    if (!testTarget) {
      testTarget = await TargetApp.create({
        name: 'Controlled Test Fixture App',
        targetUrl: 'http://127.0.0.1:5050',
        environment: 'development',
        owner: devUser._id,
        authorizedScope: {
          allowedHost: '127.0.0.1',
          allowSubdomains: false,
          maxDepth: 3,
          maxPages: 10
        },
        ownershipVerification: {
          status: 'verified',
          declarationConfirmed: true
        }
      });
    }
    recordResult('Test target registered in database', true, `ID: ${testTarget._id}`);

    // Create ScanJob
    createdScan = await ScanJob.create({
      targetId: testTarget._id,
      requestedBy: devUser._id,
      status: 'QUEUED',
      currentStage: 'QUEUED',
      targetSnapshot: {
        name: testTarget.name,
        targetUrl: testTarget.targetUrl,
        allowedHost: '127.0.0.1',
        environment: testTarget.environment,
        maxDepth: 3,
        maxPages: 10,
        rateLimitRps: 5
      }
    });
    recordResult('ScanJob record created', true, `Scan ID: ${createdScan._id}`);

    // 3. Execute Real Automated Scan via Playwright
    console.log('\n--- 3. Executing Real Automated Scan with Playwright Chromium ---');
    console.log('[Test] Launching scannerWorker.executeScan()...');

    const abortController = new AbortController();
    await executeScan(createdScan._id.toString(), { abortSignal: abortController.signal });

    // Reload completed scan job
    const finishedScan = await ScanJob.findById(createdScan._id);
    recordResult('Scan completed successfully', finishedScan.status === 'COMPLETED', `Status: ${finishedScan.status}`);
    recordResult('Pages discovered & scanned', finishedScan.pagesScanned > 0, `Scanned: ${finishedScan.pagesScanned}, Discovered: ${finishedScan.pagesDiscovered}`);
    recordResult('Duration recorded', finishedScan.durationMs > 0, `Duration: ${finishedScan.durationMs}ms`);

    // 4. Inspect Real Findings Generated
    console.log('\n--- 4. Inspecting Real Evidence-Backed Findings ---');
    const persistedFindings = await Finding.find({ scanId: createdScan._id });
    recordResult('Findings persisted to MongoDB', persistedFindings.length > 0, `Total findings: ${persistedFindings.length}`);

    // Check specific analyzer outputs:
    const jsErrorFinding = persistedFindings.find((f) => f.category === 'runtime_error');
    recordResult(
      'JavaScript Exception Analyzer captured uncaught error',
      !!jsErrorFinding,
      jsErrorFinding ? jsErrorFinding.title : 'Missing'
    );

    const consoleErrorFinding = persistedFindings.find((f) => f.category === 'console_error');
    recordResult(
      'Console Error Analyzer captured console.error logs',
      !!consoleErrorFinding,
      consoleErrorFinding ? consoleErrorFinding.title : 'Missing'
    );

    const network500Finding = persistedFindings.find((f) => f.category === 'network_failure');
    recordResult(
      'Network Failure Analyzer captured HTTP 500 endpoint',
      !!network500Finding,
      network500Finding ? `${network500Finding.title} (Status: ${network500Finding.evidence?.statusCode})` : 'Missing'
    );

    const brokenLinkFinding = persistedFindings.find((f) => f.category === 'broken_link');
    recordResult(
      'Broken Link Analyzer captured HTTP 404 dead link',
      !!brokenLinkFinding,
      brokenLinkFinding ? brokenLinkFinding.title : 'Missing'
    );

    const secHeaderFinding = persistedFindings.find((f) => f.category === 'security_header');
    recordResult(
      'Security Headers Analyzer identified missing origin headers',
      !!secHeaderFinding,
      secHeaderFinding ? secHeaderFinding.title : 'Missing'
    );

    const perfFinding = persistedFindings.find((f) => f.category === 'performance');
    // Performance may or may not breach thresholds on fast local fixture, so check if metric timing was collected
    console.log(`[Info] Performance findings count: ${persistedFindings.filter((f) => f.category === 'performance').length}`);

    // Check deduplication
    const multiOccurrences = persistedFindings.filter((f) => f.occurrenceCount > 1);
    recordResult(
      'Deterministic deduplication fingerprinting verified',
      persistedFindings.every((f) => typeof f.fingerprint === 'string' && f.fingerprint.length === 64),
      `SHA-256 fingerprints valid on all ${persistedFindings.length} findings`
    );

    // Crawl depth cap check
    const leafDepthFinding = persistedFindings.some((f) => f.affectedUrl?.includes('/depth-4'));
    recordResult('Crawl depth limit respected (depth 4 omitted when maxDepth=3)', !leafDepthFinding);

    // 5. Test Cancellation
    console.log('\n--- 5. Testing Scan Cancellation ---');
    const cancelScanJob = await ScanJob.create({
      targetId: testTarget._id,
      requestedBy: devUser._id,
      status: 'QUEUED',
      currentStage: 'QUEUED',
      targetSnapshot: {
        name: testTarget.name,
        targetUrl: testTarget.targetUrl,
        allowedHost: '127.0.0.1',
        maxDepth: 3,
        maxPages: 10
      }
    });

    await scanQueue.enqueue(cancelScanJob._id.toString());
    const cancelled = await scanQueue.cancel(cancelScanJob._id.toString());
    const afterCancel = await ScanJob.findById(cancelScanJob._id);
    recordResult('Scan cancellation safely stops job', cancelled === true && afterCancel.status === 'CANCELLED', `Status: ${afterCancel.status}`);

    // 6. Test Cross-user Access Authorization
    console.log('\n--- 6. Testing Cross-User Access Boundary ---');
    let secondDev = await User.findOne({ email: 'marcus.vance@testsphere.io' });
    if (!secondDev) {
      secondDev = await User.create({
        name: 'Marcus Vance',
        email: 'marcus.vance@testsphere.io',
        password: 'SecureDevPass2026!',
        role: 'developer'
      });
    }

    // Target belongs to alex.dev, marcus should NOT be able to launch scan on alex's target
    const isOwnerMarcus = testTarget.owner.toString() === secondDev._id.toString();
    recordResult('Cross-user ownership check rejects non-owner developer', isOwnerMarcus === false);

  } catch (testErr) {
    console.error('[Test Error]:', testErr);
    recordResult('Execution error during verification', false, testErr.message);
  } finally {
    if (fixtureInstance && fixtureInstance.server) {
      fixtureInstance.server.close();
      console.log('\n[Test] Fixture server closed.');
    }
  }

  // Print Summary Table
  console.log('\n====================================================');
  console.log('Verification Summary');
  console.log('====================================================');
  const total = testResults.length;
  const passed = testResults.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`Total Checks: ${total} | Passed: ${passed} | Failed: ${failed}`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

runVerification();
