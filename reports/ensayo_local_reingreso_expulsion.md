# Ensayo local de reconstrucción, reingreso y expulsión

Se verificó que `side_ingresar_empresa_segura` declara `person public.participantes`; `2026-10-21_expulsion_empresa.sql` crea `participantes.expulsada_at timestamptz` y las funciones de expulsión. Esta migración requiere identidad exacta, códigos, `side_contexto_cierre_excel` y podio. La cadena probada coloca primero `2026-10-11_logica_excel.sql`, `2026-10-11_fix_crear_partida.sql`, `2026-10-12_salas_codigo.sql` y `2026-10-12_podio_programado.sql`, después expulsión y finalmente identidad. No se alteraron las migraciones originales.

El primer reingreso reveló además que identidad usa `extensions.gen_random_bytes` y `extensions.crypt`; instalar pgcrypto en `public` no satisface esa dependencia. La prueba crea pgcrypto en `extensions` antes de ejecutar la cadena local.

`python tests/side_local_rebuild_probe.py` ejecutó 22 scripts del repositorio contra una base PostgreSQL nueva en el contenedor `supabase_db_sideisolated`, sin borrar bases anteriores. El script importa estructura de los esquemas gestionados `auth` y `extensions` de ese Supabase local; elimina del volcado un trigger dependiente de una función pública aún no creada. `tests/local_expulsion_probe.sql` ejercitó alta, reingreso, expulsión, rechazo y reactivación con identidades sintéticas. Resultado: PASS en `side_rebuild_b0b635874f`.

Limitaciones: la prueba usa conexiones privilegiadas y valores de claims, no sesiones Auth HTTP ni usuarios RLS; toma estructura de un contenedor Supabase previamente inicializado, incluye selección de 22 scripts (no todas las migraciones históricas), y por tanto no demuestra `supabase start` limpio y reproducible. No se modificó producción.
