# Integración de lógica Excel SIDE — 11 de octubre de 2026

## Estado de entrega

Motor puro Node/navegador, editor con las 68 opciones Excel, cierre local/remoto e historial, y adaptador de caja común ya implementados. El cierre remoto usa contexto autoritativo, token de estado, permisos del docente e idempotencia; se prueba mediante mocks y PostgreSQL PGlite local, sin operaciones de prueba en producción. La verificación final única terminó. La integración Excel pasa sus simulaciones y oráculos; la aceptación global queda bloqueada por dos fallos de carga 3D sin resolver.

**Push: no realizado.** Motivo: `continuous_world.cjs` y `world_cycle_restart.cjs` no quedaron verdes ni demostrados como preexistentes. WIP locales preservan exclusivamente la tarea; cambios ajenos NPC/modelos/reportes quedan sin incorporar. El commit inicial del usuario es 9fbe6ec.

## Implementación por hoja

| Fuente | Implementación y alcance real |
|---|---|
| Catalogo_Decisiones / Seleccion_Ciclo0 | `js/engine/catalogo_excel.js` conserva las 68 filas y normaliza costos; `puntajes.js` valida una opción por grupo. En modo por lotes las 68 filas Excel son la fuente activa del editor, incluidos cuatro grupos nuevos. La interfaz anterior mantiene IDs para las empresas que continúan en ese modo; al activar lotes se impide seguir generando cargos desde sus categorías. |
| CANTIDAD DE PRODUCCIÓN | `produccion.js`: matrices de personal, 24 días, cuello de botella, eficiencia literal, reparto truncado, restricciones por insumo/lote, conversiones de compra e inventario. Al activar lotes se deshabilita el cálculo productivo anterior para esa empresa. |
| Costos De Producción | `costos.js`: cargas laborales literales MYPE/No MYPE, CTS manual, mantenimiento y depreciación, valorización MP, jerarquía de almacén y reputación operativa. El adaptador de caja paga compras netas y adquisiciones/instalación/capacitación una vez; depreciación afecta resultados, no caja. |
| Lotes_Produccion / Motor_Puntajes | Calidad por lote, umbrales y mensajes; calidad ponderada de empresa; eficiencia, reputación y salud; niveles Alto/Medio/Bajo sin normalizar puntajes. Se incluyen cuatro grupos adicionales conforme al pedido. |
| Matriz_Consecuencias | Ocho reglas en `consecuencias.js`; efectos por lote, reputación una vez por regla/ciclo, penalización productiva multiplicativa, historial y tasa futura. La conservación literal de textos incluye errores ortográficos del archivo. |
| Ventas | `mercado.js`: modelo 2 por segmento y modelo 1 solo de contraste. `ciclo.js` reúne empresas, replica decisiones, elimina al no decidir inicialmente, vende stock anterior y conserva inventarios. |
| Instrucciones / DECISIONES / FlujoWeb | Editor en ui_excel.js, planes confirmados por ciclo, cierre remoto con el mismo motor y estados financieros comunes. |

Los archivos del proyecto y temporales permanecen en SIDE1. La fuente se copió a `.codex-work/DECISIONES_SIDE_16.xlsx`, sin modificar el archivo de Descargas. No se debe añadir esa copia a Git; queda por confirmar si el usuario desea versionar el Excel original. Los oráculos derivados son entregables solicitados.

## Evidencia y paridad

El original se leyó con dos cargas de openpyxl para distinguir fórmulas y valores en caché. Las diez hojas completas, rangos matriciales, catálogo y fixtures están en `docs/logica_excel/`. La copia recalculada usa **Microsoft Excel COM 16.0**, en una instancia propia invisible. LibreOffice no se encontró instalado; se documentó esta alternativa en vez de afirmar que se utilizó.

`ORACULO_SIDE.xlsx` parte de las diez hojas originales. `ORACULO_SIDE_paridad.xlsx` añade la comparación. Las fórmulas generalizadas de consecuencias y mercado se identifican como extensiones; sus resultados no demuestran por sí solos todos los componentes de un cierre multiciclo.

Los caches abreviados del original y los números de presentación del pedido no se consideran verdad de precisión completa. Ejemplo: reputación operativa se presenta como 11.1876, mientras Excel recalculado entrega aproximadamente 11.187635078564613. La comparación usa enteros exactos y tolerancia relativa `1e-9` para decimales.

