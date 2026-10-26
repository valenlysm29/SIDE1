'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(process.env.SIDE_NPC_SOURCE||require.resolve('../js/simulator3d.js'),'utf8');
function body(start,end){return source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));}

for(const scene of ['hub','outdoor'])test(`${scene} requests a free identity even when every role model is occupied`,()=>{
 let request;
 const c={SkeletonUtils:{clone(){}},cityRoster:{draw(...args){request=args;return null;}},animatedActors:[],hubActors:[],npcs:[],businessInteriors:{rooms:[{actors:[{object:{userData:{cityNpcId:'staff'}}}]}]}};
 vm.createContext(c);vm.runInContext(body('  function cityNpcFromTemplate(', '\n  function person('),c);
 assert.equal(c.cityNpcFromTemplate({cityRole:'cliente',cityScene:scene}),null);
 assert.equal(request[3].unique,true,'pool exhaustion must use fallback, never recycle an employee');
 assert.ok(request[2].includes('staff'));
});

test('interior staff excludes distant pedestrians and the mobile guide before they approach',()=>{
 let request;
 const mobile=(id,type)=>({type,obj:{position:{x:10000,z:10000},userData:{cityNpcId:id}}});
 const c={Math,HUB_OFFSET:0,STAFF_LOOKS:[],hubActors:[mobile('pedestrian')],animatedActors:[mobile('guide','guide'),mobile('visitor','visitor')],person(config){request=config;return {getObjectByName(){return null;},userData:{}};}};
 vm.createContext(c);vm.runInContext(body('  function createBusinessNpc(', '\n  async function loadCityNpcModels('),c);
 c.createBusinessNpc('oficina',{id:'office',layout:{x:0,z:0},actors:[]});
 assert.deepEqual(Array.from(request.excludedCityIds),['pedestrian','guide','visitor']);
});

test('a strict exhausted roster supplies no duplicate and can recover after an identity is released',async()=>{
 const {createCityRoster}=await import('../services/npc_city_roster.mjs');
 const rows=['a','b'].map(id=>({id,rol:'cliente',archivo:`assets/models/npc/${id}.glb`,altura:1.7,licencia:'CC0'}));
 for(let seed=0;seed<100;seed++){
  const roster=createCityRoster(rows,{random:()=>seed/100});
  assert.equal(roster.draw('hub','cliente',['a','b'],{unique:true}),null);
  assert.equal(roster.draw('hub','cliente',['a'],{unique:true}).model.id,'b');
 }
});
