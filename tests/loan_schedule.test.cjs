'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),L=require('../js/loan_schedule'),C=require('../js/cycle_model'),F=require('../js/financial_model'),fixture=require('./economic_v19_fixture.cjs');
const policy={version:'french-v1'},near=(a,b)=>assert.ok(Math.abs(a-b)<.011,`${a} != ${b}`);
test('French installments use the existing TEA, conserve principal and end at zero',()=>{
 let book=[],principal=0,payments=[];
 for(let round=1;round<=3;round++){
  const p=L.prepare({book,round,cycles:3,amount:round===1?1000:0,tea:20,policy});
  const r=L.pay(p,10000);book=r.book;principal+=r.principalPaid;payments.push(r.totalPaid);
  near(r.debt,1000-principal);assert.ok(r.debt>=0);assert.equal(p.book[0].interestArrears,p.interest);
 }
 assert.equal(book[0].balance,0);assert.equal(principal,1000);near(payments[0],payments[1]);assert.ok(Math.abs(payments[2]-payments[1])<=.02);
});
test('zero interest, remaining term and insufficient cash retain arrears without capitalizing interest',()=>{
 const p=L.prepare({round:2,cycles:3,amount:100,tea:0,policy});assert.equal(p.book[0].installment,50);
 const first=L.pay(p,5);assert.equal(first.debt,95);assert.equal(first.book[0].principalArrears,45);
 const next=L.pay(L.prepare({book:first.book,round:3,cycles:3,tea:0,policy}),1000);assert.equal(next.principalPaid,95);assert.equal(next.debt,0);
 assert.equal(JSON.stringify(p),JSON.stringify(L.prepare({round:2,cycles:3,amount:100,tea:0,policy})));
 assert.throws(()=>L.prepare({round:3,cycles:3,amount:100,tea:20,policy:{version:'french-v1',termCycles:2}}));
 assert.throws(()=>L.prepare({book:p.book,round:2,cycles:3,tea:20,policy}));assert.throws(()=>L.pay(p,-1));
});
test('contractual rate is fixed per disbursement; new loans use the current rate',()=>{
 const a=L.pay(L.prepare({round:1,cycles:3,amount:1000,tea:10,policy}),1000);
 const p=L.prepare({book:a.book,round:2,cycles:3,amount:200,tea:30,policy});assert.equal(p.book[0].tea,10);assert.equal(p.book[1].tea,30);
 near(p.interest,Math.round((a.debt*(Math.pow(1.1,1/12)-1)+200*(Math.pow(1.3,1/12)-1))*100)/100);
});
for(const cycles of [3,6])test(`financial integration ${cycles} cycles: principal is financing, interest is expense; replay is immutable`,()=>{
 let previous=null;let paid=0;
 for(let round=1;round<=cycles;round++){
  const s=fixture.state(round,previous?.state||{},(round-1)%3);s.PRESTAMO={round,amount:round===1?1000:0};
  const args={state:C.restoreState(s,previous?.state||{}),ledger:previous?.ledger||{},sectionsByRound:previous?.financialSections||{},round,catalog:fixture.catalog,capital:1000000,financialPolicy:{cycles,interest:20,loanPolicy:policy}};
  const r=C.close(args),f=r.financial,e=f.estadoResultados,b=f.balanceGeneral;const principal=f.loanPayments.reduce((n,p)=>n+p.principal,0),interest=f.loanPayments.reduce((n,p)=>n+p.interest,0);paid+=principal;
  near(b.deuda,1000-paid);assert.equal(b.activos,b.pasivoPatrimonio);assert.equal(f.flujoCaja.amortizacionPrestamos,-principal);assert.equal(f.flujoCaja.interesesBancariosPagados,-interest);
  near(e.gastosFinancieros,interest);near(f.flujoCaja.cajaInicial+f.flujoCaja.flujoNeto,b.efectivo);
  const replay=C.close({...args,state:r.state,ledger:r.ledger});assert.equal(replay.reused,true);assert.deepEqual(replay.financial,f);
  const rebuild=structuredClone(r.state);delete rebuild.__financialSnapshots[round];const rebuilt=F.calculate({...args,state:rebuild,ledger:r.ledger,sectionsByRound:r.financialSections});assert.deepEqual(rebuilt.estadoResultados,e);assert.deepEqual(rebuilt.balanceGeneral,b);
  previous=r;
 }
 assert.equal(previous.financial.balanceGeneral.deuda,0);assert.equal(paid,1000);
});
test('no opt-in preserves accrued-only legacy loans and never converts unexplained historical balances',()=>{
 const args={capital:1000,catalog:[{items:[{id:'PRESTAMO'}]}],round:1,ledger:{'1:E':100},sectionsByRound:{1:{E:{recordedNet:100,items:[{id:'PRESTAMO',financing:100}]}}},state:{__cycleSettlements:{1:{decisions:{}}}},financialPolicy:{cycles:3,interest:20}};
 const r=F.calculate(args);assert.equal(r.balanceGeneral.deuda,100);assert.ok(r.balanceGeneral.interesesPorPagar>0);assert.equal(r.loanBook,undefined);
 assert.throws(()=>F.calculate({...args,openingBalance:{round:0,balanceGeneral:{deuda:10}},financialPolicy:{...args.financialPolicy,loanPolicy:policy}}),/sin calendario verificable/);
});
