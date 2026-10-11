# Diagnóstico NPC — continuación 4 (2026-10-11)

**Resultado no atribuido; publicación bloqueada por el criterio del usuario.** Las 8 corridas sin semilla dieron baseline **8/8 PASS** y HEAD **7/8 PASS, 1/8 FAIL**. El fallo exclusivo de HEAD exige investigar una regresión antes de publicar; la medición no permite declararlo preexistente ni usar el caso «0 fallos en ambos».

## Condiciones y fidelidad

Baseline exacto `9fbe6ec012db7e1440459551f62b40992df261d6` y HEAD congelado `c73d8010020b9c037ea03e7c14210b7fa43706ff`. Copias HTTP aisladas verificadas mediante Git blob OID: 699 archivos de baseline y 711 de HEAD. No se sirven los modelos/NPC sin commit del checkout. No se encontraron procesos huérfanos del arnés reconocidos antes de empezar. Un Chrome de prueba cada vez; ejecuciones alternadas baseline/HEAD, sin otras pruebas simultáneas; headless y flags `--enable-webgl --use-angle=swiftshader --enable-unsafe-swiftshader`.

El runner conserva el bloque fallback de `tests/supplied_npcs.cjs`, incluidas todas sus aserciones y tiempos (`step(100)`, espera de preparación, `step(35)`). Solo omite la vista previa y el escenario no-fallback, redirige archivos y añade diagnóstico. El watchdog externo es 480 s; ninguna corrida lo alcanzó. No se modificó NPC, mundo 3D ni assertions de producción.

## Ocho corridas por versión, sin semilla

| Corrida | Resultado | Duración (s) | Mensaje |
|---|---|---:|---|
| baseline-1 | PASS | 51.861 | PASS NPC world fallback |
| head-1 | PASS | 54.769 | PASS NPC world fallback |
| baseline-2 | PASS | 47.315 | PASS NPC world fallback |
| head-2 | PASS | 53.123 | PASS NPC world fallback |
| baseline-3 | PASS | 36.774 | PASS NPC world fallback |
| head-3 | PASS | 38.561 | PASS NPC world fallback |
| baseline-4 | PASS | 38.940 | PASS NPC world fallback |
| head-4 | PASS | 40.147 | PASS NPC world fallback |
| baseline-5 | PASS | 36.308 | PASS NPC world fallback |
| head-5 | PASS | 56.377 | PASS NPC world fallback |
| baseline-6 | PASS | 42.484 | PASS NPC world fallback |
| head-6 | PASS | 33.465 | PASS NPC world fallback |
| baseline-7 | PASS | 33.764 | PASS NPC world fallback |
| head-7 | PASS | 35.227 | PASS NPC world fallback |
| baseline-8 | PASS | 33.376 | PASS NPC world fallback |
| head-8 | FAIL | 32.194 | AssertionError: customers complete a decision |

Medianas: baseline **37.857 s**, HEAD **39.354 s**. Resumen completo compacto: `reports/sim/npc-legacy-cont4/summary_compacto.json`. Los logs y detalles grandes permanecen locales.

## Fallo observado

HEAD8 terminó con `AssertionError: customers complete a decision`. El cliente `city:city_woman_tank` seguía en `BROWSE`, posición `(127.28641811525435, 22.608433837408512)`, índice de ruta 1, ruta `[[130.75,22.71],[128.5,22.7],[132.5,22.7]]`; `blocked=0`, `routeBlocked=false`. Había visitado `ENTER_STORE` y `BROWSE`, pero no `QUEUE` ni `LEAVE_STORE` durante los 100 s simulados.

## Diagnóstico adicional, separado de las 8+8

- Semilla LCG 1 aplicada **después** de `manual()`: baseline PASS; HEAD FAIL en `COMPARE`, mismo assert. **Inconclusiva**: actores y otras elecciones anteriores a `manual()` seguían aleatorios. No es una comparación plenamente determinista.
- `Math.random=()=>0.5`, aplicado por `addInitScript` **antes** de `goto`: baseline PASS, HEAD PASS.
- `Math.random=()=>0.9`, también antes de `goto`: baseline PASS, HEAD PASS. Se eligió como comprobación de ruta/velocidad, pues el orden de exploración usa `sort(()=>Math.random()-.5)` y la velocidad usa `(0.95+random*0.35)*archetype.speed`.

Estos diagnósticos mantienen todas las assertions y tiempos. No reemplazan las 8+8 ni demuestran que HEAD8 sea ajeno a la integración. Resúmenes separados en `reports/sim/npc-seed-cont4/`, `npc-constant-cont4/` y `npc-constant090-cont4/`.

## Lectura del código y alcance

`js/simulator3d.js:2890` baraja dos puntos de exploración con `Math.random`, `:2600` varía velocidad y `:2894` varía la espera de comparación; el test exige terminar una decisión tras `step(100)`. Esa combinación explica por qué puede variar el recorrido, pero **no prueba la atribución** del fallo exclusivo de HEAD.

Los hashes SHA256 del test original, `js/simulator3d.js`, `services/npc_navigation.mjs`, `services/npc_optional_navigation.mjs`, `services/interior_navigation.mjs` y `services/business_interiors.mjs` son idénticos entre baseline y HEAD (constan en el resumen). El diff de publicación no cambia estos archivos ni modelos. La página sí carga el adaptador Excel y módulos del menú modificados por la integración; por eso no se cumple una afirmación absoluta de «ningún módulo cargado cambió». La auditoría de la ruta activa se documenta por separado en `reports/revision_continuacion_4.md`.

## Decisión de publicación

**Caso 3 pendiente: no push.** No se encontró una corrección causal en código Excel ni se reprodujo el mismo fallo en baseline bajo la medición pedida. Se preservan el arnés, la evidencia y el estado para una investigación dirigida; no se tocaron NPC/3D ni se debilitó la prueba.
