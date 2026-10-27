# Chequeo general de ventas y unidades vendidas — 27/10/2026

Alcance: motor económico compartido, planes anteriores, producción, precios internos,
cierre, persistencia, reconexión y resultados visibles. Se verificaron varias empresas,
los tres segmentos y tres ciclos. No se modificaron el código de decisiones, el
catálogo, sus opciones ni sus controles. Los cambios HTML solo actualizan la versión
de los tres scripts del motor para evitar caché anterior.

## Fallos reproducidos

| Fallo | Evidencia anterior | Corrección |
| --- | --- | --- |
| Matrices antiguas de personal vacías, parciales o dirigidas a máquinas ausentes | Un plan físicamente viable pasaba de 90 producidas/vendidas a cero | Asignar internamente el personal restante al mejor tipo de máquina disponible. Conservar matrices completas válidas y exigir equipos y personal reales |
| Precios ocultos antiguos vacíos, negativos o no numéricos | El cierre lanzaba `RangeError`; la proyección devolvía `null` y otra empresa podía bloquear el cálculo compartido | Resolver valores inválidos con los precios internos predeterminados; conservar valores válidos y validar estrictamente sobrescrituras explícitas del motor |
| Snapshot financiero preliminar sin recibo definitivo | Recibo: 90 unidades/S/3825; estado financiero: ingresos cero | Descartar únicamente la fotografía del ciclo abierto al calcular su primer cierre. Conservar cierres históricos e idempotencia |
| Persistencia SQL daba prioridad a la fotografía anterior | PostgreSQL guardaba un recibo de 90 vendidas, pero al reconectar recuperaba ingresos cero | La fotografía definitiva del ciclo cerrado prevalece en la mezcla JSON; los demás períodos permanecen intactos |
| Validador SQL con rangos del motor anterior | Rechazo de S/100 para el segmento medio, aunque es el precio interno actual | Alinear la validación SQL con la configuración actual: importes numéricos no negativos |

La consulta remota de solo lectura confirmó HTTP 200/`false` para los precios
42.5/100/250 y HTTP 200/`true` para precios implícitos. La cola actual ya omite los
predeterminados para compatibilidad; el parche SQL elimina también la discrepancia
para precios explícitos válidos. No se escribió ni cerró una partida real.

## Resultados comprobados

PostgreSQL local desechable, con las RPC y el servicio reales: cuatro empresas,
tres ciclos, 12 cierres por empresa/ciclo. Cada empresa produjo y vendió 90 unidades
en cada ciclo. Se verificaron caja, inventarios, reportes, recibos, fotografías
definitivas, recuperación tras reconexión y reintentos sin duplicación.

| Plan | Unidades vendidas por ciclo | Ingreso por ciclo |
| --- | ---: | ---: |
| Básico | 90 | S/3825 |
| Medio | 90 | S/9000 |
| Premium | 90 | S/22500 |
| Mixto: 30 de cada segmento | 90 | S/11775 |

Las pruebas negativas mantienen ventas cero si faltan insumos, trabajadores,
máquinas o canal. Vender nunca supera el stock disponible. El ejemplo del documento
conserva su producción de 368 unidades y sus ingresos de S/42300.

Chromium: cinco confirmaciones mediante los botones existentes por cada segmento,
plan anterior recuperado, ventas estimadas y definitivas visibles, recarga del estado,
ninguna modificación de caja al proyectar y ningún error de página. La prueba
existente de controles también conserva su envío completo y sus cinco envíos
individuales. Se actualizaron dobles de prueba obsoletos, sin cambiar código de interfaz.

Evidencias locales en `tests/output/`:

- `sales-general-regression.log`: 77/77 verificaciones del motor, documento y contratos.
- `sales-integration-regression.log`: 44/44 verificaciones contables, sincronización y sesión.
- `sales-recovery-db.log` y `sales-recovery-db.json`: reproducción SQL anterior y matriz corregida.
- `sales-v19-db.log`: recuperación de planes, autorización, revisiones e idempotencia.
- `sales-recovery-ui/result.json` y capturas: los tres segmentos en Chromium.
- `sales-controls-ui.log`: controles y confirmaciones existentes.
- `sales-server-diagnostic.json`: consulta remota sin escrituras.

## Aplicación en Supabase

El código local está corregido. La base remota conserva el validador anterior;
no hay conexión administrativa a Supabase disponible en esta sesión. Aplicar
`supabase/migrations/20261027_corregir_ventas_generales.sql` sobre una instalación
v19 existente. El paquete completo `docs/sql/20261023_despliegue_cierre_v19.sql`
también incorpora el parche como sexto bloque. La migración pasó dos aplicaciones
consecutivas en PostgreSQL local y no modifica catálogo, decisiones ni cierres previos.

Los cierres históricos ya guardados no se recalculan automáticamente. Antes del
cierre se siguen mostrando estimaciones; las ventas definitivas requieren el cierre
compartido del docente. Se conserva la limitación documentada del ejecutor económico:
si el navegador docente está cerrado, los cierres pendientes se recuperan al reconectarlo.
