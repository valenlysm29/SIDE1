# SIDE — Producción: revisión visual y estructural

Entrega del 17/09/2026, basada en el último ZIP corregido y las dos capturas adjuntas. Este informe sustituye las conclusiones visuales de la entrega anterior.

## Problemas encontrados

- Capas de estilos acumuladas con fondos semitransparentes y márgenes negativos en la cabecera.
- Cabecera, pestañas, título y acciones con posiciones fijas o sticky y alturas incompatibles. El panel de acciones se superponía al contenido, como muestran las capturas.
- Conectores antiguos mediante pseudoelementos independientes, posiciones absolutas y desplazamientos fijos. Las líneas no medían la posición de sus nodos ni se adaptaban a los textos.
- Resultado alineado al 50% de la página, separado del último nodo por espacio innecesario.
- Estados vacíos sin un resultado explícito de cero unidades y sin detalle de los moldes.

## Archivos modificados y nuevos

| Archivo | Cambio |
| --- | --- |
| `app.js` | Delega la representación del DOP al componente visual. Mantiene la fórmula original del porcentaje. Monta y desmonta los observadores al cambiar de pestaña y refresca el diagrama mientras se editan cantidades, sin cambiar los manejadores que actualizan las decisiones. |
| `production_dop.js` — nuevo | Componente JavaScript sin dependencias: representación de nodos, resultado y tabla; trazado SVG a partir de las dimensiones reales de las tarjetas; limpieza de observadores al desmontar. |
| `production.css` — nuevo | Estilos organizados mediante variables para paneles opacos, navegación, cabecera, calculadora, moldes, acciones y DOP adaptable. No contiene `!important`. |
| `styles.css` | Retirada del CSS obsoleto del DOP, sus líneas flotantes y las declaraciones `!important` que impedían corregir el contenedor de Decisiones. Se conservaron selectores compartidos de otras vistas. |
| `responsive.css` | Retirada del parche anterior de Decisiones, ahora sustituido por la hoja dedicada para evitar duplicación. Conserva el resto de adaptaciones globales. |
| `index.html` | Carga la nueva hoja de estilos y el componente DOP antes de la aplicación. |
| `tests/production_dop.test.js` — nuevo | Seis pruebas de conexiones, adaptación de coordenadas, ceros, escape de textos y ciclo de vida de los observadores. |
| `tests/decisions_corrections.test.js` | Incorpora el componente visual al entorno de pruebas; mantiene las comprobaciones de tiendas, guardado y DOP exclusivo de Producción. |
| `tests/static_delivery.test.js` | Valida la nueva ubicación de la representación y mantiene las comprobaciones de las cinco actividades documentadas. |
| `tests/RESULTADOS_DECISIONES_REVISADAS.txt` | Salida completa de las 60 pruebas aprobadas. |

El ZIP contiene el código JavaScript y CSS completo, junto con todos los recursos necesarios del proyecto; no es un parche ni requiere React o un proceso de compilación nuevo.

## Solución del layout

La pantalla usa un fondo continuo y opaco. Pestañas, cabecera de sección y acciones permanecen en el flujo del documento, sin superponerse al contenido. La barra de acciones aparece después de las decisiones, dentro del mismo panel. El desplazamiento es el de la página; no se oculta contenido para disimular desbordamientos.

Se mantienen las seis secciones y su navegación existente. La cabecera agrupa icono, nombre, descripción y saldo guardado. Las tarjetas de moldes utilizan la misma separación, relleno y bordes, con altura uniforme dentro de cada fila.

Adaptación prevista por CSS:

- Más de 1180 px: tres tarjetas de moldes y seis pestañas en una fila.
- De 701 a 1180 px: dos tarjetas por fila y tres pestañas por fila.
- Hasta 700 px: moldes y DOP en una columna, dos pestañas por fila y acciones apiladas.

No se añadieron alturas gigantes, márgenes negativos ni coordenadas de viewport fijas para posicionar nodos.

## Solución del DOP

Se conservan las cinco actividades y su numeración:

1. Corte de piezas — operación 1.
2. Clasificación de accesorios — inspección 1.
3. Preparación de accesorios — operación 2.
4. Ensamblado y colocación de accesorios — combinada 1.
5. Acabado final — combinada 2.

