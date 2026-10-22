# SIDE1 — Simulador empresarial

Para iniciar el juego en Windows, abre **INICIAR_JUEGO.bat**. Las páginas de
entrada siguen siendo `index.html` y `docente.html`.

## Ubicación de los archivos

| Carpeta | Contenido |
| --- | --- |
| `js/` | Código JavaScript de las páginas y del simulador. |
| `css/` | Hojas de estilo. |
| `services/` | Servicios de datos, personajes, navegación y mundo 3D. |
| `assets/` | Imágenes, iconos, modelos y recursos del juego. |
| `vendor/` | Dependencias del navegador incluidas en el proyecto. |
| `supabase/` | Esquema y migraciones de la base de datos. |
| `docs/` | Instrucciones y documentación del proyecto. |
| `tests/` | Pruebas y sus dependencias. |
| `tests/output/` | Capturas y resultados; `legacy/` conserva evidencias anteriores. |
| `tools/` | Herramientas para preparar y validar recursos. |
| `reports/` | Análisis e informes; `legacy/` conserva resultados históricos. |
| `output/` | Entregas locales: paquetes, PDF y exportaciones. |
| `archive/` | Copias de respaldo y referencias históricas. |
| `LICENSES/` | Licencias de recursos y dependencias. |
| `godot4/` | Proyecto alternativo de Godot, con su estructura propia. |

Consulta la [documentación del simulador](docs/README.md), los
[créditos](CREDITS.md) y las [reglas de ubicación](AGENTS.md).

Para que **Eliminar por inactividad** expulse a la empresa del servidor y
notifique al estudiante, ejecuta en Supabase SQL Editor la migración
`supabase/migrations/2026-10-21_expulsion_empresa.sql` después de la de
correcciones del 20 de octubre. Consulta [instalación y comportamiento](docs/expulsion-empresa.md).

Para bloquear también en el servidor los envíos durante una pausa, ejecuta después
`supabase/migrations/2026-10-21_pausa_escrituras_estudiante.sql`.
El [informe de observaciones](reports/observaciones-jugador-2026-10-21.md)
detalla el orden, las decisiones de diseño y la verificación de tres ciclos.

Los archivos `output/entregas/SIDE_corregido.zip` y `.sha256` son una entrega
anterior conservada; el ZIP no se regeneró con esta reorganización.

Las carpetas ocultas `.cache/` y `.codex-work/` contienen dependencias,
herramientas y trabajo temporal local. `outputs/` se conserva para compatibilidad
con tareas anteriores; las nuevas entregas deben guardarse en `output/`.

Pruebas automatizadas, desde esta carpeta:

```powershell
node --test tests/*.test.js tests/*.test.mjs tests/*.test.cjs
python tests/local_server_test.py
node tests/decision_options_db.cjs
```

La migración `supabase/migrations/20260930_preservar_opciones_decisiones.sql`
debe aplicarse después de las migraciones existentes. Conserva todas las
opciones de una decisión en filas distintas y reemplaza las selecciones
anteriores de las decisiones enviadas. No reconstruye opciones que ya hayan
sido sobrescritas en la base de datos. Su aplicación en Supabase es un paso
separado de las pruebas locales.

El registro de archivos trasladados está en
[reports/organization/moves_2026-09-30.json](reports/organization/moves_2026-09-30.json).

El podio docente permite publicar ahora o programar entre 1 minuto y 72 horas.
**Ejecutar en Supabase SQL Editor** el archivo completo
`supabase/migrations/2026-10-12_podio_programado.sql` después de las migraciones
existentes de lifecycle, admisión, identidad exacta y
`supabase/migrations/20260929_guardar_puntaje_docente.sql`.
Es idempotente y no se instala con un push. La programación y el snapshot de
notas viven en Supabase; el servidor habilita la lectura estudiantil a la hora
programada y la cierra 24 horas después, aunque el docente cierre su navegador.
No requiere cron. La presencia usa el heartbeat existente, sin SQL adicional.
