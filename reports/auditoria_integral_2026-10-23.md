# Auditoría del motor SIDE contra el Excel — 23/10/2026

## Resultado

Se completó la auditoría ejecutable del motor y se corrigieron los defectos reproducidos de consecuencias, mercado y precisión de inventario. La auditoría distingue fórmulas originales, anomalías del propio libro y reglas históricas sin fórmula fuente. No se declara igualdad con una celda que no existe ni se inventan recetas de dotación desde la cantidad.

Fuente intacta: `.codex-work/DECISIONES_SIDE_16.xlsx`, SHA-256 `3b6b42bbbc56a2534ce7e241c607d572dd38dcf02311683609497df36a0c1eb1`, verificado antes y después. Se aplicó la skill xlsx, leyendo fórmulas y caché por separado. Todos los archivos y ejecuciones permanecieron en SIDE1.

## Defectos corregidos

| Hallazgo | Fuente original | Antes en SIDE | Corrección |
|---|---|---|---|
| CONS-06 por meta en lugar de producción | `Matriz_Consecuencias!C7`: cantidad **producida** > capacidad instalada | Meta 520 y capacidad 396 generaban horas extra aunque se produjera menos de 396 | `consecuencias.js` compara producción efectiva; `ciclo.js` pasa el dato. No activa con datos omitidos. No se introduce tarifa nueva. |
| Calidad predeterminada para mercado | `Costos De Producción!E118=ROUND(D118/$D$122*100,0)` | Calidad de materiales×10 con tope 100; solo los tests forzaban el modo literal | El valor predeterminado usa el proxy de reputación del libro. Los tests originales llaman sin override que oculte el predeterminado. |
| Denominador medio/premium distinto del original | `E131:E134`, `E144:E147` mantienen `$D$122` económico | Se normalizaba dentro de cada segmento | El cierre reúne las poblaciones y comparte el total económico. Se conserva la referencia absoluta original y se permiten resultados superiores a 100. |
| Falso sobreconsumo y stock residual decimal | `Costos!G54=D54+E54-F54`; precisión ya establecida de 15 cifras | 0,1+0,7 podía rechazar consumo 0,8; otros casos dejaban residuos de 5,55e-17 | Se normaliza la suma antes de validar y restar en costos e inventario. Un sobreconsumo real sigue rechazado. |

Detalles y pruebas por archivo: [consecuencias](auditoria_correcciones_consecuencias_20261023.md), [mercado](auditoria_mercado_20261023.md), [costos/caja](auditoria_costos_caja_20261023.md).

## Auditoría directa del original

`tests/audit_excel_original_20261023.py` inventaría las diez hojas: **3.047 celdas no vacías, 871 fórmulas, 215 familias estructurales**. Las familias son un inventario de fórmulas relativas, no una afirmación de que todas sean correctas. Reportes completos: [Excel original](auditoria_excel_original_20261023.md) y su JSON.

Se ejecutaron **12 escenarios** sobre copias del original mediante Microsoft Excel COM 16.0, sin añadir hojas y sin reescribir el original. Se perturbaron poblaciones y precios de mercado, personal, eficiencia superior a uno, nómina, activos, cantidades por molde y calidad de lotes. Las copias conservan las fórmulas originales; los experimentos de operandos se registran aparte.

Se extrajeron **9.648 valores de celdas**: 9.144 resultados de fórmulas y 504 literales necesarios para contrastar todos los componentes laborales. El comparador ejecutó **4.272 comprobaciones**: **4.220 válidas sin diferencias** y 52 observaciones de errores devueltos por el propio Excel. Estas últimas se identifican como `source_error`, no como igualdad numérica. Los resultados cubren ambas hojas de capacidad, los nueve requerimientos de materiales, componentes de nómina de ambos regímenes, activos, puntajes, lotes y mercados.

Las seis diferencias pequeñas encontradas inicialmente contra cachés salariales de seis decimales desaparecen al recalcular las fórmulas originales con Excel. No se añadió ROUND al motor para copiar una caché truncada.

Cuatro experimentos adicionales verifican la identidad decimal de `G54`. Sustituyen deliberadamente el operando `F54` en copias; están marcados `formula_modified_in_copy=true` y **no se cuentan como escenarios con fórmulas originales intactas**. La fuente real permanece intacta.

