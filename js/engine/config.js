/* Excel v19. SUPUESTOS pendientes de aprobación: los valores sin fórmula fuente
 * permanecen aquí para poder cambiarlos sin alterar el orden del cierre. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SIDE_ECONOMIC_CONFIG=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  return Object.freeze({version:'excel-v19',products:['esencial','urbano','premium'],
    segments:{esencial:{code:'SEG-01',min:40,max:45,defaultPrice:42.5,market:3500,weights:[.7,.2,.1],quality:0},urbano:{code:'SEG-02',min:120,max:200,defaultPrice:160,ideal:100,market:3500,weights:[.4,.35,.25],quality:4},premium:{code:'SEG-03',min:220,max:400,defaultPrice:250,ideal:250,market:800,weights:[.1,.5,.4],quality:7}},
    consequences:{lowQualityPrice:.65,premiumPrice:1.4,reputationChange:2,lowEfficiency:4,lowProduction:.7,noLeaderEfficiency:5,noLeaderProduction:.95,lowReputation:3,lowReputationCycles:2,lowDemand:.8,lowHealth:3},
    // SUPUESTO: capacitación baja/alta 0%/12%; media +8% figura en Excel.
    training:{cap_no:0,cap_baja:0,cap_media:.08,cap_alta:.12},
    // SUPUESTO: solo marketing medio tiene +12% explícito; extremos 0/20%.
    marketing:{mkt_baja:0,mkt_media:.12,mkt_alta:.2},
    // SUPUESTO: cobertura base neutral; cada tienda adicional +5%, tope +25%.
    channels:{web:1,physical:1,mixed:1,extraStore:.05,maxExtra:.25},
    // SUPUESTOS heredados: almacenaje S/2/u, horas extra 25%, tasa +3 pp.
    storagePerUnit:2,overtimeRate:.25,nextLoanRatePP:3,
    credit:{initial:.2,step:.05,analystBonus:.05,max:.7},commission:.01,
    warranty:{pt_30:5,pt_90:10,pt_180:10},
    // SUPUESTO: vida productiva100000u, acelerada doble línea recta; solo devengo.
    depreciation:{productiveLife:100000,acceleratedFactor:2},
    // SUPUESTO: mantenimiento evita penalidad; inventarios no crean stock gratuito.
    maintenanceCapacity:0,inventoryCapacity:0,unservedDemand:'lost'
  });
});
