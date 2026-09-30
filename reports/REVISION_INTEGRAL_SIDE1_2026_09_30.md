# Revisión integral de SIDE1

Fecha: 30 de septiembre de 2026, hora de Lima.

La revisión encontró una pérdida de opciones en el guardado SQL y dejó una
corrección local con prueba de regresión. La aplicación de esa corrección en
Supabase sigue pendiente; las comprobaciones remotas fueron de lectura.

## Defecto reproducido y corrección

Al enviar `CANALES` con `web` y `sjl`, `guardar_decisiones_estudiante` devolvía
`success: true, guardadas: 2`, pero `empresas_decisiones` conservaba únicamente
`sjl`. La clave única y el `ON CONFLICT` agrupaban por empresa, ciclo y decisión,
sin distinguir la opción.

La migración `supabase/migrations/20260930_preservar_opciones_decisiones.sql`
incorpora la opción a la clave y sustituye la selección anterior de cada decisión
incluida en el envío. Conserva otros apartados, ciclos y filas históricas. Evita
duplicados al reintentar, incluso para decisiones sin opción, y mantiene la
entrada privada y los controles de identidad, revisión, fase y cancelación.

La migración se probó dos veces en cada base local. También se comprobaron
instalaciones con nombres diferentes para sus claves e índices antiguos.
Debe aplicarse **después** de las migraciones existentes, en PostgreSQL 15 o
posterior. No reconstruye opciones que ya hayan sido sobrescritas.

La prueba `tests/decision_options_db.cjs` verifica cantidades y costos de ambas
opciones, repetición de guardados, retirada de una opción, preservación de otro
apartado y de registros anteriores, payload inválido, revisión desactualizada,
cancelación y denegación del RPC privado. Forma parte de `npm test` en `tests/`.

## Validación

- 263 pruebas generales de JavaScript aprobadas, sin fallos.
- 2 pruebas del servidor local aprobadas.
- 64 archivos JavaScript de la aplicación y servicios sin errores de sintaxis.
- Referencias locales HTML y CSS comprobadas.
- 6 suites de base de datos aprobadas después de la corrección: ciclo de
  partidas, observaciones, admisión, matriz de admisión, historial docente y
  guardado de opciones.
- 11 pruebas de admisión, sincronización docente y cálculo de orientación
  aprobadas nuevamente después de modificar el entorno de base de datos.
- Godot: importación sin errores; pruebas de navegación, aforo y ciclo de NPC,
  visitas completas a la tienda y rutas del mapa aprobadas.
- Supabase: Auth, catálogo y comprobaciones de columnas respondieron HTTP 200.
  Las 26 decisiones y 51 opciones coincidieron con el catálogo local.
- Las páginas de alumno y docente cargaron el SDK real en Chromium sin
  excepciones JavaScript, respuestas HTTP fallidas ni solicitudes fallidas.

La primera regresión de navegador aprobó 13 de 14 suites. La prueba móvil falló
al comprobar la flecha después de una pausa fija de 500 ms. Se sustituyó esa
pausa por una espera de visibilidad y se capturan los rectángulos de la flecha
y sus obstáculos en una sola evaluación, evitando comparar distintos frames.
Se conserva el resultado inicial en `browser-results.json`. La repetición del
flujo de partidas con la nueva migración aprobó los ciclos manuales y automáticos
con dos estudiantes, cancelación, recargas y controles de acceso.
La prueba móvil final, con las medidas capturadas en un mismo frame, pasó en
360×640, 390×844 y 844×390. El resultado final de las 14 suites de navegador
es aprobado, sin fallos pendientes en los escenarios comprobados.

Las suites de navegador cubren ciudad y colisiones, HUD, pedidos sin doble
cobro, pausa, arranque y reintento, sesiones por ciclo, decisiones en seis
tamaños, flujo docente, historial, selección de personajes, orientación móvil,
interiores en tres niveles de calidad y descarga/vista previa del PDF docente.

## Evidencia y límites

Los registros y diagnósticos de esta revisión están en
`tests/output/audit_2026_09_30/`: `unit.log`, `server.log`,
`database-after-fix.json`, `decision-options-fix.log`, `focused-after-fix.log`,
`browser-results.json`, `browser-after-fix.json`, `mobile-final.log`,
`runtime-results.json` y `godot-results.json`.

Los controles de base de datos usan PostgreSQL local con PGlite; WebGL usa
Chromium con SwiftShader. No certifican rendimiento en teléfonos físicos.
No se verificó un guardado exitoso entre dispositivos con cuentas reales en
Supabase ni se aplicó la migración al servidor remoto. La disponibilidad del
backend y el éxito de las pruebas locales no garantizan todo el flujo remoto.

Todos los archivos creados permanecen dentro de SIDE1. Se conservaron los
cambios locales anteriores del usuario. No se realizaron commits ni pushes.
