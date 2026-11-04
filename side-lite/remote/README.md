# Neon — desarrollo de SIDE Lite, no listo para publicar

Proyecto `odd-dust-54712578`, rama autorizada `side-lite-dev` (`br-snowy-moon-bcshnyw2`). La rama principal de Neon y SIDE original no se utilizan. El esquema `lite` no permite USAGE a PUBLIC y no se habilitó Data API. El rol SQL del puente no es superusuario, no hereda `neon_superuser`, no tiene DELETE ni puede actualizar directamente la columna `role` de perfiles.

## Identidad y política docente

Neon Auth de desarrollo exige verificación por código al registrarse, usando el proveedor compartido de Neon para pruebas. La entrega y recepción reales no se han comprobado: falta una bandeja institucional autorizada. Para producción Neon requiere configurar un proveedor de correo propio y dominios confiables.

El puente de desarrollo escucha solo en `127.0.0.1`, verifica firma, emisor, audiencia, vencimiento y antigüedad del token; consulta además el estado actual de verificación y bloqueo en Neon Auth en cada solicitud. `POST /api/teacher/activate` utiliza exclusivamente la identidad del token: la función de PostgreSQL consulta el usuario de Neon y activa el rol docente solo si su correo verificado termina exactamente en `@upch.pe`. No requiere listas ni aprobación individual. Una persona con correo institucional permanece como estudiante hasta solicitar el apartado docente. El servidor vuelve a comprobar el dominio y la verificación al usar el rol. No hay acceso del navegador a la base de datos.

La interfaz tiene pantallas de código OTP y activación docente para el adaptador de Neon, pero **no inicializa el cliente oficial** y sigue sin conexión real a Neon Auth. El modo local no representa la política de producción. Las pruebas históricas que creaban direcciones `.invalid` están deshabilitadas; no se debe enviar un código a direcciones ficticias ni simular su recepción. La prueba real de entrega queda pendiente hasta disponer de una bandeja institucional autorizada.

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

El proyecto usa el plan gratuito con un mínimo de 0,25 CU. Un cierre consultado cada minuto puede impedir la suspensión del cómputo; 30 días continuos a ese mínimo equivalen a unas 180 CU-horas, por encima de las 100 CU-horas mensuales documentadas para el plan gratuito. El programador permanece desactivado.

## API HTTPS privada de desarrollo

La función `sidepreview` está desplegada solo en `side-lite-dev`. Recibe las mismas rutas que el puente mediante `api-app.js`, y exige una clave de vista previa más un JWT verificado antes de consultar datos de partidas. Sin clave o sin JWT la prueba HTTPS devuelve 401. La clave y la contraseña de la base se guardan en variables de función y en el archivo local ignorado; no van al navegador ni a Git. La vista previa no es un sitio ni un backend listo para producción: no hay protección perimetral contra abuso, conexión de frontend, ni prueba con una sesión verificada. El adaptador usa un servidor interno de loopback en el proceso de Neon; la prueba HTTPS solo cubre rechazos, no operaciones autenticadas. No usar para datos reales.

El proxy oficial de Neon se documenta en `@neondatabase/auth/server` y depende del mismo paquete afectado; el SDK combinado también depende de ese paquete. En la versión 0.7.0-beta el árbol instala Better Auth 1.7.6, incluido en la alerta crítica GHSA-965c-763c-88jm. La alerta requiere además Magic Link y OAuth, por lo que la presencia del paquete no demuestra por sí sola una explotación en esta aplicación. Una combinación corregida dio conflictos entre pares de dependencias, por lo que no se incorporó ni se considera una integración validada.
