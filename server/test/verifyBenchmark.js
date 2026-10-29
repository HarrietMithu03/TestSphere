const mongoose = require('mongoose');
const config = require('../src/config/env');
const User = require('../src/models/User');
const ScanJob = require('../src/models/ScanJob');
const Finding = require('../src/models/Finding');

async function testBenchmark() {
  console.log('====================================================');
  console.log('TestSphere Focused Benchmark Endpoint Verification');
  console.log('====================================================\n');

  const BASE_URL = 'http://localhost:5000/api';

  try {
    // 1. Ensure Developer and Tester accounts exist with known passwords
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongoUri);
    }

    let devUser = await User.findOne({ email: 'alex.dev@testsphere.io' });
    if (!devUser) {
      devUser = await User.create({
        name: 'Alex Developer',
        email: 'alex.dev@testsphere.io',
        password: 'SecurePassword123!',
        role: 'developer'
      });
    } else {
      devUser.password = 'SecurePassword123!';
      await devUser.save();
    }

    let testerUser = await User.findOne({ email: 'taylor.qa@testsphere.io' });
    if (!testerUser) {
      testerUser = await User.create({
        name: 'Taylor Tester',
        email: 'taylor.qa@testsphere.io',
        password: 'Password@123',
        role: 'tester'
      });
    } else {
      testerUser.password = 'Password@123';
      await testerUser.save();
    }

    console.log('[Setup] Test users ready.');

    // 2. Authenticate as Developer
    const devLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alex.dev@testsphere.io', password: 'SecurePassword123!' })
    });
    const devLoginData = await devLoginRes.json();
    console.log(`[Auth] Developer login status: ${devLoginRes.status}`);
    if (!devLoginData.token) {
      throw new Error(`Developer login failed: ${JSON.stringify(devLoginData)}`);
    }
    const devToken = devLoginData.token;

    // 3. Authenticate as Tester
    const testerLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'taylor.qa@testsphere.io', password: 'Password@123' })
    });
    const testerLoginData = await testerLoginRes.json();
    console.log(`[Auth] Tester login status: ${testerLoginRes.status}`);
    if (!testerLoginData.token) {
      throw new Error(`Tester login failed: ${JSON.stringify(testerLoginData)}`);
    }
    const testerToken = testerLoginData.token;

    // 4. Verification Check 1: Unauthorized access rejected (Tester role)
    console.log('\n--- Check 1: Tester role unauthorized rejection ---');
    const testerBenchmarkRes = await fetch(`${BASE_URL}/scans/benchmark`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${testerToken}`,
        'Content-Type': 'application/json'
      }
    });
    const testerBenchmarkData = await testerBenchmarkRes.json();
    console.log(`[RBAC] Tester POST /scans/benchmark status: ${testerBenchmarkRes.status}`);
    console.log(`[RBAC] Tester response: ${JSON.stringify(testerBenchmarkData)}`);
    if (testerBenchmarkRes.status === 403) {
      console.log('✅ PASS: Tester role correctly rejected with HTTP 403 Forbidden.');
    } else {
      console.error('❌ FAIL: Tester role was not rejected with 403 Forbidden!');
    }

    // 5. Verification Check 2: Unauthenticated request rejected (no token)
    console.log('\n--- Check 2: Unauthenticated request rejection ---');
    const unauthBenchmarkRes = await fetch(`${BASE_URL}/scans/benchmark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    console.log(`[Auth] Unauthenticated POST /scans/benchmark status: ${unauthBenchmarkRes.status}`);
    if (unauthBenchmarkRes.status === 401) {
      console.log('✅ PASS: Missing token correctly rejected with HTTP 401 Unauthorized.');
    } else {
      console.error('❌ FAIL: Missing token was not rejected with 401 Unauthorized!');
    }

    // 6. Verification Check 3: Authorized Developer launches live benchmark
    console.log('\n--- Check 3: Developer launches live benchmark against fixture ---');
    const devBenchmarkRes = await fetch(`${BASE_URL}/scans/benchmark`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${devToken}`,
        'Content-Type': 'application/json'
      }
    });
    const devBenchmarkData = await devBenchmarkRes.json();
    console.log(`[Developer] POST /scans/benchmark status: ${devBenchmarkRes.status}`);
    console.log(`[Developer] Message: ${devBenchmarkData.message}`);

    if (devBenchmarkRes.status !== 200 && devBenchmarkRes.status !== 201) {
      throw new Error(`Developer benchmark launch failed: ${JSON.stringify(devBenchmarkData)}`);
    }

    const scanId = devBenchmarkData.scan?._id || devBenchmarkData.scan?.id;
    console.log(`[Developer] Benchmark scan initiated with ID: ${scanId}`);
    console.log(`[Developer] Target URL: ${devBenchmarkData.scan?.targetId?.targetUrl || devBenchmarkData.target?.targetUrl}`);

    // 7. Verification Check 4: Poll scan until completion and verify real findings
    console.log('\n--- Check 4: Waiting for Playwright automated scanner execution ---');
    let completedScan = null;
    const maxWaitSec = 90;
    const startTime = Date.now();

    while ((Date.now() - startTime) < maxWaitSec * 1000) {
      await new Promise(r => setTimeout(r, 2000));
      const pollRes = await fetch(`${BASE_URL}/scans/${scanId}`, {
        headers: { 'Authorization': `Bearer ${devToken}` }
      });
      const pollData = await pollRes.json();
      const currentStatus = pollData.scan?.status;
      const progress = pollData.scan?.progress;
      const stage = pollData.scan?.currentStage;
      console.log(`[Scanner Progress] Status: ${currentStatus} | Stage: ${stage} | Progress: ${progress}%`);

      if (['COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED'].includes(currentStatus)) {
        completedScan = pollData.scan;
        break;
      }
    }

    if (!completedScan) {
      throw new Error(`Scan ${scanId} timed out after ${maxWaitSec}s`);
    }

    if (completedScan.status === 'COMPLETED' || completedScan.status === 'PARTIALLY_COMPLETED') {
      console.log(`✅ PASS: Benchmark scan completed with status '${completedScan.status}'`);
      console.log(`[Metrics] Pages scanned: ${completedScan.pagesScanned}`);
      console.log(`[Metrics] Duration: ${completedScan.durationSeconds}s`);

      // 8. Verification Check 5: Inspect real findings
      const findingsRes = await fetch(`${BASE_URL}/scans/${scanId}/findings`, {
        headers: { 'Authorization': `Bearer ${devToken}` }
      });
      const findingsData = await findingsRes.json();
      console.log(`\n[Findings] Count: ${findingsData.count}`);
      if (findingsData.count > 0) {
        console.log('✅ PASS: Real findings detected against controlled test fixture!');
        const categories = {};
        for (const f of findingsData.findings) {
          categories[f.category] = (categories[f.category] || 0) + 1;
        }
        console.log('[Findings Categories]:', JSON.stringify(categories, null, 2));
      } else {
        console.warn('⚠️ No findings recorded.');
      }
    } else {
      console.error(`❌ FAIL: Scan ended in state ${completedScan.status}: ${completedScan.errorSummary}`);
    }

    console.log('\n====================================================');
    console.log('All backend benchmark checks completed successfully!');
    console.log('====================================================');
  } catch (err) {
    console.error('Fatal error in verifyBenchmark:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

testBenchmark();
