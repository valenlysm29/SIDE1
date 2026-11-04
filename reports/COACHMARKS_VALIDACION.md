# Coachmarks SIDE: validación de integración

Fecha: 4 de noviembre de 2026. Comparación sobre `origin/main` c573eb5; copias aisladas dentro de `.codex-work/`. El árbol de trabajo original tenía 960 archivos rastreados modificados o eliminados antes de esta tarea. Los iconos, fuentes y Three.js ausentes se recuperaron en las copias aisladas desde `origin/main`, sin revertir las eliminaciones previas del usuario.

## Cambios

Guías compartidas por rol, siete pasos para estudiantes y seis para docentes. La identificación docente espera la sesión antes de decidir si mostrar la invitación. La guía permite interactuar con las pestañas reales y sigue la sección elegida. Los destinos ocultos o deshabilitados se omiten; al abrirse otro diálogo, la guía se pausa y se reanuda tras su cierre. La preferencia es local al navegador. No se ha modificado el motor económico.

## Resultados registrados

- Base sin coachmarks: suite Node completa, 1.074 aprobadas, 11 fallidas, una cancelada, cero omitidas. La cancelación corresponde a un proceso de prueba de navegador que quedó bloqueado al finalizar y se terminó para permitir que finalizara la suite. Registro: `tests/output/coachmarks-base-regresion.log`.
- Entre los fallos de base hay dependencias de Docker inaccesibles durante el arranque, dos libros Excel no presentes en la copia limpia, una expectativa de desplazamiento y pruebas de borradores con una función ausente en su fixture. Los dos libros se copiaron posteriormente desde los artefactos locales existentes, exclusivamente para las pruebas aisladas; no se modificaron.
- Prueba de publicación `tools/check_release.cjs`: 216 aprobadas, 0 fallidas y 0 omitidas en la copia de `main` con la guía.
- Sincronización del estudiante, con invitación atendida: 20 aprobadas, 0 fallidas y 0 omitidas.
- Se corrigió el orden de carga de `company_summary.js` para que la recuperación de sesión no invoque `comparableSummaryDraft` antes de su definición; la prueba de recarga pasó.
- Pruebas de guías en navegador: recorridos de ambos roles, reinicio, salto, anterior, Escape, recarga, pantalla móvil y movimiento reducido. Se comprobó que un destino deshabilitado se omite y que otro diálogo tiene prioridad.
- Autenticación aislada: cuentas nuevas de docente y estudiantes en Supabase local, sin usar partidas productivas. Recorridos completos y comparación de estado de decisiones sin cambios. Capturas en `tests/output/coachmarks-docente-cuenta-local.png` y `tests/output/coachmarks-estudiante-cuenta-local.png`; ambas actualizadas tras la corrección de prioridad de diálogos.
- Ciclos: en la repetición posterior se aprobaron tres ciclos manuales completos con tres empresas locales, dos pestañas docentes, Auth, PostgREST, PostgreSQL y Edge; se verificaron resultados oficiales y continuidad. Registro `tests/output/coachmarks-modal-e2e.log`. En una ejecución anterior la prueba había fallado al esperar un avance, como consta en `tests/output/coachmarks-local-e2e-tercero.log`.
- Comparación adicional de ciclo sobre la base sin coachmarks: falló antes del cierre con `TypeError` al leer `segments` en `normalizedProductionPrices`; no prueba que el fallo posterior de avance sea el mismo.

## Estado de publicación

Al momento de la validación local todavía no se había publicado. La versión pública consultada respondía HTTP 200 sin incluir `coachmarks.js`. La regresión anterior identificó fallos causados por la invitación sobre el aviso de costos y pruebas que actuaban detrás de la guía; se corrigió la prioridad y se adaptaron las pruebas, que luego aprobaron por separado. También hubo fallos presentes en la base y tiempos de espera por concurrencia.

- `decision_options_db.cjs` en la copia candidata: aprobada; cubre opciones, cantidades, aislamiento, revisiones y reintentos en PostgreSQL local PGlite.

- Pruebas de regresión específicas tras atender la invitación: edición de secciones 2/2, sincronización 20/20, proyección y catálogo 2/2. La prueba de interfaz de la guía aprobó ambos roles, la prioridad de diálogos y la navegación directa.

## Actualización de validación final

La suite completa del candidato anterior terminó con 1.088 pruebas aprobadas, ninguna fallida y una cancelada: la prueba extensa de PostgreSQL agotó 600 segundos bajo carga. Ese mismo escenario aprobó en una ejecución previa en 565 segundos. Se aumentó su límite a 1.200 segundos y se acotaron los comandos Docker a 60 segundos; su limpieza ya usa `finally` y elimina únicamente contenedores de prueba con nombres aleatorios propios. La prueba de sincronización cierra contextos tras cada caso, incluso si falla. La prueba de bienvenida interactiva final aprobó 3/3, incluidas navegación entre pestañas y prioridad de diálogos. La comprobación de publicación aprobó 216/216 y sincronización 20/20.

- Validación de la versión interactiva final: tres ciclos completos y resultados oficiales con tres empresas y dos pestañas docentes, laboratorio y Auth/PostgreSQL/Edge locales. Registro `tests/output/coachmarks-interactiva-e2e-final.log`.
