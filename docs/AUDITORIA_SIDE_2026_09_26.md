# SIDE: auditoría e implementación progresiva — 26/09/2026

## Fase 1: arquitectura encontrada antes de modificar

Se revisaron entradas HTML, scripts activos, servicios, modelos, migraciones SQL,
pruebas, recursos del mundo y documentación. No se reescribe el proyecto.

| Área | Implementación activa y contrato |
|---|---|
| Motor | Three.js local en `vendor/three`, WebGL, JavaScript sin framework ni compilador |
| Escena | `simulator3d.js`: `buildStaticWorld`, grupos de interiores, hub exterior en X=150, cámara y bucle RAF |
| Mundo | `services/hub_world.js`: geometría propia, materiales canvas, instancias, calles, accesos y colliders |
| Personajes | `npc_motion.js`, rigs locales, IK por distancia; Recast y `npc_navigation.mjs` con respaldo local |
| Vehículos | `hub_vehicles.js` y `vehicle_motion.mjs`: auto jugable, cuatro vehículos ambientales, conducción arcade |
| Frontend | `index.html`/`app.js` alumno; `docente.html`/`docente.js` profesor; CSS responsive |
| Decisiones | catálogo, state/drafts/receipts en `app.js`, validación `decision_review_model.js` |
| Finanzas | `cashLedger` + capital inicial son fuente de caja; `financial_model.js` deriva estados; puente `SIDE_GAME_BRIDGE` |
| Producción | `production_model.js` calcula capacidad, materiales y plan; `production_dop.js` presenta procesos |
| Ciclos | `side_rules.js`, reloj del servidor, estados integration/decisions/results/finished y polling alumno |
| Backend | Supabase/PostgreSQL RPC y RLS; `services/*_service.js`; SQL base y migraciones en `docs` |
| Servidor local | `servidor_local.py` entrega archivos; no ejecuta el motor económico |
| Persistencia | localStorage por empresa/ciclo; remoto para decisiones, eventos y reportes, sin snapshot completo del mundo |
| Audio | Web Audio procedural existente; no necesita sonidos de terceros |
| Histórico | `enterprise_*` y `buildLegacyWorld` no son la ruta activa; se conservan |

### Perfiles de la auditoría

Se delegaron gameplay/diseño y arte; movimiento/animación y vehículos;
finanzas/economía/ciclos. El agente principal cubre performance/arquitectura,
integración y regresiones. Los informes especializados se guardan junto a éste.

### Línea base ejecutada antes de las mejoras

- `playable_hub.cjs`: pasa WebGL, geometría, movimiento, colisiones, tienda,
  tráfico, peatones, directorio, reconstrucción y móvil. En Chromium software:
  159 draw calls, 163.378 triángulos, 659 meshes en escena, 23 skinned meshes.
  Esto es una medición de complejidad, no una garantía de FPS en hardware real.
- Unitarias: 89 pruebas, 76 pasan, 13 fallan previamente. Siete errores son un
  fixture VM sin URLSearchParams/location. Seis pertenecen a una API de
  productividad/tienda única que no existe en el código actual.
- PostgreSQL local: lifecycle y observations fallan al iniciar manualmente;
  `controlar_partida` no implementa la acción `iniciar` enviada por la UI.

### Hallazgos y riesgos

1. Pedido pagado pierde su temporizador tras recarga; persistir cargo y pedido
   juntos, entregar una sola vez con marcador de recepción.
2. Cierre manual puede mantener misma ronda; comparar sólo la clave de ciclo no
   detiene el mundo. Validar permiso operativo también al ejecutar transacciones.
3. Entrada/salida del vehículo instantánea, colisiones entre coches incompletas
   y cámara que sólo valida destino antes de interpolar.
4. Objetivos exteriores sólo cuentan visitas; necesitan responder al estado
   empresarial sin recalcular demanda, caja o rentabilidad.
5. RAF sigue renderizando pantallas ocultas. `animateActors` también contiene
   automatismos comerciales que no deben ejecutarse en pausa.
6. Snapshot local y reportes remotos no equivalen a un mundo multijugador.
   La autorización anónima heredada de reportes requiere una revisión específica
   del contrato de identidad antes de cambiarla.

### Plan y límites de compatibilidad

Fases 2–3: locomoción/cámara y estados de vehículo mediante helpers comprobables.
Fase 4: señalización y materiales conservando posiciones de edificios y rutas.
Fases 5–6: operaciones existentes, objetivos derivados y HUD compacto responsive.
Fase 7: conservar clientes/peatones/tráfico, mejorar estados y coste visual.
Fase 8: suprimir trabajo GPU oculto, audio reutilizable y diagnóstico de recursos.
Fase 9: unitarias, PostgreSQL local, navegadores WebGL y regresión alumno/profesor.

Las compras y mejoras conservan importes y clasificación existentes. No se
introducen fórmulas, contabilidades paralelas ni acceso libre durante fases
bloqueadas. Los cambios SQL se verifican localmente; desplegarlos en Supabase
es una operación distinta y no se presume realizada.

## Cierre de implementación y regresión

Se conservaron el mundo, los rigs, las decisiones, los importes y los contratos
académicos existentes. La escena utiliza dos helpers pequeños comprobables:
`player_motion.mjs` para locomoción, transición de vehículo y cámara, y
`gameplay_objectives.mjs` para objetivos derivados del negocio. No se añadió una
segunda contabilidad ni una jerarquía nueva de managers.

### Soluciones aplicadas

