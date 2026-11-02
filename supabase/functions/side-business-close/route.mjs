// Route each game to the engine version under which it was created.
export async function runVersioned(rpc,legacy,newEngine,options={}) {
  const pending=await rpc('side_cierres_pendientes',{});
  if(pending.error||!Array.isArray(pending.data))throw new Error('Cierres pendientes no disponibles');
  const groups={'0':[],'1':[]},results=[];
  const unavailable=(game,code,error)=>({game:game.id,cycle:game.cycles?.[0],success:false,pending:false,code,error});
  for(const game of pending.data){
    try{
      const version=await rpc('side_version_worker_cierre',{p_partida_id:game.id});
      if(version.error||!Object.hasOwn(groups,version.data))throw new Error('Unknown version');
      groups[version.data].push(game);
    }catch{
      // A damaged historical game cannot prevent independently authorized games
      // from closing. Its error remains explicit, never a successful settlement.
      results.push(unavailable(game,'VERSION_CIERRE_NO_VERIFICABLE','Versión de cierre no verificable; requiere revisión de esta partida.'));
    }
  }
  const filtered=games=>async(name,args)=>name==='side_cierres_pendientes'?{data:games,error:null}:rpc(name,args);
  // New sequential games receive the budget first. Old games retain exactly
  // their original engine; neither configuration nor economic inputs are changed.
  for(const [version,engine] of [['1',newEngine],['0',legacy]]){
    for(const game of groups[version]){
      if(Date.now()>=Number(options.deadline??Infinity)){
        results.push({...unavailable(game,'PLAZO_TRABAJADOR_AGOTADO','Pendiente de reintento programado.'),success:true,pending:true});
        continue;
      }
      try{
        const closed=await engine(filtered([game]),options);
        if(!Array.isArray(closed)||!closed.length||closed.some(r=>r.game!==game.id))throw new Error('Invalid worker response');
        results.push(...closed);
      }catch{
        results.push(unavailable(game,'PROCESAMIENTO_CIERRE_NO_DISPONIBLE','No se pudo procesar esta partida; se reintentará sin avanzar su ciclo.'));
      }
    }
  }
  for(const result of options.tracked?[]:results){
    if(!result.game||!Number.isInteger(Number(result.cycle)))continue;
    try{
      const recorded=await rpc('side_registrar_estado_cierre',{p_partida_id:result.game,p_ciclo:result.cycle,p_success:result.success,p_pending:!!result.pending,p_code:result.code||null,p_error:result.error||null});
      if(recorded.error)console.error('Closure status journal unavailable:',recorded.error.code||'RPC_ERROR');
    }catch{console.error('Closure status journal unavailable: NETWORK_ERROR');}
  }
  return results;
}

// Preserve the deployed execution ownership/fencing contract. The same isolated
// routing applies, while only the owning attempt may read/write its seal.
export async function runTracked(rpc,legacy,newEngine,{runId,deadline=Infinity}={}) {
  if(!runId)throw new Error('Falta el identificador de ejecución');
  const tracked=engine=>async scoped=>{
    const [game]=(await scoped('side_cierres_pendientes',{})).data,results=[];
    for(const cycle of game.cycles){
      const failed=(code,error)=>({game:game.id,cycle,success:false,pending:false,code,error});
      if(Date.now()>=deadline){results.push({...failed('PLAZO_TRABAJADOR_AGOTADO','Pendiente de reintento programado.'),success:true,pending:true});break;}
      const args={p_run:runId,p_partida:game.id,p_ciclo:cycle};
      let claim;
      try{claim=await rpc('side_iniciar_intento_cierre',args);}catch{claim={error:true};}
      if(claim.error){results.push(failed('EJECUCION_CIERRE_NO_VERIFICABLE','No se pudo verificar el intento de esta partida.'));break;}
      if(claim.data!==true){results.push({...failed('INTENTO_EN_CURSO','Otro intento conserva la propiedad del cierre.'),success:true,pending:true});break;}
      const filtered=async(name,params)=>{
        if(name==='side_cierres_pendientes')return {data:[{...game,cycles:[cycle]}],error:null};
        if(name==='side_contexto_cierre_negocio')return rpc('side_contexto_cierre_con_intento',{...params,p_run:runId,p_ciclo_intento:cycle});
        if(name==='side_guardar_cierre_negocio'||name==='side_guardar_cierre_temporal_v1')return rpc('side_guardar_cierre_con_intento',{...params,p_run:runId});
        return rpc(name,params);
      };
      let result;
      try{
        const current=await engine(filtered,{deadline});
        result=current?.find(r=>r.game===game.id&&Number(r.cycle)===Number(cycle));
        if(!result)throw new Error('Missing result');
      }catch{result=failed('PROCESAMIENTO_CIERRE_NO_DISPONIBLE','No se pudo procesar esta partida; se reintentará sin avanzar su ciclo.');}
      let done;
      try{done=await rpc('side_finalizar_intento_cierre',{...args,p_success:!!result.success,p_pending:!!result.pending,p_code:result.code||null,p_error:result.error||null});}catch{done={error:true};}
      if(done.error)result=failed('REGISTRO_INTENTO_NO_DISPONIBLE','No se pudo confirmar el registro del intento; se requiere reintento.');
      results.push(result);
      if(!result.success||result.pending)break;
    }
    return results;
  };
  return runVersioned(rpc,tracked(legacy),tracked(newEngine),{deadline,tracked:true});
}
