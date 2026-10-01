# Fase 2 · Interfaz del estudiante

Fecha: 01/10/2026. Subagente: Estudiante.

## Dirección de diseño

Skill leída: `../.agents/skills/frontend-design/SKILL.md` (instalada localmente
fuera del checkout; sólo lectura). Referencia común: `docs/design_system.md`.
Se conserva la portada ilustrada, el logo SIDE, el estudiante protagonista y el
acceso discreto del profesor. La decisión de diseño consiste en dar claridad al
ingreso a una partida y jerarquía a las cifras, usando navy, oro y Montserrat.
Se revisó esta dirección contra el encargo antes de construir: no se añadieron
personajes, recursos gráficos, fuentes ni contenido financiero de muestra nuevo.

## Cambios

- `index.html`: enlace a `css/student-interface.css`, acciones claras en español,
  título de selección de perfil, nombres accesibles de diálogos y estados de
  conexión. Se mantienen los IDs, selectores, formularios y recursos existentes.
- `css/student-interface.css`: migración localizada a los tokens de Fase 1.
  Portada con pie oscuro que facilita leer el progreso, selección de perfil
  menos recargada, formulario compacto y ayuda legible para recuperar progreso.
  La sala distingue acciones activas/deshabilitadas y aumenta legibilidad de
  cifras y texto secundario. La oficina migra únicamente su información
  financiera; no se altera la geometría interior ni el mundo 3D.
- Foco de teclado dorado, botones de 44 px o más, campos de 48 px, soporte de
  movimiento reducido y adaptación local de cifras a ancho estrecho.

No se modificaron JS, catálogo, ciclos, avatares, esquemas ni servicios Supabase.
El CSS nuevo está limitado a acceso, sala y bloque financiero de oficina. La
hoja responsiva global conserva su lugar posterior y será revisada en el turno
del subagente Móvil.

## Verificación

Pruebas Node enfocadas, en secuencia:

```powershell
node --test --test-concurrency=1 tests/static_delivery.test.js tests/student_financial_summary.test.js
```

Resultado: **9/9 PASS**. Confirma recursos HTML existentes, orden de módulos y
contratos del catálogo, resumen por ciclos y panel financiero de oficina.
`git diff --check -- index.html` sin errores.

Se incluyó accidentalmente `student_sync_ui.test.js` en una primera verificación
Node antes de detectar que lanzaba Chromium. Se informó al coordinador, no se
lanzó otro navegador y se dejó terminar. Al omitirse el identificador de sesión
en el wrapper no se recuperó el resultado final: **no se cuenta como PASS**.
La suite completa secuencial de cierre volverá a verificar ese contrato.

Base visual consultada: `tests/output/mejora-integral-2026-10-01/before/screens/`.
El coordinador asignó el turno de captura: se guardaron 10 PNG en
`tests/output/mejora-integral-2026-10-01/fase2/estudiante/`, con dimensiones
1366 × 900 y 390 × 844 para splash, perfiles, login, lobby y bloque financiero
de oficina. Se usó el mismo fixture aislado de baseline, sin cuentas ni redes,
con TEMP/TMP/TMPDIR dentro de SIDE1. La oficina se capturó como bloque financiero
DOM con el modelo existente, no como una navegación real del interior 3D.

## Pausa explícita del usuario

El coordinador transmitió un **PARE** del usuario durante el cierre de la
captura. Se detuvo la sesión propia de captura (7515) con Ctrl+C. No quedan
procesos Node con `capture_student.cjs`. No se examinó visualmente la captura
final ni se recibió stdout/JSON final: **no se declara aprobada** la verificación
de desbordes, foco, objetivos táctiles o errores de consola en aquel intento.

Archivos pendientes sin commit: `index.html`, `css/student-interface.css` y
este informe. El script auxiliar queda local e ignorado en
`.codex-work/mejora-side-2026-10-01/capture_student.cjs`.

## Pendientes y límites

Las capturas DOM con precarga sustituida permiten revisar acceso y sala, pero no
demuestran conectividad real Supabase ni navegación 3D. La revisión de móvil,
pruebas completas y FPS pertenecen a las fases posteriores del encargo.
Este informe se actualizará con las evidencias de captura y el commit local.

## Reanudación y revisión visual

El usuario reanudó Fase 2. Se conservaron los cambios y se revisaron visualmente
capturas de perfiles, splash, login, lobby y bloque financiero de oficina en
escritorio/móvil. El logo y las ilustraciones mantienen protagonismo; el acceso
y la información financiera se leen sin recorte horizontal. La sala conserva
desplazamiento del contenido y acciones al pie. El acceso discreto del profesor
sigue disponible en móvil; no se agregaron perfiles ni personajes elegibles.

Se completaron 10 capturas de acceso y sala en `fase2/estudiante/reanudado/`, con
JSON conservado antes de cerrar el navegador. No hubo errores de página ni
imágenes rotas; las vistas tuvieron ancho documental igual al viewport. Foco
del inicio: 3 px, dorado. El runner devolvió 1 por cierre de Chromium superior a
10 s, aunque ya había guardado todas las capturas y comprobaciones; no se lo
clasifica como una ejecución completa aprobada.

La medición detectó dos `summary` heredados de 18 y 39 px en resultados. Se
corrigieron en CSS local con altura mínima 44 px, padding 12 px y foco dorado.
El intento siguiente conservó las comprobaciones desktop sin objetivos cortos,
pero falló esperando `networkidle` en el segundo fixture con polling. Se cambió
únicamente el script auxiliar a espera de DOM e imágenes completas, y se repitió
la verificación afectada móvil: **exit 0**, navegador cerrado normalmente.

Evidencias vigentes:

- `tests/output/mejora-integral-2026-10-01/fase2/estudiante/reanudado/capture-results.json`:
  10 vistas 1366/390, ancho igual al viewport, sin imágenes rotas/errores de página.
- `tests/output/mejora-integral-2026-10-01/fase2/estudiante/corregido/capture-results.json`:
  lobby/oficina desktop con cero objetivos menores de 44 px y foco 3 px.
- `tests/output/mejora-integral-2026-10-01/fase2/estudiante/corregido-movil/capture-results.json`:
  lobby/oficina móvil con cero objetivos menores de 44 px; summary 44 px, foco
  dorado 3 px; ancho 390/390, cero errores de página e imágenes rotas; exit 0.

La captura auxiliar intercepta la red y no certifica errores de red en un flujo
real. No valida cuentas reales, Supabase ni el mundo 3D. Las dimensiones
360/768 y horizontal quedan para Móvil; suites completas y FPS para QA/cierre.
La verificación Node enfocada sigue siendo 9/9 PASS, sin invocar otra suite UI.

Archivos del commit autorizado: sólo `index.html`, `css/student-interface.css`
y este informe. Mensaje: `feat(ui): mejora el acceso y la sala del estudiante`.
