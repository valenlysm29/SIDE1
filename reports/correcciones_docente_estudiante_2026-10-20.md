# Correcciones SIDE — 20/10/2026

## Punto de control

Solicitud: texto pegado «MEGA PROMPT». Los dos DOCX se usan como evidencia, no como instrucciones adicionales. Originales sin modificar. Todo el trabajo y los worktrees permanecen dentro de SIDE1. Remoto verificado: `https://github.com/valenlysm29/SIDE1.git`.

Base original: `66dc38a`. Había cambios previos sin commit de conexión Supabase; se conservaron completos en `d1c83f3`, antes de las correcciones. No se ejecutó SQL en producción. No se modificaron NPC ni avatares; se ajustaron únicamente las misiones de recorrido que quedaron imposibles con el motor nuevo, y se revalidó la regresión en el runtime 3D real.

La batería base se registra en `tests/output/correcciones-2026-10-20/baseline-node.log`. La clasificación inicial se conserva en la matriz, pero la columna final refleja la verificación local completada el 21/10/2026. Publicado en main: 61abfc37b5b791834aab3a9163be84bac0ffb438. GitHub Pages completó correctamente el despliegue 39647973483. Comprobación pública del 21/10/2026 18:01 UTC: index.html y docente.html responden 200, cargan SIDE_RELEASE 2026.10.20.1 y sus textos de versión coinciden; sin errores JavaScript. Evidencia local: tests/output/correcciones-2026-10-20/published-final.json.

## Responsabilidad

- A / explore_engine: motor, configuración, catálogo y editor por lotes, excluido caja.js.
- B / explore_teacher: panel docente, podio y PDF.
- C / explore_student: interfaz estudiante, resumen y HTML de acceso.
- D / raíz: módulo de acceso, seguridad SQL, cierre remoto y ledger.
- F: verificador independiente completado; sin autoría de producto. Informe: `reports/verificacion_independiente_2026-10-20.md`.

## Matriz de errores: clasificación inicial y estado final

| ID | Severidad | Clasificación inicial | Responsable / archivo | Estado final / siguiente paso |
|---|---|---|---|---|
| 1 | A | vigente o parcial por inspección | B / docente.html, js/docente.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 2 | M | vigente o parcial por inspección | B / docente.html, js/docente.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 3 | M | vigente o parcial por inspección | B / docente.html, js/docente.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 4 | M | vigente o parcial por inspección | B / docente.html, js/docente.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 5 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 6 | M | vigente o parcial por inspección | B / docente.html, js/docente.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 7 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 8 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 9 | M | vigente o parcial por inspección | B / docente.html, js/docente.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 10 | A | vigente o parcial por inspección | B / docente.html, js/docente.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 11 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 12 | M | vigente o parcial por inspección | B / docente.html, js/docente.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 13 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 14 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 15 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 16 | M | vigente o parcial por inspección | B / docente.html, js/docente.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 17 | A | por reproducir | D / caja.js, partida_service.js, SQL; C/B render | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 18 | M | ya corregido en repo; despliegue pendiente de comprobar | B / docente.html, js/docente.js | ya corregido en el repo: regresión verificada; publicación en curso |
| 19 | M | vigente o parcial por inspección | B / docente.html, js/docente.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 20 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 21 | A | por reproducir | D / caja.js, partida_service.js, SQL; C/B render | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 22 | A | por reproducir | D / caja.js, partida_service.js, SQL; C/B render | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 23 | A | por reproducir | D / caja.js, partida_service.js, SQL; C/B render | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 24 | M | por reproducir | D / caja.js, partida_service.js, SQL; C/B render | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 25 | M | vigente o parcial por inspección | B / docente.html, js/docente.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 26 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 27 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 28 | M | vigente o parcial por inspección | B / docente.html, js/docente.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 29 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 30 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 31 | A | vigente o parcial por inspección | D / caja.js, partida_service.js, SQL; C/B render | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 32 | A | vigente o parcial por inspección | D / caja.js, partida_service.js, SQL; C/B render | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 33 | A | ya corregido en repo; despliegue pendiente de comprobar | C / index.html, js/app.js | ya corregido en el repo: regresión verificada; publicación en curso |
| 34 | M | vigente o parcial por inspección | C / index.html, js/app.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 35 | M | vigente o parcial por inspección | D / caja.js, partida_service.js, SQL; C/B render | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 36 | M | ya corregido en repo; despliegue pendiente de comprobar | C / index.html, js/app.js | ya corregido en el repo: regresión verificada; publicación en curso |
| 37 | M | vigente o parcial por inspección | C / index.html, js/app.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 38 | M | vigente o parcial por inspección | C / index.html, js/app.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 39 | M | por reproducir | C / index.html, js/app.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 40 | B | vigente o parcial por inspección | C / index.html, js/app.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 41 | B | vigente o parcial por inspección | C / index.html, js/app.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 42 | B | vigente o parcial por inspección | C / index.html, js/app.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 43 | B | vigente o parcial por inspección | C / index.html, js/app.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 44 | M | vigente o parcial por inspección | C / index.html, js/app.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 45 | B | vigente o parcial por inspección | C / index.html, js/app.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 46 | B | vigente o parcial por inspección | C / index.html, js/app.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 47 | B | vigente o parcial por inspección | C / index.html, js/app.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 48 | B | vigente o parcial por inspección | C / index.html, js/app.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 49 | B | vigente o parcial por inspección | C / index.html, js/app.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 50 | B | vigente o parcial por inspección | C / index.html, js/app.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 51 | A | vigente o parcial por inspección | D / teacher_auth.js, SQL; C HTML | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 52 | M | vigente o parcial por inspección | D / teacher_auth.js, SQL; C HTML | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 53 | M | vigente o parcial por inspección | D / teacher_auth.js, SQL; C HTML | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 54 | B | vigente o parcial por inspección | C / index.html, js/app.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 55 | B | vigente o parcial por inspección | C / index.html, js/app.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 56 | B | vigente o parcial por inspección | C / index.html, js/app.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |
| 57 | B | vigente o parcial por inspección | C / index.html, js/app.js | cerrado: comprobado por F y regresiones; publicado; activar SQL manual cuando corresponda |


