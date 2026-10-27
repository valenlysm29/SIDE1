# Revisión de SIDE contra el Markdown y el Excel adjuntos

Este informe registra el estado **anterior a la actualización**. La implementación posterior se documenta en [actualizacion_logica_documento_20261027.md](../docs/actualizacion_logica_documento_20261027.md).

Fecha: 27 de octubre de 2026. Resultado: **SIDE no es plenamente conforme con la lógica descrita en el Markdown entregado.** Hay diferencias en capacidad, prioridad de producción, reputación, ventas y costos. Algunas corresponden a otro diseño del simulador; dos casos reproducibles son fallos de reparto e inventario frente a las reglas solicitadas.

Esta revisión no modifica las reglas del juego, los archivos originales ni Supabase. Añade este informe y scripts de diagnóstico. Las instrucciones y recomendaciones contenidas en los documentos se trataron como material de referencia, sin interpretarlas como autorización para aplicar cambios.

## 1. Fuentes y alcance

- Explicación: `C:/Users/Asus/Downloads/Logica_SIDE_Costos_de_Produccion.md`.
- Libro adjunto: `C:/Users/Asus/Downloads/DECISIONES SIDE (19).xlsx`, hoja `Costos De Producción`. Para reputación y ventas se consideró el bloque A113:N152 y B151:B152. El boceto de las filas 65–109 no se utilizó como especificación de ventas.
- Implementación revisada: raíz del repositorio SIDE1, remoto `https://github.com/valenlysm29/SIDE1.git`.
- SHA256 del Excel adjunto: `45d2897365a442d2730c09935f53c0b1173f697a0dcb9708c0b9846cde3d32c2`.
- Se inspeccionaron fórmulas, constantes y valores guardados del Excel. No se recalculó ni guardó con Excel. Los valores guardados se distinguen de las comprobaciones independientes ejecutadas en Node y Python.
- La hoja `Copia de Costos De Producción` coincide con la original en valores y fórmulas.

### La referencia anterior del repositorio es distinta

`docs/DECISIONES_SIDE_19.xlsx` **no es el mismo libro adjunto**, pese al nombre parecido. Se detectaron 180 diferencias de contenido de celda en A1:AD152 de `Costos De Producción`, incluidas fórmulas, constantes, textos y columnas agregadas. No son 180 errores.

Ejemplos: L5 tiene 24 días en el libro del repositorio y 30 en el adjunto; G113 apunta a `Motor_Puntajes!B10` en el repositorio, mientras el adjunto suma los cuatro factores. Las pruebas anteriores de paridad usan el libro previamente adaptado, según `reports/excel_v19_entrega_20261024.md` y `tests/fixtures/excel_v19_expected.json`.

El propio adjunto también contiene una discrepancia entre hojas: `CANTIDAD DE PRODUCCIÓN` usa 24 días, corte 5/7/9 y acabado 6/7/10; `Costos De Producción`, que explica el Markdown, usa 30 días y 6/8/12 en las tres áreas. Por tanto, parte de la divergencia procede de elegir otra hoja como regla. Para esta revisión prevalece la hoja identificada por el usuario a través del Markdown.

## 2. Motor que realmente participa en el cierre

La ruta revisada es:

1. `index.html:664` y `docente.html:226` cargan `js/production_model.js`.
2. `index.html:673` y `docente.html:233` cargan `js/engine/cierre.js`.
3. `js/cycle_model.js:2` integra producción, cierre económico y contabilidad.
4. `services/partida_service.js:380` llama a `SIDE_CYCLE_MODEL.closeMany` y luego persiste los resultados mediante la RPC `side_guardar_cierre_negocio`.

El código de `js/engine/costos.js` contiene una función de reputación operativa, pero **esa función no es la que utiliza esta ruta de cierre**. Cambiar únicamente `config_excel.js`, `costos.js` o `engine/ciclo.js` no bastaría para corregir los resultados del motor activo.

No se comprobó la versión desplegada ni se ejecutaron cierres sobre partidas reales. Las conclusiones sobre comportamiento corresponden al código local y a su ruta de integración.

