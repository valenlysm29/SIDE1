'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const PRO=require('../js/production_model'),{catalog,state}=require('./economic_v19_fixture.cjs');
function ctx(target){const s=state();s.PRODUCCION_META.moldTargets={molde_1:target,molde_2:0,molde_3:0};return {catalog,state:s,round:1,availableCash:1};}
for(const target of [0,100,500,1000,3000,5000,10000])test(`recommendation ${target}`,()=>{const c=ctx(target),p=PRO.calculate(c),a=PRO.recommendResources(c,p);assert.equal(p.target,target);if(p.processCapacity>=target)assert.equal(a.additions.length,0);else {assert.ok(a.complete);assert.ok(a.capacity>=target);assert.equal(a.affordable,false);}assert.equal(PRO.calculate(c).processCapacity,p.processCapacity);});
test('thread alternatives use integer spools and available physical stock',()=>{const c=ctx(3000);c.state.HILO.quantities={};c.state.__inventarioMP={};const p=PRO.calculate(c),a=PRO.threadAlternatives(c,p);assert.equal(a.shortage,18000);const x=a.options.find(x=>x.id==='hilo_std');assert.deepEqual([x.quantity,x.meters,x.remaining],[67,18090,90]);});

test('alternative capacity does not imply production when materials are missing',()=>{const c=ctx(3000),p=PRO.calculate(c),a=PRO.recommendResources(c,p);assert.ok(a.capacity>=3000);assert.equal(a.producibleUnits,833);assert.ok(a.materialShortfalls.some(x=>x.id==='HILO'&&x.shortfall===8000));});

test('mixed spool estimate uses catalog cost without changing saved decisions',()=>{const c=ctx(3000),before=JSON.stringify(c),p=PRO.calculate(c),a=PRO.threadAlternatives(c,p);assert.equal(a.purchase.counts.hilo_std,30);assert.equal(a.purchase.meters,8100);assert.ok(Math.abs(a.purchase.cost-14904)<1e-6);assert.equal(a.purchase.remaining,100);assert.equal(JSON.stringify(c),before);});
