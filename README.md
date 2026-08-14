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


## Panel docente
El panel del profesor fue separado completamente en:
- `docente.html`: estructura del panel.
- `docente.css`: estilos exclusivos del panel docente.
- `docente.js`: configuración, aleatoriedad, rondas, eventos, seguimiento, eliminación, podio y PDF.

### Configuración manual / aleatoria
Los parámetros económicos y de eventos incluyen modo **Manual** o **Aleatorio**. Los valores aleatorios se generan dentro del rango indicado y quedan guardados en la configuración local.

### Reportes de estudiantes
Mientras los módulos no estén conectados, `docente.js` utiliza `SIDE_STUDENT_REPORTS` en `localStorage` y muestra datos demo. La función `loadReports()` contiene un bloque `TODO CONEXIÓN ESTUDIANTE → DOCENTE` indicando dónde sustituirlo por Supabase/API.

Además, `app.js` contiene `syncStudentReportPreview()`, que simula el envío de un reporte desde el módulo estudiante al panel docente. Ese bloque también está marcado con `TODO BACKEND CONNECTION`.

### PDF
El botón **Ver PDF** abre una vista previa y **Descargar PDF** genera el reporte mediante jsPDF. El PDF incluye configuración, resultados, decisiones recibidas y, si existe, el podio publicado.

### Ganador y eliminación
El docente puede eliminar/reactivar empresas durante la simulación, seleccionar manualmente al ganador, escribir una justificación y publicar el podio. La publicación queda simulada en `SIDE_PUBLISHED_PODIUM` hasta conectar el backend.
