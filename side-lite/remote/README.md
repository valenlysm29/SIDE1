# Neon — preparación de desarrollo, no lista para publicar

Se creó el proyecto independiente `odd-dust-54712578` (SIDE-LITE), plan gratuito, y la rama de desarrollo `side-lite-dev` (`br-snowy-moon-bcshnyw2`). La rama principal del proyecto sigue separada. En desarrollo se habilitó Managed Better Auth y se aplicaron las migraciones de esta carpeta: nueve tablas en el esquema `lite`, tiendas y doce eventos. El rol PUBLIC no tiene USAGE sobre el esquema. No se habilitó el Data API.

El módulo `identity.js` verifica firma EdDSA, emisor, audiencia, expiración, fecha de emisión y sujeto con las claves públicas de Neon Auth. Devuelve solo la identidad: **no es autorización de docente, empresa ni partida** y aún no se usa en las rutas de la aplicación. Las pruebas de firma utilizan claves de prueba locales.

Para probar Neon Auth en desarrollo, definir `NEON_AUTH_BASE_URL` y ejecutar `node e2e/neon-auth-live.js`. Crea una cuenta de prueba con dirección `.invalid`, una contraseña aleatoria no guardada y finaliza su sesión. No ejecutar contra cuentas o ramas ajenas. Los tokens y credenciales no se escriben en disco.

Pendiente antes de usar la aplicación por Internet:

- Integrar el cliente oficial de Neon Auth y mapear usuarios a perfiles y permisos de servidor sin permitir que el alumno se autoasigne el rol de docente.
- Exigir verificación de correo, configurar SMTP y dominios confiables para producción; la configuración actual de desarrollo no exige verificar el correo.
- Adaptar el backend de partidas a `lite`, usar conexiones y secretos exclusivos del proyecto, aplicar mínimos privilegios y probar autorización entre usuarios y partidas.
- Implementar y verificar un cierre alojado con entrega autenticada de Neon Function Trigger y recuperación; un temporizador en memoria de una función no basta.
- Probar recorridos reales, seguridad y concurrencia en infraestructura independiente antes de publicar.

La migración de desarrollo no activa RLS y no debe exponerse mediante un Data API. No tiene datos del SIDE original y no importa usuarios ni contraseñas locales. El proyecto existente SIDE original no se usa.
