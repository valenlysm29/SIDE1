# Orientación móvil del mundo SIDE — 30-09-2026

## Causa y solución

La regla `max-width:560px` ocultaba todos los rótulos. Además, el cálculo de posiciones descartaba zonas en el borde izquierdo o inferior, fijaba `x=280` incluso en 360 px, y elegía solo por distancia. El panel del minimapa heredaba `top:180px` del HUD y `bottom:202px` de otro estilo, por lo que se estiraba sobre el joystick.

Los rótulos HTML ahora priorizan objetivo, zona actual y cercanía; se abrevia cuando hace falta espacio. El límite es 3 rótulos en ≤560 px, 5 en ≤800 px y 7 en el resto. Se reservan los rectángulos de HUD, misiones, mapa y controles táctiles. El objetivo conserva un rótulo aun fuera de cámara. El minimapa compacto ya no se estira; se puede ampliar a pantalla completa y elegir cualquiera de las siete zonas con controles de 44 px. La flecha de borde aparece si el objetivo sale de vista y evita áreas seguras y controles. No se añadieron objetos de Three.js ni nodos por fotograma.

## Capturas locales

| Tamaño | Antes | Después | Mapa ampliado | Objetivo fuera de vista |
| --- | --- | --- | --- | --- |
| 360×640 | [before-360x640.png](../tests/output/orientation-mobile/before-360x640.png) | [after-360x640.png](../tests/output/orientation-mobile/after-360x640.png) | [expanded-360x640.png](../tests/output/orientation-mobile/expanded-360x640.png) | [target-360x640.png](../tests/output/orientation-mobile/target-360x640.png) |
| 390×844 | [before-390x844.png](../tests/output/orientation-mobile/before-390x844.png) | [after-390x844.png](../tests/output/orientation-mobile/after-390x844.png) | [expanded-390x844.png](../tests/output/orientation-mobile/expanded-390x844.png) | [target-390x844.png](../tests/output/orientation-mobile/target-390x844.png) |
| 844×390 | [before-844x390.png](../tests/output/orientation-mobile/before-844x390.png) | [after-844x390.png](../tests/output/orientation-mobile/after-844x390.png) | [expanded-844x390.png](../tests/output/orientation-mobile/expanded-844x390.png) | [target-844x390.png](../tests/output/orientation-mobile/target-844x390.png) |

## Validación y límite

`tests/world_orientation_mobile.cjs` emula pantalla táctil en Chromium a 360×640, 390×844 y 844×390 y comprueba objetivo visible, máximo de rótulos, falta de solapes con mapa/HUD/controles, siete zonas en el mapa ampliado, selección por toque y flecha hacia el objetivo fuera de vista. La suite Node completa pasó **221/221** casos y `run_world_regression.cjs` terminó **16/16** runners aprobados. `outdoor_performance.cjs` conservó su presupuesto en los tres tiers: Baja 135 llamadas/50 824 triángulos, Media 145/64 004, Alta 145/64 392. `node --check` pasó en los módulos nuevos y `simulator3d.js`.

En lugares de alta densidad visual solo aparecen hasta tres rótulos simultáneos; las siete zonas permanecen accesibles en el mapa ampliado. Los controles compactos del minimapa son pequeños para mantener las siete posiciones, por lo que la vista ampliada es la vía táctil principal.


## Cierre de integración

La repetición final de `tests/world_orientation_mobile.cjs` terminó sin interrupciones: **3/3 viewports aprobados** (360×640, 390×844 y 844×390). Las capturas Después, Mapa ampliado y Objetivo fuera de vista se regeneraron durante esta ejecución. El primer intento falló al iniciar Chrome, antes de cargar SIDE; la repetición completa pasó sin modificar código ni pruebas.

Se conservan los resultados de la batería completa anterior a la pausa: **221/221 tests Node y 16/16 runners de navegador**. En este cierre se repitieron la prueba móvil y la medición exterior, y se verificaron `node --check` en `simulator3d.js`, `services/world_wayfinding.mjs` y `tests/world_orientation_mobile.cjs`, además de `git diff --check`.

| Tier | Draw calls | Triángulos | Diferencia respecto a la referencia anterior |
| --- | ---: | ---: | --- |
| Baja | 135 | 50 824 | 0 llamadas / 0 triángulos |
| Media | 145 | 64 004 | 0 llamadas / 0 triángulos |
| Alta | 145 | 64 392 | 0 llamadas / 0 triángulos |

El presupuesto gráfico exterior no empeoró. La medición usa **SwiftShader**, un renderizador por software: **no equivale a FPS de una GPU real** ni permite estimar con fiabilidad el rendimiento de un teléfono. Los rótulos y la orientación usan DOM reutilizado.

### Riesgos pendientes por alcance

- **A — Rótulos:** el límite de tres rótulos en móvil exige consultar el mapa ampliado para ver las siete zonas a la vez; el objetivo conserva prioridad.
- **B — Minimapa:** los iconos compactos son pequeños; tocar el fondo abre la vista ampliada con botones de 44 px. Queda revisión visual del usuario en dispositivo real.
- **C — Señalización:** las áreas seguras y la convivencia con controles se verificaron en Chromium emulado; falta confirmar notch y barras dinámicas del navegador en teléfonos físicos.
- **Integración:** no se midieron FPS en GPU real. Los cambios ajenos de pipeline NPC y salidas de otras pruebas quedan fuera del commit. No se hizo push.
