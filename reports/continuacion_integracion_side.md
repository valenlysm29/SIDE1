# Continuación local SIDE: estado de integración

No listo para producción. No se modificó producción ni se hizo push.

| Componente | Resultado | Evidencia y límite |
|---|---|---|
| Expulsión/reingreso | Aprobado parcial | `python tests/side_local_rebuild_probe.py`: 22 scripts SQL, reingreso, expulsión y reactivación en PostgreSQL local con rol privilegiado; no prueba Auth/RLS por API. |
| Reconstrucción Supabase | Bloqueado | La cadena experimental requiere esquema Auth del contenedor local y no prueba todas las migraciones ni CLI desde cero. `pgcrypto` debe estar en `extensions`. |
| Distribución manual | Aprobado parcial | `node tests/side_manual_distribution_ui.cjs`: Chromium escritorio/móvil, dos tiendas y rechazo de exceso; sin persistencia Supabase ni cierre remoto. |
| Ventas/stock | Aprobado parcial | `node --test tests/side_store_distribution.test.cjs`: 78 unidades, S/3120 y 7 restantes en ejemplo; no valida Supabase real. |
| Costos/inventario | Aprobado parcial | `node --test tests/finished_goods_valuation.test.cjs`: S/50 vendidos y S/50 inventario, siguiente ciclo reconoce costo una vez. |
| Seguridad financiera | Fallido integral | `node --test tests/authoritative_worker.test.cjs`: 7 pruebas pasan, pero precios/eventos/decisiones y RLS integral aún no están verificados; eventos no verificables quedan bloqueados. |
| Regresión completa | Fallido | `node --test tests/*.test.js tests/*.test.mjs tests/*.test.cjs`: 765/770 aprobadas en ejecución previa, 749/756 en ejecución posterior; siete fallos incluyendo dos históricos inventario, dos 3D y tres navegador/infraestructura. Tras esa ejecución se corrigió cero negativo en recuperación de tres ciclos y la prueba focal pasa; no se repitió suite completa. |
| Arrastre tienda Supabase | Bloqueado | No se ejecutó prueba persistida real de tres ciclos ni reintentos con RLS. |

El runtime Edge local se regeneró. No se hicieron migraciones ni despliegues remotos. `tests/security_ledger_witness.test.cjs` reproduce debilidad de la función local `cycle.close`; la protección del worker es parcial y no equivale a demostrar seguridad de todos los caminos.
