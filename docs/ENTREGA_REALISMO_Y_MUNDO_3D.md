# SIDE · Personajes y acceso al mundo 3D

Versión: **2026.09.17.3**.

## Ejecutar esta entrega

1. Extrae el ZIP completo en una carpeta nueva.
2. Ejecuta `SIDE1/INICIAR_JUEGO.bat`. Necesita Python 3; las bibliotecas del motor 3D vienen incluidas.
3. Completa y envía las decisiones: puedes confirmar todo o enviar cada apartado por separado.
4. En **Empresa**, pulsa **INICIAR MUNDO 3D** en la tarjeta superior.
5. Haz clic en el juego para controlar la cámara. Usa WASD para moverte y E para interactuar; Ayuda muestra los controles.

Para revisar los modelos por separado, con el servidor encendido abre
`http://localhost:8000/tools/character_preview.html`.
Arrastra para girar, usa la rueda para acercarte y Espacio para alternar reposo y marcha.

## Cambios aplicados

- Tres modelos GLB nuevos: asesor formal, asesora y personal casual. Sustituyen la construcción por piezas primitivas en el simulador web existente.
- Rostro anatómico, orejas, cuello, manos con dedos y prendas separadas. Piel con textura, cabello con transparencia recortada, cejas, pestañas y ojos con iris visible y acabado húmedo.
- Esqueleto de 163 huesos y clips `Idle`, `Walk` y `Gesture`. El simulador utiliza reposo y marcha con transición; `Gesture` queda disponible en el archivo para ampliar las interacciones.
- Los puestos de los asesores y las rutas de los NPC siguen definidos por el controlador existente. Se clona el esqueleto por personaje para evitar que varias instancias compartan la misma pose.
- Geometrías y texturas reutilizables se conservan al reconstruir el mundo. Se libera el esqueleto de las instancias retiradas.
- El acceso reconoce los envíos individuales persistidos, además de la confirmación global. El botón de inicio aparece arriba del resumen de Empresa.
- La carga permite hasta 90 segundos para preparar el motor y las texturas, evita inicios duplicados y permite reintentar ante errores sin reenviar ni alterar las decisiones.
- Three.js y Recast se cargan desde esta carpeta. El simulador entra directamente al turno tras la carga.
- El servidor local evita que otro proceso ocupe el mismo puerto en Windows y abra por accidente una copia anterior.

## Verificación

- Navegador Chromium con WebGL: envío completo y envío por secciones, recarga de página, entrada al mundo, navegación Recast y carga de los tres modelos. Las conexiones a hosts externos se bloquearon durante esta prueba.
- Se comprobó el error de preparación, recuperación del botón, conservación de decisiones y caja, y rechazo del doble inicio.
- Resumen de Empresa probado a 390 px de ancho, sin desbordamiento horizontal.
- Los GLB pasan el validador de Khronos con **cero errores**. Quedan dos advertencias por modelo: cálculo de tangentes en el importador y metadatos de una imagen, según el archivo.
- Pruebas del servidor local: **2 aprobadas**.
- Suite Node existente: **62 de 68 aprobadas**. Las seis fallas de `cycle_productivity.test.js` también ocurren en la versión original de Git: esperan funciones ausentes y una regla de tienda única incompatible con el catálogo actual. Se conserva la evidencia en `tests/output/baseline-existing-failures.txt`.
- Evidencia del mundo: `tests/output/world-startup-results.json`, `world-all.png`, `world-sections.png` y `world-start-mobile.png`.

Esta entrega mejora claramente la anatomía y el vestuario, pero todavía no equivale a un personaje escaneado de calidad cinematográfica. Las animaciones son ciclos básicos; no se implementó captura facial ni SSS de piel personalizado. El rendimiento se comprobó funcionalmente con un renderizador de prueba, sin medir FPS representativos de tu GPU. Los GLB pesan aproximadamente 13–20 MiB cada uno.

El inicio local del mundo está comprobado. La autenticación y el envío remoto a Supabase dependen de la configuración existente y no se validaron contra una cuenta real.

## Fuentes y reproducción

Los modelos utilizan **activos gráficos CC0 de MakeHuman**, con fuentes y licencias en `tools/character_sources/`. No se incorporó el código de su aplicación.
El origen, commit y hashes de los activos se registran en los archivos `SOURCE.json`.

- Generar modelos: `python tools/build_realistic_characters.py` (requiere NumPy).
- Validar GLB: instalar `gltf-validator` y ejecutar `node tools/validate_characters.cjs`; también acepta `GLTF_VALIDATOR_PATH`.
- Probar el acceso: con el servidor activo, ejecutar `node tests/world_startup.cjs` (requiere Playwright y Chrome). `SIDE_TEST_URL` permite cambiar la dirección local.
- Los paquetes Three.js 0.180.0 y Recast 0.43.1 incluyen su procedencia y licencia en `vendor/`.

El proyecto ejecutable modificado es **el simulador web SIDE1**. El ejemplo Godot y la guía técnica entregados anteriormente son archivos separados.
