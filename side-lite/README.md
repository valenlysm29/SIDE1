# SIDE Lite — demostración en desarrollo

SIDE Lite contiene un motor económico local y una interfaz de práctica. **No es una plataforma oficial ni multijugador**: no hay cuentas, servidor, persistencia, reloj oficial ni cierre autorizado. Los datos de la práctica se pierden al recargar. Nunca conectar al proyecto Supabase de SIDE original.

## Ejecutar la demostración

Desde `side-lite/`, iniciar un servidor estático, por ejemplo `python -m http.server 8080`, y abrir `http://localhost:8080`. Elegir tres o seis ciclos, un evento opcional y las cuatro decisiones. La tienda y el capital se sortean al empezar una práctica. Los eventos son opciones manuales de demostración.

## Pruebas

Ejecutar `npm test` con Node.js. El modelo comprueba caja, FIFO, eventos, rentabilidad y marketing; estas pruebas no sustituyen pruebas de seguridad, concurrencia, persistencia o integración.

## Reglas económicas v2

La compra se añade como lote al costo ajustado por evento; las ventas consumen lotes FIFO. La utilidad resta costo de ventas y marketing; la caja resta compra y marketing y suma ingresos. Sin decisión confirmada no hay compras, gastos ni ventas. El inventario remanente se conserva.

Marketing admite S/ 0 o un monto entero de S/ 200 a S/ 10.000. Su factor de demanda es `1 + 0.3 * ln(1 + monto/1000) / ln(11)`: crece con rendimiento decreciente hasta un máximo del 30 %. No garantiza ventas o utilidad.

La demanda base es 300 multiplicada por factores de calidad, marketing, precio, evento y variación reproducible de 0,95 a 1,05. El factor de precio es 100/precio, limitado entre 0,1 y 2. Los doce eventos y parámetros están versionados en `js/engine.js`. El ranking utiliza (caja + valor FIFO del inventario - capital inicial) / capital inicial; desempata por caja y nombre.

Este módulo no es una autoridad de cierre. Faltan backend PostgreSQL, autenticación y permisos, cierre transaccional, programación automática, gestión de partidas y docente, controles de concurrencia, migraciones compatibles con Supabase, integración y pruebas integrales. La creación de un proyecto Supabase independiente fue rechazada por límite de proyectos gratuitos en la organización autorizada.
