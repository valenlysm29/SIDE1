# Neon — desarrollo de SIDE Lite, no listo para publicar

Proyecto `odd-dust-54712578`, rama autorizada `side-lite-dev` (`br-snowy-moon-bcshnyw2`). La rama principal de Neon y SIDE original no se utilizan. El esquema `lite` no permite USAGE a PUBLIC y no se habilitó Data API. El rol SQL del puente no es superusuario, no hereda `neon_superuser`, no tiene DELETE ni puede actualizar directamente la columna `role` de perfiles.

## Identidad y política docente

Neon Auth de desarrollo exige verificación por código al registrarse, usando el proveedor compartido de Neon para pruebas. La entrega y recepción reales no se han comprobado: falta una bandeja institucional autorizada. Para producción Neon requiere configurar un proveedor de correo propio y dominios confiables.

El puente de desarrollo escucha solo en `127.0.0.1`, verifica firma, emisor, audiencia, vencimiento, antigüedad, correo verificado y estado de bloqueo. `POST /api/teacher/activate` utiliza exclusivamente la identidad del token: la función de PostgreSQL consulta el usuario de Neon y activa el rol docente solo si su correo verificado termina exactamente en `@upch.pe`. No requiere listas ni aprobación individual. Una persona con correo institucional permanece como estudiante hasta solicitar el apartado docente. El servidor vuelve a comprobar el dominio y la verificación al usar el rol. No hay acceso del navegador a la base de datos.

La interfaz local muestra el mensaje institucional, pero **todavía no está conectada a Neon Auth ni llama al endpoint de activación**. Las pruebas históricas que creaban direcciones `.invalid` están deshabilitadas; no se debe enviar un código a direcciones ficticias ni simular su recepción. La prueba real de entrega queda pendiente hasta disponer de una bandeja institucional autorizada.

El archivo ignorado `.neon-dev-secrets.json` contiene credenciales exclusivas de desarrollo; nunca añadirlo a Git ni utilizarlo en producción. El corredor `dev-runner.js` las recibe por entrada estándar. No son credenciales del SIDE original.

## Cierre programado

`close-cycle.js` reutiliza el motor económico y procesa cada ciclo en su propia transacción con `FOR UPDATE SKIP LOCKED`; un ciclo defectuoso no bloquea los demás. `closing-function.js` solo acepta entregas verificadas de Neon Function Trigger. La función `sideclose` está desplegada en desarrollo, pero su programación por minuto permanece **desactivada** para evitar consumo continuo de cuota. La hora guardada en PostgreSQL bloquea decisiones vencidas; el procesamiento puede terminar después. La interfaz local muestra «Procesando resultados» durante esa espera.

La versión anterior del cierre alojado fue probada sin puente local y no duplicó resultados. La versión actualizada se probó con dos cierres concurrentes en Neon y luego se desplegó en desarrollo. El cron de prueba cerró un ciclo y quedó nuevamente desactivado. La cuota gratuita debe revisarse antes de cualquier activación permanente.

## Pendiente antes de publicar

- Integrar el cliente oficial de Neon Auth o una alternativa oficial soportada sin vulnerabilidades no mitigadas; la evaluación está en `../docs/neon-auth-audit.md`.
- Comprobar recepción real y caducidad de un código con una bandeja institucional autorizada; configurar SMTP propio y dominios de producción.
- Conectar las pantallas al backend remoto seguro, con HTTPS, CORS, protección de sesiones y límites de abuso; el puente es solo local.
- Ejecutar Playwright de registro verificado y partidas completas contra frontend y backend remotos realmente desplegados.
- Verificar cuotas, monitoreo y recuperación antes de activar el programador permanentemente; no exponer directamente el esquema `lite`.

Las pruebas anteriores de tres y seis ciclos en Neon y del ciclo de 120 segundos utilizaron el puente local, antes de exigir verificación real. No constituyen pruebas del flujo actual de correo ni de un despliegue público.