| Verificación | Excel real | SIDE | Resultado conocido |
|---|---|---|---|
| Base completo | esperado_base.json | obtenido_base.json |351 salidas;0 diferencias |
| Consecuencias escalares | sim2 y sim2_premium | paridad_consecuencias |56 salidas;0 diferencias |
| SIM1,4empresas,3segmentos,1ciclo | ORACULO_sim1.xlsx | cierre docente UI |468 salidas (incluye caja);0 diferencias;351 componentes base adicionales |
| SIM2,2empresas,3ciclos | ORACULO_sim2.xlsx multilote | cierre docente UI |585 salidas (incluye caja y detalle de lotes/mercado);0 diferencias |
| SIM3,5empresas,3ciclos | ORACULO_sim3.xlsx | cierre docente UI |1140 salidas (incluye caja y detalle de lotes/mercado);0 diferencias; móvil sin desborde y progreso confirmado 1/1,100% |
| Recuperación antes del préstamo | ORACULO_banca.xlsx | banca_recuperacion.cjs |252 salidas;0 diferencias |
| Caja completa/intereses | Fórmulas independientes de extender_finanzas.py | adjuntarCaja y UI |33 campos por empresa/ciclo; cero diferencias en Node y simulaciones UI finales |
| Regresión anterior | baseline 9fbe6ec exacto |8 ejecuciones comparadas |NPC 17/16, móvil de 40 px y scrollY preexistentes demostrados; doble DOM previo corregido (9/9) |

Total final del oráculo: **3104 comparaciones correctas, cero diferencias y cero pendientes**. Incluye dos casos bancarios de 252 salidas cada uno y 56 verificaciones escalares de consecuencias. Los perfiles §5.1, §5.2 y §5.3 usan cantidades/personal diferentes; son ejemplos independientes. Por eso SIM1 comprueba los 351 componentes canónicos y, además, un cierre coherente de tres lotes por empresa con entradas explícitas y oráculo independiente; no se afirma que un cierre único reproduzca tres perfiles contradictorios al mismo tiempo.

## Errores identificados y correcciones

- El modelo anterior sumaba todos los operarios N3 para eficiencia, imponía tope 1 y redistribuía sobrantes al último molde. El motor Excel aplica columna F literal, sin tope, y trunca cada lote.
- Las penalizaciones de producción ahora restituyen el MP no utilizado antes de valorar costos/inventario. El caso `200×0.70×0.95` se normaliza a precisión Excel antes de truncar para obtener 133, sin perder una unidad por ruido binario.
- El cierre pasó a reconocer la eliminación del historial y conservarla en ciclos posteriores.
- La depreciación acelerada recibe el ciclo real, sin agregar campos internos a las decisiones replicadas.
- Se agregaron los costos recurrentes de RR.HH., marketing, canal e inventarios desde el catálogo, sin duplicar personal, MP ni mantenimiento ya calculados.
- La garantía se provisiona por unidad vendida; esta interpretación operativa no constituye una fórmula original de cierre en el Excel.
- Los préstamos se informan como financiamiento, separados del ingreso por ventas. No se inventó un calendario de amortización ausente en la fuente; caja e intereses se calculan en el adaptador único. La tasa mensual equivalente es una extensión configurable y PENDIENTE_DEFINIR, no una fórmula bancaria del archivo fuente.
- Se detectaron los hallazgos adicionales 34–35 de valorización y denominador de hilo, explicados abajo.

## Tabla de decisiones y ajustes

Todos los nombres de configuración se refieren a `js/engine/config_excel.js`. Una fila «interpretación» requiere revisar el módulo indicado: no se ofrece un cambio ficticio de configuración inexistente. Los cambios de regla deben repetirse en el oráculo y sus pruebas.

