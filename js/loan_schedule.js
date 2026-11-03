/* Optional French loan contract. No policy is inferred for historical debt. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SIDE_LOAN_SCHEDULE=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x)),money=x=>Math.round((x+Number.EPSILON)*100)/100||0;
 const number=(x,label)=>{if(typeof x!=='number'||!Number.isFinite(x)||x<0)throw new RangeError('Préstamo: '+label+' inválido.');return x;};
 function prepare({book=[],round,amount=0,tea,penaltyPP=0,policy,cycles}={}){
  if(!policy||policy.version!=='french-v1')throw new RangeError('Política de amortización no soportada.');
  if(!Number.isInteger(round)||round<1||!Number.isInteger(cycles)||round>cycles||cycles>6)throw new RangeError('Plazo de partida inválido.');
  number(amount,'desembolso');number(tea,'TEA');number(penaltyPP,'penalidad');
  const remaining=cycles-round+1,term=policy.termCycles??remaining;
  if(amount&&(!Number.isInteger(term)||term<1||term>remaining))throw new RangeError('El plazo supera los ciclos restantes.');
  const loans=clone(book),ids=new Set();
  for(const l of loans){if(!l.id||ids.has(l.id)||!Number.isInteger(l.openedRound)||l.openedRound<1||l.openedRound>round||!Number.isInteger(l.periods)||l.periods<1||l.openedRound+l.periods-1>cycles||l.lastAccruedRound!==round-1)throw new RangeError('Calendario duplicado o fuera de orden.');ids.add(l.id);for(const k of ['original','balance','rate','installment','principalArrears','interestArrears'])number(l[k],k);if(l.balance>l.original||l.principalArrears>l.balance)throw new RangeError('Saldo de préstamo inconsistente.');}
  if(amount){const rate=Math.pow(1+(tea+penaltyPP)/100,1/12)-1,id='loan:'+round;if(ids.has(id))throw new RangeError('Desembolso duplicado.');loans.push({id,openedRound:round,periods:term,tea:tea+penaltyPP,rate,original:money(amount),balance:money(amount),installment:money(rate?amount*rate/(1-Math.pow(1+rate,-term)):amount/term),principalArrears:0,interestArrears:0,lastAccruedRound:round-1});}
  let interest=0;const due=[];
  for(const l of loans){
   const elapsed=round-l.openedRound+1,charge=money(l.balance*l.rate);interest=money(interest+charge);
   // Arrears do not capitalize interest or create a second installment. The
   // contractual principal schedule is maintained even if an earlier one was unpaid.
   const theoretical=elapsed>=l.periods?l.balance:money(l.original*Math.pow(1+l.rate,elapsed-1)-l.installment*(l.rate?(Math.pow(1+l.rate,elapsed-1)-1)/l.rate:elapsed-1));
   const scheduled=elapsed>=l.periods?l.balance-l.principalArrears:Math.min(l.balance-l.principalArrears,Math.max(0,money(l.installment-money(theoretical*l.rate))));
   l.principalArrears=money(Math.min(l.balance,l.principalArrears+scheduled));l.interestArrears=money(l.interestArrears+charge);l.lastAccruedRound=round;
   due.push({id:l.id,interestAccrued:charge,principalDue:l.principalArrears,interestDue:l.interestArrears});
  }
  return {version:'french-v1',round,book:loans,interest,disbursement:money(amount),due};
 }
 function pay(prepared,available){
  number(available,'caja disponible');const result=clone(prepared);let cash=money(available),principalPaid=0,interestPaid=0;const payments=[];
  for(const loan of result.book){const interest=money(Math.min(cash,loan.interestArrears));cash=money(cash-interest);loan.interestArrears=money(loan.interestArrears-interest);const principal=money(Math.min(cash,loan.principalArrears));cash=money(cash-principal);loan.principalArrears=money(loan.principalArrears-principal);loan.balance=money(loan.balance-principal);principalPaid=money(principalPaid+principal);interestPaid=money(interestPaid+interest);payments.push({id:loan.id+':'+result.round,loanId:loan.id,cycle:result.round,principal,interest,total:money(principal+interest)});}
  return {...result,principalPaid,interestPaid,totalPaid:money(principalPaid+interestPaid),debt:money(result.book.reduce((s,l)=>s+l.balance,0)),interestPayable:money(result.book.reduce((s,l)=>s+l.interestArrears,0)),payments};
 }
 return Object.freeze({prepare,pay});
});