## 3. Diferencias con impacto alto

| Hallazgo | Regla del Markdown | Comportamiento actual e impacto | Ubicación |
|---|---|---|---|
| Capacidad diferente | 30 días; tasas 6/8/12 para las tres áreas | 24 días; corte 5/7/9, ensamble 6/8/12, acabado 6/7/10. Con un N1 por área y equipos manuales, la capacidad física es 108 en lugar de 162 bolsos. | `js/production_model.js:9`, `:17` |
| Otra prioridad de fabricación | Fabricar N1, después N2, después N3 con capacidad y materiales remanentes | Calcula capacidad por receta promedio y distribuye proporcionalmente por metas. Con metas 150/140/95, materiales del ejemplo y capacidad suficiente, produce 140/130/88 = 358, frente a 150/140/78 = 368 siguiendo el Markdown. | `js/production_model.js:147`, `js/engine/cierre.js:45` |
| Reputación de otra fuente | Cuatro factores: mezcla premium, proporción de N3, MP premium consumida y publicidad; sumar y dividir entre cuatro | Suma puntos del catálogo y aplica consecuencias. En un caso sin producción premium, con todo el personal N3 y MP premium, el documento da 5/10 y SIDE 6/10. Cambiar todo el material a básico no altera esa reputación; reducir N3 del 100% al 25% conservando el nivel superior presente tampoco la altera. | `js/engine/cierre.js:25`, `:58` |
| El mercado puede aumentar o perder unidades por redondeo | Restos mayores para conservar exactamente el tamaño del mercado | Redondea cada participación por separado. Tres empresas idénticas en el mercado caro reciben 267 cada una: 801 para un mercado de 800. El caso se aisló antes de bonificaciones de demanda. | `js/engine/cierre.js:76` |
| No vende inventario inicial sin producción nueva | Vender hasta `MIN(demanda, PT inicial + producción)` | La participación exige `produced > 0`. Una empresa con canal, 10 bolsos económicos guardados y producción actual cero vende 0, aunque el stock está disponible. | `js/engine/cierre.js:74` |
| Cambia automáticamente el precio de venta | Ingreso = precio elegido × unidades vendidas | Premium aplica ×1.4 o ×0.65 según calidad. Precio elegido S/250 produce precio efectivo S/350 en el caso de calidad suficiente. También modifica reputación. Son reglas de consecuencias adicionales al alcance del Markdown. | `js/engine/cierre.js:60` |
| Faltan costos asociados a activos | Compra: adquisición + instalación + capacitación. Ciclo: mantenimiento anual/12 + depreciación/12 | La mesa se cobra a S/2,500, frente a S/2,625 con instalación y capacitación MYPE. No se encontró cargo automático del mantenimiento anual por activos; existe una selección opcional de S/1,500, que responde a otra regla. | `js/decision_review_model.js:73`, `js/decision_catalog.js:38`, `js/financial_model.js:72` |

El ejemplo de mezcla de producción aísla el orden de fabricación: se usó una dotación de capacidad suficiente y los mismos materiales/metas del documento. No representa una comparación completa de la misma empresa original, cuya capacidad y asignación de máquinas también difieren.

## 4. Diferencias de diseño y cobertura parcial

