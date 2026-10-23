
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const cycle=require('../js/cycle_model.js'),finance=require('../js/financial_model.js');
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../js/decision_catalog.js'),'utf8'),sandbox);const catalog=sandbox.window.SIDE_DECISION_CATALOG;
function transition(){
 const prior={habilitado:true,round:2,decisiones:{maquinaria:{'INF-02':1},compras:{},lotes:[],seleccion:[]},transicion:{maquinariaActivos:{'INF-02':1},activosCosto:3500,cajaFinal:101500,deudaPrincipal:5000,inventarioMP:{'INS-01':12}}};
 const input={state:{__excel:prior},ledger:{'1:B':-3500,'1:PRESTAMO':5000},capital:100000,round:2,catalog};return {input,prior,result:cycle.migrate(input)};
}
test('Autonomous migration retains paid assets, cash, debt and materials without duplicating purchase or financing',()=>{
 const {input,prior,result:r}=transition();assert.equal(r.migrated,true);assert.deepEqual(r.archive,prior);assert.deepEqual(input.state,{__excel:prior},'migration never mutates the archived source');
 assert.equal(r.state.ENSAMBLE.purchases[2].ens_basica,1);assert.equal(r.state.__inventarioMP.cuero_sint,12);assert.equal(r.state.__openingBalance.cash,101500);assert.equal(r.state.__openingBalance.balanceGeneral.deuda,5000);assert.equal(r.state.__openingBalance.balanceGeneral.activosFijos,3500);
 assert.equal(100000+Object.values(r.ledger).reduce((a,b)=>a+b,0),101500);
 const f=finance.calculate({state:r.state,ledger:r.ledger,catalog,capital:100000,round:2,openingBalance:r.state.__openingBalance});
 assert.equal(f.balanceCaja.cajaInicial,101500);assert.equal(f.balanceCaja.cajaFinal,101500);assert.equal(f.balanceGeneral.deuda,5000);assert.equal(f.balanceGeneral.activosFijos,3500);
 const closed=cycle.close({state:r.state,ledger:r.ledger,catalog,capital:100000,round:2,production:{producibleUnits:0,productLines:[],materials:[]}});
 assert.equal(closed.ledger['1:B'],-3500);assert.equal(closed.ledger['1:PRESTAMO'],5000);assert.equal(closed.ledger['2:B'],undefined);assert.equal(closed.ledger['2:PRESTAMO'],undefined);
});
test('A paid current-cycle decision remains canonical and migration is idempotent across reloads',()=>{
 const canonical={ENSAMBLE:{purchases:{1:{ens_basica:1}}}},ledger={'1:B':-3500};
 const untouched=cycle.migrate({state:canonical,ledger,catalog,capital:100000,round:1});assert.equal(untouched.migrated,false);assert.deepEqual(untouched.state,canonical);assert.deepEqual(untouched.ledger,ledger);
 const {result:r}=transition(),again=cycle.migrate({state:r.state,ledger:r.ledger,catalog,capital:100000,round:2});assert.equal(again.migrated,false);assert.deepEqual(again.state,r.state);assert.deepEqual(again.ledger,r.ledger);assert.equal(100000+Object.values(again.ledger).reduce((a,b)=>a+b,0),101500);
});
