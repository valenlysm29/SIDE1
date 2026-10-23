'use strict';
// Independent verification of the charged amount, not of a parallel projection.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(process.env.SIDE_ROOT||path.join(__dirname,'..'));
function runtime(){
 const elements=new Map(),storage=new Map();
 function element(){return {innerHTML:'',textContent:'',value:'',dataset:{},style:{setProperty(){}},offsetHeight:82,getBoundingClientRect:()=>({top:0,left:0,right:800,bottom:82,width:800,height:82}),classList:{add(){},remove(){},toggle(){},contains(){return false}},addEventListener(){},setAttribute(){},removeAttribute(){},querySelector:()=>element(),querySelectorAll:()=>[],focus(){}};}
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},createElement:()=>element()};
 const c=vm.createContext({document,URLSearchParams,location:{search:''},console,setInterval(){},clearInterval(){},setTimeout(){},clearTimeout(){},requestAnimationFrame(){},ResizeObserver:class{observe(){}},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k),key:i=>[...storage.keys()][i],get length(){return storage.size}}});c.window=c;c.addEventListener=()=>{};c.scrollTo=()=>{};
 for(const name of ['js/engine/config_excel.js','js/engine/costos.js','js/side_rules.js','js/decision_catalog.js','js/production_model.js','js/decision_review_model.js','js/production_dop.js','js/financial_model.js','js/app.js','js/cycle_cost_notice.js','js/company_summary.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,name),'utf8'),c,{filename:name});
 const run=code=>vm.runInContext(code,c),json=code=>JSON.parse(JSON.stringify(run(code)));
 run("syncStudentReportPreview=()=>({});syncReportToSupabase=()=>{};syncSectionToSupabase=()=>{};queueFinancialSync=()=>{};animateCash=()=>{};updateHud=()=>{};renderTabs=()=>{};renderDecisionCategory=()=>{};currentStudent={company:'Aviso QA',legalName:'Aviso QA SAC',game:{id:'qa-fixed',codigo:'SIDE-QA'}};studentConnected=true;studentProgressHydrated=true;localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital:100000,cycles:3,cycleCloseMode:'manual',integrationMinutes:0}));localStorage.setItem('SIDE_GAME_STATUS',JSON.stringify({active:true,startedAt:new Date(Date.now()-1000).toISOString()}));");
 const cycle=n=>run("localStorage.setItem('SIDE_ACTIVE_ROUND','"+n+"');localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify({round:"+n+",phase:'decisions',status:'running',running:true,remaining:600}));decisionDrafts={};");cycle(1);
 return {run,json,elements,storage,cycle};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('each of three cycles charges exactly the announced fixed rows in the real cash ledger',()=>{
 const r=runtime();let last=100000;
 for(let cycle=1;cycle<=3;cycle++){
  r.cycle(cycle);r.run('ensureCycleFixedCosts()');const receipt=r.json(`decisionState.__cycleCosts[${cycle}]`),ledger=r.json('cashLedger');
  assert.equal(receipt.round,cycle);assert.equal(receipt.acknowledged,false);assert.deepEqual(receipt.items.map(i=>i.id).sort(),['LIMPIEZA','LOCAL_PROD']);
  near(receipt.total,2712.32);near(receipt.items.reduce((sum,i)=>sum+i.amount,0),receipt.total);near(receipt.before,last);near(receipt.after,last-receipt.total);near(r.run('cashBalance()'),receipt.after);
  const cycleDelta=Object.entries(ledger).filter(([key])=>key.startsWith(cycle+':')).reduce((sum,[,amount])=>sum+Number(amount),0);near(cycleDelta,-receipt.total);
  const before=JSON.stringify(ledger);r.run('ensureCycleFixedCosts();ensureCycleFixedCosts();loadDecisionState();ensureCycleFixedCosts();');assert.equal(JSON.stringify(r.json('cashLedger')),before,'re-entry/ticks do not duplicate charge');
  r.run('activeCycleCostNotice={owner:cycleCostNoticeOwner(),round:currentRound()};acknowledgeCycleCostNotice()');assert.equal(r.run(`decisionState.__cycleCosts[${cycle}].acknowledged`),true);r.run('loadDecisionState();ensureCycleFixedCosts()');assert.equal(r.run(`decisionState.__cycleCosts[${cycle}].acknowledged`),true);
  last=receipt.after;
 }
});
test('saving the same infrastructure and production costs never charges announced mandatory rows again',()=>{
 const r=runtime();r.run('ensureCycleFixedCosts()');const before=r.run('cashBalance()');r.run("currentCategory='B';saveCurrentSection();currentCategory='C';saveCurrentSection();ensureCycleFixedCosts()");near(r.run('cashBalance()'),before);near(r.json('decisionState.__cycleCosts[1]').total,2712.32);
});
test('integration and pause cannot charge, and a resumed cycle only charges once',()=>{
 const r=runtime();r.run("localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify({round:1,phase:'integration',status:'scheduled',running:false,remaining:60}));localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital:100000,lifecycleVersion:2,cycles:3,integrationMinutes:0}));ensureCycleFixedCosts()");near(r.run('cashBalance()'),100000);assert.equal(r.run('Boolean(decisionState.__cycleCosts?.[1])'),false);
 r.run("localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify({round:1,phase:'decisions',status:'paused',running:false,remaining:60}));ensureCycleFixedCosts()");near(r.run('cashBalance()'),100000);
 r.cycle(1);r.run("localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({capital:100000,cycles:3,integrationMinutes:0}));ensureCycleFixedCosts()");near(r.run('cashBalance()'),97287.68);
});
test('unsaved optional purchases, payroll and loan cannot enter the automatic cost notice or real ledger',()=>{
 const r=runtime();r.run("initDraft(findDecisionItem('PERS_CORTE')).quantities.corte_maestro=8;initDraft(findDecisionItem('PRESTAMO')).amount=5000;initDraft(findDecisionItem('ENSAMBLE')).quantities.ens_ind=3;ensureCycleFixedCosts()");const receipt=r.json('decisionState.__cycleCosts[1]');near(receipt.total,2712.32);near(r.run('cashBalance()'),97287.68);assert.equal(r.json('cashLedger')['1:E']||0,0);
});

test('next-cycle notice preserves saved staff and store commitments without repeating marketing or loan',()=>{
 const r=runtime();r.run("ensureCycleFixedCosts();initDraft(findDecisionItem('PERS_CORTE')).quantities.corte_basico=1;currentCategory='C';saveCurrentSection();const channels=initDraft(findDecisionItem('CANALES'));channels.optionIds=['los_olivos'];channels.quantities={los_olivos:1};currentCategory='D';saveCurrentSection();initDraft(findDecisionItem('INV_MARKETING')).optionIds=['mkt_baja'];initDraft(findDecisionItem('PRESTAMO')).amount=5000;currentCategory='E';saveCurrentSection();");
 const prior=r.run('cashBalance()');r.cycle(2);r.run('ensureCycleFixedCosts()');const receipt=r.json('decisionState.__cycleCosts[2]');
 assert.deepEqual(receipt.items.map(i=>i.id).sort(),['CANALES','LIMPIEZA','LOCAL_PROD','PERS_CORTE']);near(receipt.total,6203.12);near(receipt.before,prior);near(receipt.after,prior-6203.12);near(r.run('cashBalance()'),receipt.after);assert.equal(r.json('cashLedger')['2:E']||0,0,'old loan is not paid again');
});

test('acknowledged receipt survives the real student snapshot hydration contract without duplicate debit',()=>{
 const r=runtime();r.run('ensureCycleFixedCosts();activeCycleCostNotice={owner:cycleCostNoticeOwner(),round:currentRound()};acknowledgeCycleCostNotice();window.savedCostSnapshot=buildStudentSnapshot();');
 const before=r.run('cashBalance()');r.run("decisionState={};cashLedger={};decisionDrafts={};localStorage.removeItem(decisionKey());localStorage.removeItem(ledgerKey());localStorage.removeItem(cycleCostAcknowledgementKey(1));hydrateRemoteProgress({partida:{id:'qa-fixed'},empresa:{id:1,caja_actual:97287.68,ciclo_actual:1},snapshot:window.savedCostSnapshot,ciclo_partida:1});ensureCycleFixedCosts()");
 assert.equal(r.run('decisionState.__cycleCosts[1].acknowledged'),true);near(r.run('cashBalance()'),before);assert.equal(r.json('decisionState.__cycleCosts[1]').items.length,2);
});

test('zero existing fixed charges cannot create a notice or any cash movement',()=>{
 const r=runtime();r.run("prepareSectionSave=()=>({model:{items:[]},net:0,entries:{}});window.modalShown=0;showModal=()=>window.modalShown++;");r.run("document.getElementById('modalRoot').classList.contains=cls=>cls==='hidden';");
 assert.equal(r.run('ensureCycleFixedCosts()'),null);assert.equal(r.run('maybeShowCycleCostNotice()'),null);assert.equal(r.run('window.modalShown'),0);near(r.run('cashBalance()'),100000);assert.deepEqual(r.json('cashLedger'),{});
});
test('another company cannot inherit the acknowledgement or charge receipt of the previous company',()=>{
 const r=runtime();r.run('ensureCycleFixedCosts();activeCycleCostNotice={owner:cycleCostNoticeOwner(),round:1};acknowledgeCycleCostNotice();');const firstKey=r.run('cycleCostAcknowledgementKey(1)');
 r.run("currentStudent={company:'Otra empresa',legalName:'Otra SAC',game:{id:'qa-fixed',codigo:'SIDE-QA'}};loadDecisionState();ensureCycleFixedCosts();");assert.notEqual(r.run('cycleCostAcknowledgementKey(1)'),firstKey);assert.equal(r.run('decisionState.__cycleCosts[1].acknowledged'),false);assert.equal(r.run('localStorage.getItem(cycleCostAcknowledgementKey(1))'),null);near(r.run('cashBalance()'),97287.68);
});