- **Publicidad:** el documento permite un importe de S/0 a S/10,000, por ejemplo S/3,000, que alimenta reputación directamente. El catálogo actual ofrece S/1,500, S/6,000 y S/12,000. No permite reproducir el ejemplo ni implementa el factor oficial acotado a 10. Además, marketing multiplica demanda. Referencias: `js/decision_catalog.js:130`, `js/engine/cierre.js:67`.
- **Asignación de trabajadores a máquinas:** el documento describe una matriz editable por nivel y máquina y cuenta a todos los cortadores. SIDE empareja automáticamente trabajadores de mayor productividad con máquinas de mayor multiplicador y limita a un trabajador por equipo, también en corte. Esta regla debe distinguirse de la matriz del Excel. Referencia: `js/production_model.js:90`.
- **Régimen laboral:** los nueve costos MYPE coinciden con la tabla del documento. El catálogo activo tiene esos importes fijos y no ofrece el selector MYPE/No MYPE. La función del motor alternativo que acepta régimen no habilita ese comportamiento en el cierre actual.
- **Calidad:** SIDE calcula calidad con puntos de catálogo de molde y materiales consumidos, en escala 0–10, y la multiplica por 10 para el mercado. Evita usar cuota de reputación como calidad, lo que atiende la dirección de la recomendación del Markdown. Sin embargo, no utiliza la fórmula ilustrativa `(factor MP + factor producción) / 20 × 100`; esa fórmula se presenta como ejemplo, no como definición cerrada. No se clasifica por sí sola como error.
- **Compra de MP:** la interfaz actual pide directamente m², unidades y metros. Los factores del Excel para convertir pieles o carretes no se aplican a estas entradas, porque ya son unidades productivas. Es una adaptación coherente de unidades, pero no reproduce la presentación de compra del Excel. Introducir 55 en el campo de m² significa 55 m², no 55 pieles equivalentes a 110 m².
- **Mercados:** los tamaños configurados 3,500/3,500/800 coinciden con el documento. El cierre activo guarda esos mercados reales como constantes; no expone por separado tamaño total y penetración para derivarlos dinámicamente.
- **Estado de resultados:** el motor actual incorpora inventario de PT valorizado, costo de las unidades vendidas, comisiones, garantías, interés e impuesto. El documento propone una utilidad operativa simplificada y no define todos esos cargos. Por ello, la utilidad neta de SIDE no debe compararse directamente con los S/−8,369.88 del ejemplo.
- **Consecuencias:** hay penalizaciones por eficiencia, coordinación y reputación baja, formación que aumenta capacidad y factores comerciales adicionales. Algunas provienen de otras hojas del Excel, pero el Markdown entregado no las integra en su secuencia. Son diferencias de alcance que deben quedar explícitas en la especificación unificada.

## 5. Reglas que sí coinciden

- Las recetas por molde: 0.3/1/6, 0.4/1/7 y 0.7/1/13.
- Cuello de botella entre corte, ensamble y acabado y multiplicadores de máquina 1/1.2/1.5, sujetos a las diferencias de tasas y emparejamiento descritas.
- Eficiencia base 90%, +1 punto por N3 de cualquier máquina y +4 puntos por jefatura. SIDE además limita al 100%, una protección que no aparece explícita en la fórmula del Markdown.
- El almacén incluye inventario inicial y descuenta consumo de producción efectiva. No consume materiales de toda la meta cuando esa meta no se fabrica.
- Consumo de niveles bajos antes de altos, según el orden del catálogo actual.
- Precios base de MP y descuento general del 8%; el analista puede añadir otro descuento.
- Los nueve pagos mensuales MYPE del documento. Limpieza S/712.32, jefatura S/3,321.60 y local S/2,000 también coinciden por inspección del catálogo.
- Los pesos de precio/reputación/calidad por segmento y los precios ideales 100/250.
- Puntaje económico 100 cuando todos los precios coinciden y puntajes de precio sin valores negativos.
- Las ventas respetan el stock de las empresas que sí participan. Se conserva el inventario sobrante, con la salvedad de no poder venderlo en un ciclo sin fabricación nueva.
- MP comprada y no consumida permanece valorizada en el balance. Inversión en activos y depreciación se registran por separado.

## 6. El ejemplo del Markdown también requiere coherencia interna

El documento identifica correctamente varios problemas del Excel original, pero sus números de ejemplo conservan algunos de ellos. No deben usarse todos simultáneamente como resultados esperados de un motor corregido.

Para producción 150/140/78 y compras del ejemplo, aplicar consumo efectivo de menor a mayor calidad da:

