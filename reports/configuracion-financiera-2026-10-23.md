# Corrección de TEA y caja del panel docente — 23/10/2026

## Diagnóstico

El bloqueo era intencional, pero demasiado amplio. `refreshSetupSummary()`
deshabilitaba todos los inputs de configuración al activar una partida;
`loadConfig()` deshabilitaba específicamente la TEA, y el listener general
ignoraba cambios durante una partida activa. En el servidor,
`controlar_partida(..., 'guardar', ...)` solo incorporaba campos de eventos.
Por eso habilitar únicamente los inputs no habría resuelto la persistencia.

## Regla aplicada

- Antes de iniciar: se cambia la configuración inicial y se conserva al recargar.
- Después de crear la partida: TEA, modo de caja y montos se guardan para el
  siguiente ciclo. En ciclo 2/3 se aplican desde ciclo 3. Durante sala de espera
  se programan desde ciclo 2, preservando la caja inicial ya asignada.
- En el último ciclo no se permiten cambios financieros, porque no existe un
  ciclo posterior. Los eventos continúan funcionando.
- La nueva caja representa un capital objetivo: su diferencia se incorpora
  como aporte/retiro, sin sustituir el efectivo acumulado, crear utilidad ni
  modificar resultados cerrados. En modo aleatorio se conserva el percentil
  de la asignación original cuando existe un rango inicial.
- La TEA efectiva se usa en nuevos préstamos y proyecciones; la deuda anterior
  conserva su tasa. El ajuste de caja se registra una sola vez en cada cierre.
- Las nuevas admisiones conservan la configuración inicial del ciclo 1 y
  reciben los mismos ajustes posteriores que las empresas ya presentes.

## Archivos de implementación

- `js/docente.js`, `docente.html`: permisos de edición por campo, mensajes,
  guardado confirmado, validación, protección de borradores durante polling,
  detección de servidor que descarta finanzas y limpieza del error corregido.
- `services/finance_config.js`: resolución financiera por ciclo y ajuste de capital.
- `js/app.js`, `index.html`: aplicación al alumno, caja y configuración efectiva.
- `services/partida_service.js`, `js/engine/ui_excel.js`, `js/engine/caja.js`:
  proyecciones y cierres remotos/locales con TEA y aportes por ciclo.
- `js/financial_model.js`: aportes/retiros como financiación y patrimonio,
  conservando las utilidades e historia del flujo anterior.
- `supabase/schema.sql`: documentación de la configuración por ciclo.
- `supabase/migrations/2026-10-23_configuracion_financiera.sql`: persistencia,
  validación autoritativa, contexto de cierre y admisión con capital original.

Las referencias de scripts cambiados tienen una versión nueva para evitar
que el navegador reutilice código anterior en caché.

## Verificación

Pruebas nuevas: `tests/finance_config.test.cjs`,
`tests/finance_config_sql.cjs`,
`tests/teacher_finance_config_20261023_browser.py`.
Se actualizaron los contextos aislados de pruebas existentes y se añadió una
regresión contable de aportes/retiros en `student_financial_summary.test.js`.

Chromium prueba el DOM real con almacenamiento y servicios RPC aislados:
guardar antes del inicio, recargar, crear partida, editar durante integración
y ciclo 2, guardar, recargar, conservar borradores durante polling, rechazar
errores remotos/rangos inválidos, modo aleatorio, último ciclo, eventos,
Resultados, podio, navegación de Historial, alumno y aplicación sin duplicados.
Capturas y detalle: `tests/output/teacher-finance-config-20261023/`.
Resultado final: **26 verificaciones aprobadas, sin errores JavaScript**;
incluye limpiar el banner tras corregir un rango inválido y rechazar el falso
éxito de un servidor anterior que descarta `financialSchedule`.

PostgreSQL local PGlite ejecuta la migración dos veces, verifica persistencia,
admisiones posteriores, configuración efectiva y rechazo de valores inválidos.
La regresión `tests/excel_sql_db.cjs` comprueba cierre, CAS, aislamiento docente,
permisos y protección contra escrituras tardías. Se verificó Historial en
escritorio/móvil y las pruebas de historial/podio.

Suite general: **571 pruebas, 571 aprobadas, 0 fallos**. Registro:
`tests/output/finance-regression-suite.log`.

## Despliegue pendiente

La migración se verificó localmente; **no se ejecutó en Supabase real**.
Aplicar `supabase/migrations/2026-10-23_configuracion_financiera.sql` después de
las migraciones de sala y cierre Excel, junto con estos archivos web.
Si el servidor sigue usando la función anterior, el panel muestra la ruta de
la migración y no informa falsamente que guardó los cambios financieros.

No se modificó ninguna partida real durante las pruebas.

## Corrección de compatibilidad SQL tras el primer despliegue

El primer intento en Supabase devolvió `Contexto Excel incompatible`. La
migración inicial buscaba una cadena literal dentro de la función pública;
las migraciones de expulsión del 21/10 y reversión del 22/10 la habían
convertido en un wrapper. La prueba SQL inicial solo cubría el contexto base
del 11/10 y no detectó esa combinación instalada.

Se sustituyó ese parche literal por una función envolvente que llama al
contexto instalado, conserva íntegramente sus controles/filtros/token y añade
`financialConfig` únicamente a respuestas autorizadas pendientes de cierre.
Los errores y cierres existentes se devuelven intactos. La copia interna no
puede ejecutarse directamente por los roles públicos o autenticados.

`tests/finance_config_compat_db.cjs` verifica las versiones del 21/10 y 22/10,
migración repetida, filtro de expulsión, igualdad del contexto anterior,
permisos y devolución intacta del cierre. Ambas variantes pasan, además de
`finance_config_sql.cjs` y `excel_sql_db.cjs`.

Volver a ejecutar el archivo completo actualizado de la migración financiera.
El script original estaba dentro de `BEGIN`/`COMMIT`, por lo que el fallo
interrumpía la transacción y no debía dejar una aplicación parcial.
