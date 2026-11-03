# SIDE Lite — trabajo en desarrollo

Este directorio contiene exclusivamente el núcleo económico inicial de SIDE Lite. **No es todavía una aplicación jugable ni un backend de producción.** No conectar al proyecto SIDE original.

## Pruebas

Ejecutar `npm test` desde este directorio con Node.js instalado.

## Reglas económicas v1

La compra se registra al costo unitario ajustado por el evento y se añade como un lote. Las ventas consumen lotes por orden de entrada (FIFO). La utilidad resta el costo de los lotes vendidos y el marketing; la caja resta la compra y el marketing y suma los ingresos. Una decisión ausente no compra, gasta ni vende. El inventario remanente se conserva.

La demanda base es 300, multiplicada por factores de calidad, marketing, precio, evento y variación reproducible de 0,95 a 1,05. El factor de precio es 100/precio, limitado entre 0,1 y 2. Los parámetros y los doce eventos están versionados en `js/engine.js`. El ranking utiliza (caja + valor FIFO del inventario - capital inicial) / capital inicial; desempata por caja y nombre.

Este módulo es un modelo local para verificar reglas; no es una autoridad de cierre, y no debe utilizarse como tal en un navegador. Antes de su uso real faltan el cierre transaccional del servidor, autenticación, RLS, programación automática, gestión de partidas y controles de concurrencia, interfaz, integración de Supabase y pruebas integrales de seguridad y despliegue.