| Concepto | Ejemplo conservado en el documento | Resultado al corregir consumo efectivo |
|---|---:|---:|
| Cuero consumido total | 167.5 m² en el almacén | 155.6 m² |
| Accesorios consumidos | 385 | 368 |
| Hilo consumido | 2,900 m | 2,894 m |
| Costo de MP con descuento | S/22,613.60 | S/21,962.24 |
| Valor final de MP | S/2,373.60 | S/3,024.96 |
| Reputación 0–10 | Aproximadamente 2.80 | Aproximadamente 2.7760 |

La valoración original también toma 107 m² de cuero estándar escritos a mano, mientras el almacén indica 107.5. La columna corregida usa 95.6 m² estándar, 168 accesorios premium y 1,394 m de hilo premium. Mantiene publicidad S/3,000 y proporción de trabajadores N3 = 2/7. Compras valorizadas: S/24,987.20 en ambos casos.

La corrección de eficiencia para incluir ambos N3 cambia la capacidad de 382 a 386 (`14 × 30 × .92`, redondeado). La producción final sigue limitada a 368 por el hilo. Estos ajustes deben considerarse antes de establecer resultados de aceptación definitivos.

La unificación de CTS se recomienda sin definir una nueva fórmula universal. No corresponde inventarla durante una revisión de conformidad.

## 7. Validación ejecutada

- Auditoría específica: **24 comprobaciones de ejemplo; 11 coincidencias y 13 diferencias**. Varias comprueban aspectos de una misma regla. Los números no constituyen un porcentaje de conformidad ni un conteo de 13 errores independientes.
- Pruebas existentes: **33 aprobadas, 0 fallidas**, en `cierre_v19`, `costos_runtime_v19`, `accounting_integrated`, `business_cycle` y `cycle_productivity`. Verifican estabilidad del diseño actual; no prueban conformidad con esta nueva referencia.
- Balance físico adicional: los casos de diagnóstico no consumen por encima del disponible ni venden por encima de su stock.
- Las comprobaciones son locales y deterministas. No se ejecutó una prueba de navegador ni un cierre real remoto.

Desde SIDE1, con los ejecutables de Node y Python disponibles:

```powershell
python tests/audit_logica_md_20261027.py
node tests/audit_logica_md_20261027.cjs
node --test tests/cierre_v19.test.cjs tests/costos_runtime_v19.test.cjs tests/accounting_integrated.test.cjs tests/business_cycle.test.cjs tests/cycle_productivity.test.js
```

El diagnóstico registra `DIFIERE` en lugar de fallar el proceso: es un informe de comparación, no una suite que presupone conformidad.

Evidencias locales: `tests/output/auditoria_md_20261027/excel_evidence.json` y `runtime_evidence.json`. Los resultados temporales están ignorados por Git y pueden regenerarse con los scripts. Los hashes y fórmulas extraídos permiten distinguir los originales de la copia adaptada del repositorio.

## 8. Orden propuesto para alinear SIDE

1. Tomar como referencia explícita el bloque de `Costos De Producción` descrito por el Markdown, dejando documentadas las diferencias con `CANTIDAD DE PRODUCCIÓN` y el libro adaptado anterior.
2. Unificar días, productividades, asignación de máquinas y prioridad N1→N2→N3 en el motor activo de producción.
3. Conectar la reputación a los cuatro factores reales y a su escala 0–10. Definir una única fórmula de calidad y el control monetario de publicidad.
4. Corregir el reparto con restos mayores y permitir participar con stock inicial aunque la fabricación del ciclo sea cero.
5. Hacer explícitas las consecuencias que cambian precio o demanda para evitar que contradigan silenciosamente la fórmula de ingresos del documento.
6. Completar instalación, capacitación, mantenimiento por activo y régimen laboral; distinguir utilidad operativa del documento de utilidad neta del juego.
7. Crear resultados esperados a partir de la referencia adjunta y sus correcciones coherentes, y comprobarlos tanto en el cierre como en la interfaz.

Este orden es una propuesta de corrección. En esta tarea se ha revisado y documentado; no se han aplicado cambios a la lógica ni al despliegue.
