'use strict';
const fs=require('node:fs'),path=require('node:path'),F=require('./progresiva_fixture.cjs');
const cycles=Number(process.argv[2]),round=Number(process.argv[3]),out=path.resolve(__dirname,'output/progresiva');
const manifest=JSON.parse(fs.readFileSync(path.join(out,'partida-'+cycles+'.json'),'utf8'));
const prior=round>1?JSON.parse(fs.readFileSync(path.join(out,cycles+'-historia-'+(round-1)+'.json'),'utf8')):null;
const q=(cycles===6?F.quantities:[100,500,1000])[round-1];
const result=Object.fromEntries(manifest.companies.map(c=>{
 const old=prior?.cycles.find(r=>String(r.empresa_id)===String(c.id)&&r.ciclo===round-1&&r.status==='confirmed')?.result;
 const target=F.targets(c.kind==='combinado'&&cycles===3?'asimetrico':c.kind,q,round);
 return [String(c.id),F.plan(target,c.strategy,round,old?.state||{})];
}));
fs.writeFileSync(path.join(out,cycles+'-planes-'+round+'.json'),JSON.stringify(result,null,2));
console.log('PLANS',cycles,round,Object.keys(result).length);
