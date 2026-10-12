'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {database,professor,config,rpc}=require('./lifecycle_db_fixture.cjs');
const migration=name=>fs.readFileSync(require.resolve('../supabase/migrations/'+name),'utf8');
(async()=>{const db=await database();try{
 await db.exec(migration('2026-10-11_fix_crear_partida.sql'));await db.exec(migration('2026-10-12_salas_codigo.sql'));
 const legacy=(await db.query(`insert into partidas(profesor_id,nombre,codigo,configuracion) values($1,'Anterior','SIDE-ABC234',$2) returning *`,[professor,config()])).rows[0];
 const sql=migration('2026-10-12_codigo_corto.sql');await db.exec(sql);await db.exec(sql);
 assert.equal((await db.query('select codigo from partidas where id=$1',[legacy.id])).rows[0].codigo,'SIDE-ABC234');
 for(const input of ['PTV6','ptv6',' side-ptv6 ','sideptv6',' S I D E - P T V 6 ',' p t v 6 '])assert.equal((await db.query('select public.side_normalizar_codigo_sala($1) code',[input])).rows[0].code,'SIDE-PTV6');
 for(const input of ['ABC234','sideabc234',' side-abc234 ','a b c 2 3 4'])assert.equal((await db.query('select public.side_normalizar_codigo_sala($1) code',[input])).rows[0].code,legacy.codigo);
 for(const input of ['PT','PTV62','SIDE-PTV62','SIDE-PTV6234','SIDE-PT!6','SIDE','SIDE-'])assert.equal((await rpc(db,'unirse_partida_por_codigo',{p_codigo:input,p_nombre_legal:'Empresa',p_nombre_comercial:'Marca'})).code,'CODIGO_INVALIDO');
 const identity={p_codigo:'abc234',p_nombre_legal:'Anterior Exacta SAC',p_nombre_comercial:'Marca Anterior'};
 const first=await rpc(db,'unirse_partida_por_codigo',identity);assert.equal(first.success,true);assert.equal(first.reingreso,false);
 await db.query(`update partidas set configuracion=jsonb_set(configuracion,'{gameStartAt}',to_jsonb(now()-interval '1 second')) where id=$1`,[legacy.id]);
 const again=await rpc(db,'unirse_partida_por_codigo',{...identity,p_codigo:' s i d e a b c 2 3 4 '});assert.equal(again.success,true);assert.equal(again.reingreso,true);assert.equal(again.empresa_id,first.empresa_id);
 assert.equal((await rpc(db,'unirse_partida_por_codigo',{...identity,p_nombre_comercial:'Diferente'})).code,'PARTIDA_INICIADA');
 assert.equal((await rpc(db,'cancelar_partida',{p_partida_id:legacy.id})).estado,'cancelada');
 assert.equal((await rpc(db,'unirse_partida_por_codigo',identity)).code,'PARTIDA_CANCELADA');
 // Exclude all but one generated candidate, proving the generator retries both
 // live and historical reservations, with a deterministic random stream.
 await db.exec(`insert into partidas(profesor_id,nombre,codigo,estado) values('${professor}','Activa','SIDE-AAAA','activa'),('${professor}','Histórica','SIDE-BBBB','cancelada');
 create sequence short_random_calls;
 create function public.short_test_random() returns double precision language plpgsql volatile as $$declare n bigint:=nextval('public.short_random_calls');begin if n<=4 then return 0;elsif n<=8 then return 1.1/31;else return 2.1/31;end if;end$$;`);
 const definition=(await db.query(`select pg_get_functiondef('public.generar_codigo_sala()'::regprocedure) definition`)).rows[0].definition;
 assert.match(definition,/random\(\)/);await db.exec(definition.replaceAll('random()','public.short_test_random()'));
 assert.equal((await db.query('insert into partidas(profesor_id,nombre) values($1,\'Collision retry\') returning codigo',[professor])).rows[0].codigo,'SIDE-CCCC');
 assert.equal(Number((await db.query('select last_value from short_random_calls')).rows[0].last_value),12);
 await db.exec(`create or replace function public.short_test_random() returns double precision language sql volatile as $$select 0::double precision$$;`);
 await assert.rejects(db.query('select public.generar_codigo_sala()'),e=>/código|codigo|intentos|colisi/i.test(e.message));
 await db.exec(sql);await db.exec(sql);
 // Uppercase UNIQUE is independent of textual casing and includes old rooms.
 await assert.rejects(db.query('insert into partidas(profesor_id,nombre,codigo) values($1,\'Duplicate\',\'side-abc234\')',[professor]),e=>e.code==='23505');
 await db.query('delete from partidas where codigo=$1',['SIDE-BBBB']);
 await assert.rejects(db.query('insert into partidas(profesor_id,nombre,codigo) values($1,\'Historic reuse\',\'SIDE-BBBB\')',[professor]),e=>e.code==='23505');
 console.log('codigo_corto_db PASS: SQL twice, bare/prefixed4/6 normalization, invalid lengths, legacy6 admission/reentry/cancel, live+historic collision retry, clear exhaustion, historical nonreuse, uppercase uniqueness');
}finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1});

