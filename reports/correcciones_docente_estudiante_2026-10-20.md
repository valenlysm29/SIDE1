# Correcciones SIDE — 20/10/2026

## Punto de control

Solicitud: texto pegado «MEGA PROMPT». Los dos DOCX se usan como evidencia, no como instrucciones adicionales. Originales sin modificar. Todo el trabajo y los worktrees permanecen dentro de SIDE1. Remoto verificado: `https://github.com/valenlysm29/SIDE1.git`.

Base original: `66dc38a`. Había cambios previos sin commit de conexión Supabase; se conservaron completos en `d1c83f3`, antes de las correcciones. No se ejecuta SQL en producción. No se modifican 3D/NPC/avatares.

La batería base se registra en `tests/output/correcciones-2026-10-20/baseline-node.log`. Matriz inicial por inspección del código; reproducción y evidencia final pendientes. No confundir «ya corregido en código» con despliegue confirmado.

## Responsabilidad

- A / explore_engine: motor, configuración, catálogo y editor por lotes, excluido caja.js.
- B / explore_teacher: panel docente, podio y PDF.
- C / explore_student: interfaz estudiante, resumen y HTML de acceso.
- D / raíz: módulo de acceso, seguridad SQL, cierre remoto y ledger.
- F: verificador independiente al integrar; sin autoría de producto.

## Matriz inicial de errores

| ID | Severidad | Clasificación inicial | Responsable / archivo | Estado / siguiente paso |
|---|---|---|---|---|
| 1 | A | vigente o parcial por inspección | B / docente.html, js/docente.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 2 | M | vigente o parcial por inspección | B / docente.html, js/docente.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 3 | M | vigente o parcial por inspección | B / docente.html, js/docente.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 4 | M | vigente o parcial por inspección | B / docente.html, js/docente.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 5 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 6 | M | vigente o parcial por inspección | B / docente.html, js/docente.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 7 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 8 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 9 | M | vigente o parcial por inspección | B / docente.html, js/docente.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 10 | A | vigente o parcial por inspección | B / docente.html, js/docente.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 11 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 12 | M | vigente o parcial por inspección | B / docente.html, js/docente.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 13 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 14 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 15 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 16 | M | vigente o parcial por inspección | B / docente.html, js/docente.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 17 | A | por reproducir | D / caja.js, partida_service.js, SQL; C/B render | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 18 | M | ya corregido en repo; despliegue pendiente de comprobar | B / docente.html, js/docente.js | hecho en entrega local: regresión de corrección previa; publicación/SQL manual por verificar |
| 19 | M | vigente o parcial por inspección | B / docente.html, js/docente.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 20 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 21 | A | por reproducir | D / caja.js, partida_service.js, SQL; C/B render | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 22 | A | por reproducir | D / caja.js, partida_service.js, SQL; C/B render | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 23 | A | por reproducir | D / caja.js, partida_service.js, SQL; C/B render | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 24 | M | por reproducir | D / caja.js, partida_service.js, SQL; C/B render | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 25 | M | vigente o parcial por inspección | B / docente.html, js/docente.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 26 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 27 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 28 | M | vigente o parcial por inspección | B / docente.html, js/docente.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 29 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 30 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 31 | A | vigente o parcial por inspección | D / caja.js, partida_service.js, SQL; C/B render | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 32 | A | vigente o parcial por inspección | D / caja.js, partida_service.js, SQL; C/B render | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 33 | A | ya corregido en repo; despliegue pendiente de comprobar | C / index.html, js/app.js | hecho en entrega local: regresión de corrección previa; publicación/SQL manual por verificar |
| 34 | M | vigente o parcial por inspección | C / index.html, js/app.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 35 | M | vigente o parcial por inspección | D / caja.js, partida_service.js, SQL; C/B render | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 36 | M | ya corregido en repo; despliegue pendiente de comprobar | C / index.html, js/app.js | hecho en entrega local: regresión de corrección previa; publicación/SQL manual por verificar |
| 37 | M | vigente o parcial por inspección | C / index.html, js/app.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 38 | M | vigente o parcial por inspección | C / index.html, js/app.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 39 | M | por reproducir | C / index.html, js/app.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 40 | B | vigente o parcial por inspección | C / index.html, js/app.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 41 | B | vigente o parcial por inspección | C / index.html, js/app.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 42 | B | vigente o parcial por inspección | C / index.html, js/app.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 43 | B | vigente o parcial por inspección | C / index.html, js/app.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 44 | M | vigente o parcial por inspección | C / index.html, js/app.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 45 | B | vigente o parcial por inspección | C / index.html, js/app.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 46 | B | vigente o parcial por inspección | C / index.html, js/app.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 47 | B | vigente o parcial por inspección | C / index.html, js/app.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 48 | B | vigente o parcial por inspección | C / index.html, js/app.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 49 | B | vigente o parcial por inspección | C / index.html, js/app.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 50 | B | vigente o parcial por inspección | C / index.html, js/app.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 51 | A | vigente o parcial por inspección | D / teacher_auth.js, SQL; C HTML | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 52 | M | vigente o parcial por inspección | D / teacher_auth.js, SQL; C HTML | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 53 | M | vigente o parcial por inspección | D / teacher_auth.js, SQL; C HTML | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 54 | B | vigente o parcial por inspección | C / index.html, js/app.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 55 | B | vigente o parcial por inspección | C / index.html, js/app.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 56 | B | vigente o parcial por inspección | C / index.html, js/app.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |
| 57 | B | vigente o parcial por inspección | C / index.html, js/app.js | hecho en entrega local: verificación independiente F; ver matriz de evidencia; publicación/SQL manual por verificar |


