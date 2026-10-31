# Clasificación preliminar de los 92 eventos

La variable primaria es una propuesta de auditoría, no una promesa de efecto implementado. Implementados experimentalmente: PE01, PE02, PE03, PE04, PE17, PE18, PE23, PE30, PE68, PE69, PE71, PE74, PE75 y PE77. PE74 requiere inversión de marketing durante el ciclo.

La asignación manual y el sorteo persistido cubren ocho eventos individuales y seis eventos grupales mediante `20261031050037_eventos_grupales_mercado_v1.sql`. Las campañas modifican el mercado compartido antes de repartirlo, una vez por partida y ciclo, y el stock limita las ventas. Una prueba aislada concilia tres empresas durante seis ciclos con eventos individuales y grupales. Faltan competencia equilibrada, progresión por dificultad y los otros 78 efectos; el sorteo no constituye todavía el modo aleatorio completo. Pendientes también la aceptación integral con los tres modos y las observaciones funcionales permitidas sin evidencia de corrección. V2 permanece desactivado; la migración no se aplicó en remoto.

| ID | Evento | Alcance | Variable primaria propuesta | Estado |
|---|---|---|---|---|
| PE01 | Día del Padre | group | demanda_potencial | experimental |
| PE02 | Día de la Madre | group | demanda_potencial | experimental |
| PE03 | Campaña de Fiestas Patrias | group | demanda_potencial | experimental |
| PE04 | Campaña navideña | group | demanda_potencial | experimental |
| PE05 | Campaña escolar | group | demanda_potencial | pendiente |
| PE06 | Gratificación de julio/diciembre | group | demanda_potencial | pendiente |
| PE07 | Cyber Wow Perú | group | demanda_potencial | pendiente |
| PE08 | Black Friday | group | demanda_potencial | pendiente |
| PE09 | Fin de semana largo | group | demanda_potencial | pendiente |
| PE10 | Feria comercial distrital | group | demanda_potencial | pendiente |
| PE11 | Temporada de verano | group | demanda_potencial | pendiente |
| PE12 | Campaña por San Valentín | group | demanda_potencial | pendiente |
| PE13 | Campaña de aniversario del centro comercial | group | demanda_potencial | pendiente |
| PE14 | Feria de emprendedores peruanos | group | demanda_potencial | pendiente |
| PE15 | Paro de transportistas | group | costos_operacion | pendiente |
| PE16 | Bloqueo en la Carretera Central | group | costos_operacion | pendiente |
| PE17 | Manifestaciones en el centro de Lima | group | demanda_potencial | experimental |
| PE18 | Bono del Estado a familias | group | demanda_potencial | experimental |
| PE19 | Incertidumbre por elecciones | group | demanda_potencial | pendiente |
| PE20 | Huelga portuaria | group | costos_operacion | pendiente |
| PE21 | Tráfico extremo en Evitamiento/Panamericana | individual | costos_operacion | pendiente |
| PE22 | Cierre temporal de Gamarra | group | atractivo_competitivo | pendiente |
| PE23 | Inseguridad en zona comercial | individual | movimientos_financieros | experimental |
| PE24 | Obras viales frente al local | individual | atractivo_competitivo | pendiente |
| PE25 | Restricción temporal de tránsito pesado | group | costos_operacion | pendiente |
| PE26 | Corte de luz en zona industrial | individual | capacidad_produccion | pendiente |
| PE27 | Inspección inopinada de SUNAFIL | individual | capacidad_produccion | pendiente |
| PE28 | Renuncias de personal | individual | capacidad_produccion | pendiente |
| PE29 | Rotación de personal operativo | individual | capacidad_produccion | pendiente |
| PE30 | Falla en máquina ensambladora | individual | capacidad_produccion | experimental |
| PE31 | Falla severa de maquinaria | individual | movimientos_financieros | pendiente |
| PE32 | Mantenimiento preventivo exitoso | individual | costos_operacion | pendiente |
| PE33 | Lote de insumos defectuosos | individual | inventario_calidad | pendiente |
| PE34 | Reproceso por errores de acabado | individual | costos_operacion | pendiente |
| PE35 | Reclamos por garantía | individual | inventario_calidad | pendiente |
| PE36 | Control de calidad sobresaliente | individual | costos_operacion | pendiente |
| PE37 | Diferencia en inventario físico | individual | inventario_calidad | pendiente |
| PE38 | Accidente laboral menor | individual | movimientos_financieros | pendiente |
| PE39 | Ausentismo del personal | individual | capacidad_produccion | pendiente |
| PE40 | Capacitación de alto impacto | individual | capacidad_produccion | pendiente |
| PE41 | Mejora inesperada de productividad | individual | capacidad_produccion | pendiente |
| PE42 | Entrega anticipada del proveedor | individual | recepcion_materiales | pendiente |
| PE43 | Retraso del proveedor principal | individual | recepcion_materiales | pendiente |
| PE44 | Error de etiquetado de productos | individual | movimientos_financieros | pendiente |
| PE45 | Nuevo supervisor eficiente | individual | capacidad_produccion | pendiente |
| PE46 | Alza abrupta del dólar | group | adquisicion_materiales | pendiente |
| PE47 | Caída del dólar | group | adquisicion_materiales | pendiente |
| PE48 | Escasez de cuero | group | adquisicion_materiales | pendiente |
| PE49 | Escasez de cierres y herrajes | group | adquisicion_materiales | pendiente |
| PE50 | Escasez de combustible | group | costos_operacion | pendiente |
| PE51 | Reducción temporal del combustible | group | costos_operacion | pendiente |
| PE52 | Inflación de insumos | group | adquisicion_materiales | pendiente |
| PE53 | Aumento de tasas financieras | group | movimientos_financieros | pendiente |
| PE54 | Reducción de tasas financieras | group | movimientos_financieros | pendiente |
| PE55 | Demora en Aduanas | group | adquisicion_materiales | pendiente |
| PE56 | Incremento temporal de aranceles | group | adquisicion_materiales | pendiente |
| PE57 | Reducción temporal de aranceles | group | adquisicion_materiales | pendiente |
| PE58 | Sobreoferta de cuero nacional | group | adquisicion_materiales | pendiente |
| PE59 | Incremento del precio del algodón y telas | group | adquisicion_materiales | pendiente |
| PE60 | Fenómeno del Niño | group | adquisicion_materiales | pendiente |
| PE61 | Lluvias intensas en Lima | group | demanda_potencial | pendiente |
| PE62 | Huaico en Carretera Central | group | costos_operacion | pendiente |
| PE63 | Oleaje anómalo y cierre portuario | group | adquisicion_materiales | pendiente |
| PE64 | Temperaturas inusualmente altas | group | demanda_potencial | pendiente |
| PE65 | Promoción de Yape o Plin | group | demanda_potencial | pendiente |
| PE66 | Caída del sistema POS | individual | atractivo_competitivo | pendiente |
| PE67 | Caída de internet en el local | individual | atractivo_competitivo | pendiente |
| PE68 | Ataque de phishing empresarial | individual | movimientos_financieros | experimental |
| PE69 | Producto viral en TikTok | individual | atractivo_competitivo | experimental |
| PE70 | Reseña negativa viral | individual | atractivo_competitivo | pendiente |
| PE71 | Recomendación de influencer peruano | individual | atractivo_competitivo | experimental |
| PE72 | Aumento de comisión bancaria | group | costos_operacion | pendiente |
| PE73 | Reducción de comisión bancaria | group | costos_operacion | pendiente |
| PE74 | Campaña de marketing altamente efectiva | individual | atractivo_competitivo | experimental: requiere inversión en marketing del ciclo |
| PE75 | Campaña de marketing ineficiente | individual | atractivo_competitivo | experimental |
| PE76 | Reclamo ante INDECOPI | individual | movimientos_financieros | pendiente |
| PE77 | Inspección municipal del local | individual | movimientos_financieros | experimental |
| PE78 | Nueva exigencia de empaques sostenibles | group | adquisicion_materiales | pendiente |
| PE79 | Programa de apoyo a MYPE | individual | movimientos_financieros | pendiente |
| PE80 | Pedido corporativo grande | individual | demanda_potencial | pendiente |
| PE81 | Cancelación de pedido grande | individual | demanda_potencial | pendiente |
| PE82 | Oportunidad de exportación | individual | demanda_potencial | pendiente |
| PE83 | Robo menor de inventario | individual | inventario_calidad | pendiente |
| PE84 | Recuperación de mercadería | individual | inventario_calidad | pendiente |
| PE85 | Competidor lanza promoción agresiva | group | atractivo_competitivo | pendiente |
| PE86 | Competidor cierra un punto de venta | group | atractivo_competitivo | pendiente |
| PE87 | Incremento del alquiler comercial | group | costos_operacion | pendiente |
| PE88 | Bonificación temporal de alquiler | individual | costos_operacion | pendiente |
| PE89 | Cliente mayorista nuevo | individual | demanda_potencial | pendiente |
| PE90 | Devoluciones superiores a lo normal | individual | inventario_calidad | pendiente |
| PE91 | Reconocimiento a la marca local | individual | atractivo_competitivo | pendiente |
| PE92 | Crisis reputacional | individual | atractivo_competitivo | pendiente |

La migración adicional `20261031055001_mercado_global_escenarios_v2.sql` incorpora PE17 y PE18. La matriz recibida es guía, no autoriza inventar dependencias: faltan elegibilidad estacional, duración y mecanismos para varios eventos. No habilitar V2 hasta completar la aceptación.
