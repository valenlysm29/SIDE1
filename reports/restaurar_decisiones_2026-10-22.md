# Restaurar Decisiones del estudiante — 22 de octubre de 2026

## Estado de continuación

Arqueología cerrada; implementación UI/motor/flujo y QA en curso. HEAD inicial `65d195b`, remoto verificado `https://github.com/valenlysm29/SIDE1.git`. Todo el trabajo se mantiene dentro de SIDE1. No se ha ejecutado SQL ni se afirma todavía que las nuevas verificaciones estén aprobadas. La captura mencionada por el usuario no llegó adjunta en este turno: se toma como contrato su descripción escrita y el diseño localizado en Git.

Leídos AGENTS.md, informes de integración/paridad Excel, auditoría de decisiones del 11/10, mejora integral 01/10, correcciones docente/estudiante 20/10 y documentación del sistema de diseño. Las skills frontend-design/webapp-testing están en `.agents/skills/`; los implementadores y QA aplican sus instrucciones antes de editar/probar.

## Qué se perdió y causa comprobada

Referencia buena: **9fbe6ec** (11/10/2026 09:50 Lima), último commit antes de la integración Excel `03791af`. `git show 9fbe6ec:js/app.js` confirma `renderDecisionRow`: tarjetas por decisión, estados opcional/obligatoria, radios HTML reales, precios/descripciones, stepper de cantidades y leyenda «Botón de opción: solo puedes seleccionar una alternativa». `index.html` conserva barra superior, pestañas, encabezado SECCIÓN DE DECISIÓN y SALDO FINAL GUARDADO. No se debe restaurar el motor antiguo: solo recuperar la interacción y jerarquía sobre los contratos canónicos actuales.

En `03791af` se añadió el editor de lotes, `css/excel.css` y `js/engine/ui_excel.js`. Las continuaciones posteriores ocultaron las tarjetas originales al habilitar lotes para evitar doble cargo: otras pestañas remitían a Producción. `d2c0396` distribuyó el editor Excel entre secciones para partidas canónicas, pero mantuvo selects, detalles y tablas. `b4ab7b2`/`65d195b` repararon accesibilidad/edición y la disponibilidad al comprobar conexión; no restauraron la presentación anterior. En HEAD inicial, `renderDecisionCategory()` construye las tarjetas originales y enseguida vacía `decisionCards.innerHTML` cuando `__excel.habilitado`; monta el editor Excel en su lugar. Ésa es la causa inmediata del aspecto distinto: el catálogo legado sigue intacto, pero su render no llega al estudiante de esas partidas.

Se ejecutaron búsquedas solicitadas `git log -S 'Botón de opción: solo puedes seleccionar'`, `-S 'Inversiones y finanzas'` y `--follow` para app, catálogo y CSS. Los recorridos completos de historia siguen lentos en esta copia OneDrive; no se atribuye un resultado vacío a inexistencia. La inspección por `git show` y los últimos 25 cambios de app prueban la referencia y la cadena causal. Seguimiento reciente del catálogo: 34b9b7e, 988e926, f34861f, 03791af, 7b06e34; CSS estudiante: cebba72, f34ea77, 5a2da67. `css/styles.css`: 80aff74, e9b6b92, d07639a, f05350c, 7b06e34.

## Catálogo congelado y matriz de restauración

Hay **68 filas internas Excel**, no 68 nuevas decisiones del estudiante. `js/decision_catalog.js` define 25 entradas, tres informativas, cinco categorías editables más Resumen. La nueva distribución solicitada tiene Empresa, Infraestructura, Producción, Ventas y Finanzas; Logística se integra en Producción sin perder compras/analista/garantía de proveedores. La auditoría del 11/10 fija opciones autorizadas: no añadir depreciación, inventarios, proveedor único, condiciones de pago ni lead time como decisiones nuevas.

La columna «cómo está» describe exclusivamente HEAD inicial 65d195b, antes de esta restauración.

