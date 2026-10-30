# Continuidad empresarial: avance y límites — 30 de octubre de 2026

## Preservación

`version-estable-1` ya existía en `4c38d68` y no se modificó. Los tres archivos locales posteriores a ese commit se preservaron en el commit `41ce040` y la rama local `codex/respaldo-continuidad-20261030`. El trabajo continúa en `codex/continuidad-empresarial`. No se efectuó push ni despliegue.

## Ensayo reproducible

Desde la raíz de SIDE1, ejecutar `node --test tests/continuidad_seis_ciclos_activos.test.cjs`. Usa PGlite aislado y el worker de cierre con migraciones especificadas en el test; no es una partida real de navegador ni una validación de Supabase remoto. El ensayo crea dos empresas. Para la principal configura capital inicial S/ 200,000, crédito de proveedores a un ciclo, molde premium, una mesa, una máquina básica y un trabajador básico por etapa, sin jefatura. El primer pedido de hilo se recibe parcialmente y el resto en el segundo ciclo. Los ciclos 3 a 6 solicitan 70 m² de cuero premium, 100 accesorios premium y 1,300 m de hilo estándar por ciclo, con meta de 100 unidades premium. Los resultados siguientes provienen de la ejecución del 30 de octubre:

| Ciclo | Producido | Vendido | Ventas S/ | Costo de ventas S/ | Utilidad neta S/ | Caja final S/ | Cuentas por cobrar S/ | Cuentas por pagar S/ | Impuesto S/ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 100 | 100 | 35,000 | 13,582.94 | 17,803.91 | 206,704.45 | 7,000 | 14,352 | 0 |
| 2 | 95 | 95 | 33,250 | 13,164.34 | 16,490.01 | 215,621.90 | 8,312.50 | 2,392 | 0 |
| 3 | 95 | 95 | 33,250 | 13,569.67 | 16,084.68 | 236,149.35 | 9,975 | 8,820 | 0 |
| 4 | 95 | 95 | 33,250 | 13,588.10 | 16,066.25 | 250,248.80 | 11,637.50 | 8,820 | 0 |
| 5 | 95 | 95 | 33,250 | 13,589.70 | 16,064.65 | 264,348.25 | 13,300 | 8,820 | 0 |
| 6 | 95 | 95 | 33,250 | 13,589.90 | 3,072.63 | 265,455.88 | 14,962.50 | 8,820 | 12,991.82 |

El test verifica igualdad entre activos y pasivo más patrimonio, ecuación de caja, arrastre de caja e inventarios, pagos de proveedores, ausencia de impuesto antes del último ciclo, repetición idempotente y un cierre parcial equivalente en Node y Edge. Registra las cantidades recibidas y consumidas. La segunda empresa conserva producto terminado y lo vende en el ciclo siguiente. Las cifras son resultados de ese escenario, no validación general de todas las decisiones ni estados completos presentados al usuario.

## Cambio realizado

`services/live_results.js` usa la instantánea financiera del cierre para mostrar un ciclo cerrado y no recalcula con el libro mutable del cliente. Si falta la instantánea, no fabrica un resultado. `tests/resultados_sellados_servidor.test.cjs` verifica ambos casos.

## Comparación preliminar con Excel y pendientes

Las pruebas focales `produccion_excel`, `mercado_excel`, `caja_excel` y `ciclo_excel` pasan (25 pruebas). Validan casos concretos, no paridad integral del cierre actual. `docs/logica_excel/ESPECIFICACION.md` documenta fórmulas y referencias originales: existen hojas con 24 y 30 días y productividades distintas; el escenario actual usa ciclos de 30 días. El juego limita consumo a materiales realmente disponibles y el modo `receipts-v1` verifica recepciones: es una adaptación temporal que no debe atribuirse literalmente al Excel. El costo de ventas y arrastre de producto terminado son una extensión del juego.

La lógica no queda certificada como terminada: debe verificarse la activación de recepciones para todas las partidas nuevas y el tratamiento de partidas heredadas; revisar todas las rutas de interfaz que calculan proyecciones financieras y que muestran saldos; comprobar préstamos, intereses, lotes y ventas por canal en escenarios de extremo a extremo; emitir y conciliar los tres estados completos por cada ciclo; y contrastar reglas y decisiones actuales contra el Excel original. El modo heredado de materiales instantáneos aún existe. El ensayo usa estados y recepciones inyectados en base local, no prueba el recorrido completo del estudiante ni la identidad o concurrencia de Supabase real. Las 17 pruebas históricas no se han modificado ni desactivado y no se ha ejecutado la suite general en esta intervención.
