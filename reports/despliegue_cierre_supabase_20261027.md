# Activación remota del cierre económico

Verificado el 27/10/2026, 23:19 (America/Lima), en el proyecto SIDE `plfuwfdpsagzrlveqkvl`.

- Función `side-business-close`, versión 1, estado ACTIVE. Contiene el motor generado desde los mismos módulos locales, sin duplicar las fórmulas.
- Migración remota `programar_cierre_economico_edge` aplicada correctamente. Se habilitaron pg_cron y pg_net; el token exclusivo del programador se generó dentro de Vault sin exponerlo al cliente.
- Job `side-business-close`, ID 1, activo, frecuencia cada minuto.
- Invocación inicial ID 1: HTTP 200, success=true, 67 cierres pendientes procesados. Incluyen salas sin empresas; se guardaron 24 resultados de empresa/ciclo, 21 con unidades vendidas positivas. No se recalcularon cierres definitivos anteriores.
- Ejemplo remoto: SIDE-6VNW, ciclo 1, 100 unidades producidas y vendidas, S/10,000 de ingresos. Los ciclos posteriores de esa sala registraron producción cero según sus planes; no se fabricaron ingresos artificiales.
- Disparo automático del 28/10/2026 04:19:00 UTC: Cron succeeded, petición ID 2 HTTP 200, success=true, cero cierres nuevos. Confirma programación sin navegador e idempotencia tras la recuperación inicial.
- Petición pública sin token: HTTP 401 Unauthorized.
- 50 pruebas Node aprobadas. El paquete Edge también ejecutó la prueba PostgreSQL de dos ciclos: 90 unidades y S/22,500 por ciclo, impuesto final S/5,839.77, balances cuadrados y persistencia sin docente.

Advisors antes y después: los mismos avisos preexistentes, sin hallazgos nuevos sobre las funciones incorporadas. Incluyen funciones históricas con search_path mutable y funciones públicas SECURITY DEFINER, que requieren una auditoría separada de permisos; no se modificaron contratos de admisión ajenos al cierre. Referencias: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable y https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable.

El servicio Node externo ya no es necesario para este proyecto. La programación y el motor están alojados en Supabase. La función valida un token propio del programador aunque verify_jwt sea false; únicamente el rol de servicio puede consultar su validación.