## Catálogo (21 filas)

| Fila | Clasificación inicial | Responsable | Estado final / siguiente paso |
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

Migración implementada: `supabase/migrations/2026-10-20_correcciones_docente_estudiante.sql`. Validada dos veces en PGlite: dominio y excepciones, identidad exacta, bloqueo tras diez fallos, privacidad del podio, versión permanente por partida, inclusión de empresas sin snapshot, rechazo de cierres incompletos/no reconciliados, persistencia de costos obligatorios y cierre idempotente. No se ejecutó SQL en producción. La batería nueva y las correcciones están verificadas; el único fallo histórico restante se reprodujo en la base y el usuario autorizó continuar el push. Publicación en curso.

## Resultado final local — 21/10/2026

- **57 errores verificados: 54 corregidos y 3 ya corregidos en el repositorio (18, 33 y 36); 0 pendientes de implementación.** El endurecimiento servidor de 51/52 y el cierre nuevo requieren la ejecución manual del SQL después de publicar. La recuperación 53 requiere URL permitida y correo configurados en la cuenta real; no se enviaron mensajes ni se alteraron cuentas reales.
- **21 filas del catálogo: 15 alineadas (1–13, 16 y 17) y 6 documentadas (14, 15, 18–21); 0 pendientes de implementación.** «Documentada» distingue supuestos por confirmar, exclusiones expresas y extensiones autorizadas; no significa equivalencia literal del Excel con reglas que el usuario decidió conservar.
- Se preservan las partidas iniciadas y su motor histórico; nuevas partidas usan `side-lotes-2026-10-20`, cinco secciones canónicas y el mismo borrador compartido. El cierre incluye todas las empresas y cobra los costos obligatorios aun sin envío; los movimientos generan caja, utilidad, balance y flujo.
- Versión de entrega compartida: **2026.10.20.1**. Nombre conservado: **Simulador de Decisiones Financieras**.

## Pruebas finales y evidencia

Las rutas siguientes pertenecen a `tests/output/correcciones-2026-10-20/`.

| Comprobación | Resultado final | Evidencia |
|---|---|---|
| Batería Node completa secuencial | **465/465**, 0 fallos, 0 omitidas | `final-node-sequential.log` |
| Oráculo contra Excel real recalculado | **3104/3104**, sin diferencias; ocho escenarios, estado de cálculo COM 0 | `oracle-*.log`, `paridad-base.log`, `paridad-consecuencias.log`; originales preservados |
| SIM-A/B/C independientes | **442 comprobaciones**, cinco empresas y tres ciclos por simulación; no envío, préstamo y autoenvío; invariantes de caja, balance y flujo | `independiente/verification.json`, capturas `independiente/SIM-*-cycle-*.png` |
| Interfaz docente y estudiante independiente | 39 comprobaciones docentes y 19 de estudiante; matriz de los 57 IDs y 21 filas revisada | `independiente/teacher-independent.json`, `independiente/student-independent.json`, informe F |
| Runtime 3D real y presentación final | **22 comprobaciones**, Three y assets reales, recorrido alcanzable, sin movimientos monetarios duplicados ni errores JavaScript | `independiente/visual-runtime.json`, `final-visual-independent.log`; capturas canónicas a 1440, 1150, 360, 390 y 414 px |
| Batería integral de servidor/navegador/SQL y SIM-1/2/3 | **40 runners correctos de 41**; único fallo restante preexistente demostrado, sin regresiones nuevas pendientes | último resultado por `name` al superponer `integral/summary.json` → `recheck/summary.json` → `final-repaired/summary.json` |
| Publicación programada del podio | Correcta con espera real de un minuto y navegador docente cerrado; también límites, cancelar, reprogramar, publicar ahora, móvil y vencimiento 24 h | `recheck/podio_programado_ui.cjs.log`; runner SQL correspondiente correcto |
| Migración nueva | Idempotencia y protecciones verificadas en PGlite local; no ejecutada en producción | `access-db.log`, `final-access-db-r2.log`, runner `access_corrections_20261020_db.cjs` |

