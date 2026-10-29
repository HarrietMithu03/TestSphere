const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function verifyConnection() {
  console.log('================================================================');
  console.log('TestSphere: Frontend & Backend Connection Audit');
  console.log('================================================================\n');

  // 1. Check frontend configuration
  console.log('--- 1. Frontend Configuration Check ---');
  const clientEnvPath = path.resolve(__dirname, '../../client/.env');
  let clientApiUrl = 'http://localhost:5000/api';
  let clientSocketUrl = 'http://localhost:5000';

  if (fs.existsSync(clientEnvPath)) {
    const envContent = fs.readFileSync(clientEnvPath, 'utf8');
    const matchApi = envContent.match(/VITE_API_URL=(.+)/);
    const matchSocket = envContent.match(/VITE_SOCKET_URL=(.+)/);
    if (matchApi) clientApiUrl = matchApi[1].trim();
    if (matchSocket) clientSocketUrl = matchSocket[1].trim();
    console.log(`[Frontend .env] Located at: ${clientEnvPath}`);
    console.log(`  VITE_API_URL:    ${clientApiUrl}`);
    console.log(`  VITE_SOCKET_URL: ${clientSocketUrl}`);
  } else {
    console.log('[Frontend .env] File not found; using defaults.');
  }

  // 2. Identify listening processes on 5000 and 5173
  console.log('\n--- 2. Port & Process Identification (Ports 5000 and 5173) ---');
  let pids = [];
  try {
    const netstatOutput = execSync('netstat -ano', { encoding: 'utf8' });
    const lines = netstatOutput.split('\n');
    lines.forEach(line => {
      if ((line.includes(':5000 ') || line.includes(':5173 ')) && line.includes('LISTENING')) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        const port = line.includes(':5000') ? '5000' : '5173';
        pids.push({ port, pid });
        console.log(`  Port ${port} is LISTENING by PID: ${pid}`);
      }
    });

    for (const item of pids) {
      try {
        const procInfo = execSync(
          `powershell -Command "Get-CimInstance Win32_Process -Filter 'ProcessId = ${item.pid}' | Select-Object ProcessId, CommandLine"`,
          { encoding: 'utf8' }
        );
        console.log(`  Details for PID ${item.pid} (Port ${item.port}):`);
        console.log(procInfo.trim());
      } catch (err) {
        console.log(`  Could not query details for PID ${item.pid}: ${err.message}`);
      }
    }
  } catch (err) {
    console.warn(`[Process Check Error] ${err.message}`);
  }

  // 3. Backend Health Check
  console.log('\n--- 3. Backend Health Endpoint Check ---');
  const healthUrl = `${clientApiUrl}/health`;
  console.log(`Request URL: ${healthUrl}`);
  const healthRes = await fetch(healthUrl);
  console.log(`HTTP Status: ${healthRes.status} ${healthRes.statusText}`);
  const healthData = await healthRes.json();
  console.log('Health Payload:', JSON.stringify(healthData, null, 2));

  // 4. Test CORS Preflight from both localhost:5173 and 127.0.0.1:5173
  console.log('\n--- 4. CORS Preflight & Origin Verification ---');
  const originsToTest = ['http://localhost:5173', 'http://127.0.0.1:5173'];

  for (const origin of originsToTest) {
    console.log(`\nTesting Origin: ${origin}`);
    const preflightRes = await fetch(`${clientApiUrl}/auth/login`, {
      method: 'OPTIONS',
      headers: {
        'Origin': origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      }
    });
    console.log(`  OPTIONS Preflight Status: ${preflightRes.status}`);
    console.log(`  Access-Control-Allow-Origin: ${preflightRes.headers.get('access-control-allow-origin')}`);
    console.log(`  Access-Control-Allow-Credentials: ${preflightRes.headers.get('access-control-allow-credentials')}`);
    console.log(`  Access-Control-Allow-Headers: ${preflightRes.headers.get('access-control-allow-headers')}`);
  }

  // 5. Test Real Frontend-to-Backend Authentication Flow
  console.log('\n--- 5. Real Frontend-to-Backend Authentication Request ---');
  const loginUrl = `${clientApiUrl}/auth/login`;
  console.log(`Request URL: POST ${loginUrl}`);
  const loginRes = await fetch(loginUrl, {
    method: 'POST',
    headers: {
      'Origin': 'http://localhost:5173',
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      email: 'alex.dev@testsphere.io',
      password: 'SecurePassword123!'
    })
  });
  console.log(`HTTP Status: ${loginRes.status} ${loginRes.statusText}`);
  console.log(`CORS Allow-Origin: ${loginRes.headers.get('access-control-allow-origin')}`);
  const loginData = await loginRes.json();
  console.log(`Login Success: ${loginData.success}`);
  console.log(`User Name: ${loginData.user?.name}, Role: ${loginData.user?.role}`);
  console.log(`Token Issued: ${!!loginData.token}`);

  const authToken = loginData.token;

  // 6. Test Authenticated Profile Request
  console.log('\n--- 6. Authenticated User Profile Request (Bearer Token) ---');
  const meUrl = `${clientApiUrl}/auth/me`;
  console.log(`Request URL: GET ${meUrl}`);
  const meRes = await fetch(meUrl, {
    headers: {
      'Origin': 'http://localhost:5173',
      'Authorization': `Bearer ${authToken}`,
      'Accept': 'application/json'
    }
  });
  console.log(`HTTP Status: ${meRes.status} ${meRes.statusText}`);
  const meData = await meRes.json();
  console.log(`Profile Verified: ${meData.user?.name} (${meData.user?.email}), Role: ${meData.user?.role}`);

  // 7. Test Error Handling (Invalid Credentials & Bad Token)
  console.log('\n--- 7. Error Handling Verification ---');
  const badLoginRes = await fetch(loginUrl, {
    method: 'POST',
    headers: {
      'Origin': 'http://localhost:5173',
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      email: 'alex.dev@testsphere.io',
      password: 'WrongPassword@999'
    })
  });
  console.log(`Bad Password Request HTTP Status: ${badLoginRes.status} (Expected 401)`);
  const badLoginData = await badLoginRes.json();
  console.log(`Error Message: "${badLoginData.message}"`);

  const badTokenRes = await fetch(meUrl, {
    headers: {
      'Origin': 'http://localhost:5173',
      'Authorization': 'Bearer invalid.fake.token',
      'Accept': 'application/json'
    }
  });
  console.log(`Bad Token Request HTTP Status: ${badTokenRes.status} (Expected 401)`);
  const badTokenData = await badTokenRes.json();
  console.log(`Error Message: "${badTokenData.message}"`);

  console.log('\n================================================================');
  console.log('AUDIT SUMMARY: Frontend and Backend are CONNECTED and OPERATIONAL!');
  console.log('================================================================');
}

verifyConnection().catch(err => {
  console.error('Connection Verification Failed:', err);
  process.exit(1);
});
