# SIDE - Correccion final v2026.09.07.2

## Sala del estudiante

Se separaron el contenido desplazable (`.lobby-content`) y el pie de acciones
(`.lobby-actions`). La tarjeta ocupa la altura disponible de la ventana. Solo el
contenido informativo tiene desplazamiento, de modo que el boton de entrada no
puede quedar debajo del recorte del cuadro. Se retiraron las reglas antiguas de
altura fija y recorte que competian con esta estructura. La franja de acciones
incluye tambien el tutorial, volver y la identificacion de version.

## Canales de venta

Cada tarjeta de distrito contiene un selector de cantidad al estar marcada. El
selector es hermano de la etiqueta del checkbox, no esta anidado dentro de ella:
por tanto, pulsar los botones o escribir una cantidad no desmarca el distrito.
Los campos mantienen los identificadores y datos usados por las reglas contables
existentes. La nueva cantidad se centra en el espacio visible entre las barras
ancladas, incluido el modo movil. El resumen agregado permanece debajo.

Las cantidades son enteras y respetan el minimo de una tienda al seleccionar un
distrito, asi como los contratos de ciclos anteriores. Los borradores siguen
siendo editables antes del envio, y guardar de nuevo no duplica el costo.

## Evitar abrir una copia anterior

`index.html` y `docente.html` referencian los recursos locales con la version
`20260907-2`. El nuevo servidor de desarrollo comprueba el puerto antes de abrir
el navegador y establece cabeceras de no cache para HTML/CSS/JS. No abre otro
puerto automaticamente para no cambiar silenciosamente el almacenamiento local.

## Archivos de ejecucion modificados o agregados

- `index.html`: nueva estructura de sala y recursos versionados.
- `styles.css`: pie visible, contenido desplazable y controles dentro de tarjetas.
- `app.js`: renderizado por distrito, cantidades visibles y navegacion versionada.
- `docente.html`: referencias versionadas; no se cambio el calendario del docente.
- `tutorial.html`: indicacion de cantidades y explicacion del vendedor incluido.
- `INICIAR_JUEGO.bat` / `servidor_local.py`: inicio desde la carpeta correcta.

Las pruebas y los documentos de esta entrega estan identificados con FINAL_V2.
Los informes anteriores se conservan como historial y no sustituyen a la nueva
validacion. No se han eliminado imagenes, recursos del 3D ni archivos originales.
