# SIDE | Laboratorio Estratégico

El laboratorio ayuda al docente a explicar resultados oficiales de un ciclo cerrado, formular una decisión alternativa y comparar dos empresas de la misma partida. En el panel docente, abra **Laboratorio Estratégico**, elija una partida, empresa y ciclo y pulse **Actualizar datos**. Solo aparecen las partidas que permite consultar la sesión autenticada. Si el ciclo aún no está cerrado, se informa que el cierre está pendiente.

En **Ver resultados**, las cuatro tarjetas muestran ventas, utilidad neta, margen neto y cumplimiento de producción. El margen es utilidad neta dividida entre ventas; el cumplimiento es producción realizada dividida entre meta. Cuando las ventas o la meta son cero, el porcentaje figura como «No disponible». Los botones seleccionan el gráfico principal: **Rentabilidad** muestra el desglose financiero cuando sus componentes concilian; **Producción** compara meta, fabricación y unidades vendidas; **Competencia** compara dos empresas de la partida; y **Evolución** presenta una línea de ventas, utilidad o caja de los ciclos cerrados hasta el ciclo elegido. Los huecos indican que falta un cierre o un indicador. Las pérdidas aparecen a la izquierda del cero en barras y por debajo de la línea cero en evolución. El segundo panel muestra evolución relacionada con la vista; si no hay suficientes cierres comparables, explica por qué no hay tendencia. Cada gráfico tiene valores, unidad y una explicación breve.

El gráfico de rentabilidad no suma costos totales a sus componentes: muestra costo de ventas, gastos operativos, gastos financieros e impuesto por separado. Si faltan componentes o el cálculo no concilia con la utilidad neta, solo se muestran ventas y utilidad disponibles, junto con una advertencia. El diagnóstico no supone que una producción inferior equivalga a ventas perdidas ni atribuye causas no comprobadas.

En **Probar otra decisión**, seleccione la decisión original, comprar más materiales o contratar más trabajadores. El gráfico muestra la producción real. Las dos alternativas adicionales son preguntas cualitativas: la estimación cuantitativa no está disponible porque no se ha validado una reproducción histórica aislada del motor y sus entradas. No se escriben decisiones, inventarios ni cierres. No se proyectan ventas ni ganancias.

En **Comparar empresas**, seleccione una segunda empresa de la misma partida y un indicador. Se muestra el mismo ciclo cerrado para ambas. El margen neto es utilidad neta dividida entre ventas, expresada como porcentaje; si las ventas son cero o faltan datos no se calcula. Una diferencia entre empresas no demuestra causalidad. La participación de mercado no se calcula en esta versión.

**Mostrar al estudiante** amplía el gráfico y oculta navegación y controles administrativos. Primero elija la vista, el gráfico y la alternativa que desea explicar. El modo muestra la empresa, el ciclo, hasta tres indicadores, el gráfico, una explicación y una pregunta; use «Volver al panel docente» para cambiar las opciones. No crea enlaces públicos.

## Procedencia y límites

La sesión de Supabase Auth consulta `partidas` y `participantes` con las políticas RLS existentes. `side_consultar_cierre_negocio` comprueba en PostgreSQL la propiedad de la partida y devuelve el cierre de `side_business_closures` para un ciclo. Las cifras provienen de `receipt` y `financial` de ese cierre, nunca de una reconstrucción con decisiones editables. Los cierres anteriores que no existan en esta fuente no se sustituyen por datos provisionales. La función existente devuelve todas las empresas del ciclo autorizado al navegador; una futura RPC de lectura filtrada por empresa reduciría los datos transferidos. No se instala ninguna migración. La revisión de consistencia comprueba ingresos frente al recibo y utilidad frente a resultado antes de impuestos menos impuesto; no constituye una auditoría contable completa. Los límites materiales y de capacidad requieren validación adicional antes de atribuirles una causa.

## Cómo usar el dashboard en clase

1. Inicia sesión como docente y abre Laboratorio Estratégico. Selecciona partida, empresa y ciclo; el sistema confirma si hay cierre oficial.
2. Lee las cuatro tarjetas. Una cifra ausente no se convierte en cero; si la meta es cero, el cumplimiento es «No aplica».
3. Elige Rentabilidad, Producción, Competencia o Evolución. Los dos paneles ayudan a explicar el ciclo y su evolución; las comparaciones con el ciclo anterior solo aparecen cuando hay datos comparables.
4. Usa Probar otra decisión para formular una hipótesis. La alternativa está marcada como simulación educativa y no se calcula numéricamente con datos insuficientes.
5. Selecciona «Mostrar al estudiante» para proyectar un gráfico, como máximo tres indicadores y una pregunta. Vuelve al panel para cambiar los filtros.

Si se abre SIDE desde localhost o 127.0.0.1, el botón «Activar demostración local» permite explorar datos ficticios aislados. Esa demostración es voluntaria, muestra su etiqueta incluso en proyección y no sustituye una conexión fallida. Para regresar a la información real pulsa «Salir de demostración». No está disponible en el sitio público.

## Fichas de indicadores

| Indicador | Fuente y fórmula | Disponibilidad e interpretación |
| --- | --- | --- |
| Ventas | `financial.estadoResultados.ingresos`, soles del cierre | Sin advertencias o inconsistencias; compara la diferencia en soles con el ciclo inmediatamente anterior cerrado. |
| Utilidad neta | `financial.estadoResultados.utilidadNeta`, soles | Resultado tras impuesto registrado; negativo significa pérdida. No es caja. |
| Margen neto | utilidad neta / ventas × 100, porcentaje | Solo con ventas positivas y finanzas verificables; diferencia frente al ciclo anterior en puntos porcentuales. |
| Cumplimiento | `receipt.produced` / `receipt.production.target` × 100, porcentaje | Solo con meta positiva y producción disponible; diferencia frente al ciclo anterior en puntos porcentuales. |

El desglose financiero utiliza `costoVentas`, `gastosOperacion`, `gastosFinancieros`, `ingresosFinancieros` e `impuestoRenta` del mismo snapshot y se presenta solo si concilia con la utilidad. No se calculan ROE ni DuPont. Las ventas pueden incluir inventario previo y no son necesariamente iguales a las unidades fabricadas.
