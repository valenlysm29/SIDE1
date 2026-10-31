'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const PRO=require('../js/production_model'),{catalog,state}=require('./economic_v19_fixture.cjs');
function ctx(target){const s=state();s.PRODUCCION_META.moldTargets={molde_1:target,molde_2:0,molde_3:0};return {catalog,state:s,round:1,availableCash:1};}
for(const target of [0,100,500,1000,3000,5000,10000])test(`recommendation ${target}`,()=>{const c=ctx(target),p=PRO.calculate(c),a=PRO.recommendResources(c,p);assert.equal(p.target,target);if(p.processCapacity>=target)assert.equal(a.additions.length,0);else {assert.ok(a.complete);assert.ok(a.capacity>=target);assert.equal(a.affordable,false);}assert.equal(PRO.calculate(c).processCapacity,p.processCapacity);});
test('thread alternatives use integer spools and available physical stock',()=>{const c=ctx(3000);c.state.HILO.quantities={};c.state.__inventarioMP={};const p=PRO.calculate(c),a=PRO.threadAlternatives(c,p);assert.equal(a.shortage,18000);const x=a.options.find(x=>x.id==='hilo_std');assert.deepEqual([x.quantity,x.meters,x.remaining],[67,18090,90]);});

test('alternative capacity does not imply production when materials are missing',()=>{const c=ctx(3000),p=PRO.calculate(c),a=PRO.recommendResources(c,p);assert.ok(a.capacity>=3000);assert.equal(a.producibleUnits,833);assert.ok(a.materialShortfalls.some(x=>x.id==='HILO'&&x.shortfall===8000));});

test('mixed spool estimate uses catalog cost without changing saved decisions',()=>{const c=ctx(3000),before=JSON.stringify(c),p=PRO.calculate(c),a=PRO.threadAlternatives(c,p);assert.equal(a.purchase.counts.hilo_std,30);assert.equal(a.purchase.meters,8100);assert.ok(Math.abs(a.purchase.cost-14904)<1e-6);assert.equal(a.purchase.remaining,100);assert.equal(JSON.stringify(c),before);});

test('integrated scenario accounts for all materials and respects the cash comparison',()=>{const c=ctx(3000),before=JSON.stringify(c),p=PRO.calculate(c),r=PRO.recommendResources(c,p),a=PRO.recommendIntegrated(c,p,r);assert.deepEqual(a.rows.map(x=>x.id),['CUERO','ACCESORIOS','HILO']);assert.ok(Math.abs(a.materialCost-37214)<0.01);assert.ok(Math.abs(a.totalCost-90586.64)<0.01);assert.equal(a.producibleUnits,3000);assert.equal(a.affordable,false);assert.equal(a.optimal,false);assert.equal(JSON.stringify(c),before);});

test('bounded thread optimization matches brute force including quantity discounts',()=>{
  const BUS=require('../js/business_rules');
  for(const target of [1,30,70,100]){
    const c=ctx(target);c.state.HILO.quantities={};c.state.__inventarioMP={};
    c.config={materialPurchaseVersion:'excel-v2-packs-v1',materials:{quantityDiscountThreshold:3,quantityDiscountRate:.2}};
    const plan=PRO.calculate(c),result=PRO.threadAlternatives(c,plan),opts=c.catalog.flatMap(x=>x.items).find(x=>x.id==='HILO').options;
    let best=Infinity;for(let a=0;a<=8;a++)for(let b=0;b<=8;b++)for(let d=0;d<=8;d++){
      const q=[a,b,d],meters=a*270+b*250+d*200;if(meters<result.shortage)continue;
      best=Math.min(best,q.reduce((v,n,i)=>v+n*BUS.materialUnitPrice(opts[i],n,0,{materials:c.config.materials}),0));
    }
    assert.equal(result.exhaustive,true);assert.ok(Math.abs(result.purchase.cost-best)<1e-8);
  }
});
