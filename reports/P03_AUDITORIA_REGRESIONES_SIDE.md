# P03 — Auditoría de regresiones SIDE

Fecha: 31 de octubre de 2026. Código auditado: `df3e42a91fdcdbead50772d2d11ba08dc67b94da`, rama `codex/p02-diagnostico-materiales`, basada en `main` `b28a471`. La rama remota se creó sin fuerza y `git ls-remote` confirmó el mismo commit. No se hizo merge ni se modificó el código durante esta auditoría.

## Método y resultado general

La lista exacta procede de `docs/reporte_validacion_SIDE_6_ciclos.md` y `reports/publicacion_20261030.md`. El 31 de octubre se ejecutaron los 199 archivos de primer nivel `tests/*.test.js`, `*.test.mjs` y `*.test.cjs` con `node --test --test-concurrency=4`: **953 pruebas, 935 aprobadas, 18 fallidas, 0 omitidas**, registro local `tests/output/p03_suite_df3e42a.log`. La ejecución terminó, pero no es verde ni demuestra funcionamiento integral: dos fallos son imposibilidad de arrancar Docker/PostgreSQL y otros requieren análisis. No incluye todos los scripts auxiliares ni pruebas manuales.

La suite incluye `excel_cache_replay.test.cjs`, que reproduce valores guardados y no recalcula Excel. Por ello, además se ejecutó `node --test --test-concurrency=1 tests/equivalencia_fuente_side.cjs` con Microsoft Excel y el libro local: seis pruebas fallaron, las seis en N5, Excel 386 frente a SIDE 221, antes de evaluar los demás valores (`tests/output/p03_excel_real_df3e42a.log`). Se ejecutaron aparte los seis archivos focales no Excel (`tests/output/p03_historicas_df3e42a.log`); reputación Excel se ejecutó en la suite con Excel. La suite cubre el commit publicado y no se ajustaron aserciones.

## Los 17 fallos históricos

**RESUELTO** significa que la prueba actual aprobó en esta ejecución, no que toda la funcionalidad esté certificada. **PERSISTENTE** significa que la prueba aún falla; puede tratarse de una regla pendiente de acordar o una expectativa desactualizada. La causa se expresa como conocida solo cuando la evidencia la respalda.

| # | Prueba histórica y funcionalidad | Resultado actual y causa conocida o probable | Estado |
|---|---|---|---|
| 1 | `decisions_corrections`: visual DOP handles empty, zero and valid targets and updates from active drafts | Aprobó; el contrato visual cubierto se cumple. | RESUELTO |
| 2 | `equivalencia_fuente_side`: Excel real y producción SIDE: base | Falló N5: 386 vs 221; el Excel permite dos operarios en una mesa, SIDE limita uno por equipo. Contrato de referencia pendiente. | PERSISTENTE |
| 3 | `equivalencia_fuente_side`: Excel real y producción SIDE: meta_cero | Falló N5: 386 vs 221, misma diferencia de capacidad. | PERSISTENTE |
| 4 | `equivalencia_fuente_side`: Excel real y producción SIDE: material_insuficiente | Falló N5: 386 vs 221 antes de verificar insuficiencia. | PERSISTENTE |
| 5 | `equivalencia_fuente_side`: Excel real y producción SIDE: premium | Falló N5: 386 vs 221 antes de verificar premium. | PERSISTENTE |
| 6 | `equivalencia_fuente_side`: Excel real y producción SIDE: capacidad_limitada | Falló N5: 386 vs 221; reglas de pareo distintas. | PERSISTENTE |
| 7 | `equivalencia_fuente_side`: Excel real y SIDE: inventario arrastrado durante tres ciclos | Falló en ciclo 1, N5: 386 vs 221; no alcanzó a validar los tres ciclos. | PERSISTENTE |
| 8 | `legacy_production_targets`: saved numeric production targets use the chosen mold and generate sales in every segment | Aprobó para metas numéricas históricas y ventas en los casos de la prueba. | RESUELTO |
| 9 | `md_logic`: document example: matrix, all N3 efficiency, 30 days and sequential production | Falló corte: 8 frente a 14 esperados; misma discrepancia de un operario por mesa. | PERSISTENTE |
| 10 | `md_logic`: corrected actual consumption gives exact reputation and quality factors | Falló 0 frente a 2.119565217391304; discrepancia de factor de reputación, causa precisa pendiente. | PERSISTENTE |
| 11 | `md_logic`: full closure preserves chosen prices, inventory balances and corrected MP valuation | Falló producción 221 frente a 368 esperados; la prueba se detiene antes de comprobar el resto, probablemente por el contrato de capacidad. | PERSISTENTE |
| 12 | `production_dop`: rendering an empty plan preserves inputs and shows zero output, percent and mold detail | Aprobó en el escenario visual probado. | RESUELTO |
| 13 | `production_dop`: material requirement labels are escaped and coverage is supplied by the model | Aprobó escape y cobertura en el escenario probado. | RESUELTO |
| 14 | `production_dop`: persisted adapter plans render real comparison stock without mutating snapshots | Aprobó representación y conservación de instantánea en la prueba. | RESUELTO |
| 15 | `reputacion_excel_real`: suma comercial real de Excel y conversión de escala para demanda | Falló 0 frente a 2.119565217391304 con Excel ejecutado; diferencia en factor comercial, causa precisa pendiente. | PERSISTENTE |
| 16 | `revenue_excel_current`: catalog reputation is unique, bounded and independent from advertising spend proxy | Falló aserción de reputación esperada; revisar contrato de puntuación, causa aún no aislada. | PERSISTENTE |
| 17 | `sales_projection`: the final shared market replaces the individual reference and cannot sell stock twice | Falló 162 frente a 3500 en la primera aserción; probablemente el límite físico del fixture, sin prueba suficiente para atribuir la causa definitiva. | PERSISTENTE |

