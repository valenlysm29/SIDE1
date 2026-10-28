'use strict';
// Security regression witness: demonstrates current trust boundary, not a fix.
const test=require('node:test'),assert=require('node:assert/strict');
const cycle=require('../js/cycle_model.js');
test('witness: untrusted current ledger changes closing cash',()=>{
 const baseline=cycle.close({round:1,capital:1000,state:{},ledger:{},catalog:[]});
 const forged=cycle.close({round:1,capital:1000,state:{},ledger:{'1:FORGED':900000},catalog:[]});
 assert.equal(forged.financial.balanceCaja.cajaFinal-baseline.financial.balanceCaja.cajaFinal,900000);
});
test('witness: a forged known section bypasses reconstruction of confirmed decisions',()=>{
 const catalog=require('../js/decision_catalog.js');
 const state={LOCAL_PROD:{round:1,optionIds:['local_alquiler']}};
 const baseline=cycle.close({round:1,capital:1000,state,ledger:{},catalog});
 const forged=cycle.close({round:1,capital:1000,state,ledger:{'1:B':900000},catalog});
 assert.equal(forged.financial.balanceCaja.cajaFinal-baseline.financial.balanceCaja.cajaFinal,900000);
});
