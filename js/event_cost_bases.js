/* Proposal only: specific financial bases, never a percentage of total costs.
 * Official selectors remain blocked until the policy is explicitly approved. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SIDE_EVENT_COST_BASES=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const rates=Object.freeze({PE53:6,PE54:-4});
 function interest({events=[],round,base,policy}={}){
  if(!Number.isInteger(round)||round<1||!Array.isArray(events))throw new RangeError('Contexto de evento no verificable.');
  if(!Number.isFinite(base)||base<0)throw new RangeError('Base financiera no verificable.');
  const selected=events.filter(e=>e?.effect?.costPct!=null);
  if(!selected.length)return {amount:base,applications:[]};
  if(policy!=='interest-base-proposal-v1')throw new RangeError('Base de evento pendiente de aprobación.');
  const seen=new Set(),applications=[];let amount=base;
  for(const e of selected.sort((a,b)=>a.id.localeCompare(b.id)||a.triggerRound-b.triggerRound)){
   const key=e.id+':'+e.triggerRound;
   if(!Object.hasOwn(rates,e.id)||e.version!=='legacy-event-context-v1'||e.effect.costPct!==rates[e.id]||!Number.isInteger(e.triggerRound)||e.startRound!==e.triggerRound+1||round<e.startRound||round>=e.startRound+2||seen.has(key))throw new RangeError('Evento financiero no verificable.');
   seen.add(key);const before=amount;amount=amount*(1+rates[e.id]/100);
   applications.push({id:e.id,occurrence:key,cycle:round,percent:rates[e.id],base:'interest-accrual',baseAmount:before,adjustment:amount-before,approval:'proposal-not-academically-approved',excluded:['principal','materials','payroll','administration','sales','depreciation']});
  }
  return {amount:Math.round((amount+Number.EPSILON)*100)/100,applications};
 }
 return Object.freeze({interest});
});
