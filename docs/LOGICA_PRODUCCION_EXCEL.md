# Modelo de producción de la fábrica de bolsos

Referencia: [DECISIONES_SIDE_logica_produccion.xlsx](DECISIONES_SIDE_logica_produccion.xlsx), hoja **CANTIDAD DE PRODUCCIÓN**.

Este cambio mejora el modelo de Excel. No modifica todavía el motor JavaScript del videojuego. Las demás hojas y las tablas de ventas conservan sus ejemplos independientes.

## Reglas del ciclo

- La etapa con menor capacidad diaria limita la fábrica. Se aplican días laborables y eficiencia, y se redondea hacia abajo a bolsos completos.
- La eficiencia usa la proporción de trabajadores de nivel 3 de todas las máquinas y la presencia de jefatura. Los parámetros propuestos son editables: base 90 %, mejora máxima por N3 de 6 puntos porcentuales y mejora por jefatura de 4 puntos, con tope de 100 %.
- Cada puesto ocupado supone una máquina o mesa disponible. Cada tipo de bolso utiliza una unidad de capacidad; no se han introducido tiempos distintos por producto.
- La capacidad se reparte proporcionalmente al plan mediante redondeo acumulado, conservando el total entero y sin exceder la cantidad solicitada.
- El jugador solicita reservas de materiales por producto. Cuando exceden el stock, se reducen proporcionalmente. Los accesorios se reservan en unidades enteras.
- La producción queda limitada por el cupo, el plan y las reservas de cuero, accesorios e hilo. Los cupos y reservas no se redistribuyen durante el ciclo: la capacidad ociosa es visible.
- El consumo respeta la mezcla aprobada. El inventario final es inicial más compras menos consumo efectivo; las reservas no utilizadas permanecen en inventario.
- La calidad se calcula con los materiales efectivamente consumidos. Los puntajes y pesos propuestos son editables para balancear el juego.
- La reputación del ciclo pondera cumplimiento del plan, proporción de personal N3, calidad y publicidad, en escala 0–10. No incluye historial de ciclos y es cero cuando no se produce.

## Uso

1. Configurar personal, puestos de maquinaria ocupados y jefatura.
2. Ingresar el plan en `D37:D39`.
3. Ingresar inventario y compras en `D63:E71`, en m² de cuero, unidades de accesorios y metros de hilo.
4. Solicitar reservas en `D49:L51`.
5. Revisar los resultados en `K12:L18`, el detalle por producto en `E56:K58` y el inventario final en `G63:G71`.

Los parámetros y cálculos de reservas, consumo y calidad se encuentran a la derecha, desde la columna P.

## Verificación

Se recalcularon nueve escenarios con Artifact Tool: sin plan, sin trabajadores, sin materiales, plan inferior a capacidad, sin jefe, cambio de personal N3 semiindustrial, reservas superiores al stock, un producto sin reservas y publicidad superior al tope.

Se comprobaron límites de capacidad y plan, bolsos enteros, conservación del reparto, consumo no superior a las reservas, conciliación y no negatividad del inventario y escalas de calidad y reputación. Se restauraron las entradas originales y se verificó el archivo exportado sin errores de fórmula almacenados. No se realizó una prueba interactiva en Excel de escritorio.

Con las entradas del ejemplo, el resultado es 397 bolsos de capacidad y 190 producidos (95 básicos, 71 mejorados y 24 premium). Son resultados del ejemplo, no objetivos fijos del juego.
