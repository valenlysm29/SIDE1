'use strict';

// Reproducible Tanda 4 renderer budget check.
// Run from SIDE1: node tests/production_performance.cjs
// SwiftShader makes geometry counts stable; this is intentionally not an FPS test.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const reportOnly = process.env.SIDE_PERF_REPORT_ONLY === '1';
const requestedZones = process.env.SIDE_PERF_ZONE ? [process.env.SIDE_PERF_ZONE] : ['store', 'production', 'exterior'];
const requestedModes = process.env.SIDE_PERF_TIER ? [process.env.SIDE_PERF_TIER] : ['low', 'medium', 'high'];
const baselines = Object.freeze({
  store: {
    low: { calls: 186, triangles: 72132 },
    medium: { calls: 190, triangles: 72516 },
    high: { calls: 190, triangles: 72516 }
  },
  production: {
    low: { calls: 141, triangles: 62140 },
    medium: { calls: 145, triangles: 62692 },
    high: { calls: 145, triangles: 62692 }
  },
  exterior: {
    low: { calls: 101, triangles: 53546 },
    medium: { calls: 107, triangles: 55158 },
    high: { calls: 107, triangles: 55546 }
  }
});
const limits = Object.freeze({
  store: {
    low: { calls: 195, triangles: 75738 },
    medium: { calls: 218, triangles: 90645 },
    high: { calls: 218, triangles: 90645 }
  },
  production: {
    low: { calls: 148, triangles: 65247 },
    medium: { calls: 166, triangles: 78365 },
    high: { calls: 166, triangles: 78365 }
  },
  exterior: {
    low: { calls: 106, triangles: 56223 },
    medium: { calls: 123, triangles: 68947 },
    high: { calls: 123, triangles: 69432 }
  }
});
const expectedRealLights = Object.freeze({ low: 0, medium: 1, high: 2 });
const newFiles = Object.freeze([
  'shop_entry_door.glb', 'shop_window_panel.glb', 'shop_ceiling_light.glb', 'shop_atm.glb',
  'production_overlock_machine.glb', 'production_ironing_station.glb',
  'production_mannequin.glb', 'production_garment_rack.glb'
]);
const sharedFiles = Object.freeze([
  'warehouse_cutting_table.glb', 'warehouse_sewing_machine.glb', 'warehouse_fabric_rolls.glb',
  'warehouse_rack_tall.glb', 'warehouse_pendant_light.glb'
]);
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
const instrumented = source.replace('  window.SIDE3D = {', `  let productionPerfOutdoorView = null;
  window.productionPerfQA = {
    pause() {
      cancelAnimationFrame(raf);
      if (detailsTimer) { clearTimeout(detailsTimer); detailsTimer = 0; }
      productionPerfOutdoorView = {
        player: { x: player.x, y: player.y, z: player.z },
        position: camera.position.clone(), quaternion: camera.quaternion.clone(), fov: camera.fov,
        interior: currentInterior, mode: cameraMode
      };
    },
    async load() {
      // Production loads first so the five warehouse references become the
      // canonical cache entries; loading the warehouse afterwards must reuse them.
      await loadStorePropTemplates();
      await loadProductionPropTemplates();
      await loadWarehousePropTemplates();
      await loadOutdoorPropTemplates();
      return SIDE3D.diagnostics().assets;
    },
    measure(zone, mode) {
      setGraphicsQuality(mode);
      player.speed = player.vx = player.vz = 0;
      if (zone === 'store') {
        Object.assign(player, { x: 131, y: 1.72, z: 19 });
        currentInterior = 'store'; cameraMode = 'third';
        camera.position.set(142, 11.5, 33); camera.fov = 52;
        camera.lookAt(131, 1, 19); camera.updateProjectionMatrix();
      } else if (zone === 'production') {
        Object.assign(player, { x: 170, y: 1.72, z: -19 });
        currentInterior = 'production'; cameraMode = 'third';
        camera.position.set(181, 11.5, -5); camera.fov = 52;
        camera.lookAt(170, 1, -19); camera.updateProjectionMatrix();
      } else {
        Object.assign(player, productionPerfOutdoorView.player);
        currentInterior = productionPerfOutdoorView.interior; cameraMode = productionPerfOutdoorView.mode;
        camera.position.copy(productionPerfOutdoorView.position);
        camera.quaternion.copy(productionPerfOutdoorView.quaternion);
        camera.fov = productionPerfOutdoorView.fov; camera.updateProjectionMatrix();
      }
      businessInteriors.tick(0, player, 0);
      renderer.render(scene, camera);
      renderer.render(scene, camera);
      let visibleMeshes = 0;
      scene.traverseVisible(object => { if (object.isMesh) visibleMeshes++; });
      const stats = businessInteriors.stats();
      const room = businessInteriors.rooms.find(value => value.id === zone);
      const props = zone === 'store' ? stats.storeProps
        : zone === 'production' ? stats.productionProps : hubWorld.outdoorProps();
      return {
        zone, mode, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
        visibleMeshes, geometries: renderer.info.memory.geometries,
        activeRealLights: room ? room.lights.filter(light => light.visible).length : stats.activeLights,
        props: {
          batches: props.visibleBatches ?? props.batches,
          drawables: props.drawables ?? props.meshes ?? 0,
          instances: props.visibleInstances ?? props.instances ?? 0,
          triangles: props.triangles ?? 0,
          realLights: props.realLights ?? 0
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
  const errors = [], failedLocal = [], glbResponses = new Map();
  try {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (!response.url().startsWith(local.url)) return;
      if (response.status() >= 400) failedLocal.push(`${response.status()} ${response.url()}`);
      if (/\.glb(?:\?|$)/.test(response.url())) {
        const filename = path.basename(new URL(response.url()).pathname);
        glbResponses.set(filename, (glbResponses.get(filename) || 0) + 1);
      }
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
      currentStudent = { name: 'QA T4 PERF', company: 'QA T4 PERF', game: DEMO_GAME };
      openDecisionMenu(); Object.assign(decisionDrafts, seedValue);
      return commitReviewedSections(decisionCategories().map(category => category.cat), true);
    }, seed), true);
    assert.equal(await page.evaluate(() => startSimulationLoading()), true);
    await page.evaluate(() => productionPerfQA.pause());

    const loaded = await page.evaluate(() => productionPerfQA.load());
    assert.deepEqual(loaded.storeProps.errors, {}, `store GLB errors: ${JSON.stringify(loaded.storeProps.errors)}`);
    assert.deepEqual(loaded.productionProps.errors, {}, `production GLB errors: ${JSON.stringify(loaded.productionProps.errors)}`);
    assert.deepEqual(loaded.warehouseProps.errors, {}, `warehouse GLB errors: ${JSON.stringify(loaded.warehouseProps.errors)}`);
    assert.deepEqual(loaded.outdoorProps.errors, {}, `outdoor GLB errors: ${JSON.stringify(loaded.outdoorProps.errors)}`);
    assert.equal(loaded.productionProps.loaded.length, 9, 'all production references load through the real GLTFLoader');
    for (const file of [...newFiles, ...sharedFiles]) {
      assert.equal(glbResponses.get(file), 1, `${file} is requested exactly once through the shared cache`);
    }

    const tiers = {};
    for (const zone of requestedZones) {
      tiers[zone] = {};
      for (const mode of requestedModes) {
        const result = await page.evaluate(([target, quality]) => productionPerfQA.measure(target, quality), [zone, mode]);
        const baseline = baselines[zone][mode], limit = limits[zone][mode];
        if (!reportOnly) {
          assert.ok(result.calls <= limit.calls, `${zone}/${mode} calls ${result.calls} exceed ${limit.calls}`);
          assert.ok(result.triangles <= limit.triangles, `${zone}/${mode} triangles ${result.triangles} exceed ${limit.triangles}`);
        }
        if (zone !== 'exterior') {
          assert.equal(result.activeRealLights, expectedRealLights[mode], `${zone}/${mode} active local PointLights`);
          assert.equal(result.props.realLights, expectedRealLights[mode], `${zone}/${mode} PointLight budget`);
        }
        tiers[zone][mode] = {
          ...result,
          deltaCalls: result.calls - baseline.calls,
          deltaTriangles: result.triangles - baseline.triangles,
          callBudgetRemaining: limit.calls - result.calls,
          triangleBudgetRemaining: limit.triangles - result.triangles
        };
      }
    }
    assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
    assert.deepEqual(failedLocal, [], `failed local requests: ${failedLocal.join(' | ')}`);
    console.log(JSON.stringify({ baselines, limits, loaded: {
      newFiles, sharedFiles, store: loaded.storeProps.loaded.sort(), production: loaded.productionProps.loaded.sort()
    }, tiers }, null, 2));
    await context.close();
  } finally {
    await browser.close();
    await local.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
