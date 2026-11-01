# P0.5 — Contrato observado de capacidad y eficiencia

Referencia: rama `codex/p02-diagnostico-materiales`, commit `df3e42a91fdcdbead50772d2d11ba08dc67b94da`; informes P02, P03 y P04. Este documento describe el código observado, no autoriza modificaciones ni declara aprobadas reglas nuevas.

## Implementado en SIDE

- **Equipos y personal:** cada pareja usa como máximo un trabajador y una mesa o máquina de la misma etapa. Se respetan primero asignaciones históricas válidas sujetas a recursos disponibles; el resto se empareja internamente por productividad. Un trabajador ocioso no aporta capacidad, pero sí conserva costo laboral y, si es nivel 3, cuenta para la eficiencia global.
- **Capacidad diaria:** suma de `trabajadores emparejados × tasa × multiplicador`. Tasas nivel 1/2/3: 6/8/12 por día en corte, ensamblado y acabado. Corte usa mesa ×1; ensamblado y acabado usan básica ×1, semiindustrial ×1,2 e industrial ×1,5. Los factores de eventos admitidos pueden reducir capacidad de ensamblado.
- **Eficiencia:** `round((0,90 + 0,01 × número total de trabajadores nivel 3 + 0,04 si hay jefatura) × 100) / 100`. Cuenta contratados de las tres etapas, incluidos los que no logran pareja. No hay tope explícito de 100 % en esa fórmula.
- **Ciclo y cuello:** por defecto 30 días; cada etapa calcula `round(capacidad diaria × días × eficiencia × factor de etapa)` y el cuello es el mínimo de las capacidades enteras. La producción instantánea usa enteros por prioridad básico → mejorado → premium y respeta meta, capacidad restante, disponibilidad del molde y materiales; el modo temporal aplica capacidad diaria y recepciones por fecha, sin acumular capacidad diaria perdida. El diagnóstico P02 no altera esa producción.
- **Redondeo:** JavaScript `Math.round` para capacidad y eficiencia; asignación física por pisos, con precisión controlada; el modo temporal distribuye la capacidad acumulada por día y redondea movimientos físicos a 9 decimales. Su acumulación diaria puede diferir del cálculo agregado y requiere comparación específica.

Fuentes: `js/production_model.js`, `js/temporal_production.js`, `js/cycle_model.js` y la copia incluida en `supabase/functions/side-business-close/runtime.mjs`. La etiqueta `one-worker-per-resource-20261029` se escribe en el recibo; identificar la etiqueta no demuestra que exista un despachador capaz de reproducir cualquier versión antigua.

## Excel y ejemplo 91 % frente a 92 %

| Cálculo | Trabajadores de nivel 3 contados en el ejemplo | Eficiencia y capacidad de cuello |
|---|---|---|
| Original: `K7+(F7+F13+F19)/100+4%*F21` | Cuenta corte F7 y solo las columnas de equipo básico F13 y F19. Cuenta el especialista de acabado en máquina básica; excluye el especialista de ensamblado en semiindustrial G13 y también excluiría nivel 3 en industrial H13/H19 o semiindustrial G19. | 90 % + 1 % = **91 %**; `round(8 × 30 × 0,91)` = **218**. |
| Copia corregida: `K7+SUM(F7,F13:H13,F19:H19)/100+4%*F21` | Incluye al especialista de ensamblado en G13 y al de acabado en F19; no hay maestro de corte. | **92 %**, **221**. |
| SIDE | Cuenta ambos especialistas contratados en las tres etapas, con o sin equipo. | **92 %**, **221**. |

No hay jefatura en el ejemplo. Para el mismo corte efectivo de un experimentado y una mesa las tasas son 8/31,4/24; el corte limita. El Excel original suma trabajadores en corte sin limitar mesas; la copia corregida además modifica eficiencia y producción. P04 comparó 19 salidas físicas en seis escenarios adaptados con la copia corregida, no demostró equivalencia general con el original. Las seis pruebas históricas sin adaptar siguen fallando primero en 386/221.

## Tratamiento histórico y decisiones pendientes

**Implementado:** un cierre ya existente se reutiliza; los snapshots financieros disponibles se conservan en los cálculos. El recibo nuevo registra versión de capacidad. Existen rutas de compatibilidad para metas numéricas antiguas y activos históricos. No se ha demostrado que la etiqueta permita reconstruir con exactitud reglas productivas anteriores, ni que todos los cierres antiguos contengan un snapshot completo.

**Recomendación para decisión, no aplicada:** mantener 1:1 y contar todos los nivel 3 de forma uniforme entre etapas y tipos de equipo; resolver explícitamente si los nivel 3 sin pareja deben aportar bonificación, si existe tope de eficiencia, si jefatura se aplica con cero personal y cómo se trata el calendario temporal. Contar solo trabajadores efectivamente asignados sería una alternativa industrial razonable, pero cambiaría resultados frente al comportamiento vigente. Definir esas decisiones con producto y aprobar cualquier cambio.

Para partidas nuevas, recomendar identificar de forma explícita versión, calendario y política de eficiencia al crear la partida. Para partidas y cierres históricos, recomendar lectura de snapshots y reproducción con versión verificable; si faltan datos, mostrar límite de trazabilidad y evitar recalcular o reescribir. La aplicación de un nuevo contrato, migración o recálculo requiere autorización y pruebas de compatibilidad. No se han creado versiones, migraciones ni controles.

**Pruebas pendientes:** personal nivel 3 sin máquina, cero recursos, muchas personas y eficiencia superior a 100 %, asignaciones parciales y no válidas, jefatura, eventos, límites de redondeo y continuidad temporal; comparación por versión de cierres con y sin snapshot y paridad Node/Edge.
