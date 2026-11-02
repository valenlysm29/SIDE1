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
  for(const result of results){
    if(!result.game||!Number.isInteger(Number(result.cycle)))continue;
    try{
      const recorded=await rpc('side_registrar_estado_cierre',{p_partida_id:result.game,p_ciclo:result.cycle,p_success:result.success,p_pending:!!result.pending,p_code:result.code||null,p_error:result.error||null});
      if(recorded.error)console.error('Closure status journal unavailable:',recorded.error.code||'RPC_ERROR');
    }catch{console.error('Closure status journal unavailable: NETWORK_ERROR');}
  }
  return results;
}
