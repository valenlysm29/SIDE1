'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/simulator3d.js'), 'utf8');

function fixture() {
  let writes = 0;
  const context = {
    PRODUCTS: [{ id: 'esencial', color: 1 }, { id: 'urbano', color: 2 }, { id: 'premium', color: 3 }],
    inventory: { display: { esencial: 1, urbano: 3, premium: 0 }, reserve: { esencial: 5, urbano: 0, premium: 2 }, producedUnits: 11, totalTarget: 11 },
    businessState: { pendingSupplierOrder: null }, running: true, gameSession: { shiftEnded: false },
    productionSnapshot: () => ({ producibleUnits: 11 }), displayCapacity: () => 4, warehouseCapacity: () => 30,
    bridge: () => ({ canOperate: () => true }), decisionCash: () => 100000, currentRoundSafe: () => 1,
    owned: () => 1, qty: () => 1, saveInventory() { writes++; }, updateHUD() {}, message() {}, playSfx() {}
  };
  vm.createContext(context);
  for (const name of ['displayStock', 'reserveStock', 'totalDisplayStock', 'totalReserveStock', 'businessVisualSnapshot', 'restockDisplays', 'reserveProductForNpc']) {
    const start = source.indexOf(`  function ${name}(`), end = source.indexOf('\n  function ', start + 1);
    assert.ok(start >= 0 && end > start, `existing runtime boundary: ${name}`);
    vm.runInContext(source.slice(start, end), context);
  }
  context.renderInventoryDisplays = () => { context.latestVisual = context.businessVisualSnapshot(); };
  return { context, writes: () => writes };
}

test('physical restocking projects the authoritative transfer without creating stock or money', () => {
  const { context: c, writes } = fixture(), before = c.businessVisualSnapshot();
  assert.equal(c.restockDisplays(false), 5);
  const after = c.latestVisual;
  assert.equal(after.displayStock, 9); assert.equal(after.reserveStock, 2);
  assert.equal(after.displayStock + after.reserveStock, before.displayStock + before.reserveStock);
  assert.equal(after.cash, before.cash); assert.equal(after.producedUnits, before.producedUnits);
  assert.equal(after.storeFill, .75); assert.equal(after.warehouseFill, 2 / 30);
  assert.equal(writes(), 1);
});

test('repeated restocking at shelf capacity does not repeat financial or inventory writes', () => {
  const { context: c, writes } = fixture();
  c.restockDisplays(false);
  const saved = JSON.stringify(c.inventory), count = writes();
  for (let i = 0; i < 10; i++) assert.equal(c.restockDisplays(false), 0);
  assert.equal(JSON.stringify(c.inventory), saved); assert.equal(writes(), count);
});

test('customer reservation immediately reduces visual shelves while preserving production and cash', () => {
  const { context: c } = fixture(), npc = {}, product = { id: 'esencial', price: 75 };
  const before = c.businessVisualSnapshot();
  assert.equal(c.reserveProductForNpc(npc, product), true);
  assert.equal(c.latestVisual.displayStock, before.displayStock - 1);
  assert.equal(c.latestVisual.reserveStock, before.reserveStock);
  assert.equal(c.latestVisual.producedUnits, before.producedUnits); assert.equal(c.latestVisual.cash, before.cash);
  assert.equal(npc.productId, product.id); assert.equal(npc.productPrice, product.price);
  assert.equal(c.reserveProductForNpc({}, product), false);
});

test('historical inventory with unknown output does not animate an already allocated production plan', () => {
  const { context: c } = fixture();
  delete c.inventory.producedUnits;
  const before = JSON.stringify(c.inventory), snapshot = c.businessVisualSnapshot();
  assert.equal(snapshot.producedUnits, null); assert.equal(snapshot.productionActive, false);
  assert.equal(JSON.stringify(c.inventory), before);
});

test('production presentation stops when the existing total inventory capacity is reached', () => {
  const { context: c } = fixture();
  c.inventory.producedUnits = 8;
  assert.equal(c.businessVisualSnapshot().productionActive, true);
  c.warehouseCapacity = () => 11;
  assert.equal(c.businessVisualSnapshot().productionActive, false);
  assert.equal(c.inventory.producedUnits, 8);
});
