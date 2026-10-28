# Revisión integral de ventas del simulador 2D — 27/10/2026

## Resultado y alcance

Se corrigieron pérdidas de metas y equipos de planes antiguos, mezcla de
decisiones de varios ciclos, confirmaciones atribuidas a otro ciclo y
sobrescritura de reportes definitivos por fotografías preliminares. Se revisaron
por separado producción, materiales, mercado, ingresos, gastos, caja,
persistencia y presentación al estudiante y docente. No se modificó `index`,
el catálogo de decisiones ni código del mundo 3D.

Tres agentes contrastaron fuentes originales, motor físico/económico y
sincronización/SQL. El Excel original recibido hoy se preservó sin cambios en
`docs/referencias/DECISIONES_SIDE_19_original.xlsx`. No es el libro adaptado
`docs/DECISIONES_SIDE_19.xlsx`: productividad, días y fórmulas de reputación
son diferentes. El detalle de sus 11 hojas y celdas está en
`reports/auditoria_excel_documentos_2d_20261027.md`.

## Fallos reproducidos y correcciones

1. Las metas antiguas guardadas como `value` se perdían al crear el borrador
   por molde. Una resolución común recupera la meta en el molde correspondiente,
   tanto en cálculo como formulario y revisión. Un plan explícito de ceros sigue
   siendo cero; no se inventa producción.
2. Equipos con `quantities`/`optionIds` pero sin `purchases` contaban para algunos
   costos y no para producción. Un historial común recupera la adquisición
   original y mantiene equipos al abrir o guardar infraestructura en ciclos
   posteriores. Respeta liquidaciones, compras futuras y un historial explícito
   vacío. Compra, depreciación, mantenimiento, caja y producción se contrastan.
3. El historial normalizado de la RPC mezclaba metas, materiales y personal de
   varios períodos. Se reconstruye la última selección de cada decisión sin
   acumular cantidades de períodos distintos; los activos conservan sus compras.
4. Algunos ciclos guardados como texto no coincidían en comparaciones estrictas.
   Se normaliza su identificación para preservar insumos, consumo y confirmación.
5. La whitelist SQL eliminaba el ciclo del snapshot. El cliente conserva su ciclo
   y reconoce confirmaciones antiguas; la migración conserva también `round`.
   Un plan abierto contaminado se respalda antes de retirarlo. No se tocan
   cierres históricos ni se confirma un nuevo plan automáticamente.
6. Un reporte preliminar tardío podía borrar ventas de un cierre válido. El
   cliente omite ese envío y SQL protege el reporte después de validar identidad
   y revisión. La reparación restaura reportes desde cierres existentes completos,
   sin recalcularlos ni reemplazar movimientos posteriores de caja empresarial.

## Verificación final

- **198/198 pruebas económicas y de sincronización aprobadas**, incluidas
  independencia respecto al 3D, límites físicos, tres segmentos, competencia,
  inventarios, costos, balance, confirmaciones, RPC y reintentos.
- Ejemplo corregido del documento: capacidad mensual 386; producción y venta
  150/140/78, **368 unidades y S/42,300** con demanda suficiente y precios del
  ejemplo 40/120/250. Se contrastaron consumos y valor de MP restantes.
- Playwright, con controles de las páginas entregadas: **seis ciclos**, 30
  confirmaciones de secciones, seis cierres docentes, seis avances y seis
  recargas. Ventas por ciclo: 100/120/100/120/140/160; ingresos:
  4250/12000/25000/15700/35000/40000. Total: **740 unidades y S/131,950**.
- Los seis snapshots reales del navegador se reprodujeron mediante el servicio
  y las RPC en PostgreSQL desechable. Coinciden ventas, reportes, caja, balances
  e historial; repetir el cierre no cambia su resultado.
- Dos contextos de navegador independientes verificaron actualización docente,
  sustitución de estimación por cierre definitivo y caja sin ingresos anticipados.
- La UI de planes antiguos verificó tres moldes con activos sin historial;
  guardar infraestructura dos veces en el siguiente ciclo conserva equipos,
  mantenimiento y caja sin inversión duplicada. Produce/vende 90 premium por
  S/22,500 en ese caso.
- El diagnóstico SQL de SIDE-7DFR se validó localmente para distinguir reporte
  sobrescrito, cierre guardado con cero y ciclo pendiente.

La suite amplia inicial obtuvo 698/722. Sus 24 fallos se reprodujeron en HEAD.
Se corrigió la dependencia ausente de un harness de costos, sin alterar
expectativas: sus ocho casos pasan. Las 17 fallas restantes de los archivos
contrastados coinciden en HEAD y esta revisión. No se declara verde toda la
suite ni se modifican cancelación o entrada al mundo para acomodarla. Evidencia
en `reports/baseline_regresion_ventas_2d_20261027.md`.

## SIDE-7DFR y despliegue

La consulta pública de solo lectura confirmó HTTP 200 y código disponible.
Los precios internos 42.5/100/250 pasan el validador remoto. Antes de este push,
GitHub Pages aún servía `app.js` sin la recuperación de metas ni el marcador
de ciclo de snapshots; las diferencias se verificaron normalizando saltos de
línea, no por diferencias CRLF.

No hay credenciales administrativas ni sesión docente disponible para leer los
snapshots/cierres protegidos o instalar SQL remoto. El acceso al navegador del
usuario también se detuvo porque no pudo verificar la URL de forma segura.
No se crearon empresas ni se cerró o modificó una partida real.

El push publica archivos; **no instala funciones SQL de Supabase**. Para una base
con cierre v19 vigente, el incremento concreto es
`docs/sql/20261027_reparar_ventas_2d.sql`. El diagnóstico de solo lectura para la
sala es `docs/sql/20261027_diagnostico_ventas_SIDE_7DFR.sql`.
La guía completa es `docs/despliegue_cierre_v19.md`.

No se afirma que SIDE-7DFR esté reparada sin consultar sus datos protegidos y
verificar el despliegue SQL. Un cierre ya guardado con cero no se recalcula ni
se sustituye por ventas de prueba. El cierre económico todavía requiere un
navegador docente conectado o su reconexión para resolver cierres pendientes;
esta revisión no despliega un worker autónomo.

Evidencias locales: `tests/output/auditoria_2d_final_20261027.log`,
`tests/output/sales-six-cycles/`, `tests/output/live-sales-ui/`,
`tests/output/legacy-sales-2d/` y
`tests/output/diagnostico_ventas_2d_remoto.json`. Todos los artefactos de trabajo
permanecen dentro de SIDE1.
