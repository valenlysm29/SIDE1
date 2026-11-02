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