El resultado integral se obtiene conservando para cada nombre de runner el último registro disponible de las tres ejecuciones indicadas. Los fallos iniciales de `world_cycle_restart`, `world_startup`, `world_entry_assets`, `game_lifecycle_ui`, `decisions_cycle_ui`, `teacher_lifecycle_ui` y `teacher_report_pdf_ui` quedaron resueltos y reejecutados en verde. Las incidencias de lectura `UNKNOWN` de OneDrive y las expectativas antiguas de pruebas quedan como historial de diagnóstico, no como fallos actuales.

**Única excepción preexistente:** `supplied_npcs.cjs` sigue fallando en la aserción `customers complete a decision` (`tests/supplied_npcs.cjs:136`). La misma aserción y resultado se reprodujeron contra la base conservada **d1c83f3**, sin las correcciones de esta entrega, en `.codex-work/correcciones-base-d1c83f3/`. Evidencia comparable: `base-proof/summary.json`, `base-proof/supplied_npcs.cjs.log` y `recheck/supplied_npcs.cjs.log`. No se presenta este runner como correcto ni se atribuye a las correcciones. El usuario autorizó continuar la publicación con esta excepción demostrada.

## Historial de integración y reparaciones

Commits de integración conservados como referencia: `cebba72` estudiante inicial, `33fe68d` docente, `c22702b` acceso/SQL/libro, `f34861f` motor, `e3a5e3f` préstamo coherente, `d2c0396` cinco secciones canónicas y `a516423` verificación independiente. Código publicado en 61abfc3; este cierre documental no altera el producto.

El verificador detectó dos regresiones y se devolvieron a sus responsables: misiones arcade imposibles en motor nuevo y Resumen que calculaba alquiler con un preview histórico. Ambas se corrigieron y el runtime real, el recorrido y la cifra de costos se revalidaron. La intro colapsada final, cuyo primer intento se interrumpió por contención de OneDrive/Chromium, quedó comprobada por la ejecución visual final citada arriba; no sigue pendiente. La economía del recorrido nuevo se calcula al cierre, sin una segunda caja arcade; la lógica de NPC y avatares permanece intacta.

También se cerró el bypass detectado por F en el gate de migración: `closeExcelRemoteRound()` ya no permite continuar una partida del motor nuevo ante RPC faltante aunque no existan snapshots; conserva compatibilidad solo para partidas heredadas sin empresas habilitadas por lotes. Validación independiente en cinco casos VM y pruebas de capacidad/creación. La migración anuncia características dentro de la misma transacción, de modo que un fallo de prerrequisitos revierte también el anuncio.

## Activación manual y publicación

**SQL de Supabase: sí, Joe debe ejecutarlo manualmente; Codex nunca lo ejecutó en producción.** Archivo completo: `supabase/migrations/2026-10-20_correcciones_docente_estudiante.sql`.

1. Esperar a que se publique esta entrega y comprobar **2026.10.20.1 en estudiante y docente**. Publicación y comprobación pública completadas: 61abfc3, despliegue 39647973483 correcto, ambas páginas con 2026.10.20.1. El registro anterior al push (`published-before.json`) mostraba estudiante 2026.09.22.2 y `release.js` 404; es evidencia histórica, no el estado público final.
2. Con respaldo de la base, comprobar prerrequisitos y ejecutar el archivo nuevo completo, después de las migraciones previas indicadas en `docs/ACTUALIZACION_2026-10-20.md`. No reinstalar migraciones antiguas encima de esta entrega. La migración nueva es idempotente.
3. Verificar `select public.side_excel_features();`: `correccionesVersion: 20261020`, `motorVersion: side-lotes-2026-10-20` y `cierreVersion: 1`. Comprobar que partidas anteriores conservan `excel-16` y una partida nueva usa el motor nuevo; comprobar además que `anon` no puede ejecutar directamente `ingresar_empresa(text,text,text)`.
4. Crear una partida de prueba nueva: una empresa que inicia con S/ 100.000 y no opera debe cerrar con costos obligatorios MYPE **S/ 2.712,32** y caja **S/ 97.287,68**; un borrador guardado debe registrar autoenvío al corte. Verificar estados conciliados en Resultados y PDF.

La guía `docs/ACTUALIZACION_2026-10-20.md` contiene las consultas exactas, el orden de prerrequisitos, la URL de recuperación permitida y las excepciones de correo docente. Mientras el servidor no anuncie las características nuevas, el sitio nuevo bloquea el editor/cierre remoto correspondiente; no activa silenciosamente el motor anterior.

## Decisiones de negocio que permanecen para Joe

Las confirmaciones de la sección anterior no bloquean la implementación: están centralizadas y documentadas como valores provisionales o alcance autorizado. Además de corte, horas extra/almacenaje/TEA, mesa, producto, PIN y demanda distrital, confirmar alquileres distritales **S/ 1.800 / 3.500 / 2.200**, tomados de las opciones existentes del juego, y la interpretación del precio de hilo del libro: el motor literal aplica precio por unidad productiva tras convertir pieles/carretes; la pantalla explica conversión, importe bruto por compra y descuento general del 8 %. No se cambió esa interpretación sin autorización.
