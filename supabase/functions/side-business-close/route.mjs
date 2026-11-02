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
  return [...oldResults,...newResults];
}
