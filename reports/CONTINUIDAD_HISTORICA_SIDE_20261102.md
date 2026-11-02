# Continuidad histórica de SIDE — implementación y aceptación

Fecha: 2 de noviembre de 2026, Lima. Base: `main` / `406a0ae`.

## Estado de entrega

**Implementación funcional y pruebas integrales locales aprobadas. Backend desplegado. Publicación en `main` autorizada posteriormente por el usuario el 2 de noviembre de 2026.** La implementación se preparó en `codex/history-continuity` y se publica en `main` por esa instrucción expresa. Cuatro partidas antiguas de producción siguen sin poder cerrarse con sus entradas actuales; esta publicación no declara resuelta su continuidad ni inventa cierres para ellas.

## Causas comprobadas y correcciones

1. **Lecturas diferentes del mismo ciclo.** El docente seleccionaba el reporte actual; el estudiante dependía de snapshots y el Laboratorio hacía consultas independientes. Se creó `side_historial_oficial(partida_id, empresa_id)` como lectura común de `side_business_closures`, conservando la clave partida/empresa/ciclo, comprobantes, decisiones, recursos y estados financieros sellados.
2. **Confirmación de compras incompatible.** La ruta privada que crea órdenes al confirmar decisiones conservaba cantidades antiguas; el worker esperaba presentaciones Excel V2. La prueba productiva falló con «Orden temporal incompatible con la decisión confirmada». Se unificó la ruta privada con la conversión pública existente. No se cambiaron precios, fórmulas, órdenes antiguas ni cierres históricos.
3. **Despliegue incompleto.** Producción no tenía el avance secuencial ni la conversión V2 y ejecutaba la Edge Function v6. Se restauró su respaldo en una base local y se validaron las migraciones antes de desplegarlas. La ruta legacy conserva el motor anteriormente desplegado; las partidas nuevas usan el motor secuencial. El motor legacy coincide con el runtime anterior normalizando únicamente saltos de línea y una línea vacía final.
4. **Estados de error confundidos con espera.** Se agregó un registro de estado de procesamiento, restringido al servicio. Los errores del worker se conservan con partida/ciclo, código y fecha y se exponen mediante la lectura autorizada. Ese registro no crea comprobantes económicos ni cambia importes oficiales. Un cierre sellado siempre prevalece sobre el registro de procesamiento.

## Interfaces implementadas

- **Estudiante:** recuperación de comprobantes sellados desde PostgreSQL incluso después de recargar, historial permanente y selector de ciclo; ciclo actual provisional hasta confirmar el cierre. Los errores de procesamiento se identifican sin presentar ceros como resultados definitivos.
- **Docente / Empresas:** incorpora el historial oficial por empresa, muestra pendientes correctamente y mantiene estados financieros confirmados.
- **Docente / Resultados:** selector de ciclo, comparación de las empresas en el ciclo elegido y detalle de cada empresa desde el mismo comprobante. Conserva historial verificado en memoria ante errores de lectura y comunica la incidencia.
- **Historial:** selector de partidas anteriores consultadas en PostgreSQL, con sus empresas y ciclos oficiales; deja de depender exclusivamente de la última partida/localStorage.
- **Laboratorio:** gráficos y tablas usan la misma lectura oficial. Una lectura obtiene todos los ciclos; distingue ciclo en curso, procesamiento, error, ausencia de comprobante y confirmación.

Se preservó la corrección de parpadeo: no se reconstruyen las vistas cuando su contenido no cambia. No se modificaron los módulos de cálculo económico ni se añadieron decisiones o controles económicos.

## Pruebas integrales reales

`tests/history_connected.py` ejecutó Chromium, Auth/Data API/PostgreSQL de Supabase local y los módulos reales del ejecutor en el **runtime HTTP de Supabase Edge/Deno**. Un adaptador local limita la ejecución a la partida QA elegida para no procesar partidas de otras pruebas. No intercepta RPC ni sustituye respuestas de base de datos.

| Escenario | Empresas | Ciclos | Resultado |
| --- | ---: | ---: | --- |
| Manual | 3 | 3 | 9 comprobantes de empresa/ciclo confirmados |
| Automático secuencial | 3 | 6 | 18 comprobantes de empresa/ciclo confirmados |

Las decisiones fueron enviadas mediante los servicios reales desde navegadores autenticados: máquinas, moldes, personal, materiales, canales, metas productivas y préstamo. Hubo producción y ventas positivas, compras en presentaciones V2, recepciones persistidas y compras a crédito. **No fueron planes vacíos.**

Por ciclo se comprobó: caja inicial igual a la final anterior; inventario inicial igual al sobrante anterior; persistencia de deuda; balance cuadrado; recuperación de todos los cierres anteriores; comparación docente/Laboratorio/estudiante; recarga de los tres estudiantes; reconexión; rechazo de consultas a otra empresa. Dos solicitudes concurrentes de cierre se ejecutaron contra la persistencia real. Las huellas de los resultados de ciclos anteriores se mantuvieron intactas. Se recorrieron los selectores de todos los ciclos ya cerrados en Resultados y se capturó el Laboratorio en cada ciclo.

