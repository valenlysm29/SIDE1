# NPC articulados de SIDE — versión 2026.09.22.2

## Cómo verlos

Ejecuta `INICIAR_JUEGO.bat` desde **SIDE1** y entra al simulador con las decisiones
enviadas. Los tres chicos recorren las veredas frente a la empresa; los clientes
alternan sus tres apariencias dentro del flujo de compra existente. Valeria recorre
un sector corto a la izquierda de la entrada. Se detiene cuando te acercas:
pulsa **E** o el control táctil para conversar. Su nombre y colisión la acompañan.

El visor `tools/npc_preview.html`, abierto desde el mismo servidor local, permite
comparar los cuatro, elegir uno, cambiar la velocidad, pausar y girar la cámara.
No necesita cuentas, servicios de modelos ni acceso a Internet.

Nombres asignados: `chico1` → **Joel**, `chico2` → **Miguel**, `chico3` →
**Gonzalo**, `mona` → **Valeria**. Se muestran sobre cada personaje y se
configuran en `simulator3d-config.js`, campo `NPCS.<id>.name`.

## Modelos y movimiento

Los cuatro GLB recibidos eran mallas estáticas, sin esqueleto ni clips. Se conserva
su diseño estilizado y sus texturas. Cada versión del juego tiene 17 articulaciones,
pesos de piel normalizados y escala en metros. Las manos en bolsillo o cintura
conservan su pose original; los brazos libres acompañan la marcha.

La animación se calcula en `services/npc_motion.js`: pasos sincronizados con la
distancia real, flexión de cadera y rodilla, compensación de tobillo, apoyo de los
pies mediante cinemática inversa, movimiento moderado del torso, reposo con
respiración y pequeños pasos durante el giro. El inicio y la parada se mezclan
gradualmente. Una sombra de contacto también funciona en calidad gráfica baja.
Los bolsos comprados se sujetan al esqueleto cuando el personaje lo permite.

El pantalón de Valeria cruza el plano central del cuerpo en su pose original. Se
clasificó cada pierna por conectividad de la malla, soldando virtualmente los
bordes UV para calcular los pesos. Esto evita que una pieza de pantalón se estire
entre los dos pies al caminar. La malla visible y las coordenadas UV se conservan.

Se trata de animación corporal procedural para caminar en el suelo plano del
escenario. Los GLB incluyen el esqueleto; la marcha se calcula en el juego, por lo
que no llevan un clip `Walk` exportado. No se añadió captura de movimiento,
animación facial, simulación física de tela ni retopología artística completa.
El estilo visual sigue siendo el de los personajes aportados, no fotorealista.

## Desplazamiento y comportamiento

`services/npc_navigation.mjs` completa las rutas existentes de Recast con caminos
alrededor de muebles y paredes. Tiene aceleración, frenado al llegar, giros de
velocidad limitada, espacio personal, desvíos ante personas detenidas y reintento
de rutas bloqueadas. No sustituye un camino imposible por una línea a través de
una pared. Los puntos de aparición se eligen libres y el cruce utiliza carriles
peatonales separados, manteniendo los semáforos y la prioridad ya existente.

Se reutilizan los estados de clientes: entrar, mirar productos, pedir asistencia,
tomar un bolso, formar cola, pagar y salir. Los peatones y Valeria no cuentan como
personal contratado ni generan ventas. No se cambiaron las fórmulas financieras. La caja ahora espera a que el cliente
llegue físicamente a su puesto antes de cobrar, también en atención automática.
El personal de ventas espera en el pasillo despejado, sin caminar en círculos.

Los modelos y texturas se comparten entre instancias. Cada NPC tiene su propio
esqueleto y fase de marcha. El reciclaje respeta la apariencia; las bolsas y los
esqueletos descartados liberan sus recursos. Reconstruir el escenario mantiene
tres peatones y una Valeria. Si falla un GLB se conserva un avatar del juego.

## Organización y tamaños

Todos los archivos del trabajo están dentro de **SIDE1**. No se modificaron los
originales que permanecen en Descargas.

