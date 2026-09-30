'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../js/simulator3d.js'),'utf8');

function fixture(){
  let canOperate=true;
  const context={
    PRODUCTS:[{id:'esencial',color:0x775533},{id:'urbano',color:0x334455},{id:'premium',color:0x112233}],
    inventory:{display:{esencial:2,urbano:3,premium:1},reserve:{esencial:4,urbano:3,premium:2},producedUnits:15,sold:{esencial:1}},
    businessState:{pendingSupplierOrder:{id:'QA:1',units:12}},running:true,gameSession:{shiftEnded:false},
    plan:{producibleUnits:20,productLines:[{plannedUnits:20}],processes:{cutting:{capacity:20}}},
    productionSnapshot:()=>context.plan,displayCapacity:()=>4,warehouseCapacity:()=>30,
    bridge:()=>({canOperate:()=>canOperate}),decisionCash:()=>99640,currentRoundSafe:()=>2,
    owned:id=>({MESA_CORTE:2,ENSAMBLE:3,ACABADOS:1}[id]||0),
    qty:id=>({PERS_CORTE:2,PERS_ENSAMBLE:4,PERS_ACABADO:1}[id]||0)
  };
  vm.createContext(context);
  for(const name of ['displayStock','reserveStock','totalDisplayStock','totalReserveStock','businessVisualSnapshot']){
    const start=source.indexOf(`  function ${name}(`);
    assert.ok(start>=0,`runtime exports the internal ${name} boundary for test extraction`);
    const end=source.indexOf('\n  function ',start+1);
    vm.runInContext(source.slice(start,end),context);
  }
  return {context,snapshot:()=>context.businessVisualSnapshot(),allow:value=>canOperate=value};
}

test('interior projection derives shelf levels, order and capacity from existing business state',()=>{
  const f=fixture(),s=f.snapshot();
  assert.equal(s.displayStock,6);assert.equal(s.reserveStock,9);
  assert.equal(s.storeFill,.5);assert.equal(s.warehouseFill,.3);
  assert.equal(s.displayCapacity,12);assert.equal(s.warehouseCapacity,30);
  assert.equal(s.pendingUnits,12);assert.equal(s.cash,99640);assert.equal(s.round,2);
  assert.equal(s.machines.assembly,3);assert.equal(s.workers.assembly,4);
  assert.equal(s.productionPlan,f.context.plan);
  assert.equal(s.products[1].display,3);assert.equal(s.products[1].reserve,3);
});

test('repeated visual reads and detached product summaries never mutate inventory or orders',()=>{
  const f=fixture(),before=JSON.stringify({inventory:f.context.inventory,business:f.context.businessState,plan:f.context.plan});
  for(let i=0;i<100;i++){
    const s=f.snapshot();s.products[0].display=999;s.products[0].reserve=999;
  }
  assert.equal(JSON.stringify({inventory:f.context.inventory,business:f.context.businessState,plan:f.context.plan}),before);
});

test('received supplier stock changes warehouse view without fabricating produced output',()=>{
  const f=fixture(),before=f.snapshot();
  // This fixture represents the authoritative supplier receipt, not a visual mutation.
  for(const product of f.context.PRODUCTS)f.context.inventory.reserve[product.id]+=4;
  f.context.businessState.pendingSupplierOrder=null;
  const after=f.snapshot();
  assert.equal(after.reserveStock-before.reserveStock,12);
  assert.equal(after.warehouseFill,.7);assert.equal(after.pendingUnits,0);
  assert.equal(after.producedUnits,before.producedUnits);assert.equal(after.plannedUnits,20);
});

test('machine animation respects pause, shift end and completed production plan',()=>{
  const f=fixture();assert.equal(f.snapshot().productionActive,true);
  f.allow(false);assert.equal(f.snapshot().productionActive,false);
  f.allow(true);f.context.gameSession.shiftEnded=true;assert.equal(f.snapshot().productionActive,false);
  f.context.gameSession.shiftEnded=false;f.context.running=false;assert.equal(f.snapshot().productionActive,false);
  f.context.running=true;f.context.inventory.producedUnits=20;assert.equal(f.snapshot().productionActive,false);
});

test('visual capacity saturates while stock and unknown historical output remain accurate',()=>{
  const f=fixture();delete f.context.inventory.producedUnits;
  f.context.inventory.reserve.esencial=100;f.context.inventory.display.esencial=100;
  const s=f.snapshot();
  assert.equal(s.storeFill,1);assert.equal(s.warehouseFill,1);
  assert.equal(s.reserveStock,105);assert.equal(s.displayStock,104);
  assert.equal(s.producedUnits,null);
});
