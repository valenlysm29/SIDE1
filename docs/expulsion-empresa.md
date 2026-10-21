# Eliminar empresas por inactividad

## Instalar en Supabase

Ejecuta **todo** `supabase/migrations/2026-10-21_expulsion_empresa.sql` en
Supabase → SQL Editor, después de
`2026-10-20_correcciones_docente_estudiante.sql` y sus dependencias.
La migración puede ejecutarse más de una vez. No basta con publicar la web
o hacer push: la instalación SQL es un paso separado.

La migración agrega `participantes.expulsada_at` y el RPC
`side_expulsar_empresa`. Las marcas de eliminación que existían únicamente
en el navegador del profesor no se migran automáticamente: para esas
empresas pulsa de nuevo **Eliminar por inactividad** después de instalar.

## Comportamiento

- Solo el profesor dueño de la partida puede eliminar o reactivar empresas.
- El botón espera la confirmación del servidor; un error no marca la empresa
  como eliminada y no anuncia una expulsión exitosa.
- La empresa sale de la lista activa y de la sala de espera. Se conserva en
  **Empresas eliminadas**, con resultados y opción de reactivación.
- En la siguiente consulta de estado del estudiante (cada tres segundos con
  conexión), se suspende el juego, se cierra su sesión y aparece el aviso:
  **Tu empresa fue eliminada de la partida**. El aviso permanece al volver
  al inicio. La recuperación de sesiones y el reingreso también lo muestran.
- El servidor bloquea nuevos snapshots, decisiones, reportes y consultas de
  podio de esa identidad aunque el navegador no haya recibido aún el aviso.
- La cola de sincronización deja de reenviar cambios de una empresa expulsada.
  Conserva un respaldo local de los cambios pendientes.
- Los cierres nuevos excluyen a las empresas expulsadas y no les calculan
  costos nuevos. Un cierre preparado antes de expulsar o reactivar una empresa
  debe recalcularse porque su token cambia.
- Las nuevas publicaciones de podio excluyen a las expulsadas. Sus notas y
  resultados anteriores siguen disponibles para consulta. Los snapshots de
  cierres y publicaciones ya confirmados no se reescriben.
- Reactivar permite volver a ingresar con la misma terna (código, nombre legal
  y comercial), recuperando la misma empresa y su progreso guardado.
- Al terminar o cancelar una partida no se permite cambiar la participación.

El modo de demostración local también respeta la eliminación entre pestañas
del mismo navegador; las partidas remotas usan siempre el estado de Supabase.

## Verificación local

No se instalaron cambios ni se usaron cuentas en Supabase remoto para estas
pruebas. PostgreSQL embebido y Chromium comprueban permisos, bloqueo de los
seis RPC estudiantiles, reingreso, contadores, cierre sin costos, reactivación,
lista docente, salida del estudiante y avisos en escritorio y móvil.

```powershell
node tests/company_expulsion_db.cjs
node --test tests/company_expulsion.test.cjs tests/student_sync.test.js tests/student_room_scope.test.js tests/teacher_podium.test.js
python tests/company_expulsion_ui.py
```

La prueba de navegador requiere Playwright y Chrome. Capturas y resultados
se guardan dentro de `tests/output/company-expulsion/`.
