# Códigos de partida

Las nuevas partidas usan dos letras y un número: `SIDE-WG2`, `SIDE-KR7`, `SIDE-MX4`.
Se evitan I, O, 0 y 1 para facilitar su lectura. Hay 4608 combinaciones.
Supabase elige al azar un código disponible bajo bloqueo, sin reutilizar los
códigos de partidas finalizadas. Los códigos anteriores conservan su validez.

En una instalación existente que ya tiene el ciclo de partidas, ejecutar
[`supabase_game_codes.sql`](../supabase/migrations/supabase_game_codes.sql)
en el SQL Editor de Supabase. Es transaccional y repetible, y no cambia los
códigos ni los datos de partidas existentes. La instalación completa también
incluye el nuevo formato en el esquema y las migraciones principales.

El panel docente comprueba la versión de códigos antes de crear una partida
remota. La generación local y el ejemplo del formulario usan el mismo formato.
