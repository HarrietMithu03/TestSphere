// Built-in global fetch available in Node.js 24

const API_BASE = 'http://localhost:5000/api';

async function runAuditJourneys() {
  console.log('================================================================');
  console.log('TestSphere: User Journeys & Cross-Tenant Audit');
  console.log('Testing against active backend: ' + API_BASE);
  console.log('================================================================\n');

  const timestamp = Date.now();
  const devEmail = `dev_audit_${timestamp}@testsphere.io`;
  const testerEmail = `tester_audit_${timestamp}@testsphere.io`;
  const unauthEmail = `unauth_audit_${timestamp}@testsphere.io`;
  const password = 'AuditSecurePassword@2026';

  let devToken, testerToken, unauthDevToken;
  let devUser, testerUser, unauthDevUser;
  let targetId, scanId, reportId;
  let findingIds = [];

  const check = (title, condition, details = '') => {
    const symbol = condition ? '✅ PASS' : '❌ FAIL';
    console.log(`${symbol} - ${title}${details ? ` (${details})` : ''}`);
    if (!condition) {
      throw new Error(`Audit Assertion Failed: ${title} -> ${details}`);
    }
  };

  // -------------------------------------------------------------
  // STEP 1: DEVELOPER ONBOARDING & TARGET REGISTRATION
  // -------------------------------------------------------------
  console.log('--- Step 1: Developer Registration & Sign In ---');
  const devRegRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Audit Lead Developer',
      email: devEmail,
      password,
      role: 'developer'
    })
  });
  const devRegData = await devRegRes.json();
  check('Developer registered successfully', devRegRes.status === 201 && !!devRegData.token);
  devToken = devRegData.token;
  devUser = devRegData.user;

  // Verify getMe
  const meRes = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${devToken}` }
  });
  const meData = await meRes.json();
  check('Developer session verified via /auth/me', meRes.status === 200 && meData.user.email === devEmail);

  console.log('\n--- Step 2: Target Registration with Declaration ---');
  const targetRes = await fetch(`${API_BASE}/targets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${devToken}`
    },
    body: JSON.stringify({
      name: `Audit Web App ${timestamp}`,
      targetUrl: 'http://127.0.0.1:5050',
      environment: 'staging',
      allowSubdomains: false,
      maxDepth: 3,
      maxPages: 10,
      declarationConfirmed: true
    })
  });
  const targetData = await targetRes.json();
  const tId = targetData.target?.id || targetData.target?._id;
  const dId = devUser.id || devUser._id;
  check('Target registered with legal authorization declaration', targetRes.status === 201 && !!tId);
  targetId = tId;
  check('Target owner strictly assigned from JWT', targetData.target.owner === dId);

  // -------------------------------------------------------------
  // STEP 2: LAUNCH & MONITOR AUTOMATED SCAN
  // -------------------------------------------------------------
  console.log('\n--- Step 3: Launching Automated Scan ---');
  const scanRes = await fetch(`${API_BASE}/scans`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${devToken}`
    },
    body: JSON.stringify({ targetId })
  });
  const scanData = await scanRes.json();
  scanId = scanData.scan?.id || scanData.scan?._id;
  check('Diagnostic scan launched & queued', scanRes.status === 201 && !!scanId);

  console.log(`[Scan] Waiting for scan ${scanId} to process...`);
  let scanFinished = false;
  let attempts = 0;
  while (!scanFinished && attempts < 30) {
    await new Promise((r) => setTimeout(r, 2000));
    attempts++;
    const statusRes = await fetch(`${API_BASE}/scans/${scanId}`, {
      headers: { Authorization: `Bearer ${devToken}` }
    });
    const statusData = await statusRes.json();
    const currentStatus = statusData.scan?.status;
    process.stdout.write(`  [Polling] Attempt ${attempts}: Status=${currentStatus}, Progress=${statusData.scan?.progress}%\r`);

    if (currentStatus === 'COMPLETED' || currentStatus === 'PARTIALLY_COMPLETED' || currentStatus === 'FAILED') {
      scanFinished = true;
      console.log(`\n[Scan] Terminal status reached: ${currentStatus}`);
      check('Scan completed successfully', currentStatus === 'COMPLETED' || currentStatus === 'PARTIALLY_COMPLETED', `Pages: ${statusData.scan?.pagesScanned}`);
    }
  }

  // Retrieve findings
  const findingsRes = await fetch(`${API_BASE}/scans/${scanId}/findings`, {
    headers: { Authorization: `Bearer ${devToken}` }
  });
  const findingsData = await findingsRes.json();
  check('Findings retrieved for scan', findingsRes.status === 200 && findingsData.count > 0, `Count: ${findingsData.count}`);
  findingIds = findingsData.findings.map((f) => f.id || f._id);

  // -------------------------------------------------------------
  // STEP 3: DIAGNOSTIC REPORT & PDF EXPORT
  // -------------------------------------------------------------
  console.log('\n--- Step 4: Diagnostic Report Generation & PDF Download ---');
  const reportRes = await fetch(`${API_BASE}/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${devToken}`
    },
    body: JSON.stringify({ scanId })
  });
  const reportData = await reportRes.json();
  reportId = reportData.report?.id || reportData.report?._id;
  check('Diagnostic report compiled', reportRes.status === 201 && !!reportId);
  check('Report has valid reportNumber', typeof reportData.report.reportNumber === 'string' && reportData.report.reportNumber.startsWith('RPT-'));
  check('Report has 4 check classifications',
    Array.isArray(reportData.report.confirmedIssues) &&
    Array.isArray(reportData.report.suspectedIssues) &&
    Array.isArray(reportData.report.passedChecks) && reportData.report.passedChecks.length > 0 &&
    Array.isArray(reportData.report.checksNotPerformed) && reportData.report.checksNotPerformed.length > 0
  );

  // PDF download
  const pdfRes = await fetch(`${API_BASE}/reports/${reportId}/pdf`, {
    headers: { Authorization: `Bearer ${devToken}` }
  });
  check('PDF download responds with 200 OK', pdfRes.status === 200);
  const arrayBuf = await pdfRes.arrayBuffer();
  const pdfBuffer = Buffer.from(arrayBuf);
  const pdfHeader = pdfBuffer.slice(0, 4).toString();
  check('PDF binary buffer is valid (%PDF header)', pdfHeader === '%PDF', `Size: ${pdfBuffer.length} bytes`);

  // -------------------------------------------------------------
  // STEP 4: TESTER ONBOARDING & ASSIGNMENT
  // -------------------------------------------------------------
  console.log('\n--- Step 5: Tester Onboarding & Assignment ---');
  const testerRegRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'QA Lead Tester',
      email: testerEmail,
      password,
      role: 'tester'
    })
  });
  const testerRegData = await testerRegRes.json();
  check('Tester registered successfully', testerRegRes.status === 201 && !!testerRegData.token);
  testerToken = testerRegData.token;
  testerUser = testerRegData.user;

  // Developer assigns Tester to target
  const assignRes = await fetch(`${API_BASE}/targets/${targetId}/assign-tester`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${devToken}`
    },
    body: JSON.stringify({ email: testerEmail })
  });
  const assignData = await assignRes.json();
  check('Developer assigns tester to target', assignRes.status === 200 && assignData.target?.assignedTesters?.some((t) => t.email === testerEmail));

  // -------------------------------------------------------------
  // STEP 5: TESTER WORKFLOW (FINDING VALIDATION & RETESTING)
  // -------------------------------------------------------------
  console.log('\n--- Step 6: Tester Workflow (Triage, Validation, Retest) ---');
  // Tester accesses target list
  const testerTargetsRes = await fetch(`${API_BASE}/targets`, {
    headers: { Authorization: `Bearer ${testerToken}` }
  });
  const testerTargetsData = await testerTargetsRes.json();
  check('Tester can see assigned target in list', testerTargetsData.targets?.some((t) => (t.id || t._id) === targetId));

  // 1. Tester Confirms Finding
  const targetFindingId1 = findingIds[0];
  const confirmRes = await fetch(`${API_BASE}/findings/${targetFindingId1}/validate`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${testerToken}`
    },
    body: JSON.stringify({
      status: 'confirmed',
      notes: 'Reproduction verified on Desktop Chromium 1920x1080.',
      reproductionConfirmed: true
    })
  });
  const confirmData = await confirmRes.json();
  check('Tester confirms automated finding', confirmRes.status === 200 && confirmData.finding?.humanValidation?.status === 'confirmed');

  // 2. Tester Flags False Positive - Negative test (missing reason)
  const targetFindingId2 = findingIds[1];
  const fpMissingRes = await fetch(`${API_BASE}/findings/${targetFindingId2}/validate`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${testerToken}`
    },
    body: JSON.stringify({
      status: 'false_positive'
    })
  });
  check('False positive without reason is rejected (HTTP 400)', fpMissingRes.status === 400);

  // False Positive with reason
  const fpRes = await fetch(`${API_BASE}/findings/${targetFindingId2}/validate`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${testerToken}`
    },
    body: JSON.stringify({
      status: 'false_positive',
      reason: 'Feature is gated behind beta flag; expected HTTP 404 in staging environment.'
    })
  });
  const fpData = await fpRes.json();
  check('False positive with valid technical reason accepted', fpRes.status === 200 && fpData.finding?.humanValidation?.status === 'false_positive');

  // 3. Mark as Fixed and Retest Pass
  const targetFindingId3 = findingIds[2];
  const fixRes = await fetch(`${API_BASE}/findings/${targetFindingId3}/validate`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${testerToken}`
    },
    body: JSON.stringify({ status: 'fixed', notes: 'Patch deployed by developer.' })
  });
  check('Finding marked as fixed', fixRes.status === 200);

  const retestRes = await fetch(`${API_BASE}/findings/${targetFindingId3}/validate`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${testerToken}`
    },
    body: JSON.stringify({
      status: 'retested_pass',
      notes: 'Retest verified fix successfully.'
    })
  });
  const retestData = await retestRes.json();
  check('Tester completes retest workflow (retested_pass)', retestRes.status === 200 && retestData.finding?.humanValidation?.status === 'retested_pass');

  // 4. Log Exploratory Bug
  console.log('\n--- Step 7: Tester Exploratory Bug Logging ---');
  const exploratoryRes = await fetch(`${API_BASE}/findings/exploratory`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${testerToken}`
    },
    body: JSON.stringify({
      scanId,
      targetId,
      title: 'Sticky navigation header overlaps modal content on resize',
      description: 'When window is resized below 768px, z-index conflict causes navbar to bleed through overlay.',
      category: 'runtime_error',
      severity: 'Medium',
      affectedUrl: 'http://127.0.0.1:5050/broken-links',
      affectedComponent: 'Modal Overlay',
      reproductionSteps: [
        'Open modal dialog',
        'Resize browser viewport to 600px',
        'Observe header bar rendering above dialog backdrop'
      ],
      remediation: 'Set z-index of .modal-backdrop to 1050 and .header to 1000.'
    })
  });
  const exploratoryData = await exploratoryRes.json();
  check('Exploratory finding logged by tester', exploratoryRes.status === 201 && exploratoryData.finding?.exploratory === true);

  // 5. Duplicate Suggestions
  console.log('\n--- Step 8: Duplicate Suggestion Intelligence ---');
  const dupRes = await fetch(`${API_BASE}/findings/${targetFindingId1}/duplicate-suggestions`, {
    headers: { Authorization: `Bearer ${testerToken}` }
  });
  const dupData = await dupRes.json();
  check('Duplicate suggestions retrieved', dupRes.status === 200 && Array.isArray(dupData.suggestions));

  // -------------------------------------------------------------
  // STEP 6: CROSS-TENANT ACCESS RESTRICTION AUDIT
  // -------------------------------------------------------------
  console.log('\n--- Step 9: Multi-Tenant Access Rejections ---');
  const unauthRegRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Unrelated Developer',
      email: unauthEmail,
      password,
      role: 'developer'
    })
  });
  const unauthRegData = await unauthRegRes.json();
  unauthDevToken = unauthRegData.token;

  // Unrelated developer tries to access Target
  const unauthTargetRes = await fetch(`${API_BASE}/targets/${targetId}`, {
    headers: { Authorization: `Bearer ${unauthDevToken}` }
  });
  check('Unrelated developer blocked from GET /targets/:id (HTTP 403)', unauthTargetRes.status === 403);

  // Unrelated developer tries to scan target
  const unauthScanLaunchRes = await fetch(`${API_BASE}/scans`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${unauthDevToken}`
    },
    body: JSON.stringify({ targetId })
  });
  check('Unrelated developer blocked from POST /scans (HTTP 403)', unauthScanLaunchRes.status === 403);

  // Unrelated developer tries to access scan findings
  const unauthFindingsRes = await fetch(`${API_BASE}/scans/${scanId}/findings`, {
    headers: { Authorization: `Bearer ${unauthDevToken}` }
  });
  check('Unrelated developer blocked from GET /scans/:id/findings (HTTP 403)', unauthFindingsRes.status === 403);

  // Unrelated developer tries to generate report
  const unauthReportGenRes = await fetch(`${API_BASE}/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${unauthDevToken}`
    },
    body: JSON.stringify({ scanId })
  });
  check('Unrelated developer blocked from POST /reports (HTTP 403)', unauthReportGenRes.status === 403);

  // Unrelated developer tries to download PDF
  const unauthPdfRes = await fetch(`${API_BASE}/reports/${reportId}/pdf`, {
    headers: { Authorization: `Bearer ${unauthDevToken}` }
  });
  check('Unrelated developer blocked from GET /reports/:id/pdf (HTTP 403)', unauthPdfRes.status === 403);

  // Unrelated developer tries to validate finding
  const unauthValidateRes = await fetch(`${API_BASE}/findings/${targetFindingId1}/validate`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${unauthDevToken}`
    },
    body: JSON.stringify({ status: 'confirmed' })
  });
  check('Unrelated developer blocked from PATCH /findings/:id/validate (HTTP 403)', unauthValidateRes.status === 403);

  console.log('\n================================================================');
  console.log('ALL USER JOURNEYS & TENANT ISOLATION CHECKS PASSED SUCCESSFULLY!');
  console.log('================================================================');
}

runAuditJourneys().catch((err) => {
  console.error('\n❌ AUDIT JOURNEY RUNNER FAILED:', err);
  process.exit(1);
});
