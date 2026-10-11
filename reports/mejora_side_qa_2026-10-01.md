# QA — mejora integral SIDE, 1 de octubre de 2026

## Paso 0 cerrado

Skill utilizada: `webapp-testing` de anthropics/skills, leída desde la instalación disponible en el contenedor del proyecto. El helper `with_server.py --help` se consultó. Se usa Playwright Node instalado en `tests/`: el Python del runtime no incluye Playwright. Los tests existentes y la aplicación se conservaron.

Resultados: 291/291 pruebas Node, seis runners DB, 22 runners de navegador y benchmark aprobados; 30/30 entradas originales. Servidor Python: 2/2. No hubo fallos ni hangs de las suites.

La captura auxiliar de acceso guardó splash, perfiles, login, lobby y Tablet de escritorio. El intento secundario de fixture docente se interrumpió; se documenta como captura auxiliar parcial, no como recorrido aprobado. Las suites aprobadas aportan capturas reales de profesor/móvil/mundo/Tablet y oficina. Se copiaron 253 artefactos y los PDF generados antes de restaurar los outputs originales.

Evidencias: `tests/output/mejora-integral-2026-10-01/before/baseline.json`, `summary.json`, logs, `screens/` y `evidence/`.

FPS SwiftShader, 1280×800 y semilla 4107:

| Tier | FPS mediano | Draw calls | Triángulos |
|---|---:|---:|---:|
| Baja | 2 | 167 | 70.310 |
| Media | 1 | 187 | 85.494 |
| Alta | 1 | 181 | 82.016 |

Son mediciones del renderizador de software, no de una GPU física.

## Preparación de cierre Fase 2

Preparado `tests/run_integral.cjs` con fases explícitas, baseline protegida, seis DB agrupadas y todos los navegadores serializados. Añadidos los runners Tablet/Móvil como entradas opcionales explícitas; la ausencia no se contabiliza como aprobado. El recorrido `side_full_flow.cjs` se añadirá sólo al autorizar Fase 3.

Cada ejecución conserva sus logs en `runs/<fecha>`, respalda los outputs antes de iniciar, archiva evidencia y restaura originales. Temporales dentro de SIDE1. Documentación: `docs/pruebas_integrales.md`.

Verificación de preparación: `node --check tests/run_integral.cjs` aprobado. No se ejecutó Node completa ni Chromium durante el turno exclusivo de Tablet. No hay commit QA todavía; corresponde cerrar Fase 3 antes de comitear estos archivos.

## Fases 3 y 6 pendientes

No iniciar Fase 3 hasta cierre de Fase 2 por el coordinador. El flujo real exige decisiones iniciales confirmadas antes de entrar al mundo: se conserva esta regla, los avatares, el catálogo, ciclos y esquema Supabase. Se comprobarán los formularios reales, el mundo WebGL, Tablet, envío/bloqueo, fin de ciclo/resultados y el profesor con datos aislados obtenidos del modelo/local DB.
