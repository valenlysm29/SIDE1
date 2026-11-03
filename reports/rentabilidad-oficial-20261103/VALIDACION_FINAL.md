# Prueba final real de rentabilidad — SIDE-WWZB

3 de noviembre de 2026. Resultado: **APROBADO**, tres empresas con utilidad neta positiva en el cierre oficial del ciclo 1. No fue necesaria otra corrección del motor.

## Identificación y despliegue

- Partida nueva: SIDE-WWZB, id 0dee449b-3643-4f62-84ae-8805341af68b.
- Nombre: QA Rentabilidad Oficial 8cd602a; propietario docente QA separado del usuario.
- Motor económico: utility-v1 desde ciclo 1; trabajador secuencial 1.
- Código económico probado: main, 8cd602a890eab73877c4d201a43c264318404ca1.
- Servicio real: proyecto Supabase SIDE, plfuwfdpsagzrlveqkvl; Edge Function side-business-close versión 16.
- Web publicada: https://valenlysm29.github.io/SIDE1/. Ocho archivos descargados coinciden exactamente con el commit probado: HTML de Estudiante/Docente, configuración financiera, cierre económico, historial oficial y las tres vistas.
- Cierre persistido: 03/11/2026 a las 10:45:47.782, hora de Lima. Intento aebed539-9bca-4faf-bad5-7cda1c235f5b, outcome confirmed; petición HTTP 9329.
- Tres ciclos configurados, modo manual, capital S/ 50,000 por empresa, sin eventos, préstamos, analista ni publicidad. El impuesto se liquida en el ciclo final según la política vigente; el impuesto del ciclo 1 es cero.

## Resultados oficiales

Los valores siguientes proceden de side_historial_oficial y reportes_ciclo, después de cerrar mediante la Edge Function desplegada. No son proyecciones ni recálculos locales.

| Empresa / ID | Producidas | Vendidas | Ingresos S/ | Costo de ventas S/ | Gasto operativo S/ | Utilidad neta S/ | Caja final S/ |
|---|---:|---:|---:|---:|---:|---:|---:|
| QA Básico Eficiente / 208 | 250 | 250 | 30,000.00 | 15,818.55 | 3,573.57 | **10,607.88** | 39,303.63 |
| QA Estándar Eficiente / 209 | 250 | 250 | 37,500.00 | 16,703.55 | 3,652.32 | **17,144.13** | 43,430.88 |
| QA Prémium Eficiente / 210 | 100 | 100 | 39,200.00 | 19,931.78 | 3,648.90 | **15,619.32** | 46,743.70 |

Los costos totales son S/ 19,392.12; S/ 20,355.87; S/ 23,580.68. No hubo gastos financieros ni otros ingresos financieros. Utilidad conjunta: S/ 43,371.33.

Precios base internos: básico S/ 120, estándar S/ 150, prémium S/ 280. El prémium recibió la bonificación vigente de 40% por calidad e insumos prémium trazables, por lo que el precio efectivo oficial fue **S/ 392**. La prueba no escribió precios, ingresos, utilidades ni saldos finales.

## Estrategias enviadas

- Básico: dos mesas, dos ensambladoras básicas, dos equipos básicos de acabados, dos operarios básicos por etapa, molde básico, canal web. Compras: 75 m² de cuero sintético, 250 accesorios económicos y 1,500 metros de hilo estándar.
- Estándar: igual dotación, molde mejorado, canal web. Compras: 100 m² de cuero sintético, 250 accesorios económicos y 1,750 metros de hilo estándar.
- Prémium: una mesa, una ensambladora básica, un equipo básico de acabado, un operario básico por etapa, molde prémium y canal web. Compras: 70 m² de cuero prémium, 100 accesorios prémium y 1,300 metros de hilo prémium.

Las metas fueron 250, 250 y 100. No hubo jefatura, aportes adicionales ni transferencias artificiales. Los planes completos están en planes-enviados.json.

