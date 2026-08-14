// Generated from DECISIONES SIDE (9).xlsx / Catalogo_Decisiones
// Generated menu contains only playable decisions from the spreadsheet.
window.SIDE_DECISION_CATALOG = [
  {
    "cat": "A",
    "title": "Empresa",
    "desc": "Define el segmento estratégico de tu empresa.",
    "icon": "assets/side_logo.png",
    "items": [
      {
        "id": "SEG-01",
        "name": "Segmento / linea",
        "options": [
          {
            "id": "SEG-01",
            "label": "Economico",
            "desc": "Precio bajo, prioriza volumen y costo",
            "cost": 0.0,
            "period": "Fija",
            "quality": 0,
            "efficiency": 0,
            "reputation": 1,
            "finance": 0,
            "notes": "Exige coherencia con Calidad real"
          },
          {
            "id": "SEG-02",
            "label": "Estandar",
            "desc": "Equilibra costo, calidad, demanda y margen",
            "cost": 0.0,
            "period": "Fija",
            "quality": 1,
            "efficiency": 0,
            "reputation": 1,
            "finance": 0,
            "notes": ""
          },
          {
            "id": "SEG-03",
            "label": "Premium",
            "desc": "Precio alto; requiere Calidad>=7 para sostenerse",
            "cost": 0.0,
            "period": "Fija",
            "quality": 2,
            "efficiency": 0,
            "reputation": 2,
            "finance": 0,
            "notes": "Riesgo si Calidad interna es baja (ver Matriz)"
          }
        ],
        "multi": false,
        "max": 1
      }
    ]
  },
  {
    "cat": "B",
    "title": "Infraestructura",
    "desc": "Equipa la operación y decide el nivel tecnológico de la planta.",
    "icon": "assets/icons/categories/infraestructura.svg",
    "items": [
      {
        "id": "INF-01",
        "name": "Mesa de corte",
        "options": [
          {
            "id": "INF-01",
            "label": "Unica (obligatoria)",
            "desc": "Inversion fija para todos; habilita la etapa de corte",
            "cost": 2500.0,
            "period": "Fija",
            "quality": 0,
            "efficiency": 1,
            "reputation": 0,
            "finance": 0,
            "notes": "Obligatoria, no otorga niveles"
          }
        ],
        "multi": false,
        "max": 1
      },
      {
        "id": "INF-02",
        "name": "Maquina de ensamblado",
        "options": [
          {
            "id": "INF-02",
            "label": "Nivel 1: manual/basica",
            "desc": "Costura Singer 4423 Heavy Duty; desbastadora a mano con cuchilla o lija",
            "cost": 3500.0,
            "period": "Fija",
            "quality": 1,
            "efficiency": 1,
            "reputation": 0,
            "finance": 0,
            "notes": ""
          },
          {
            "id": "INF-03",
            "label": "Nivel 2: semi-industrial",
            "desc": "Maquina de coser de columna/brazo (poste) Typical TB-801",
            "cost": 7500.0,
            "period": "Fija",
            "quality": 2,
            "efficiency": 2,
            "reputation": 0,
            "finance": 0,
            "notes": ""
          },
          {
            "id": "INF-04",
            "label": "Nivel 3: industrial",
            "desc": "Juki de triple accionamiento; desbastadora automatica de alta precision, servomotor",
            "cost": 15000.0,
            "period": "Fija",
            "quality": 3,
            "efficiency": 3,
            "reputation": 0,
            "finance": 0,
            "notes": ""
          }
        ],
        "multi": true,
        "max": 3
      },
      {
        "id": "INF-05",
        "name": "Maquina de acabados",
        "options": [
          {
            "id": "INF-05",
            "label": "Nivel 1: manual/basica",
            "desc": "Acabado a mano con cera/tinte de bordes, bruñido manual. Lento, variable en calidad",
            "cost": 1200.0,
            "period": "Fija",
            "quality": 1,
            "efficiency": 1,
            "reputation": 0,
            "finance": 0,
            "notes": ""
          },
          {
            "id": "INF-06",
            "label": "Nivel 2: semi-industrial",
            "desc": "Maquina de pulido de bordes (edge burnisher) electrica, tinte con pincel/aerografo",
            "cost": 4500.0,
            "period": "Fija",
            "quality": 2,
            "efficiency": 2,
            "reputation": 0,
            "finance": 0,
            "notes": ""
          },
          {
            "id": "INF-07",
            "label": "Nivel 3: industrial",
            "desc": "Linea de acabado con teñido automatico + pulido, control de temperatura y velocidad",
            "cost": 9500.0,
            "period": "Fija",
            "quality": 3,
            "efficiency": 3,
            "reputation": 0,
            "finance": 0,
            "notes": ""
          }
        ],
        "multi": true,
        "max": 3
      },
      {
        "id": "INF-08",
        "name": "Molde",
        "options": [
          {
            "id": "INF-08",
            "label": "Nivel 1 - Generico basico",
            "desc": "Patrones simples, tipo plantilla estandar de internet o catalogo generico",
            "cost": 300.0,
            "period": "Fija",
            "quality": 1,
            "efficiency": 1,
            "reputation": 0,
            "finance": 0,
            "notes": "Bajo aprovechamiento de cuero"
          },
          {
            "id": "INF-09",
            "label": "Nivel 2 - Generico mejorado",
            "desc": "Patron tecnico mas elaborado, con lineas de corte, marcado y perforaciones bien definidas",
            "cost": 1200.0,
            "period": "Fija",
            "quality": 2,
            "efficiency": 2,
            "reputation": 1,
            "finance": 0,
            "notes": "Aprovechamiento medio-alto"
          },
          {
            "id": "INF-10",
            "label": "Nivel 3 - Premium",
            "desc": "La empresa desarrolla su propio patron desde cero, adaptado a su propuesta de marca",
            "cost": 3500.0,
            "period": "Fija",
            "quality": 4,
            "efficiency": 2,
            "reputation": 2,
            "finance": 0,
            "notes": "Maximo aprovechamiento y diferenciacion"
          }
        ],
        "multi": true,
        "max": 3
      },
      {
        "id": "INF-11",
        "name": "Mantenimiento de maquinaria",
        "options": [
          {
            "id": "INF-11A",
            "label": "Solo correctivo",
            "desc": "La empresa repara las máquinas únicamente cuando presentan una falla",
            "cost": 0.0,
            "period": "Revisable cada ciclo",
            "quality": 0,
            "efficiency": -1,
            "reputation": 0,
            "finance": 1,
            "notes": "Ahorra al inicio, pero aumenta el riesgo de paradas y retrasos"
          },
          {
            "id": "INF-11B",
            "label": "Preventivo básico",
            "desc": "Incluye revisión, limpieza, lubricación y ajustes básicos para prevenir fallas",
            "cost": 1500.0,
            "period": "Revisable cada ciclo",
            "quality": 0,
            "efficiency": 1,
            "reputation": 0,
            "finance": 0,
            "notes": "Costo referencial por ciclo; reduce parcialmente las averías"
          },
          {
            "id": "INF-11C",
            "label": "Preventivo integral",
            "desc": "Incluye mantenimiento programado, cambio de piezas críticas y calibración de equipos",
            "cost": 3000.0,
            "period": "Revisable cada ciclo",
            "quality": 1,
            "efficiency": 2,
            "reputation": 0,
            "finance": -1,
            "notes": "Costo referencial por ciclo; minimiza paradas y defectos de fabricación"
          }
        ],
        "multi": true,
        "max": 3
      }
    ]
  },
  {
    "cat": "C",
    "title": "Recursos Humanos",
    "desc": "Arma el equipo que ejecutará corte, ensamble, acabados y coordinación.",
    "icon": "assets/icons/categories/recursos_humanos.svg",
    "items": [
      {
        "id": "RH-01",
        "name": "Personal de corte",
        "options": [
          {
            "id": "RH-01",
            "label": "Nivel 1 - Operario basico",
            "desc": "Corta con plantilla simple, sin experiencia previa. Mas lento, mas margen de error",
            "cost": 1500.0,
            "period": "Revisable con costo",
            "quality": 0,
            "efficiency": 1,
            "reputation": 0,
            "finance": 0,
            "notes": ""
          },
          {
            "id": "RH-02",
            "label": "Nivel 2 - Cortador con experiencia",
            "desc": "Optimiza el aprovechamiento del cuero, reduce desperdicio, mas rapido",
            "cost": 2500.0,
            "period": "Revisable con costo",
            "quality": 1,
            "efficiency": 2,
            "reputation": 0,
            "finance": 0,
            "notes": ""
          },
          {
            "id": "RH-03",
            "label": "Nivel 3 - Maestro cortador",
            "desc": "Trabaja cueros irregulares/premium, maximo aprovechamiento, minimo desperdicio",
            "cost": 4000.0,
            "period": "Revisable con costo",
            "quality": 2,
            "efficiency": 3,
            "reputation": 0,
            "finance": 0,
            "notes": ""
          }
        ],
        "multi": true,
        "max": 3
      },
      {
        "id": "RH-04",
        "name": "Personal de ensamble",
        "options": [
          {
            "id": "RH-04",
            "label": "Nivel 1 - Costurero basico",
            "desc": "Maquina domestica, puntadas rectas simples, funciona con diseños sencillos",
            "cost": 1500.0,
            "period": "Revisable con costo",
            "quality": 0,
            "efficiency": 1,
            "reputation": 0,
            "finance": 0,
            "notes": ""
          },
          {
            "id": "RH-05",
            "label": "Nivel 2 - Maquinista industrial",
            "desc": "Maquina semi-industrial/industrial, costuras reforzadas, mayor velocidad",
            "cost": 2800.0,
            "period": "Revisable con costo",
            "quality": 1,
            "efficiency": 2,
            "reputation": 0,
            "finance": 0,
            "notes": ""
          },
          {
            "id": "RH-06",
            "label": "Nivel 3 - Marroquinero especializado",
            "desc": "Costura a mano de alta gama, ejecuta moldes exclusivos complejos, ideal linea premium",
            "cost": 4500.0,
            "period": "Revisable con costo",
            "quality": 2,
            "efficiency": 3,
            "reputation": 1,
            "finance": 0,
            "notes": ""
          }
        ],
        "multi": true,
        "max": 3
      },
      {
        "id": "RH-07",
        "name": "Personal de acabados",
        "options": [
          {
            "id": "RH-07",
            "label": "Nivel 1 - Operario de acabado basico",
            "desc": "Aplica tinte y cera de forma simple, resultado variable",
            "cost": 1500.0,
            "period": "Revisable con costo",
            "quality": 0,
            "efficiency": 1,
            "reputation": 0,
            "finance": 0,
            "notes": ""
          },
          {
            "id": "RH-08",
            "label": "Nivel 2 - Tecnico en acabados",
            "desc": "Maneja maquina de pulido de bordes, tinte con aerografo, resultado consistente",
            "cost": 2800.0,
            "period": "Revisable con costo",
            "quality": 1,
            "efficiency": 2,
            "reputation": 0,
            "finance": 0,
            "notes": ""
          },
          {
            "id": "RH-09",
            "label": "Nivel 3 - Artesano acabador",
            "desc": "Bruñido fino, dorado, decoracion compleja (pedreria, herrajes especiales)",
            "cost": 4500.0,
            "period": "Revisable con costo",
            "quality": 2,
            "efficiency": 3,
            "reputation": 1,
            "finance": 0,
            "notes": ""
          }
        ],
        "multi": true,
        "max": 3
      },
      {
        "id": "RH-10",
        "name": "Jefatura",
        "options": [
          {
            "id": "RH-10A",
            "label": "Contratar jefatura",
            "desc": "Coordina el equipo, reduce riesgo de descoordinacion",
            "cost": 3000.0,
            "period": "Revisable con costo",
            "quality": 0,
            "efficiency": 2,
            "reputation": 1,
            "finance": 0,
            "notes": ""
          },
          {
            "id": "RH-10B",
            "label": "No contratar jefatura",
            "desc": "Ahorra costo fijo, pero aumenta el riesgo de descoordinacion",
            "cost": 0.0,
            "period": "Revisable con costo",
            "quality": 0,
            "efficiency": -1,
            "reputation": 0,
            "finance": 1,
            "notes": "Ahorro de caja pero baja Eficiencia"
          }
        ],
        "multi": false,
        "max": 1
      },
      {
        "id": "RH-11",
        "name": "Limpieza y servicios generales",
        "options": [
          {
            "id": "RH-11",
            "label": "Unica (obligatoria)",
            "desc": "Monto fijo obligatorio para mantener la operacion",
            "cost": 600.0,
            "period": "Fija",
            "quality": 0,
            "efficiency": 0,
            "reputation": 0,
            "finance": 0,
            "notes": ""
          }
        ],
        "multi": false,
        "max": 1
      },
      {
        "id": "RH-12",
        "name": "Local de produccion",
        "options": [
          {
            "id": "RH-12",
            "label": "Estandar (unico)",
            "desc": "Local de produccion estandar; alquiler fijo igual para todos los equipos",
            "cost": 2000.0,
            "period": "Fija",
            "quality": 0,
            "efficiency": 0,
            "reputation": 0,
            "finance": 0,
            "notes": ""
          }
        ],
        "multi": false,
        "max": 1
      }
    ]
  },
  {
    "cat": "D",
    "title": "Canales y ventas",
    "desc": "Decide cómo llegar al mercado, financiar ventas y respaldar al cliente.",
    "icon": "assets/icons/categories/canales_ventas.svg",
    "items": [
      {
        "id": "COM-01",
        "name": "Canal de venta",
        "options": [
          {
            "id": "COM-01A",
            "label": "Solo tienda fisica",
            "desc": "Menor cobertura y demanda; menor complejidad y costo",
            "cost": 0.0,
            "period": "Revisable cada ciclo",
            "quality": 0,
            "efficiency": 0,
            "reputation": 0,
            "finance": 1,
            "notes": ""
          },
          {
            "id": "COM-01B",
            "label": "Solo web",
            "desc": "Cobertura amplia con menor costo fijo; depende de marketing digital",
            "cost": 500.0,
            "period": "Revisable cada ciclo",
            "quality": 0,
            "efficiency": 0,
            "reputation": 1,
            "finance": 0,
            "notes": ""
          },
          {
            "id": "COM-01C",
            "label": "Web y fisico",
            "desc": "Mayor cobertura y demanda; incrementa complejidad y costo",
            "cost": 1500.0,
            "period": "Revisable cada ciclo",
            "quality": 0,
            "efficiency": 0,
            "reputation": 2,
            "finance": -1,
            "notes": ""
          }
        ],
        "multi": false,
        "max": 1
      },
      {
        "id": "FIN-01",
        "name": "Acceso a prestamo bancario",
        "options": [
          {
            "id": "FIN-01A",
            "label": "Solicitar prestamo",
            "desc": "Habilita apalancamiento; permite invertir mas rapido",
            "cost": 0.0,
            "period": "Fija: habilita",
            "quality": 0,
            "efficiency": 0,
            "reputation": 0,
            "finance": -1,
            "notes": "Aumenta apalancamiento"
          },
          {
            "id": "FIN-01B",
            "label": "No solicitar prestamo",
            "desc": "Evita intereses; la expansion depende del capital propio",
            "cost": 0.0,
            "period": "Fija: habilita",
            "quality": 0,
            "efficiency": 0,
            "reputation": 1,
            "finance": 1,
            "notes": ""
          }
        ],
        "multi": false,
        "max": 1
      },
      {
        "id": "COM-05",
        "name": "% de ventas a credito",
        "options": [
          {
            "id": "COM-05",
            "label": "20% a credito (referencia)",
            "desc": "Balancea liquidez y ventas; riesgo de cobranza bajo",
            "cost": 0.0,
            "period": "Revisable cada ciclo",
            "quality": 0,
            "efficiency": 0,
            "reputation": 1,
            "finance": -1,
            "notes": "Valor ingresado por el jugador en hoja Seleccion"
          }
        ],
        "multi": false,
        "max": 1
      },
      {
        "id": "COM-06",
        "name": "Garantía del producto",
        "options": [
          {
            "id": "COM-06A",
            "label": "Sin garantía",
            "desc": "No cubre fallas posteriores a la venta; reduce el costo inmediato, pero genera desconfianza",
            "cost": 0.0,
            "period": "Revisable cada ciclo",
            "quality": 0,
            "efficiency": 0,
            "reputation": -1,
            "finance": 1,
            "notes": "Mayor riesgo de reclamos y pérdida de clientes"
          },
          {
            "id": "COM-06B",
            "label": "Garantía de 30 días",
            "desc": "Cubre defectos de fabricación durante 30 días y brinda seguridad básica al cliente",
            "cost": 5.0,
            "period": "Revisable cada ciclo",
            "quality": 0,
            "efficiency": 0,
            "reputation": 1,
            "finance": 0,
            "notes": "Costo referencial por unidad vendida para atender cambios o reparaciones"
          },
          {
            "id": "COM-06C",
            "label": "Garantía de 90 días",
            "desc": "Cubre defectos durante 90 días; aumenta la confianza, pero exige una mayor provisión",
            "cost": 10.0,
            "period": "Revisable cada ciclo",
            "quality": 0,
            "efficiency": 0,
            "reputation": 2,
            "finance": -1,
            "notes": "Costo referencial por unidad vendida; mayor exposición a devoluciones"
          }
        ],
        "multi": false,
        "max": 1
      }
    ]
  },
  {
    "cat": "E",
    "title": "Insumos",
    "desc": "Configura materiales, proveedores, pagos, tiempos e inventario.",
    "icon": "assets/icons/categories/insumos.svg",
    "items": [
      {
        "id": "INS-01",
        "name": "Calidad del cuero",
        "options": [
          {
            "id": "INS-01",
            "label": "Nivel 1 - Cuero sintetico",
            "desc": "Bajo costo, menor durabilidad, acabado menos premium",
            "cost": 25.0,
            "period": "Revisable cada ciclo",
            "quality": 1,
            "efficiency": 0,
            "reputation": 0,
            "finance": 1,
            "notes": "por unidad, referencial"
          },
          {
            "id": "INS-02",
            "label": "Nivel 2 - Cuero genuino estandar",
            "desc": "Costo medio, durabilidad media",
            "cost": 45.0,
            "period": "Revisable cada ciclo",
            "quality": 2,
            "efficiency": 0,
            "reputation": 0,
            "finance": 0,
            "notes": "por unidad, referencial"
          },
          {
            "id": "INS-03",
            "label": "Nivel 3 - Cuero genuino premium",
            "desc": "Full grain / curtido vegetal: alto costo, alta durabilidad, mejor acabado",
            "cost": 80.0,
            "period": "Revisable cada ciclo",
            "quality": 3,
            "efficiency": 0,
            "reputation": 1,
            "finance": -1,
            "notes": "por unidad, referencial"
          }
        ],
        "multi": false,
        "max": 1
      },
      {
        "id": "INS-04",
        "name": "Calidad de accesorios",
        "options": [
          {
            "id": "INS-04",
            "label": "Nivel 1 - Aleacion economica",
            "desc": "Bajo costo, se oxida/desgasta mas rapido",
            "cost": 4.0,
            "period": "Revisable cada ciclo",
            "quality": 1,
            "efficiency": 0,
            "reputation": 0,
            "finance": 1,
            "notes": "por unidad, referencial"
          },
          {
            "id": "INS-05",
            "label": "Nivel 2 - Metal premium",
            "desc": "Laton macizo o acero inoxidable, alto costo, mayor durabilidad y brillo",
            "cost": 9.0,
            "period": "Revisable cada ciclo",
            "quality": 2,
            "efficiency": 0,
            "reputation": 1,
            "finance": -1,
            "notes": "por unidad, referencial"
          }
        ],
        "multi": false,
        "max": 1
      },
      {
        "id": "INS-06",
        "name": "Calidad del hilo",
        "options": [
          {
            "id": "INS-06",
            "label": "Nivel 1 - Poliester estandar",
            "desc": "Economico, resistencia media",
            "cost": 2.0,
            "period": "Revisable cada ciclo",
            "quality": 1,
            "efficiency": 0,
            "reputation": 0,
            "finance": 1,
            "notes": "por unidad, referencial"
          },
          {
            "id": "INS-07",
            "label": "Nivel 2 - Encerado reforzado",
            "desc": "Costo medio, mayor resistencia a tension",
            "cost": 4.0,
            "period": "Revisable cada ciclo",
            "quality": 2,
            "efficiency": 0,
            "reputation": 0,
            "finance": 0,
            "notes": "por unidad, referencial"
          },
          {
            "id": "INS-08",
            "label": "Nivel 3 - Alta tenacidad (nylon trenzado)",
            "desc": "Costoso, maxima durabilidad, ideal para costura visible/detalle",
            "cost": 7.0,
            "period": "Revisable cada ciclo",
            "quality": 3,
            "efficiency": 0,
            "reputation": 1,
            "finance": -1,
            "notes": "por unidad, referencial"
          }
        ],
        "multi": false,
        "max": 1
      },
      {
        "id": "INS-09",
        "name": "Numero de proveedores",
        "options": [
          {
            "id": "INS-09A",
            "label": "Proveedor unico",
            "desc": "Obtiene 2% adicional de descuento, pero concentra el riesgo de abastecimiento",
            "cost": 0.0,
            "period": "Revisable cada ciclo",
            "quality": 0,
            "efficiency": 0,
            "reputation": 0,
            "finance": 1,
            "notes": "Riesgo de desabastecimiento"
          },
          {
            "id": "INS-09B",
            "label": "Varios proveedores",
            "desc": "Menor descuento, pero reduce el riesgo de desabastecimiento",
            "cost": 0.0,
            "period": "Revisable cada ciclo",
            "quality": 0,
            "efficiency": 1,
            "reputation": 0,
            "finance": 0,
            "notes": ""
          }
        ],
        "multi": false,
        "max": 1
      },
      {
        "id": "INS-10",
        "name": "Politica de pago a proveedores",
        "options": [
          {
            "id": "INS-10A",
            "label": "Contado",
            "desc": "Obtiene 3% de descuento; reduce la caja inmediatamente",
            "cost": 0.0,
            "period": "Revisable cada ciclo",
            "quality": 0,
            "efficiency": 0,
            "reputation": 0,
            "finance": -1,
            "notes": ""
          },
          {
            "id": "INS-10B",
            "label": "Credito",
            "desc": "Sin descuento; conserva liquidez en el ciclo",
            "cost": 0.0,
            "period": "Revisable cada ciclo",
            "quality": 0,
            "efficiency": 0,
            "reputation": 0,
            "finance": 1,
            "notes": ""
          }
        ],
        "multi": false,
        "max": 1
      },
      {
        "id": "INS-11",
        "name": "Lead time",
        "options": [
          {
            "id": "INS-11A",
            "label": "Rapido (urgente, con sobrecosto)",
            "desc": "Entrega en menos dias, pero con sobrecosto",
            "cost": 0.0,
            "period": "Revisable cada ciclo",
            "quality": 0,
            "efficiency": 1,
            "reputation": 0,
            "finance": -1,
            "notes": ""
          },
          {
            "id": "INS-11B",
            "label": "Normal - 7 dias",
            "desc": "Equilibrio entre costo y disponibilidad",
            "cost": 0.0,
            "period": "Revisable cada ciclo",
            "quality": 0,
            "efficiency": 0,
            "reputation": 0,
            "finance": 0,
            "notes": ""
          },
          {
            "id": "INS-11C",
            "label": "Lento (economico)",
            "desc": "Menor costo, mayor riesgo de quiebre de stock",
            "cost": 0.0,
            "period": "Revisable cada ciclo",
            "quality": 0,
            "efficiency": -1,
            "reputation": 0,
            "finance": 1,
            "notes": ""
          }
        ],
        "multi": false,
        "max": 1
      },
      {
        "id": "INS-12",
        "name": "Política de inventarios",
        "options": [
          {
            "id": "INS-12A",
            "label": "Justo a tiempo",
            "desc": "Mantiene inventario mínimo y compra cerca de la fecha de producción",
            "cost": 0.0,
            "period": "Revisable cada ciclo",
            "quality": 0,
            "efficiency": -1,
            "reputation": 0,
            "finance": 1,
            "notes": "Menor dinero inmovilizado, pero mayor riesgo de quedarse sin insumos"
          },
          {
            "id": "INS-12B",
            "label": "Stock de seguridad medio",
            "desc": "Mantiene una reserva moderada para cubrir retrasos del proveedor o cambios de demanda",
            "cost": 1000.0,
            "period": "Revisable cada ciclo",
            "quality": 0,
            "efficiency": 1,
            "reputation": 0,
            "finance": 0,
            "notes": "Costo referencial de almacenamiento por ciclo; alternativa equilibrada"
          },
          {
            "id": "INS-12C",
            "label": "Stock de seguridad alto",
            "desc": "Mantiene una reserva amplia de materiales para evitar interrupciones de producción",
            "cost": 2500.0,
            "period": "Revisable cada ciclo",
            "quality": 0,
            "efficiency": 2,
            "reputation": 0,
            "finance": -1,
            "notes": "Reduce quiebres de stock, pero inmoviliza más efectivo y aumenta el almacenaje"
          }
        ],
        "multi": false,
        "max": 1
      }
    ]
  },
  {
    "cat": "F",
    "title": "Inversiones",
    "desc": "Fortalece capacidades internas y presencia comercial.",
    "icon": "assets/icons/categories/inversiones.svg",
    "items": [
      {
        "id": "INV-01",
        "name": "Inversion en RR.HH.",
        "options": [
          {
            "id": "INV-01A",
            "label": "Baja",
            "desc": "Poca capacitacion tecnica",
            "cost": 1000.0,
            "period": "Revisable cada ciclo",
            "quality": 0,
            "efficiency": 1,
            "reputation": 0,
            "finance": -1,
            "notes": ""
          },
          {
            "id": "INV-01B",
            "label": "Media",
            "desc": "Capacitacion tecnica: +8% de capacidad y mejor reputacion",
            "cost": 6000.0,
            "period": "Revisable cada ciclo",
            "quality": 0,
            "efficiency": 2,
            "reputation": 1,
            "finance": -1,
            "notes": ""
          },
          {
            "id": "INV-01C",
            "label": "Alta",
            "desc": "Capacitacion avanzada: mayor capacidad y reputacion, alto costo",
            "cost": 12000.0,
            "period": "Revisable cada ciclo",
            "quality": 0,
            "efficiency": 3,
            "reputation": 2,
            "finance": -2,
            "notes": ""
          }
        ],
        "multi": false,
        "max": 1
      },
      {
        "id": "INV-02",
        "name": "Inversion en marketing",
        "options": [
          {
            "id": "INV-02A",
            "label": "Baja",
            "desc": "Poca visibilidad de marca",
            "cost": 1500.0,
            "period": "Revisable cada ciclo",
            "quality": 0,
            "efficiency": 0,
            "reputation": 1,
            "finance": -1,
            "notes": ""
          },
          {
            "id": "INV-02B",
            "label": "Media",
            "desc": "S/ 6,000 por ciclo; aumenta demanda estimada 12% y reputacion",
            "cost": 6000.0,
            "period": "Revisable cada ciclo",
            "quality": 0,
            "efficiency": 0,
            "reputation": 2,
            "finance": -1,
            "notes": ""
          },
          {
            "id": "INV-02C",
            "label": "Alta",
            "desc": "Alto costo; mayor aumento de demanda y reputacion",
            "cost": 12000.0,
            "period": "Revisable cada ciclo",
            "quality": 0,
            "efficiency": 0,
            "reputation": 3,
            "finance": -2,
            "notes": ""
          }
        ],
        "multi": false,
        "max": 1
      }
    ]
  },
  {
    "cat": "G",
    "title": "Finanzas",
    "desc": "Define el tratamiento financiero y contable de la operación.",
    "icon": "assets/icons/categories/finanzas.svg",
    "items": [
      {
        "id": "FIN-02",
        "name": "Método de depreciación",
        "options": [
          {
            "id": "FIN-02A",
            "label": "Línea recta",
            "desc": "Distribuye el valor depreciable de la maquinaria en cuotas iguales durante su vida útil",
            "cost": 0.0,
            "period": "Fija en Ciclo 0",
            "quality": 0,
            "efficiency": 0,
            "reputation": 0,
            "finance": 0,
            "notes": "Gasto contable constante; no representa una salida de efectivo"
          },
          {
            "id": "FIN-02B",
            "label": "Unidades producidas",
            "desc": "Calcula la depreciación según el uso real de la maquinaria y las unidades fabricadas",
            "cost": 0.0,
            "period": "Fija en Ciclo 0",
            "quality": 0,
            "efficiency": 0,
            "reputation": 0,
            "finance": 1,
            "notes": "Mejora la asignación del costo por unidad; no representa una salida de efectivo"
          },
          {
            "id": "FIN-02C",
            "label": "Acelerada",
            "desc": "Reconoce una mayor depreciación durante los primeros ciclos y una menor depreciación después",
            "cost": 0.0,
            "period": "Fija en Ciclo 0",
            "quality": 0,
            "efficiency": 0,
            "reputation": 0,
            "finance": -1,
            "notes": "Reduce la utilidad contable inicial; no representa una salida de efectivo"
          }
        ],
        "multi": false,
        "max": 1
      }
    ]
  }
];
