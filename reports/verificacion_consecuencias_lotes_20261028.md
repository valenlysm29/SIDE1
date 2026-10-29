# Verificación de consecuencias y lotes

- `tests/excel_cache_replay.test.cjs` reproduce seis escenarios con salidas guardadas de Excel COM 16.0: 175 comparaciones en cinco escenarios y 48 de tres ciclos (223 comprobaciones). El test heredado usa tolerancia absoluta 1e-8; es una comparación parcial, no una prueba de equivalencia global ni confirma 226 comparaciones.
- `tests/restaurar_decisiones_oraculo.cjs`: 3.104 comparaciones aprobadas del motor histórico y sus oráculos derivados; no certifican el cierre económico actual.
- `tests/oracle_v19.cjs`: falla en el primer caso de mercado (86,3 frente a 92). Su referencia derivada usa calidad real; la hoja original `Costos De Producción!E118` usa proporción de reputación. Además, sus consecuencias prémium no coinciden en todos los umbrales con la instrucción vigente. Se conserva el resultado esperado y no se presenta como coincidencia.
- La asignación de ventas a lotes es FIFO contable global. Las existencias por tienda siguen siendo cantidades agregadas: no se dispone de movimientos físicos de lotes por tienda, por lo que la atribución al punto de venta no acredita la ubicación física de cada lote.
- La prueba `edge_lotes_equivalencia.test.cjs` compara la salida completa del servidor local con la Edge Function empaquetada usando un RPC aislado. Las pruebas de tres ciclos usan una base aislada, no Supabase de producción.
- No se ha recalculado el libro completo, verificado un despliegue activo ni demostrado una equivalencia global.
