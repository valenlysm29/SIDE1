/* Clasificación de auditoría; no habilita efectos ni autoriza asignaciones.
 * Las consecuencias complejas requieren diseño específico antes de activarse. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SIDE_EVENT_SEMANTICS=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const groups={
  demanda_potencial:'01 02 03 04 05 06 07 08 09 10 11 12 13 14 17 18 19 61 64 65 80 81 82 89',
  atractivo_competitivo:'22 24 66 67 69 70 71 74 75 85 86 91 92',
  capacidad_produccion:'26 27 28 29 30 39 40 41 45',
  adquisicion_materiales:'46 47 48 49 52 55 56 57 58 59 60 63 78',
  recepcion_materiales:'42 43',
  costos_operacion:'15 16 20 21 25 32 34 36 50 51 62 72 73 87 88',
  movimientos_financieros:'23 31 38 44 53 54 68 76 77 79',
  inventario_calidad:'33 35 37 83 84 90'
 };
 const byId={};
 for(const [primary,ids] of Object.entries(groups))for(const id of ids.split(' ')){
  const key='PE'+id;if(byId[key])throw new Error('Evento duplicado: '+key);
  const implemented=['PE01','PE02','PE03','PE04','PE23','PE30','PE68','PE69','PE71','PE74','PE75','PE77'].includes(key);
  byId[key]=Object.freeze({primary,implemented,version:['PE01','PE02','PE03','PE04'].includes(key)?'market-expansion-v1':key==='PE30'?'assembly-breakdown-v1':['PE23','PE68','PE77'].includes(key)?'operating-expense-v1':implemented?'demand-share-v1':null});
 }
 if(Object.keys(byId).length!==92)throw new Error('Catálogo de semántica incompleto');
 return Object.freeze(byId);
});
