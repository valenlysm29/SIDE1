const assert=require('node:assert/strict');
const {database,createGame,rpc}=require('./lifecycle_db_fixture.cjs');
(async()=>{
 const db=await database({beforeDecisionOptions:async db=>{
  await db.exec(`alter table empresas_decisiones add constraint old_installation_key unique(empresa_id,ciclo,decision_id);
    create unique index old_installation_index on empresas_decisiones(empresa_id,ciclo,decision_id);
    insert into empresas_decisiones(empresa_id,ciclo,decision_id,opcion_id,cantidad,costo_total,enviada)
      select 98765,1,c.id,o.id,1,123,true from decisiones_catalogo c join decisiones_opciones o on o.decision_id=c.id
      where c.decision_id='CANALES' and o.opcion_id='web';`);
 }});
 try{
  assert.equal((await db.query('select costo_total from empresas_decisiones where empresa_id=98765')).rows[0].costo_total,'123','migration preserves historical rows');
  const game=await createGame(db);
  const identity={p_codigo:game.codigo,p_nombre_legal:'Opciones S.A.C.',p_nombre_comercial:'Opciones'};
  const company=await rpc(db,'ingresar_empresa',identity);
  await rpc(db,'controlar_partida',{p_partida_id:game.id,p_accion:'iniciar',p_config:null,p_expected_round:null});
  const save=async(decisions,revision=0)=>{
   await db.exec('set role anon');
   try{return await rpc(db,'guardar_decisiones_estudiante',{...identity,p_ciclo:1,p_decisiones:decisions,p_expected_revision:revision});}
   finally{await db.exec('reset role');}
  };
  const rows=async()=> (await db.query(`select dc.decision_id,o.opcion_id,d.cantidad,d.costo_total from empresas_decisiones d
    join decisiones_catalogo dc on dc.id=d.decision_id left join decisiones_opciones o on o.id=d.opcion_id
    where d.empresa_id=$1 order by dc.decision_id,o.opcion_id`,[company.empresa_id])).rows;
  const web={decision_id:'CANALES',opcion_id:'web',cantidad:1,costo_total:100};
  const store={decision_id:'CANALES',opcion_id:'sjl',cantidad:2,costo_total:200};
  const production={decision_id:'PRODUCCION_META',opcion_id:null,cantidad:10,costo_total:0};
  const selected=[web,store,production];
  assert.equal((await save(selected)).success,true);
  assert.equal((await rows()).length,3,'both channels and scalar production survive');
  assert.deepEqual((await rows()).filter(r=>r.decision_id==='CANALES').map(r=>[r.opcion_id,r.cantidad,Number(r.costo_total)]),[['sjl',2,200],['web',1,100]]);
  assert.equal((await save(selected)).success,true);
  assert.equal((await rows()).length,3,'retry does not duplicate options or null-option scalars');
  assert.equal((await save([web])).success,true);
  assert.deepEqual((await rows()).map(r=>r.decision_id+':'+r.opcion_id),['CANALES:web','PRODUCCION_META:null'],'removed option is deleted without deleting another section');
  assert.equal((await save([store],99)).code,'ESTADO_DESACTUALIZADO');
  assert.equal((await rows()).find(r=>r.decision_id==='CANALES').opcion_id,'web','stale revision cannot replace options');
  const oldRows=await rows();
  assert.equal((await save(null)).success,false);
  assert.deepEqual(await rows(),oldRows,'invalid payload leaves rows intact');
  await db.query(`update partidas set estado='finalizada',configuracion=configuracion||'{"cancelledAt":"2026-09-30T00:00:00Z"}'::jsonb where id=$1`,[game.id]);
  assert.ok((await save([store])).error);
  assert.deepEqual(await rows(),oldRows,'cancellation guards run before replacing rows');
  await db.exec('set role anon');
  await assert.rejects(()=>rpc(db,'guardar_decisiones',{p_empresa_id:company.empresa_id,p_ciclo:1,p_decisiones:[store]}),error=>error.code==='42501');
  console.log('PASS multiple options, exact quantities/costs, idempotent retries, scalar values, option removal, section isolation, revisions, cancellation and private RPC permissions');
 }finally{await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
