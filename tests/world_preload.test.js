const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');

function fixture(engine=async()=>true,details=async()=>true){
  const counts={engine:0,city:0,guide:0,lighting:0,details:0,upgrade:0},events=[];
  const context={performance:{now:()=>0},console:{error(){},warn(){}},CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail;}},
    window:{dispatchEvent:event=>events.push(event),engine:async()=>{counts.engine++;return engine();},
      city:async()=>{counts.city++;},guide:async()=>{counts.guide++;},lighting:async()=>{counts.lighting++;},
      details:async()=>{counts.details++;await details();},upgrade:()=>counts.upgrade++},
    localStorage:{getItem:()=>null,setItem(){throw Error('Preloading must not write financial storage');}}};
  const source=fs.readFileSync(path.join(__dirname,'../simulator3d.js'),'utf8').replace('  window.SIDE3D = {',`  loadThree=window.engine;
  loadCharacter=window.city;loadStartupEnvironment=window.lighting;ASSET_PRIORITY={CRITICAL:'CRITICAL',IMPORTANT:'IMPORTANT'};
  loadExecModelTemplates=window.details;loadNpcModelTemplate=async()=>false;refreshBusinessCharacters=window.upgrade;ensureHubCharacters=()=>{};
  window.SIDE3D = {`);
  vm.runInNewContext(source,context);return {api:context.window.SIDE3D,counts,events};
}

test('concurrent lobby and entry preload share critical requests without loading indoor models',async()=>{
  let ready;const gate=new Promise(resolve=>ready=resolve),r=fixture(()=>gate);
  const a=r.api.preload(),b=r.api.preload();assert.equal(r.counts.engine,1);assert.equal(r.counts.details,0);
  ready(true);assert.deepEqual(await Promise.all([a,b]),[true,true]);
  assert.deepEqual(r.counts,{engine:1,city:1,guide:0,lighting:1,details:0,upgrade:0});
  assert.equal(await r.api.preload(),true);assert.equal(r.counts.city,1);
});

test('failed engine preparation can retry rather than caching a permanent false result',async()=>{
  let allowed=false;const r=fixture(()=>allowed);
  assert.equal(await r.api.preload(),false);allowed=true;assert.equal(await r.api.preload(),true);
  assert.equal(r.counts.engine,2);assert.equal(r.counts.city,1);
});

test('rejected preloading releases its cache and allows the retry button to succeed',async()=>{
  let fail=true;const r=fixture(()=>{if(fail)throw Error('offline');return true;});
  assert.equal(await r.api.preload(),false);fail=false;assert.equal(await r.api.preload(),true);
  assert.equal(r.counts.engine,2);assert.equal(r.events.filter(e=>e.type==='side3d:ready').length,1);
});

test('shared deferred requests do not block critical readiness or repeat staff upgrades',async()=>{
  let finish,started;const begun=new Promise(resolve=>started=resolve);
  const gate=new Promise(resolve=>finish=resolve),r=fixture(undefined,()=>{started();return gate;});
  assert.equal(await r.api.preload(),true);
  const a=r.api.preloadDetails(),b=r.api.preloadDetails();await begun;
  assert.equal(r.counts.details,1);assert.equal(await r.api.preload(),true);assert.equal(r.counts.upgrade,0);
  finish();assert.deepEqual(await Promise.all([a,b]),[true,true]);assert.equal(r.counts.upgrade,1);
  assert.equal(await r.api.preloadDetails(),true);assert.equal(r.counts.details,1);
});