| # | Valor/interpretación aplicada | Cambio de una línea o ubicación |
|---|---|---|
| 1 | Ciclo de 24 días; Costos fixture inyecta 30 | `DIAS_CICLO:24` |
| 2 | Corte 5/7/9; ensamble 6/8/12; acabado 6/7/10 | `PRODUCTIVIDAD:{corte:[5,7,9],ensamble:[6,8,12],acabado:[6,7,10]}` |
| 3 | N3 de columna F para factor productivo | `EFICIENCIA_N3_LITERAL:true` (false suma todos N3) |
| 4 | Factor productivo sin tope | Interpretación literal en `produccion.js`; no flag de tope |
| 5 | Factor productivo y puntaje de eficiencia separados | Contrato `factorEficienciaProduccion` / `puntajeEficiencia`; sin cambio numérico |
| 6 | Mercado usa reputación operativa; Matriz usa Motor | `REPUTACION_FUENTE_MERCADO:'operativa'` o `'motor'` (**decisión 1**) |
| 7 | Calidad mercado derivada de calidad real, acotada a 100 | `CALIDAD_MERCADO_MODO:'motor'`; `'excel_literal'` solo contraste (**decisión 2**) |
| 8 | Reputación mercado ×10, sin tope | `ESCALA_REPUTACION:10`; tope requiere cambio de regla en `mercado.js` |
| 9 | Calidad y eficiencia sin normalización ni tope | Interpretación literal en `puntajes.js` |
| 10 | Calidad premium 4–6: mensaje sin penalización numérica | `CONSECUENCIAS.CALIDAD_BAJA:4`, `CALIDAD_PREMIUM:7`; criterio en `consecuencias.js` |
| 11 | Precio efectivo por lote; reputación ±2 una vez por regla/ciclo | `CONSECUENCIAS.PRECIO_BAJO:0.65`, `PRECIO_PREMIUM:1.4`, `REPUTACION_CAMBIO:2` |
| 12 | Reducción productiva 0.70×0.95 | `CONS08_MODO:'multiplicativo'` |
| 13 | Capacidad topada; horas extra 25% proporcional al exceso | `HORAS_EXTRA_PCT:0.25` — PENDIENTE_DEFINIR |
| 14 | Almacenaje S/2 por unidad sin vender; stock arrastrado | `COSTO_ALMACENAJE_UNIDAD:2` — PENDIENTE_DEFINIR |
| 15 | Próximo préstamo: +3 pp TEA | `TEA_ADICIONAL_PP:3` — PENDIENTE_DEFINIR |
| 16 | Demanda ×0.8 desde segundo ciclo consecutivo de baja reputación | `CONSECUENCIAS.CICLOS_REPUTACION:2`, `DEMANDA_BAJA:0.8`; pedido SIM-2 dice «siguiente», interpretación por confirmar |
| 17 | Essalud anual suma un solo mes | `ESSALUD_ANUAL_LITERAL:true` (false contabiliza 12) |
| 18 | CTS 750/1500 manual; corte N2 sí usa base/2 o base | `CTS_LITERAL:{MYPE:750,NO_MYPE:1500}`, `DIVISOR_MO:{MYPE:12.5,NO_MYPE:13}` |
| 19 | Motor MO usa Costos 2000/3800; catálogo referencia 2500/4000 | `SUELDOS.corte:[1500,2000,3800]` (**decisión 3**); catálogo anterior conserva sus cobros |
| 20 | Matriz personal nivel×máquina; cantidades explícitas | Contrato de `produccion.js`; editor piloto incluye matrices y activos separados |
| 21 | Dos calidades de accesorios | `ACCESORIOS_N3_HABILITADO:false`; habilitar requiere ampliar catálogo y familias |
| 22 | Compras se valoran en unidades productivas | `CONVERSION_COMPRA` y `PRECIO_MP`; interpretación de `costos.js` |
| 23 | Inventario inicial + compras − consumo | Regla generalizada de `consumirAlmacen()` y `produccion.js` |
| 24 | Descuentos 8%, 2% y 3% multiplicativos | `DESCUENTO_CANTIDAD:0.08`, `DESCUENTO_PROVEEDOR_UNICO:0.02`, `DESCUENTO_CONTADO:0.03` — PENDIENTE_DEFINIR |
| 25 | Línea recta literal; unidades y suma de dígitos como extensiones | `UNIDADES_VIDA:100000` — PENDIENTE_DEFINIR; método por `FIN-02A/B/C` |
| 26 | Mantenimiento anual/12 más política del ciclo | `TASAS_ACTIVOS`, `COSTO_POLITICA_MANTENIMIENTO` (**decisión 4**) |
| 27 | Fechas K56:K58 ignoradas para calidad | Calidad sale de `evaluarLote()`; sin constante |
| 28 | Reputación operativa tomada de Costos C65:G65 | `reputacionOperativa()`; no usar CANTIDAD C75 |
| 29 | Modelo 2 vigente; modelo 1 auxiliar | Llamada `repartoMercado()` en `ciclo.js` (**decisión 5**) |
| 30 | Redondeo por empresa sin redistribuir sobrantes | `excelRound()` en `mercado.js`; no flag para restos |
| 31 | Costos texto normalizados; original conservado | `catalogo_excel.json` / `catalogo_excel.js`; regenerar desde fuente |
| 32 | Catorce grupos más cuatro nuevos; fuera SEG/mesa/materiales | Filtro de grupos en `puntajes.js` (**decisión 6**); cambiar requiere actualizar pruebas |
| 33 | Un ciclo equivale a un mes económico | `CICLO_EQUIVALE_A_MESES:1`; cronómetro real sigue independiente |
| 34 | Valorización de ejemplo usa 107; almacén usa 107.5 | `VALORIZACION_MP_MODO:"consumo_real"`; alternativa `"excel_literal"` exige mapa explícito consumoValorizado; fixtures AB89=107 y consumo107.5 se conservan por separado |
| 35 | H61 excluye hilo N1 del denominador | `REPUTACION_HILO_DENOMINADOR_LITERAL:true` (false incluye todos) |

