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

