'use strict';
// Uses the project's working Playwright runtime; no accounts or remote writes.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'tests/output/supabase-browser-2026-10-13');
fs.mkdirSync(output, { recursive: true });
const results = {};
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    await context.route('**/*', route => route.request().url().startsWith(base + '/') || route.request().url().includes('.supabase.co/') ? route.continue() : route.abort());
    for (const name of ['index', 'docente']) {
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/' + name + '.html', { waitUntil: 'networkidle' });
      const ready = await page.evaluate(() => SIDE.SupabaseClient.isReady());
      const catalog = await page.evaluate(() => SIDE.DecisionesService.obtenerCatalogo());
      if (!ready || !catalog.success || errors.length) throw Error(JSON.stringify({ name, ready, catalog, errors }));
      results[name] = { sdkReadyWithoutCDN: ready, liveCatalogSuccess: catalog.success, pageErrors: errors };
      await page.screenshot({ path: path.join(output, name + '.png') });
      if (name === 'index') {
        await context.setOffline(true);
        const failed = await page.evaluate(() => SIDE.DecisionesService.obtenerCatalogo());
        await context.setOffline(false);
        const recovered = await page.evaluate(() => SIDE.DecisionesService.obtenerCatalogo());
        if (failed.success || !recovered.success) throw Error('Offline recovery failed');
        results.offlineRecovery = true;
        const pattern = '**/rest/v1/rpc/side_admission_features*';
        await page.route(pattern, () => {});
        const timeout = await page.evaluate(async () => {
          const start = performance.now();
          const result = await SIDE.SupabaseClient.get().rpc('side_admission_features');
          return { elapsed: performance.now() - start, failed: Boolean(result.error) };
        });
        if (!timeout.failed || timeout.elapsed < 14000 || timeout.elapsed > 20000) throw Error(JSON.stringify(timeout));
        await page.unroute(pattern);
        const again = await page.evaluate(() => SIDE.SupabaseClient.get().rpc('side_admission_features'));
        if (again.error) throw Error(JSON.stringify(again.error));
        results.stalledRequestRecovery = timeout;
      }
      await page.close();
    }
    await context.close();
  } finally {
    await browser.close();
    server.close();
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  }
  console.log(JSON.stringify(results, null, 2));
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