- Movimiento con aceleración, frenado progresivo, estados Idle/Walk/Run,
  dirección relativa a cámara y pasos cortos para colisiones. Se conservaron los
  rigs articulados, blending y apoyo de pies existentes.
- Cámara con zoom limitado, recentrado, distancia/FOV al correr o conducir y
  corrección de paredes antes y después del suavizado. Entrada/salida del auto
  con aproximación a puerta accesible y control exclusivo por estado.
- Colisiones de vehículos respetan orientación y extremos del chasis; tráfico
  evita coches y peatones. Audio de motor procedural reutiliza una sola voz.
- Señalización SIDE distingue comercio, logística, operaciones y administración;
  materiales emisivos más discretos sin nuevas luces con sombras.
- HUD muestra ciclo, objetivos, pedido pendiente, dinero, inventario, tiempo y
  satisfacción; navegación conduce a las interacciones reales del negocio.
- Compra y venta guardan el libro de caja con sus cambios de negocio mediante
  el escritor local existente. Un fallo de guardado no cobra ni retira al cliente
  de la cola. La recepción usa identificador persistente para evitar duplicados.
- La producción cero conserva inventario cero. Producción registrada y compras
  de proveedor se distinguen para calcular productividad sin contar dos veces.
- Pausa, pantalla oculta y pestaña inactiva detienen render, física, NPCs y ventas.
  El RAF oculto sólo conserva una comprobación de reanudación; los relojes
  académicos del backend siguen independientes. Los rigs lejanos reducen su
  frecuencia de actualización visual y conservan su lógica comercial.
- RPC `iniciar` restaura el inicio manual idempotente. El botón docente permite
  iniciar una partida manual ya preparada; la espera automática conserva su
  plazo. Se corrigió también una referencia `active` ausente al finalizar.
- Las pruebas de UI se ajustaron a controles actuales y fixtures explícitos de
  modo local. Se conserva cobertura separada con PostgreSQL y dos estudiantes.
- La revisión empresarial normaliza objetivos de producción vacíos y cero:
  una sección intacta permanece pendiente, una edición aparece como borrador y
  volver a cero elimina el falso cambio. Cuenta con prueba unitaria y de UI.

### Archivos de implementación

Modificados: `simulator3d.js`, `app.js`, `docente.js`, `company_summary.js`,
`production_model.js`, `index.html`, `hub-world.css`, `services/hub_vehicles.js`,
`services/hub_world.js`, `services/vehicle_motion.mjs`,
`docs/supabase_game_lifecycle.sql` y `.gitignore`.

Creados: `services/player_motion.mjs`, `services/gameplay_objectives.mjs`,
`tests/player_motion.test.mjs`, `tests/gameplay_objectives.test.mjs`,
`tests/world_runtime.test.js`, `tests/world_finance.test.cjs`,
`tests/world_business_ui.cjs`, `tests/gameplay_hud.cjs` y
`tests/requirements.txt`. Se actualizaron los fixtures, scripts y pruebas
existentes de ciclos, decisiones, docente, startup, vehículo y revisión empresarial.

### Validación final

- Suite general de `tests/package.json`: 113 pruebas unitarias aprobadas.
  Incluye las 109 anteriores y cobertura adicional de pausa financiera,
  recuperación de cobro fallido, audio reutilizable y sección sin falso borrador.
- PostgreSQL local: `game_lifecycle_db.cjs` y `game_observations_db.cjs` aprobados
  con migración repetida, roles, permisos, eventos, manual/automático y cancelación.
- Chromium: `game_lifecycle_ui.cjs` y `teacher_lifecycle_ui.cjs` aprobados:
  preparación/inicio, dos alumnos, avance, espera automática sin profesor,
  recarga, reloj desfasado, cancelación y disposición móvil.
- WebGL: `playable_hub.cjs`, `gameplay_hud.cjs`, `world_business_ui.cjs`,
  `world_startup.cjs`, `npc_locomotion.cjs` y `world_cycle_restart.cjs` aprobados.
  Compra real desde almacén: un descuento de S/360; recarga mantiene pedido;
  entrega añade exactamente 12 unidades una vez. Los cambios de ciclo no
  vuelven a cobrar las decisiones y los reinicios conservan el contrato existente.
- Python: `local_server_test.py` aprobado (2 pruebas); UI aislada comprueba
  ventas (13), borradores (4), docente (16), layout (10), UI final (50) y
  revisión empresarial (61). `decisions_cycle_ui.cjs` comprueba controles
  vigentes, DOP, productividad real y cambio de ciclo.
- Sintaxis: `node --check` aprobado para los 26 JavaScript modificados/creados;
  `git diff --check` sin errores. El proyecto es estático y no requiere build.

### Límites técnicos conservados

- El SQL actualizado está validado en PostgreSQL local; aplicarlo al Supabase
  remoto requiere acceso administrativo a esa base. El push Git no despliega SQL.
- Las pruebas de roles y login usan fixtures/RPC locales; no se utilizaron
  credenciales de cuentas reales ni se alteraron partidas de producción.
- Stock/pedidos mantienen el ámbito empresa/ciclo y almacenamiento local
  original; no existe snapshot multijugador completo entre dispositivos.
- Los assets actuales no incluyen una animación de sentarse/abrir puertas: se
  utiliza una aproximación y salida suave por un espacio válido.
- Chromium WebGL verifica comportamiento y carga; el rendimiento medido en
  ese entorno no garantiza FPS concretos en todos los dispositivos.

La fase de implementación se cierra con regresión y publicación de Git. No se
dejan cambios de fórmulas ni nuevas funcionalidades dentro de este cierre.
