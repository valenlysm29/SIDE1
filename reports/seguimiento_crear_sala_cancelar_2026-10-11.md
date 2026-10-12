# Seguimiento: crear sala y cancelar partida

## Solicitud corregida

Tras la captura posterior al commit `2a92ea2`, el usuario pidió quitar «Cerrar sala anterior y crear una nueva». El flujo vigente es únicamente **Cancelar partida**, con el diálogo existente y confirmación, y después **Iniciar partida** como acción independiente. Cancelar no crea otra sala. También se retiraron los controles añadidos «Reanudar sala anterior» y «Crear otra sala»; la partida actual se consulta en Rondas y eventos.

## Error reproducido y límite de la evidencia

En `2a92ea2`, `services/partida_service.js:58–60` rechazaba cualquier fila recuperada sin runtime moderno. Una partida antigua (`lifecycleVersion:1`, estado esperando, sin runtime) existe realmente, pero `obtener_sala_docente()` devuelve esa fila y el cliente la convierte en «El servidor no devolvió una sala válida». El panel pierde la posibilidad de cancelarla porque no conserva su identificación como partida administrable. La reproducción local utiliza las migraciones reales y PGlite; `tests/output/crear_partida/legacy_probe.cjs` contiene el diagnóstico del subagente.

También se reprodujo una partida v2 sin runtime: `side_sync_game` la devuelve activa con runtime vacío; y una espera v2 sin `gameStartAt`: no puede iniciar al vencer un plazo inexistente. Ambas deben permitir cancelar, sin presentarse como salas listas para jugar. La creación nueva con las migraciones del repositorio sí funciona.

La captura del usuario contiene el aviso general; no contiene la respuesta técnica. No se consultó ni ejecutó Supabase de producción, por lo que no se afirma cuál de esas filas existe en su instalación.

## Corrección

- El servicio conserva ID/código/estado de las filas antiguas o incompletas y devuelve `SALA_ANTIGUA` o `SALA_INCONSISTENTE`, con una instrucción clara para cancelar. Nunca declara éxito de creación con ese estado.
- La espera moderna debe incluir un `gameStartAt` válido, además de runtime, identidad y hora del servidor. Una respuesta de formato desconocido muestra los scripts a comprobar y «Ver detalle»: tipo de respuesta, identidad, versión, fase y relojes; no incluye credenciales ni datos personales.
- El único control para liberar una partida es «Cancelar partida». Usa `controlar_partida(id,'cancelar')`, con el ID exacto y permisos existentes. Su resultado debe confirmar esa misma fila finalizada. No hay reemplazo implícito: el servicio siempre envía `p_reemplazar_id:null`.
- Un fallo de cancelación conserva el objetivo y el diálogo para reintentar; no anuncia una cancelación inexistente. Mientras se cancela se bloquean creación y controles de ciclo.
- Cada desvinculación invalida respuestas pendientes mediante una generación. Un poll que esperaba la reconciliación de reportes no puede aplicar un snapshot anterior después de cancelar y restaurar falsamente una partida activa.
- Se actualizó la versión de los recursos del panel para cargar los cambios después de recargar.

## Revisión independiente

El revisor encontró y reprodujo dos casos en VM: pérdida del ID tras fallo de cancelación y restauración del estado por un poll pendiente. `tests/cancelar_partida.test.cjs` cubre ambas regresiones. Contra los bloques anteriores reconstruidos fielmente por el revisor fallan 2/2; con el código corregido pasan 2/2. La revisión posterior aprobó conservación de objetivo, invalidación de respuestas y bloqueo de controles durante cancelación.

## Supabase

**No se requiere una migración nueva para este seguimiento.** Se usan las funciones de creación/espera/cancelación que ya se entregaron. No se modificaron funciones SQL, RLS, `guardar_puntaje_docente`, mundo/NPC ni `js/engine/*`.

Si la instalación informa migración pendiente, sigue el orden documentado en `diagnostico_crear_partida_2026-10-11.md`: lifecycle → student_admission → espera 20261009 → fix de creación. El SQL Excel no explica el rechazo de la partida antigua.

Consulta opcional de diagnóstico, de **solo lectura**:

```sql
select id, codigo, estado,
       configuracion->>'lifecycleVersion' as version,
       configuracion#>>'{runtime,phase}' as fase,
       configuracion->>'gameStartAt' as inicio_ciclo_1
from public.partidas
where estado in ('esperando','activa')
order by created_at;
```

Esperado para una sala moderna: versión 2, esperando/integration con fecha válida, o activa/decisions o results. Filas de versión antigua, fase vacía o espera sin fecha requieren cancelación explícita desde el panel antes de iniciar otra.

## Verificación

Resultado final: **62 unitarias, siete suites SQL y seis suites Chromium aprobadas**, cero pruebas omitidas. La última repetición de `crear_partida_ui.cjs` también pasó tras conservar el estado terminal de cancelación. `node --check` pasó en los archivos JavaScript modificados y `git diff --check` no encontró errores.

Se comprobó primera creación, cuatro estados de partidas previas, cancelación con confirmación sin creación implícita, error de cancelación y reintento que conserva ID, filas antiguas sin runtime, filas modernas sin runtime o sin fecha, recarga, doble clic, dos sesiones concurrentes, respuesta perdida, colisión de código, eventos, participantes/copia, Manual y Automático e inicio único. Las pruebas existentes comprueban además el aviso de cancelación a ambos estudiantes.

Durante el lote se ajustaron dos detalles del arnés: el tiempo de navegación local y la pausa del reloj simulado de `teacher_lifecycle_ui` antes de comprobar exactamente 180 segundos. Sus aserciones se conservaron. El fixture aislado de reintento Excel incorpora la nueva generación, sin cambiar sus aserciones ni el motor financiero. Se reanudaron las verificaciones desde el punto afectado y se repitió el E2E nuevo después del último cambio de código.

Capturas y red: `reports/sim/crear_partida/after_legacy_cancelar_crear.png` y `after_evidencia.json`; logs en `tests/output/cancelar_partida_verificacion/`, con resultados compactos publicados en `reports/sim/crear_partida/verificacion_cancelar_final.json`. Los artefactos pesados permanecen locales e ignorados, dentro de SIDE1.

Commits separados: `eadef02` (servicio y pruebas de contratos) y `be5a6c0` (flujo Cancelar partida, concurrencia y E2E). No incluyen SQL nuevo, mundo/NPC ni motor Excel. La documentación acompaña la entrega en un tercer commit. La publicación utiliza fast-forward a `origin/main` después de las verificaciones verdes.
