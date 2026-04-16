#!/usr/bin/env node
/**
 * Post-build script: Replace Next.js generated 404.html with SPA redirect page.
 * This ensures Cloudflare Pages serves our redirect page instead of the default Next.js 404.
 * 
 * This fixes:
 * - TokenPocket wallet links like /tx/0x... returning "404 Not Found"
 * - Direct URL access to /address/0x..., /block/123, etc.
 */

const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'out');

const redirectHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ExeChain Explorer</title>
  <style>
    body { margin: 0; background: #0f172a; color: #e2e8f0; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; }
    .loader { text-align: center; }
    .spinner { width: 40px; height: 40px; border: 3px solid #334155; border-top: 3px solid #13b5c1; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    p { color: #94a3b8; font-size: 14px; }
  </style>
  <script>
    // SPA redirect - handle all path-based routes from TokenPocket and direct access
    (function() {
      var path = window.location.pathname.replace(/\\.html$/, '').replace(/\\/+$/, '');
      var search = window.location.search || '';
      var hash = '';

      if (path === '' || path === '/' || path === '/index' || path === '/404') {
        hash = '#home';
      } else {
        // Pass the full path as hash: /tx/0xabc -> #tx/0xabc
        hash = '#' + path.replace(/^\\//, '');
      }

      // Redirect to root with hash route
      window.location.replace('/' + hash + search);
    })();
  </script>
</head>
<body>
  <div class="loader">
    <div class="spinner"></div>
    <p>Redirecting...</p>
  </div>
</body>
</html>`;

// Replace 404.html
const html404Path = path.join(outDir, '404.html');
fs.writeFileSync(html404Path, redirectHtml, 'utf8');
console.log('[fix-404] Replaced out/404.html with SPA redirect page');

// Replace _not-found.html too
const notFoundPath = path.join(outDir, '_not-found.html');
if (fs.existsSync(notFoundPath)) {
  fs.writeFileSync(notFoundPath, redirectHtml, 'utf8');
  console.log('[fix-404] Replaced out/_not-found.html with SPA redirect page');
}

console.log('[fix-404] Done! Path-based routes will now redirect to hash routes.');
