'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');const path=require('node:path');
const source=require('../services/business_runtime.cjs'),F=require('./economic_v19_fixture.cjs');
const copy=x=>structuredClone(x);
async function close(runOnce){let written;const snapshot={decision_state:{__cyclePlans:{1:{state:F.state(1,{},2)}}},cash_ledger:{},financial_sections:{}};
 const rpc=async(name,args)=>{if(name==='side_cierres_pendientes')return {data:[{id:'fixture',cycles:[1]}]};if(name==='side_contexto_cierre_negocio')return {data:{empresas:[{id:'1',capital:200000,snapshot:copy(snapshot)}],financialConfig:{cycles:3},token:'test'}};if(name==='side_guardar_cierre_negocio'){written=copy(args.p_cierre);return {data:{cierre:written}};}throw Error(name);};
 const result=await runOnce(rpc);assert.equal(result[0].success,true);return written;}
test('edge empaquetada y servidor producen idéntico cierre financiero y lotes',async()=>{const edge=await import(pathToFileURL(path.resolve(__dirname,'../supabase/functions/side-business-close/runtime.mjs')).href);assert.deepEqual(await close(edge.runOnce),await close(source.runOnce));});
