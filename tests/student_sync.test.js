const test=require('node:test');
const assert=require('node:assert/strict');
const {createQueue}=require('../services/student_sync');
const snapshot=(round=1,value=10)=>({round,decision_state:{PRECIO:{value}}});
const op=(key='report',payload={caja_final:100})=>({key,type:key==='report'?'report':'decisions',payload});
function fixture(overrides={}){
  const memory=new Map(),calls=[],statuses=[];
  const storage={getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value)};
  let current={connected:true,identityKey:'A',identity:{codigo:'SIDE-001',nombreLegal:'Legal A',nombreComercial:'A'},revision:0,epoch:1};
  const options={storage,context:()=>current,
    saveSnapshot:async(identity,state,revision)=>{calls.push({kind:'snapshot',identity,state,revision});return {success:true,data:{snapshot_revision:revision+1}};},
    saveOperation:async(identity,round,operation,revision)=>{calls.push({kind:operation.key,identity,round,operation,revision});return {success:true};},
    onRevision:revision=>{current.revision=revision;},onStatus:status=>statuses.push(status),...overrides};
  return {options,memory,calls,statuses,get current(){return current;},set current(value){current=value;},queue:createQueue(options)};
}
test('failed snapshot survives reload and retries its decisions/report with the original CAS revision',async()=>{
  let online=false;
  const f=fixture({saveSnapshot:async(_identity,_state,revision)=>online?{success:true,data:{snapshot_revision:revision+1}}:{success:false,error:'Failed to fetch'}});
  assert.equal(await f.queue.enqueue(snapshot(),op('decisions:D',[{decision_id:'CANALES'}])),false);
  assert.equal(f.queue.pending(),true);assert.ok(f.statuses.includes('pending'));
  const restored=createQueue(f.options);online=true;
  assert.equal(await restored.flush(),true);assert.equal(restored.pending(),false);
  assert.equal(f.calls[0].kind,'decisions:D');assert.equal(f.calls[0].revision,1);
});
test('operation retry after an acknowledged snapshot never repeats the snapshot or the completed report',async()=>{
  let fail=true;
  const f=fixture();
  const save=f.options.saveOperation;
  f.options.saveOperation=async(...args)=>args[2].key==='decisions:D'&&fail?{success:false,error:'timeout'}:save(...args);
  const q=createQueue(f.options);
  const a=q.enqueue(snapshot(),op()),b=q.enqueue(snapshot(),op('decisions:D',[]));
  assert.deepEqual(await Promise.all([a,b]),[false,false]);
  assert.deepEqual(f.calls.map(c=>c.kind),['snapshot','report']);
  fail=false;assert.equal(await createQueue(f.options).flush(),true);
  assert.deepEqual(f.calls.map(c=>c.kind),['snapshot','report','decisions:D']);
});
test('offline edits coalesce by cycle and category without losing other categories',async()=>{
  const f=fixture({saveSnapshot:async()=>({success:false,error:'offline'})});
  await f.queue.enqueue(snapshot(1,10),op('decisions:D',[10]));
  await f.queue.enqueue(snapshot(1,20),op('decisions:B',[20]));
  await f.queue.enqueue(snapshot(1,30),op('decisions:D',[30]));
  const jobs=JSON.parse(f.memory.get('SIDE_STUDENT_SYNC_OUTBOX'));
  assert.equal(jobs.length,1);assert.equal(jobs[0].snapshot.decision_state.PRECIO.value,30);
  assert.deepEqual(jobs[0].operations.map(x=>[x.key,x.payload]),[['decisions:B',[20]],['decisions:D',[30]]]);
});
test('a newer edit made during a failed request survives and merges the unfinished operations',async()=>{
  let release;
  const f=fixture({saveSnapshot:()=>new Promise(resolve=>{release=resolve;})});
  const first=f.queue.enqueue(snapshot(1,10),op('decisions:B',[10]));
  await Promise.resolve();
  const second=f.queue.enqueue(snapshot(1,20),op('decisions:D',[20]));
  release({success:false,error:'timeout'});await Promise.all([first,second]);
  const jobs=JSON.parse(f.memory.get('SIDE_STUDENT_SYNC_OUTBOX'));
  assert.equal(jobs.length,1);assert.equal(jobs[0].snapshot.decision_state.PRECIO.value,20);
  assert.deepEqual(jobs[0].operations.map(x=>x.key),['decisions:B','decisions:D']);
});
test('successful writes advance later jobs of the same company across cycles',async()=>{
  const f=fixture();
  await Promise.all([f.queue.enqueue(snapshot(1),op()),f.queue.enqueue(snapshot(2),op())]);
  assert.deepEqual(f.calls.filter(c=>c.kind==='snapshot').map(c=>c.revision),[0,1]);
  assert.deepEqual(f.calls.filter(c=>c.kind==='report').map(c=>[c.round,c.revision]),[[1,1],[2,2]]);
});
test('CAS conflicts stop retries, preserve a local copy and never overwrite the other session',async()=>{
  let recovered=0;
  const f=fixture({saveSnapshot:async()=>({success:false,code:'ESTADO_DESACTUALIZADO'}),onConflict:async()=>{recovered++;}});
  assert.equal(await f.queue.enqueue(snapshot(),op()),false);
  assert.equal(recovered,1);assert.equal(f.queue.pending(),false);assert.equal(f.calls.length,0);
  assert.equal(JSON.parse(f.memory.get('SIDE_STUDENT_SYNC_CONFLICT_A')).length,1);
  await f.queue.flush();assert.equal(recovered,1);
});
test('logout or identity change during a request prevents operations and revision changes in the next session',async()=>{
  let release;
  const f=fixture({saveSnapshot:()=>new Promise(resolve=>{release=resolve;})});
  const pending=f.queue.enqueue(snapshot(),op());await Promise.resolve();
  f.current={...f.current,identityKey:'B',identity:{codigo:'SIDE-002',nombreLegal:'B',nombreComercial:'B'},epoch:2};
  release({success:true,data:{snapshot_revision:1}});
  assert.equal(await pending,false);assert.equal(f.current.revision,0);assert.deepEqual(f.calls,[]);
  assert.equal(f.queue.pending('A'),true);assert.equal(f.queue.pending('B'),false);
});
test('explicit identity rejection clears the outbox; technical failures with the same code keep it',async()=>{
  let rejected=0,technical=true;
  const f=fixture({saveSnapshot:async()=>({success:false,code:'CREDENCIALES_INVALIDAS',technical}),onRejected:()=>rejected++});
  await f.queue.enqueue(snapshot(),op());assert.equal(rejected,0);assert.equal(f.queue.pending(),true);
  technical=false;await f.queue.flush();assert.equal(rejected,1);assert.equal(f.queue.pending(),false);
});
test('lost snapshot acknowledgment is verified before retrying decisions and never writes the snapshot twice',async()=>{
  let committed=null,writes=0,recovered=0;
  const f=fixture({
    saveSnapshot:async(_identity,state)=>{writes++;if(!committed){committed=state;return {success:false,error:'response lost'};}return {success:false,code:'ESTADO_DESACTUALIZADO'};},
    readSnapshot:async()=>({success:true,data:{snapshot_revision:1,snapshot:committed}}),
    onConflict:async()=>{recovered++;}
  });
  await f.queue.enqueue(snapshot(),op('decisions:D',[10]));
  assert.equal(await f.queue.flush(),true);
  assert.equal(writes,2);assert.equal(recovered,0);assert.equal(f.current.revision,1);
  assert.equal(f.calls[0].kind,'decisions:D');assert.equal(f.calls[0].revision,1);
});
test('an unavailable conflict check retains the job and does not adopt an unknown server revision',async()=>{
  let recovered=0;
  const f=fixture({saveSnapshot:async()=>({success:false,code:'ESTADO_DESACTUALIZADO'}),readSnapshot:async()=>({success:false,error:'offline'}),onConflict:()=>recovered++});
  await f.queue.enqueue(snapshot(),op());assert.equal(f.queue.pending(),true);assert.equal(recovered,0);assert.equal(f.current.revision,0);
});