## Ejecución real y conciliación

Se provisionó una identidad docente QA y tres sesiones de estudiante aisladas. La sala se creó con crear_sala_docente, las empresas ingresaron con side_ingresar_empresa_segura y sus planes se enviaron con guardar_estado_estudiante usando sus propias sesiones. Solo se adelantó la hora de inicio de integración de esta nueva sala QA; se conservaron las transiciones reales. El cierre se solicitó con controlar_partida y se ejecutó por side_invocar_cierre_programado/Edge, sin descargar ni exponer el secreto del programador.

Para cada empresa se verificó:
1. Ventas = suma de unidades vendidas por precio efectivo.
2. Ingresos menos costo de ventas, gastos e impuesto = utilidad neta.
3. Caja inicial más entradas menos salidas = caja final.
4. Activos = pasivo más patrimonio; patrimonio = capital más resultados.
5. Producción y ventas iguales a las metas factibles, sin inventario gratuito.
6. Relectura del cierre consistente después de abrir las tres interfaces.

La caja difiere de la utilidad por compras de activos y crédito a clientes, entre otros movimientos registrados. No se confundió inversión con gasto ni utilidad con efectivo.

## Estudiante, Docente y Laboratorio

Se probaron las páginas reales publicadas en Chromium, con autenticación y RPC reales, sin interceptar respuestas ni sustituir servicios:
- Estudiante: las tres empresas reingresaron con sus sesiones. financialReport devolvió exactamente los cuatro estados oficiales; los importes visibles de utilidad y caja coinciden.
- Docente: los estados de resultados, caja, flujo y balance general de las tres empresas son idénticos al cierre. La tabla comparativa muestra los mismos ingresos, utilidad y caja.
- Laboratorio: consulta el mismo historial oficial completo; las métricas visibles de ventas/utilidad y el desglose económico coinciden y concilian.

**9 de 9 comprobaciones aprobadas**, sin errores de página. Evidencia en verificacion-tres-vistas.json. Se guardaron nueve capturas locales en tests/output/rentabilidad-oficial/.

## Históricos preservados y alcance

Antes: 166 cierres y 213 reportes. Después: 167 cierres y 216 reportes, incorporando únicamente esta partida y sus tres empresas. Los hashes de los registros anteriores permanecen idénticos:
- Cierres: 4ddca1a638bc0800e5b458246e3a5440.
- Reportes completos: d9d876913f6b4369fbca2bf9dc0f1dcf.

La petición global del trabajador respondió HTTP 503 porque otras cuatro partidas históricas pendientes conservan sus errores previos de decisiones o datos no verificables. En esa misma respuesta, **SIDE-WWZB figura success:true, pending:false**, con sello oficial y seguimiento confirmed. No se corrigieron ni alteraron esas partidas ajenas a esta prueba. Una solicitud previa sufrió un fallo transitorio HTTP/JSON; el reintento real confirmó el cierre una sola vez.

No se modificaron reglas económicas, precios, demanda ni interfaces durante esta validación. La publicación adicional contiene únicamente pruebas y evidencia.

## Archivos y reproducción

- resultados-oficiales.json: cifras e identificación del cierre.
- evidencia-supabase.json: resultados persistidos, intento Edge y hashes.
- despliegue.json: comparación de archivos publicados con 8cd602a.
- verificacion-tres-vistas.json: las nueve comprobaciones de interfaz.
- planes-enviados.json: decisiones de entrada.

Scripts de QA conectada: tests/rentabilidad_oficial_setup.py, rentabilidad_oficial_submit.py, rentabilidad_oficial_read.py, rentabilidad_oficial_deployment.py y rentabilidad_oficial_browser.py. Los dos scripts que escriben exigen SIDE_RUN_CONNECTED_QA=1 y sesiones propias de QA. Las credenciales y sesiones permanecen únicamente en archivos locales ignorados; no se publicaron en Git. El setup reanuda su manifiesto existente para no duplicar salas.
