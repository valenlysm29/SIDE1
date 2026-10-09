# QA SIDE — 9 de octubre de 2026

35 suites aprobadas; 0 fallidas pendientes; 1 opcional ausente. Node: 300/300, 0 fallos.

Las pruebas usan SQL real local en PGlite y las páginas entregadas en Chromium. No confirman la aplicación de la migración en Supabase ni modifican cuentas o partidas de producción.

## Cobertura

Primera pulsación de Iniciar con sala manual de 3 minutos; dos estudiantes con cuenta regresiva del servidor; rechazo a adelantar el inicio mediante RPC; vencimiento exacto UTC/America-Lima; registro durante espera; bloqueo de altas después; reingreso exacto desde otro navegador; diferencias de mayúsculas rechazadas. RLS/RPC y transacciones antiguas comprobadas.

Decisiones, envío, resultados y avance de ciclos; mundo continuo, ventas, inventario y proveedor; 60 retornos consecutivos de Tablet desde botón, noticias y oficina, incluidos Escape, foco, WASD y conservación del ciclo/ledger. Panel del profesor, historial, presencia y PDF. Splash anterior y selección de rol en 11 tamaños; mapas y controles móviles sin solaparse.

## Fallos iniciales resueltos

Se conservaron los logs originales. Los mocks se actualizaron para las nuevas capacidades y reloj del servidor; el test de inicio dejó de esperar un inicio inmediato y comprobó la espera real; la expectativa del mensaje de identidad adoptó el nuevo texto claro. Las mejoras móviles locales previas se conservaron e incluyeron; se corrigió el cruce del minimapa con misiones y los controles táctiles de 42 px, además del cruce de botones a 1024 px. No se redujeron los umbrales de las pruebas.

## Rendimiento

El benchmark terminó correctamente con Chromium SwiftShader (renderizador por CPU): medianas low 2, medium 2 y high 1 FPS. Estas mediciones no describen el rendimiento con una GPU real.

## Último resultado por suite

| Suite | Resultado | Fase de evidencia |
|---|---|---|
| local_server_test.py | passed | admission-final-2026-10-09 |
| node-completa | passed | admission-verified-2026-10-09 |
| decision_options_db.cjs | passed | admission-supplement-2026-10-09 |
| student_admission_db.cjs | passed | admission-supplement-2026-10-09 |
| student_admission_matrix_db.cjs | passed | admission-supplement-2026-10-09 |
| teacher_history_db.cjs | passed | admission-supplement-2026-10-09 |
| game_lifecycle_db.cjs | passed | admission-supplement-2026-10-09 |
| game_observations_db.cjs | passed | admission-supplement-2026-10-09 |
| waiting_room_db.cjs | passed | admission-supplement-2026-10-09 |
| playable_hub.cjs | passed | admission-supplement-2026-10-09 |
| continuous_world.cjs | passed | admission-supplement-2026-10-09 |
| gameplay_hud.cjs | passed | admission-supplement-2026-10-09 |
| world_business_ui.cjs | passed | admission-supplement-2026-10-09 |
| world_cycle_restart.cjs | passed | admission-final-2026-10-09 |
| world_startup.cjs | passed | admission-final-2026-10-09 |
| world_loading.cjs | passed | admission-final-2026-10-09 |
| world_entry_assets.cjs | passed | admission-final-2026-10-09 |
| supplied_npcs.cjs | passed | admission-final-2026-10-09 |
| mona_npc.cjs | passed | admission-final-2026-10-09 |
| npc_locomotion.cjs | passed | admission-final-2026-10-09 |
| game_lifecycle_ui.cjs | passed | admission-supplement-2026-10-09 |
| decisions_cycle_ui.cjs | passed | admission-final-2026-10-09 |
| teacher_lifecycle_ui.cjs | passed | admission-supplement-2026-10-09 |
| tablet_return_browser.cjs | passed | admission-final-2026-10-09 |
| npc_world_fixes_browser.cjs | passed | admission-final-2026-10-09 |
| world_orientation_mobile.cjs | passed | admission-supplement-2026-10-09 |
| teacher_history_ui.cjs | passed | admission-final-2026-10-09 |
| teacher_report_pdf_ui.cjs | passed | admission-final-2026-10-09 |
| character_selection_ui.cjs | passed | admission-final-2026-10-09 |
| decision_interiors_browser.cjs | passed | admission-final-2026-10-09 |
| npc_navmesh_browser.cjs | passed | admission-final-2026-10-09 |
| tablet_item_draft_ui.cjs | passed | admission-final-2026-10-09 |
| mobile_integral_ui.cjs | passed | admission-verified-2026-10-09 |
| side_full_flow.cjs | skipped | admission-final-2026-10-09 |
| role_selection_ui.cjs | passed | admission-final-2026-10-09 |
| npc_fps_benchmark.cjs | passed | admission-supplement-2026-10-09 |

`side_full_flow.cjs` es una entrada opcional del runner que no existe. La cobertura de punta a punta se ejecutó en las suites de lifecycle, decisiones, mundo continuo, ciclos y Tablet; no se creó un wrapper duplicado.

Resumen consolidado y logs: `tests/output/mejora-integral-2026-10-01/admission-consolidated-2026-10-09.json`.
