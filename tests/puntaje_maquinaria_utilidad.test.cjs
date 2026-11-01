'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('../js/engine/cierre.js'),P=require('../js/production_model.js');
const F=require('./economic_v19_fixture.cjs');
const options=round=>({round,economicRulesVersion:'utility-v1'});
test('compras vigentes puntúan una vez y bajas y compras futuras no cuentan',()=>{
 const s=F.state();s.ENSAMBLE={purchases:{1:{ens_ind:2},2:{ens_ind:-2},3:{ens_semi:1}}};s.ACABADOS={purchases:{1:{aca_ind:1}}};
 s.__catalogSelection=['INF-02','INF-04','INF-05','INF-07'];
 assert.ok(E.codes(s,options(1)).includes('INF-04'));
 assert.equal(E.codes(s,options(1)).filter(x=>x==='INF-04').length,1);
 assert.ok(!E.codes(s,options(2)).includes('INF-04'));
 assert.ok(!E.codes(s,options(2)).includes('INF-03'));
 assert.ok(!E.codes(s,options(2)).includes('INF-02'));
 assert.ok(E.codes(s,options(3)).includes('INF-03'));
 assert.equal(P.calculate({state:s,catalog:F.catalog,round:2}).processes.find(p=>p.id==='assembly').machines,0);
});
test('CONS-03 y CONS-08 emplean el puntaje corregido sin cambiar la versión anterior',()=>{
 const s=F.state();s.ENSAMBLE={purchases:{1:{ens_ind:1}}};s.ACABADOS={purchases:{1:{aca_ind:1}}};s.JEFATURA.optionIds=['no_jefatura'];
 const old=E.scores(s).efficiency,corrected=E.scores(s,options(1)).efficiency;
 assert.ok(corrected>old);
 const config={...E.config,consequences:{...E.config.consequences,lowEfficiency:corrected,noLeaderEfficiency:corrected}};
 const legacy=E.prepare({state:s,catalog:F.catalog,round:1},config),modern=E.prepare({state:s,catalog:F.catalog,round:1,financialPolicy:options(1)},config);
 assert.ok(legacy.messages.some(m=>m.id==='CONS-03'));assert.ok(legacy.messages.some(m=>m.id==='CONS-08'));
 assert.ok(!modern.messages.some(m=>m.id==='CONS-03'));assert.ok(!modern.messages.some(m=>m.id==='CONS-08'));
 assert.equal(modern.plan.processes.find(p=>p.id==='assembly').pairs,1);
});
test('la configuración conserva la versión explícita',()=>{
 assert.equal(require('../services/finance_config.js').resolve({economicRulesVersion:'utility-v1'},1).economicRulesVersion,'utility-v1');
 assert.equal(require('../services/finance_config.js').resolve({},1).economicRulesVersion,undefined);
});
