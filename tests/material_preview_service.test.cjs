'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function service(handler){const calls=[];const student={rpc:async(name,args)=>{calls.push({name,args});return handler(name,args)}};const win={setTimeout:(fn)=>fn(),SIDE:{SupabaseClient:{getStudent:()=>student,get:()=>student}}};vm.runInNewContext(fs.readFileSync('services/decisiones_service.js','utf8'),{window:win});return {s:win.SIDE.DecisionesService,calls};}
test('lectura de material comprueba identidad, ciclo, revisión y error de red',async()=>{
 const good={version:'receipts-v1',companyId:'7',cycle:1,cutoffDay:29,revision:'a'.repeat(32),events:{}};
 const a=service(()=>({data:good,error:null}));assert.equal((await a.s.obtenerContextoMaterial('game',7,1,true)).success,true);assert.equal(a.calls[0].name,'side_material_preview_v1');assert.equal(a.calls[0].args.p_empresa_id,7);
 for(const bad of [{...good,companyId:'8'},{...good,cycle:2},{...good,revision:''},{...good,events:null}]){const x=service(()=>({data:bad,error:null}));assert.equal((await x.s.obtenerContextoMaterial('game',7,1,true)).success,false);}
 const offline=service(()=>{throw new Error('sin red')});assert.equal((await offline.s.obtenerContextoMaterial('game',7,1,true)).success,false);
 const denied=service(()=>({data:null,error:{code:'42501',message:'No autorizado'}}));assert.equal((await denied.s.obtenerContextoMaterial('game',7,1,true)).code,'42501');
});
test('reintento acotado de bloqueo usa el mismo identificador y no reintenta otros errores',async()=>{
 let attempts=0;const s=service(()=>++attempts<3?{error:{code:'55P03',message:'lock timeout'}}:{data:{receiptId:'event',day:7},error:null});
 assert.equal((await s.s.registrarEntregaProveedor('game','order','event',5)).success,true);assert.equal(s.calls.length,3);assert.ok(s.calls.every(c=>c.args.p_receipt_id==='event'));
 const blocked=service(()=>({error:{code:'55P03',message:'lock timeout'}}));assert.equal((await blocked.s.registrarEntregaProveedor('game','order','event',5)).code,'55P03');assert.equal(blocked.calls.length,3);
 const network=service(()=>{throw new Error('network')});assert.equal((await network.s.registrarEntregaProveedor('game','order','event',5)).success,false);assert.equal(network.calls.length,1);
});
