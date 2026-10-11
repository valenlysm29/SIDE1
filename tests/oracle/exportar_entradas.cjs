/* Exporta exclusivamente decisiones y parámetros. No importa motores de cálculo. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const escenarios=require(path.join(root,'tests/escenarios_excel.cjs'));
const {CONFIG}=require(path.join(root,'js/engine/config_excel.js'));
function escribir(name,value){fs.writeFileSync(path.join(__dirname,name),JSON.stringify(value,null,2)+'\n');}
for(const name of ['Sim1','Sim2','Sim3'])if(escenarios['crear'+name])escribir('entradas_'+name.toLowerCase()+'.json',escenarios['crear'+name]());
escribir('entradas_simulaciones.json',{config:CONFIG,escenarios:[escenarios.crearSim3()]});
console.log('Entradas del oráculo exportadas; no se calcularon resultados SIDE.');
