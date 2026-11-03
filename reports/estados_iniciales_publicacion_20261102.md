# Estados iniciales: reproducción publicada y corrección

Se creó mediante la interfaz docente publicada la partida
**AUDITORÍA ESTADOS INICIALES 02-11-2026**, código **SIDE-3YKQ**, tres ciclos,
control manual. Se ingresó con la empresa de prueba **Auditoria Estados 0211**.
No se modificaron ni guardaron decisiones para la reproducción inicial.

Antes del cambio, la versión publicada mostró **BORRADOR** en Infraestructura;
al entrar por primera vez a Producción, la ayuda decía **Borrador local**.
La pestaña Producción no mostró una insignia BORRADOR en esta reproducción.
Los costos automáticos ya habían descontado S/ 2,712.32 de una caja inicial
de S/ 200,000. Reconocer el aviso de esos costos no equivale a tomar decisiones.

## Causa

`ensureCycleFixedCosts` crea registros de costos obligatorios. `categoryHasSaved`
deducía guardado desde completitud de decisiones, mientras Resumen deducía guardado
desde registros del ciclo actual. Ambos confundían existencia técnica con actividad
del estudiante; la ayuda de Producción era incondicional. La etiqueta procede del
frontend, no de un estado oficial asignado por Supabase o por una Edge Function.

## Cambio publicado

Se integró exclusivamente la corrección de estados sobre `origin/main` 9ccfcfc,
conservando su motor económico, controles, sincronización y actualización estable
de nodos de pestañas. No se copiaron archivos completos de una rama antigua.

- Procedencia automática en registros de costos y marca de guardado voluntario
  por apartado/ciclo dentro de `decision_state`, usando el contrato de snapshot.
- Resolvedor común para pestañas y Resumen. Planificación comparte Producción.
- Sin decisiones / En edición / Borrador guardado / Confirmado / Finalizado.
- Registros históricos ambiguos: Origen no verificado, sin borrarlos o atribuirlos
  a una nueva decisión. La ayuda distingue cambios locales y sincronización.
- No se afirma Procesando sin una señal autoritativa de ejecución del cierre.

## Validación previa

14 pruebas focales aprobadas: navegador, datos automáticos, guardado, recarga,
confirmación, continuidad de tres/seis ciclos, caja y preservación de históricos.
La puerta general de publicación aprobó **188 pruebas**, después de instalar
las dependencias fijadas en el lockfile. El runtime generado permanece equivalente;
no se despliega un motor nuevo. La prueba de navegador comprueba además que editar
no sustituya los nodos de las pestañas.

Las capturas y registros de aceptación remota se conservan en `tests/output/` del
workspace principal de SIDE1. La comprobación posterior se documenta allí después
del despliegue; este informe por sí solo no declara completada la aceptación remota.
