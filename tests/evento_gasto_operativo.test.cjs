'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const cycle=require('../js/cycle_model.js'),fixture=require('./economic_v19_fixture.cjs');
for(const [id,amount,needsStore] of [['PE23',500,true],['PE68',1200,false],['PE77',300,true]])test(`${id} registra gasto una vez sin alterar producción ni crear ventas`,()=>{
 const state=fixture.state();state.CANALES={round:1,optionIds:['web','los_olivos'],quantities:{los_olivos:1}};
 const input={state,catalog:fixture.catalog,round:1,capital:1000000},event={id,round:1,intensity:1,version:'operating-expense-v1'};
 const base=cycle.close(input),actual=cycle.close({...input,events:[event]});
 assert.equal(actual.receipt.produced,base.receipt.produced);assert.equal(actual.receipt.sold,base.receipt.sold);
 assert.equal(actual.ledger[`1:EVENT:${id}`],-amount);assert.equal(actual.financial.flujoCaja.eventos,-amount);
 assert.equal(actual.financial.balanceCaja.cajaFinal,base.financial.balanceCaja.cajaFinal-amount);
 assert.equal(actual.financial.estadoResultados.utilidadAntesImpuestos,base.financial.estadoResultados.utilidadAntesImpuestos-amount);
 assert.equal(actual.financial.balanceGeneral.activos,actual.financial.balanceGeneral.pasivoPatrimonio);
 const retry=cycle.close({...input,state:actual.state,ledger:actual.ledger,sectionsByRound:actual.financialSections,events:[event]});assert.equal(retry.reused,true);assert.deepEqual(retry.receipt,actual.receipt);
 if(needsStore){const noStore=structuredClone(state);noStore.CANALES={round:1,optionIds:['web']};const out=cycle.close({...input,state:noStore,events:[event]});assert.equal(out.ledger[`1:EVENT:${id}`],undefined);assert.deepEqual(out.receipt.events,[]);}
});