Las seis decisiones destacadas requieren confirmar: fuente de reputación de mercado; calidad de mercado real; salarios Costos frente a catálogo; mantenimiento doble; modelo 2 de mercado; cuatro grupos adicionales en Motor.

## Parámetros no definidos en el Excel

Marcados `PENDIENTE_DEFINIR`: horas extra 25%, almacenaje S/2, aumento TEA 3 pp, vida productiva 100000 unidades para depreciación por uso, acumulación multiplicativa de descuentos, sobrecosto lead time rápido y porcentajes de inversiones alta/baja. Los dos últimos tienen valor 0 y no se presentan como beneficios económicos demostrados.

Extensiones explícitas: interés equivalente mensual sobre deuda, sin amortización porque no existe calendario; adquisición de activos solo por incremento, sin liquidación; garantía por unidad vendida; REP baja se aplica desde el segundo ciclo. Tiendas por zona y porcentaje de ventas a crédito se capturan y conservan, pero el Excel no define su costo/demanda ni calendario de cobros; están marcados PENDIENTE_DEFINIR y no generan efectos inventados. El balance conserva caja, activos fijos e inventario MP; los productos terminados se registran en unidades, sin un método nuevo de capitalización contable. Confirmar esos criterios antes de ampliar reglas.

## Supabase

SQL preparado: supabase/migrations/2026-10-11_logica_excel.sql. **No se ejecutó en producción.** Se aplica dos veces y se prueban funciones/triggers con PostgreSQL PGlite en memoria. No modifica public.guardar_puntaje_docente. Resultados, inventarios, personal, decisiones e historial se preservan en el JSON del cierre y del snapshot.

Orden para una instalación SIDE ya migrada: ejecutar únicamente el archivo 2026-10-11_logica_excel.sql completo en el editor SQL de Supabase. Depende del esquema existente y de supabase_game_lifecycle.sql y supabase_student_admission.sql. No repetir migraciones antiguas de una base en uso sin revisar su estado. Para una base local nueva las pruebas cargan supabase_migration.sql → supabase_game_lifecycle.sql → supabase_student_admission.sql → 20260930_preservar_opciones_decisiones.sql → 20261009_sala_espera_identidad_exacta.sql → 2026-10-11_logica_excel.sql.

Sin la migración nueva el flujo anterior funciona y la activación remota de lotes queda deshabilitada; modo local funciona completo. No se simula que un cierre conectado se guardó cuando falta la RPC. Cierres/historial son accesibles por las RPC autorizadas; anon no puede cerrar. CAS rechaza decisiones cambiadas y triggers preservan cierres frente a escrituras tardías.

La migración agrega la tabla side_excel_cierres (partida_id, ciclo, cierre JSON, created_at), las RPC side_excel_features, side_contexto_cierre_excel y side_guardar_cierre_excel, y dos funciones/triggers de protección de snapshots y reportes. No añade columnas a las tablas del juego. La clave primaria (partida_id,ciclo) identifica cada cierre y permite recuperar un guardado cuyo acuse se perdió. No modifica public.guardar_puntaje_docente.

## Skills, ejecución y controles

Skills `xlsx`, `frontend-design` y `webapp-testing` disponibles en `.agents/skills/`. Se usaron instrucciones de xlsx para doble lectura, fórmulas y separación de caches; recálculo Excel COM como alternativa a LibreOffice. Frontend mantiene tokens SIDE y pruebas Chrome/Playwright; evidencia en reports/sim/. Informe en Markdown; docx/doc-coauthoring no necesarios.

