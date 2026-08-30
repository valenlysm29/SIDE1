window.SIDE_DECISION_CATALOG = [
  {
    cat:'A', title:'Empresa', short:'Empresa', icon:'assets/side_logo.png',
<<<<<<< HEAD
    desc:'Define el segmento estratégico. El estudiante registra el nombre legal y el nombre comercial de su empresa al ingresar; luego se mantienen durante la partida.',
    items:[
      {id:'SEGMENTO', name:'Segmento de mercado', type:'choice', fixed:true, required:true, options:[
=======
    desc:'Define el segmento estratégico. El nombre de la empresa es fijo durante toda la partida.',
    items:[
      {id:'SEGMENTO', name:'Segmento de mercado', type:'choice', fixed:true, options:[
>>>>>>> 6c291dcf79430771bca699adf70a29650678cc04
        {id:'economico',label:'Económico',desc:'Prioriza volumen y precio accesible.',cost:0},
        {id:'estandar',label:'Estándar',desc:'Equilibra precio, calidad y margen.',cost:0},
        {id:'premium',label:'Premium',desc:'Compite por diferenciación, diseño y mayor valor percibido.',cost:0}
      ]}
    ]
  },
  {
    cat:'B', title:'Infraestructura', short:'Infraestructura', icon:'assets/icons/categories/infraestructura.svg',
    desc:'Compra activos, define el local de producción y administra el mantenimiento de la planta.',
    items:[
<<<<<<< HEAD
      {id:'MESA_CORTE',required:false,name:'Mesas de corte',type:'quantity',asset:true,unlimited:true,options:[
        {id:'mesa',label:'Mesa de corte',desc:'Mesa de trabajo para la etapa de corte. Puedes adquirir más de una.',cost:2500}
      ]},
      {id:'ENSAMBLE',required:false,name:'Máquinas de ensamblado',type:'quantity-choice',asset:true,unlimited:true,options:[
=======
      {id:'MESA_CORTE',name:'Mesas de corte',type:'quantity',asset:true,unlimited:true,options:[
        {id:'mesa',label:'Mesa de corte',desc:'Mesa de trabajo para la etapa de corte. Puedes adquirir más de una.',cost:2500}
      ]},
      {id:'ENSAMBLE',name:'Máquinas de ensamblado',type:'quantity-choice',asset:true,unlimited:true,options:[
>>>>>>> 6c291dcf79430771bca699adf70a29650678cc04
        {id:'ens_basica',label:'Básica / manual',desc:'Equipo básico para diseños sencillos.',cost:3500},
        {id:'ens_semi',label:'Semi-industrial',desc:'Mayor estabilidad y velocidad de producción.',cost:7500},
        {id:'ens_ind',label:'Industrial',desc:'Equipo de alto desempeño para producción intensiva.',cost:15000}
      ]},
<<<<<<< HEAD
      {id:'ACABADOS',required:false,name:'Máquinas de acabados',type:'quantity-choice',asset:true,unlimited:true,options:[
=======
      {id:'ACABADOS',name:'Máquinas de acabados',type:'quantity-choice',asset:true,unlimited:true,options:[
>>>>>>> 6c291dcf79430771bca699adf70a29650678cc04
        {id:'aca_basica',label:'Básica / manual',desc:'Acabado manual con herramientas básicas.',cost:1200},
        {id:'aca_semi',label:'Semi-industrial',desc:'Pulido eléctrico y aplicación más uniforme.',cost:4500},
        {id:'aca_ind',label:'Industrial',desc:'Línea de acabado para mayor volumen y consistencia.',cost:9500}
      ]},
<<<<<<< HEAD
      {id:'MOLDE',name:'Molde de producto',type:'choice',fixed:true,lockAfterPurchase:true,noDepreciation:true,required:true,options:[
=======
      {id:'MOLDE',name:'Molde de producto',type:'choice',fixed:true,lockAfterPurchase:true,noDepreciation:true,options:[
>>>>>>> 6c291dcf79430771bca699adf70a29650678cc04
        {id:'molde_1',label:'Molde básico',desc:'Patrón sencillo para una línea de entrada.',cost:300},
        {id:'molde_2',label:'Molde mejorado',desc:'Patrón técnico con mejor aprovechamiento del material.',cost:1200},
        {id:'molde_3',label:'Molde premium',desc:'Patrón propio orientado a diferenciación y detalle.',cost:3500}
      ]},
<<<<<<< HEAD
      {id:'LOCAL_PROD',name:'Local de producción',type:'choice',required:true,recurring:true,mandatoryFixed:true,defaultOptionIds:['local_std'],options:[
        {id:'local_std',label:'Local de producción estándar',desc:'Costo operativo obligatorio para contar con un espacio de producción.',cost:2000}
      ]},
      {id:'MANTENIMIENTO',name:'Mantenimiento de maquinaria',type:'choice',required:false,options:[
        {id:'correctivo',label:'Mantenimiento correctivo',desc:'Costo simbólico obligatorio cuando corresponde intervenir una falla.',cost:200}
=======
      {id:'LOCAL_PROD',name:'Local de producción',type:'choice',options:[
        {id:'local_std',label:'Local de producción estándar',desc:'Espacio operativo base para fabricar los productos.',cost:2000}
      ]},
      {id:'MANTENIMIENTO',name:'Mantenimiento de maquinaria',type:'choice',options:[
        {id:'correctivo',label:'Solo correctivo',desc:'Se interviene únicamente cuando aparece una falla.',cost:200},
        {id:'preventivo',label:'Preventivo básico',desc:'Revisión, limpieza, lubricación y ajustes programados.',cost:1500},
        {id:'integral',label:'Preventivo integral',desc:'Mantenimiento completo y cambio preventivo de piezas críticas.',cost:3000}
>>>>>>> 6c291dcf79430771bca699adf70a29650678cc04
      ]}
    ]
  },
  {
    cat:'C', title:'Producción', short:'Producción', icon:'assets/icons/categories/recursos_humanos.svg',
    desc:'Integra personal, compras, materia prima y el volumen que deseas producir en el ciclo.',
    items:[
<<<<<<< HEAD
      {id:'PERS_CORTE',required:false,name:'Personal de corte',type:'quantity-choice',recurring:true,options:[
=======
      {id:'PERS_CORTE',name:'Personal de corte',type:'quantity-choice',recurring:true,options:[
>>>>>>> 6c291dcf79430771bca699adf70a29650678cc04
        {id:'corte_basico',label:'Operario básico',desc:'Apoya tareas de corte con procesos estandarizados.',cost:1500},
        {id:'corte_exp',label:'Cortador con experiencia',desc:'Mejor aprovechamiento del material y mayor velocidad.',cost:2500},
        {id:'corte_maestro',label:'Maestro cortador',desc:'Especialista para materiales y diseños complejos.',cost:4000}
      ]},
<<<<<<< HEAD
      {id:'PERS_ENSAMBLE',required:false,name:'Personal de ensamble',type:'quantity-choice',recurring:true,options:[
=======
      {id:'PERS_ENSAMBLE',name:'Personal de ensamble',type:'quantity-choice',recurring:true,options:[
>>>>>>> 6c291dcf79430771bca699adf70a29650678cc04
        {id:'ens_personal_basico',label:'Costurero básico',desc:'Adecuado para diseños simples y tareas repetitivas.',cost:1500},
        {id:'ens_personal_ind',label:'Maquinista industrial',desc:'Opera equipos industriales con mayor productividad.',cost:2800},
        {id:'ens_personal_esp',label:'Marroquinero especializado',desc:'Especialista para piezas complejas y líneas premium.',cost:4500}
      ]},
<<<<<<< HEAD
      {id:'PERS_ACABADO',required:false,name:'Personal de acabados',type:'quantity-choice',recurring:true,options:[
=======
      {id:'PERS_ACABADO',name:'Personal de acabados',type:'quantity-choice',recurring:true,options:[
>>>>>>> 6c291dcf79430771bca699adf70a29650678cc04
        {id:'aca_personal_basico',label:'Operario de acabado',desc:'Realiza acabados básicos y tareas de apoyo.',cost:1500},
        {id:'aca_personal_tec',label:'Técnico en acabados',desc:'Maneja herramientas y equipos de acabado.',cost:2800},
        {id:'aca_personal_art',label:'Artesano acabador',desc:'Realiza acabados finos y detalles especiales.',cost:4500}
      ]},
<<<<<<< HEAD
      {id:'JEFATURA',required:false,name:'Jefatura de producción',type:'choice',recurring:true,options:[
        {id:'no_jefatura',label:'No contratar',desc:'La coordinación queda a cargo del equipo.',cost:0},
        {id:'si_jefatura',label:'Contratar',desc:'Incorpora una jefatura para coordinar la operación.',cost:3000}
      ]},
      {id:'LIMPIEZA',required:false,name:'Limpieza y servicios generales',type:'quantity',recurring:true,options:[
        {id:'limpieza',label:'Personal de limpieza / servicios',desc:'Apoyo operativo para mantener el área de producción.',cost:600}
      ]},
      {id:'ANALISTA_COMPRAS',required:false,name:'Analista de compras',type:'choice',recurring:true,options:[
        {id:'no_analista',label:'No contratar',desc:'Compras sin negociación especializada.',cost:0},
        {id:'si_analista',label:'Contratar',desc:'S/ 5,000 por ciclo. Negocia mejores condiciones; el beneficio porcentual es mayor al inicio y luego se reduce.',cost:5000}
      ]},
      {id:'PRODUCCION_META',name:'¿Cuánto deseas producir?',type:'number',recurring:true,required:true,min:1,step:1,unit:'unidades',desc:'Indica la producción objetivo del ciclo. El juego calculará la materia prima mínima necesaria.',cost:0},
      {id:'CUERO',name:'Compra de cuero',type:'quantity-choice',material:true,recurring:true,requiredWhenProduction:true,options:[
=======
      {id:'JEFATURA',name:'Jefatura de producción',type:'choice',recurring:true,options:[
        {id:'no_jefatura',label:'No contratar',desc:'La coordinación queda a cargo del equipo.',cost:0},
        {id:'si_jefatura',label:'Contratar',desc:'Incorpora una jefatura para coordinar la operación.',cost:3000}
      ]},
      {id:'LIMPIEZA',name:'Limpieza y servicios generales',type:'quantity',recurring:true,options:[
        {id:'limpieza',label:'Personal de limpieza / servicios',desc:'Apoyo operativo para mantener el área de producción.',cost:600}
      ]},
      {id:'ANALISTA_COMPRAS',name:'Analista de compras',type:'choice',recurring:true,options:[
        {id:'no_analista',label:'No contratar',desc:'Compras sin negociación especializada.',cost:0},
        {id:'si_analista',label:'Contratar',desc:'S/ 5,000 por ciclo. Negocia mejores condiciones; el beneficio porcentual es mayor al inicio y luego se reduce.',cost:5000}
      ]},
      {id:'PRODUCCION_META',name:'¿Cuánto deseas producir?',type:'number',recurring:true,min:0,step:1,unit:'unidades',desc:'Indica la producción objetivo del ciclo. El juego calculará la materia prima mínima necesaria.',cost:0},
      {id:'CUERO',name:'Compra de cuero',type:'quantity-choice',material:true,recurring:true,options:[
>>>>>>> 6c291dcf79430771bca699adf70a29650678cc04
        {id:'cuero_sint',label:'Cuero sintético',desc:'Alternativa económica.',cost:25},
        {id:'cuero_std',label:'Cuero genuino estándar',desc:'Balance entre costo y durabilidad.',cost:45},
        {id:'cuero_prem',label:'Cuero genuino premium',desc:'Mayor durabilidad y acabado.',cost:80}
      ]},
<<<<<<< HEAD
      {id:'ACCESORIOS',name:'Compra de accesorios',type:'quantity-choice',material:true,recurring:true,requiredWhenProduction:true,options:[
        {id:'acc_eco',label:'Aleación económica',desc:'Accesorio funcional de menor costo.',cost:4},
        {id:'acc_prem',label:'Metal premium',desc:'Mayor durabilidad y mejor acabado.',cost:9}
      ]},
      {id:'HILO',name:'Compra de hilo',type:'quantity-choice',material:true,recurring:true,requiredWhenProduction:true,options:[
=======
      {id:'ACCESORIOS',name:'Compra de accesorios',type:'quantity-choice',material:true,recurring:true,options:[
        {id:'acc_eco',label:'Aleación económica',desc:'Accesorio funcional de menor costo.',cost:4},
        {id:'acc_prem',label:'Metal premium',desc:'Mayor durabilidad y mejor acabado.',cost:9}
      ]},
      {id:'HILO',name:'Compra de hilo',type:'quantity-choice',material:true,recurring:true,options:[
>>>>>>> 6c291dcf79430771bca699adf70a29650678cc04
        {id:'hilo_std',label:'Poliéster estándar',desc:'Opción de costo bajo y resistencia media.',cost:2},
        {id:'hilo_ref',label:'Encerado reforzado',desc:'Mayor resistencia a tensión.',cost:4},
        {id:'hilo_prem',label:'Alta tenacidad',desc:'Alta resistencia para acabados exigentes.',cost:7}
      ]},
<<<<<<< HEAD
      {id:'GARANTIA_PROV',required:false,name:'Garantía de proveedores',type:'choice',noCashEffect:true,recurring:true,options:[
        {id:'gar_0',label:'Sin garantía',desc:'No hay porcentaje de devolución por material fallado.',cost:0,value:0},
        {id:'gar_80',label:'80% de devolución',desc:'Ante una falla cubierta, el proveedor devuelve el 80% del valor correspondiente.',cost:0,value:80},
        {id:'gar_100',label:'100% de devolución',desc:'Ante una falla cubierta, el proveedor devuelve el 100% del valor correspondiente.',cost:0,value:100}
      ]},
      {id:'GARANTIA_PT',name:'Garantía de productos terminados',type:'choice',noCashEffect:true,recurring:true,required:true,options:[
        {id:'pt_30',label:'Cobertura comercial 30 días',desc:'Política básica de respaldo al cliente para productos terminados.',cost:0,value:30},
        {id:'pt_90',label:'Cobertura comercial 90 días',desc:'Mayor respaldo posventa y confianza del cliente.',cost:0,value:90},
        {id:'pt_180',label:'Cobertura comercial 180 días',desc:'Política amplia de respaldo para líneas de mayor valor.',cost:0,value:180}
=======
      {id:'GARANTIA_PROV',name:'Garantía de proveedores',type:'choice',noCashEffect:true,recurring:true,options:[
        {id:'gar_0',label:'Sin garantía',desc:'No hay porcentaje de devolución por material fallado.',cost:0,value:0},
        {id:'gar_80',label:'80% de devolución',desc:'Ante una falla cubierta, el proveedor devuelve el 80% del valor correspondiente.',cost:0,value:80},
        {id:'gar_100',label:'100% de devolución',desc:'Ante una falla cubierta, el proveedor devuelve el 100% del valor correspondiente.',cost:0,value:100}
>>>>>>> 6c291dcf79430771bca699adf70a29650678cc04
      ]}
    ]
  },
  {
    cat:'D', title:'Canales y ventas', short:'Ventas', icon:'assets/icons/categories/canales_ventas.svg',
    desc:'Elige dónde vender. La demanda cambia por distrito y el equipo comercial se activa cuando existe una tienda física.',
    items:[
<<<<<<< HEAD
      {id:'CANALES',name:'Canales de venta',type:'multi-choice',required:true,minSelections:1,options:[
=======
      {id:'CANALES',name:'Canales de venta',type:'multi-choice',options:[
>>>>>>> 6c291dcf79430771bca699adf70a29650678cc04
        {id:'web',label:'Página web',desc:'Canal digital con cobertura amplia.',cost:500,channel:'web'},
        {id:'los_olivos',label:'Tienda · Los Olivos',desc:'Punto físico con demanda distrital propia.',cost:1800,channel:'store',district:'Los Olivos',demand:1.00},
        {id:'miraflores',label:'Tienda · Miraflores',desc:'Punto físico con mayor demanda potencial y mayor costo.',cost:3500,channel:'store',district:'Miraflores',demand:1.25},
        {id:'sjl',label:'Tienda · San Juan de Lurigancho',desc:'Punto físico con alta base poblacional y demanda distrital propia.',cost:2200,channel:'store',district:'San Juan de Lurigancho',demand:1.10}
      ]},
<<<<<<< HEAD
      {id:'PERSONAL_VENTAS',name:'Personal básico de ventas',type:'info',desc:'Cada tienda física incluye automáticamente 1 vendedor básico. Su remuneración variable equivale al 1% de las ventas realizadas en el simulador.'},
=======
      {id:'PERSONAL_VENTAS',name:'Personal de ventas por tienda',type:'sales-staff',recurring:true,costPerPerson:1300,desc:'Se habilita únicamente para los locales físicos elegidos. Cada persona cuesta S/ 1,300 por ciclo mediante recibo por honorarios.'},
>>>>>>> 6c291dcf79430771bca699adf70a29650678cc04
      {id:'CREDITO_VENTAS',name:'Ventas a crédito',type:'info',desc:'El porcentaje inicia fijo y aumenta según avanzan los ciclos. No es una decisión del jugador.'},
      {id:'DEVOLUCIONES',name:'Producto fallado',type:'info',desc:'Si un producto vendido presenta una falla que corresponde devolver, la empresa reintegra el dinero al cliente.'}
    ]
  },
  {
    cat:'E', title:'Inversiones y finanzas', short:'Finanzas', icon:'assets/icons/categories/finanzas.svg',
    desc:'Decide inversiones de crecimiento y, si lo necesitas, solicita financiamiento bancario.',
    items:[
<<<<<<< HEAD
      {id:'INV_RRHH',name:'Capacitación del equipo',type:'choice',recurring:true,required:false,options:[
        {id:'cap_no',label:'No capacitar este ciclo',desc:'No se realiza inversión en capacitación durante este ciclo.',cost:0},
=======
      {id:'INV_RRHH',name:'Capacitación del equipo',type:'choice',recurring:true,options:[
>>>>>>> 6c291dcf79430771bca699adf70a29650678cc04
        {id:'cap_baja',label:'Baja',desc:'Capacitación técnica puntual.',cost:1000},
        {id:'cap_media',label:'Media',desc:'Programa de capacitación técnica intermedia.',cost:6000},
        {id:'cap_alta',label:'Alta',desc:'Capacitación avanzada y especializada.',cost:12000}
      ]},
<<<<<<< HEAD
      {id:'INV_MARKETING',name:'Inversión en marketing',type:'choice',recurring:true,required:true,options:[
=======
      {id:'INV_MARKETING',name:'Inversión en marketing',type:'choice',recurring:true,options:[
>>>>>>> 6c291dcf79430771bca699adf70a29650678cc04
        {id:'mkt_baja',label:'Baja',desc:'Presencia básica de marca.',cost:1500},
        {id:'mkt_media',label:'Media',desc:'Mayor alcance y frecuencia comercial.',cost:6000},
        {id:'mkt_alta',label:'Alta',desc:'Campaña intensiva para acelerar visibilidad y demanda.',cost:12000}
      ]},
<<<<<<< HEAD
      {id:'PRESTAMO',name:'Préstamo bancario',type:'loan',required:false,desc:'El docente fija únicamente la TEA inicial. El límite del préstamo se calcula automáticamente como un porcentaje de tu caja inicial.'}
=======
      {id:'PRESTAMO',name:'Préstamo bancario',type:'loan',desc:'La TEA y el monto máximo son definidos por el docente. El préstamo aumenta la caja disponible y genera una obligación financiera.'}
>>>>>>> 6c291dcf79430771bca699adf70a29650678cc04
    ]
  }
];
