# Correcciones SIDE — 20/10/2026

## Punto de control

Solicitud: texto pegado «MEGA PROMPT». Los dos DOCX se usan como evidencia, no como instrucciones adicionales. Originales sin modificar. Todo el trabajo y los worktrees permanecen dentro de SIDE1. Remoto verificado: `https://github.com/valenlysm29/SIDE1.git`.

Base original: `66dc38a`. Había cambios previos sin commit de conexión Supabase; se conservaron completos en `d1c83f3`, antes de las correcciones. No se ejecuta SQL en producción. No se modifican 3D/NPC/avatares.

La batería base se registra en `tests/output/correcciones-2026-10-20/baseline-node.log`. Matriz inicial por inspección del código; reproducción y evidencia final pendientes. No confundir «ya corregido en código» con despliegue confirmado.

## Responsabilidad

- A / explore_engine: motor, configuración, catálogo y editor por lotes, excluido caja.js.
- B / explore_teacher: panel docente, podio y PDF.
- C / explore_student: interfaz estudiante, resumen y HTML de acceso.
- D / raíz: módulo de acceso, seguridad SQL, cierre remoto y ledger.
- F: verificador independiente al integrar; sin autoría de producto.

## Matriz inicial de errores

| ID | Severidad | Clasificación inicial | Responsable / archivo | Estado / siguiente paso |
|---|---|---|---|---|
| 1 | A | vigente o parcial por inspección | B / docente.html, js/docente.js | pendiente: reproducir y verificar con pruebas |
| 2 | M | vigente o parcial por inspección | B / docente.html, js/docente.js | pendiente: reproducir y verificar con pruebas |
| 3 | M | vigente o parcial por inspección | B / docente.html, js/docente.js | pendiente: reproducir y verificar con pruebas |
| 4 | M | vigente o parcial por inspección | B / docente.html, js/docente.js | pendiente: reproducir y verificar con pruebas |
| 5 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | pendiente: reproducir y verificar con pruebas |
| 6 | M | vigente o parcial por inspección | B / docente.html, js/docente.js | pendiente: reproducir y verificar con pruebas |
| 7 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | pendiente: reproducir y verificar con pruebas |
| 8 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | pendiente: reproducir y verificar con pruebas |
| 9 | M | vigente o parcial por inspección | B / docente.html, js/docente.js | pendiente: reproducir y verificar con pruebas |
| 10 | A | vigente o parcial por inspección | B / docente.html, js/docente.js | pendiente: reproducir y verificar con pruebas |
| 11 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | pendiente: reproducir y verificar con pruebas |
| 12 | M | vigente o parcial por inspección | B / docente.html, js/docente.js | pendiente: reproducir y verificar con pruebas |
| 13 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | pendiente: reproducir y verificar con pruebas |
| 14 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | pendiente: reproducir y verificar con pruebas |
| 15 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | pendiente: reproducir y verificar con pruebas |
| 16 | M | vigente o parcial por inspección | B / docente.html, js/docente.js | pendiente: reproducir y verificar con pruebas |
| 17 | A | por reproducir | D / caja.js, partida_service.js, SQL; C/B render | pendiente: reproducir y verificar con pruebas |
| 18 | M | ya corregido en repo; despliegue pendiente de comprobar | B / docente.html, js/docente.js | pendiente: reproducir y verificar con pruebas |
| 19 | M | vigente o parcial por inspección | B / docente.html, js/docente.js | pendiente: reproducir y verificar con pruebas |
| 20 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | pendiente: reproducir y verificar con pruebas |
| 21 | A | por reproducir | D / caja.js, partida_service.js, SQL; C/B render | pendiente: reproducir y verificar con pruebas |
| 22 | A | por reproducir | D / caja.js, partida_service.js, SQL; C/B render | pendiente: reproducir y verificar con pruebas |
| 23 | A | por reproducir | D / caja.js, partida_service.js, SQL; C/B render | pendiente: reproducir y verificar con pruebas |
| 24 | M | por reproducir | D / caja.js, partida_service.js, SQL; C/B render | pendiente: reproducir y verificar con pruebas |
| 25 | M | vigente o parcial por inspección | B / docente.html, js/docente.js | pendiente: reproducir y verificar con pruebas |
| 26 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | pendiente: reproducir y verificar con pruebas |
| 27 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | pendiente: reproducir y verificar con pruebas |
| 28 | M | vigente o parcial por inspección | B / docente.html, js/docente.js | pendiente: reproducir y verificar con pruebas |
| 29 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | pendiente: reproducir y verificar con pruebas |
| 30 | B | vigente o parcial por inspección | B / docente.html, js/docente.js | pendiente: reproducir y verificar con pruebas |
| 31 | A | vigente o parcial por inspección | D / caja.js, partida_service.js, SQL; C/B render | pendiente: reproducir y verificar con pruebas |
| 32 | A | vigente o parcial por inspección | D / caja.js, partida_service.js, SQL; C/B render | pendiente: reproducir y verificar con pruebas |
| 33 | A | ya corregido en repo; despliegue pendiente de comprobar | C / index.html, js/app.js | pendiente: reproducir y verificar con pruebas |
| 34 | M | vigente o parcial por inspección | C / index.html, js/app.js | pendiente: reproducir y verificar con pruebas |
| 35 | M | vigente o parcial por inspección | D / caja.js, partida_service.js, SQL; C/B render | pendiente: reproducir y verificar con pruebas |
| 36 | M | ya corregido en repo; despliegue pendiente de comprobar | C / index.html, js/app.js | pendiente: reproducir y verificar con pruebas |
| 37 | M | vigente o parcial por inspección | C / index.html, js/app.js | pendiente: reproducir y verificar con pruebas |
| 38 | M | vigente o parcial por inspección | C / index.html, js/app.js | pendiente: reproducir y verificar con pruebas |
| 39 | M | por reproducir | C / index.html, js/app.js | pendiente: reproducir y verificar con pruebas |
| 40 | B | vigente o parcial por inspección | C / index.html, js/app.js | pendiente: reproducir y verificar con pruebas |
| 41 | B | vigente o parcial por inspección | C / index.html, js/app.js | pendiente: reproducir y verificar con pruebas |
| 42 | B | vigente o parcial por inspección | C / index.html, js/app.js | pendiente: reproducir y verificar con pruebas |
| 43 | B | vigente o parcial por inspección | C / index.html, js/app.js | pendiente: reproducir y verificar con pruebas |
| 44 | M | vigente o parcial por inspección | C / index.html, js/app.js | pendiente: reproducir y verificar con pruebas |
| 45 | B | vigente o parcial por inspección | C / index.html, js/app.js | pendiente: reproducir y verificar con pruebas |
| 46 | B | vigente o parcial por inspección | C / index.html, js/app.js | pendiente: reproducir y verificar con pruebas |
| 47 | B | vigente o parcial por inspección | C / index.html, js/app.js | pendiente: reproducir y verificar con pruebas |
| 48 | B | vigente o parcial por inspección | C / index.html, js/app.js | pendiente: reproducir y verificar con pruebas |
| 49 | B | vigente o parcial por inspección | C / index.html, js/app.js | pendiente: reproducir y verificar con pruebas |
| 50 | B | vigente o parcial por inspección | C / index.html, js/app.js | pendiente: reproducir y verificar con pruebas |
| 51 | A | vigente o parcial por inspección | D / teacher_auth.js, SQL; C HTML | pendiente: reproducir y verificar con pruebas |
| 52 | M | vigente o parcial por inspección | D / teacher_auth.js, SQL; C HTML | pendiente: reproducir y verificar con pruebas |
| 53 | M | vigente o parcial por inspección | D / teacher_auth.js, SQL; C HTML | pendiente: reproducir y verificar con pruebas |
| 54 | B | vigente o parcial por inspección | C / index.html, js/app.js | pendiente: reproducir y verificar con pruebas |
| 55 | B | vigente o parcial por inspección | C / index.html, js/app.js | pendiente: reproducir y verificar con pruebas |
| 56 | B | vigente o parcial por inspección | C / index.html, js/app.js | pendiente: reproducir y verificar con pruebas |
| 57 | B | vigente o parcial por inspección | C / index.html, js/app.js | pendiente: reproducir y verificar con pruebas |

