# Informe técnico: Laboratorio Estratégico

Base: 6ea7cc2b1ca5dafd0a9e2341b8d5471116c92803. Rama: codex/laboratorio-estrategico.

## Auditoría de fuentes y seguridad

Se inspeccionó el esquema remoto de partidas, participantes, empresas, reportes_ciclo y side_business_closures mediante lectura. Las políticas de SELECT de partidas y participantes relacionan el profesor con auth.uid(). side_business_closures tiene RLS y carece de una política SELECT directa; la función existente side_consultar_cierre_negocio(uuid, integer) comprueba la propiedad con auth.uid() antes de devolver el cierre. Se usa esa función, no obtener_ultima_partida_docente: esta última sincroniza y registra historial y no es estrictamente de lectura. El RPC existente devuelve todas las empresas del ciclo, no filtra por empresa; restringir columnas y empresas en el servidor requiere una nueva RPC no desplegada. El servicio comprueba sesión con getUser y usa el cliente habitual; no usa service_role. No se ha ejecutado ninguna escritura remota ni migración.

El cierre contiene resultadosPorEmpresa con receipt, financial, state y ledger. El laboratorio solo usa receipt y financial. No lee reportes_ciclo como cierre canónico ni reconstruye finanzas históricas desde decisiones editables. Las comprobaciones financieras disponibles son parciales. No se demuestra la causa de la brecha ni se recalcula un escenario: faltan validaciones de entradas históricas, versión del motor, tiempos de recepción y competencia. No se modifica la función Edge.

## Pruebas

Se ejecutaron pruebas Node focales de modelo del laboratorio, aislamiento de resultados docentes, autorización del worker, aislamiento de autenticación, errores de sincronización, producción y contabilidad: 32 aprobadas, 0 fallidas. Incluyen cero, pérdida, ausencia, discrepancia y que la brecha productiva no se describa como ventas perdidas. Las pruebas no son prueba de autorización remota con sesión docente ni sustituyen una auditoría contable. La suite histórica documenta 17 fallos en docs/auditoria_logica_empresarial_SIDE_6_ciclos.md; no se ha vuelto a ejecutar completa, de modo que no se compararon sus fallos individualmente.

La inspección remota fue administrativa y de solo lectura; no se contó con una sesión docente autenticada para probar la experiencia de extremo a extremo, acceso denegado entre docentes ni lectura de cifras de una partida seleccionada. La prueba visual local con datos sintéticos se detalla abajo. Quedan pendientes la sesión docente real, lector de pantalla y pruebas exhaustivas de respuestas concurrentes antes de considerar el MVP listo para producción.

## Limitaciones pendientes

- RPC existente entrega el ciclo completo de la partida autorizada; no satisface el filtrado por empresa en servidor.
- No se ha validado ejecución cuantitativa de escenarios ni comparativa de participación de mercado.
- El modo estudiante oculta controles en pantalla; no es una frontera de seguridad frente a quien controle el navegador. No presenta la comparación de otras empresas en modo proyección.
- Lista de partidas limitada a 100 y empresas a 200; paginación pendiente.
- La verificación financiera no detecta todas las inconsistencias posibles.
- No se ha probado el rechazo de partidas ajenas mediante una sesión real, aunque se inspeccionó el predicado del RPC y las políticas.

## Resultados visuales y regresiones adicionales

Chromium de escritorio (1365 × 900) y móvil (390 × 844): navegación, gráfico, selección de alternativa, comparación y modo explicación aprobados con datos sintéticos exclusivamente locales; se bloquearon peticiones externas. Capturas en tests/output/laboratorio_escritorio.png, laboratorio_movil.png y laboratorio_explicacion_*.png. No demuestran acceso autenticado real ni ausencia de parpadeos o carreras en todos los casos.

En otras 14 pruebas focales hubo 11 aprobadas y 3 fallos: rendering an empty plan preserves inputs and shows zero output, percent and mold detail; material requirement labels are escaped and coverage is supplied by the model; persisted adapter plans render real comparison stock without mutating snapshots, todas de production_dop.test.js. Los archivos de producción y esas pruebas no se modificaron en esta rama. La auditoría histórica incluye fallos visuales de producción, pero no se ha demostrado aquí la identidad exacta con los 17 casos: requieren comparación individual con una ejecución limpia de la base.
