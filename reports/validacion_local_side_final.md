# SIDE — validación local de continuación

Estado: no listo. Producción no modificada; sin push ni despliegue.

| Componente | Estado | Prueba y evidencia |
|---|---|---|
| Reconstrucción Supabase | Parcial | Dos `supabase start` aislados aplicaron 23 migraciones seleccionadas; no es historia completa. Generador `tools/prepare_supabase_local.py`. |
| Auth/RLS | Parcial | `python tests/local_auth_rls_cli_test.py`: sesiones reales Auth local, dos estudiantes, reingreso, acceso cruzado denegado y expulsión/reactivación. Sala sembrada con SQL privilegiado. |
| Seguridad financiera | Fallido | `tests/authoritative_worker.test.cjs` pasa 7 casos focales, pero `tests/legacy_excel_security_witness.cjs` demuestra que RPC histórica docente puede guardar S/900000 falsos. También falta validar precios y eventos integralmente. |
| Ventas | Parcial | `tests/side_store_distribution.test.cjs`: 78 unidades, S/3120, stock 7; prueba aislada. |
| Inventario tres ciclos | Parcial | `node tests/side_real_inventory_probe.cjs side_rebuild_d156f718ad`: RPC/worker y PostgreSQL local; tienda recibe 2000, vende 1030, saldo 970; ciclo 2 recibe 15, disponible/vendido 985; ciclo 3 recibe/vende 15. Semilla y RPC con privilegios, no prueba Data API estudiantil. |
| Interfaz | Parcial | `node tests/side_manual_distribution_ui.cjs` pasó escritorio/móvil; servidor simulado, no Supabase conectado. |
| Regresión | Fallido | `node --test tests/*.test.js tests/*.test.mjs tests/*.test.cjs`: 771 pruebas, 767 aprobadas, 4 fallidas (dos inventario legacy, dos entrada 3D); salida tests/output/suite_final_completa.log. |

Los conteos 770/756 anteriores variaban por archivos agregados y por fallos de proceso de navegador; 3 errores de navegador se debieron a bytes no UTF-8 en services/partida_service.js, corregidos y 28 pruebas UI focales pasan. La ruta antigua `side_guardar_cierre_excel` permanece vulnerable y requiere solución y compatibilidad probadas. No se corrieron pruebas completas de arrastre con JWT y navegador conectado.

Tras la suite se añadió una validación del préstamo inicial y se regeneró el runtime; 11 pruebas focales pasaron. No se volvió a ejecutar la suite integral después de ese cambio. La ruta legacy sigue vulnerable.
