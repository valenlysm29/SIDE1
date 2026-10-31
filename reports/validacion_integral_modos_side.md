# Validación integral de modos SIDE

Base examinada: `b86c12e`, rama `logia_prueba_mejora`. Supabase de prueba local `127.0.0.1:59321`; no se modificó la base remota. El commit que contiene este informe puede identificarse con `git log -1 -- reports/validacion_integral_modos_side.md`.

## A. Resultados por modo

«Parcial» significa que existe evidencia de una parte del flujo, pero no de todos los requisitos de aceptación.

| Validación | Manual | Aleatorio | Equilibrado |
|---|---|---|---|
| Configuración docente | Parcial | Parcial | Parcial |
| Persistencia | Parcial | Parcial | Parcial |
| Partida 3 ciclos | Pendiente | Pendiente | Pendiente |
| Partida 6 ciclos | Parcial, PGlite | Parcial, PGlite | Parcial, PGlite |
| Compras y producción | Parcial, prueba separada | Parcial, prueba separada | Parcial, prueba separada |
| Cierres oficiales | Parcial | Parcial | Parcial |
| Conciliación financiera | Parcial | Parcial | Parcial |
| Interfaz real | Parcial | Parcial | Parcial |
| Seguridad y concurrencia | Parcial | Parcial | Parcial |

La prueba por navegador creó una sala local y seleccionó las tres opciones mediante clics. No incluyó participantes, cierre ni finalización por interfaz. La comprobación `tests/output/comprobacion_modos_local.py` usó Auth y RPC locales reales para asignación, sorteo o rotación, consulta estudiantil e historial; creó salas de prueba mediante SQL y no ejecutó seis ciclos. No demuestra la selección al crear la sala ni todos los permisos.

Las 16 pruebas focales en `tests/output/validacion_modos_focal_actual.log` pasaron. Incluyen seis ciclos con tres empresas en PGlite para Manual y Aleatorio, una rotación Equilibrada de seis ciclos, persistencia de sorteos y una prueba separada de compra, recepción, producción y costo. Estas pruebas simulan parte del acceso de servidor y no constituyen partidas completas con Auth, compras y navegación reales. `node --test tests/evento_autoritativo_postgres.test.cjs tests/side_cierre_concurrente_pg.test.cjs` aprobó dos pruebas en PostgreSQL aislado: asignaciones y cierre concurrentes, con roles Auth simulados; no demuestra cierres simultáneos mediante Edge.

PE69 es producto viral en TikTok y PE71 recomendación de influencer: ambos elevan el atractivo relativo; PE75 es campaña ineficiente y lo reduce. La programación requiere habilitar los tres, rota su asignación y persiste el resultado; para tres empresas en seis ciclos la prueba verifica dos exposiciones por evento y suma de intensidad nominal de 8 por evento y empresa. No demuestra igualdad económica ni equilibrio para tres ciclos o plantillas distintas.

La comparación pareada focal de seis ciclos, con decisiones iguales entre los escenarios con y sin eventos, registró variaciones acumuladas de ventas de -2, -1 y +3 unidades; costos de -237,90, -118,97 y +356,87; utilidad de +152,90, +76,47 y -229,37; caja final de -963,89, -902,67 y +1.866,58. La rotación depende de la partida y el resultado puede variar. Es un escenario PGlite con decisiones inyectadas; no cubre todas las estrategias ni mide equidad general.

## B. Correcciones

En esta ejecución no se modificó lógica ni pruebas. Las limitaciones anteriores no se corrigieron: requieren construir y ejecutar los seis recorridos integrados reales, con compras por presentaciones y recepciones parciales durante toda la partida. No se inventó un defecto a partir de una falta de cobertura.

## C. Regresión

Se ejecutaron los archivos `tests/*.test.js` y `tests/*.test.cjs` con concurrencia 2: 842 pruebas, 825 aprobadas, 17 fallidas, 0 canceladas y 0 omitidas. Los 17 nombres fallidos coinciden con la referencia `tests/output/regresion_compras_final.log`; no se identificó un fallo nuevo por nombre. La referencia informó 968 pruebas: las listas ejecutadas no son equivalentes, por lo que no se comparan totales como una regresión completa. El detalle actual está en `tests/output/validacion_modos_regresion_actual.log`.

## D. Estado final

Ningún modo está completamente validado según los criterios solicitados. Faltan los seis escenarios completos de 3 y 6 ciclos con al menos dos empresas en Supabase local, integración de compras, recepciones, Kardex, finanzas y finalización; faltan además cierre y avance completos mediante clics, y concurrencia de Edge en esos escenarios. Existe riesgo de divergencia entre las pruebas aisladas y el recorrido real. Los cierres históricos y las bases remotas no se alteraron; no se hizo push ni despliegue.


## Continuación: seis salas reales aisladas

Se creó el proyecto local `modos-e2e` en `127.0.0.1:62321`, con PostgreSQL, Auth y Edge, aplicando las migraciones de la rama a una base nueva. `python tests/modos_local_reales.py` crea cada sala mediante `crear_sala_docente`, reintenta la misma solicitud, integra tres sesiones estudiantiles mediante `side_ingresar_empresa_segura`, guarda el modo, programa el primer ciclo y consulta noticias. No usa PGlite ni escrituras SQL directas para crear salas o decisiones. El programa devuelve error mientras falte completar los ciclos; los resultados se guardaron en `tests/output/modos_local_reales.json`.

| Modo | Duración | Empresas integradas | Ciclos completos | Compras/recepciones/producción | Finanzas/cierre/avance | Interfaz real |
|---|---:|---:|---:|---|---|---|
| Manual | 3 | 3 | 0 | Pendiente | Pendiente | Pendiente en esta sala |
| Manual | 6 | 3 | 0 | Pendiente | Pendiente | Pendiente en esta sala |
| Aleatorio | 3 | 3 | 0 | Pendiente | Pendiente | Pendiente en esta sala |
| Aleatorio | 6 | 3 | 0 | Pendiente | Pendiente | Pendiente en esta sala |
| Equilibrado | 3 | 3 | 0 | Pendiente | Pendiente | Pendiente en esta sala |
| Equilibrado | 6 | 3 | 0 | Pendiente | Pendiente | Pendiente en esta sala |

En las seis salas pasaron Auth docente, creación y reintento idempotente, ingreso de empresas, persistencia del modo, programación del primer ciclo y lectura de noticias. Aleatorio y Equilibrado también recuperaron el primer sorteo o programación en el reintento. La prueba no verifica todavía la semilla, los ciclos posteriores ni el contenido económico de las noticias. Todas estas operaciones se hicieron por HTTP autenticado, sin clics.

La Edge local respondió 401 con token inválido y 200 con token válido y lista vacía de cierres. Esto verifica autorización y ejecución sin trabajo, no cierre ni concurrencia. La prueba no automatiza aún decisiones y compras mediante controles reales, recepciones, cierre Edge con trabajo, avance ni finalización. Por eso los seis escenarios siguen sin aprobarse; no se encontró un defecto funcional reproducible en los pasos ejecutados y no se cambió la lógica del producto. No se repitió la regresión general porque no se modificó el producto; se conserva la selección previa de 825 aprobadas y 17 fallidas. No hubo despliegue ni cambios en bases remotas.
