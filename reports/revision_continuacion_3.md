# Revisión independiente de continuación 3

Fecha: 2026-10-11. Base de comparación: `459c062`. Remoto verificado: `https://github.com/valenlysm29/SIDE1.git`.

## Alcance

Revisión del diff de `js/engine/{config_excel,puntajes,costos,ciclo,ui_excel}.js`, pruebas dirigidas modificadas, escenarios y generadores `tests/oracle/construir_pipeline.py` y `extender_finanzas.py`. Se contrastó el filtro con `reports/auditoria_decisiones_2026-10-11.md`. No se revisaron modificaciones anteriores, activos NPC ni trabajo 3D. No se abrió navegador ni se ejecutó la batería integral reservada al coordinador. Los artefactos Excel seguían regenerándose durante esta revisión; su paridad numérica final queda pendiente de la verificación integral.

## Hallazgo

**P2 — Las proyecciones del resumen omiten el ciclo del nuevo beneficio del analista.** `js/company_summary.js:192,218,242` llama a `SIDE_EXCEL_CICLO.prepararEmpresa` sin incluir `ciclo`. El nuevo `descuentoAnalista` toma por defecto el ciclo 1. A partir del ciclo 2, un plan con analista muestra en el resumen descuento del 12% en lugar del 10%, 8%, etc. El editor ya pasa `context.round` y el cierre pasa su ciclo real, por lo que el resumen previo y el cierre divergen. Corregir las tres proyecciones pasando el ciclo real; verificar también el caso ciclo 2.

Reproducción dirigida, sin navegador: `decision({analistaCompras:true})` y `prepararEmpresa(d)` devuelven descuento **12** y costo MP **2054.7648**; `prepararEmpresa({...d,ciclo:2})` devuelve descuento **10** y costo MP **2101.4640000000004**. Comunicada al coordinador antes de la verificación final.

**Estado: corregido y verificado.** El coordinador añadió `ciclo:currentRound()` en las tres proyecciones. Se inspeccionó el diff de las tres llamadas y se ejecutó `node --test tests/resumen_analista_excel.test.cjs`: **1/1 PASS**. La prueba carga el archivo real de resumen en VM y usa el motor real para comprobar ciclo 2, descuento 10% y costo MP idéntico a la proyección del ciclo 2, distinto al ciclo 1. No quedan hallazgos abiertos de esta revisión.

## Resto del diff

No se detectaron otros defectos bloqueantes en el alcance inspeccionado. La lista del Motor conserva 16 grupos, la UI expone 10 selectores y seis campos base; los códigos FIN-02/INS-12 no puntúan ni cobran por defecto. El catálogo de 68 filas permanece intacto. Marketing base alimenta el monto de publicidad y excluye su cargo recurrente duplicado. Garantía base mantiene costo cero y 180 días sin mapeo arbitrario; mantenimiento opcional usa S/200. Proveedores/pago/lead time no reciben selección automática desde el editor. Las nuevas pruebas verifican estas exclusiones y la conservación de distritos/opciones base.

El generador del oráculo replica las exclusiones, el costo del analista y su descuento por ciclo. La inspección de fórmulas no sustituye la comparación con los libros recalculados. El directorio padre se comprobó al finalizar: contiene únicamente `SIDE1`; esta revisión no creó artefactos fuera del proyecto.
