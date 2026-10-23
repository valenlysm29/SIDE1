# Correcciones de docente, decisiones y cierre — 23 de octubre de 2026

## Causas y cambios

- **Docente / SQL:** `e` correspondía a `public.empresas`, que no tiene `estado`. La expulsión está en `participantes.expulsada_at`. Se corrigió la función de contexto, se añadió reparación idempotente y se retiró del fixture la columna ficticia que ocultaba el fallo. La recuperación docente lee ahora el balance general en los formatos persistidos actual y anterior.
- **Estudiante:** el saldo duplicado pertenecía al encabezado compartido de decisiones. Se eliminaron el HTML, sus referencias DOM y estilos. Se conservan CAJA / EFECTIVO y el costo operativo por unidad.
- **3D:** el puente escribía ventas, gastos y comisiones en el ledger empresarial; el cierre también leía cantidades vendidas y precios del mundo. El mundo conserva su economía local y el motor empresarial ignora esas entradas. Los movimientos 3D heredados de ciclos sin cerrar se limpian con respaldo local; los cierres históricos permanecen congelados.
- **Confirmación:** se encola el snapshot con `__cyclePlans` inmediatamente al confirmar, antes del render opcional del reporte. La construcción del snapshot recupera planes faltantes de confirmaciones interrumpidas. Se mantiene el outbox durable y su control de revisiones.
- **Cierre vacío:** no se guarda un cierre definitivo cuando aún no hay planes sincronizados. Es un resultado provisional que permite pausar, cortar o avanzar y reintentar después. Un plan malformado produce un error explícito. Las empresas sin confirmar siguen excluidas conforme a la regla existente.

## Regresiones previas corregidas

La copia inicial de HEAD tenía 618 pruebas: 583 pasaban y 35 fallaban. Además de corregir recuperación/reintento docente, se actualizaron los contratos de pruebas del antiguo editor Excel, DOP, progreso, costos, resumen, transición y catálogo al motor actualmente entregado. No se deshabilitaron pruebas ni se reactivó el editor anterior. Se conservan las comparaciones independientes de materiales y los escenarios históricos de Excel. Las pruebas que exigían que el punto de venta 3D alterara finanzas ahora comprueban su aislamiento.

## Verificación

Suite definitiva: **623/623 pasan**, 0 fallos, 0 omisiones, 0 cancelaciones. Comando: `node --test tests/*.test.js tests/*.test.mjs tests/*.test.cjs`. Evidencia: `tests/output/ventas-verificacion-definitiva.tap`. Evidencias adicionales en `tests/output/ventas-*.log` y `tests/output/ventas-*.tap`.

- Sintaxis: 81 archivos JavaScript de `js/` y `services/`, sin errores.
- Entrega estática: 9 pruebas pasan. Este proyecto sirve HTML/JS directamente y no define scripts de build ni lint; no se presenta una compilación o ESLint inexistentes como ejecutados.
- PostgreSQL local (PGlite): retiro repetido de triggers antiguos, migraciones repetidas, esquema real sin `empresas.estado`, autorización, revisiones CAS, expulsión, persistencia atómica, caja, snapshots y cierre idempotente.
- Se ejecutó también dos veces el archivo SQL combinado exacto sobre la base local.
- Opciones de decisiones y ciclo de vida: RPC locales verifican guardado, pausa, reanudación, corte, avance y eventos.
- Servidor local: 2 pruebas pasan.
- Navegador completo: catálogo actual con 25 decisiones/informativas y 54 guardados exactos; menú de decisiones (guardado, revisión, filtros y cambio de ciclo); panel docente con controles y publicación/expiración del podio mediante servicio simulado. Todos pasan.
- Diseño: 36 combinaciones de tamaño y pestaña; sin saldo duplicado, sin desbordes ni errores de navegador. Captura: `tests/output/decision-sticky-1366x900-A-scrolled.png`.

## Despliegue manual y límites

Ejecutar el archivo completo `docs/sql/20261023_despliegue_cierre_completo.sql` en el SQL Editor del proyecto Supabase SIDE. Contiene exactamente, en orden:

1. `supabase/migrations/20261023_retirar_motor_anterior.sql`.
2. `supabase/migrations/20261023_cierre_negocio.sql`.
3. `supabase/migrations/20261023_corregir_contexto_cierre_estado.sql`.

La instalación del cierre incluye la persistencia de snapshots financieros. Requiere el esquema existente, admisión y ciclo de vida ya instalados; no reconstruye una base vacía. No ejecutar luego migraciones históricas que reinstalen los triggers retirados.

No se ejecutó SQL contra Supabase real ni se verificó su partida autenticada. Por ello el toast y el cierre pendiente en producción solo pueden darse por resueltos después del despliegue y la reconexión docente. La ausencia de noticia grupal puede ser válida cuando ninguna está activa. Los cierres vacíos o contaminados ya persistidos requieren revisión específica; no se borran automáticamente.

El reparto sigue necesitando el navegador docente. Su recuperación al reconectar y los reintentos reducen pérdidas, pero un cierre autónomo exige un worker o Edge Function confiable que ejecute el mismo motor y persista con autorización y CAS. No se concedió a estudiantes permiso para enviar resultados financieros arbitrarios. Una empresa desconectada cuyo plan no llega antes de un cierre con otras empresas confirmadas continúa fuera de ese cierre; no se puede inferir desde el servidor su intención local.

## Archivos principales

Producto: `index.html`, `css/styles.css`, `css/production.css`, `css/responsive.css`, `js/app.js`, `js/company_summary.js`, `js/cycle_model.js`, `js/simulator3d.js`, `js/docente.js` y `services/partida_service.js`.

SQL y documentación: las migraciones indicadas, `docs/sql/20261023_despliegue_cierre_completo.sql`, `docs/despliegue_cierre_20261023.md` y este informe. Las pruebas modificadas se identifican en el diff del commit.

Todos los artefactos de trabajo permanecen dentro de SIDE1. El remoto verificado es `https://github.com/valenlysm29/SIDE1.git`; la rama de trabajo es `main`.
