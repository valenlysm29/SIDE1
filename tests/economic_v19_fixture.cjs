'use strict';
const fs=require('node:fs'),vm=require('node:vm');
const scope={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../js/decision_catalog.js'),'utf8'),scope);const catalog=JSON.parse(JSON.stringify(scope.window.SIDE_DECISION_CATALOG));
const clone=x=>JSON.parse(JSON.stringify(x));
function state(round=1,previous={},type=0){
 const s=clone(previous),counts={MESA_CORTE:{mesa:4},ENSAMBLE:{ens_ind:4},ACABADOS:{aca_ind:4},PERS_CORTE:{corte_maestro:4},PERS_ENSAMBLE:{ens_personal_esp:4},PERS_ACABADO:{aca_personal_art:4},CUERO:{cuero_prem:250},ACCESORIOS:{acc_prem:1000},HILO:{hilo_prem:10000}};
 for(const [id,quantities] of Object.entries(counts))s[id]={round,quantities,optionIds:Object.keys(quantities),...(['MESA_CORTE','ENSAMBLE','ACABADOS'].includes(id)?{purchases:{1:quantities}}:{})};
 s.MOLDE={round:1,optionIds:['molde_1','molde_2','molde_3']};s.JEFATURA={round,optionIds:['si_jefatura']};s.CANALES={round,optionIds:['web']};s.PRODUCCION_META={round,moldTargets:type===3?{molde_1:30,molde_2:30,molde_3:30}:{['molde_'+(type+1)]:90},prices:{esencial:42.5,urbano:160,premium:250}};return s;
}
module.exports={state,catalog};
