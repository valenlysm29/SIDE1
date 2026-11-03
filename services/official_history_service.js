/* Bounded reads of immutable company histories. Never recalculate or write results. */
(function(root){'use strict';
 const clients=new WeakMap();
 function cache(client){
  if(clients.has(client))return clients.get(client);
  const state={pending:new Map(),sealed:new Map(),user:undefined};clients.set(client,state);
  client.auth?.onAuthStateChange?.((event,session)=>{
   const user=session?.user?.id;
   if(event==='SIGNED_OUT'||state.user!==undefined&&state.user!==user){state.pending.clear();state.sealed.clear();}
   state.user=user;
  });
  return state;
 }
 async function read(client,game,companyIds){
  const ids=[...new Set(companyIds.map(String))].sort((a,b)=>Number(a)-Number(b)),key=JSON.stringify([game,ids]),state=cache(client);
  if(state.sealed.has(key))return state.sealed.get(key);
  if(state.pending.has(key))return state.pending.get(key);
  const operation=load(client,game,ids).then(result=>{
   // Every configured cycle is confirmed: these seals are immutable. A new
   // game or authentication change uses a different cache; pending cycles
   // are always fetched again. Never cache failures or partial histories.
   if(state.pending.get(key)===operation&&result.cycles.length&&result.cycles.every(r=>r.status==='confirmed'))state.sealed.set(key,result);
   return result;
  }).finally(()=>{if(state.pending.get(key)===operation)state.pending.delete(key);});
  state.pending.set(key,operation);return operation;
 }
 async function load(client,game,companyIds){
  const ids=[...new Set(companyIds.map(String))].sort((a,b)=>Number(a)-Number(b));
  if(!ids.length)return {version:'official-history-v1',partida_id:game,companies:[],cycles:[]};
  const results=new Array(ids.length);let next=0;
  await Promise.all(Array.from({length:Math.min(2,ids.length)},async()=>{
   while(next<ids.length){
    const index=next++,id=ids[index],{data,error}=await client.rpc('side_historial_oficial',{p_partida_id:game,p_empresa_id:Number(id)});
    if(error)throw Object.assign(new Error(error.message||'No se pudo leer el historial oficial.'),{code:error.code});
    if(data?.error||data?.version!=='official-history-v1'||data.partida_id!==game||!Array.isArray(data.cycles)||!Array.isArray(data.companies)
     ||data.cycles.some(row=>String(row.empresa_id)!==id||row.partida_id!==game)
     ||data.companies.some(row=>String(row.id)!==id))throw new Error('Respuesta de historial oficial no verificable.');
    results[index]=data;
   }
  }));
  const companies=results.flatMap(h=>h.companies),cycles=results.flatMap(h=>h.cycles);
  const keys=new Set();for(const row of cycles){const key=row.empresa_id+':'+row.ciclo;if(keys.has(key))throw new Error('Ciclo oficial duplicado.');keys.add(key);}
  companies.sort((a,b)=>Number(a.id)-Number(b.id));cycles.sort((a,b)=>Number(a.ciclo)-Number(b.ciclo)||Number(a.empresa_id)-Number(b.empresa_id));
  return {version:'official-history-v1',partida_id:game,companies,cycles};
 }
 root.SIDE_OFFICIAL_HISTORY_SERVICE=Object.freeze({read});
})(typeof globalThis==='object'?globalThis:this);
