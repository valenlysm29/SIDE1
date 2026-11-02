'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
test('RPC accepts an empty success response and preserves HTTP errors',async()=>{
 const {remoteRpc}=await import('../supabase/functions/side-business-close/runtime.mjs');
 const original=global.fetch;
 try{
  global.fetch=async()=>new Response(null,{status:204});
  assert.deepEqual(await remoteRpc('https://example.invalid','key')('journal',{}),{data:null,error:null});
  global.fetch=async()=>new Response(JSON.stringify({message:'denegado',code:'42501'}),{status:403});
  const result=await remoteRpc('https://example.invalid','key')('journal',{});
  assert.equal(result.error.code,'42501');
 } finally {global.fetch=original;}
});
