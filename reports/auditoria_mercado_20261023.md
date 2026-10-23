# Correcciones de mercado — 23/10/2026

Fuente: `.codex-work/DECISIONES_SIDE_16.xlsx`, hoja `Costos De Producción`. No se modifica el archivo original ni las decisiones del menú. Se conservan el origen operativo de reputación y los parámetros de mercado del libro.

## Discrepancias corregidas

1. `js/engine/config_excel.js`, `CALIDAD_MERCADO_MODO`: el valor predeterminado era `motor`, que calculaba `ROUND(MIN(100,calidadEmpresaMotor*10),0)`. La fórmula original es un proxy de reputación: `E118=ROUND(D118/$D$122*100,0)`. El predeterminado pasa a `excel_literal`; el modo anterior solo permanece como compatibilidad explícita. Las pruebas de los tres ejemplos originales ahora llaman al mercado sin imponer un override que esconda el comportamiento predeterminado.
2. `js/engine/mercado.js`, `repartoMercado`: `E131:E134` y `E144:E147` también conservan el denominador absoluto `$D$122` del mercado económico. Antes el modo literal usaba la suma del propio segmento, lo que no detectaban los ejemplos con las mismas reputaciones en los tres mercados. Ahora el cierre de ciclo reúne primero las poblaciones de cada segmento y comparte el total de reputación del económico. La función aislada acepta ese contexto como cuarto argumento; si el llamador no proporciona otras poblaciones, usa las entradas que recibió.
3. No se impone el tope 100 al proxy literal: el Excel puede producir valores superiores cuando la reputación de un participante excede el total económico. Con reputación 30 y denominador económico 20, el resultado es 150, no 100.

## Criterios explícitos

Se conserva la referencia absoluta del libro, aunque parezca una referencia cruzada accidental. No se corrige silenciosamente a la suma del segmento medio/premium. Si no hay participantes económicos o su reputación suma cero, se conserva la guarda finita operativa: calidad 0. El Excel puede dividir por cero en ese caso; esta protección se distingue de una fórmula original.

Las llamadas aisladas que no reciben otras poblaciones solo pueden evaluar su propia población; los cierres reales sí pasan el denominador económico completo. No se introduce una nueva decisión ni se cambia la reputación operativa por un número fijo del ejemplo.

## Verificación

`tests/auditoria_mercado_20261023.test.cjs` prueba el predeterminado, independencia de la calidad material, denominador económico compartido, resultado superior a 100, guarda de población vacía e integración entre tres segmentos. Junto con los seis ejemplos/contratos de `tests/mercado_excel.test.cjs`: 10/10 pasan. Las pruebas con Excel original recalculado, simulaciones multiciclo y regeneración independiente de oráculos se documentan en el cierre de auditoría.

Se actualizan las claves de caché de los motores modificados en estudiante y docente. No se requiere SQL ni actualización de Supabase; se conserva el contrato de resultados y snapshots existentes.
