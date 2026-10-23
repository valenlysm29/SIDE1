'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const path=require('node:path'),financial=require('../js/financial_model.js');
const app=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
const simulator=fs.readFileSync(path.join(__dirname,'../js/simulator3d.js'),'utf8');
function fixture(){
  const store=new Map();let allowed=true,fail=false,clock=1000;
  const c={window:{},deepClone:structuredClone,localStorage:{setItem:(key,value)=>store.set(key,value)},cashLedger:{},decisionState:{},currentRound:()=>1,studentAccess:()=>({canOperate:allowed}),
    cashBalance:()=>100000+Object.values(c.cashLedger).reduce((a,b)=>a+b,0),ledgerKey:()=> 'ledger',
    decisionProgressPercent:()=>100,canStartSimulation:()=>true,currentStudent:{},COMPANY_NAME:'QA',
    activeStudentEvents:()=>[],productionPlan:()=>({}),financialReport:()=>({}),RULES:{storeCount:()=>1},
    savedEntry:()=>({}),findDecisionItem:()=>({}),syncStudentReportPreview(){},queueFinancialSync(){},renderStudentStatus(){},
    writeDecisionBatch(writes){if(fail)return false;for(const [k,v] of Object.entries(writes))store.set(k,v);return true;},
    console:{error(){}},readRoundRuntime:()=>({status:'running'}),businessState:{expenses:0,upgrades:{}},inventory:{reserve:{a:0,b:0,c:0},sold:{}},
    PRODUCTS:[{id:'a'},{id:'b'},{id:'c'}],storageContext:()=> 'QA_1',businessKey:()=> 'business',
    Date:{now:()=>clock},studentNow:()=>clock,Number,Math,JSON,loadBusinessState(){},
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
test('world sales, supplier expenses and upgrades never mutate economic cash',()=>{
  const {c,store}=fixture();
  assert.equal(c.bridge().recordSimulatedSale,undefined);assert.equal(c.bridge().recordOperatingExpense,undefined);
  assert.equal(c.recordSale('a',100),true);assert.equal(c.applyExpense(360,'World supplier'),true);
  c.buyUpgrade('warehouse',1500,2);
  assert.equal(c.cashBalance(),100000);assert.deepEqual(c.cashLedger,{});
  assert.equal(c.businessState.revenue,100);assert.equal(JSON.parse(store.get('inventory')).sold.a,1);
});
test('teacher pause and closed cycles block entertainment transactions',()=>{
  const f=fixture(),c=f.c;c.readRoundRuntime=()=>({status:'paused'});
  assert.equal(c.recordSale('a',100),false);assert.equal(c.applyExpense(360,'supplier'),false);
  c.readRoundRuntime=()=>({status:'running'});f.allow(false);
  assert.equal(c.recordSale('a',100),false);assert.equal(c.cashBalance(),100000);
});

test('supplier delivery follows the server clock despite a shifted device clock',()=>{
  const f=fixture(),c=f.c;let serverTime=500000;
  c.bridge().serverNow=()=>serverTime;
  f.time(999999999);c.orderSupplierStock();
  assert.equal(c.businessState.pendingSupplierOrder.orderedAt,500000);
  assert.equal(c.businessState.pendingSupplierOrder.dueAt,512000);
  c.tickSupplier(0);assert.equal(Object.values(c.inventory.reserve).reduce((a,b)=>a+b),0);
  f.time(-999999999);serverTime=511999;c.tickSupplier(0);
  assert.equal(Object.values(c.inventory.reserve).reduce((a,b)=>a+b),0);
  serverTime=512000;c.tickSupplier(0);
  assert.equal(Object.values(c.inventory.reserve).reduce((a,b)=>a+b),12);
  c.tickSupplier(0);assert.equal(Object.values(c.inventory.reserve).reduce((a,b)=>a+b),12);
});
