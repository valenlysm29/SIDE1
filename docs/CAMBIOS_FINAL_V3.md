# SIDE · Cambios finales V3

**Compilación:** `2026.09.07.3`. **Base:** proyecto completo `SIDE_FINAL_CORREGIDO_V2.zip`.

## Empresa: centro de consulta

Debajo del segmento se incorpora un resumen de las cinco áreas, con enlace directo
al resumen. Las secciones distinguen pendiente, borrador sin guardar, guardada sin
enviar y enviada. El filtro permite consultar todas las decisiones o solo las
confirmadas. No se convierte un borrador en un envío por abrir esta pantalla.

Cada concepto del catálogo se presenta con su opción, cantidad y costo cuando
corresponde. Maquinaria diferencia existencias anteriores, compra o liquidación y
total disponible; personal incluye reducciones e indemnizaciones; insumos reflejan
el descuento de compras; canales incluyen las cantidades por distrito y vendedores.
Las reglas automáticas se identifican como informativas. Se incluyen conceptos
sin salida de caja para que las garantías o el segmento no desaparezcan del resumen.

## Finanzas sin doble contabilización

Se separan caja actual, desembolso bruto del ciclo, compromisos posteriores y caja
proyectada al confirmar. Una línea adicional muestra el ajuste pendiente, línea de crédito
seleccionados e ingresos por liquidación. El desembolso bruto no se resta otra vez
a la caja que ya incluye borradores guardados. La proyección no es una utilidad,
no incorpora ventas hipotéticas ni inventa una amortización del préstamo.

Los contratos se calculan por lotes de tiendas, excluyendo el ciclo actual y
mostrando la parte que excede los ciclos configurados. La base recurrente de
continuidad (local, personal, canales) se muestra aparte y no se trata como una
obligación irrevocable cuando el catálogo no la define como tal.

## Revisión y confirmación

El botón superior ENVIAR TODO y el botón del resumen abren una ventana de revisión.
Su contenido puede desplazarse mientras los controles inferiores siguen accesibles.
Abrir, cerrar o cancelar no modifica caja ni envíos. La confirmación requiere una
acción explícita y valida las decisiones obligatorias, cantidades, contratos y saldo.
Las advertencias de capacidad e insumos no impiden una decisión arriesgada válida.

El conjunto de gastos y financiamiento se evalúa antes de guardar; no falla por
procesar compras antes que línea de crédito. Un cambio de datos o configuración durante
la revisión exige verificar la versión actualizada. Las escrituras locales intentan
revertirse si alguna falla; no se anuncia un éxito cuando se detecta el error.
Esto no es una transacción distribuida ni una garantía ante cierres del proceso.

## Comprobantes e historial local

Cada envío conserva un desglose con las selecciones, importes, ciclo y fecha.
Un reintento no reemplaza el comprobante ni duplica cargos. El historial anterior
puede consultarse aunque Empresa ya esté bloqueada. El selector muestra solo
ciclos con comprobantes disponibles. La migración de un envío V2 del ciclo actual
utiliza los valores guardados y avisa que su fecha original no está disponible.

Claves nuevas: `SIDE_DECISION_RECEIPTS_<partida/empresa>_<ciclo>`.
No se borran las claves anteriores de decisiones, caja o cantidades de tiendas.
La pantalla identifica los comprobantes como **locales**: el adaptador actual de
Supabase no confirma recepción remota. La vista previa del reporte local incorpora
el resumen enviado; no equivale a seguimiento entre equipos independientes.

## Correcciones asociadas

- Entrada numérica del préstamo: se corrige la referencia al atributo del campo.
- Moldes: el importe del ciclo de compra se mantiene al guardar o enviar de nuevo;
  un molde adquirido en un ciclo anterior no se vuelve a cobrar.
- Personal: la base anterior para indemnización no cambia al guardar de nuevo.
- Tasas docentes de cero se respetan en lugar de sustituirlas por el valor por defecto.
- La consulta del resumen usa un modelo compartido con el guardado, evitando dos
  versiones incompatibles del mismo cálculo.
- Se conserva la sala sin recorte, las cantidades dentro de cada tarjeta de distrito,
  el calendario automático y los iconos docentes de V2.

## Archivos

Nuevos módulos: `decision_review_model.js`, `company_summary.js`, `company_summary.css`.
Integración: `app.js`, `decision_catalog.js`, `index.html`.
Control de versión/caché: `docente.html`, `servidor_local.py` e importaciones.
Pruebas nuevas: `tests/decision_review_model.test.js`, `tests/company_review_checks.py`.
Las pruebas y documentos anteriores permanecen como antecedentes.

Esta entrega se centra en el resumen, la revisión y la conservación local solicitados.
No incorpora un nuevo motor contable completo, autenticación de producción ni
la totalidad de las propuestas conceptuales de la conversación anterior.