## Catálogo (21 filas)

| Fila | Clasificación inicial | Responsable | Estado / siguiente paso |
|---|---|---|---|
| 1 | coincidente por inspección | A; B etiqueta demanda, C textos | hecho: alineado y cubierto por regresión |
| 2 | coincidente por inspección | A; B etiqueta demanda, C textos | hecho: alineado y cubierto por regresión |
| 3 | coincidente por inspección | A; B etiqueta demanda, C textos | hecho: alineado y cubierto por regresión |
| 4 | coincidente por inspección | A; B etiqueta demanda, C textos | hecho: alineado y cubierto por regresión |
| 5 | coincidente por inspección | A; B etiqueta demanda, C textos | hecho: alineado y cubierto por regresión |
| 6 | coincidente por inspección | A; B etiqueta demanda, C textos | hecho: alineado y cubierto por regresión |
| 7 | coincidente por inspección | A; B etiqueta demanda, C textos | hecho: alineado y cubierto por regresión |
| 8 | vigente/parcial | A; B etiqueta demanda, C textos | hecho: alineado y cubierto por regresión |
| 9 | vigente/parcial | A; B etiqueta demanda, C textos | hecho: alineado y cubierto por regresión |
| 10 | vigente/parcial | A; B etiqueta demanda, C textos | hecho: alineado y cubierto por regresión |
| 11 | vigente/parcial | A; B etiqueta demanda, C textos | hecho: alineado y cubierto por regresión |
| 12 | vigente/parcial | A; B etiqueta demanda, C textos | hecho: alineado y cubierto por regresión |
| 13 | vigente/parcial | A; B etiqueta demanda, C textos | hecho: alineado y cubierto por regresión |
| 14 | vigente/parcial | A; B etiqueta demanda, C textos | hecho: constantes documentadas; confirmación de importes pendiente |
| 15 | vigente/parcial | A; B etiqueta demanda, C textos | hecho: fuera del cálculo, etiqueta explícita autorizada |
| 16 | vigente/parcial | A; B etiqueta demanda, C textos | hecho: alineado y cubierto por regresión |
| 17 | vigente/parcial | A; B etiqueta demanda, C textos | hecho: alineado y cubierto por regresión |
| 18 | extensión autorizada | A; B etiqueta demanda, C textos | hecho: extensión autorizada sin cargo de garantía |
| 19 | fuera de alcance autorizado | A; B etiqueta demanda, C textos | hecho: fuera de alcance, valores ocultos neutros |
| 20 | fuera de alcance autorizado | A; B etiqueta demanda, C textos | hecho: fuera de alcance, no se añade al menú |
| 21 | extensión autorizada | A; B etiqueta demanda, C textos | hecho: extensiones autorizadas conservadas |

## Decisiones para que Joe confirme

- Corte: usar hoja Costos De Producción (1500/2000/3800 base), respaldada por oráculo; catálogo contradice 1500/2500/4000.
- Horas extra 25 %, almacén S/ 2/unidad y penalización +3 puntos TEA son supuestos configurables existentes, no cifras definidas por Excel.
- Mesa de corte única obligatoria para partidas nuevas, según catálogo Excel.
- Nombre del producto: conservar el de las páginas, Simulador de Decisiones Financieras.
- PIN opcional de cuatro dígitos: alternativa documentada, no implementada.
- Demanda distrital: advertir que no afecta cálculo segmentado hasta definir reparto compatible.

