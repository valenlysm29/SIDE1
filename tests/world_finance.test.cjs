'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const path=require('node:path'),financial=require('../js/financial_model.js');
const app=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
const simulator=fs.readFileSync(path.join(__dirname,'../js/simulator3d.js'),'utf8');
function fixture(){
  const store=new Map();let allowed=true,fail=false,clock=1000;
  const c={window:{},cashLedger:{},decisionState:{},currentRound:()=>1,studentAccess:()=>({canOperate:allowed}),
    cashBalance:()=>100000+Object.values(c.cashLedger).reduce((a,b)=>a+b,0),ledgerKey:()=> 'ledger',
    decisionProgressPercent:()=>100,canStartSimulation:()=>true,currentStudent:{},COMPANY_NAME:'QA',
    activeStudentEvents:()=>[],productionPlan:()=>({}),financialReport:()=>({}),RULES:{storeCount:()=>1},
    savedEntry:()=>({}),findDecisionItem:()=>({}),syncStudentReportPreview(){},queueFinancialSync(){},renderStudentStatus(){},
    writeDecisionBatch(writes){if(fail)return false;for(const [k,v] of Object.entries(writes))store.set(k,v);return true;},
    console:{error(){}},readRoundRuntime:()=>({status:'running'}),businessState:{expenses:0,upgrades:{}},inventory:{reserve:{a:0,b:0,c:0},sold:{}},
    PRODUCTS:[{id:'a'},{id:'b'},{id:'c'}],storageContext:()=> 'QA_1',businessKey:()=> 'business',
    Date:{now:()=>clock},Number,Math,JSON,loadBusinessState(){},
    saveBusinessState(){store.set('business',JSON.stringify(c.businessState));},
    saveInventory(){store.set('inventory',JSON.stringify(c.inventory));},
    showCashFx(){},addBusinessLog(){},updateHUD(){},message(){},fmt:String,
    renderInventoryDisplays(){},refreshAdminUI(){},playSfx(){},showEvent(){},rebuildDynamicWorld(){},
    simSales:0,gameSession:null,productById:id=>({id,price:100}),inventoryKey:()=> 'inventory',salesCountKey:()=> 'sales',
    updateReputation(){},NPC_STATE:{QUEUE:'QUEUE',PAY:'PAY'},checkoutPayment:'cash',checkoutQueue:[],attachBagToNpc(){},showReceipt(){},setNpcState(n,state){n.state=state;},reflowQueue(){}};
  c.bridge=()=>c.window.SIDE_GAME_BRIDGE;c.operationalCash=()=>c.cashBalance();
  vm.createContext(c);
  vm.runInContext(app.slice(app.indexOf('function canOperateWorld()'),app.indexOf('\nfunction canStartSimulation')),c);
  vm.runInContext(app.slice(app.indexOf('window.SIDE_GAME_BRIDGE={'),app.indexOf('\n};',app.indexOf('window.SIDE_GAME_BRIDGE={'))+3),c);
  for(const name of ['applyExpense','orderSupplierStock','tickSupplier','buyUpgrade','recordSale','serveNextQueuedCustomer']){
    const start=simulator.indexOf(`  function ${name}(`),end=simulator.indexOf('\n  function ',start+1);
    vm.runInContext(simulator.slice(start,end),c);
  }
  return {c,store,allow:v=>allowed=v,fail:v=>fail=v,time:v=>clock=v};
}
test('world cash uses one ledger, reconciles sale commission, expense, investment and refund',()=>{
  const {c}=fixture(),bridge=c.bridge();
  assert.equal(bridge.recordOperatingExpense(360),true);
  bridge.recordSimulatedSale(100);
  bridge.recordOperatingExpense(650,'SIM_INVERSION');
  bridge.recordOperatingExpense(25,'SIM_DEVOLUCIONES');
  const f=financial.calculate({capital:100000,ledger:c.cashLedger});
  assert.equal(c.cashBalance(),99064);
  assert.equal(f.estadoResultados.utilidad,-286);
  assert.equal(f.balanceGeneral.activosFijos,650);
  assert.equal(f.balanceGeneral.activos,f.balanceGeneral.pasivoPatrimonio);
  assert.equal(f.flujoCaja.cajaFinal,c.cashBalance());
});
test('teacher pause blocks world transactions while academic decisions stay available',()=>{
  const {c}=fixture();c.readRoundRuntime=()=>({status:'paused'});
  assert.equal(c.studentAccess().canOperate,true);assert.equal(c.bridge().canOperate(),false);
  assert.equal(c.bridge().recordOperatingExpense(20),false);assert.equal(c.bridge().recordSimulatedSale(100),false);
  assert.equal(c.cashBalance(),100000);
});
test('checkout commit failure keeps customer and stock; successful retry records sale and sold atomically',()=>{
  const f=fixture(),c=f.c,npc={state:'QUEUE',productId:'a',productPrice:100,obj:{userData:{}}};c.checkoutQueue=[npc];f.fail(true);
  assert.equal(c.serveNextQueuedCustomer(),false);assert.equal(c.checkoutQueue.length,1);assert.equal(c.cashBalance(),100000);assert.equal(c.inventory.sold.a,undefined);
  f.fail(false);c.syncStudentReportPreview=()=>{throw new Error('UI failed');};
  assert.equal(c.serveNextQueuedCustomer(),true);assert.equal(c.checkoutQueue.length,0);assert.equal(c.cashBalance(),100099);
  assert.equal(JSON.parse(f.store.get('inventory')).sold.a,1);assert.equal(f.store.get('sales'),'1');
});
test('closed phases and invalid amounts cannot mutate financial state',()=>{
  const f=fixture(),bridge=f.c.bridge();f.allow(false);
  assert.equal(bridge.canOperate(),false);
  for(const call of [()=>bridge.recordSimulatedSale(100),()=>bridge.recordOperatingExpense(360)])assert.equal(call(),false);
  f.allow(true);
  for(const amount of [NaN,Infinity,-1]){assert.equal(bridge.recordSimulatedSale(amount),false);assert.equal(bridge.recordOperatingExpense(amount),false);}
  assert.equal(Object.keys(f.c.cashLedger).length,0);
});
test('supplier debit persists its order; reload delivers once without charging twice',()=>{
  const f=fixture(),c=f.c;c.orderSupplierStock();
  assert.equal(c.cashBalance(),99640);assert.equal(c.businessState.pendingSupplierOrder.units,12);
  c.orderSupplierStock();assert.equal(c.cashBalance(),99640);
  c.businessState=JSON.parse(f.store.get('business'));f.time(14000);
  c.tickSupplier(0);assert.equal(Object.values(c.inventory.reserve).reduce((a,b)=>a+b),12);
  c.tickSupplier(999999);assert.equal(Object.values(c.inventory.reserve).reduce((a,b)=>a+b),12);
  // Interrupted after inventory receipt persisted, before clearing pending order.
  c.businessState.pendingSupplierOrder={id:c.inventory.lastSupplierOrderId,dueAt:13000};
  c.tickSupplier(0);assert.equal(Object.values(c.inventory.reserve).reduce((a,b)=>a+b),12);
  assert.equal(c.cashBalance(),99640);
});
test('failed local commit and closed cycle do not create unpaid orders or upgrades',()=>{
  const f=fixture(),c=f.c;f.fail(true);c.orderSupplierStock();c.buyUpgrade('warehouse',1500,2);
  assert.equal(c.cashBalance(),100000);assert.equal(c.businessState.pendingSupplierOrder,undefined);assert.equal(c.businessState.upgrades.warehouse,undefined);
  f.fail(false);f.allow(false);c.orderSupplierStock();assert.equal(c.businessState.pendingSupplierOrder,undefined);
});
