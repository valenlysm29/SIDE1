# Activar la reversión de esta conversación

La lectura pública de `side_excel_features()` confirmó que Supabase tiene aplicada la entrega del 20/10: `motorVersion=side-lotes-2026-10-20`, `correccionesVersion=20261020`. No se realizó ninguna escritura remota.

El código de esta reversión usa el motor anterior. Publicarlo antes de revertir las funciones del servidor haría incompatibles los cierres de las partidas nuevas. Por eso el push queda pendiente de la ejecución manual del SQL.

1. Detén las partidas activas y guarda un respaldo de Supabase.
2. En el editor SQL de Supabase, como administrador, ejecuta **todo** `supabase/migrations/2026-10-22_revertir_correcciones_conversacion.sql`. No ejecutes de nuevo la migración del 20/10. El archivo es una sola transacción y se probó dos veces seguidas en PostgreSQL local, partiendo de las migraciones reales del 20 y 21/10.
3. Comprueba:

```sql
select public.side_excel_features();
-- Debe devolver {"cierreVersion": 1}, sin motorVersion ni correccionesVersion.

select tgname
from pg_trigger
where not tgisinternal
and tgname in ('side_validar_correo_docente',
               'side_validar_correo_perfil', 'side_fijar_motor_partida');
-- Cero filas: quedan desactivadas las reglas de esta conversación.
```

4. Indica en este chat que el SQL ya se ejecutó. A continuación se publica el commit de reversión y se comprueba el sitio. Hasta entonces la web anterior puede bloquear la creación o edición de partidas nuevas al detectar que falta su versión de servidor; no vuelvas a ejecutar el SQL del 20/10 para evitar ese bloqueo temporal.
5. Después del despliegue, crea una partida de prueba nueva. Revisa guardado, envío y cierre, y la pausa/expulsión que se conservaron de los trabajos posteriores.

El SQL conserva empresas, participantes, cuentas, partidas, resultados y publicaciones. No recalcula cierres históricos ni cambia los valores `motor_version` ya almacenados: desactiva el trigger que fijaba esa versión y restaura las funciones del motor anterior. Las columnas y tablas históricas privadas quedan conservadas sin activar las reglas retiradas, para no eliminar registros ni romper dependencias. Se conservan las funciones posteriores de pausa y expulsión.

No es necesario volver a ejecutar por separado las dos migraciones del 21/10: el archivo de reversión incorpora su adaptación. No se enviaron correos ni se cambiaron contraseñas reales.
