# Ajustes de profesores y alumnos

- Configuración: botón «Iniciar partida» al pie, contador de ciclos y resumen actualizados al editar. No se activa el reloj antes de iniciar. «Rondas y eventos» aparece después del inicio.
- Eventos: selección en una ventana de configuración y resumen limitado a tres nombres más el total; la programación de eventos viaja con el estado remoto.
- Integración: ciclo 1 de una hora incluido en el total; solo ingreso y espera. Las decisiones comienzan en el ciclo 2. El registro de empresas nuevas cierra al cumplirse la hora; las empresas existentes pueden reingresar durante la partida.
- Empresas: actualización por Realtime y consulta cada tres segundos. Se conserva la partida finalizada para consultar sus empresas y resultados.
- Tutorial: el reingreso no lo abre automáticamente. Sigue disponible mediante el botón de ayuda.
- Podio: publicación local con fecha de vencimiento a las 24 horas y datos de la clasificación congelados durante su vigencia. No se vuelve a mostrar automáticamente al vencer.
- Alumno: barra superior fija con caja, tiempo y progreso; adaptación compacta para teléfonos y tabletas.
- La creación remota fallida no inicia silenciosamente una partida local. El horario automático del alumno se calcula a partir de la programación recibida.

## Base de datos

Para una instalación existente con `docs/supabase_migration.sql` aplicado, ejecutar `docs/supabase_teacher_integration.sql` en el SQL Editor de Supabase. Incluye restricciones de ingreso y decisiones, resolución del ciclo automático y publicación Realtime de participantes. No elimina datos. El archivo general de migración contiene las mismas funciones para instalaciones nuevas.

La migración no se ejecutó contra una base de datos remota durante esta revisión. El podio conserva el almacenamiento local que ya utilizaba el proyecto.

## Verificación

60 pruebas unitarias de reglas, producción, decisiones, referencias y diseño adaptable pasaron. Después de los ajustes finales se repitieron las 19 pruebas afectadas de reglas de partida, decisiones y referencias, sin errores.

`tests/teacher_lifecycle_ui.cjs` pasó en Chromium con documentos aislados, reloj controlado y servicios simulados. Comprueba configuración reactiva, creación fallida, inicio, transcurso de la hora de integración, empresas entrantes, paso al ciclo 2, conservación del vínculo remoto, vencimiento del podio, reingreso sin tutorial, sincronización del horario automático y barra fija a 1366, 1024, 844, 390 y 320 píxeles de ancho.

Estas pruebas no validan Supabase desplegado ni cuentas reales. Capturas de la barra: `tests/output/teacher-lifecycle-student-1366.png` y `tests/output/teacher-lifecycle-student-390.png`.
