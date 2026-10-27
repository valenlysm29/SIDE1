'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const {createQueue,withImplicitPrices}=require('../services/student_sync.js');
const engine=require('../js/engine/cierre.js');
const defaults=Object.fromEntries(Object.entries(engine.config.segments).map(([key,s])=>[key,s.defaultPrice]));
const prepare=s=>withImplicitPrices(s,defaults);
function snapshot(){return {round:2,decision_state:{
  PRODUCCION_META:{round:2,value:75,moldTargets:{molde_1:75},prices:{...defaults}},
  __cyclePlans:{1:{state:{PRODUCCION_META:{round:1,value:30,prices:{...defaults,urbano:160}}}},
    2:{state:{PRODUCCION_META:{round:2,value:75,prices:{...defaults}}}}}},
  cash_ledger:{'2:C':-100},section_submissions:{C:true},decisions_submitted:false};}

test('implicit defaults preserve engine prices, quantities, cash and explicit historic prices',()=>{
  const original=snapshot(),wire=prepare(original);
  assert.equal(original.decision_state.PRODUCCION_META.prices.urbano,100,'the source is not mutated');
  assert.equal(wire.decision_state.PRODUCCION_META.prices,undefined);
  assert.deepEqual(engine.prices(wire.decision_state),engine.prices(original.decision_state));
  assert.deepEqual(engine.prices(wire.decision_state.__cyclePlans[1].state),engine.prices(original.decision_state.__cyclePlans[1].state));
  assert.equal(wire.decision_state.__cyclePlans[1].state.PRODUCCION_META.prices.urbano,160);
  assert.equal(wire.decision_state.__cyclePlans[2].state.PRODUCCION_META.prices,undefined);
  assert.deepEqual(wire.cash_ledger,original.cash_ledger);assert.deepEqual(wire.section_submissions,original.section_submissions);
  assert.equal(wire.decision_state.PRODUCCION_META.value,75);assert.deepEqual(prepare(wire),wire);
});

test('an implicit default stays equivalent during lost-ack recovery',async()=>{
  const memory=new Map();let writes=0,operations=0,conflicts=0;
  const raw=snapshot(),queue=createQueue({
    storage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},
    context:()=>({identityKey:'A',identity:{},connected:true,revision:0,epoch:1}),prepareSnapshot:prepare,
    saveSnapshot:async()=>++writes===1?{success:false,error:'Response lost'}:{success:false,code:'ESTADO_DESACTUALIZADO'},
    readSnapshot:async()=>({success:true,data:{snapshot_revision:1,snapshot:raw}}),
    saveOperation:async()=>{operations++;return {success:true};},onConflict:()=>conflicts++
  });
  assert.equal(await queue.enqueue(raw,{key:'report',type:'report',payload:{}}),false);
  assert.equal(await queue.flush({force:true}),true);
  assert.equal(operations,1);assert.equal(conflicts,0);assert.equal(queue.pending(),false);
});

test('the actual old SQL trigger reproduces 22023 and accepts the repaired durable job',async()=>{
  const db=new PGlite();
  try{
    await db.exec('create table public.side_student_state(empresa_id bigint primary key,snapshot jsonb not null,revision bigint not null default 0);');
    const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/2026-10-23_cierre_planes_v19.sql'),'utf8');
    await db.exec(sql.split('create or replace function public.side_contexto_cierre_negocio')[0]+'commit;');
    const raw=snapshot();
    await assert.rejects(db.query('insert into side_student_state(empresa_id,snapshot) values(1,$1)',[raw]),error=>error.code==='22023'&&/PRECIO_INVALIDO/.test(error.message));
    await db.query('insert into side_student_state(empresa_id,snapshot) values(1,$1)',[{}]);
    const memory=new Map([['SIDE_STUDENT_SYNC_OUTBOX',JSON.stringify([{identityKey:'A',identity:{codigo:'SIDE-TEST'},round:2,
      expectedRevision:0,snapshot:raw,operations:[{key:'decisions:C',type:'decisions',payload:[{decision_id:'PRODUCCION_META',cantidad:75}]}],snapshotSaved:false}])]]);
    let revision=0,operations=0;
    const queue=createQueue({storage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},
      context:()=>({identityKey:'A',connected:true,revision,epoch:1}),prepareSnapshot:prepare,onRevision:r=>revision=r,
      saveSnapshot:async(_identity,snapshot,expected)=>{
        const rows=(await db.query('update side_student_state set snapshot=$1,revision=revision+1 where empresa_id=1 and revision=$2 returning revision',[snapshot,expected])).rows;
        return {success:true,data:{snapshot_revision:rows[0].revision}};
      },saveOperation:async(_identity,round,operation,expected)=>{
        assert.equal(round,2);assert.equal(expected,1);assert.equal(operation.payload[0].cantidad,75);operations++;return {success:true};}});
    assert.equal(await queue.flush(),true);assert.equal(queue.pending(),false);assert.equal(operations,1);assert.equal(revision,1);
    const saved=(await db.query('select snapshot from side_student_state where empresa_id=1')).rows[0].snapshot;
    assert.deepEqual(engine.prices(saved.decision_state),defaults);assert.deepEqual(saved.cash_ledger,raw.cash_ledger);
    assert.deepEqual(JSON.parse(memory.get('SIDE_STUDENT_SYNC_OUTBOX')),[]);
  }finally{await db.close();}
});