Comandos desde SIDE1:

```powershell
node --test tests/costos_excel.test.cjs tests/produccion_excel.test.cjs tests/puntajes_excel.test.cjs tests/mercado_excel.test.cjs tests/ciclo_excel.test.cjs tests/ui_excel.test.cjs
node tests/paridad_costos.cjs
node tests/paridad_base.cjs
node tests/oracle/comparar_pipeline.cjs
node tests/run_integral.cjs --phase=final --no-fps
```

La única corrida final de Continuación 2 usa `tests/verificacion_excel_final.cjs`, con resultados persistidos por fase en `reports/sim/final-continuacion-2/summary.json`. Node: 361/362 aprobadas; único fallo del manifiesto NPC 17/16 demostrado previo. Las siete suites existentes de base de datos y las dos pruebas SQL Excel pasan. A9 no identifica críticos abiertos en el código Excel revisado. Los fallos nuevos de navegador se investigan de forma dirigida, sin repetir la regresión completa ni modificar NPC/mundo para ocultarlos. La publicación permanece bloqueada mientras haya fallos sin resolver o atribuir.

## Transición entre modelos

No se permite activar lotes después de pagos/compras del mismo ciclo, porque se duplicarían gastos ya registrados. El mensaje indica hacerlo al comenzar el siguiente ciclo. En el ciclo limpio se conservan caja, activos y deuda; solo se importa MP cuando existe inventario físico explícito. Los activos conservados siguen generando mantenimiento/depreciación aunque se omitan en la nueva decisión.

## Recuperación de cierres y progreso

El docente reconcilia todos los ciclos concluidos desde el primero, incluidos results y finalizada tras una recarga. Un fallo conserva el ciclo pendiente y muestra Reintentar cierre; el próximo poll usa la misma partida y ciclo. Los cierres guardados se recuperan idempotentemente. Las empresas que activan lotes más tarde quedan excluidas de ciclos previos. El progreso cuenta la confirmación del plan actual (1/1, 100%) y no abre la revisión financiera antigua.

## Decisión sobre la fuente Excel

¿Deseas que DECISIONES SIDE (16).xlsx original quede en el repositorio? Por defecto no se añadió: permanece en .codex-work/, ignorado. Los oráculos derivados son los entregables solicitados y sí se guardan.

## SQL exacto para Supabase

En una instalación SIDE existente con sus migraciones anteriores aplicadas: **paso 1**, copiar y ejecutar este bloque completo. No ejecutado por Codex en producción.

