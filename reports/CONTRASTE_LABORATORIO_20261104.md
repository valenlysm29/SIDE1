# Legibilidad del Laboratorio Estratégico — 4 de noviembre de 2026

Causa: `css/docente.css` define `td { color:#d7e4f6 }` y encabezados genéricos oscuros. El fondo claro de `.lab-chart` no sustituía esos colores explícitos. Las reglas de texto del gráfico solo cubrían h3, p, span y strong, dejando fuera th y td. Las reglas generales de botones también reducían su opacidad a .55.

Corrección: tabla con colores locales opacos, cuerpo #0B1F3A sobre #EDF5FA y peso 600; encabezados blancos sobre azul marino; diferencias positivas #146C43, negativas #A32132 y neutras marino. Desplazamiento horizontal contenido para móviles, etiquetas largas con ajuste y foco visible en campos numéricos. Botones deshabilitados con colores legibles sin opacidad. Versionado de CSS y JS para renovación de caché. Sin nuevos !important ni cambios en motores, fórmulas o controles.

Validación sobre origin/main en copia aislada dentro de SIDE1:
- Chromium real: 1365×900, 390×900 y 320×900; sin desbordamiento horizontal de página, tabla desplazable.
- Todas las columnas, encabezados y tres colores de diferencia: contraste mínimo 5.85:1. Textos de barras y escala también superan 4.5:1.
- Poppins y peso 600 comprobados en todas las celdas; capturas inspeccionadas.
- Hover, navegación por teclado y foco; botón Evolución deshabilitado sin opacidad.
- Actualización de cantidad adicional y modo Mostrar al estudiante conservan la tabla y sus colores.
- Cierre de entrada intacto y ninguna petición de escritura en el navegador.
- 15 pruebas aprobadas: laboratorio_model, laboratorio_scenarios y laboratorio_service_codigos, incluyendo reproducción de cierres de tres y seis ciclos.

Prueba reproducible: `node tests/laboratorio_contrast_browser.cjs`. Usa playwright-core en la ubicación habitual del proyecto; permite configurar SIDE_PLAYWRIGHT. Las capturas quedan en tests/output/laboratorio_estrategico/ (ignoradas por Git).
