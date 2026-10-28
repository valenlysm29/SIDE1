# Estado de la Puerta 1: identidad y cierre

La rama local es `fix/ventas-ingresos-impuesto`, creada desde `4cbd8bbf5d47c895d30c6b00a10bc64401d58334`. No se aplicaron migraciones ni se desplegó código en producción.

## Identidad — prototipo, no desplegar

El prototipo utiliza Supabase Auth anónimo, un dueño por empresa, clave hexadecimal de ocho caracteres mostrada una vez y hash bcrypt, límite de intentos, primer reclamo de empresa histórica y liberación por docente. Rechaza las RPC antiguas de ingreso anónimo y cerca los wrappers de estado, decisiones y podio; protege algunos campos internos del snapshot y retira la escritura de reportes del cliente. La migración no modifica cierres históricos.

Riesgo abierto: el cierre todavía consume `cash_ledger` y `financial_sections` suministrados por el cliente. Debe diseñarse su validación o reconstrucción autoritativa sin perder movimientos, eventos y saldos históricos. La prueba PostgreSQL de identidad usa un esquema simplificado y no acredita toda la RLS o los RPC desplegados. No se ha validado Supabase Auth real extremo a extremo.

## Pruebas

- `python tests/identity_real_pg.py`: PostgreSQL 17, dos identidades, primer reclamo concurrente, clave y revocación; fixture simplificado.
- `python tests/side_postgres_concurrency.py`: PostgreSQL 17, cierres simultáneos, fallo inyectado y cambio de participante durante el cierre. Usa conexiones reales y una base nueva aislada.
- `node tests/teacher_results_isolation_ui.cjs`: aprobado; el mock esperaba la RPC antigua y se adaptó a la consulta vigente sin cambiar timeout ni aserciones.
- `node tests/side_three_cycles_db.cjs`: tres ciclos de cuatro empresas en PGlite; no sustituye prueba real de Auth ni de Supabase local.
- La clasificación y acciones para las 36 pruebas originales están en `reports/clasificacion_36_pruebas_2026-10-28.md`.

Las pruebas reales Python requieren `psycopg[binary]==3.2.13` instalado en `tests/.python-deps`, y PostgreSQL escuchando en `127.0.0.1:55439` con usuario local `side_test`. Los binarios descargados de EnterpriseDB se guardaron en `.codex-work/postgres` y su SHA-256 se verificó. Las bases de prueba creadas permanecen aisladas allí. No se dispone de Docker ni WSL, por lo que no se ejecutó Supabase local ni la prueba de navegador con docente y dos estudiantes en tres ciclos.

## Puertas y reversa

La Puerta 1 no está aprobada: faltan seguridad económica de origen, RLS sobre el esquema completo y prueba integrada real con Supabase local. No se ejecutaron las puertas de respaldo, ensayo, aplicación, verificación posterior ni push. No hay cambio de producción que revertir. Cuando se complete la Puerta 1, el plan deberá incluir respaldo externo validado, ensayo y verificación de historia antes de aplicar; una eventual reversa debe restaurar primero la función anterior y revertir el commit, dejando la restauración de datos para una decisión separada.

Última suite completa: 753 pruebas, 748 aprobadas y 5 fallidas. Cuatro corresponden a dos casos legacy de inventario/cierre y dos expectativas históricas de entrada 3D. El quinto era el PDF que omitía el impuesto separado; se corrigió después y su prueba focal pasó (5/5); la suite completa no se ha repetido después de esa corrección. El fallo independiente de simulaciones v19 permanece documentado en la clasificación.
