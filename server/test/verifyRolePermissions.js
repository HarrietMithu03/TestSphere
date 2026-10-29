const mongoose = require('mongoose');
const config = require('../src/config/env');
const User = require('../src/models/User');
const TargetApp = require('../src/models/TargetApp');
const ScanJob = require('../src/models/ScanJob');
const Finding = require('../src/models/Finding');
const DiagnosticReport = require('../src/models/DiagnosticReport');

async function testRolePermissions() {
  console.log('====================================================');
  console.log('TestSphere Developer & Tester Role Permission Verification');
  console.log('====================================================\n');

  const BASE_URL = 'http://localhost:5000/api';
  let passedCount = 0;
  let failedCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passedCount++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failedCount++;
    }
  }

  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongoUri);
    }

    // 1. Setup Developer, Assigned Tester, and Unrelated Tester
    let dev = await User.findOne({ email: 'alex.dev@testsphere.io' });
    if (!dev) {
      dev = await User.create({
        name: 'Alex Developer',
        email: 'alex.dev@testsphere.io',
        password: 'SecurePassword123!',
        role: 'developer'
      });
    } else {
      dev.password = 'SecurePassword123!';
      await dev.save();
    }

    let assignedTester = await User.findOne({ email: 'taylor.qa@testsphere.io' });
    if (!assignedTester) {
      assignedTester = await User.create({
        name: 'Taylor Tester',
        email: 'taylor.qa@testsphere.io',
        password: 'Password@123',
        role: 'tester'
      });
    } else {
      assignedTester.password = 'Password@123';
      await assignedTester.save();
    }

    let unassignedTester = await User.findOne({ email: 'unassigned.tester@testsphere.io' });
    if (!unassignedTester) {
      unassignedTester = await User.create({
        name: 'Unassigned QA Tester',
        email: 'unassigned.tester@testsphere.io',
        password: 'Password@123',
        role: 'tester'
      });
    } else {
      unassignedTester.password = 'Password@123';
      await unassignedTester.save();
    }

    // Authenticate all three users
    const devLogin = await (await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alex.dev@testsphere.io', password: 'SecurePassword123!' })
    })).json();
    const devToken = devLogin.token;

    const assignedTesterLogin = await (await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'taylor.qa@testsphere.io', password: 'Password@123' })
    })).json();
    const testerToken = assignedTesterLogin.token;

    const unassignedTesterLogin = await (await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'unassigned.tester@testsphere.io', password: 'Password@123' })
    })).json();
    const unassignedToken = unassignedTesterLogin.token;

    console.log('[Auth] All 3 users authenticated successfully.\n');

    // 2. Setup Applications: One Assigned, One Unassigned
    const fixtureUrl = 'http://127.0.0.1:5050';

    // Application A: Assigned to Taylor
    let assignedApp = await TargetApp.findOne({ name: 'Assigned Benchmark Target' });
    if (!assignedApp) {
      assignedApp = await TargetApp.create({
        name: 'Assigned Benchmark Target',
        targetUrl: fixtureUrl,
        environment: 'development',
        owner: dev._id,
        assignedTesters: [assignedTester._id],
        authorizedScope: { allowedHost: '127.0.0.1', maxDepth: 2, maxPages: 5 },
        ownershipVerification: { status: 'verified', declarationConfirmed: true }
      });
    } else {
      assignedApp.assignedTesters = [assignedTester._id];
      await assignedApp.save();
    }

    // Application B: Private to Developer (Unassigned to any Tester)
    let privateApp = await TargetApp.findOne({ name: 'Private Unassigned Target' });
    if (!privateApp) {
      privateApp = await TargetApp.create({
        name: 'Private Unassigned Target',
        targetUrl: fixtureUrl,
        environment: 'staging',
        owner: dev._id,
        assignedTesters: [],
        authorizedScope: { allowedHost: '127.0.0.1', maxDepth: 2, maxPages: 5 },
        ownershipVerification: { status: 'verified', declarationConfirmed: true }
      });
    } else {
      privateApp.assignedTesters = [];
      await privateApp.save();
    }

    console.log('[Setup] Assigned and Private target applications configured.\n');

    // -----------------------------------------------------------------
    // TEST 1: Tester access to unassigned application must be rejected (403)
    // -----------------------------------------------------------------
    console.log('--- Test 1: Tester Access to Unassigned Application ---');
    const unassignedTargetRes = await fetch(`${BASE_URL}/targets/${privateApp._id}`, {
      headers: { 'Authorization': `Bearer ${testerToken}` }
    });
    assert(unassignedTargetRes.status === 403, `Tester accessing unassigned target returned 403 Forbidden (got ${unassignedTargetRes.status})`);

    // -----------------------------------------------------------------
    // TEST 2: Tester attempt to launch benchmark on unassigned application (403)
    // -----------------------------------------------------------------
    console.log('\n--- Test 2: Tester Benchmark on Unassigned Application ---');
    const unassignedBenchRes = await fetch(`${BASE_URL}/scans/benchmark`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${testerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: privateApp._id })
    });
    const unassignedBenchData = await unassignedBenchRes.json();
    assert(unassignedBenchRes.status === 403, `Tester launching benchmark on unassigned target returned 403 Forbidden (got ${unassignedBenchRes.status})`);
    assert(unassignedBenchData.message.includes('Forbidden') || unassignedBenchData.message.includes('not authorized'), `Error message clearly explains authorization denial`);

    // -----------------------------------------------------------------
    // TEST 3: Tester attempt to launch scan on unassigned application (403)
    // -----------------------------------------------------------------
    console.log('\n--- Test 3: Tester Scan on Unassigned Application ---');
    const unassignedScanRes = await fetch(`${BASE_URL}/scans`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${testerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: privateApp._id })
    });
    assert(unassignedScanRes.status === 403, `Tester creating scan on unassigned target returned 403 Forbidden (got ${unassignedScanRes.status})`);

    // -----------------------------------------------------------------
    // TEST 4: Tester with NO assigned applications running benchmark without targetId (403)
    // -----------------------------------------------------------------
    console.log('\n--- Test 4: Unassigned Tester Benchmark without Target ---');
    const noTargetBenchRes = await fetch(`${BASE_URL}/scans/benchmark`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${unassignedToken}`, 'Content-Type': 'application/json' }
    });
    assert(noTargetBenchRes.status === 403, `Unassigned tester calling /benchmark without targets returned 403 Forbidden (got ${noTargetBenchRes.status})`);

    // -----------------------------------------------------------------
    // TEST 5: Tester launches Live Benchmark on ASSIGNED application (200/201)
    // -----------------------------------------------------------------
    console.log('\n--- Test 5: Tester Launches Benchmark on ASSIGNED Application ---');
    const assignedBenchRes = await fetch(`${BASE_URL}/scans/benchmark`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${testerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: assignedApp._id })
    });
    const assignedBenchData = await assignedBenchRes.json();
    assert(assignedBenchRes.status === 201 || assignedBenchRes.status === 200, `Tester successfully initiated Live Benchmark on assigned target (status: ${assignedBenchRes.status})`);
    const testerScanId = assignedBenchData.scan?._id || assignedBenchData.scan?.id;
    assert(!!testerScanId, `Valid scan job returned with ID: ${testerScanId}`);

    // Wait for scan job to progress and complete
    let pollCount = 0;
    let scanDone = false;
    while (pollCount < 25 && !scanDone) {
      await new Promise(r => setTimeout(r, 1000));
      const poll = await (await fetch(`${BASE_URL}/scans/${testerScanId}`, {
        headers: { 'Authorization': `Bearer ${testerToken}` }
      })).json();
      if (['COMPLETED', 'PARTIALLY_COMPLETED'].includes(poll.scan?.status)) {
        scanDone = true;
      }
      pollCount++;
    }
    assert(scanDone, `Scan job transitioned to COMPLETED/PARTIALLY_COMPLETED state and tester can monitor progress`);

    // -----------------------------------------------------------------
    // TEST 6: Unassigned Tester access to another user's scan & findings (403)
    // -----------------------------------------------------------------
    console.log('\n--- Test 6: Cross-user Scan & Finding Protection ---');
    const crossScanRes = await fetch(`${BASE_URL}/scans/${testerScanId}`, {
      headers: { 'Authorization': `Bearer ${unassignedToken}` }
    });
    assert(crossScanRes.status === 403, `Unassigned tester accessing another user's scan returned 403 Forbidden (got ${crossScanRes.status})`);

    const crossFindingsRes = await fetch(`${BASE_URL}/scans/${testerScanId}/findings`, {
      headers: { 'Authorization': `Bearer ${unassignedToken}` }
    });
    assert(crossFindingsRes.status === 403, `Unassigned tester accessing another user's findings returned 403 Forbidden (got ${crossFindingsRes.status})`);

    // -----------------------------------------------------------------
    // TEST 7: Developer launches Live Benchmark on their owned target (200/201)
    // -----------------------------------------------------------------
    console.log('\n--- Test 7: Developer Launches Benchmark on Owned Target ---');
    const devBenchRes = await fetch(`${BASE_URL}/scans/benchmark`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${devToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: privateApp._id })
    });
    assert(devBenchRes.status === 201 || devBenchRes.status === 200, `Developer successfully initiated benchmark on owned target (status: ${devBenchRes.status})`);

    // -----------------------------------------------------------------
    // TEST 8: Finding Validation, False-Positive Reason Requirement & Retest
    // -----------------------------------------------------------------
    console.log('\n--- Test 8: Finding Validation & False Positive Requirement ---');
    // Create a finding on assigned target for validation testing
    const testFinding = await Finding.create({
      scanId: testerScanId,
      targetId: assignedApp._id,
      category: 'runtime_error',
      title: 'Validation & Retest Verification Issue',
      description: 'Testing human tester validation workflow',
      severity: 'High',
      confidence: 'Confirmed',
      affectedUrl: 'http://127.0.0.1:5050/test-route',
      source: 'automated_crawler',
      fingerprint: 'test-fingerprint-' + Date.now()
    });

    // 8a. False positive WITHOUT reason must be rejected with 400
    const badFpRes = await fetch(`${BASE_URL}/findings/${testFinding._id}/validate`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${testerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'false_positive', reason: '', notes: '' })
    });
    assert(badFpRes.status === 400, `False positive without reason rejected with 400 Bad Request (got ${badFpRes.status})`);

    // 8b. False positive WITH reason succeeds
    const goodFpRes = await fetch(`${BASE_URL}/findings/${testFinding._id}/validate`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${testerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'false_positive', reason: 'Intentional test mock error on fixture.' })
    });
    assert(goodFpRes.status === 200, `False positive with reason accepted (status: ${goodFpRes.status})`);

    // 8c. Retesting finding as fixed / retested_pass succeeds
    const retestRes = await fetch(`${BASE_URL}/findings/${testFinding._id}/validate`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${testerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'retested_pass', notes: 'Retested in Chromium; issue resolved.' })
    });
    const retestData = await retestRes.json();
    assert(retestRes.status === 200, `Tester retested finding to retested_pass (status: ${retestRes.status})`);
    assert(retestData.finding?.humanValidation?.status === 'retested_pass', `Finding validation status correctly updated in database`);

    // -----------------------------------------------------------------
    // TEST 9: Exploratory Bug Submission by Tester
    // -----------------------------------------------------------------
    console.log('\n--- Test 9: Exploratory Bug Report Submission ---');
    const exploratoryRes = await fetch(`${BASE_URL}/findings/exploratory`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${testerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scanId: testerScanId,
        targetId: assignedApp._id,
        title: 'Exploratory Bug: Responsive Header Misalignment',
        description: 'Header elements overlap at viewport width < 768px',
        category: 'accessibility',
        severity: 'Medium',
        affectedUrl: 'http://127.0.0.1:5050/responsive',
        reproductionSteps: [
          'Navigate to /responsive',
          'Resize browser viewport to 375px',
          'Observe header text overlapping button'
        ]
      })
    });
    const exploratoryData = await exploratoryRes.json();
    assert(exploratoryRes.status === 201, `Tester submitted exploratory finding with reproduction steps (status: ${exploratoryRes.status})`);
    assert(exploratoryData.finding?.source === 'human_tester', `Finding source marked as human_tester`);
    assert(exploratoryData.finding?.reproductionSteps?.length === 3, `Reproduction steps persisted correctly`);

    // -----------------------------------------------------------------
    // TEST 10: Reports access & cross-user report protection
    // -----------------------------------------------------------------
    console.log('\n--- Test 10: Report Access & Cross-User Security ---');
    const reportRes = await fetch(`${BASE_URL}/reports`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${testerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scanId: testerScanId })
    });
    const reportData = await reportRes.json();
    assert(reportRes.status === 201 || reportRes.status === 200, `Tester can generate report for assigned target scan (status: ${reportRes.status})`);
    const reportId = reportData.report?._id || reportData.report?.id;

    if (reportId) {
      const crossReportRes = await fetch(`${BASE_URL}/reports/${reportId}`, {
        headers: { 'Authorization': `Bearer ${unassignedToken}` }
      });
      assert(crossReportRes.status === 403, `Unassigned user rejected from accessing report with 403 Forbidden (got ${crossReportRes.status})`);

      const crossPdfRes = await fetch(`${BASE_URL}/reports/${reportId}/pdf`, {
        headers: { 'Authorization': `Bearer ${unassignedToken}` }
      });
      assert(crossPdfRes.status === 403, `Unassigned user rejected from downloading report PDF with 403 Forbidden (got ${crossPdfRes.status})`);
    }

    console.log('\n====================================================');
    console.log(`Results: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('====================================================');
  } catch (err) {
    console.error('Fatal error during role permission verification:', err);
    failedCount++;
  } finally {
    await mongoose.disconnect();
    process.exit(failedCount > 0 ? 1 : 0);
  }
}

testRolePermissions();
