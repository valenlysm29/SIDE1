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

Los archivos `output/entregas/SIDE_corregido.zip` y `.sha256` son una entrega
anterior conservada; el ZIP no se regeneró con esta reorganización.

Las carpetas ocultas `.cache/` y `.codex-work/` contienen dependencias,
herramientas y trabajo temporal local. `outputs/` se conserva para compatibilidad
con tareas anteriores; las nuevas entregas deben guardarse en `output/`.

Pruebas automatizadas, desde esta carpeta:

```powershell
node --test tests/*.test.js tests/*.test.mjs tests/world_finance.test.cjs
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
