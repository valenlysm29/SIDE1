# Reversión de esta conversación — 22/10/2026

El usuario confirmó explícitamente: «Revertir todas las correcciones de esta conversación, incluidos motor, docente y acceso, conservando los trabajos posteriores».

## Alcance

- Base conservada: `d1c83f3`, que incluye los cambios de Supabase que ya existían antes de esta conversación. Base original anterior a ese punto de control: `66dc38a`.
- Bloque revertido: `d1c83f3..fcd33e7` (22 commits). Se aplica el cambio inverso sin reescribir el historial remoto.
- Trabajo posterior conservado: `fcd33e7..7c04179` (facultad, pausa, expulsión, ingresos/historial y restauración de tarjetas/saldo guardado del 21–22/10).
- Respaldo recuperable: rama local `codex/respaldo-antes-reversion-20261022`, en `7c04179`.

No es un reemplazo completo del repositorio por una versión histórica. Se retiraron los cambios de esta conversación y se resolvieron los solapamientos para preservar el trabajo posterior elegido por el usuario. La imagen identifica la presentación deseada, pero esta autorización incluye también deshacer motor, docente y acceso; no se afirma equivalencia píxel a píxel con la captura.

## Dependencias posteriores

El motor vuelve a las reglas `excel-16`: se retiran el motor versionado del 20/10, sus cobros universales/autoenvío, el libro de movimientos nuevo, los controles de compatibilidad de esa entrega, las modificaciones de acceso/docente y la adaptación del recorrido 3D de esa conversación. Los cálculos históricos conservan las mejoras posteriores de historial financiero entre ciclos.

Se conservan tarjetas, cinco pestañas, guardado por decisión, saldo guardado y bloqueo durante pausa añadidos después. Sus proyecciones se adaptan al motor restaurado. Las migraciones posteriores de expulsión/pausa se adaptan a la identidad y RPC anteriores, eliminando su dependencia del SQL del 20/10 retirado. No se reactiva el limitador de acceso de la conversación revertida.

No se ejecutó SQL en producción. Esta reversión de archivos **no desinstala** una migración que el usuario pudiera haber aplicado antes en Supabase; tampoco modifica partidas ni cuentas reales. Las instrucciones antiguas que mencionan el SQL del 20/10 son antecedentes históricos, no instrucciones vigentes de esta reversión. Para la expulsión posterior, consultar `docs/expulsion-empresa.md` actualizado.

## Verificación

- Expulsión SQL local (PGlite): correcta, incluida repetición de migración, permisos, seis RPC, identidad exacta, cierre/podio y reactivación.
- Pausa SQL local (PGlite): correcta, incluida repetición, bloqueo de tres escrituras, conservación de lecturas/CAS y reanudación.
- Evidencias locales: `tests/output/reversion-20261022/`.
- Node final secuencial: **468/468**, cero fallos, omitidas o canceladas (`node-final.log`, 128,2 s).
- Oráculo: **3.104/3.104**, cero diferencias; conserva el motor histórico (`oraculo.log`).
- Catálogo en navegador: **25 entradas, 82 interacciones**, controles y guardado por decisión, escritorio/móvil (`catalogo.log`).
- Flujo de interfaz: **89 comprobaciones**, ciclos 1–3, cinco pestañas en el modo por lotes explícitamente habilitado, pausa/envío/resultados, 1440/390 px; cero errores JS (`flujo.log`). Sin la activación automática retirada del 20/10, la prueba declara explícitamente ese modo; no simula que siga activándose por la versión del servidor.
- Ingresos e historial de tres ciclos conservados: pruebas locales y persistencia SQL local correctas (`ingresos-db.log`).
- Reversión SQL: dos ejecuciones sobre las migraciones publicadas del 20+21/10, conservando datos, expulsión/reactivación/pausa y devolviendo nuevas salas a excel-16 (`rollback-db.log`).
- Auditoría de alcance: los **37 archivos exclusivos** de esta conversación vuelven exactamente a la base; los solapamientos con trabajos posteriores se integraron por archivo (`alcance.json`).
- Sintaxis de todos los scripts cambiados y referencias locales HTML correctas. Sin marcadores de conflicto ni errores de whitespace. No se modificaron NPC ni avatares.

## Estado de activación: commit local, sin push todavía

La consulta **de solo lectura** a Supabase confirmó `motorVersion=side-lotes-2026-10-20`, `cierreVersion=1`, `correccionesVersion=20261020` (`server-features-readonly.json`). Por tanto, la migración sí fue aplicada fuera de esta conversación. No se afirma que la reversión del código la desinstale.

El push se aplaza hasta que el usuario ejecute manualmente `supabase/migrations/2026-10-22_revertir_correcciones_conversacion.sql`, con las partidas detenidas y respaldo previo. Publicar ahora haría incompatibles los cálculos revertidos con el cierre todavía versionado del servidor. La regla explícita del usuario prohíbe ejecutar SQL en producción: Codex preparó y validó la reversión, pero no la ejecutó.

Pasos exactos y consultas: `docs/REVERSION_CONVERSACION_2026-10-22.md`. Después de que `side_excel_features()` devuelva únicamente `{"cierreVersion":1}`, publicar este commit en main y comprobar el despliegue. No es necesario repetir las pruebas ya aprobadas si el código no cambia.
