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
  const DOP_STEPS=[
    {id:'receive',type:'inspection',label:'Recepción e inspección de insumos'},
    {id:'trace',type:'operation',label:'Trazado según molde'},
    {id:'cut',type:'operation',label:'Corte de piezas'},
    {id:'cut_check',type:'inspection',label:'Inspección de corte'},
    {id:'assembly',type:'operation',label:'Ensamblado y costura'},
    {id:'accessories',type:'operation',label:'Colocación de accesorios'},
    {id:'assembly_check',type:'inspection',label:'Inspección de ensamble'},
    {id:'finish',type:'operation',label:'Acabado'},
    {id:'final_check',type:'inspection',label:'Inspección final'}
  ];

  function items(ctx){return (ctx.catalog||[]).flatMap(category=>category.items||[]);}
  function item(ctx,id){return items(ctx).find(entry=>entry.id===id);}
  function draft(ctx,id){
    if(ctx.drafts?.[id])return ctx.drafts[id];
    const entry=ctx.state?.[id],definition=item(ctx,id),same=n(entry?.round)===n(ctx.round);
    if(definition?.asset)return {quantities:{...(entry?.purchases?.[ctx.round]||{})}};
    if(definition?.type==='quantity'||definition?.type==='quantity-choice')return {quantities:same?{...(entry?.quantities||{})}:{}};
    if(definition?.type==='number')return {value:same?n(entry?.value):0};
    if(definition?.type==='production-plan'){
      if(same&&entry?.moldTargets)return {moldTargets:{...entry.moldTargets}};
      const legacy=same?whole(entry?.value):0,legacyMold=(entry?.moldId||entry?.optionIds?.[0]||'molde_1');
      return {moldTargets:legacy?{[legacyMold]:legacy}:{}};
    }
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
  function ownedMoldIds(ctx){
    const entry=ctx.state?.MOLDE,ids=[];
    for(const [round,row] of Object.entries(entry?.purchases||{}))if(n(round)<n(ctx.round))for(const [id,q] of Object.entries(row||{}))if(whole(q)>0&&!ids.includes(id))ids.push(id);
    if(!ids.length&&entry&&n(entry.round)<n(ctx.round))for(const id of entry.optionIds||[])if(MOLD_REQUIREMENTS[id]&&!ids.includes(id))ids.push(id);
    return ids;
  }
  function productionTargets(ctx){
    const d=draft(ctx,'PRODUCCION_META'),targets={};
    for(const id of Object.keys(MOLD_REQUIREMENTS))targets[id]=whole(d.moldTargets?.[id]);
    if(!sum(Object.values(targets))&&d.value){
      const legacyId=selected(ctx,'MOLDE')[0]||ownedMoldIds(ctx).at(-1)||'molde_1';
      targets[legacyId]=whole(d.value);
    }
    return targets;
  }
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
    const targets=productionTargets(ctx),target=sum(Object.values(targets)),days=whole(ctx.workingDays||WORKING_DAYS)||WORKING_DAYS;
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
    const selectedMoldIds=selected(ctx,'MOLDE').filter(id=>MOLD_REQUIREMENTS[id]);
    const ownedIds=ownedMoldIds(ctx),availableMoldIds=[...new Set([...ownedIds,...selectedMoldIds])];
    const moldId=selectedMoldIds[0]||ownedIds.at(-1)||'molde_1',requirements=MOLD_REQUIREMENTS[moldId]||MOLD_REQUIREMENTS.molde_1;
    const processCapacity=processes.length?Math.min(...processes.map(process=>process.cycleCapacity)):0;
    const suggestedTotal=processCapacity;
    const equalBase=Math.floor(suggestedTotal/Object.keys(MOLD_REQUIREMENTS).length),equalRemainder=suggestedTotal-equalBase*Object.keys(MOLD_REQUIREMENTS).length;
    const productLines=Object.entries(MOLD_REQUIREMENTS).map(([id,spec],index)=>{
      const lineTarget=targets[id],suggested=target?Math.round(suggestedTotal*(lineTarget/target)):equalBase+(index<equalRemainder?1:0);
      return {id,label:spec.label,target:lineTarget,suggested,owned:ownedIds.includes(id),selectedThisCycle:selectedMoldIds.includes(id),available:availableMoldIds.includes(id),requirements:{CUERO:lineTarget*spec.CUERO,ACCESORIOS:lineTarget*spec.ACCESORIOS,HILO:lineTarget*spec.HILO}};
    });
    const materials=Object.entries(MATERIALS).map(([id,spec])=>{
      const counts=quantityCounts(ctx,id),available=sum(Object.entries(spec.yields).map(([optionId,yieldValue])=>whole(counts[optionId])*yieldValue));
      const neededForTarget=sum(productLines.map(line=>line.requirements[id])),perUnit=target?neededForTarget/target:n(requirements[id]),supportedUnits=perUnit>0?Math.floor(available/perUnit):0;
      return {id,label:spec.label,unit:spec.unit,available,perUnit,neededForTarget,supportedUnits,cost:materialCost(ctx,id)};
    });
    const materialCapacity=materials.length?Math.min(...materials.map(material=>material.supportedUnits)):0;
    const producibleUnits=Math.max(0,Math.min(target,processCapacity,materialCapacity));
    processes.forEach(process=>{process.plannedUnits=producibleUnits;process.shortfall=Math.max(0,target-process.cycleCapacity);});
    materials.forEach(material=>{material.consumption=producibleUnits*material.perUnit;material.remaining=Math.max(0,material.available-material.consumption);material.shortfall=Math.max(0,material.neededForTarget-material.available);});
    let assigned=0;productLines.forEach((line,index)=>{line.plannedUnits=index===productLines.length-1?Math.max(0,producibleUnits-assigned):Math.floor(producibleUnits*(target?line.target/target:0));assigned+=line.plannedUnits;});
    const limitingProcesses=processes.filter(process=>process.cycleCapacity===processCapacity).map(process=>process.label);
    const limitingMaterials=materials.filter(material=>material.supportedUnits===materialCapacity).map(material=>material.label);
    const unavailablePlannedMolds=productLines.filter(line=>line.target>0&&!line.available).map(line=>line.id);
    return {
      target,targets,productLines,days,efficiency,levelThree,hasLeadership,moldId,moldLabel:requirements.label,selectedMoldIds,ownedMoldIds:ownedIds,availableMoldIds,unavailablePlannedMolds,
      processes,materials,processCapacity,materialCapacity,producibleUnits,
      productionGap:Math.max(0,target-producibleUnits),limitingProcesses,limitingMaterials,
      dop:DOP_STEPS.map((step,index)=>({...step,sequence:index+1,units:producibleUnits})),
      costs:{labor:sum(processes.map(process=>process.payroll)),materials:sum(materials.map(material=>material.cost))}
    };
  }

  function yieldFor(materialId,optionId){return n(MATERIALS[materialId]?.yields?.[optionId]);}
  function materialUnit(materialId){return MATERIALS[materialId]?.unit||'unidades';}
  return Object.freeze({calculate,yieldFor,materialUnit,constants:Object.freeze({WORKING_DAYS,BASE_EFFICIENCY,LEVEL_THREE_BONUS,LEADERSHIP_BONUS,MOLD_REQUIREMENTS,DOP_STEPS})});
});
