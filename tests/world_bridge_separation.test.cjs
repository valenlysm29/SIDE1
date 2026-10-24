'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const bridgeSource=fs.readFileSync(require.resolve('../js/shared/world_bridge.js'),'utf8');
const worldSource=fs.readFileSync(require.resolve('../js/simulator3d.js'),'utf8');
const {cerrarCiclo}=require('../js/engine/ciclo.js');
const scenarios=require('./escenarios_excel.cjs');
function fixture(mode='loaded'){
 const storage=new Map(),economic={cash:200000,stock:150,score:8};
 const c={window:{},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},economic,
 businessState:{revenue:0},inventory:{sold:{}},simSales:0,gameSession:null,productById:id=>({id,price:75}),
 salesCountKey:()=> 'side3d_fun_sales_count_test',inventoryKey:()=> 'side3d_fun_inventory_test',storageContext:()=> 'test',
 saveBusinessState(){storage.set('side3d_fun_business_test',JSON.stringify(c.businessState));},updateHUD(){},showCashFx(){},fmt:String,playSfx(){},updateReputation(){},addBusinessLog(){},message(){},console};
 vm.createContext(c);
 if(mode!=='absent')vm.runInContext(bridgeSource,c);
 if(mode==='error'){c.window.SIDE_ENGINE=new Proxy({}, {get(){throw Error('economic engine offline');}});c.window.supabase=new Proxy({}, {get(){throw Error('Supabase offline');}});}
 if(mode!=='absent'){
  const start=worldSource.indexOf('  function recordSale('),end=worldSource.indexOf('\n  function ',start+1);
  vm.runInContext(worldSource.slice(start,end),c);
 }
 return {c,storage,economic};
}
test('snapshot recursively freezes a detached allowlisted projection and reads only pushed data without invoking an economic provider',()=>{
 const {c}=fixture();const engine={company:{name:'QA'},cycle:2,products:[{id:'a',nested:{stock:10}}],approximateStock:10,storeLevel:{stores:1,visual:{x:{optionIds:['a']}}},news:[{text:'news'}],events:[{data:{x:1}}],cashLedger:{secret:9}};
 c.window.SIDE_WORLD_PUBLISHER.publish(engine);
 const snapshot=c.window.SIDE_WORLD_BRIDGE.getWorldSnapshot();
 function frozen(v){if(v&&typeof v==='object'){assert.ok(Object.isFrozen(v));Object.values(v).forEach(frozen);}}
 frozen(snapshot);assert.equal(snapshot.cashLedger,undefined);
 assert.throws(()=>{snapshot.products[0].nested.stock=999;},TypeError);
 assert.throws(()=>snapshot.storeLevel.visual.x.optionIds.push('bad'),{name:'TypeError'});
 assert.equal(engine.products[0].nested.stock,10);engine.company.name='Changed';assert.equal(snapshot.company.name,'QA');
 assert.equal(c.window.SIDE_WORLD_BRIDGE.getWorldSnapshot().company.name,'QA','live engine change is invisible until publication');
 c.window.SIDE_WORLD_PUBLISHER.publish(engine);const latest=c.window.SIDE_WORLD_BRIDGE.getWorldSnapshot();assert.equal(latest.company.name,'Changed');assert.notEqual(snapshot,latest);
 let calls=0;Object.defineProperty(c.window,'SIDE_ENGINE',{get(){calls++;throw Error('forbidden engine read');}});
 for(let i=0;i<10;i++)c.window.SIDE_WORLD_BRIDGE.getWorldSnapshot();assert.equal(calls,0);assert.equal(c.window.SIDE_WORLD_BRIDGE.getWorldSnapshot().company.name,'Changed');
 const invalid={company:{name:'invalid'}};invalid.events=[invalid];
 assert.equal(c.window.SIDE_WORLD_PUBLISHER.publish(invalid),false);
 assert.equal(c.window.SIDE_WORLD_BRIDGE.getWorldSnapshot().company.name,'Changed','failed economic publication preserves the last usable atmosphere');
});
test('bridge works without economic publication and with unavailable storage',()=>{
 const c={window:{},localStorage:{getItem(){throw Error('denied');},setItem(){throw Error('denied');}}};c.window.localStorage=c.localStorage;
 vm.runInNewContext(bridgeSource,c);
 assert.equal(c.window.SIDE_WORLD_BRIDGE.getWorldSnapshot().company.name,'MI EMPRESA');assert.equal(c.window.SIDE_WORLD_BRIDGE.emitFunSale({points:5}).points,5);
});
for(const build of [scenarios.crearSim1,scenarios.crearSim2,scenarios.crearSim3]){
 test(`${build().id}: three cycle closures identical absent, loaded with 120 real POS sales, and provider error`,()=>{
  const input=build();if(input.ciclos.length===1)input.ciclos=Array.from({length:3},()=>structuredClone(input.ciclos[0]));
  // SIM-1's Excel oracle covers one cycle. Cycles 2/3 here are regression extensions,
  // comparing identical decisions and history; they do not invent Excel expectations.
  const baseline=scenarios.ejecutarEscenario(structuredClone(input),cerrarCiclo);
  for(const mode of ['loaded','error']){
   const {c,storage,economic}=fixture(mode);c.window.localStorage=c.localStorage;
   let count=0;const played=scenarios.ejecutarEscenario(structuredClone(input),(request,overrides)=>{
    for(let n=0;n<40;n++){assert.equal(c.recordSale('esencial',75),true);count++;}
    return cerrarCiclo(request,overrides);
   });
   assert.equal(count,120);assert.equal(c.simSales,120);assert.equal(c.businessState.revenue,9000);
   assert.deepEqual(played,baseline,'includes demand, units, revenue, cash, inventory, score and history');
   assert.deepEqual(economic,{cash:200000,stock:150,score:8});assert.ok([...storage.keys()].every(k=>k.startsWith('side3d_fun_')));
   assert.equal(JSON.parse(storage.get('side3d_fun_receipts_test')).customersServed,120);
  }
 });
}
test('3D source and bridge cannot import or call economic services or legacy mutable globals',()=>{
 assert.doesNotMatch(worldSource,/SIDE_GAME_BRIDGE|SIDE_WORLD_PUBLISHER|SIDE_(?:CYCLE|PRODUCTION|REVENUE|FINANCIAL)_MODEL|SIDE_RULES|cashLedger|__cyclePlans|decisionState|cycleProductionRecord/);
 assert.doesNotMatch(worldSource,/(?:import|require)\s*(?:\(|[^;\n]*from)[^;\n]*(?:engine|caja|supabase|partida_service|cycle_model)/i);
 assert.doesNotMatch(worldSource,/\bsupabase\b|\.rpc\s*\(|\.insert\s*\(/i);
 assert.doesNotMatch(worldSource,/getElementById\(['"]cashFx['"]\)/,'fun feedback cannot overwrite the economic cash animation');
 const keys=[...worldSource.matchAll(/['"`]side3d_[a-z_]+/g)].map(x=>x[0].slice(1));assert.ok(keys.length>5);assert.ok(keys.every(k=>k.startsWith('side3d_fun_')));
 assert.doesNotMatch(bridgeSource,/\bsupabase\b|cashLedger|__cyclePlans|decisionState/);
});
test('current CYCLE_MODEL closure remains byte-identical after actual POS handler transactions',()=>{
 const cycle=require('../js/cycle_model.js');
 const input={state:{CANALES:{optionIds:['web']}},capital:200000,round:1,production:{producibleUnits:500,productLines:[{plannedUnits:500}],materials:[]},allocation:{products:{esencial:{asignado:7}}}};
 const expected=cycle.close(structuredClone(input)),snapshot=JSON.stringify(input);
 for(const mode of ['loaded','error']){
  const {c}=fixture(mode);c.window.localStorage=c.localStorage;
  for(let n=0;n<80;n++)assert.equal(c.recordSale('esencial',999),true);
  const actual=cycle.close(input);assert.deepEqual(actual,expected);assert.equal(JSON.stringify(input),snapshot);
  assert.equal(actual.receipt.sold,7);assert.equal(actual.receipt.revenue,525);
 }
});
test('resetting or reloading a fun shift preserves spent local resources and economic state',()=>{
 const realState={cashLedger:{'1:DECISION':-1200},__cyclePlans:{1:{production:100}},income:525,stock:93,score:7};
 const persisted={expenses:360,revenue:75,reputation:80,production:{producedToday:10,stage:2},pendingSupplierOrder:{id:'pending',units:12},upgrades:{warehouse:1}};
 const storage=new Map([['side3d_fun_business_test',JSON.stringify(persisted)]]),before=JSON.stringify(realState);
 const c={economic:realState,businessState:null,sessionContext:'test',inventory:{sold:{premium:0}},simSales:3,simVisitors:0,gameSession:null,
 nextAutoServeAt:0,nextManagerBoostAt:0,nextEventAt:0,nextProductionAt:0,supplierDeliveryAt:0,
 storageContext:()=> 'test',clearCustomerFlow(){},loadBusinessState(){c.businessState=JSON.parse(storage.get('side3d_fun_business_test'));},
 saveBusinessState(){storage.set('side3d_fun_business_test',JSON.stringify(c.businessState));},loadDay:()=>1,saveDay(){},
 saved:()=>({optionIds:['web']}),targetProduction:()=>100,createDailyMissions:()=>[],performance:{now:()=>1000},
 hideSummaryOverlay(){},loadAudioSetting(){},updateHUD(){},updateMissionUI(){}};
 vm.createContext(c);const start=worldSource.indexOf('  function resetGameSession('),end=worldSource.indexOf('\n  function ',start+1);
 vm.runInContext(worldSource.slice(start,end),c);
 c.resetGameSession(false);assert.equal(c.businessState.expenses,360);assert.equal(c.businessState.revenue,75);
 assert.equal(c.businessState.pendingSupplierOrder.id,'pending');assert.equal(c.businessState.upgrades.warehouse,1);
 c.resetGameSession(false);assert.equal(JSON.parse(storage.get('side3d_fun_business_test')).expenses,360);
 assert.equal(c.businessState.production.producedToday,0);assert.equal(JSON.stringify(realState),before);
 assert.ok([...storage.keys()].every(k=>k.startsWith('side3d_fun_')));
});
