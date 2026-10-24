'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../js/cycle_cost_notice.js'),'utf8');
function fixture(visible){
 const counts={access:0,costs:0,persist:0,snapshot:0,hud:0,report:0,sync:0,modal:0};
 const receipt={round:1,total:360,before:10000,after:9640,items:[{label:'Costo fijo',amount:360}]};
 const nodes=new Map();
 const node=id=>({classList:{contains:()=>id===visible?false:true},textContent:'',replaceChildren(){},append(){}});
 const c={studentConnected:true,currentStudent:{game:{codigo:'QA'},company:'TEST'},decisionState:{__cycleCosts:{1:receipt}},currentRound:()=>1,
 $:id=>{if(!nodes.has(id))nodes.set(id,node(id));return nodes.get(id);},studentAccess(){counts.access++;return {canOperate:true};},
 ensureCycleFixedCosts(){counts.costs++;return receipt;},persistGameState(){counts.persist++;},queueStudentSnapshot(){counts.snapshot++;},
 updateCashHud(){counts.hud++;},syncStudentReportPreview(){counts.report++;return {};},syncReportToSupabase(){counts.sync++;},
 showModal(){counts.modal++;},localStorage:{getItem:()=>null},document:{createElement:()=>({append(){}})},console};
 vm.createContext(c);vm.runInContext(source,c);return {c,counts,nodes,receipt,show2d(){visible='decisions';}};
}
for(const screen of ['simulator3d','simulationLoading'])test(`economic cost notice has no economic reads or writes while ${screen} is visible`,()=>{
 const f=fixture(screen);assert.equal(f.c.maybeShowCycleCostNotice(),null);
 assert.deepEqual(f.counts,{access:0,costs:0,persist:0,snapshot:0,hud:0,report:0,sync:0,modal:0});
 assert.equal(f.receipt.acknowledged,undefined);
 f.show2d();assert.equal(f.c.maybeShowCycleCostNotice(),f.receipt);
 assert.equal(f.counts.access,1);assert.equal(f.counts.costs,1);assert.equal(f.counts.hud,1);
 assert.equal(f.counts.report,1);assert.equal(f.counts.sync,1);assert.equal(f.counts.modal,1);
 assert.equal(f.nodes.get('cycleCostsCycle').textContent,'Ciclo 1');
 assert.equal(f.counts.persist,0,'displaying receipt does not create a charge');
});
