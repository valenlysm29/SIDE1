import {test,expect} from '@playwright/test';
const base='http://127.0.0.1:4178', key=process.env.TEACHER_REGISTRATION_KEY;
test('partidas reales de 3 y 6 ciclos conservan decisiones, cierres y ranking',async({browser})=>{
 test.setTimeout(60000);if(!key)throw Error('Se requiere TEACHER_REGISTRATION_KEY');
 const t=await browser.newContext(),s=await browser.newContext(),tag=Date.now(),password='clave-segura-ciclos-2026';
 async function api(ctx,path,method='GET',data){const r=await ctx.request.fetch(base+'/api'+path,{method,data});expect(r.ok(),await r.text()).toBeTruthy();return r.json()}
 for(const [ctx,role] of [[t,'teacher'],[s,'student']]){const email=`cycles-${role}-${tag}@upch.pe`;await api(ctx,'/register','POST',{name:role,email,role,password,key});await api(ctx,'/login','POST',{email,password})}
 for(const count of [3,6]){
  const game=await api(t,'/games','POST',{name:`Ciclos ${count}`,cycleCount:count,duration:2,costs:{basic:50,standard:80,premium:120},events:[]});
  await api(s,'/join','POST',{code:game.code,name:`Empresa ${count}`});
  for(let i=0;i<count;i++){
   await api(t,`/games/${game.id}/start`,'POST',{});
   await api(s,`/games/${game.id}/decision`,'PUT',{quality:'basic',quantity:1,price:100,marketingAmount:0,confirmed:true});
   await expect.poll(async()=>{const x=await api(t,`/games/${game.id}`);return x.cycles.at(-1)?.status},{timeout:10000,intervals:[300]}).toBe('closed');
  }
  const state=await api(t,`/games/${game.id}`);expect(state.cycles).toHaveLength(count);expect(state.results).toHaveLength(count);expect(state.ranking).toHaveLength(1);
 }
 await t.close();await s.close();
});