El flujo principal Cuero → Corte se une al ramal Accesorios → Clasificación → Preparación en Ensamblado. Continúa a Acabado y al resultado del ciclo. Los nodos muestran nombre, valor proveniente del plan existente, contexto del estado e información secundaria.

Cada nodo vive en una cuadrícula CSS normal. Una única capa SVG dibuja los siete enlaces. Sus extremos se obtienen con `getBoundingClientRect()` y se convierten al espacio del SVG. No hay líneas aisladas ni posiciones manuales de nodos. `ResizeObserver` recalcula las conexiones cuando cambia el tamaño de una tarjeta; también se actualizan después de cargar las fuentes y redimensionar la ventana.

En móvil, la continuidad de Corte a Ensamblado usa un canal lateral reservado dentro del diagrama; así no cruza las tarjetas del ramal de accesorios. Las conexiones de nodos consecutivos permanecen en los espacios entre tarjetas. Los observadores y fotogramas pendientes se cancelan al cambiar de pestaña.

Porcentaje, unidades finales y detalle por molde aparecen en un bloque de resultado propio. Con meta cero se muestran 0%, 0 unidades y los tres moldes con cero unidades. El estado vacío sigue indicándose y no hay división entre cero.

## Confirmación de lógica conservada

Se compararon byte a byte con el ZIP de la entrega anterior:

- `production_model.js`
- `decision_review_model.js`
- `side_rules.js`
- `decision_catalog.js`
- `company_summary.js`

Todos permanecen idénticos. Los cálculos, cantidades, costos, contratos, guardado, envío y orden del proceso no se modificaron. En `app.js` los cambios se limitan a la representación del DOP y su actualización visual.

El porcentaje mantiene exactamente la fórmula anterior:

```js
const producedPercent = plan.target
  ? Math.min(100, Math.round(plan.producibleUnits / plan.target * 100))
  : 0;
```

Los nodos consumen `productionPlan()` y las cantidades existentes. El modelo sigue representando producción posible del ciclo; no se inventó un registro de fabricación ejecutada. Los rótulos «Plan del ciclo», «Sin meta definida» y «Compra registrada» expresan el contexto de los datos existentes y no agregan estados al negocio.

## Verificación realizada

- `node --test tests/*.test.js`: **60/60 aprobadas, 0 fallos**.
- `python3 tests/local_server_test.py`: **2/2 aprobadas**.
- `node --check` sobre todos los archivos JavaScript de raíz y pruebas: aprobado.
- Bloques de CSS equilibrados y nueva hoja sin `!important`.
- Pruebas geométricas para escritorio y móvil: los siete enlaces empiezan y terminan en los bordes previstos y no atraviesan interiores de tarjetas en los escenarios probados.
- Prueba de redimensionamiento: las coordenadas siguen las dimensiones de los nodos.
- Pruebas de 0%, cero unidades, metas válidas, actualización de producción y cambio de ciclo.
- Pruebas de montaje, redibujado y limpieza de observadores.
- Se mantiene la comprobación de DOP exclusivo de Producción, sin duplicarlo en Resumen.
- El proyecto no tiene linter ni compilación configurados; continúa siendo una aplicación estática.

### Límite de la verificación

La revisión se basa en las capturas proporcionadas, inspección de código y pruebas automatizadas. **No se ha completado una inspección visual en navegador real**: el navegador disponible bloqueó el servidor local y las URLs de archivos por su política de seguridad en los intentos anteriores. No se intentó eludir esa restricción.

Las pruebas de geometría usan dimensiones controladas: no sustituyen una revisión real de todos los textos, tamaños de pantalla ni la consola completa. Para completar esa revisión hace falta una URL de pruebas accesible. Tampoco se probó la integración remota de Supabase ni el simulador 3D externo.

## Iniciar

Extraer el ZIP completo. En Windows, ejecutar `INICIAR_JUEGO.bat`. Alternativamente, ejecutar `python3 servidor_local.py --no-browser` y abrir `http://localhost:8000`. Cerrar previamente el servidor de cualquier copia anterior.
