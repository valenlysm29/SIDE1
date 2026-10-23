/* SIDE V4: production model based on the workbook's production-capacity logic. */
(function(root,factory){
  const excelConfig=typeof module==='object'&&module.exports?require('./engine/config_excel.js'):root.SIDE_EXCEL_CONFIG;
  const excelCosts=typeof module==='object'&&module.exports?require('./engine/costos.js'):root.SIDE_EXCEL_COSTOS;
  const api=factory(excelConfig,excelCosts);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SIDE_PRODUCTION_MODEL=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(excelConfig,excelCosts){
  'use strict';

  const WORKING_DAYS=24;
  const BASE_EFFICIENCY=0.90;
  const LEVEL_THREE_BONUS=0.01;
  const LEADERSHIP_BONUS=0.04;
  const n=value=>Number.isFinite(Number(value))?Number(value):0;
  const whole=value=>Math.max(0,Math.floor(n(value)));
  const sum=values=>values.reduce((total,value)=>total+n(value),0);

  const STAFF_RATES={
    PERS_CORTE:{corte_basico:5,corte_exp:7,corte_maestro:9},
    PERS_ENSAMBLE:{ens_personal_basico:6,ens_personal_ind:8,ens_personal_esp:12},
    PERS_ACABADO:{aca_personal_basico:6,aca_personal_tec:7,aca_personal_art:10}
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
    {id:'cut',type:'operation',number:1,label:'Corte de piezas'},
    {id:'accessories_classification',type:'inspection',number:1,label:'Clasificación de accesorios'},
    {id:'accessories_preparation',type:'operation',number:2,label:'Preparación de accesorios'},
    {id:'assembly_accessories',type:'combined',number:1,label:'Ensamblado y colocación de accesorios'},
    {id:'finish',type:'combined',number:2,label:'Acabado final'}
  ];
  const MATERIAL_EXCEL={
    CUERO:[['cuero_sint','INS-01',25,'V76','D32'],['cuero_std','INS-02',45,'V77','E32'],['cuero_prem','INS-03',80,'V78','F32']],
    ACCESORIOS:[['acc_eco','INS-04',4,'V79','G32'],['acc_prem','INS-05',9,'V80','H32']],
    HILO:[['hilo_std','INS-06',2,'V81','I32'],['hilo_ref','INS-07',4,'V82','J32'],['hilo_prem','INS-08',7,'V83','K32']]
  };
  const exact=value=>Number(value.toPrecision(15));

  // Target requirements are calculated before looking at any purchased stock,
  // owned mold, staffing count or installed capacity. Excel D42:L44 multiplies
  // the desired quantity by its mold coefficients, without a MIN(stock, ...).
  function requirementsFor(ctx={}){
    const input=draft(ctx,'PRODUCCION_META'),targets=Object.fromEntries(Object.keys(MOLD_REQUIREMENTS).map(id=>[id,whole(input.moldTargets?.[id])])),unresolved=[];
    let target=sum(Object.values(targets));
    if(!target&&input.value){
      target=whole(input.value);
      const currentMold=ctx.drafts?.MOLDE?.optionIds?.[0]||(n(ctx.state?.MOLDE?.round)===n(ctx.round)?ctx.state?.MOLDE?.optionIds?.[0]:null);
      const explicitMold=input.moldId||ctx.requirementScenario?.moldId||currentMold;
      if(MOLD_REQUIREMENTS[explicitMold])targets[explicitMold]=target;
      else unresolved.push('Define el molde o la mezcla de moldes para calcular los insumos de la cantidad deseada.');
    }
    const knownMix=sum(Object.values(targets))===target;
    const lots=Object.entries(MOLD_REQUIREMENTS).map(([id,spec],index)=>({id,label:spec.label,quantity:targets[id],excelSource:`CANTIDAD DE PRODUCCIÓN!D${37+index}`,
      materials:Object.entries(MATERIALS).map(([material,definition],family)=>{
        const column=String.fromCharCode('D'.charCodeAt(0)+family*3+index),coefficient=column+(31+index),output=column+(42+index);
        return {id:material,label:definition.label,unit:definition.unit,needs:exact(targets[id]*spec[material]),
          excelSource:`CANTIDAD DE PRODUCCIÓN!${output}; ${coefficient}; D${37+index}`,formula:`=$D${37+index}*${coefficient}`};
      })}));
    const materials=Object.entries(MATERIALS).map(([id,definition])=>{
      const needs=knownMix?exact(sum(lots.map(lot=>lot.materials.find(row=>row.id===id).needs))):null;
      const options=MATERIAL_EXCEL[id].map(([optionId,codeExcel,fallback,priceCell,yieldCell])=>{
        const unitPrice=excelConfig?.CONFIG?.PRECIO_MP?.[codeExcel]??fallback,purchaseYield=definition.yields[optionId],discount=excelConfig?.CONFIG?.DESCUENTO_CANTIDAD??0.08;
        return {id:optionId,codeExcel,label:item(ctx,id)?.options?.find(option=>option.id===optionId)?.label||optionId,unit:definition.unit,unitPrice,quantity:needs,
          amountGross:needs===null?null:exact(needs*unitPrice),amount:needs===null?null:exact(needs*unitPrice*(1-discount)),purchaseYield,
          exactPurchaseUnits:needs===null?null:exact(needs/purchaseYield),roundingDefined:false,
          excelSource:`Costos De Producción!${priceCell}; W76:W83 (8%); ${yieldCell}; D33:K33`,
          note:'Costo teórico por unidad de materia prima de la hoja Costos De Producción; no es una compra ni un cargo del juego. El Excel no define redondeo de compras.'};
      });
      return {id,label:definition.label,unit:definition.unit,needs,options,excelSource:'CANTIDAD DE PRODUCCIÓN!D42:L44',
        selectedScenario:options.find(option=>option.id===ctx.requirementScenario?.materials?.[id])?.id||null};
    });
    const days=WORKING_DAYS;
    const processes=[['cut','Corte','F5:F7; E5:E7'],['assembly','Ensamblado','F11:H13; E11:E13; F10:H10'],['finish','Acabado','F17:H19; E17:E19; F16:H16']].map(([id,label,source])=>({
      id,label,units:target,workersNeeded:target?null:0,machinesNeeded:target?null:0,laborDays:target?null:0,calendarDays:days,monthlyPayroll:target?null:0,unitWorkCost:null,
      excelSource:`CANTIDAD DE PRODUCCIÓN!${source}; K5:N5`,
      unresolved:target?['El Excel recibe la dotación y la asignación de máquinas como entradas; no contiene una fórmula inversa de cantidad deseada a personal, equipos o tiempo necesario.']:[]
    }));
    const costItems=materials.map(material=>({id:material.id,label:material.label,amount:!target?0:material.options.find(option=>option.id===material.selectedScenario)?.amount??null,options:material.options,excelSource:'Costos De Producción!V76:W83; unidades X76:X83'}));
    costItems.push(...processes.map(process=>({id:'labor_'+process.id,label:'Mano de obra de '+process.label.toLowerCase(),amount:process.monthlyPayroll,excelSource:'Costos De Producción!U11:AD39'})),
      {id:'equipment',label:'Equipos para la meta',amount:target?null:0,excelSource:'Catalogo_Decisiones!INF-01:INF-10; Costos De Producción!U45:AD71'});
    const costUnresolved=target?['Define las calidades de materia prima para elegir entre los escenarios de costo.',
      'Falta definir la dotación, la asignación de máquinas y el régimen laboral para un costo total del plan.',
      'La hoja Costos De Producción valora materia prima en unidades físicas; sus ejemplos contienen contradicciones con las cantidades de compra convertidas. No se usa esta referencia para cobrar.']:[];
    return {target,targets,lots,materials,processes,maximumQuantity:null,quantityLimitNote:'El Excel no define un máximo global para la cantidad deseada.',dop:DOP_STEPS.map((step,index)=>({...step,sequence:index+1,units:target})),
      costs:{items:costItems,total:costItems.every(row=>row.amount!==null)?exact(sum(costItems.map(row=>row.amount))):null,
        knownSubtotal:exact(sum(costItems.filter(row=>row.amount!==null).map(row=>row.amount))),unresolved:costUnresolved},
      unresolved:[...unresolved,...(target?processes[0].unresolved:[])],excelSource:'CANTIDAD DE PRODUCCIÓN!D36:D44',
      scope:'Requerimientos de la cantidad deseada; independientes de los recursos disponibles'};
  }
  function compareRequirements(requirements,plan){
    const difference=(needs,available)=>needs===null?{missing:null,surplus:null}:{missing:Math.max(0,exact(needs-available)),surplus:Math.max(0,exact(available-needs))};
    const rows=requirements.materials.map(material=>{
      const available=plan.materials.find(row=>row.id===material.id)?.available||0,diff=difference(material.needs,available),scenario=material.options.find(option=>option.id===material.selectedScenario);
      return {id:material.id,label:material.label,kind:'material',unit:material.unit,needs:material.needs,available,...diff,
        costToCover:diff.missing===0?0:diff.missing===null||!scenario?null:exact(diff.missing*scenario.unitPrice*(1-(excelConfig?.CONFIG?.DESCUENTO_CANTIDAD??0.08))),
        costToCoverOptions:material.options.map(option=>({id:option.id,label:option.label,amount:diff.missing===null?null:exact(diff.missing*option.unitPrice*(1-(excelConfig?.CONFIG?.DESCUENTO_CANTIDAD??0.08)))})),
        excelSource:material.excelSource,costScope:'Referencia teórica de materia prima; no registra compras ni cobros'};
    });
    for(const process of requirements.processes){
      const available=plan.processes.find(row=>row.id===process.id);
      rows.push({id:'capacity_'+process.id,label:'Capacidad de '+process.label.toLowerCase(),kind:'capacity',unit:'unidades/ciclo',needs:requirements.target,available:available.cycleCapacity,...difference(requirements.target,available.cycleCapacity),costToCover:null,excelSource:process.excelSource});
      for(const [kind,field,quantity,label] of [['workers','workersNeeded',available.staff,'Personal'],['machines','machinesNeeded',available.machines,'Equipos']])rows.push({id:kind+'_'+process.id,label:label+' de '+process.label.toLowerCase(),kind,unit:kind==='workers'?'personas':'equipos',needs:process[field],available:quantity,...difference(process[field],quantity),costToCover:process[field]===0?0:null,excelSource:process.excelSource});
    }
    const materialRows=rows.filter(row=>row.kind==='material'),hasCapacityGap=rows.some(row=>row.kind==='capacity'&&row.missing>0);
    const knownCostToCoverSubtotal=exact(sum(materialRows.filter(row=>row.costToCover!==null).map(row=>row.costToCover)));
    return {items:rows,target:requirements.target,producibleUnits:plan.producibleUnits,productionGap:Math.max(0,requirements.target-plan.producibleUnits),
      compliancePercent:requirements.target?Math.round(plan.producibleUnits/requirements.target*100):null,
      feasible:requirements.target>0&&plan.producibleUnits>=requirements.target,scope:'Comparación operativa existente; no es una fórmula inversa del Excel',
      currentCost:exact(plan.costs.labor+plan.costs.materials),currentCostScope:'Personal y materiales de la configuración operativa existente; no es el costo total de la meta',
      costToCoverTotal:hasCapacityGap||materialRows.some(row=>row.costToCover===null)?null:knownCostToCoverSubtotal,knownCostToCoverSubtotal,
      unresolved:[...requirements.unresolved,'La comparación conserva las reglas operativas existentes del juego: emparejamiento de personal y máquinas, eficiencia y límite por materiales. No se atribuyen esas reglas a una paridad literal con ambas hojas del Excel.']};
  }

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
    const role={PERS_CORTE:'corte',PERS_ENSAMBLE:'ensamble',PERS_ACABADO:'acabado'}[id];
    return sum((definition?.options||[]).map((option,index)=>whole(counts[option.id])*(excelCosts?.costoLaboral?excelCosts.costoLaboral(role,index+1,'MYPE').pagoMensual:n(option.cost))));
  }
  function materialCost(ctx,id){
    const definition=item(ctx,id),counts=quantityCounts(ctx,id);
    const hasAnalyst=selected(ctx,'ANALISTA_COMPRAS').includes('si_analista');
    const discount=hasAnalyst?Math.max(2,12-(n(ctx.round)-1)*2):0;
    return sum((definition?.options||[]).map(option=>{
      const code=MATERIAL_EXCEL[id]?.find(row=>row[0]===option.id)?.[1];
      const cost=code&&excelCosts?.precioCompraMateriaPrima?excelCosts.precioCompraMateriaPrima(code,{analistaCompras:hasAnalyst,ciclo:ctx.round}):n(option.cost)*(1-discount/100);
      return whole(counts[option.id])*cost;
    }));
  }
  function calculate(ctx={}){
    const targetRequirements=requirementsFor(ctx);
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
      const definition=item(ctx,id),selections=(definition?.options||[]).map(option=>({id:option.id,label:option.label,quantity:whole(counts[option.id]),contribution:whole(counts[option.id])*n(spec.yields[option.id])})).filter(selection=>selection.quantity>0);
      return {id,label:spec.label,unit:spec.unit,available,perUnit,neededForTarget,supportedUnits,selections,cost:materialCost(ctx,id)};
    });
    const materialCapacity=materials.length?Math.min(...materials.map(material=>material.supportedUnits)):0;
    const producibleUnits=Math.max(0,Math.min(target,processCapacity,materialCapacity));
    processes.forEach(process=>{process.plannedUnits=producibleUnits;process.shortfall=Math.max(0,target-process.cycleCapacity);});
    materials.forEach(material=>{material.consumption=producibleUnits*material.perUnit;material.remaining=Math.max(0,material.available-material.consumption);material.shortfall=Math.max(0,material.neededForTarget-material.available);});
    const activeLines=productLines.filter(line=>line.target>0);let assigned=0;productLines.forEach(line=>{
      line.plannedUnits=!line.target?0:line===activeLines.at(-1)?Math.max(0,producibleUnits-assigned):Math.floor(producibleUnits*(line.target/target));assigned+=line.plannedUnits;
      line.productionPercent=line.target?Math.min(100,Math.round(line.plannedUnits/line.target*100)):0;
    });
    const limitingProcesses=processes.filter(process=>process.cycleCapacity===processCapacity).map(process=>process.label);
    const limitingMaterials=materials.filter(material=>material.supportedUnits===materialCapacity).map(material=>material.label);
    const unavailablePlannedMolds=productLines.filter(line=>line.target>0&&!line.available).map(line=>line.id);
    const plan={
      target,targets,productLines,days,efficiency,levelThree,hasLeadership,moldId,moldLabel:requirements.label,selectedMoldIds,ownedMoldIds:ownedIds,availableMoldIds,unavailablePlannedMolds,
      processes,materials,processCapacity,materialCapacity,producibleUnits,
      productionGap:Math.max(0,target-producibleUnits),limitingProcesses,limitingMaterials,
      dop:DOP_STEPS.map((step,index)=>({...step,sequence:index+1,units:producibleUnits})),
      costs:{labor:sum(processes.map(process=>process.payroll)),materials:sum(materials.map(material=>material.cost))}
    };
    plan.requirements=targetRequirements;
    plan.comparison=compareRequirements(targetRequirements,plan);
    return plan;
  }

  function yieldFor(materialId,optionId){return n(MATERIALS[materialId]?.yields?.[optionId]);}
  function materialUnit(materialId){return MATERIALS[materialId]?.unit||'unidades';}
  function cycleProductivity(plan={},record=null,round=1){
    const target=Number(plan?.target),value=record?.producedUnits;
    const produced=record&&Number(record.round)===Number(round)&&value!==null&&value!==undefined&&Number.isFinite(Number(value))&&Number(value)>=0?Number(value):null;
    return {produced,compliance:produced!==null&&Number.isFinite(target)&&target>0?produced/target*100:null,
      difference:produced!==null&&Number.isFinite(target)&&target>0?target-produced:null};
  }
  return Object.freeze({calculate,requirementsFor,yieldFor,materialUnit,cycleProductivity,constants:Object.freeze({WORKING_DAYS,BASE_EFFICIENCY,LEVEL_THREE_BONUS,LEADERSHIP_BONUS,MOLD_REQUIREMENTS,DOP_STEPS})});
});