```sql
-- Aplicar después de supabase_student_admission.sql y las migraciones de ciclo.
-- No ejecutado por Codex. Reutiliza JSON y RLS; no modifica notas docentes.
begin;
create table if not exists public.side_excel_cierres (
  partida_id uuid not null references public.partidas(id) on delete cascade,
  ciclo integer not null check(ciclo>0), cierre jsonb not null,
  created_at timestamptz not null default now(), primary key(partida_id,ciclo)
);
alter table public.side_excel_cierres enable row level security;
revoke all on public.side_excel_cierres from public,anon,authenticated;
create or replace function public.side_excel_features() returns jsonb language sql stable as $$select jsonb_build_object('cierreVersion',1)$$;
grant execute on function public.side_excel_features() to anon,authenticated;

create or replace function public.side_contexto_cierre_excel(p_partida_id uuid,p_ciclo integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.partidas; empresas jsonb; historia jsonb; previo jsonb; token text;
begin
 select * into p from public.partidas where id=p_partida_id and profesor_id=auth.uid();
 if p.id is null then return jsonb_build_object('error','Partida no autorizada','code','NO_AUTORIZADO'); end if;
 if p_ciclo is null or p_ciclo<1 then return jsonb_build_object('error','Ciclo inválido'); end if;
 select cierre into previo from public.side_excel_cierres where partida_id=p.id and ciclo=p_ciclo;
 if previo is not null then return jsonb_build_object('cierre',previo); end if;
 if p_ciclo>public.side_ciclo_actual(p.configuracion) then return jsonb_build_object('error','El ciclo cambió','code','CICLO_DESACTUALIZADO'); end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id::text,'capital',e.caja_inicial,'revision',s.revision,'envelope',s.snapshot#>'{decision_state,__excel}') order by e.id),'[]')
 into empresas from public.empresas e join public.participantes t on t.empresa_id=e.id
 join public.side_student_state s on s.empresa_id=e.id
 where t.partida_id=p.id and s.snapshot#>>'{decision_state,__excel,habilitado}'='true'
 and (case when s.snapshot#>>'{decision_state,__excel,cicloActivacion}' ~ '^[0-9]{1,8}$' then (s.snapshot#>>'{decision_state,__excel,cicloActivacion}')::integer else 1 end)<=p_ciclo;
 select coalesce(cierre->'historialPorEmpresa','{}') into historia from public.side_excel_cierres where partida_id=p.id and ciclo<p_ciclo order by ciclo desc limit 1;
 historia:=coalesce(historia,'{}');token:=md5(empresas::text||historia::text||p_ciclo::text||p.configuracion::text);
 return jsonb_build_object('empresas',empresas,'historialPorEmpresa',historia,'token',token,'overrides',coalesce(p.configuracion->'excelParametros','{}'));
end $$;

create or replace function public.side_guardar_cierre_excel(p_partida_id uuid,p_ciclo integer,p_token text,p_cierre jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.partidas; ctx jsonb; previo jsonb; emp jsonb; resultado jsonb; id_empresa bigint; fin jsonb;
begin
 select * into p from public.partidas where id=p_partida_id and profesor_id=auth.uid() for update;
 if p.id is null then return jsonb_build_object('error','Partida no autorizada','code','NO_AUTORIZADO'); end if;
 select cierre into previo from public.side_excel_cierres where partida_id=p.id and ciclo=p_ciclo;
 if previo is not null then return jsonb_build_object('cierre',previo,'reused',true); end if;
 -- Lock también snapshots de nuevas empresas: no solo las incluidas en el token.
 perform s.empresa_id from public.side_student_state s join public.participantes t on t.empresa_id=s.empresa_id where t.partida_id=p.id order by s.empresa_id for update of s;
 ctx:=public.side_contexto_cierre_excel(p.id,p_ciclo);
 if ctx ? 'error' then return ctx; end if;
 if ctx->>'token' is distinct from p_token then return jsonb_build_object('error','Las decisiones cambiaron. Vuelve a cerrar el ciclo.','code','ESTADO_DESACTUALIZADO'); end if;
 if jsonb_typeof(p_cierre->'resultadosPorEmpresa') is distinct from 'object' or (p_cierre->>'ciclo')::integer<>p_ciclo or octet_length(p_cierre::text)>10485760 then return jsonb_build_object('error','Cierre inválido'); end if;
 if exists(select 1 from jsonb_object_keys(p_cierre->'resultadosPorEmpresa') x(id) where not exists(select 1 from jsonb_array_elements(ctx->'empresas') y where y->>'id'=x.id)) then return jsonb_build_object('error','Empresa ajena al cierre'); end if;
 insert into public.side_excel_cierres(partida_id,ciclo,cierre) values(p.id,p_ciclo,p_cierre);
 for emp in select * from jsonb_array_elements(ctx->'empresas') loop
  id_empresa:=(emp->>'id')::bigint;resultado:=p_cierre->'resultadosPorEmpresa'->(id_empresa::text);
  if resultado is not null then
   fin:=resultado->'financial';
   insert into public.reportes_ciclo(empresa_id,ciclo,capital,ingresos,costos,utilidad,caja_final,balance_caja,flujo_caja,estado_resultados)
   values(id_empresa,p_ciclo,(emp->>'capital')::numeric,(fin#>>'{estadoResultados,ingresos}')::numeric,(fin#>>'{estadoResultados,costos}')::numeric,(fin#>>'{estadoResultados,utilidad}')::numeric,(fin#>>'{balanceCaja,cajaFinal}')::numeric,fin->'balanceCaja',fin->'flujoCaja',(fin->'estadoResultados')||jsonb_build_object('excel',resultado))
   on conflict(empresa_id,ciclo) do update set ingresos=excluded.ingresos,costos=excluded.costos,utilidad=excluded.utilidad,caja_final=excluded.caja_final,balance_caja=excluded.balance_caja,flujo_caja=excluded.flujo_caja,estado_resultados=excluded.estado_resultados;
   update public.empresas set caja_actual=(fin#>>'{balanceCaja,cajaFinal}')::numeric where id=id_empresa;
  end if;
  -- Se conserva dentro de decision_state para la lista blanca existente del snapshot.
  update public.side_student_state set snapshot=jsonb_set(snapshot,'{decision_state,__excel}',coalesce(snapshot#>'{decision_state,__excel}','{}')||jsonb_build_object('resultado',resultado,'historial',p_cierre->'historialPorEmpresa'->id_empresa::text,'eliminada',p_cierre->'eliminadas' ? id_empresa::text)),revision=revision+1,updated_at=clock_timestamp() where empresa_id=id_empresa;
 end loop;
 return jsonb_build_object('cierre',p_cierre,'reused',false);
end $$;
revoke all on function public.side_contexto_cierre_excel(uuid,integer) from public,anon;
revoke all on function public.side_guardar_cierre_excel(uuid,integer,text,jsonb) from public,anon;
grant execute on function public.side_contexto_cierre_excel(uuid,integer) to authenticated;
grant execute on function public.side_guardar_cierre_excel(uuid,integer,text,jsonb) to authenticated;

-- Un snapshot atrasado o un reporte de alumno no puede sustituir resultados
-- aprobados por el docente ni reabrir decisiones de ciclos ya cerrados.
create or replace function public.side_preservar_cierre_excel_snapshot()
returns trigger language plpgsql security definer set search_path=public as $$
declare c jsonb; s jsonb; planes jsonb; fila record;
begin
 select x.cierre into c from public.side_excel_cierres x join public.participantes t on t.partida_id=x.partida_id where t.empresa_id=new.empresa_id and (x.cierre->'resultadosPorEmpresa' ? new.empresa_id::text or x.cierre->'eliminadas' ? new.empresa_id::text) order by x.ciclo desc limit 1;
 if c is null then return new; end if;
 s:=coalesce(new.snapshot#>'{decision_state,__excel}','{}');planes:=coalesce(s->'planesPorCiclo','{}');
 for fila in select x.ciclo,x.cierre->'resultadosPorEmpresa'->new.empresa_id::text as r from public.side_excel_cierres x join public.participantes t on t.partida_id=x.partida_id where t.empresa_id=new.empresa_id order by x.ciclo loop
  if fila.r is not null then planes:=jsonb_set(planes,array[fila.ciclo::text],fila.r->'decisiones');end if;
 end loop;
 s:=s||jsonb_build_object('habilitado',true,'resultado',c->'resultadosPorEmpresa'->new.empresa_id::text,'historial',c->'historialPorEmpresa'->new.empresa_id::text,'planesPorCiclo',planes,'eliminada',c->'eliminadas' ? new.empresa_id::text);
 new.snapshot:=jsonb_set(new.snapshot,'{decision_state}',coalesce(new.snapshot->'decision_state','{}')||jsonb_build_object('__excel',s));return new;
end $$;
drop trigger if exists side_excel_snapshot_protegido on public.side_student_state;
create trigger side_excel_snapshot_protegido before update on public.side_student_state for each row execute function public.side_preservar_cierre_excel_snapshot();

create or replace function public.side_preservar_reporte_excel()
returns trigger language plpgsql security definer set search_path=public as $$
declare r jsonb;f jsonb;
begin
 select x.cierre->'resultadosPorEmpresa'->new.empresa_id::text into r from public.side_excel_cierres x join public.participantes t on t.partida_id=x.partida_id where t.empresa_id=new.empresa_id and x.ciclo=new.ciclo limit 1;
 if r is null then return new;end if;f:=r->'financial';
 new.ingresos:=(f#>>'{estadoResultados,ingresos}')::numeric;new.costos:=(f#>>'{estadoResultados,costos}')::numeric;new.utilidad:=(f#>>'{estadoResultados,utilidad}')::numeric;new.caja_final:=(f#>>'{balanceCaja,cajaFinal}')::numeric;new.balance_caja:=f->'balanceCaja';new.flujo_caja:=f->'flujoCaja';new.estado_resultados:=(f->'estadoResultados')||jsonb_build_object('excel',r);return new;
end $$;
drop trigger if exists side_excel_reporte_protegido on public.reportes_ciclo;
create trigger side_excel_reporte_protegido before insert or update on public.reportes_ciclo for each row execute function public.side_preservar_reporte_excel();
commit;
```

