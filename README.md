# SIDE1 — Simulador empresarial

El cierre económico automático está desplegado en Supabase mediante la función `side-business-close` y Cron cada minuto. No depende del navegador docente ni del mundo 3D. Ver [configuración](docs/cierre_automatico_servidor.md) y [verificación remota](reports/despliegue_cierre_supabase_20261027.md).

Para iniciar el juego en Windows, abre **INICIAR_JUEGO.bat**. Las páginas de
entrada siguen siendo `index.html` y `docente.html`.

## Cierre económico según el documento de costos

La versión activa `md-20261027` sigue [la explicación del Excel entregada por el usuario](docs/Logica_SIDE_Costos_de_Produccion.md): 30 días, producción N1→N2→N3, reputación de cuatro factores, reparto exacto del mercado y costos según régimen. Consulta [las reglas aplicadas y su validación](docs/actualizacion_logica_documento_20261027.md). El libro adaptado v19 se conserva como antecedente. El motor económico no recibe ventas ni precios del mundo 3D.

La entrega vigente conserva motores por versión: las partidas heredadas siguen usando su motor original; las nuevas utilizan los cierres consecutivos autoritativos. La función `side-business-close` opera con token dedicado de Vault, registro de intentos, exclusión concurrente y Cron. Los cierres sellados prevalecen sobre cualquier estimación del navegador. No aplicar paquetes v19 antiguos encima de una base actual.

Para instalación aislada y reproducible, usar `tools/fase01_local_setup.py` con su manifiesto ordenado y un Supabase local dedicado. El procedimiento de restauración es `tests/fase01_restore.py`; incluye Auth y `side_private`. Vault requiere restauración protegida o rotación del token en otro equipo, y Cron se mantiene inactivo durante la recuperación. La cadena histórica de archivos SQL no equivale por sí sola a una instalación CLI validada desde cero.

`npm ci` instala las dependencias fijadas. `node tools/check_release.cjs` verifica la paridad del paquete Edge generado y el contrato focal de negocio. La prueba independiente `node --test tests/forense_postgres.test.cjs` ejecuta PostgreSQL y Deno reales, requiere Docker y valida tres y seis ciclos. El ensayo autenticado de tres interfaces está en `tests/history_connected.py` y solo se ejecuta contra el entorno QA local. Ninguna de estas herramientas debe apuntarse a partidas reales para fabricar datos de aceptación.

Las decisiones y opciones de Ventas y Finanzas se conservan. Los precios orientativos son informativos: el margen bruto no garantiza utilidad neta. Mantenimiento opcional y automático son conceptos independientes; los moldes marcados no depreciables conservan su valor. Los snapshots históricos no se recalculan al corregir el motor.

El catálogo contiene 92 eventos, pero su presencia no acredita la semántica completa. Los costos sin una base conciliada siguen bloqueados; los huecos históricos requieren evidencia original. El estado de aceptación, las tareas abiertas y las versiones publicadas se registran únicamente en [el inventario consolidado](reports/INVENTARIO_GENERAL_PENDIENTES_SIDE.md). SIDE no se declara finalizado por superar una prueba parcial.

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
