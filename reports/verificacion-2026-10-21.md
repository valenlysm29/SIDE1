# Verificación local de SIDE1 — 21 de octubre de 2026

Actualización posterior: la tarea de observaciones amplió y volvió a verificar
estos cambios. El runner histórico del estudiante quedó corregido y aprobado
(prevención de negativos y título interno oculto intencionalmente por CSS).
El resultado vigente está en [observaciones del jugador](observaciones-jugador-2026-10-21.md)
y [revisión final](revision-final-observaciones-2026-10-21.md). Este documento
conserva el registro de la auditoría anterior; sus pendientes se leen con esa fecha.

Raíz revisada: `C:/Users/Asus/OneDrive/Documentos/side_side_va/SIDE1`.
Remoto verificado: `https://github.com/valenlysm29/SIDE1.git`.

## Ubicación

El directorio contenedor `side_side_va` contiene únicamente `SIDE1`.
Los resultados, capturas y temporales de esta revisión están en
`tests/output/` y `.codex-work/audit-20261021/`, dentro de SIDE1.
No fue necesario mover archivos ni modificar otros repositorios.

## Resultados

- Suite completa: 471 pruebas aprobadas, sin fallos ni omisiones.
- Comando de `tests/package.json` corregido: nuevamente 471 aprobadas y
  validación de opciones de decisiones aprobada.
- Servidor local: 2 pruebas aprobadas; entrega de recursos y rechazo de puerto ocupado.
- Sintaxis de 79 archivos JavaScript de `js/` y `services/`: sin errores.
- 11 suites SQL aprobadas sobre PostgreSQL local PGlite: opciones de decisiones,
  ciclo de partidas, espera, admisión y matriz de admisión, historial docente,
  observaciones, correcciones de acceso, expulsión, podio programado y motor Excel.
- Chrome: expulsión y reactivación, cierre de sesión y bloqueo del estudiante expulsado,
  aviso móvil y ausencia de errores JavaScript: aprobado.
- Chrome: panel docente, 31 comprobaciones aprobadas, incluyendo vistas móviles.
- Chrome: carga real del mundo 3D y recorrido guiado aprobados; sin movimientos
  duplicados de caja ni errores JavaScript. Editor revisado en cinco tamaños de pantalla.
- `git diff --check`: aprobado.

## Correcciones de la verificación

Los comandos del README, `tests/package.json` y `tests/run_integral.cjs`
omitían 26 archivos `.test.cjs`; ahora incluyen los tres formatos de prueba.
La prueba docente esperaba el amarillo del diseño anterior; se actualizó al
celeste que ya exige `faculty_theme_ui.py`.

## Comprobación adicional pendiente

El script histórico `tests/student_corrections_20261020_ui.py` no terminó aprobado:
su primera aserción fallida exige cero al intentar insertar un negativo, mientras
el control también bloquea la inserción mediante `beforeinput`. Al ampliar esa
comprobación durante el diagnóstico, pasó el tramo de caja, temporizadores,
resumen y cinco tamaños de pantalla, pero luego no apareció `#excelEditorTitle`
al cambiar de motor dentro de la sesión preparada por el script. Los cambios
experimentales a esa prueba se revirtieron. Queda pendiente aislar la causa de
esa incompatibilidad; no se puede afirmar que todos los scripts históricos pasen.
La carga del editor actual y del mundo 3D sí pasó mediante el verificador
independiente `verification_visual_runtime_20261020.cjs`.

Las pruebas Python de navegador usan Python 3.12 y las dependencias ya existentes
en `tests/.python-deps/`. El Python 3.13 predeterminado no puede cargar el
binario `greenlet` compilado para 3.12. No fue necesario instalar dependencias.

## Alcance

Esta revisión valida el código entregado y bases de datos locales de prueba.
No verifica credenciales, disponibilidad ni migraciones aplicadas en Supabase remoto.
No se modificaron datos de producción, ni se hicieron commits o pushes.
Los logs de esta revisión usan el prefijo `tests/output/audit-`.