**Paso 2**, comprobar la instalación con estas consultas de solo lectura:

```sql
select public.side_excel_features(); -- {"cierreVersion":1}
select to_regclass('public.side_excel_cierres') as tabla;
select to_regprocedure('public.side_contexto_cierre_excel(uuid,integer)') as contexto,
       to_regprocedure('public.side_guardar_cierre_excel(uuid,integer,text,jsonb)') as guardar;
select tgname from pg_trigger
where tgname in ('side_excel_snapshot_protegido','side_excel_reporte_protegido')
  and not tgisinternal; -- dos filas
```

Después, recargar el panel del docente y la página del estudiante. Con la sesión docente autenticada, el editor remoto estará disponible. Sin la migración el flujo anterior sigue disponible y los lotes funcionan en modo local; el editor conectado permanece deshabilitado para no presentar un cierre local como persistido en servidor.


## Resultado final de Continuación 2

Corrida única completada el 11 de octubre de2026,20:36:52UTC. Evidencia: `reports/sim/final-continuacion-2/summary.json` y `regresion-integral-summary.json`; capturas y JSON por simulación en `reports/sim/`.

| Control final | Resultado |
|---|---|
| Node,74archivos |361/362PASS; único fallo NPC17/16 demostrado anterior |
| Siete suites BD existentes |7/7PASS |
| SQL Excel y ciclo de activación |2/2PASS; incluye pérdida del acuse tras commit, recuperación idempotente y un solo cobro |
| Servidor local |PASS |
| Regresión navegador |20PASS,4FAIL,1opcional omitida (`side_full_flow.cjs` ausente) |
| SIM-1 navegador |468comparaciones,0diferencias;351componentesbase adicionales |
| SIM-2 navegador,3ciclos |585comparaciones,0diferencias |
| SIM-3 navegador,3ciclos |1140comparaciones,0diferencias |
| Transición real de modelo |PASS: caja, maquinaria, préstamo y MP conservados, sin doble cobro |
| Oráculo total |3104/3104,0diferencias:351+56+468+585+1140+252+252 |
| Sintaxis |49archivos,0errores |
| Resumen móvil |390px; paneles355px contenidos; capturas de las tres simulaciones; revisión visual del resumen y progreso100% |
| Revisión independiente A9 |Sin críticos de código Excel abiertos; aceptación global condicionada a navegador |

