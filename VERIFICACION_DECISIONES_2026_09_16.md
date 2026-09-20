# Correcciones de Decisiones — 16/09/2026

## Archivos modificados

- `app.js`: una tarjeta de tienda con selector de distrito; retiro de controles de cantidad y bloques de insumos en Producción; renderizado compartido de productividad; actualización inmediata al editar la meta; scroll del documento.
- `side_rules.js`: normalización de partidas y borradores con varias tiendas a una sola, conservando el primer distrito seleccionado y el inicio de su contrato. Para partidas nuevas se usa el primer distrito del catálogo. El canal web sigue disponible.
- `production_model.js`: función pura `cycleProductivity(plan, record, round)`; valida el ciclo y los datos, y calcula cumplimiento y diferencia sin sustituir producción real por capacidad.
- `simulator3d.js`: contador persistente `producedUnits` en el registro existente del ciclo y acceso `cycleProductionRecord()`. Se actualiza cuando el motor materializa producción inicial, producción adicional y unidades de la línea. Ventas, devoluciones y suministros no incrementan este contador.
- `company_summary.js`: Resumen exclusivo del ciclo activo con cuatro indicadores productivos. Se mantienen la revisión y el envío de decisiones en su diálogo separado, con su validación existente.
- `decision_catalog.js`: descripciones de Producción y Resumen acordes a su nuevo contenido.
- `responsive.css`: contenedores de altura natural, pestañas que se distribuyen en filas y controles adaptables; la página conserva su desplazamiento vertical.
- `tests/cycle_productivity.test.js`: seis pruebas nuevas de cálculo, datos ausentes, aislamiento por empresa/ciclo, normalización de tiendas y persistencia del contador.
- `tests/decisions_cycle_ui.cjs`: pruebas de navegador reproducibles con Chromium y el fixture existente, sin cuentas ni almacenamiento real.
- `tests/static_delivery.test.js`: reemplazo del contrato visual del DOP anterior por la fuente compartida de productividad; conservación de las otras comprobaciones.

## Fuente de datos y cálculos

La meta procede de `productionPlan()`, que usa decisiones/borradores y el ciclo activo. La producción realizada procede de `SIDE3D.cycleProductionRecord()`, que lee el contador productivo del registro de la empresa y ciclo actuales. El motor ya materializaba producción en su inventario: ahora registra por separado cuántas unidades produjo, sin deducirlas de existencias o ventas.

- Cumplimiento = producción realizada / producción objetivo × 100.
- Diferencia = producción objetivo − producción realizada.
- El porcentaje no se limita a 100; la diferencia puede ser negativa si se supera la meta.
- Meta cero o ausente: `Sin objetivo`, sin división.
- Registro ausente, inválido o de otro ciclo: `Sin datos`. Las partidas antiguas sin contador no se convierten artificialmente en producción realizada.
- DOP y Resumen llaman al mismo cálculo y al mismo renderizador de indicadores. Solo se redondea la presentación del porcentaje, a un máximo de dos decimales.
- Los datos de prueba están aislados en `tests`; no hay cantidades de ejemplo insertadas en las vistas de producción.

## Criterios de aceptación comprobados

| Criterio | Comprobación |
| --- | --- |
| Una tienda | Tarjeta única, ausencia de botones/campos de cantidad, cambio de distrito, canal web, guardado y costo de una unidad; prueba de migración de varios distritos y contratos. |
| Sin scroll vertical interno | Inspección de dimensiones y `overflowY` de Decisiones, pestañas y contenedores en las seis pestañas y seis resoluciones. |
| Scroll normal operativo | Desplazamiento real del documento hasta el final de Producción con `window.scrollY > 0`. |
| Producción sin Materiales | Comprobación de ausencia de bloques/textos de insumos; las compras permanecen en Logística. |
| DOP exclusivo del ciclo | Registro aislado por empresa y ciclo; no se usan existencias, transporte ni materiales como indicadores. |
| Real, meta y cumplimiento | Casos de producción registrada, meta válida, cero, ausente y cumplimiento superior al 100 %. |
| Resumen productivo | Cuatro indicadores, diferencia con signo y ausencia de logística, materiales, inventario y financiamiento en su contenido. Se retira también el saldo de la cabecera de esta pestaña; el HUD general de la aplicación se conserva. |
| DOP y Resumen coinciden | Comparación del contenido de ambos tras editar la meta y con producción registrada. |
| Actualización de decisiones | Cambio de meta mediante el campo real, comprobado antes de perder el foco; navegación y cambio de ciclo. |
| Sin valores de ejemplo | Cálculo puro y lectura del registro existente; ausencia de registro se presenta explícitamente. |
| Sin errores de consola | Cero eventos `pageerror` y cero mensajes de consola de tipo error durante la prueba de navegador. |
| Responsive y otras pestañas | Infraestructura, Producción, Logística, Ventas, Finanzas y Resumen comprobadas a 1366×768, 1024×768, 768×1024, 390×844, 320×568 y 844×390, sin desbordamiento horizontal. Se comprobó además la apertura/cierre de la revisión de envío. |

