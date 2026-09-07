# Validación de la entrega SIDE - 07/09/2026

## Resultado

- 9 pruebas unitarias de las reglas compartidas: aprobadas.
- 40 comprobaciones de interfaz y funcionamiento en navegador aislado: aprobadas.
- 9 archivos JavaScript de la raíz: comprobación sintáctica con `node --check`, sin errores.
- 42 referencias locales de los HTML de entrada: sus archivos existen.
- Los 5 nuevos SVG del docente se analizaron correctamente como XML y cargaron en el navegador de prueba.
- Ningún error JavaScript no controlado durante los escenarios comprobados.

## Escenarios comprobados

Calendario: configuración de 6 ciclos de 8 horas con 0 minutos, fecha final a las 48 horas, cambio de año, rechazo de duración cero, inicio programado, avance al ciclo correcto por tiempo transcurrido, finalización sin ciclo adicional, restauración de las fechas manuales y desplazamiento estable de la lista.

Ventas: selección web sin tiendas, cantidades independientes de Los Olivos y Miraflores, costos y vendedores, guardado y recuperación de cantidades, borradores sin enviar, guardados repetidos sin doble cobro, bloqueo por falta de caja, envío y bloqueo de la pestaña, traslado al siguiente ciclo y vencimientos de contratos por lote.

Interfaz: iconos docentes SVG cargados, mantenimiento opcional deseleccionable, costo fijo obligatorio protegido, guardado de ventas sin perder borradores de otra pestaña, logo y botones inferiores accesibles a 1366 x 768, 390 x 844 y 768 x 600. En móvil también se verificaron los botones de cantidad y guardado y la ausencia de desbordamiento lateral de decisiones.

Se revisaron visualmente las capturas del calendario docente, el panel del estudiante, las cantidades en ventas y la vista móvil.

## Método y límites

Las pruebas de interfaz ejecutaron el HTML, CSS y JavaScript de esta entrega en Chromium con Playwright, cargados en memoria. Se incrustaron los recursos gráficos locales y se utilizó un sustituto de Web Storage para aislar los datos de prueba. Todas las solicitudes externas se bloquearon. La zona horaria de prueba fue `America/Lima` y los relojes de los casos temporales fueron simulados.

Este método comprueba la lógica local y la interacción visual, pero **no es una prueba de despliegue**. No se probó una conexión a Supabase real, la autenticación remota, la sincronización entre dispositivos, ni una sesión completa del motor 3D con sus CDN. Tampoco se prueba la resistencia de `localStorage` frente a borrado del sitio o fallos de almacenamiento. No se modificaron datos de un servidor externo.

El listado de las 40 comprobaciones está en `tests/RESULTADOS_VALIDACION.json`.

## Repetir las pruebas

Para las pruebas de reglas basta Node.js:

```bash
node --test tests/side_rules.test.js
```

Para las pruebas de interfaz se necesita Python, el paquete Playwright y Chromium/Google Chrome. El script detecta `chromium` o `google-chrome`, o acepta una ruta mediante `CHROMIUM_PATH`.

```bash
python tests/browser_checks.py
```

Las capturas y resultados se guardan en `/tmp/side-qa` por defecto. `SIDE_QA_OUTPUT` permite cambiar la carpeta. `SIDE_TEST_GROUP` acepta `teacher`, `sales`, `drafts`, `layout` o `all` (por defecto) para ejecutar un grupo. Los paquetes de prueba no son necesarios para utilizar la web.

Antes de usar con alumnos, realizar una prueba en el alojamiento y navegador definitivos. Para el funcionamiento local del reloj, mantener abierto el panel docente, como se indica en `CAMBIOS_07_09_2026.md`.
