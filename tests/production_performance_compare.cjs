'use strict';
// Reuse the original renderer-budget runner and its assertions. Optional
// SIDE_PERF_BASELINE_REF serves historical sources without git checkout.
// SIDE_PERF_REPORT_ONLY=1 is for recording counts, never for claiming a pass.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const filename = path.join(__dirname, 'production_performance.cjs');
let source = fs.readFileSync(filename, 'utf8');
const replacements = [
  ["const source = fs.readFileSync(path.join(root, 'js/simulator3d.js'), 'utf8');", `const {browserGitBaseline} = require('./browser_git_baseline.cjs');
const baselineRef = process.env.SIDE_PERF_BASELINE_REF || null;
const baselineSources = browserGitBaseline(root, baselineRef);
const source = baselineSources.get('/js/simulator3d.js') || fs.readFileSync(path.join(root, 'js/simulator3d.js'), 'utf8');`],
  ["    await context.route('**/*', route => {", `    await page.addInitScript(() => {let seed=4107;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
    await context.route('**/*', route => {`],
  ["      return route.continue();", `      const pathname = new URL(requested).pathname.replace(/^\\/$/, '/index.html');
      if (baselineSources.has(pathname)) return route.fulfill({status:200, contentType:mime[path.extname(pathname)], body:baselineSources.get(pathname)});
      return route.continue();`],
  ["console.log(JSON.stringify({ baselines, limits, loaded:", "console.log(JSON.stringify({ sourceRef:baselineRef||'working-tree', randomSeed:4107, reportOnly, baselines, limits, loaded:"]
];
for (const [original, replacement] of replacements) {
  assert.ok(source.includes(original), `original production runner anchor: ${original}`);
  source = source.replace(original, replacement);
}
const runner = new Module(filename, module);
runner.filename = filename;
runner.paths = Module._nodeModulePaths(__dirname);
runner._compile(source, filename);
