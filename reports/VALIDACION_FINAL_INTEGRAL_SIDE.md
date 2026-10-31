# Resultado actualizado: 27 cierres locales (31/10/2026)

| Modo | Duración | Empresas | Cierres Edge | Estado de partida |
|---|---:|---:|---:|---|
| Manual | 3 | 3 | 3/3 | Finalizada |
| Manual | 6 | 3 | 6/6 | Finalizada |
| Aleatorio | 3 | 3 | 3/3 | Finalizada |
| Aleatorio | 6 | 3 | 6/6 | Finalizada |
| Equilibrado | 3 | 3 | 3/3 | Finalizada |
| Equilibrado | 6 | 3 | 6/6 | Finalizada |

Las seis partidas se crearon en la instancia local nueva `cierres-e2e2` (API `127.0.0.1:65321`), con Auth y PostgreSQL reales. `tests/cierre_tres_ciclos_local.py` mantuvo sesiones en memoria; guardó decisiones mediante RPC autenticado, confirmó pedidos, registró dos recepciones por pedido y repitió cada solicitud, cerró mediante Edge y avanzó mediante `controlar_partida`. No hubo escrituras SQL directas para decisiones o cierres. Estos recorridos usaron HTTP, no clics para decisiones o compras.

`python tests/verificar_27_cierres.py` comprobó 27 cierres y 81 resultados: 243 pedidos, 486 recepciones, conversiones y valor de las presentaciones, entrada + inventario inicial - consumo = inventario final por SKU, ventas no superiores a disponibilidad, producción no superior a meta ni a capacidad registrada de cada etapa, continuidad de caja y balances. Los comprobantes y las secciones de estados de resultados, caja y balance del estudiante coinciden con el cierre consultado por el docente; `js/laboratorio_model.js` proyecta las mismas ventas, utilidad y caja. La verificación del Laboratorio usó el modelo local, no la interfaz. Los límites de capacidad verificados son los registrados por el propio motor; falta un oráculo independiente.

Una partida Equilibrada adicional de seis ciclos realizó dos solicitudes Edge simultáneas con trabajo pendiente en el primer ciclo: ambas respondieron correctamente y se comprobó una única fila de cierre; la partida completó 6/6. Un reintento posterior sin pendientes devolvió éxito y no cambió la huella de cierres, instantáneas, recepciones ni empresas. La primera ejecución de esta prueba adicional falló por comparar objetos financieros completos con metadatos distintos; se corrigió el verificador para comparar los tres estados y el siguiente intento pasó. No se modificó lógica económica.

En estos escenarios todas las empresas planificaron y vendieron 10 unidades por ciclo, de modo que la oferta limitó las ventas y las partidas no miden el efecto distributivo económico completo de los eventos. Para cada partida de tres ciclos los ingresos agregados fueron S/ 3.825, los costos S/ 106.014,72 y la utilidad S/ -102.189,72; en las de seis ciclos, S/ 7.650, S/ 190.654,44 y S/ -183.004,44. El sorteo de tres ciclos no produjo eventos; el de seis produjo una aplicación. No se infiere equilibrio económico general de estos resultados.

La regresión anterior de igual selección registró 825/842 aprobadas y 17 fallidas. Se volvieron a ejecutar los tres archivos de producción/interfaz que contienen los otros diez fallos: 16/26 pasaron y 10 fallaron. Siete pruebas adicionales dependen del Excel `output/SIDE_prueba_cantidad_produccion_corregido.xlsx`, ausente. No se cambiaron fórmulas ni expectativas y los diez fallos siguen sin resolver.

Reproducción: con Docker Desktop, `npm ci` y puertos libres, elegir un nombre nuevo `SIDE_E2E_PROJECT` que empiece por `cierres-e2e` y prefijo de puerto `SIDE_E2E_PORT_PREFIX` de cuatro cifras que empiece por 6. Ejecutar `python tests/preparar_modos_e2e.py`; iniciar `npx supabase functions serve --workdir .codex-work/<nombre> --no-verify-jwt`; ejecutar `python tests/cierre_tres_ciclos_local.py --mode <manual|random|balanced> --cycles <3|6>` para las seis combinaciones y `python tests/verificar_27_cierres.py` con el mismo proyecto. Las sesiones y el token permanecen en memoria; los resultados de prueba están en `tests/output/`, ignorados por Git. El preparador se niega a reutilizar un directorio o contenedor existente.

Pendiente: validación de las compras, Kardex, decisiones, cierre y avance mediante navegador; comprobación de capacidad contra un oráculo independiente; escenarios con suficiente oferta para evaluar el impacto económico; revisión de los diez fallos y recuperación autorizada del Excel para los otros siete. Por ello no se declara completada la aceptación integral.

---

# Historial anterior (superado por el resultado anterior)
# Validación final integral SIDE

