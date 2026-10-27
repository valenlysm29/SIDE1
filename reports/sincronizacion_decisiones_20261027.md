# Aviso y reintento de sincronización

Se verificó mediante lectura remota que la identidad indicada por el usuario
existe y tiene un snapshot, un reporte y decisiones guardadas. Las tres firmas
RPC de escritura están disponibles: las consultas con revisión inválida (-1)
devolvieron `ESTADO_DESACTUALIZADO` sin escribir decisiones ni snapshots.
Esto no demuestra que la última confirmación del navegador haya llegado.
No se pudo inspeccionar la consola de la sesión afectada; el mensaje genérico
por sí solo no permite atribuir el fallo a una causa concreta del servidor.

Cambios:

- Conservar código y detalles de errores técnicos en las escrituras de decisiones
  y reportes. Una respuesta vacía ya no se acepta como confirmación.
- Mostrar en el aviso existente el motivo del fallo, con mensajes específicos
  para falta de conexión, pausa y funciones o columnas no disponibles.
- El botón existente para reintentar ignora la espera automática entre intentos.
  Los sondeos siguen respetándola. No vuelve a guardar un snapshot ya confirmado.
- Mantener la cola local y los datos de las decisiones mientras el envío falla.
- Actualizar versiones de los scripts para que GitHub Pages entregue el cambio.

Validación: 38 pruebas aprobadas entre admisión, cola de sincronización,
errores de los servicios, reintentos, interfaz en Chromium y estabilidad del
catálogo. No se cambiaron controles, opciones, precios ni reglas del motor.

Pendiente: obtener el motivo que devuelve la sesión afectada con el nuevo aviso.
No se afirma que el último envío del usuario esté confirmado en Supabase.
