# Notas del profesor y podio

Las notas se guardan en **Empresas**, con valores entre 0 y 20 y hasta dos
decimales. Se puede calificar durante la partida y después de terminar todos
los ciclos. No hace falta que el estudiante esté conectado. En una partida
terminada se consideran todas las empresas registradas, incluidas las marcadas
como inactivas durante la simulación.

En **Ganador y podio**, la vista previa muestra siempre las notas actuales.
Si se modifica una nota después de publicar, se indica que hay cambios por
publicar. **PUBLICAR PODIO** actualiza la publicación por otras 24 horas. El
vencimiento de la publicación conserva las notas y la vista previa del profesor.
El orden depende de las notas docentes; los empates se resuelven por nombre.

Una nota remota sólo se marca como **Guardado ✓ · Supabase** cuando la función
de guardado confirma la nota enviada. Las notas pendientes o fallidas se
conservan para reintentar y bloquean la publicación del podio. El modo local
identifica el guardado como **en este navegador**.

## Supabase

La corrección de la vista previa no necesita SQL nuevo. Usa la columna
`public.participantes.puntaje_docente` y la función existente
`public.guardar_puntaje_docente(uuid, bigint, numeric)`. Esta función permite
calificar partidas finalizadas, comprueba que la empresa pertenece a esa partida
y que quien guarda es su profesor.

La comprobación remota de sólo lectura del 9 de octubre de 2026 confirmó que la
columna existe y que la función está protegida contra acceso anónimo. No se
hicieron escrituras ni pruebas con notas reales. El guardado autenticado se
verificó con la misma migración en PostgreSQL local aislado.

Si otro entorno muestra el aviso de configuración pendiente, ejecutar en el
SQL Editor de Supabase el archivo
`supabase/migrations/20260929_guardar_puntaje_docente.sql`, sobre el esquema base
ya instalado. Puede ejecutarse de nuevo sin borrar datos. No es necesario
reinstalar el esquema completo ni modificar las políticas para permitir acceso
anónimo.

Las notas quedan en Supabase. La publicación del podio conserva el alcance
actual de la aplicación: se almacena en el navegador del profesor; este cambio
no añade una publicación compartida entre dispositivos.

## Verificación

Desde la raíz de SIDE1:

```powershell
node --test tests/teacher_podium.test.js tests/teacher_grade_service.test.js tests/teacher_sync.test.js tests/teacher_lifecycle.test.js
node tests/teacher_grades_ui.cjs
```

La prueba de interfaz usa Chromium y PostgreSQL aislados: termina todos los
ciclos, guarda las notas mediante la función SQL real, prueba decimales y cero,
recarga con y sin caché, cambia notas publicadas, vence una publicación, simula
un error de Supabase y verifica el reintento. Guarda capturas en
`tests/output/teacher-grades/`.
