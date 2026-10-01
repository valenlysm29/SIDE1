'use strict';
// Paired evidence of the real decision button and return control, using only
// isolated demo data on an ephemeral local origin (no Supabase connection).
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const root = path.resolve(__dirname, '..');
const output = path.join(__dirname, 'output/npc-tablet-hud-2026-09-30');
const mime = {'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.glb':'model/gltf-binary','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp'};
const seed = {MOLDE:{optionIds:['molde_1']},PRODUCCION_META:{moldTargets:{molde_1:10,molde_2:0,molde_3:0}},CUERO:{quantities:{cuero_sint:3}},ACCESORIOS:{quantities:{acc_eco:10}},HILO:{quantities:{hilo_std:1}},GARANTIA_PT:{optionIds:['pt_30']},CANALES:{optionIds:['miraflores'],quantities:{miraflores:1}},INV_MARKETING:{optionIds:['mkt_baja']}};
const server = http.createServer((request, response) => {
  let file;
  try { file = path.resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname)); }
  catch { response.writeHead(400).end(); return; }
  if (file === root) file = path.join(root, 'index.html');
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {response.writeHead(404).end(); return;}
  response.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(file).pipe(response);
});
(async () => {
  fs.mkdirSync(output, {recursive:true});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const page = await browser.newPage({viewport:{width:1366,height:900}});
    page.setDefaultTimeout(90000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    await page.goto(base, {waitUntil:'domcontentloaded'});
    await page.evaluate(seed => {localStorage.clear();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital:100000,cycles:6,roundHours:8}));currentStudent={name:'QA TABLET VISUAL',company:'QA TABLET VISUAL',game:DEMO_GAME};openDecisionMenu();Object.assign(decisionDrafts,seed);commitReviewedSections(decisionCategories().map(c=>c.cat),true);}, seed);
    assert.equal(await page.evaluate(() => startSimulationLoading()), true);
    await page.waitForFunction(() => SIDE3D.diagnostics().renderedFrames > 10);
    await page.waitForLoadState('networkidle');
    assert.ok(await page.title());
    const stable = () => page.evaluate(() => JSON.stringify({decisions:decisionState,cycle:currentRound(),ledger:cashLedger}));
    const before = await stable();
    await page.locator('#sim3dDecisionsBtn').click();
    assert.equal(await page.locator('#decisionMenu').isVisible(), true);
    assert.equal(await page.locator('#exitDecisions').getAttribute('aria-label'), 'Volver al mundo');
    await page.screenshot({path:path.join(output, 'tablet-open.png')});
    await page.locator('#exitDecisions').click();
    await page.waitForFunction(() => document.activeElement?.id === 'side3dCanvas' && SIDE3D.diagnostics().running);
    assert.equal(await page.locator('#decisionMenu').isVisible(), false);
    assert.equal(await stable(), before);
    assert.equal(await page.locator('.sim-zone-label,.sim-edge-guide,#simRouteMarker').count(), 0);
    await page.screenshot({path:path.join(output, 'tablet-closed.png')});
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output,'tablet-visual-results.json'), JSON.stringify({passed:true,url:base,title:await page.title(),viewport:{width:1366,height:900},focus:await page.evaluate(()=>document.activeElement.id),decisionsAndCyclePreserved:true,errors,captures:['tablet-open.png','tablet-closed.png']},null,2));
    console.log('PASS tablet open/close captures, canvas focus, saved decisions/cycle and clean HUD');
  } finally {await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
