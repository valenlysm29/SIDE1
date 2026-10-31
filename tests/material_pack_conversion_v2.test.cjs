'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const rules=require('../js/business_rules.js');
test('presentaciones Excel V2 convierten a unidades físicas sin alterar la cantidad comprada',()=>{
 const purchases={cuero_sint:60,cuero_std:55,cuero_prem:15,acc_eco:200,acc_prem:190,hilo_std:0,hilo_ref:6,hilo_prem:7};
 const result=Object.fromEntries(Object.entries(purchases).map(([sku,q])=>[sku,rules.materialPackConversion(sku,q)]));
 assert.equal(result.cuero_sint.units+result.cuero_std.units+result.cuero_prem.units,200);
 assert.equal(result.acc_eco.units+result.acc_prem.units,390);
 assert.equal(result.hilo_std.units+result.hilo_ref.units+result.hilo_prem.units,2900);
 for(const [sku,q] of Object.entries(purchases)){assert.equal(result[sku].packs,q);assert.equal(result[sku].version,'excel-v2-packs-v1');}
});
test('presentaciones rechazan fracciones, valores inválidos y desbordamiento',()=>{
 for(const q of [-1,.5,NaN,Infinity,'1',Number.MAX_SAFE_INTEGER])assert.throws(()=>rules.materialPackConversion('hilo_std',q),RangeError);
 assert.throws(()=>rules.materialPackConversion('sku_ajeno',1),RangeError);
});
