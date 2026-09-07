/* SIDE V4: production model based on the workbook's production-capacity logic. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SIDE_PRODUCTION_MODEL=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const WORKING_DAYS=30;
  const BASE_EFFICIENCY=0.90;
  const LEVEL_THREE_BONUS=0.01;
  const LEADERSHIP_BONUS=0.04;
  const n=value=>Number.isFinite(Number(value))?Number(value):0;
  const whole=value=>Math.max(0,Math.floor(n(value)));
  const sum=values=>values.reduce((total,value)=>total+n(value),0);

  const STAFF_RATES={
    PERS_CORTE:{corte_basico:6,corte_exp:8,corte_maestro:12},
    PERS_ENSAMBLE:{ens_personal_basico:6,ens_personal_ind:8,ens_personal_esp:12},
    PERS_ACABADO:{aca_personal_basico:6,aca_personal_tec:8,aca_personal_art:12}
  };
  const MACHINE_MULTIPLIERS={
    MESA_CORTE:{mesa:1},
    ENSAMBLE:{ens_basica:1,ens_semi:1.2,ens_ind:1.5},
    ACABADOS:{aca_basica:1,aca_semi:1.2,aca_ind:1.5}
  };
  const LEVEL_THREE_IDS=new Set(['corte_maestro','ens_personal_esp','aca_personal_art']);
  const MATERIALS={
    CUERO:{label:'Cuero',unit:'m²',yields:{cuero_sint:1,cuero_std:2,cuero_prem:2}},
    ACCESORIOS:{label:'Accesorios',unit:'unidades',yields:{acc_eco:1,acc_prem:1}},
    HILO:{label:'Hilo',unit:'metros',yields:{hilo_std:270,hilo_ref:250,hilo_prem:200}}
  };
  const MOLD_REQUIREMENTS={
    molde_1:{label:'Molde básico',CUERO:0.3,ACCESORIOS:1,HILO:6},
    molde_2:{label:'Molde mejorado',CUERO:0.4,ACCESORIOS:1,HILO:7},
    molde_3:{label:'Molde premium',CUERO:0.7,ACCESORIOS:1,HILO:13}
  };

  function items(ctx){return (ctx.catalog||[]).flatMap(category=>category.items||[]);}
  function item(ctx,id){return items(ctx).find(entry=>entry.id===id);}
  function draft(ctx,id){
    if(ctx.drafts?.[id])return ctx.drafts[id];
    const entry=ctx.state?.[id],definition=item(ctx,id),same=n(entry?.round)===n(ctx.round);
    if(definition?.asset)return {quantities:{...(entry?.purchases?.[ctx.round]||{})}};
    if(definition?.type==='quantity'||definition?.type==='quantity-choice')return {quantities:same?{...(entry?.quantities||{})}:{}};
    if(definition?.type==='number')return {value:same?n(entry?.value):0};
    return {optionIds:[...(entry?.optionIds||definition?.defaultOptionIds||[])],quantities:{...(entry?.quantities||{})}};
  }
  function owned(ctx,id,optionId){
    return sum(Object.entries(ctx.state?.[id]?.purchases||{}).filter(([round])=>n(round)<n(ctx.round)).map(([,row])=>row?.[optionId]));
  }
  function assetCounts(ctx,id){
    const definition=item(ctx,id),current=draft(ctx,id).quantities||{},out={};
    for(const option of definition?.options||[])out[option.id]=whole(owned(ctx,id,option.id)+n(current[option.id]));
    return out;
  }
  function quantityCounts(ctx,id){
    const definition=item(ctx,id),current=draft(ctx,id).quantities||{},out={};
    for(const option of definition?.options||[])out[option.id]=whole(current[option.id]);
    return out;
  }
  function selected(ctx,id){return draft(ctx,id).optionIds||[];}
  function pairedDailyCapacity(staffCounts,staffRates,machineCounts,machineMultipliers){
    const staff=Object.entries(staffRates).map(([id,rate])=>({remaining:whole(staffCounts[id]),rate:n(rate)})).filter(x=>x.remaining).sort((a,b)=>b.rate-a.rate);
    const machines=Object.entries(machineMultipliers).map(([id,multiplier])=>({remaining:whole(machineCounts[id]),multiplier:n(multiplier)})).filter(x=>x.remaining).sort((a,b)=>b.multiplier-a.multiplier);
    let si=0,mi=0,capacity=0,pairs=0;
    while(si<staff.length&&mi<machines.length){
      const paired=Math.min(staff[si].remaining,machines[mi].remaining);
      capacity+=paired*staff[si].rate*machines[mi].multiplier;pairs+=paired;
      staff[si].remaining-=paired;machines[mi].remaining-=paired;
      if(!staff[si].remaining)si++;if(!machines[mi].remaining)mi++;
    }
    return {capacity,pairs,staff:sum(Object.values(staffCounts)),machines:sum(Object.values(machineCounts))};
  }
  function payroll(ctx,id){
    const definition=item(ctx,id),counts=quantityCounts(ctx,id);
    return sum((definition?.options||[]).map(option=>whole(counts[option.id])*n(option.cost)));
  }
  function materialCost(ctx,id){
    const definition=item(ctx,id),counts=quantityCounts(ctx,id);
    const hasAnalyst=selected(ctx,'ANALISTA_COMPRAS').includes('si_analista');
    const discount=hasAnalyst?Math.max(2,12-(n(ctx.round)-1)*2):0;
    return sum((definition?.options||[]).map(option=>whole(counts[option.id])*n(option.cost)*(1-discount/100)));
  }
  function calculate(ctx={}){
    const target=whole(draft(ctx,'PRODUCCION_META').value),days=whole(ctx.workingDays||WORKING_DAYS)||WORKING_DAYS;
    const staff={
      cut:quantityCounts(ctx,'PERS_CORTE'),
      assembly:quantityCounts(ctx,'PERS_ENSAMBLE'),
      finish:quantityCounts(ctx,'PERS_ACABADO')
    };
    const machines={
      cut:assetCounts(ctx,'MESA_CORTE'),
      assembly:assetCounts(ctx,'ENSAMBLE'),
      finish:assetCounts(ctx,'ACABADOS')
    };
    const levelThree=sum(Object.values(staff).flatMap(counts=>Object.entries(counts).filter(([id])=>LEVEL_THREE_IDS.has(id)).map(([,value])=>value)));
    const hasLeadership=selected(ctx,'JEFATURA').includes('si_jefatura');
    const efficiency=Math.min(1,Math.round((BASE_EFFICIENCY+levelThree*LEVEL_THREE_BONUS+(hasLeadership?LEADERSHIP_BONUS:0))*100)/100);
    const specs=[
      ['cut','Corte','PERS_CORTE','MESA_CORTE'],
      ['assembly','Ensamblado','PERS_ENSAMBLE','ENSAMBLE'],
      ['finish','Acabado','PERS_ACABADO','ACABADOS']
    ];
    const processes=specs.map(([id,label,staffId,machineId])=>{
      const pairing=pairedDailyCapacity(staff[id],STAFF_RATES[staffId],machines[id],MACHINE_MULTIPLIERS[machineId]);
      const cycleCapacity=Math.max(0,Math.round(pairing.capacity*days*efficiency));
      return {id,label,dailyCapacity:pairing.capacity,cycleCapacity,pairs:pairing.pairs,staff:pairing.staff,machines:pairing.machines,payroll:payroll(ctx,staffId)};
    });
    const moldId=selected(ctx,'MOLDE')[0]||'molde_1',requirements=MOLD_REQUIREMENTS[moldId]||MOLD_REQUIREMENTS.molde_1;
    const materials=Object.entries(MATERIALS).map(([id,spec])=>{
      const counts=quantityCounts(ctx,id),available=sum(Object.entries(spec.yields).map(([optionId,yieldValue])=>whole(counts[optionId])*yieldValue));
      const perUnit=n(requirements[id]),neededForTarget=target*perUnit,supportedUnits=perUnit>0?Math.floor(available/perUnit):0;
      return {id,label:spec.label,unit:spec.unit,available,perUnit,neededForTarget,supportedUnits,cost:materialCost(ctx,id)};
    });
    const processCapacity=processes.length?Math.min(...processes.map(process=>process.cycleCapacity)):0;
    const materialCapacity=materials.length?Math.min(...materials.map(material=>material.supportedUnits)):0;
    const producibleUnits=Math.max(0,Math.min(target,processCapacity,materialCapacity));
    processes.forEach(process=>{process.plannedUnits=producibleUnits;process.shortfall=Math.max(0,target-process.cycleCapacity);});
    materials.forEach(material=>{material.consumption=producibleUnits*material.perUnit;material.remaining=Math.max(0,material.available-material.consumption);material.shortfall=Math.max(0,material.neededForTarget-material.available);});
    const limitingProcesses=processes.filter(process=>process.cycleCapacity===processCapacity).map(process=>process.label);
    const limitingMaterials=materials.filter(material=>material.supportedUnits===materialCapacity).map(material=>material.label);
    return {
      target,days,efficiency,levelThree,hasLeadership,moldId,moldLabel:requirements.label,
      processes,materials,processCapacity,materialCapacity,producibleUnits,
      productionGap:Math.max(0,target-producibleUnits),limitingProcesses,limitingMaterials,
      costs:{labor:sum(processes.map(process=>process.payroll)),materials:sum(materials.map(material=>material.cost))}
    };
  }

  function yieldFor(materialId,optionId){return n(MATERIALS[materialId]?.yields?.[optionId]);}
  function materialUnit(materialId){return MATERIALS[materialId]?.unit||'unidades';}
  return Object.freeze({calculate,yieldFor,materialUnit,constants:Object.freeze({WORKING_DAYS,BASE_EFFICIENCY,LEVEL_THREE_BONUS,LEADERSHIP_BONUS})});
});
