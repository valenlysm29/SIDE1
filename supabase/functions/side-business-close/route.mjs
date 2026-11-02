// Route each game to the engine version under which it was created.
export async function runVersioned(rpc,legacy,newEngine,options={}) {
  const pending=await rpc('side_cierres_pendientes',{});
  if(pending.error||!Array.isArray(pending.data))throw new Error('Cierres pendientes no disponibles');
  const groups={'0':[],'1':[]};
  for(const game of pending.data){
    const version=await rpc('side_version_worker_cierre',{p_partida_id:game.id});
    if(version.error||!Object.hasOwn(groups,version.data))throw new Error('Versión de cierre no verificable');
    groups[version.data].push(game);
  }
  const filtered=games=>async(name,args)=>name==='side_cierres_pendientes'?{data:games,error:null}:rpc(name,args);
  const oldResults=await legacy(filtered(groups['0']),options);
  const newResults=await newEngine(filtered(groups['1']),options);
  const results=[...oldResults,...newResults];
  for(const result of results){
    if(!result.game||!Number.isInteger(Number(result.cycle)))continue;
    try{
      const recorded=await rpc('side_registrar_estado_cierre',{p_partida_id:result.game,p_ciclo:result.cycle,p_success:result.success,p_pending:!!result.pending,p_code:result.code||null,p_error:result.error||null});
      if(recorded.error)console.error('Closure status journal unavailable:',recorded.error.code||'RPC_ERROR');
    }catch{console.error('Closure status journal unavailable: NETWORK_ERROR');}
  }
  return results;
}
// Each scheduled HTTP request has a server-issued ID; only one attempt per
// game/cycle can own the journal at a time. The database seal remains final.
export async function runTracked(rpc,legacy,newEngine,{runId,deadline=Infinity}={}) {
  if (!runId) throw new Error('Falta el identificador de ejecución');
  const pending=await rpc('side_cierres_pendientes',{});
  if(pending.error||!Array.isArray(pending.data))throw new Error('Cierres pendientes no disponibles');
  const results=[];
  for(const game of pending.data){
    const version=await rpc('side_version_worker_cierre',{p_partida_id:game.id});
    if(version.error||!['0','1'].includes(version.data))throw new Error('Versión de cierre no verificable');
    const engine=version.data==='0'?legacy:newEngine;
    for(const cycle of game.cycles){
      if(Date.now()>=deadline)return results;
      const args={p_run:runId,p_partida:game.id,p_ciclo:cycle};
      const claim=await rpc('side_iniciar_intento_cierre',args);
      if(claim.error)throw new Error('No se pudo verificar la ejecución del cierre');
      if(claim.data!==true)break;
      const filtered=async(name,params)=>{
        if(name==='side_cierres_pendientes')return {data:[{...game,cycles:[cycle]}],error:null};
        if(name==='side_contexto_cierre_negocio')return rpc('side_contexto_cierre_con_intento',{...params,p_run:runId,p_ciclo_intento:cycle});
        if(name==='side_guardar_cierre_negocio'||name==='side_guardar_cierre_temporal_v1')return rpc('side_guardar_cierre_con_intento',{...params,p_run:runId});
        return rpc(name,params);
      };
      const current=await engine(filtered,{deadline});
      const result=current.find(r=>r.game===game.id&&Number(r.cycle)===Number(cycle));
      if(!result)throw new Error('Cierre interrumpido antes de registrar un resultado');
      const done=await rpc('side_finalizar_intento_cierre',{...args,p_success:!!result.success,p_pending:!!result.pending,p_code:result.code||null,p_error:result.error||null});
      if(done.error)throw new Error('No se pudo registrar el resultado de la ejecución');
      results.push(result);
      if(!result.success||result.pending)break;
    }
  }
  return results;
}