| Segmento objetivo | Decisión | Cómo era | Cómo está | Causa | Arreglo previsto |
|---|---|---|---|---|---|
| Empresa | Capacitación INV_RRHH | Tarjetas no/baja/media/alta S/0/1000/6000/12000 | Select en Producción (grupo RR.HH.) | Editor Excel sustituyó radios | Radios en Empresa, mismo código INV-01A/B/C y ausencia=0 |
| Empresa | Marketing INV_MARKETING | Tarjetas baja/media/alta S/1500/6000/12000, opcional | Select en Ventas | Redistribución técnica | Un solo control con tarjetas, sin publicidad libre duplicada |
| Infraestructura | MESA_CORTE | Cantidad mesa S/2500 | Número entre activos | Formulario genérico | Cantidad visible; conservar única mesa obligatoria del modelo actual |
| Infraestructura | ENSAMBLE | Cantidades básica/semi/industrial S/3500/7500/15000 | Selector de aporte + números de activos | Separación Motor/capacidad | Tarjetas y cantidad sin compras duplicadas |
| Infraestructura | ACABADOS | Cantidades básica/semi/industrial S/1200/4500/9500 | Selector de aporte + números de activos | Separación Motor/capacidad | Tarjetas y cantidad preservando aportes |
| Infraestructura | MOLDE | Radios básico/mejorado/premium S/300/1200/3500 | Selector y número de activos/lotes | Integración lotes | Elección explicada y cantidades existentes; no cobrar dos veces |
| Infraestructura | LOCAL_PROD | Tarjeta obligatoria S/2000 | Costo obligatorio calculado | Motor de costos | Tarjeta informativa obligatoria, sin nueva decisión |
| Infraestructura | MANTENIMIENTO | Preventivo opcional S/200 | Checkbox | Sustitución presentación | Tarjeta con elección opcional, mismo costo |
| Producción | PRODUCCION_META | Cantidad directa por molde con stepper | Cantidad por lote, hasta 3 lotes | Contrato Excel | Control directo claro, conservando lotes, segmentos, precio y materiales autorizados |
| Producción | PERS_CORTE | Cantidades por nivel | Matriz nivel/máquina y selector de aporte | Contrato capacidad/Motor | Controles claros conservando matriz; corte solo manual |
| Producción | PERS_ENSAMBLE | Cantidades por nivel | Matriz y selector | Contrato capacidad/Motor | Controles claros sin perder matriz |
| Producción | PERS_ACABADO | Cantidades por nivel | Matriz y selector | Contrato capacidad/Motor | Controles claros sin perder matriz |
| Producción | JEFATURA | No/contratar S/3000 | Select | Editor genérico | Radio no/contratar, costos laborales del motor actual |
| Producción | LIMPIEZA | Costo obligatorio S/600 base | Texto y costo laboral calculado | Motor Costos | Tarjeta obligatoria; mantener beneficios y régimen MYPE/No MYPE |
| Producción | GARANTIA_PT | Radios 30/90/180 días sin caja | Select 30/90/180 | Editor genérico | Radios, sin crear opción sin garantía ni cargo |
| Producción | ANALISTA_COMPRAS | No/contratar S/5000 por ciclo | Checkbox en Logística | Separación técnica | Radio explícito; descuento 12%,10%,… mínimo2% |
| Producción | CUERO | Cantidades sintético/estándar/premium 25/45/80 | Números de compras, selección por lote | Conversión unidades Excel | Cantidades visibles con presentación/rendimiento y costo real |
| Producción | ACCESORIOS | Cantidades económico/premium 4/9 | Números compras y selección por lote | Conversión unidades Excel | Cantidad visible, solo dos calidades |
| Producción | HILO | Cantidades estándar/reforzado/tenacidad 2/4/7 | Números compras y selección por lote | Conversión unidades Excel | Cantidad visible, conversión carretes conservada |
| Producción | GARANTIA_PROV | Radios sin/80%/100% devolución | Select | Editor genérico | Radios conservando elección, sin inventar evento de falla |
| Ventas | CANALES | Web S/500 y tiendas por distrito S/1800/3500/2200 | Select canal + tres cantidades | Motor y contrato distrito | Canal con distrito/cantidades claros; contratos 12 ciclos actuales |
| Ventas | PERSONAL_VENTAS | Información vendedor automático, comisión1% | Regla calculada | No es elección | Mostrar regla; no inventar control |
| Ventas | CREDITO_VENTAS | Porcentaje automático, sin control | Regla automática | No es elección | Mantener información y cálculo, sin selector |
| Ventas | DEVOLUCIONES | Nota automática sobre producto fallado | Regla/evento | No es elección | Mantener nota |
| Finanzas | PRESTAMO | Importe con slider/número, TEA docente | Importe + select acceso bancario | Unificación parcial anterior | Un control coherente, TEA fija, línea disponible e importe claros |

Los sueldos de corte del motor literal son 1500/2000/3800; el catálogo legado conserva 1500/2500/4000 como referencia. No cambiar las fórmulas del oráculo para igualar etiquetas antiguas. La capacitación pertenece a INV_RRHH; la capacitación de instalación de activos es otro componente del costo Excel y no una decisión nueva. Garantía proveedor no tiene evento de devolución definido por el libro; restaurar el selector no autoriza inventarlo.

## Implementación y pruebas — por completar

- UI: pendiente de cierre y capturas escritorio/móvil.
- Motor/guardado por ítem/conexión: pendiente de cierre.
- Flujo sala/Tablet/ciclos automáticos/enviar: pendiente de revisión.
- QA independiente: pendiente Node, 3104 comparaciones del oráculo, SIM-1/2/3 y SIM-A/B/C, recorrido completo 3 ciclos y pruebas de cobertura de catálogo.
- No considerar los 490 tests informados en el turno anterior como validación de esta nueva restauración.
- Excepción histórica documentada: supplied_npcs.cjs «customers complete a decision» fue reproducida en d1c83f3 según reports/correcciones_docente_estudiante_2026-10-20.md. Si reaparece, comprobar evidencia actual antes de atribuirla como preexistente.

## SQL y publicación — por completar

Restauración prevista en presentación y persistencia existente; no hay necesidad de SQL nueva identificada en arqueología. La migración 2026-10-20_correcciones_docente_estudiante.sql es antecedente independiente, no SQL de esta restauración. Confirmar al cierre del diff. No ejecutar SQL en producción. Push a main autorizado por el usuario condicionado a verificación; registrar hashes, resultados exactos y cualquier excepción pendiente aquí.