| Modelo | Original, bytes | Juego, bytes | Triángulos del juego | Altura |
| --- | ---: | ---: | ---: | ---: |
| Joel | 58.869.440 | 4.058.852 | 35.000 | 1,78 m |
| Miguel | 59.775.692 | 4.163.056 | 35.000 | 1,73 m |
| Gonzalo | 61.247.504 | 4.682.424 | 35.000 | 1,76 m |
| Valeria | 74.999.312 | 4.161.772 | 35.000 | 1,68 m |

Los archivos de juego suman aproximadamente 17,1 MB frente a 254,9 MB originales.
Texturas: color de hasta 2048 px; normales y metal/rugosidad de hasta 1024 px.
Se corrigió el factor especular de 2 a 1, dentro del rango glTF. No se requiere
un decodificador de compresión adicional para abrir los modelos.

| Ruta | Función |
| --- | --- |
| `assets/models3d/npcs/` | Los cuatro GLB listos para el juego |
| `tools/model-sources/<id>/` | Original intacto, intermedio optimizado y manifiesto SHA-256 |
| `tools/model-pipeline/npc_profiles.json` | Alturas, articulaciones y restricciones de pose |
| `tools/prepare_npcs.cjs` | Simplificación y texturas; llama al generador de esqueleto |
| `tools/rig_npcs.cjs` | Esqueleto, pesos y empaquetado GLB sin datos huérfanos |
| `services/npc_motion.js` | Carga, instancias y marcha |
| `services/npc_names.js` | Nombres visibles que acompañan al personaje |
| `services/npc_navigation.mjs` | Rutas y desplazamiento |
| `services/mona_npc.js` | Adaptador de Valeria y visor del original |
| `simulator3d-config.js` | Modelos y posición inicial de Valeria |
| `tests/output/npcs/` | Capturas, recorridos y resultados de validación |

Los manifiestos son la fuente exacta de tamaños y hashes. Los modelos fueron
aportados por el usuario; no se les asigna una licencia nueva. La licencia MIT
de meshoptimizer se conserva dentro de `tools/model-pipeline/meshoptimizer/`.

## Reconstrucción y pruebas

El juego no necesita instalar las herramientas de generación. Para reconstruir
los modelos, instala las dependencias de `tools/model-pipeline/package.json` y
haz que `SHARP_PATH` apunte al módulo `sharp`, o proporciona `sharp` en `NODE_PATH`.
Desde SIDE1 ejecuta, para cada ID `chico1`, `chico2`, `chico3` y `mona`:

```text
node tools/prepare_npcs.cjs chico1
```

`node tools/prepare_mona.cjs` se conserva como acceso compatible a la misma cadena.
Los originales no se sobrescriben. Los intermedios permiten ajustar el esqueleto
sin repetir la simplificación.

Pruebas locales:

```text
node --test tests/npc_assets.test.js tests/npc_navigation.test.js
node tests/supplied_npcs.cjs
node tests/mona_npc.cjs
node tests/world_startup.cjs
python tests/local_server_test.py
```

Las pruebas de navegador requieren Playwright y Chrome. Configura `SIDE_TEST_URL`
con la dirección del servidor. Usan almacenamiento aislado y bloquean hosts
externos. Comprueban los cuatro esqueletos, hashes, pesos, pantalones, marcha a
30/60/120 actualizaciones por segundo, parada, apoyo del pie, obstáculos, cruce,
entrada, productos, caja, reconstrucciones, vista móvil y modelos ausentes.
La instrumentación que acelera los recorridos se inyecta solo en la respuesta
HTTP de prueba; no hay comandos de mutación de pruebas publicados en el juego.

En el ensayo de marcha recta, la deriva del apoyo quedó por debajo de 1 mm por
actualización y la penetración del suelo por debajo de 3 mm, que son las
tolerancias verificadas. Esto no equivale a medir rendimiento en todos los
dispositivos; las capturas y pruebas se realizaron en Chrome con WebGL software.

Las diez pruebas de modelos y navegación pasan. También pasan los recorridos
de navegador con modelos y respaldo, la interacción de Valeria, el arranque
por ambos métodos de envío y las dos pruebas del servidor.

La suite general pasa 72 de 78 pruebas y conserva seis fallos previos de `cycle_productivity.test.js`,
por funciones financieras ausentes. Se documentaron antes de esta integración
en `tests/output/baseline-existing-failures.txt` y no pertenecen a los NPC.