Reproducción: generar planes con `tests/audit_excel_original_20261023.py`, recalcular con `tests/auditoria_original_com_20261023.py`, comparar con `node tests/auditoria_original_20261023.cjs`. El modo `--read-existing` solo vuelve a extraer celdas de copias ya recalculadas si coinciden el hash fuente y todos los operandos con el manifiesto de ejecución; no utiliza resultados SIDE como esperados. Fixture versionado: `tests/oracle/auditoria_original_recalculado_20261023.json`; evidencia detallada: `reports/auditoria_recalculo_original_20261023.json`.

## Anomalías del Excel y criterio aplicado

- **24 frente a 30 días y productividades distintas:** ejecución usa CANTIDAD; las comprobaciones de la hoja Costos usan sus propios 30 días y productividades. No se mezclan ambas tablas.
- **Referencia económica en mercados medio/premium:** se conserva literalmente; no se sustituye silenciosamente por el total de cada segmento. Se documenta incluso si puede tratarse de una referencia accidental del autor.
- **Errores de fórmula:** cuatro `#DIV/0!` ya están en la caché original como texto; tras recálculo aparecen también errores IFS y casos de divisiones sin guarda. Se registran sus coordenadas. El juego mantiene guardas finitas para precios empatados, población vacía y meta cero, explícitamente como comportamiento operativo.
- **Compras con constantes incoherentes:** se usan las unidades productivas rotuladas `V76:X83` y conversiones `D32:K33`; no se copian cantidades incrustadas incompatibles de AB77/AB82/AB83. Para consumir y valorar se conserva la cantidad efectivamente fabricada; no se trunca 107,5 a 107 por el ejemplo AB89.
- **CONS-03 y CONS-08:** la matriz contiene texto, sin fórmula que ordene sus efectos respecto a topes físicos. Se conserva la reducción posterior a los límites de material/capacidad para no consumir más stock ni fabricar más de lo disponible. Se identifica como criterio de integración, no como precedencia demostrada por una celda del libro.
- **Fórmulas ausentes:** dotación inversa, tiempo por unidad, tarifa de horas extra, almacenaje, incremento bancario, calendario de caja y combinación de descuentos no tienen una definición numérica completa en el original. Se conservan las extensiones históricas ya existentes y su procedencia, sin inventar nuevos importes ni presentarlas como fórmulas originales. La recomendación inversa sigue marcada como no definida en el DOP.

El alcance de auditoría queda concluido con estas salvedades de fuente. La validación no convierte reglas históricas o contradicciones del libro en fórmulas únicas.

## Regeneración y pruebas

Los oráculos históricos se reconstruyeron desde decisiones y fórmulas; Excel calculó los esperados antes de ejecutar el comparador SIDE. Se respaldaron los archivos previos en `.codex-work/auditoria-20261023/oracle-backup`. **696 de 3.104 salidas cambian** por las correcciones, con cada clave y valor anterior/nuevo en [transición de oráculos](auditoria_transicion_oraculos_20261023.json). No se copiaron obtenidos del motor para fabricar esperados.

- Ocho escenarios históricos: **3.104 salidas, cero diferencias**. Catorce casos DOP del original: cero diferencias.
- SIM-1: un ciclo, cuatro empresas, **468 salidas, cero diferencias**.
- SIM-2: tres ciclos, dos empresas, **585 salidas, cero diferencias**.
- SIM-3: tres ciclos, cinco empresas, **1.140 salidas, cero diferencias**.
- Navegador DOP: **767 comprobaciones**, cero errores; cantidades, guardado, stock, costos y caja.
- Persistencia PostgreSQL local y tarjetas por pestaña: pasan. No se ejecutó SQL remoto.
- Batería Node completa: **568/568**, cero fallos, cancelados u omitidos; duración 571,3 segundos. Registro: `tests/output/auditoria-20261023/node-final.log`. No hubo fallos NPC en esta ejecución.

## Entrega

Cambios por área en commits; no se modifican decisiones, avatares ni mundo 3D. Se actualizan las claves de caché de estudiante/docente. **No hay que actualizar Supabase ni ejecutar SQL.** La petición posterior «haz push» autoriza la publicación de esta revisión de auditoría, incluidos los commits locales anteriores.

El primer push normal a `origin/main` confirmó `159e5fc..7935244`, con código corregido, pruebas, oráculos y evidencias independientes. El cierre documental incorpora el resultado final 568/568 en un commit posterior y se publica mediante un segundo push normal, sin forzar. Antes del cierre se comprobó la ausencia de diferencias de formato, el hash original intacto y que el directorio contenedor únicamente tiene SIDE1. Se restauró únicamente el bytecode generado por las pruebas.