**Total: 5 RESUELTOS, 12 PERSISTENTES, 0 NO VERIFICADOS.** Los seis casos Excel sí se ejecutaron, pero su primer fallo impide verificar las demás aserciones de esos casos; el número de persistentes no implica 12 defectos independientes de producción.

## Fallos adicionales de la suite

Cuatro pruebas DOP no figuran entre los 17 históricos: `dop_resource_planning.test.cjs` falla en «la meta sin recursos…», «prémium, metas grandes…» y «DOP compares recommended…»; `production_dop_target_ui.test.js` falla en «3000 básicos…». Las aserciones esperan texto o estructura distintos de la presentación actual. Reejecutadas en copia aislada de `main` `b28a471` también dieron **4 fallos de 9** (`tests/output/p03_dop_main.log`), por lo que no se atribuyen a P0.2. Hay que decidir si reflejan regresión visual o expectativas obsoletas; no se ha validado la intención de diseño.

Las pruebas `evento_autoritativo_postgres.test.cjs` («dos conexiones serializan asignaciones…») y `side_cierre_concurrente_pg.test.cjs` («dos workers cierran PE30…») fallaron al iniciar el contenedor porque Docker Desktop no tiene el motor disponible. Son **no verificadas por entorno**, no defectos de concurrencia demostrados. Se necesitan Docker y PostgreSQL real para repetirlas. Junto con las 12 pruebas históricas persistentes explican las 18 fallas informadas por el ejecutor; las seis Excel en la suite usan replay y fueron repetidas con Excel real por separado.

## Prioridades y siguiente etapa

1. **Integridad de cierres, producción e inventarios en los tres modos:** establecer un contrato versionado y consensuado para capacidad por trabajador/equipo, comparar contra un oráculo con recursos equivalentes y extenderlo a arrastre de 3 y 6 ciclos. La discrepancia de 386/221 bloquea la lectura de los casos Excel posteriores; no autoriza cambiar la regla económica por suposición.
2. **Reputación, mercado y finanzas de los tres modos:** aislar los factores 0 vs 2.119565, la escala de reputación y el fixture de mercado 162 vs 3500; verificar repercusiones en demanda, ventas, inventario y estados financieros antes de proponer cambios.
3. **Concurrencia y claridad de planificación:** habilitar PostgreSQL real y repetir las dos carreras de eventos y cierre; revisar los cuatro contratos visuales DOP sobre `main`, separando fallos de producto de textos esperados antiguos. No se demostraron efectos específicos distintos entre los tres modos por estos fallos.

**Siguiente tarea concreta:** documentar y acordar el contrato versionado de capacidad y construir una comparación reproducible con la misma cantidad de trabajadores y equipos en Excel y SIDE, incluyendo una partida con arrastre de inventario; después resolver discrepancias efectivas y volver a ejecutar los casos bloqueados. No modificar reglas o controles hasta establecer la decisión correspondiente.
