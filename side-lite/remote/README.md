# Neon — integración de desarrollo, no lista para publicar

Proyecto independiente `odd-dust-54712578`, rama `side-lite-dev` (`br-snowy-moon-bcshnyw2`). No se modificó su rama principal. La rama de desarrollo tiene Neon Auth y el esquema privado `lite` con nueve tablas, tiendas y doce eventos. `PUBLIC` no tiene USAGE sobre ese esquema y no se habilitó Data API.

## Backend y autorización de prueba

`dev-server.js` es un puente de integración que **solo escucha en 127.0.0.1** y requiere `SIDE_LITE_NEON_DEV_ONLY=1`. Verifica cada token de Neon con `identity.js`, crea únicamente perfiles de estudiante y consulta el rol en PostgreSQL. Reutiliza las rutas y el motor económico locales, con nombres de tabla calificados en `lite`. Un docente de prueba se habilita mediante una inserción administrativa directa; no existe un endpoint que permita solicitar ese rol. Los permisos están documentados en `migrations/202611040001_api_grants_dev.sql`: el rol de aplicación no es superusuario, no hereda `neon_superuser` y no tiene permiso DELETE.

El archivo ignorado `.neon-dev-secrets.json` contiene credenciales exclusivas de desarrollo; nunca añadirlo a Git ni utilizarlo para producción. El corredor `dev-runner.js` acepta esos valores por entrada estándar. Estas credenciales no pertenecen al SIDE original.

`e2e/neon-game-live.js` crea cuentas de prueba `.invalid`, imprime el UUID de su docente y espera a que un administrador inserte ese perfil en `lite.lite_profiles` como docente. Ejecuta partidas de tres y seis ciclos con dos estudiantes, comprueba el aislamiento y compara resultados. Con `SIDE_LITE_REAL_CYCLE=1` prueba un ciclo de 120 segundos. La prueba usa el puente local y acceso HTTP de prueba a Neon Auth, no Playwright ni el cliente oficial.

## Cierre programado en desarrollo

`close-cycle.js` reutiliza el motor económico y hace el cierre en una transacción con bloqueo `FOR UPDATE SKIP LOCKED`. `closing-function.js` solo acepta entregas de programador verificadas mediante `@neon/functions/triggers`. Se desplegó como la función `sideclose`, con una cuenta SQL limitada y sin credenciales en el navegador. Su programación `side-lite-close-dev` es cada minuto y está **desactivada** para evitar consumo continuo de la cuota gratuita.

La función alojada cerró una partida vencida sin ningún puente local abierto; el resultado quedó único tras una segunda ejecución. Una prueba adicional lanzó dos cierres concurrentes en Neon y comprobó un solo resultado. Para reproducirla, un administrador crea un ciclo vencido con `tests/create_due_fixture.sql` en la rama de desarrollo y pasa su UUID como `SIDE_LITE_TEST_CYCLE_ID` a `node e2e/neon-close-concurrency.js`, con el programador y otros puentes detenidos. Un ciclo probado cerró 58,5 segundos después de vencer: con cron por minuto la demora puede alcanzar aproximadamente un minuto más la latencia o reintentos; el servidor bloquea decisiones a partir de la hora de vencimiento, no del momento en que termina el cierre.

## Pendiente antes de publicar

- Integrar el cliente oficial de Neon Auth en el frontend. La versión `@neondatabase/auth` 0.6.0-beta evaluada introdujo alertas de seguridad críticas y otras en dependencias; se retiró. No afirmar que la interfaz actual usa Neon Auth.
- Configurar verificación de correo, SMTP de producción y dominios confiables; el Auth de desarrollo no exige verificar correo.
- Desplegar un backend completo y seguro: el puente actual es solo local, no tiene política de HTTPS/CORS ni límites de abuso para Internet y el JWT no garantiza revocación inmediata. Probar roles y accesos cruzados con el cliente real.
- Ejecutar Playwright de los flujos remotos y probar recuperación de red y reinicio sobre ese backend. Las pruebas Playwright anteriores usan PostgreSQL local.
- Evaluar cuota, frecuencia y supervisión antes de activar permanentemente el programador; la base gratuita suspende capacidad al superar límites. El esquema no tiene RLS y no debe exponerse directamente.
- Separar los recursos y credenciales de producción de los de prueba. No se ha desplegado una URL pública de juego.
