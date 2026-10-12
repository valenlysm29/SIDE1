# Revisión independiente de códigos y sesión — 2026-10-11

Base revisada: `ebd46de`; cambios actuales de `js/app.js`, `services/empresa_service.js`, dos migraciones nuevas y suites correspondientes. Revisión local de solo lectura sobre aplicación/SQL; no navegador ni producción. Remoto comprobado: `https://github.com/valenlysm29/SIDE1.git`.

## Hallazgos iniciales corregidos

1. `services/empresa_service.js:123`: la clasificación opcional consulta `side_estado_codigo_sala` únicamente ante `CREDENCIALES_INVALIDAS`. El RPC instalado devuelve `PARTIDA_INICIADA` para una identidad nueva en una sala ya cancelada/finalizada. Reproducción real en PGlite con ambas migraciones: crear sala, establecer `estado='finalizada'` y `runtime.phase='cancelled'`/fecha de cancelación, ingresar con nombres nuevos. Resultado del servicio: `PARTIDA_INICIADA`; llamadas: features e ingresar, sin diagnóstico. El endpoint nuevo devuelve `PARTIDA_CANCELADA` para ese mismo código. Efecto: el alumno recibe indicación de que la sala está iniciada y que revise nombres, aunque debe pedir sala nueva. Consultar también ante `PARTIDA_INICIADA` preservando el rechazo original cuando la categoría no sea terminal.

2. `services/empresa_service.js:133`: `config.cancelledAt` usa truthiness, mientras `side_config_cancelada` excluye explícitamente los textos `false`, `0`, `null` y whitespace. Las nuevas pruebas DB afirman que esos marcadores no cancelan. Reproducción de servicio con éxito RPC, sala esperando/integration y `cancelledAt:'false'`: retorna `PARTIDA_CANCELADA`; SQL nuevo considera la misma configuración no cancelada. Armonizar criterio de servicio con servidor para evitar falso rechazo cuando exista ese dato histórico. `cancelledAt:null`, el caso principal corregido, sí pasa.

## Resultados y límites

- PASS: `node tests/codigos_sala_db.cjs`.
- PASS: `node tests/estado_codigo_sala_db.cjs`.
- PASS: `node tests/student_room_scope.test.js` (6 pruebas).
- PASS: `node tests/student_code_status.test.cjs` (9 pruebas).
- Reserva de códigos sin FK, PK y trigger conservan los códigos tras borrar/cerrar, rechazan reinserción incluso con el mismo UUID y prohíben mutar el código. Generador y trigger comparten bloqueo transaccional; no se halló una ruta de reutilización desde usuarios de aplicación.
- RLS y revocación de esquema/tabla impiden lectura o modificación del registro a anon/authenticated. API pública devuelve únicamente código y categoría; no divulga identidades, UUID ni listado.
- Funciones definer tienen search_path `pg_catalog` y referencias calificadas a objetos privados/públicos. Runtime sigue invoker; helper no accede a tablas. El parche de decisiones sustituye solo el guard conocido y falla si no encuentra ese guard ni su reemplazo.
- La expansión de códigos a cuatro caracteres examina hasta 1.048.576 candidatos y ordena aleatoriamente bajo el bloqueo global; es una limitación de rendimiento al agotar los 4.608 códigos cortos, no una prueba de bloqueo funcional. PGlite serializa consultas: las seis llamadas simultáneas no constituyen prueba multinodo real.
- Históricos eliminados antes de instalar el registro no se reconstruyen automáticamente; documentación lo declara.
- Todos los comandos ejecutados desde SIDE1. La revisión no creó artefactos fuera de SIDE1; el contenedor solo contiene SIDE1.

## Revisión final — 2026-10-12

Aprobación local del alcance revisado: ambos P2 corregidos; no quedan hallazgos bloqueantes ni P2 abiertos en estas correcciones.

El servicio consulta el diagnóstico tanto para `CREDENCIALES_INVALIDAS` como para `PARTIDA_INICIADA`, conservando el rechazo cuando el diagnóstico opcional no esté disponible o no sea terminal. El rechazo ante respuestas exitosas realmente canceladas/finalizadas permanece. El marcador JavaScript y las reglas de acceso admiten null, false, 0 y sus textos vacíos/falsos, y mantienen bloqueo por fecha/true/fase cancelled. La configuración recibida se copia antes de quitar marcadores falsos.

`scopedStudentState` requiere empresa, UUID de sala y código propios y conexión activa. Configuración, ciclo y runtime toman ese estado confirmado antes que localStorage de otra pestaña. Las variables de estado se inicializan temprano, antes de los primeros consumidores; no se encontró TDZ en la ubicación final. Las versiones de app, reglas y servicio de empresa en index y docente cambian para invalidar caché.

La extensión SQL de recuperación reemplaza únicamente el guard de cancelledAt conocido, conserva finishedAt y falla si encuentra una definición incompatible. Permisos, seguridad y resto de función instalada se conservan con pg_get_functiondef/CREATE OR REPLACE. La reserva permanente y sus guards de código/estado mantienen el comportamiento previamente revisado.

Reejecución final independiente: PASS de las dos suites DB, student_room_scope (6), student_code_status (9) y cancelled_markers (2). El navegador corresponde a la verificación del agente principal; esta revisión no usó navegador ni producción. Siguen vigentes los límites históricos y de concurrencia real documentados arriba.