Fallos preexistentes demostrados: manifiesto NPC17/16, desplazamiento `decisions_cycle_ui.cjs`, objetivos táctiles40px de `mobile_integral_ui.cjs`. El dobleDOM anterior está corregido y pasa9/9. Evidencia y hashes en `reports/atribucion_regresion_excel.md`.

Fallos no resueltos: `continuous_world.cjs:68` devolviófalse al iniciar en la corrida final; baseline exacto9fbe6ec pasa10escenarios. Diagnóstico actual entró correctamente y pasó1–9, pero terminó por permiso Pointer Lock; no demuestra regresión previa ni resolución. `world_cycle_restart.cjs:53` agotó30s preparando3D y lo repitió en diagnóstico, con Excel desactivado y acceso permitido. No se modificaron NPC/3D para ocultar fallos. El timeout anterior de startup y la assertion anterior de clientes NPC no reaparecieron en la corrida final: ambas suitesPASS. Véase `reports/diagnostico_carga_legacy_excel.md`.

Git: fetch realizado, origin/main sigue9fbe6ec; todos los commits exclusivos pertenecen a esta tarea, por lo que no hizo falta cherry-pick ni rama limpia. Stash previo y cambios ajenos conservados. No hay push ni SQL ejecutado en producción. El contenedor del proyecto contiene únicamente SIDE1; temporales, evidencia y scripts quedaron dentro de SIDE1. La siguiente tarea concreta es resolver preparación3D/Pointer Lock con pruebas dirigidas, sin repetir lo ya validado.

Decisiones del usuario: revisar la tabla#1–#34, especialmente cantidad realmente consumida para valorar MP(#34), horas extra, almacenaje, interés mensual, crédito/tiendas sin fórmula y métodos de depreciación extendidos. ¿Debe versionarse también el Excel original? Por defecto queda local/ignorado; los libros de oráculo derivados sí forman parte de la entrega.

## Publicación autorizada posteriormente
Tras recibir el informe de fallos pendientes, el usuario pidió explícitamente push a main. Se publica la serie de esta tarea hasta d596779 junto con esta anotación, sin resolver ni ocultar los dos fallos de carga3D documentados. Fetch confirmó main local sin commits remotos pendientes y todos los commits exclusivos corresponden a la integración Excel. Los cambios sin commit ajenos permanecen locales. No se ejecuta SQL en producción.
