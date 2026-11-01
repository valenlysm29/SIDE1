# Corrección de continuidad de resultados SIDE

Fecha: 1 de noviembre de 2026. Estado: **incompleto; no publicar en main**.

## Revisión de partida

El remoto corresponde a `valenlysm29/SIDE1`. Se inició desde `origin/main` `afd7f736746988b99d9091717a4297de391874c3`; la rama `codex/continuidad-empresarial` ya es antecesora de main. La actualización general de referencias falló para `origin/develop` por `reference already exists`; `git ls-remote` confirmó la referencia main indicada. Se preservaron los archivos preexistentes sin seguimiento. Rama de trabajo: `codex/continuidad-resultados-integral`.

## Avance implementado

La pantalla de Ventas muestra el texto solicitado de distribución automática y elimina el control de reparto manual y su guardado en decisiones nuevas. El motor local y su copia Edge usan el reparto automático determinista incluso si reciben asignaciones antiguas; los cierres históricos persistidos no se modifican. Se conservó la validación existente de transferencias antiguas en el servicio para no debilitar los controles: puede seguir rechazando datos históricos inválidos y requiere revisión de compatibilidad. Archivos: `js/app.js`, `js/engine/cierre.js`, `supabase/functions/side-business-close/runtime.mjs`, `tests/side_store_distribution.test.cjs` y este informe. El runtime Edge modificado no ha sido desplegado.

## Pruebas y riesgos

Pasaron 28 pruebas focales de distribución, inventario, ventas y worker (`node --test tests/side_store_distribution.test.cjs tests/side_sales_invariants.test.cjs tests/sales_accounting_integration.test.cjs tests/authoritative_worker.test.cjs`). Incluyen escasez y desempate determinista, conservación de existencias, ventas reales, idempotencia y rechazo de datos financieros no verificados. Una ejecución intermedia falló al retirar la validación de transferencias antiguas; se restauró y la ejecución final pasó. La prueba histórica `tests/side_manual_distribution_ui.cjs` comprueba la interfaz retirada y necesita sustitución por una prueba de navegador del flujo automático. No se han probado garantías, devoluciones, todas las restricciones logísticas ni la equivalencia integral del runtime Edge con partidas históricas. El comportamiento de decisiones manuales antiguas pendientes de cierre cambia y requiere revisión antes del despliegue.

## Continuidad, API y Supabase

No se ha establecido la causa del error `DATOS_ECONOMICOS_NO_VERIFICADOS` de SIDE-FWPZ ni se han modificado sus datos. No se ha demostrado la actualización continua de Empresas, el selector histórico de Resultados ni la cobertura del Laboratorio. No se han ejecutado consultas nuevas sobre Auth, RLS, RPC o Edge remotos; no se ha efectuado ninguna migración. Una búsqueda de CPI en código JS, TypeScript y SQL del proyecto no encontró una integración identificada por ese nombre; no se puede concluir que el término signifique API.

El informe previo local `reports/auditoria_sincronizacion_github_supabase_SIDE.md` documenta 12 balances históricos descuadrados en una auditoría anterior, sin causa establecida; no son evidencia de una regresión de este cambio. Deben investigarse sin alterar cierres históricos. La validación entre Empresas, Resultados, Laboratorio y PostgreSQL sigue pendiente.

## Bloqueos y publicación

No se realizaron las pruebas reales autenticadas de tres y seis ciclos en una base de ensayo, ni los recorridos de interfaz, persistencia, red y concurrencia exigidos. No hay conciliación integral ni despliegue comprobado. No se ha comprobado una base de ensayo disponible. Tampoco se ha ejecutado la suite completa ni clasificado todos los fallos históricos. Las migraciones y Edge necesarias para el conjunto completo siguen por determinar. Por estas razones no se autorizan merge ni publicación en `main`. El commit de avance y su estado remoto se identifican en el historial de Git; esta entrega no declara terminada la corrección.

## Continuación — 1 de noviembre de 2026

Se confirmó mediante consulta de solo lectura que SIDE-FWPZ está finalizada, configurada para 3 ciclos y tiene exclusivamente cierre oficial 1. De cuatro empresas participantes, cuatro snapshots contienen plan del ciclo 2, tres contienen plan del ciclo 3 y dos contienen eventos en `__cycleBusiness[2]`. En el servicio y runtime, la presencia de eventos en el snapshot produce `DATOS_ECONOMICOS_NO_VERIFICADOS` antes de recuperar los eventos verificados del servidor. Esta condición explica un rechazo posible y concuerda con el error informado, pero no demuestra que los efectos históricos se puedan reconstruir; no se alteraron registros ni se retiró la validación.

Cambios parciales en esta rama: `js/docente.js` permite visualizar como estimación individual un plan confirmado del ciclo actual que antes se descartaba; no convierte el snapshot en cierre oficial. `services/laboratorio_service.js` lee la configuración de duración de la partida; `js/laboratorio.js` consulta los ciclos configurados, muestra los que no tienen cierre o cuya consulta falló y conserva cierres ya consultados si falla una consulta posterior. Si falta configuración usa hasta seis períodos como referencia, sin declarar que estén configurados. La consulta de cierre sigue siendo la RPC oficial. Esto aún requiere validación integral de seguridad, exactitud y navegador, especialmente con múltiples partidas y fallos de red.

Pruebas focales: 26/26 de sincronización docente, aislamiento de resultados, presencia y módulos de laboratorio. Una primera ejecución falló porque una prueba esperaba la antigua lista de columnas; se actualizó para incluir `configuracion` y la ejecución final pasó. No se han realizado recorridos de tres ni seis ciclos autenticados de extremo a extremo. Supabase lista únicamente el proyecto SIDE y ninguna rama de ensayo; no se creó una rama facturable ni se modificó la base real. No se ha verificado la conciliación entre vistas, las garantías y devoluciones, los doce balances históricos ni la compatibilidad Edge completa. El selector histórico de Resultados, la continuidad de planes y la prevención de finalizaciones incompletas siguen pendientes. No desplegar ni fusionar en main.
