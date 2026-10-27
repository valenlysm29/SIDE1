'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const CYCLE=require('../js/cycle_model'),FIN=require('../js/financial_model'),ECON=require('../js/engine/cierre');
const {state,catalog}=require('./economic_v19_fixture.cjs');
const input=s=>({state:s,catalog,round:1,capital:200000});

test('old empty, partial and unavailable machine assignments cannot strand hired staff',()=>{
  for(const assignments of [{},{ens_personal_esp:{}},{ens_personal_esp:{ens_basica:4}},{ens_personal_esp:{ens_ind:1}}]){
    const s=state();s.PERS_ENSAMBLE.assignments=assignments;s.PERS_ACABADO.assignments={};
    const before=JSON.stringify(s),r=CYCLE.close(input(s));
    assert.equal(r.receipt.produced,90);assert.equal(r.receipt.sold,90);assert.equal(r.receipt.revenue,3825);
    const assembly=r.receipt.production.processes.find(p=>p.id==='assembly');
    assert.equal(assembly.pairs,4);assert.equal(assembly.assignments.ens_personal_esp.ens_ind,4);
    assert.equal(JSON.stringify(s),before);
  }
  for(const key of ['ENSAMBLE','PERS_ENSAMBLE','ACABADOS','PERS_ACABADO']){
    const s=state();s.PERS_ENSAMBLE.assignments={};s.PERS_ACABADO.assignments={};delete s[key];
    assert.equal(CYCLE.close(input(s)).receipt.sold,0,key);
  }
});

test('hidden malformed legacy prices fall back internally without blocking other companies',()=>{
  for(const prices of [{esencial:'',urbano:'bad',premium:null},{esencial:-1,urbano:{},premium:[]},null]){
    const a=state(),b=state(1,{},1);a.PRODUCCION_META.prices=prices;
    const before=JSON.stringify(a),results=CYCLE.closeMany([{id:'A',...input(a)},{id:'B',...input(b)}]);
    assert.equal(results.A.receipt.sold,90);assert.equal(results.A.receipt.revenue,3825);
    assert.equal(results.A.receipt.sales[1].price,100);assert.ok(results.B.receipt.revenue>0);
    assert.equal(results.A.receipt.sales[2].price,250);
    assert.equal(JSON.stringify(a),before);
  }
  assert.throws(()=>ECON.prepare({...input(state()),prices:{esencial:-1}}),/Precio/);
});

test('a preliminary zero snapshot is replaced by settled sales while closed history stays frozen',()=>{
  const s=state(),preliminary=FIN.calculate({capital:200000,round:1});
  s.__financialSnapshots={1:preliminary};const before=JSON.stringify(s);
  const estimate=CYCLE.project(input(s)),r=CYCLE.close(input(s));
  assert.equal(r.receipt.sold,90);assert.equal(r.financial.estadoResultados.ingresos,3825);
  assert.equal(r.financial.estadoResultados.ingresos,r.ledger['1:SIM_VENTAS']);
  assert.equal(estimate.financial.estadoResultados.ingresos,3825);assert.equal(JSON.stringify(s),before);
  const retry=CYCLE.close({...input(r.state),ledger:r.ledger,sectionsByRound:r.financialSections});
  assert.equal(retry.reused,true);assert.deepEqual(retry.financial,r.financial);
});

test('three cycles across four companies and every segment reconcile sales, stock, reports and retries',()=>{
  const previous={},ledger={},sections={},rows=[];
  for(let round=1;round<=3;round++){
    const inputs=[0,1,2,3].map(type=>{
      const s=state(round,previous[type]||{},type);
      s.PERS_ENSAMBLE.assignments={};s.PERS_ACABADO.assignments={aca_personal_art:{aca_basica:4}};
      s.PRODUCCION_META.prices={esencial:'',urbano:'bad',premium:null};
      s.__financialSnapshots={...s.__financialSnapshots,[round]:FIN.calculate({capital:200000,round})};
      return {id:String(type),state:s,ledger:ledger[type],sectionsByRound:sections[type],catalog,round,capital:200000};
    });
    const results=CYCLE.closeMany(inputs);
    for(const source of inputs){
      const r=results[source.id],receipt=r.receipt;
      assert.equal(receipt.produced,90);assert.equal(receipt.sold,90);
      assert.equal(receipt.revenue,receipt.sales.reduce((total,line)=>total+line.sold*line.price,0));
      assert.equal(r.financial.estadoResultados.ingresos,receipt.revenue);
      assert.equal(r.state.__financialSnapshots[round].estadoResultados.ingresos,receipt.revenue);
      assert.equal(r.financial.balanceCaja.cajaFinal,Math.round((200000+Object.values(r.ledger).reduce((a,b)=>a+b,0))*100)/100);
      for(const line of receipt.sales)assert.equal(line.available-line.sold,r.state.__finishedGoods[line.id]);
      if(round>1)assert.deepEqual(r.state.__cycleSettlements[round-1],previous[source.id].__cycleSettlements[round-1]);
      assert.deepEqual(CYCLE.close({...source,state:r.state,ledger:r.ledger,sectionsByRound:r.financialSections}).financial,r.financial);
      previous[source.id]=r.state;ledger[source.id]=r.ledger;sections[source.id]=r.financialSections;
      rows.push({company:source.id,round,produced:receipt.produced,sold:receipt.sold,revenue:receipt.revenue});
    }
  }
  require('node:fs').writeFileSync(require('node:path').join(__dirname,'output/sales-recovery-matrix.json'),JSON.stringify(rows,null,2));
});
