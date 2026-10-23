/* Revenue only: Costos De Producción!C113:J152, DECISIONES SIDE (17).xlsx. */
(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('./engine/mercado.js'):root.SIDE_EXCEL_MERCADO,node?require('./engine/costos.js'):root.SIDE_EXCEL_COSTOS);if(node)module.exports=api;else root.SIDE_REVENUE_MODEL=api;})(typeof globalThis!=='undefined'?globalThis:this,function(MARKET,COSTS){
  'use strict';
  const ids=['esencial','urbano','premium'],defaults=[75,95,125];
  const n=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0;
  const sum=values=>values.reduce((s,v)=>s+n(v),0);
  function profile(input){
    const state=input.state||{},plan=input.production||{},lines=plan.productLines||[];
    const produced=lines.map(line=>n(line.plannedUnits));
    const materials={CUERO:['INS-01','INS-02','INS-03'],ACCESORIOS:['INS-04','INS-05'],HILO:['INS-06','INS-07','INS-08']},consumoMP={};
    for(const material of plan.materials||[]){
      let pending=n(material.consumption);
      for(const [i,option] of ({CUERO:['cuero_sint','cuero_std','cuero_prem'],ACCESORIOS:['acc_eco','acc_prem'],HILO:['hilo_std','hilo_ref','hilo_prem']}[material.id]||[]).entries()){
        const available=n(state.__inventarioMP?.[option])+n(state[material.id]?.round===input.round?state[material.id]?.quantities?.[option]:0),used=Math.min(available,pending);
        consumoMP[materials[material.id][i]]=used;pending-=used;
      }
    }
    const staff=['PERS_CORTE','PERS_ENSAMBLE','PERS_ACABADO'].flatMap(key=>Object.entries(state[key]?.round===input.round?state[key]?.quantities||{}:{}));
    const workers=sum(staff.map(([,q])=>q)),masters=sum(staff.filter(([id])=>['corte_maestro','ens_personal_esp','aca_personal_art'].includes(id)).map(([,q])=>q));
    const marketing=state.INV_MARKETING?.optionIds?.[0],publicidad=({mkt_baja:1500,mkt_media:6000,mkt_alta:12000})[marketing]||0;
    const reputation=COSTS.reputacionOperativa({produccion:{totalProducido:sum(produced),lotes:produced.map((producido,i)=>({molde:['INF-08','INF-09','INF-10'][i],producido}))},consumoMP,proporcionN3:workers?masters/workers:0,publicidad});
    return {id:input.id,reputacionMercado:reputation.valor,reputation,lines:ids.map((id,i)=>({id,segmento:`SEG-0${i+1}`,quantity:n(lines[i]?.target??lines[i]?.plannedUnits)+n(state.__finishedGoods?.[id]),price:n(input.prices?.[id])||defaults[i]}))};
  }
  function allocate(inputs){
    const profiles=inputs.map(profile),out=Object.fromEntries(profiles.map(p=>[p.id,{reputation:p.reputation,products:{}}]));
    const economic=profiles.filter(p=>p.lines[0].quantity>0).reduce((s,p)=>s+p.reputacionMercado,0);
    for(let i=0;i<3;i++){
      const participants=profiles.filter(p=>p.lines[i].quantity>0).map(p=>({id:p.id,precio:p.lines[i].price,reputacionMercado:p.reputacionMercado}));
      for(const row of MARKET.repartoMercado(participants,`SEG-0${i+1}`,{},{sumaReputacionEconomico:economic}))out[row.id].products[ids[i]]={...row,asignado:Math.max(0,row.asignado)};
    }
    return out;
  }
  return {profile,allocate};
});
