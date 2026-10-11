# SIDE — Subfase Móvil, 01/10/2026

**PAUSADO por petición explícita del usuario antes del cierre de Fase 2.** Skill `frontend-design` leída en el catálogo local de anthropics/skills; identidad navy/dorada y Montserrat conforme a `docs/design_system.md`. Sin commit móvil.

Propiedad exclusiva: `css/responsive.css`, `tests/mobile_integral_ui.cjs` y este informe. Se conserva la lógica de decisiones/ciclos, los avatares, el mapa y el esquema de Supabase.

## Cambios

- HUD de móvil en dos zonas: navegación a la izquierda y cifras a la derecha. Utilidad vuelve a estar visible, junto a Caja, Stock, Tiempo y Satisfacción. Misiones quedan debajo de las cifras; el panel puede desplazarse para leer instrucciones completas.
- Controles del HUD, mapa, cierre de diálogos y puntos de navegación del tutorial con objetivos de 44 px. Los puntos del tutorial conservan el indicador discreto en un botón mayor y permiten envolver la fila.
- Tablet permite envolver títulos y etiquetas. Sin fuentes, imágenes ni efectos gráficos adicionales.
- Reglas específicas por ancho y altura, con especificidad explícita para las hojas cargadas después de `responsive.css`.

## Pruebas

- `node --check tests/mobile_integral_ui.cjs`: aprobado.
- `node --test --test-concurrency=1 tests/responsive_delivery.test.js`: 4/4 aprobado.
- Runner visual preparado: `node tests/mobile_integral_ui.cjs`. Anchos 360, 390 y 768; horizontal 800×360, 844×390 y 1024×768. Recubre splash, perfiles, acceso estudiantil, login y registro docente, tutorial, lobby, Tablet, HUD y las seis pestañas docentes. Verifica desborde, objetivos de 44 px en ambos ejes y separación de cifras/navegación/misiones. Servicios aislados y datos explícitos de prueba; no inicializa WebGL ni escribe en Supabase.
- Complemento WebGL real: `node tests/gameplay_hud.cjs`, por ejecutar secuencialmente tras el runner visual.

## Punto exacto del pare

- Modificados sin commit: `css/responsive.css` (87 líneas nuevas), `tests/mobile_integral_ui.cjs` y este informe. No se alteraron archivos ajenos a esta propiedad.
- Última ejecución táctil (sesión 12801): PASS completos en 360×800, 390×844, 768×1024 y 800×360. Son 22 verificaciones por tamaño, incluidas separación HUD, siete controles táctiles, ausencia de cruces entre botones, objetivos de 44 px y todas las pestañas docentes. Sin errores JavaScript registrados.
- 844×390 alcanzó las capturas de estudiante, oficina financiera y todas las pestañas de Tablet, además de medir el HUD. **Pendiente detectado:** las siete flechas/acciones táctiles tienen ancho 42 px y altura 44 px; la regla de ancho mínimo del HUD está limitada a 820 px. Al retomar, extender específicamente ese objetivo táctil a la banda 821–1180 px, sin ocultar el fallo. Sus botones no se superponen, Utilidad/Stock/Satisfacción están visibles y navegación/cifras/misiones quedan separadas. Esta anchura no se declara aprobada.
- 1024×768 no se completó en la última ejecución. El JSON global conserva `passed:false`, correctamente. Algunas PNG de intentos anteriores permanecen en el directorio; el JSON de la última ejecución es la fuente del estado, no la existencia de una imagen.
- Detenido por el agente principal el árbol verificado del runner Node PID 27936 y sus procesos Chromium. La sesión del runner terminó con código 1 al interrumpirla. No se iniciaron más pruebas ni modificaciones de interfaz tras el pare.
- Complemento `gameplay_hud.cjs` **no ejecutado**. Los cinco originales de `tests/output/gameplay/` siguen intactos; copia preventiva en `.codex-work/mejora-side-2026-10-01/mobile-gameplay-prior/gameplay/`.

Capturas y registro parcial: `tests/output/mejora-integral-2026-10-01/fase2/movil/`, `results.json`. Para continuar: corregir el ancho táctil indicado, correr el runner móvil completo solo, revisar visualmente las PNG táctiles 360 y horizontal y, después, correr `gameplay_hud.cjs` con Chromium/WebGL exclusivo; archivar sus evidencias y restaurar los cinco originales. Solicitar revisión del agente principal antes del stage y commit móvil.

## Fallos resueltos y límites

- Aplicación: flecha de tutorial de 38/42 px; puntos de tutorial de 7 px; filtros/selectores/acciones del resumen Tablet de 28/34,5/36 px; hitareas de los cuatro radios docentes de 40 px a 844. Se ampliaron mediante CSS localizado. Utilidad se recuperó también en horizontal, donde una regla heredada hasta 950 px la ocultaba.
- Inspección de imagen inicial encontró cifras largas partidas, «Satisfacción» con la última letra aislada y palabras cortadas en acciones de 44 px. Se aumentó espacio por columna financiera, se redujo padding y se recuperaron los iconos secundarios originales, conservando sus nombres accesibles en DOM/ARIA. Falta la revisión visual final completa del agente principal.
- Fixture, separado de los problemas de aplicación: reutilizar la misma página para estudiante y profesor redeclaraba globales; ahora emplea páginas independientes. Las capturas fullPage y el cierre de una sesión CDP podían perder la emulación táctil; se mantiene la sesión CDP por página, se restablece touch y se comprueba `matchMedia('(pointer:coarse)')`. HUD se captura como viewport. El toast temporal de la confirmación se espera hasta su cierre, con límite de 5 segundos.
- Node 4/4 y sintaxis aprobados en la preparación; no se repitieron después de todos los últimos ajustes, por lo que forman parte del siguiente cierre. Este runner utiliza DOM y servicios locales aislados; no certifica Supabase remoto ni rendimiento 3D.