Base `c43154f`, rama `logia_prueba_mejora`. Se utilizó Supabase local aislado en `127.0.0.1:62321`. No se aprobaron partidas incompletas.

| Requisito | Estado | Evidencia |
|---|---|---|
| Manual, 3 ciclos, 3 empresas | NO EJECUTADO | `tests/modos_local_reales.py`: sala, Auth, ingreso y primer evento; 0/3 cierres. |
| Manual, 6 ciclos, 3 empresas | NO EJECUTADO | Mismo primer tramo; 0/6 cierres. |
| Aleatorio, 3 ciclos, 3 empresas | NO EJECUTADO | Mismo primer tramo, sorteo y reintento; 0/3 cierres. |
| Aleatorio, 6 ciclos, 3 empresas | NO EJECUTADO | Mismo primer tramo, sorteo y reintento; 0/6 cierres. |
| Equilibrado, 3 ciclos, 3 empresas | NO EJECUTADO | Mismo primer tramo, rotación y reintento; 0/3 cierres. |
| Equilibrado, 6 ciclos, 3 empresas | NO EJECUTADO | Mismo primer tramo, rotación y reintento; 0/6 cierres. |
| Selector docente, persistencia y recarga | APROBADO | `tests/modos_navegador_local.cjs`: registro y creación mediante clics; selección y recarga de los tres modos con persistencia consultada por RPC real. Una sola sala, no seis partidas. |
| Primer tramo Auth y RPC en seis salas | APROBADO | `python tests/modos_local_reales.py`: tres empresas por sala, creación idempotente, programación y noticias. El proceso retorna 1 deliberadamente al no completar ciclos. |
| Pruebas focales económicas y eventos | APROBADO | 16/16 en `tests/output/validacion_actual_c43154f.log`; incluyen PGlite y no sustituyen aceptación real. |
| Concurrencia PostgreSQL aislada | APROBADO | `node --test tests/evento_autoritativo_postgres.test.cjs tests/side_cierre_concurrente_pg.test.cjs`: 2/2; roles Auth simulados. |
| Cierres simultáneos Edge con datos reales | NO EJECUTADO | La función fue iniciada localmente. La instancia existente contiene partidas previas y el ejecutor consulta cierres pendientes de todas: no se invocó sobre ella para evitar alterar cierres históricos. Se requiere una instancia nueva aislada y un cierre pendiente propio. |
| Decisiones, compras, recepciones, Kardex, producción y finanzas en seis partidas | NO EJECUTADO | La automatización disponible se detiene en noticias y no conserva sesiones de estudiantes para continuar. |
| Conciliación entre estudiante, docente y laboratorio en seis partidas | NO EJECUTADO | No existen cierres de estas partidas. |
| Contraste con Excel original | NO EJECUTADO | `output/SIDE_prueba_cantidad_produccion_corregido.xlsx` no está disponible en esta copia. |

## Defectos y correcciones

NO EJECUTADO: no se identificó ni corrigió un defecto reproducible del producto en los pasos ejecutados. Se añadió una prueba de navegador real; no modifica lógica ni fórmulas. La falta de automatización de seis partidas sigue siendo una limitación de cobertura, no prueba de un defecto económico.

## Regresión

FALLIDO: selección `tests/*.test.js` y `tests/*.test.cjs`, concurrencia 2: 842 pruebas, 825 aprobadas, 17 fallidas, 0 canceladas y 0 omitidas. Los 17 nombres coinciden con la ejecución anterior de igual selección; no se detectó regresión nueva por nombre. Siete pruebas dependen del Excel ausente; las otras diez requieren revisión de expectativas de producción y presentación. Registro local ignorado: `tests/output/regresion_c43154f.log`.

## Ejecución

Para la comprobación de navegador, con la instancia local configurada, iniciar `python servidor_local.py --port 62380 --no-browser`, establecer `NODE_PATH` a `.cache/test-runtime/node_modules` si Playwright se encuentra allí, y ejecutar `node tests/modos_navegador_local.cjs`. No incluye compras, decisiones ni cierres. Los registros de `tests/output/` son ignorados por Git. El estado y los siguientes pasos se detallan en `reports/PENDIENTES_REALES_SIDE.md`.

## Comparación económica focal

APROBADO: en el escenario pareado de `tests/eventos_equilibrio_economico.test.cjs`, las diferencias acumuladas con eventos frente a sin eventos fueron ventas -2/-1/+3 unidades, costos -237,90/-118,97/+356,87 y utilidad +152,90/+76,47/-229,37; las diferencias de caja final fueron -963,89/-902,67/+1.866,58. Son resultados de PGlite para una rotación concreta, no una prueba de equidad general ni de las seis partidas reales. La semilla y orden de asignación pueden modificar qué empresa recibe cada resultado.
