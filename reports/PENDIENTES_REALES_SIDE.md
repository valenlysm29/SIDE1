# Pendientes reales SIDE

| Requisito | Estado | Evidencia y siguiente paso |
|---|---|---|
| Seis partidas 3/6 ciclos con tres empresas | NO EJECUTADO | `tests/modos_local_reales.py` llega hasta noticias; ampliar para conservar sesiones en memoria y completar decisiones, pedidos, recepciones, producción, Edge y avance. |
| Interfaz de compras y decisiones | NO EJECUTADO | `tests/modos_navegador_local.cjs` solo cubre creación y selección de modo; adaptar `tests/p01_http_browser_admission.cjs` evitando la preparación SQL de estado. |
| Recepciones y Kardex en cada ciclo | NO EJECUTADO | Usar `side_material_preview_v1` y `side_registrar_entrega_proveedor_v1` con sesiones autorizadas; verificar entradas parciales y saldos, sin alterar registros históricos. |
| Cierre Edge concurrente | NO EJECUTADO | Crear una instancia local nueva y un cierre pendiente propio; invocar dos veces la Edge y verificar una sola liquidación y reintentos. No usar la instancia local con partidas anteriores. |
| Capacidad, producción, inventario, ventas y finanzas de las seis partidas | NO EJECUTADO | Conciliar registros físicos y balances de cada ciclo al existir cierres reales. No cambiar fórmulas sin defecto reproducible. |
| Contraste del Excel | NO EJECUTADO | El archivo `output/SIDE_prueba_cantidad_produccion_corregido.xlsx` no está disponible; recuperarlo desde una fuente autorizada sin sobrescribir archivos existentes. |
| Selector de modos en navegador | APROBADO | `node tests/modos_navegador_local.cjs` con servidor en 62380 y Supabase local en 62321: los tres modos persisten tras recargar. |
| Focales de eventos, producción y compras | APROBADO | 16 pruebas focales; su base es PGlite y no reemplaza la integración real. |
| 17 fallos históricos | NO EJECUTADO | En la referencia previa siete pruebas dependen del Excel ausente; otros diez corresponden a expectativas de producción y UI. Revisar cada caso contra contratos vigentes, sin modificar lógica solo para hacerlos pasar. |

Los detalles de preparación y las restricciones de seguridad están en `reports/ESTADO_ACTUAL_Y_PENDIENTES_SIDE.md` y `docs/guia_continuidad_local_side.md`.
