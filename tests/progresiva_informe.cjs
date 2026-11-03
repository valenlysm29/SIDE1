'use strict';
// Regenerate the deliverable from measured QA results; never use credentials.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),input=path.join(root,'tests/output/progresiva'),out=path.join(root,'reports/progresiva-20261103');
const read=name=>JSON.parse(fs.readFileSync(path.join(input,name),'utf8'));
const local=read('matriz-local.json'),official=[...read('matriz-oficial.json'),...read('matriz-repeticion.json')];
const amount=value=>value===null||value===undefined?'—':value.toFixed(2);
assert.equal(local.length,90);assert.equal(official.length,109);
fs.mkdirSync(out,{recursive:true});
for(const [name,rows]of [['matriz-local',local],['matriz-oficial',official]]){
 fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(rows,null,2)+'\n');
 const lines=['# '+name,'','Importes en soles. Precio efectivo y costo unitario de combinados son promedios ponderados; el JSON adjunto contiene el detalle por producto y las conciliaciones de insumos y etapas.','','| Partida / ciclo | Estrategia | Molde | Meta | Producido | Vendido | Costo unitario | Precio efectivo | Utilidad neta | Estado |','| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |'];
 for(const r of rows)lines.push(`| ${r.partida||'Local'}${r.ciclo?' / '+r.ciclo:''} | ${r.estrategia} | ${r.molde} | ${r.metaTotal} | ${r.producido} | ${r.vendido} | ${amount(r.costoUnitario)} | ${amount(r.precioEfectivo)} | ${amount(r.utilidad)} | ${r.estado}${r.incidencia?' · sin plan confirmado':''} |`);
 fs.writeFileSync(path.join(out,name+'.md'),lines.join('\n')+'\n');
}
const ui=[3,6,1].map(n=>read('interfaces-'+n+'.json'));
for(const e of ui){assert.equal(e.passed,true);assert.equal(e.errors.length,0);assert.equal(e.checks.length,e.ciclos*(e.empresas||12)*3);}
fs.writeFileSync(path.join(out,'interfaces.json'),JSON.stringify(ui,null,2)+'\n');
const count=rows=>({casos:rows.length,positivos:rows.filter(r=>r.utilidad>0).length,negativos:rows.filter(r=>r.utilidad<0).length,conciliados:rows.filter(r=>r.estado==='CONCILIA').length});
fs.writeFileSync(path.join(out,'resumen.json'),JSON.stringify({local:count(local),oficial:count(official),interfaces:ui.map(e=>({partida:e.partida,ciclos:e.ciclos,comprobaciones:e.checks.length,recarga:e.reloaded,aprobado:e.passed})),incidencias:official.filter(r=>r.incidencia).map(r=>({partida:r.partida,ciclo:r.ciclo,empresa:r.empresa,detalle:r.incidencia})),cajaNegativa:official.filter(r=>r.caja<0).map(r=>({partida:r.partida,ciclo:r.ciclo,empresa:r.empresa,estrategia:r.estrategia,caja:r.caja}))},null,2)+'\n');
console.log('REPORT',JSON.stringify({local:count(local),oficial:count(official),ui:ui.reduce((s,e)=>s+e.checks.length,0)}));
