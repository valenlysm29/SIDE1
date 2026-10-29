# Verificación de consecuencias y lotes

- `tests/excel_cache_replay.test.cjs` reproduce seis escenarios con salidas guardadas de Excel COM 16.0: 175 comparaciones en cinco escenarios y 48 de tres ciclos (223 comprobaciones). El test heredado usa tolerancia absoluta 1e-8; es una comparación parcial, no una prueba de equivalencia global ni confirma 226 comparaciones.
- `tests/restaurar_decisiones_oraculo.cjs`: 3.104 comparaciones aprobadas del motor histórico y sus oráculos derivados; no certifican el cierre económico actual.
- `tests/oracle_v19.cjs`: falla en el primer caso de mercado (86,3 frente a 92). Su referencia derivada usa calidad real; la hoja original `Costos De Producción!E118` usa proporción de reputación. Además, sus consecuencias prémium no coinciden en todos los umbrales con la instrucción vigente. Se conserva el resultado esperado y no se presenta como coincidencia.
- El cierre actual registra cantidades por lote y punto; las transferencias extraen FIFO del almacén y las ventas extraen FIFO del punto. El saldo histórico agregado usa exclusivamente las cantidades por tienda previamente registradas; varios lotes históricos sin localización verificable detienen el cierre, sin inventar movimientos.
- La prueba `edge_lotes_equivalencia.test.cjs` compara la salida completa del servidor local con la Edge Function empaquetada usando un RPC aislado. Las pruebas de tres ciclos usan una base aislada, no Supabase de producción.
- No se ha recalculado el libro completo, verificado un despliegue activo ni demostrado una equivalencia global.

- `tests/excel_calidad_comercial.test.cjs`: el caso de cuatro empresas reproduce el indicador literal de `Costos De Producción!E118` y 86,3; 92 corresponde al oráculo histórico que sustituye ese indicador por calidad real. La calidad real se conserva para las consecuencias por lote.