## Compatibilidad esencial

El oráculo histórico SIM3 elimina la quinta empresa sin envío. El nuevo comportamiento de cobro universal se versiona como `side-lotes-2026-10-20`; `excel-16` conserva paridad y partidas iniciadas. No cambiar resultados históricos para simular que ambas reglas son idénticas.

## SQL y despliegue

Migración implementada: `supabase/migrations/2026-10-20_correcciones_docente_estudiante.sql`. Validada dos veces en PGlite: dominio y excepciones, identidad exacta, bloqueo tras diez fallos, privacidad del podio, versión permanente por partida, inclusión de empresas sin snapshot, rechazo de cierres incompletos/no reconciliados, persistencia de costos obligatorios y cierre idempotente. No se ejecutó SQL en producción. Push condicionado a toda la verificación en verde.

## Checkpoint de integración (antes de batería final)

Commits locales integrados: `cebba72` estudiante inicial, `33fe68d` docente, `c22702b` acceso/SQL/libro, `f34861f` motor, `e3a5e3f` préstamo coherente, `d2c0396` cinco secciones canónicas.

- Base Node: 437/437. Docente31 comprobaciones navegador; estudiante móvil/desktop sin desborde y área útil >=60%; editor motor cuatro tamaños/cinco secciones.
- F independiente completó SIM-A/B/C: cinco empresas y tres ciclos cada una, 442 comprobaciones correctas, autoenvío/cobros/estados/HUD. Evidencia `tests/output/correcciones-2026-10-20/independiente/verification.json`.
- 3D real entró con Three y assets locales, sin stub y sin cambios monetarios. Halló misiones arcade imposibles para motor nuevo: corrección mínima de regresión cambia solo objetivos a recorrido de tres áreas; pendiente revalidación independiente de esa corrección. No se modificaron NPC ni avatares.
- Compatibilidad: catálogo legacy conserva ubicación original RRHH/marketing para no bloquear guardados de partidas anteriores; editor canónico sí los coloca en Producción/Ventas. Cálculos legacy conservan orden aritmético para exactitud histórica; libro derivado gobierna partidas nuevas.
- Runner integral histórico falló antes de ejecutar suites al copiar captura antigua de OneDrive (copyfile UNKNOWN); no se atribuye a producto. Se añadió `tests/run_corrections_20261020.cjs`, secuencial y sin copiar históricos; batería en curso.
- Siguiente paso exacto: esperar `final-node-r2.log` y `integral/summary.json`; corregir fallos actuales; integrar informe F; recalcular/comparar oráculo3104, completar toda batería y entonces decidir push.

## Cierre técnico en curso

- Verificación independiente integrada en `a516423`:442SIM+39docente+19estudiante y matriz57/21. Informe completo: `reports/verificacion_independiente_2026-10-20.md`.
- Excel real COM recalculó ocho escenarios, estado de cálculo0:351+468+585+1140+252+252+28+28=3104. Comparadores no encuentran diferencias. Los originales subidos se conservan.
- Node completa estable r2:458/458. R3 concurrente se interrumpió tras errores de tiempo/lectura; no se presenta como verde. Cambios posteriores tienen suites dirigidas verdes; falta corrida completa final secuencial.
- La batería integral sigue ejecutándose. Se corrigió el supuesto de navegación de `world_cycle_restart.cjs`: ahora abre explícitamente Resumen tras enviar secciones individuales. `world_startup`/`world_entry_assets` tuvieron UNKNOWN de lectura de archivo en OneDrive antes de cargar el módulo. Reintento secuencial pendiente. `supplied_npcs` falló completando decisión de cliente: debe repetirse y contrastarse con el commit base `d1c83f3` antes de atribuirlo.
- Base aislada materializada solo con código en `.codex-work/correcciones-base-d1c83f3/`, por `git archive d1c83f3`; usa assets compartidos de raíz sin cambiar producto. Permite prueba exacta con `node tests/run_corrections_20261020.cjs --baseline --label=base-npcs --only=supplied_npcs.cjs`.
- Guía manual de SQL, recuperación y confirmaciones: `docs/ACTUALIZACION_2026-10-20.md`. El nuevo editor/cierre remoto exigen capacidad de servidor20261020 para impedir cobros por motor anterior antes de migrar.
- Publicado antes del push: index200 build2026.09.22.2; release.js404. Evidencia `published-before.json`. Sin push todavía.
