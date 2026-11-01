# Resultado de los seis escenarios SIDE

Fecha: 1 de noviembre de 2026. Rama: `codex/finanzas-tres-modos`; base de trabajo `fdf0abf`. **Estado: validación integral y publicación pendientes.**

| Modo | Ciclos | Tres empresas y cierres Edge por API | Recorrido íntegro por interfaces y tres vistas |
|---|---:|---|---|
| Manual | 3 | 3 cierres; `tests/output/continuacion_cierre_manual_final.log` | Pendiente |
| Manual | 6 | 6 cierres; `tests/output/final_6_manual_api_6.log` | Pendiente |
| Aleatorio | 3 | 3 cierres; `tests/output/final_6_random_api_3_reintento.log` | Pendiente |
| Aleatorio | 6 | 6 cierres; `tests/output/final_6_random_api_6_reintento.log` | Pendiente |
| Equilibrado | 3 | 3 cierres; `tests/output/final_6_balanced_api_3.log` | Pendiente |
| Equilibrado | 6 | 6 cierres; `tests/output/final_6_balanced_api_6.log` | Pendiente |

Los 27 cierres de la tabla son ensayos parciales con autenticación, HTTP, PostgreSQL y Edge locales: las decisiones se enviaron por API y no prueban las tres vistas. Sus pruebas verifican un cierre persistido por ciclo, resultados de tres empresas, balance e idempotencia de recepciones. No son 6/6 aprobaciones integrales.

En otro ensayo, tres estudiantes ingresaron y confirmaron decisiones mediante sus interfaces; se registraron recepciones y Edge guardó el primer cierre con tres balances cuadrados. Evidencia: `tests/output/final_6_ui_manual_3_reintento.log` y consulta local de solo lectura. El guion consideró fallida la respuesta global porque Edge también informó errores de otras partidas locales pendientes; el resultado de la partida propia era exitoso. Ese ensayo no ha completado los tres ciclos ni las tres vistas. La versión posterior del guion avanzó al ciclo 2 y quedó detenida al intentar seleccionar nuevamente un molde ya bloqueado; se ajustó para respetar el bloqueo. Los datos de ensayo anteriores no se modificaron.

Aleatorio falló inicialmente porque el guion llamó `side_draw_all_events_v1`, una función inexistente; al usar la función oficial `side_draw_events_v1`, ambos tamaños completaron sus cierres parciales. No se alteró lógica de producto. La suite anterior registra 952 aprobadas y 16 fallos históricos, sin fallos nuevos por nombre (`reports/VALIDACION_FINAL_FINANZAS_Y_TRES_MODOS.md`). No se ha demostrado aquí que todos esos fallos se reproduzcan en main o carezcan de impacto financiero.

**Finanzas y vistas:** los balances de los cierres de la tabla cuadran en los controles ejecutados; esto no acredita toda la cadena financiera ni conciliación visible Estudiante–Docente–Laboratorio. La prueba de cierre contradictorio mediante Edge/PostgreSQL y rollback sigue pendiente. **Integración:** ninguna en `main`; no hay commit publicado. No se ha desplegado Supabase de producción ni alterado registros históricos. La integración está condicionada a completar los seis recorridos y controles críticos exigidos.

### Avance adicional por interfaz

`tests/output/final_6_ui_multiciclo_manual_3_v3.log` registra una partida Manual con tres estudiantes autenticados, decisiones confirmadas mediante sus controles, recepciones registradas mediante RPC y tres cierres Edge con tres balances cuadrados por ciclo. Avanzó mediante `controlar_partida` sin cambiar el ciclo por SQL. El guion no verificó las vistas Estudiante, Docente y Laboratorio ni las recepciones por controles visibles; **el escenario integral sigue pendiente**. Los scripts de prueba locales se conservan en `tests/output/final_6_ui_multiciclo.cjs` y `tests/output/final_6_ui_modos.cjs`.

