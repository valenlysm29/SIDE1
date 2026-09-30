'use strict';

// Reproducible exterior renderer budget check.
// Run from SIDE1: node tests/outdoor_performance.cjs
// Uses SwiftShader for deterministic CI numbers; it is not an FPS benchmark.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
// The enlarged city adds a few instanced street and skyline batches.
const baseline = Object.freeze({ calls: 135, triangles: 66360 });
const limits = Object.freeze({
  low: { calls: 150, triangles: 60000 },
  medium: { calls: 160, triangles: 75000 },
  high: { calls: 160, triangles: 75000 }
});
const seed = {
  MOLDE: { optionIds: ['molde_1'] },
  PRODUCCION_META: { moldTargets: { molde_1: 10, molde_2: 0, molde_3: 0 } },
  CUERO: { quantities: { cuero_sint: 3 } },
  ACCESORIOS: { quantities: { acc_eco: 10 } },
  HILO: { quantities: { hilo_std: 1 } },
  GARANTIA_PT: { optionIds: ['pt_30'] },
  CANALES: { optionIds: ['sjl'], quantities: { sjl: 2 } },
  INV_MARKETING: { optionIds: ['mkt_baja'] }
};
const mime = {
  '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.svg': 'image/svg+xml'
};

async function serve() {
  const server = http.createServer((request, response) => {
    let file;
    try { file = path.resolve(root, `.${decodeURIComponent(new URL(request.url, 'http://localhost').pathname)}`); }
    catch { response.writeHead(400).end(); return; }
    if (file !== root && !file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    if (file === root) file = path.join(root, 'index.html');
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}/`,
    close: () => new Promise(resolve => server.close(resolve))
  };
}

const source = fs.readFileSync(path.join(root, 'js/simulator3d.js'), 'utf8');
assert.ok(source.includes('  window.SIDE3D = {'), 'simulator diagnostics injection point');
const instrumented = source.replace('  window.SIDE3D = {', `  window.outdoorPerfQA = {
    pause() { cancelAnimationFrame(raf); if (detailsTimer) { clearTimeout(detailsTimer); detailsTimer = 0; } },
    async load() { await loadOutdoorPropTemplates(); return SIDE3D.diagnostics().assets.outdoorProps; },
    measure(mode) {
      setGraphicsQuality(mode);
      updateGameplayCamera(1 / 60);
      renderer.render(scene, camera);
      renderer.render(scene, camera);
      const props = hubWorld.outdoorProps();
      let visibleMeshes = 0;
      scene.traverse(object => {
        if (!object.isMesh) return;
        for (let cursor = object; cursor; cursor = cursor.parent) if (!cursor.visible) return;
        visibleMeshes++;
      });
      return {
        mode,
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        visibleMeshes,
        geometries: renderer.info.memory.geometries,
        outdoor: {
          batches: props.visibleBatches,
          meshes: props.drawables,
          drawables: props.drawables,
          instances: props.visibleInstances,
          triangles: props.triangles,
          shadows: props.shadows,
          birds: props.birds
        }
      };
    }
  };
  window.SIDE3D = {`);

(async () => {
  const local = await serve();
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  const errors = [];
  const failedLocal = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.url().startsWith(local.url) && response.status() >= 400) failedLocal.push(`${response.status()} ${response.url()}`);
    });
    await context.route('**/*', route => {
      const requested = route.request().url();
      if (!requested.startsWith(local.url)) return route.abort();
      if (/\/js\/simulator3d\.js(?:\?|$)/.test(requested)) return route.fulfill({ contentType: 'application/javascript', body: instrumented });
      return route.continue();
    });
    await page.goto(local.url, { waitUntil: 'domcontentloaded' });
    assert.equal(await page.evaluate(seedValue => {
      localStorage.clear();
      localStorage.setItem('SIDE_TEACHER_CONFIG', JSON.stringify({ capital: 100000, cycles: 6, roundHours: 8 }));
      currentStudent = { name: 'QA OUTDOOR PERF', company: 'QA OUTDOOR PERF', game: DEMO_GAME };
      openDecisionMenu();
      Object.assign(decisionDrafts, seedValue);
      return commitReviewedSections(decisionCategories().map(category => category.cat), true);
    }, seed), true);
    assert.equal(await page.evaluate(() => startSimulationLoading()), true);
    await page.evaluate(() => outdoorPerfQA.pause());

    const before = {};
    for (const mode of ['low', 'medium', 'high']) before[mode] = await page.evaluate(tier => outdoorPerfQA.measure(tier), mode);

    const loaded = await page.evaluate(() => outdoorPerfQA.load());
    assert.equal(loaded.errors && Object.keys(loaded.errors).length, 0, `outdoor GLB errors: ${JSON.stringify(loaded.errors)}`);
    assert.equal(loaded.loaded.length, 12, 'all 12 outdoor GLBs load through the real GLTFLoader');

    const tiers = {};
    for (const mode of ['low', 'medium', 'high']) {
      const result = await page.evaluate(tier => outdoorPerfQA.measure(tier), mode);
      const limit = limits[mode];
      assert.ok(result.calls <= limit.calls, `${mode} calls ${result.calls} exceed ${limit.calls}`);
      assert.ok(result.triangles <= limit.triangles, `${mode} triangles ${result.triangles} exceed ${limit.triangles}`);
      tiers[mode] = {
        ...result,
        deltaCalls: result.calls - baseline.calls,
        deltaTriangles: result.triangles - baseline.triangles,
        callBudgetRemaining: limit.calls - result.calls,
        triangleBudgetRemaining: limit.triangles - result.triangles
      };
    }
    assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
    assert.deepEqual(failedLocal, [], `failed local requests: ${failedLocal.join(' | ')}`);
    console.log(JSON.stringify({ baseline, limits, before, loaded: loaded.loaded.sort(), tiers }, null, 2));
    await context.close();
  } finally {
    await browser.close();
    await local.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
