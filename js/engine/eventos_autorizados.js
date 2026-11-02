/* Resolve server-provided event schedules against the canonical SIDE catalog.
 * The caller must authenticate and validate the origin of the schedules. */
(function(root,factory){const node=typeof module==='object'&&module.exports,api=factory(node?require('../events_catalog.js'):root.SIDE_EVENT_CATALOG);if(node)module.exports=api;else root.SIDE_AUTHORIZED_EVENTS=api;})(typeof globalThis!=='undefined'?globalThis:this,function(catalog){
 'use strict';
 const byId=new Map(catalog.map(event=>[event.id,event]));
 function resolve({round,enabledEvents,groupByCycle={},individualByCycle={}}={}){
  if(!Number.isSafeInteger(round)||round<1||round>6||!Array.isArray(enabledEvents)||new Set(enabledEvents).size!==enabledEvents.length||enabledEvents.some(id=>!byId.has(id)))throw new RangeError('Configuración de eventos inválida.');
  const enabled=new Set(enabledEvents),result=[];
  for(const [scope,schedule] of [['group',groupByCycle],['individual',individualByCycle]]){
   if(!schedule||typeof schedule!=='object'||Array.isArray(schedule))throw new TypeError('Programación de eventos inválida.');
   for(const [key,ids] of Object.entries(schedule)){
    const trigger=Number(key);if(!/^[1-6]$/.test(key)||trigger>round||!Array.isArray(ids)||new Set(ids).size!==ids.length)throw new RangeError('Ciclo o eventos duplicados en programación.');
    for(const id of ids){
     const event=byId.get(id);if(!event||event.scope!==scope)throw new RangeError('Evento o ámbito no reconocido.');
     if(!enabled.has(id))continue;
     const start=trigger+Number(event.cycleOffset||0),end=start+Math.max(1,Number(event.cycles||1));
     if(round>=start&&round<end)result.push({...event,effect:{...event.effect},triggerRound:trigger,startRound:start});
    }
   }
  }
  return result.sort((a,b)=>a.triggerRound-b.triggerRound||a.id.localeCompare(b.id,'en'));
 }
 // Preserve the three original effect categories without posting ledger entries.
 // The closure must still define and verify the cost base before using this.
 function summarize(events,round){
  if(!Array.isArray(events)||!Number.isSafeInteger(round)||round<1||round>6)throw new RangeError('Eventos o ciclo inválidos.');
  let demandFactor=1,costFactor=1;const cashMovements=[],seen=new Set();
  for(const event of events){
   const original=byId.get(event.id),key=`${event.id}:${event.triggerRound}`;
   if(!original||!Number.isSafeInteger(event.triggerRound)||seen.has(key)||event.startRound!==event.triggerRound+Number(original.cycleOffset||0)||round<event.startRound||round>=event.startRound+Math.max(1,Number(original.cycles||1)))throw new RangeError('Ocurrencia de evento inválida.');
   seen.add(key);
   const effect=original.effect||{},keys=Object.keys(effect);if(keys.length!==1||!['revenuePct','costPct','cashDelta'].includes(keys[0])||!Number.isFinite(Number(effect[keys[0]])))throw new RangeError('Efecto de catálogo inválido.');
   const value=Number(effect[keys[0]]);
   if(keys[0]==='revenuePct')demandFactor*=Math.max(0,1+value/100);
   else if(keys[0]==='costPct')costFactor*=1+value/100;
   else if(event.startRound===round)cashMovements.push({id:event.id,triggerRound:event.triggerRound,amount:value});
  }
  return {demandFactor,costFactor,cashMovements};
 }
 return Object.freeze({resolve,summarize});
});
