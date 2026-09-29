const test=require('node:test');
const assert=require('node:assert/strict');
const {database,createGame,rpc}=require('./lifecycle_db_fixture.cjs');

test('validación [16]: integration rechaza whitespace-only y altas sobre 60/40',async()=>{
 const db=await database();
 try{
  const game=await createGame(db);
  const join=(legal,brand)=>rpc(db,'ingresar_empresa',{
   p_codigo:game.codigo,p_nombre_legal:legal,p_nombre_comercial:brand
  });
  const attempts=[
   await join('Nombre válido','\t\r\n'),
   await join('\u00a0','Marca NBSP'),
   await join('Legal narrow NBSP','\u202f'),
   await join('\ufeff','Marca BOM'),
   await join('L'.repeat(61),'Marca válida'),
   await join('Legal válido','M'.repeat(41))
  ];
  for(const result of attempts){
   assert.equal(result.success,false);
   assert.equal(result.code,'CREDENCIALES_INVALIDAS');
   assert.equal(result.empresa_id,undefined);
   assert.equal(result.participante_id,undefined);
  }
  assert.equal((await db.query(
   'select count(*)::int total from participantes where partida_id=$1',[game.id]
  )).rows[0].total,0);

  const simple=await join(
   `A${'\u00a0'.repeat(250)}B${'\u202f'.repeat(250)}C${'\ufeff'.repeat(250)}D`,
   `Marca${'\t\r\n'.repeat(250)}Limpia`
  );
  assert.equal(simple.success,true);
  assert.equal(simple.reingreso,false);
  assert.deepEqual((await db.query(
   'select nombre_legal,nombre_comercial from empresas where id=$1',[simple.empresa_id]
  )).rows[0],{nombre_legal:'A B C D',nombre_comercial:'Marca Limpia'});

  // El límite se aplica al valor limpio, nunca al raw enorme. Ambos campos
  // llegan exactamente al máximo y se almacenan sin whitespace redundante.
  const cleanLegal=`${'L'.repeat(58)} B`;
  const cleanBrand=`${'M'.repeat(38)} B`;
  const boundary=await join(
   `${'L'.repeat(58)}${' '.repeat(1000)}B`,
   `${'M'.repeat(38)}${' '.repeat(1000)}B`
  );
  assert.equal(boundary.success,true);
  assert.equal(boundary.reingreso,false);
  const storedBoundary=(await db.query(
   'select nombre_legal,nombre_comercial from empresas where id=$1',[boundary.empresa_id]
  )).rows[0];
  assert.deepEqual(storedBoundary,{nombre_legal:cleanLegal,nombre_comercial:cleanBrand});
  assert.equal(storedBoundary.nombre_legal.length,60);
  assert.equal(storedBoundary.nombre_comercial.length,40);
 }finally{
  await db.close();
 }
});

test('seguridad [16]: puntuación y texto SQL se permiten literalmente sin ejecutar código',async()=>{
 const db=await database();
 try{
  const game=await createGame(db);
  const legal=`O'Reilly % _ ; --'; drop table empresas; --`;
  const brand=`%_'; select 1; --`;
  const result=await rpc(db,'ingresar_empresa',{
   p_codigo:game.codigo,p_nombre_legal:legal,p_nombre_comercial:brand
  });
  assert.equal(result.success,true);
  assert.equal(result.reingreso,false);
  assert.equal((await db.query(
   "select to_regclass('public.empresas') is not null intact"
  )).rows[0].intact,true);
  const stored=(await db.query(
   'select nombre_legal,nombre_comercial from empresas where id=$1',[result.empresa_id]
  )).rows[0];
  assert.deepEqual(stored,{nombre_legal:legal,nombre_comercial:brand});
 }finally{
  await db.close();
 }
});
