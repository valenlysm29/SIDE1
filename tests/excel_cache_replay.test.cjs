'use strict';
// Expected values were previously recalculated by Microsoft Excel COM; no COM is launched here.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const cached=path.join(__dirname,'fixtures/excel_equivalencia_cache'),output=path.join(__dirname,'output/excel_equivalencia_actual');
const originalRead=fs.readFileSync,originalExists=fs.existsSync;
fs.readFileSync=function(file,...args){const name=path.basename(String(file));if(String(file).startsWith(output)&&name.endsWith('-valores.json'))return originalRead.call(this,path.join(cached,name),...args);return originalRead.call(this,file,...args);};
fs.existsSync=function(file){if(String(file).endsWith('SIDE_prueba_cantidad_produccion_corregido.xlsx'))return true;return originalExists.call(this,file);};
cp.execFileSync=(file,args)=>{if(file!=='powershell'||!args.some(x=>String(x).includes('recalcular_com.ps1')))throw Error('Unexpected process');return Buffer.alloc(0);};
require('./equivalencia_fuente_side.cjs');