La prueba acelera **solo el reloj de las partidas QA recién creadas** mediante PostgreSQL; las transiciones, confirmaciones, compras, recepciones y cierres son reales. Las decisiones económicas se envían mediante servicios desde el navegador; no se afirma haber introducido cada campo manualmente ni haber validado todo el mundo 3D. Se registró un reintento de carga inicial del navegador durante una ejecución, sin alterar la pantalla de entrada.

Regresiones: **96 aprobadas, 0 fallidas**, más comprobaciones específicas del registro de errores, aislamiento y permisos. Incluyen parpadeo de docente/Laboratorio en escritorio y móvil, sincronización del estudiante, recuperación de sesión, eventos históricos, equivalencia Node/Edge, inventarios, estados sellados y presentaciones V2. Las pruebas específicas posteriores al registro de estados también pasan.

## Respaldo, migraciones y despliegue

- Respaldo local verificable de esquema, datos `public`/`side_private` y Edge Function anterior. Se restauró el contenido afectado en `history_restore_qa4`, con los prerrequisitos locales de Auth, antes de probar compatibilidad. Los respaldos con datos reales permanecen locales e ignorados por Git.
- **155 cierres sellados**, huella agregada antes/después: `e9444aa8211fe7a585b7c13076a8e9f8`. No se reescribieron.
- Prerrequisitos existentes en el repositorio desplegados: `20261031041921`, `20261102022758`, `20261102024042`, `20261102034926`, `20261102040000`.
- Migraciones nuevas: `20261102044053_historical_continuity.sql`, `20261102044938_atomic_purchase_presentations.sql`, `20261102051739_closure_processing_status.sql`. Historial de migraciones registrado.
- `side_legacy_event_context_v1` ya estaba en producción; se instaló en el entorno local donde faltaba. No se sustituyeron sorteos históricos ni se recalcularon sus efectos.
- Lectura histórica comprobada en producción con el propietario autenticado; acceso anónimo denegado y escritura privada de órdenes denegada a estudiantes. El asesor de seguridad no reportó incidencias de nivel error en la comprobación realizada.
- Edge Function **v8** desplegada con enrutamiento por versión y registro de estados; conserva la autorización por token de Vault. El frontend se publica en `main` por instrucción expresa posterior del usuario; permanece el bloqueo de datos descrito a continuación.

## Bloqueo indispensable pendiente

La comprobación posterior del programador de producción devuelve HTTP 503 por estas partidas anteriores, con el motor legacy conservado:

| Partida | Ciclo pendiente | Rechazo verificado |
| --- | ---: | --- |
| `5f875186-ea21-4c5b-aef2-5db7e8ca013b` | 2 | `DECISION_INVALIDA`: préstamo superior a la línea disponible verificada |
| `668c0643-13c9-4461-abc7-17c5dbcbc0f1` | 2 | `DATOS_ECONOMICOS_NO_VERIFICADOS`: saldo inicial o eventos sin verificación |
| `67111697-d6be-408b-8ff1-4950c00fcfa9` | 2 | `DATOS_ECONOMICOS_NO_VERIFICADOS`: saldo inicial o eventos sin verificación |
| `691d9d55-8592-403a-87cf-3cca173cc13f` | 1 | `DATOS_ECONOMICOS_NO_VERIFICADOS`: saldo inicial o eventos sin verificación |

También hay comprobantes antiguos vacíos: la lectura los distingue de un resultado financiero real. No existe una reconstrucción autorizada que pueda generar los importes faltantes sin conciliar las entradas. Corregir silenciosamente préstamos o aceptar efectos financieros sin respaldo incumpliría la petición de conservar cálculos y registros oficiales. Hace falta conciliar esas entradas con una fuente verificable antes de declarar completada la recuperación de todas las partidas existentes La publicación del frontend en `main`, autorizada posteriormente, no resuelve por sí sola esa conciliación.

## Archivos y evidencias

- Código: `services/official_history.js`, `services/laboratorio_service.js`, `services/teacher_history_service.js`, `js/app.js`, `js/docente.js`, `js/laboratorio.js`, `js/teacher_history.js`, `js/student_financial_view.js`, `index.html`, `docente.html`, `supabase/functions/side-business-close/route.mjs`, las tres migraciones nuevas y referencias en `supabase/schema.sql`.
- Pruebas: `tests/history_connected.py`, `tests/history_local_setup.py`, `tests/history_restore_backup.py`, `tests/fixtures/history-edge-entry.ts`, `tests/official_history.test.cjs`, regresiones actualizadas de historial/Edge y del doble de Laboratorio.
- `tests/output/history/integration.json`, `integration-edge.log`, capturas `lab-3-*`, `lab-6-*` e `history-*`, y vídeos continuos locales.
- `regressions-acceptance.log`, `status-regressions.log`, `status-postgres.log`, `status-edge.json`, `production-backup-verification.json`, `production-before.json`, `production-after.json`, `production-smoke.json`, `production-permissions.json`, `production-final.json` y registros de despliegue.

No se crearon archivos de trabajo fuera de `SIDE1`; se preservó el directorio principal con sus cambios previos. Remoto verificado: `https://github.com/valenlysm29/SIDE1.git`.
