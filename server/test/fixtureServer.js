const express = require('express');

const createFixtureServer = (port = 5050) => {
  const app = express();

  // Root landing page
  app.get('/', (req, res) => {
    // Deliberately no CSP or X-Frame-Options headers
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>TestSphere Controlled Test Fixture</title>
      </head>
      <body>
        <h1>TestSphere Scanner Verification Target</h1>
        <p>This fixture serves controlled diagnostic test cases to verify Playwright browser automation.</p>
        <nav>
          <ul>
            <li><a href="/js-error">JavaScript Exception Test</a></li>
            <li><a href="/console-error">Console Error Test</a></li>
            <li><a href="/broken-links">Broken Link 404 Test</a></li>
            <li><a href="/api-failure">HTTP 500 API Failure Test</a></li>
            <li><a href="/duplicate-findings">Duplicate Finding Test</a></li>
            <li><a href="/accessibility-issues">Accessibility Violations Test</a></li>
            <li><a href="/slow-performance">Performance Latency Test</a></li>
            <li><a href="/depth-1">Deep Link Chain Level 1</a></li>
          </ul>
        </nav>
      </body>
      </html>
    `);
  });

  // 1. JavaScript Uncaught Exception Page
  app.get('/js-error', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>JS Exception Test</title></head>
      <body>
        <h2>Triggering Uncaught ReferenceError</h2>
        <script>
          // Deliberate runtime exception for scanner validation
          window.nonExistentTestingObject.triggerFatalCrash();
        </script>
      </body>
      </html>
    `);
  });

  // 2. Console Error Page
  app.get('/console-error', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Console Error Test</title></head>
      <body>
        <h2>Triggering Explicit Console Errors</h2>
        <script>
          console.error("TestSphere Verification: Controlled console.error message 1");
          console.error("TestSphere Verification: Failed to load resource from /mock-asset.js");
        </script>
      </body>
      </html>
    `);
  });

  // 3. Broken Hyperlink Source Page
  app.get('/broken-links', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Broken Links Test</title></head>
      <body>
        <h2>Broken Hyperlink Test Page</h2>
        <p>This page contains a link to a missing path:</p>
        <a href="/dead-link-target-404">Dead Endpoint Link</a>
      </body>
      </html>
    `);
  });

  // 4. HTTP 404 Dead Target Endpoint
  app.get('/dead-link-target-404', (req, res) => {
    res.status(404).send('Not Found - Deliberate 404 for TestSphere Broken Link Verification');
  });

  // 5. HTTP 500 API Endpoint and Caller Page
  app.get('/api/failing-endpoint-500', (req, res) => {
    res.status(500).json({
      error: 'Deliberate HTTP 500 Internal Server Failure for Scanner Test',
      code: 'ERR_FIXTURE_500'
    });
  });

  app.get('/api-failure', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>API Failure Test</title></head>
      <body>
        <h2>Calling HTTP 500 Endpoint</h2>
        <script>
          fetch('/api/failing-endpoint-500').catch(function(err) {});
        </script>
      </body>
      </html>
    `);
  });

  // 6. Duplicate Finding Page (emits same console error multiple times to test deduplication)
  app.get('/duplicate-findings', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Duplicate Findings Test</title></head>
      <body>
        <h2>Duplicate Finding Emitter</h2>
        <script>
          // Deliberate repeated execution to verify deterministic fingerprint deduplication
          for (let i = 0; i < 3; i++) {
            console.error("TestSphere Verification: Controlled console.error message 1");
          }
        </script>
      </body>
      </html>
    `);
  });

  // 7. Slow Responding Page for Performance Diagnostic Analyzer (triggers TTFB > 1500ms)
  app.get('/slow-performance', (req, res) => {
    setTimeout(() => {
      res.setHeader('Content-Type', 'text/html');
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Slow Response Test</title></head>
        <body>
          <h2>Simulating High Server Response Time (TTFB)</h2>
          <p>This endpoint deliberately delays response by 1600ms to trigger the performance threshold.</p>
        </body>
        </html>
      `);
    }, 1600);
  });

  // 7. Accessibility Violations Page (deliberate WCAG violations for axe-core detection)
  app.get('/accessibility-issues', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <title>Accessibility Violations Test</title>
      </head>
      <body>
        <h1>Accessibility Test Fixture</h1>
        <!-- Violation 1: Image missing alt attribute -->
        <img src="/mock-image.png">
        <!-- Violation 2: Form input without associated label -->
        <input type="text" id="unlabeled-input">
        <!-- Violation 3: Button without accessible name or text -->
        <button></button>
      </body>
      </html>
    `);
  });

  // 7. Depth Chain Tests
  app.get('/depth-1', (req, res) => {
    res.send('<html><body>Depth 1: <a href="/depth-2">Go to Depth 2</a></body></html>');
  });

  app.get('/depth-2', (req, res) => {
    res.send('<html><body>Depth 2: <a href="/depth-3">Go to Depth 3</a></body></html>');
  });

  app.get('/depth-3', (req, res) => {
    res.send('<html><body>Depth 3: <a href="/depth-4">Go to Depth 4</a></body></html>');
  });

  app.get('/depth-4', (req, res) => {
    res.send('<html><body>Depth 4: Leaf node reached</body></html>');
  });

  return new Promise((resolve) => {
    const server = app.listen(port, '127.0.0.1', () => {
      console.log(`[FixtureServer] Test fixture running on http://127.0.0.1:${port}`);
      resolve({ server, port });
    });
  });
};

if (require.main === module) {
  createFixtureServer(5050);
}

module.exports = {
  createFixtureServer
};
