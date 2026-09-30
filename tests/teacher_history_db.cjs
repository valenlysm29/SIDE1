'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {database,config,createGame,rpc,professor}=require('./lifecycle_db_fixture.cjs');
const root=path.resolve(__dirname,'..'),other='22222222-2222-2222-2222-222222222222';

(async()=>{
  const db=await database(),sql=fs.readFileSync(path.join(root,'docs/supabase_teacher_history.sql'),'utf8');
  const read=()=>rpc(db,'obtener_ultima_partida_docente',{});
  const control=(game,action,extra={})=>rpc(db,'controlar_partida',{p_partida_id:game.id,p_accion:action,...extra});
  const identity=(game,name)=>({p_codigo:game.codigo,p_nombre_legal:name+' SAC',p_nombre_comercial:name});
  try{
    await db.exec(sql);await db.exec(sql);
    await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20260929_guardar_puntaje_docente.sql'),'utf8'));
    assert.equal(await read(),null);
    const automatic=await createGame(db,config({cycleCloseMode:'automatic',cycles:1}));
    await rpc(db,'ingresar_empresa',identity(automatic,'Automática'));
    await control(automatic,'iniciar');
    await db.query("update partidas set configuracion=jsonb_set(configuracion,'{gameStartAt}',to_jsonb(now()-interval '1 day')) where id=$1",[automatic.id]);
    const autoHistory=await read();assert.equal(autoHistory.partida.id,automatic.id);
    assert.ok(Date.parse(autoHistory.partida.finalizada_at)<Date.now()-23*3600000,'automatic completion uses its real end, not detection time');
    const first=await createGame(db,config({cycles:2}));
    const a=await rpc(db,'ingresar_empresa',identity(first,'Andina'));
    const b=await rpc(db,'ingresar_empresa',identity(first,'Costa'));
    assert.ok(a.empresa_id&&b.empresa_id);
    await control(first,'iniciar');
    const catalog=(await db.query("select id from decisiones_catalogo where decision_id='MESA_CORTE'")).rows[0].id;
    const option=(await db.query("select id from decisiones_opciones where decision_id=$1 and opcion_id='mesa'",[catalog])).rows[0].id;
    for(const player of [a,b]){
      await db.query('insert into empresas_decisiones(empresa_id,ciclo,decision_id,opcion_id,cantidad,costo_total) values($1,1,$2,$3,2,5000)',[player.empresa_id,catalog,option]);
      for(const cycle of [1,2])await db.query('insert into reportes_ciclo(empresa_id,ciclo,ingresos,utilidad,caja_final,estado_resultados,balance_caja,flujo_caja) values($1,$2,20000,3000,25000,$3,$4,$5)',[
        player.empresa_id,cycle,{ventasNetas:20000,utilidad:3000},{cajaFinal:25000,balanceGeneral:{activos:40000,deuda:3000,patrimonio:37000}},{operacion:3000,flujoNeto:3000}
      ]);
    }
    await rpc(db,'guardar_puntaje_docente',{p_partida_id:first.id,p_empresa_id:a.empresa_id,p_puntaje:0});
    await control(first,'cancelar');
    let history=await read();
    assert.equal(history.partida.id,first.id);assert.equal(history.partida.cantidad_empresas,2);
    assert.equal(history.partida.ciclos_jugados,2);assert.ok(history.partida.finalizada_at);
    assert.equal(history.empresas.length,2);
    const andina=history.empresas.find(e=>Number(e.id)===Number(a.empresa_id));
    assert.equal(andina.puntaje_docente,0);assert.equal(andina.nombre_comercial,'Andina');
    assert.deepEqual(andina.reportes.map(r=>r.ciclo),[1,2]);
    assert.equal(andina.reportes[1].balance_caja.balanceGeneral.activos,40000);
    assert.equal(andina.decisiones[0].decision_id,'MESA_CORTE');assert.equal(andina.decisiones[0].opcion_id,'mesa');
    assert.equal(andina.decisiones[0].categoria,'B');assert.equal(andina.decisiones[0].cantidad,2);
    await rpc(db,'guardar_puntaje_docente',{p_partida_id:first.id,p_empresa_id:a.empresa_id,p_puntaje:18});
    assert.equal((await read()).empresas.find(e=>Number(e.id)===Number(a.empresa_id)).puntaje_docente,18);
    const closedAt=history.partida.finalizada_at;
    await control(first,'cancelar');assert.equal((await read()).partida.finalizada_at,closedAt);
    console.log('PASS idempotent SQL, empty history, manual close, all companies/cycles/catalog details/statements and live grades including zero');

    const waiting=await createGame(db);await control(waiting,'cancelar');
    assert.equal((await read()).partida.id,first.id,'an unplayed cancelled lobby does not replace a played game');
    const second=await createGame(db,config({cycles:1}));
    await rpc(db,'ingresar_empresa',identity(second,'Nueva'));
    await control(second,'iniciar');
    await control(second,'cancelar');
    history=await read();assert.equal(history.partida.id,second.id);
    assert.equal(history.empresas.length,1);assert.equal(history.empresas[0].nombre_comercial,'Nueva');
    assert.equal((await db.query('select count(*)::integer as n from side_teacher_history where profesor_id=$1',[professor])).rows[0].n,1);
    await db.query('select side_registrar_historial_docente($1)',[first.id]);
    assert.equal((await read()).partida.id,second.id,'old callbacks cannot restore older history');
    const delayed=await createGame(db,config({cycleCloseMode:'automatic',cycles:1}));
    await control(delayed,'iniciar');
    await db.query("update partidas set configuracion=jsonb_set(configuracion,'{gameStartAt}',to_jsonb(now()-interval '2 days')) where id=$1",[delayed.id]);
    assert.equal((await read()).partida.id,second.id,'an older automatic game detected late must not replace a genuinely newer closure');
    assert.equal((await db.query('select estado from partidas where id=$1',[delayed.id])).rows[0].estado,'finalizada');
    await db.exec(sql);assert.equal((await read()).partida.id,second.id);
    console.log('PASS automatic close detected without professor, cancellation guard, newest replacement and late callbacks cannot revive older game');

    await db.query("insert into auth.users(id,raw_user_meta_data,email) values($1,'{}','other@example.invalid')",[other]);
    // The fixture does not install Supabase's normal schema/table grants.
    await db.exec('grant usage on schema public,auth to authenticated,anon; grant select on public.partidas to authenticated');
    await db.exec('set role authenticated');
    assert.equal((await db.query('select partida_id from side_teacher_history')).rows[0].partida_id,second.id);
    assert.equal((await read()).partida.id,second.id);
    await assert.rejects(()=>db.query('select side_registrar_historial_docente($1)',[first.id]),/permission denied/);
    await assert.rejects(()=>db.query('select side_historial_fecha_automatica(p) from partidas p where id=$1',[first.id]),/permission denied/);
    await assert.rejects(()=>db.query('delete from side_teacher_history'),/permission denied/);
    await db.query("select set_config('test.uid',$1,false)",[other]);
    assert.equal((await db.query('select * from side_teacher_history')).rows.length,0);
    assert.equal(await read(),null,'security definer read still binds to auth.uid');
    await assert.rejects(()=>db.query('update side_teacher_history set partida_id=$1',[first.id]),/permission denied/);
    const otherGame=(await db.query("insert into partidas(profesor_id,nombre,configuracion) values($1,'Otro profesor',$2) returning *",[other,config()])).rows[0];
    await control(otherGame,'iniciar');await control(otherGame,'cancelar');
    assert.equal((await read()).partida.id,otherGame.id);
    assert.deepEqual((await db.query('select profesor_id from side_teacher_history')).rows.map(r=>r.profesor_id),[other]);
    await db.query("select set_config('test.uid',$1,false)",[professor]);
    assert.equal((await read()).partida.id,second.id,'second professor activity cannot alter the first professor history');
    await db.query("select set_config('test.uid','',false)");
    assert.equal((await read()).code,'ACCESO_DENEGADO');
    await db.exec('reset role; set role anon');
    await assert.rejects(()=>read(),/permission denied/);
    await assert.rejects(()=>db.query('select * from side_teacher_history'),/permission denied/);
    await assert.rejects(()=>db.query('select side_registrar_historial_docente($1)',[first.id]),/permission denied/);
    await db.exec('reset role');
    console.log('PASS real authenticated/other-account RLS isolation, no client writes, unprivileged private functions and no anonymous student reads');
  }finally{await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
