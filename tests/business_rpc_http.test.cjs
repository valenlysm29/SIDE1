'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
test('Node and generated Edge accept actual PostgREST void acknowledgements and preserve failures',async()=>{
 const node=require('../services/business_runtime.cjs');
 const edge=await import('../supabase/functions/side-business-close/runtime.mjs');
 const server=http.createServer((req,res)=>{
  if(req.url.endsWith('/journal')){res.writeHead(204);res.end();}
  else if(req.url.endsWith('/denied')){res.writeHead(403,{'Content-Type':'application/json'});res.end(JSON.stringify({code:'42501',message:'Server only'}));}
  else if(req.url.endsWith('/invalid')){res.writeHead(200);res.end('<html>invalid proxy</html>');}
  else{res.writeHead(503);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  for(const runtime of [node,edge]){
   const rpc=runtime.remoteRpc('http://127.0.0.1:'+server.address().port,'local-test');
   assert.deepEqual(await rpc('journal',{}),{data:null,error:null});
   assert.deepEqual(await rpc('denied',{}),{data:null,error:{message:'Server only',code:'42501'}});
   assert.equal((await rpc('outage',{})).error.message,'RPC HTTP 503');
   await assert.rejects(rpc('invalid',{}),SyntaxError);
  }
 }finally{await new Promise(resolve=>server.close(resolve));}
});
