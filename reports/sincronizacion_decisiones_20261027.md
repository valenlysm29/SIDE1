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

## Corrección del rechazo PRECIO_INVALIDO

El usuario aportó el error `22023 / PRECIO_INVALIDO`. El motor del documento
usa S/100 como precio predeterminado de Medio. El trigger v19 todavía valida
precios explícitos entre S/120 y S/200. El contrato acepta precios omitidos,
que el motor resuelve mediante su configuración vigente.

La serialización ahora omite únicamente las claves de precios que son idénticas
a los valores predeterminados del motor. Así no presenta parámetros internos
como elecciones del estudiante. El precio efectivo sigue siendo S/100; no se
cambia el motor ni se fuerza S/120. Los precios históricos distintos de los
predeterminados permanecen explícitos.

Se aplica tanto al estado actual como a los planes guardados. Antes de reintentar
se reparan también los snapshots sin confirmar que ya estaban en la cola local,
conservando metas, caja, operaciones pendientes y revisión CAS. Los snapshots
ya confirmados no se vuelven a escribir para esta reparación.

Evidencia: el RPC puro `side_precios_v19_validos` del servidor real devuelve
`false` para los predeterminados explícitos (42.5/100/250) y `true` cuando son
implícitos. No se escribieron datos de la empresa para esa comprobación.
La prueba PostgreSQL con el trigger original reproduce el mismo error y luego
confirma un envío restaurado desde la cola. También se comprueba que el motor
resuelve exactamente los mismos precios antes y después de la serialización.
La interfaz verifica que desaparece el aviso después de la confirmación, sin
añadir controles de precios.

El navegador del usuario debe cargar esta versión para reintentar su cola local.
