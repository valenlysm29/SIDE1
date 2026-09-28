'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');

function read(file){return fs.readFileSync(path.join(root,file),'utf8')}

test('credits data contains the required Poly Pizza attribution and traceable CC0 furniture',()=>{
  const sandbox={window:{}};
  vm.runInNewContext(read('services/credits_data.js'),sandbox);
  const credits=sandbox.window.SIDE_CREDITS;
  assert.ok(Object.isFrozen(credits));
  const register=credits.find(item=>item.id==='shop-cash-register');
  assert.equal(register.title,'Cash register');
  assert.equal(register.author,'Poly by Google');
  assert.equal(register.source,'Poly Pizza');
  assert.equal(register.sourceUrl,'https://poly.pizza/m/crXBxFOkCIp');
  assert.equal(register.license,'CC BY 3.0');
  assert.equal(register.licenseUrl,'https://creativecommons.org/licenses/by/3.0/');
  assert.equal(register.attributionRequired,true);
  const atm=credits.find(item=>item.id==='shop-atm');
  assert.equal(atm.title,'ATM');
  assert.equal(atm.author,'J-Toastie');
  assert.equal(atm.license,'CC BY 3.0');
  assert.equal(atm.sourceUrl,'https://poly.pizza/m/p4U0tSF5WN');
  assert.equal(atm.attributionRequired,true);
  assert.match(atm.modification,/escala, origen y materiales/i);
  const furniture=credits.find(item=>item.id==='shop-furniture-kit');
  assert.equal(furniture.author,'Kenney');
  assert.equal(furniture.license,'CC0 1.0');
  assert.ok(furniture.assets.includes('shop_mirror_wall.glb'));
});

test('credits modal is reachable from the splash and exposes dialog semantics',()=>{
  const html=read('index.html'),app=read('app.js');
  assert.match(html,/id="openCreditsBtn"[^>]+aria-haspopup="dialog"[^>]+aria-controls="creditsModal"/);
  assert.match(html,/id="creditsModal"[^>]+role="dialog"[^>]+aria-modal="true"[^>]+aria-labelledby="creditsTitle"/);
  assert.match(html,/services\/credits_data\.js\?v=20260928-production/);
  assert.ok(html.indexOf('services/credits_data.js')<html.indexOf('app.js'));
  assert.match(app,/renderCredits\(\);showModal\('creditsModal'\)/);
  assert.match(app,/if\(e\.key==='Escape'[^\n]+closeModal\(\)/);
  assert.match(app,/if\(trigger\?\.isConnected\)trigger\.focus\(\)/);
  assert.match(app,/source\.rel='noopener noreferrer'/);
});
