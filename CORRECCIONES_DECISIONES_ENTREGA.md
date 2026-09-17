# SIDE — correcciones de Decisiones

Entrega revisada: 17/09/2026. Base: `SIDE1-main(1).zip`.

## Alcance aplicado

Se priorizó la indicación final: conservar el DOP original y centrarlo exclusivamente en Producción, restaurar la elección de tiendas mediante opciones y mejorar la legibilidad de los estados de envío. No se sustituyó el DOP por tarjetas ni se reescribió su modelo productivo. El resto de la revisión financiera, el historial y los mecanismos de envío permanecen disponibles.

## Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `app.js` | Tiendas como opciones de radio, una sola tienda física activa, canal web independiente y eliminación de los campos y botones de cantidad de tiendas. DOP dentro de un contenedor de ancho completo exclusivo de Producción. Medición de las alturas de cabecera y pestañas para sus posiciones fijas. |
| `side_rules.js` | Normalización de la selección activa a una tienda. Ante datos antiguos duplicados conserva primero una tienda con contrato vigente, o la primera seleccionada; mantiene la fecha de su contrato y no modifica los objetos originales ni los comprobantes históricos. Las funciones compartidas de lectura histórica se conservan. |
| `company_summary.js` | Retirada de la llamada que insertaba el DOP en Resumen. Los enlaces de navegación utilizan ahora el desplazamiento de la página. |
| `responsive.css` | Eliminación del contenedor de scroll vertical de Decisiones. Pestañas en seis columnas en escritorio y tres en pantallas pequeñas, con estado en una fila propia, tamaño legible, separación y sin posicionamiento absoluto. DOP centrado. Las pestañas y la cabecera de sección dejan de estar fijas en pantallas pequeñas para dejar espacio al contenido. |
| `tests/decisions_corrections.test.js` | Seis pruebas funcionales nuevas con el código real de la aplicación y un doble mínimo del DOM. |
| `tests/production_model.test.js` | Expectativas actualizadas a 24 días, rendimiento de corte básico de 5 unidades/día y DOP documentado de cinco actividades. Se mantienen las comprobaciones de capacidad, eficiencia, tipos y numeración. |
| `tests/static_delivery.test.js` | Se comprueba Clasificación, la ausencia de la inspección final retirada y las cantidades de la tabla: 2 operaciones, 1 inspección, 2 combinadas, total 5. |
| `tests/RESULTADOS_DECISIONES_REVISADAS.txt` | Salida completa de la suite actual: 54 pruebas aprobadas. |

## DOP y cálculos

La función `productionDopHtml` y el archivo `production_model.js` se compararon con los del ZIP de entrada: son idénticos. No se alteraron símbolos, operaciones, materiales, textos ni fórmulas del DOP. Su porcentaje continúa siendo el original: meta distinta de cero → `Math.min(100, Math.round(producibleUnits / target * 100))`; sin meta se muestra el estado vacío. Los datos provienen de las decisiones del ciclo mediante `productionPlan()`.

El modelo existente calcula producción posible; no dispone aquí de un registro independiente de unidades efectivamente fabricadas. Esta entrega no inventa datos de producción ejecutada.

SHA-256 de la función DOP conservada: `ec7d1258e047fc6fafc2b0727a5c2385ab08102b86eeec87864c88f28e377b8d`.

## Comprobaciones