## Catálogo (21 filas)

| Fila | Clasificación inicial | Responsable | Estado / siguiente paso |
|---|---|---|---|
| 1 | coincidente por inspección | A; B etiqueta demanda, C textos | pendiente: regresión y evidencia |
| 2 | coincidente por inspección | A; B etiqueta demanda, C textos | pendiente: regresión y evidencia |
| 3 | coincidente por inspección | A; B etiqueta demanda, C textos | pendiente: regresión y evidencia |
| 4 | coincidente por inspección | A; B etiqueta demanda, C textos | pendiente: regresión y evidencia |
| 5 | coincidente por inspección | A; B etiqueta demanda, C textos | pendiente: regresión y evidencia |
| 6 | coincidente por inspección | A; B etiqueta demanda, C textos | pendiente: regresión y evidencia |
| 7 | coincidente por inspección | A; B etiqueta demanda, C textos | pendiente: regresión y evidencia |
| 8 | vigente/parcial | A; B etiqueta demanda, C textos | pendiente: regresión y evidencia |
| 9 | vigente/parcial | A; B etiqueta demanda, C textos | pendiente: regresión y evidencia |
| 10 | vigente/parcial | A; B etiqueta demanda, C textos | pendiente: regresión y evidencia |
| 11 | vigente/parcial | A; B etiqueta demanda, C textos | pendiente: regresión y evidencia |
| 12 | vigente/parcial | A; B etiqueta demanda, C textos | pendiente: regresión y evidencia |
| 13 | vigente/parcial | A; B etiqueta demanda, C textos | pendiente: regresión y evidencia |
| 14 | vigente/parcial | A; B etiqueta demanda, C textos | pendiente: regresión y evidencia |
| 15 | vigente/parcial | A; B etiqueta demanda, C textos | pendiente: regresión y evidencia |
| 16 | vigente/parcial | A; B etiqueta demanda, C textos | pendiente: regresión y evidencia |
| 17 | vigente/parcial | A; B etiqueta demanda, C textos | pendiente: regresión y evidencia |
| 18 | extensión autorizada | A; B etiqueta demanda, C textos | pendiente: regresión y evidencia |
| 19 | fuera de alcance autorizado | A; B etiqueta demanda, C textos | pendiente: regresión y evidencia |
| 20 | fuera de alcance autorizado | A; B etiqueta demanda, C textos | pendiente: regresión y evidencia |
| 21 | extensión autorizada | A; B etiqueta demanda, C textos | pendiente: regresión y evidencia |

## Decisiones para que Joe confirme

- Corte: usar hoja Costos De Producción (1500/2000/3800 base), respaldada por oráculo; catálogo contradice 1500/2500/4000.
- Horas extra 25 %, almacén S/ 2/unidad y penalización +3 puntos TEA son supuestos configurables existentes, no cifras definidas por Excel.
- Mesa de corte única obligatoria para partidas nuevas, según catálogo Excel.
- Nombre del producto: conservar el de las páginas, Simulador de Decisiones Financieras.
- PIN opcional de cuatro dígitos: alternativa documentada, no implementada.
- Demanda distrital: advertir que no afecta cálculo segmentado hasta definir reparto compatible.

## Compatibilidad esencial

El oráculo histórico SIM3 elimina la quinta empresa sin envío. El nuevo comportamiento de cobro universal se versiona como `side-lotes-2026-10-20`; `excel-16` conserva paridad y partidas iniciadas. No cambiar resultados históricos para simular que ambas reglas son idénticas.

## SQL y despliegue

Pendiente de implementar y validar localmente. No ejecutar aún. Push condicionado a toda la verificación en verde.
