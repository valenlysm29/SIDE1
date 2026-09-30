# Verificación del historial de Decisiones — 30 de septiembre de 2026

## Pruebas específicas

- `node --test tests/teacher_history.test.js`: 7 pruebas aprobadas. Estado vacío, varias empresas y ciclos, nota cero, consulta actualizada sin acumular partidas, esquema ausente sin mensajes de consola, fallos de conexión/permisos, categorías y opciones del catálogo, contenido escapado y respuestas asíncronas antiguas descartadas.
- `node tests/teacher_history_db.cjs`: aprobado en PostgreSQL local PGlite, usando el esquema y las migraciones existentes. Se ejecuta el SQL nuevo dos veces y después de crear datos para comprobar su repetibilidad.
- `node tests/teacher_history_ui.cjs`: aprobado en Chromium para escritorio (1366 × 900) y móvil (390 × 844). Sin excepciones JavaScript ni errores de consola; sin desbordamiento horizontal. Verifica selección de empresas, decisiones y resultados por ciclo, indicadores, resumen y nota cero, solo lectura, contenido escapado, reemplazo de partida, esquema ausente y navegación a Empresas, Resultados y Configuración.
- `node --check` aprobado en los tres archivos de pruebas nuevos.

## Casos de persistencia y permisos

El cierre manual y el cierre automático conservan una sola referencia por profesor a los datos existentes, incluidos reportes financieros y decisiones del catálogo. Una sala cancelada antes de jugar no reemplaza el historial. Repetir el cierre mantiene su fecha. Un cierre automático antiguo detectado tardíamente o un callback antiguo no reemplaza una partida que finalizó después. Las notas posteriores al cierre, incluida una nota cero, se consultan correctamente.

Las pruebas cambian efectivamente a los roles PostgreSQL `authenticated` y `anon`, además de cambiar `auth.uid()`. Un profesor ve su historial; otro profesor no lo ve y puede conservar su propio historial aislado. El cliente no puede modificar directamente las referencias, ejecutar las funciones privadas ni consultar el historial como estudiante anónimo. La RPC pública sin sesión devuelve acceso denegado y no acepta un identificador de otro profesor.

## Revisión visual

Capturas locales ignoradas por Git: `tests/output/teacher-history/desktop.png` y `tests/output/teacher-history/mobile.png`. Revisadas visualmente: selector, tarjetas, acordeones de ciclos y estados financieros conservan el estilo del panel y se adaptan al ancho disponible.

## Alcance

La comprobación de RLS usa PostgreSQL local y el SQL entregado; no confirma que ese SQL ya esté desplegado en el proyecto remoto de Supabase. La migración debe aplicarse manualmente en su SQL Editor. Para cierres manuales antiguos sin fecha persistida, la interfaz indica que la fecha de creación es aproximada.

## Regresión completa y bloqueo del push

- 241 pruebas Node aprobadas: las 234 existentes y las 7 nuevas. Sintaxis de los 6 JS/CJS modificados comprobada con `node --check`.
- Ejecutados los 27 runners existentes de navegador/DB: los 16 del runner general y 11 adicionales (admisión, PDF, personajes, interiores, navegación y rendimiento).
- Tras reintentos, 26 runners aprobados. `world_startup.cjs`, `supplied_npcs.cjs` y `mona_npc.cjs` pasaron al repetirlos con menor concurrencia.
- `production_performance.cjs` sigue fallando en `store/low`: 220 llamadas de render frente al máximo de 195 (primer intento: 221). No se modificaron el mundo, los modelos de ejecución ni sus límites de prueba para esta función.
- Por la condición explícita del usuario, no se realiza push. Propuesta: revisar por separado las llamadas adicionales de render de la tienda y volver a ejecutar ese runner antes de publicar los commits de Decisiones. No aumentar el límite para ocultar el fallo.
- Los cambios previos de modelos, herramientas y capturas quedan fuera de los commits de esta tarea. Los logs completos permanecen en `tests/output/decisiones-*.log`, ignorados por Git.
