'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{createQueue}=require('../services/student_sync.js');
test('network failure backs off polling and resumes a durable snapshot exactly once',async()=>{
 const memory=new Map(),timers=[];let time=0,writes=0,online=false,revision=0;
 const queue=createQueue({storage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},context:()=>({connected:true,identityKey:'A',identity:{},revision,epoch:1}),now:()=>time,schedule:(fn,delay)=>{timers.push({fn,delay});return timers.length;},clearSchedule(){},onRevision:r=>revision=r,
 saveSnapshot:async()=>{writes++;return online?{success:true,data:{snapshot_revision:1}}:{success:false,error:'network'};},saveOperation:async()=>({success:true})});
 await queue.enqueue({round:1,decision_state:{}},null);assert.equal(writes,1);assert.equal(timers.at(-1).delay,3000);
 for(let i=0;i<4;i++)await queue.flush();assert.equal(writes,1,'polling cannot defeat the backoff');
 time=3000;await queue.flush();assert.equal(writes,2);assert.equal(timers.at(-1).delay,6000);
 online=true;time=8999;await queue.flush();assert.equal(writes,2);
 time=9000;await queue.flush();assert.equal(writes,3);assert.equal(queue.pending(),false);assert.equal(revision,1);
 await queue.flush();assert.equal(writes,3);
});
