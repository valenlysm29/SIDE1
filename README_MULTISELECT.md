# SIDE — decisiones con selección múltiple

Esta versión usa el último paquete de iconos sin texto y mantiene el apartado de decisiones como una interfaz de videojuego.

## Selección múltiple

- Tipos de bolsos: se pueden elegir los 3 modelos a la vez (Tote, Cartera y Mochila).
- Infraestructura: Máquina de ensamblado, Máquina de acabados, Molde y Mantenimiento permiten combinar hasta 3 opciones.
- RRHH: Personal de corte, Personal de ensamble y Personal de acabados permiten combinar hasta 3 opciones.
- El resto de decisiones conserva selección única cuando el catálogo corresponde a una alternativa mutuamente excluyente.
- Mesa de corte, limpieza/servicios y local permanecen como opciones únicas/obligatorias según el catálogo.

Las opciones se seleccionan primero, se muestran resaltadas y luego se confirman con el botón de acción inferior. El estado se guarda por empresa en localStorage y, cuando Supabase está conectado, se registra como arreglo de opciones en la tabla `decisiones`.
