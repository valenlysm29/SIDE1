# Actualización docente y estudiante — 20/10/2026

## SQL: sí, requiere una ejecución manual

Codex no ejecutó SQL en producción. El archivo de esta entrega es
`supabase/migrations/2026-10-20_correcciones_docente_estudiante.sql`.
Es idempotente y se comprobó dos veces en PostgreSQL local con PGlite.

**Orden de activación:** publica primero esta entrega del sitio y comprueba
la versión `2026.10.20.1` en ambas páginas; después aplica el SQL. Hasta ese
momento el cliente nuevo bloquea las reglas nuevas sin alterar las partidas
anteriores. No apliques esta migración de manera aislada con el sitio anterior
todavía publicado. Si la entrega permanece solo en commits locales, espera
al despliegue para ejecutar el SQL de producción.

1. Guarda un respaldo de la base y confirma que están instaladas las migraciones anteriores de ciclo de partida e ingreso, `20261009_sala_espera_identidad_exacta.sql`, `2026-10-11_fix_crear_partida.sql`, `2026-10-12_salas_codigo.sql`, `2026-10-12_codigo_corto.sql`, `2026-10-11_logica_excel.sql` y `2026-10-12_podio_programado.sql`. No repitas migraciones antiguas encima de esta entrega; podrían reemplazar las protecciones nuevas. Si falta alguna, instálala en el orden indicado antes de esta entrega.
2. Ejecuta **una sola vez el archivo completo de esta entrega**, como administrador en el editor SQL. Contiene una transacción y comprueba prerrequisitos antes de aplicar cambios. Puede reejecutarse de manera segura.
3. Comprueba:

```sql
select public.side_excel_features();
-- cierreVersion: 1; motorVersion: side-lotes-2026-10-20;
-- correccionesVersion: 20261020.

select codigo, estado, motor_version from public.partidas order by created_at desc;
-- Las partidas anteriores conservan excel-16. Las nuevas usan la versión nueva.

select has_function_privilege('anon',
  'public.ingresar_empresa(text,text,text)', 'EXECUTE');
-- false: se ingresa por la función pública protegida de código de sala.
```

4. Crea una **partida de prueba nueva** con cinco empresas. Cierra un ciclo sin enviar una de ellas: debe aparecer en Resultados con S/ 2.712,32 de costos obligatorios en régimen MYPE, y caja final S/ 97.287,68 si empezó con S/ 100.000 y no realizó otras operaciones. Verifica un borrador guardado y su marca de envío automático. No uses una partida anterior para probar las reglas nuevas.

La interfaz bloquea el editor remoto y rechaza el cierre con reglas nuevas si el servidor todavía no anuncia esta versión; así evita calcular una partida nueva con el motor anterior.

## Cuentas docentes y recuperación

Los registros nuevos requieren `@upch.pe` tanto en cliente como en servidor. La cuenta demo institucional se conserva. Las excepciones explícitas se mantienen en `js/config.js` (`TEACHER_EMAIL_EXCEPTIONS`) **y** en `side_private.docentes_excepciones`; autorizar una sola de las dos partes no concede acceso completo. No se añadieron correos externos de negocio.

En la configuración de autenticación, permite como URL de retorno
`https://valenlysm29.github.io/SIDE1/index.html?recuperar=1` y comprueba que el envío de correos esté configurado. El flujo de recuperación se verificó con un doble local de autenticación; no se enviaron mensajes ni se cambiaron contraseñas de cuentas reales.

El reingreso del estudiante continúa exigiendo código de partida, nombre de empresa y nombre comercial exactos. Diez fallos en cinco minutos bloquean durante quince minutos el origen/código de sala. El gateway debe proporcionar una dirección de origen fiable; si no hay cabecera, el límite se comparte por sala. El límite reduce intentos automatizados, pero conocer la terna exacta sigue permitiendo reingresar por decisión del producto. Un PIN adicional de cuatro dígitos se documenta como alternativa y **no está implementado**.

## Compatibilidad y reglas de negocio

Las partidas iniciadas conservan su motor. Las nuevas usan un plan canónico distribuido entre cinco secciones; guardar una sección conserva el mismo borrador. Al cierre se incluyen todas las empresas y se cobra local y limpieza aunque no envíen. Los movimientos generan caja, utilidad, balance y flujo.

El recorrido 3D de las partidas nuevas permite visitar tienda, producción y almacén. Las ventas del escenario se calculan conjuntamente al cierre y el recorrido no suma una segunda economía arcade. Las partidas anteriores conservan su funcionamiento. Solo se adaptaron las misiones que habían quedado imposibles al activar el nuevo motor; no se alteraron NPC ni avatares.

El oráculo de 3104 comparaciones comprueba el motor histórico literal. El motor nuevo contiene las extensiones autorizadas del juego; no se presenta como una copia idéntica de las celdas que usan reglas distintas.

## Confirmaciones de Joe

- Corte: regla provisional respaldada por la hoja de costos y el oráculo: sueldos base S/ 1.500 / 2.000 / 3.800; el catálogo del libro indica 1.500 / 2.500 / 4.000.
- Horas extra 25 %, almacenaje S/ 2 por unidad y +3 puntos de TEA: constantes existentes sin importe definitivo en el Excel. Alquileres distritales: S/ 1.800 / 3.500 / 2.200, tomados de las opciones del juego.
- Los precios de materiales del motor literal se aplican a la unidad productiva después de convertir pieles/carretes. La pantalla muestra la conversión, el costo bruto por compra y el descuento general del 8 %. Confirmar si el libro pretendía precio por carrete en vez de por metro antes de cambiar el motor.
- Mesa de corte única, obligatoria para fabricar en partidas nuevas, según catálogo.
- Nombre conservado de las páginas: **Simulador de Decisiones Financieras**.
- PIN opcional y demanda por distrito: pendientes de decisión. Los distritos están etiquetados como ajenos al cálculo segmentado; no se inventó una distribución.
