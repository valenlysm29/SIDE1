# Validación de la reforma 3D — 10/09/2026

## Resultado automatizado

- Sintaxis JavaScript: `simulator3d.js` y `app.js` válidos.
- Pruebas Node.js: 48 aprobadas, 0 fallidas.
- Pruebas del servidor local: 2 aprobadas, 0 fallidas.
- Recursos comprobados por HTTP: HTML, CSS, aplicación, modelo productivo, configuración 3D, simulador 3D y modelo GLB local.
- Modelo humano local: contenedor GLB válido y animaciones de reposo y caminata disponibles.
- Integración comprobada: eventos del ciclo, plan de producción, inventario y registro financiero de ventas.

## Cobertura funcional incluida

- Sectores separados de tienda, almacén y producción.
- Ciudad, cruce peatonal, semáforos y tráfico con estados.
- Panel de noticias vinculado a eventos reales del ciclo.
- Clientes con máquina de estados, cola, abandono y causas de pérdida.
- Personal de ventas vinculado a las decisiones guardadas.
- Controles de teclado, ratón y pantalla táctil.
- HUD compacto, panel secundario desplegable y calidad gráfica adaptativa.
- Fallback procedural si el personaje GLB o una integración opcional no puede cargarse.
- Los borradores de Infraestructura, Producción y Logística se conservan aunque la proyección exceda la caja; el control de presupuesto se mantiene al enviar.

## Alcance de la validación en este entorno

El entorno de construcción no dispone de un navegador Chromium ejecutable con WebGL. Por ello, la validación visual interactiva final debe completarse abriendo `index.html` mediante `servidor_local.py` en un navegador del equipo de destino. Las pruebas automatizadas sí verifican sintaxis, carga HTTP, estructura del mundo, estados, recursos y conexiones con los sistemas existentes.

## Ejecución recomendada

1. Ejecutar `INICIAR_JUEGO.bat` en Windows o `python servidor_local.py` desde la carpeta del proyecto.
2. Abrir la dirección local indicada por el servidor.
3. Entrar a una partida y abrir el simulador 3D.
4. Probar movimiento, interacción, cola, falta de stock, vendedores, semáforo y cambio de ciclo.
