# SIDE — Boss Bags | Menú de decisiones tipo juego

Esta versión usa como base el proyecto **SIDE_Boss_Bags_DECISIONES_GAME_FINAL** y reconstruye el apartado de decisiones desde la hoja `Catalogo_Decisiones` del Excel entregado.

## Decisiones jugables
- Empresa: Segmento / línea.
- Infraestructura.
- Recursos Humanos.
- Canales y ventas.
- Insumos.
- Inversiones.
- Finanzas.

Los campos de identidad de empresa que no corresponden a una jugada no forman parte del menú.

## Selección múltiple
En Infraestructura y Recursos Humanos, los menús con tres alternativas permiten combinar hasta **3 opciones**. Las decisiones binarias o de opción única se mantienen como selección exclusiva para evitar elecciones contradictorias.

## Interfaz
- Iconos de categorías y controles tomados del paquete de iconos entregado.
- Tarjetas de jugada ordenadas por categoría.
- Indicador 1/3, 2/3 o 3/3 en decisiones múltiples.
- Costo, permanencia, código e impactos de cada alternativa.
- Estados visuales pendiente, por guardar y guardada.
- Confirmación por cada jugada y progreso global de la ronda.

## Demo
- Profesor: `profesor@upch.pe`
- Contraseña: `Heredia`
- Partida: `SIDE-000`

## Archivos principales
- `decision_catalog.js`: catálogo generado desde el Excel.
- `app.js`: lógica de selección, guardado y progreso.
- `styles.css`: interfaz de decisiones estilo videojuego.
- `assets/icons/`: iconos SVG usados en el menú y botones.
