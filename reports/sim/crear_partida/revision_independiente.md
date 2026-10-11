# Revisión independiente — creación de partida

Revisor A2. Diff contra HEAD inicial `92ebb13`; no participó en implementación. Revisó HTML, CSS, docente, servicio, SQL, pruebas nuevas y ajustes a pruebas existentes. Sin conexiones externas ni producción.

## Hallazgos comunicados para corregir

1. **Reanudar una sala ya cerrada por otra pestaña anuncia éxito sin sala.** `recoverServerRoom()` devuelve true cuando el servidor devuelve null (`js/docente.js`, rama `if(!result.data)`), pero el handler `resumeRoom` interpreta true como sala recuperada y publica aviso verde. Reproducción: mostrar una sala anterior; cancelarla en otra pestaña; pulsar Reanudar sala anterior. Se limpia el id, pero aparece «Sala recuperada». El handler debe exigir una sala real y mostrar que la anterior terminó si no hay fila activa.
2. **Reintento con respuesta perdida devuelve una sala finalizada como éxito.** SQL `crear_sala_docente` recupera por requestId incluso una fila finalizada; servicio `crear` solo rechaza phase inconsistente cuando estado es esperando. Reproducción VM real del servicio: respuesta `{id:'old',codigo:'SIDE-AA2',estado:'finalizada',serverTime:...,configuracion:{runtime:{phase:'cancelled'}}}` produce `{success:true,...}`. Flujo: creación se confirma en servidor, se pierde acuse, otra pestaña cancela, Reintentar mantiene el requestId y anuncia «Sala creada» con lobby oculto. Debe informar que solicitud terminó y permitir nueva solicitud; nunca éxito de sala utilizable con estado finalizada.

## Concurrencia, permisos y manejo de errores

- SQL serializa creación/recuperación por profesor con `pg_advisory_xact_lock`, índice único parcial de requestId y reintento por colisión solo de código. Conserva idempotencia ante pérdida de acuse; diferentes requests reciben conflicto. La transición de inicio usa `side_sync_game` existente con `FOR UPDATE`.
- Los nuevos RPC SECURITY DEFINER fijan search_path public y consultan `auth.uid`; creación además exige perfil docente. Revocan PUBLIC/anon y conceden authenticated. El reemplazo verifica sala y profesor exactos. No modifica `guardar_puntaje_docente` ni engine Excel.
- Errores nuevos tienen consola y mensaje visible. Los `catch{}` remanentes del diff son escritura de cache local ya existente; no ocultan fallo de RPC. El `finally` libera guards.
- Ajustes de pruebas existentes reflejan botón nuevo y fallo visible en modo sin servidor. E2E nuevo incluye doble clic, dos pestañas, recarga, respuesta perdida, estados previos, errores/migración, código repetido y Manual/Automático. Al revisar se está ampliando para ambos casos anteriores.

## Comprobación del diff final

Ambos hallazgos están corregidos: reanudar exige `state.partidaId` antes del éxito y la rama sin sala muestra «La sala anterior ya terminó»; servicio rechaza filas finalizadas con `SOLICITUD_FINALIZADA`, UI limpia requestId y Reintentar inicia una solicitud nueva. La validación de respuesta también exige un estado/phase coherente. Hay prueba unitaria de cancelada/finalizada y E2E para reanudar tras cierre en otra pestaña. Se revisó además el guard de requestId para salas legacy sin requestId: el conflicto se muestra incluso cuando ambos valores son null.

No quedan hallazgos bloqueantes en el diff revisado. Estado: revisión aprobada. A0 confirmó E2E verdes para ambos hallazgos (reanudar sala cancelada en otra pestaña y respuesta perdida seguida de cancelación/reintento con nueva solicitud), creación concurrente con requests distintos y colisión demo SIDE-000. El resultado global del lote relacionado y E2E completo queda registrado por el agente ejecutor en el informe principal.

## Verificación puntual final

Se revisó el ajuste de `tests/waiting_tutorial_ui.cjs:71`: pausa el reloj virtual después de instalarlo y antes de reiniciar la primera diapositiva. Conserva sin cambios las aserciones de 6999 ms (diapositiva 1), +1 ms (diapositiva 2), bucle a 7000 ms y limpieza de timers a 21000 ms; no amplía tolerancias ni debilita resultados. `clock.install()` por sí solo permite el avance del reloj durante las llamadas del test; `pauseAt` hace exacta la medida. El ejecutor reprodujo el mismo fallo de 6999 ms en la copia base `.codex-work/atribucion-9fbe6ec`; `git diff 9fbe6ec HEAD` para ese test y tutorial no mostró cambios previos. El fallo es preexistente del arnés; no se modificó código de tutorial del producto. Con la pausa la prueba pasó.

Se revisó también aplicar `loadConfig()` seguido de `paintTeacherClock()` tras crear/recuperar: la configuración y el tiempo visible quedan alineados a la fila y al reloj del servidor, evitando mostrar fugazmente la duración del ciclo en la sala de espera. `SIDE_ACTIVE_ROUND` guarda ahora el round confirmado, también en reintentos idempotentes. El ejecutor informó verdes 57 pruebas unitarias, siete scripts DB y E2E de creación/ciclo/docente; history/grades/checks completan el registro general sin requerir un segundo navegador de revisión.
