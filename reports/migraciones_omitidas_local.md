# Migraciones ausentes de cadena experimental

Esta tabla identifica objetos mencionados; no demuestra equivalencia funcional ni autoriza omisiones.

| Archivo | Funciones declaradas | Tablas alteradas o creadas |
|---|---|---|
| 2026-10-11_codigos_sala_no_reutilizables.sql | public.side_next_game_code, side_private.reservar_codigo_sala | public.partidas, side_private.codigos_sala_reservados |
| 2026-10-11_estado_codigo_sala.sql | public.side_config_cancelada, public.side_estado_codigo_sala, public.side_runtime | — |
| 2026-10-11_recuperar_salas_compatibles.sql | public.recuperar_sala_docente | — |
| 2026-10-12_codigo_corto.sql | public.generar_codigo_sala, public.side_normalizar_codigo_sala, public.unirse_partida_por_codigo | public.partidas |
| 2026-10-21_pausa_escrituras_estudiante.sql | side_private.comprobar_pausa | — |
| 2026-10-22_revertir_correcciones_conversacion.sql | public.side_contexto_cierre_excel, public.side_excel_features, public.side_expulsar_empresa, public.side_guardar_cierre_excel, public.side_podio_docente, public.side_preservar_cierre_excel_snapshot, public.side_preservar_reporte_excel, public.side_respuesta_ingreso, side_private.comprobar_expulsion, side_private.comprobar_pausa | public.participantes, public.side_excel_cierres |
| 2026-10-23_cierre_planes_v19.sql | public.side_contexto_cierre_negocio, public.side_diagnostico_v19, public.side_guardar_cierre_negocio, public.side_precios_v19_validos, public.side_validar_precios_v19 | — |
| 2026-10-23_configuracion_financiera.sql | public.side_contexto_cierre_excel, public.side_financial_values, public.side_schedule_financial | — |
| 2026-10-23_configuracion_version_v19.sql | public.side_config_revision_v19, public.side_guardar_configuracion_v19 | public.partidas |
| 2026-10-23_separacion_2d_3d.sql | — | — |
| 20260913000000_esquema_inicial.sql | public.buscar_partida_por_codigo, public.crear_perfil_profesor, public.side_next_game_code | public.decisiones, public.participantes, public.partidas, public.profesores |
| 20260929_guardar_puntaje_docente.sql | public.guardar_puntaje_docente | public.participantes |
| 20261023_cierre_negocio.sql | public.side_contexto_cierre_negocio, public.side_guardar_cierre_negocio | public.side_business_closures |
| 20261023_corregir_contexto_cierre_estado.sql | public.side_contexto_cierre_negocio | — |
| 20261023_persistir_snapshots_financieros.sql | public.side_guardar_cierre_negocio | — |
| 20261023_retirar_motor_anterior.sql | — | — |
| 20261027_logica_documento_costos.sql | — | — |
| 20261027_preservar_ciclo_snapshot.sql | public.guardar_estado_estudiante | — |
| 20261027_proteger_reportes_cerrados.sql | public.guardar_reporte_estudiante | — |
| 20261027_restaurar_decisiones_interfaz.sql | — | — |
| 20261027_resultados_en_vivo.sql | public.obtener_reporte_empresa | — |
| 20261028201422_bloquear_escritura_resultados_legacy.sql | — | — |
| 20261028_programar_cierre_edge.sql | public.side_invocar_cierre_programado, public.side_validar_token_cierre | — |
| supabase_game_codes.sql | public.side_game_features, public.side_next_game_code | public.partidas |
| supabase_teacher_grades.sql | public.guardar_puntaje_docente | public.participantes |
| supabase_teacher_history.sql | public.obtener_ultima_partida_docente, public.side_capturar_cierre_historial, public.side_historial_fecha_automatica, public.side_historial_partida_jugada, public.side_marcar_cierre_historial, public.side_registrar_historial_docente | public.partidas, public.side_teacher_history |
| supabase_teacher_integration.sql | public.avanzar_ciclo, public.crear_empresa, public.guardar_decisiones, public.side_ciclo_actual | — |