| Criterio | Resultado y alcance |
| --- | --- |
| Tiendas como opciones | Probadas tres opciones de radio. Cambiar distrito reemplaza la selección anterior; el canal web permanece independiente. No hay campo manual ni botones para añadir tiendas. |
| Costos, vendedor y guardado | Se probó una tienda, un vendedor básico, costo del distrito, recarga del borrador y guardados repetidos sin cobro duplicado. Los contratos vigentes siguen bloqueando el cambio de distrito. |
| DOP solo en Producción | Se ejecutó el renderizado de las seis categorías: una instancia en Producción y cero en las demás. También se comprobó la salida del resumen productivo sin DOP. |
| DOP sin alteraciones | Comparación exacta de la función y del modelo con el ZIP original. |
| Meta válida, cero y sin datos | Pruebas de 100%, cambio de insumos a 50%, meta cero, estado sin datos y cambio de ciclo. Sin `NaN` ni `Infinity`. |
| Estados de envío | CSS con filas separadas para icono/título y estado, sin superposición absoluta, texto sin salto y tamaño de 10–11 px. Pendiente de inspección visual en navegador. |
| Scroll y responsive | Se retiró la altura fija y el overflow del panel de Decisiones; el documento conserva su desplazamiento. CSS adaptable a 900 y 600 px y a pantallas de poca altura. Pendiente de medición visual de recortes y solapamientos. |
| Materiales en Producción | El catálogo original ya ubica las compras de materiales en Logística. Se conservaron las referencias internas del DOP y de su calculadora por la instrucción de no alterarlo. |
| Resumen | Se eliminó únicamente el DOP; se conservaron sus demás funciones y datos de revisión y envío conforme al alcance final de correcciones. |
| Consola | Sin errores en las seis pruebas funcionales con doble del DOM; no equivale a una validación de consola en un navegador real. |

## Pruebas ejecutadas

- `node --test tests/decisions_corrections.test.js`: 6/6 aprobadas.
- `node --test tests/*.test.js`: **54 pruebas aprobadas, 0 fallos**. En el ZIP original había 48 pruebas, 45 aprobadas y 3 fallos por expectativas desactualizadas.
- `node --check`: los 20 archivos JavaScript de la raíz aprobaron.
- `python3 tests/local_server_test.py`: 2/2 aprobadas, incluidos recursos HTTP y protección contra un puerto ocupado.
- El proyecto es HTML/CSS/JavaScript estático; no incluye `package.json`, compilación ni linter configurados. No se afirma haber ejecutado herramientas que no existen en el proyecto.

### Resolución de los tres fallos anteriores

La fuente de referencia es `CAMBIOS_DOP_Y_PRODUCCION.md`, que ya venía en el ZIP original. Documenta cinco actividades, retirada de Inspección final, dos operaciones, una inspección, dos combinadas y 24 días productivos por ciclo. También registra el ajuste de los rendimientos base. El modelo recibido fija el corte básico en 5 unidades/día.

1. Se corrigió el escenario de capacidad para usar 24 días. Con corte básico de 5 unidades/día, dos trabajadores de nivel 3 y jefatura, la eficiencia es 96% y la capacidad es `Math.round(5 * 24 * 0.96) = 115`. Se comprueban esos valores por separado.
2. La prueba del modelo DOP comprueba ahora la secuencia completa documentada, con sus cinco identificadores, tipos y numeración independiente. No se eliminó ni se omitió la prueba.
3. La prueba estática comprueba Clasificación, rechaza Inspección final y valida las cantidades de la tabla del DOP. Así deja de exigir una actividad que la especificación ya había retirado.

Esta revisión modifica las pruebas para alinearlas con la especificación existente. No modifica el DOP, sus fórmulas, sus textos ni `production_model.js`. Se repitió la comparación exacta con el ZIP original y se conservan idénticos.

### Validación visual: bloqueada

Se conectó el navegador Chrome disponible y se intentó abrir el servidor local y la copia de archivos compartida. El navegador rechazó el acceso: `net::ERR_BLOCKED_BY_CLIENT` para el servidor local y un rechazo explícito de la política de seguridad para la URL de archivo. No se eludió esa restricción.

Por ello **no se certifica la validación visual en escritorio o móvil**, la ausencia de solapamientos ni la consola de un navegador real. Para continuar se necesita una URL de pruebas accesible y autorizada. No se publicó el proyecto ni se modificaron sus permisos.

Las comprobaciones funcionales de renderizado se ejecutaron con el doble del DOM y siguen aprobadas. Las pruebas Python antiguas de interfaz que esperan varias tiendas corresponden al comportamiento anterior y no se ejecutaron. No se probó Supabase ni el simulador 3D externo.

## Iniciar

Extraer el ZIP completo y ejecutar `INICIAR_JUEGO.bat` en Windows, o `python3 servidor_local.py --no-browser` y abrir `http://localhost:8000`. Cerrar antes cualquier servidor de otra copia del proyecto. No es necesario instalar dependencias para iniciar SIDE.