## Resultados de herramientas

- Suite JavaScript completa: **52/54 aprobadas**. Las dos fallas restantes ya existían antes de editar: capacidad diaria esperada 6 frente a 5 en el modelo vigente, y estructura histórica del DOP esperada de seis pasos frente a cinco. No se modificaron las reglas productivas compartidas para satisfacer esas expectativas antiguas. La ejecución inicial tuvo 45/48 aprobadas; su tercera falla correspondía al contrato visual del DOP que esta solicitud reemplaza.
- Pruebas nuevas y comprobaciones de entrega: **13/13 aprobadas**.
- Navegador: todas las comprobaciones aprobadas. Evidencia en `tests/output/browser-checks.txt`, `production-desktop.png` y `summary-mobile.png`. Las cantidades de las capturas son datos del fixture de prueba.
- Sintaxis: `node --check` aprobado en los seis módulos JavaScript modificados.
- Servidor local: entrega HTTP aprobada. La prueba preexistente de puerto ocupado falla en Windows (`OSError not raised`); el servidor no fue modificado. También emite un aviso por conexión cerrada cuando la prueba lee solo la cabecera de un GLB.
- El proyecto es estático y no contiene `package.json`, configuración de linter ni proceso de compilación. No hay comandos de lint/build que ejecutar; se verificó sintaxis y carga de los scripts en Chromium.
- La prueba de navegador usa el fixture sin red del proyecto: no valida Supabase, las CDN ni el renderizador WebGL. El contador del motor se verificó mediante su cargador real en una VM aislada, sin iniciar WebGL.

## Reproducción

Desde `SIDE1`:

```powershell
node --test --test-reporter=tap tests/*.test.js
node tests/decisions_cycle_ui.cjs
python tests/local_server_test.py
```

La prueba de navegador necesita Playwright disponible para Node, `PYTHON_BIN` apuntando a Python y opcionalmente `CHROMIUM_PATH`. En esta sesión se usaron los runtimes incluidos con Codex y Chrome instalado. `tests/output/baseline-summary.txt` conserva el resultado previo y `tests/output/unit-tests.tap` el resultado final.

## Seguimiento: opciones de tiendas, DOP visible y etiquetas de envío

Se actualizaron `app.js`, `responsive.css` y `tests/decisions_cycle_ui.cjs`:

- Tiendas vuelve a presentar las tres alternativas del catálogo como tarjetas con selección exclusiva mediante radio. Conserva una tienda activa, el canal web independiente, costos, persistencia y restricciones de contrato/envío. Sustituye el selector desplegable descrito en la entrega anterior.
- DOP recupera el diagrama visible de Corte → Ensamblado → Acabado, derivado de los procesos del modelo, al inicio de Producción. Conserva los indicadores del ciclo y su actualización. No se monta en ninguna de las otras cinco pestañas ni en el diálogo de revisión.
- Los indicadores `ENVIADO` y `BORRADOR` ocupan una segunda fila de cada pestaña, con tipografía de 11 px, relleno, contraste y altura mínima de 24 px. El título y el icono conservan una fila independiente.
- Navegador: selección de cada alternativa, teclado, exclusividad, canal web, guardado, recarga y bloqueo comprobados. DOP visible y exclusivo en las seis resoluciones anteriores. Los cinco indicadores de envío se comprobaron geométricamente: contenidos dentro de su pestaña, sin corte de texto y sin intersección con título o icono. Cero errores de consola.
- `node --check` aprobado para aplicación y prueba de navegador. Suite completa: 52/54, con las mismas dos fallas preexistentes del modelo, descritas arriba.
- Evidencias actualizadas: `tests/output/browser-checks.txt`, `tests/output/unit-tests.tap`, `tests/output/dop-and-badges-mobile.png` y `tests/output/store-options-desktop.png`.