En la partida Manual terminada, se volvió a entrar por la interfaz del docente: Laboratorio mostró los tres ciclos cerrados y, para la empresa 1 del ciclo 1, ventas S/ 3.500 y utilidad S/ -5.370,38, coincidentes con una lectura del cierre oficial. La pestaña Resultados mostró cero empresas y «Sin resultados recibidos» en esa sesión. Se desconoce si se necesita seleccionar la partida terminada por otra ruta o si hay un defecto; no se ha validado Estudiante–Docente–Laboratorio. Registro: `tests/output/final_6_vistas_docente.log`.

Los cinco ensayos simultáneos posteriores encontraron problemas durante la admisión y Auth registró HTTP 429. En el proyecto aislado se aumentó únicamente el límite local de cuentas anónimas de 30 a 500 y se reinició esa instancia conservando volúmenes. No se cambió configuración remota. Los escenarios se reintentaron secuencialmente; los resultados finales deben constar en los registros individuales antes de calificarlos.

Aleatorio de tres ciclos completó decisiones por interfaz de tres estudiantes y tres cierres Edge con balances cuadrados tras recargar cada sesión después del avance (`tests/output/final_6_ui_random_3_reintento2.log`). Las recepciones se registraron mediante RPC y no se conciliaron las tres vistas; permanece como **parcial**. El primer intento mostró una sesión que no recuperó el menú tras el avance; la recarga permitió continuar, sin demostrar todavía si existe un defecto de sincronización de la interfaz.

En la misma sesión docente, la pestaña Historial indicó explícitamente `HISTORIAL_NO_CONFIGURADO`; el servicio apunta a `supabase/migrations/supabase_teacher_history.sql`. Ese archivo contiene una actualización de partidas previas, por lo que no se aplicó sobre los registros locales existentes. Debe prepararse una base limpia que lo incluya desde el inicio para comprobar si Historial ofrece la ruta esperada a la partida finalizada. Registro: `tests/output/final_6_vistas_historial.log`.

Los reintentos de seis ciclos han encontrado bloqueos de automatización: Manual alcanzó dos cierres y luego agotó el tiempo de recarga; Aleatorio alcanzó un ciclo y posteriormente no apareció el menú de Infraestructura. Equilibrado de tres ciclos alcanzó dos cierres y se detuvo también al esperar ese menú durante el tercer ciclo (`tests/output/final_6_ui_balanced_3_reintento2.log`). No se atribuye la causa al motor ni se considera aprobado: se preparó una captura del estado visible para identificarla. Registros de seis ciclos: `tests/output/final_6_ui_manual_6_reintento.log` y `tests/output/final_6_ui_random_6_reintento.log`.

La captura de diagnóstico del reintento de Equilibrado mostró ciclo 2, menú de decisiones y texto «Infraestructura» visibles cuando falló la búsqueda por nombre accesible (`tests/output/final_6_ui_balanced_3_diagnostico.log`). Se cambió el guion al selector de pestaña `data-cat=B`; aún debe comprobarse el reintento y no se atribuye un defecto al producto sin más evidencia.

**Corte de los reintentos:** Equilibrado de seis ciclos alcanzó tres cierres con tres decisiones por interfaz, pero el guion agotó 90 segundos esperando la pestaña de infraestructura en el cuarto (`tests/output/final_6_ui_balanced_6_reintento.log`). Tras cambiar el selector, el nuevo ensayo de Equilibrado de tres ciclos no llegó a validar ese cambio: la tercera sesión quedó esperando el botón de entrada y Auth registró de nuevo HTTP 429 (`tests/output/final_6_ui_balanced_3_selector.log`). No se atribuye automáticamente el problema a una regla financiera. Los cinco reintentos de la serie terminaron con error; el posterior reintento independiente de Aleatorio de tres ciclos sí terminó parcialmente como se indicó arriba.

**Próxima acción:** levantar una base y Auth locales nuevos, sin registros históricos, con el SQL de Historial incluido desde su creación y límites apropiados; ejecutar allí el guion conservado en `tests/side_tres_modos_ui_local.cjs` de forma secuencial, capturando estado y comparando cada cierre en las tres vistas. Completar además el rechazo atómico de cierre inválido y los controles de autorización/concurrencia sobre esa misma configuración antes de considerar la integración. La migración SQL de Historial no se ejecutó en la instancia con registros existentes.
