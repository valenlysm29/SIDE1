# SIDE V3 · Validación de entrega

**Versión:** `2026.09.07.3`. **Fecha:** 07/09/2026.
**Base:** `SIDE_FINAL_CORREGIDO_V2.zip`, conservando el proyecto completo.

## Resultados ejecutados

| Grupo | Resultado | Alcance |
|---|---:|---|
| Pruebas unitarias Node | 22 correctas | 13 nuevas del modelo de resumen y 9 de reglas existentes. |
| Integración Empresa/revisión | 61 comprobaciones correctas | Interacciones reales del código entregado dentro de un DOM Chromium aislado. |
| Regresión de interfaz V2 | 57 comprobaciones correctas | Sala del estudiante, tiendas por distrito, guardado y controles. |
| Servidor Python local | 2 correctas | Recursos HTTP, cabeceras de versión/caché y rechazo de puerto ocupado. |
| Sintaxis JavaScript | 11 archivos correctos | Todos los archivos JavaScript principales de la raíz. |

Las dos suites de navegador finalizaron sin excepciones JavaScript no controladas.
Los resultados y los registros de ejecución están en `tests/evidencias_v3/`.

## Qué comprueba la integración nueva

Se seleccionan segmento, equipos, cantidades, personal, materiales, tiendas y
préstamo mediante los controles de la interfaz. Se verifica el detalle enviado,
la distinción de estados, el total por área y la proyección completa.

Abrir y cancelar la revisión no cambia decisiones, caja ni indicadores de envío.
Confirmar guarda todos los apartados pendientes una sola vez; volver a confirmar
no descuenta nuevamente ni reemplaza comprobantes. El resumen sigue disponible
con Empresa bloqueada y los comprobantes no se recalculan al pasar de ciclo.

La reconstrucción del DOM con el almacenamiento guardado recupera datos y estados.
Se verifica separación de empresas dentro del almacenamiento de prueba, sin que
esto equivalga a controles de acceso de un servidor. Los envíos V2 del ciclo
actual se migran sin inventar fechas. Se comprueban capacidad e insumos como
advertencias, falta de caja como bloqueo, financiamiento conjunto y cambios de
configuración mientras la revisión está abierta.

Una excepción de almacenamiento simulada provoca reversión de caja, entradas y
banderas de envío; el reintento posterior tiene éxito sin duplicación.
No se ha simulado un cierre abrupto del sistema en mitad de la escritura.

## Caso numérico reproducible

Los datos de las capturas corresponden a la empresa ficticia de prueba
**Taller Horizonte**, no a una partida real del usuario.

- Infraestructura: S/ 23,900.
- Producción: S/ 19,024, incluido el descuento de compras del escenario.
- Ventas: S/ 14,200: web y seis tiendas (2 Los Olivos, 1 Miraflores, 3 SJL).
- Inversiones/finanzas: S/ 7,000 de gasto y S/ 10,000 de préstamo.
- Desembolso bruto del ciclo: S/ 64,124.
- Caja ya guardada antes de confirmar finanzas: S/ 42,876.
- Ajuste pendiente: +S/ 3,000. Caja estimada al confirmar: S/ 45,876.
- Rentas de tiendas posteriores al ciclo: S/ 150,700, de las cuales
  S/ 82,200 se sitúan después del sexto ciclo configurado.

La caja confirmada coincide con la proyección revisada. Los compromisos futuros
no se descuentan de inmediato y el préstamo no se clasifica como ventas.

## Tamaños y revisión visual

La revisión se comprueba en 1792×862, 1366×768, 1024×600, 768×600,
390×844, 375×667, 320×568 y 844×390. Se verifica alcance de los controles,
visibilidad por hit-test y ausencia de desbordamiento horizontal de la página.
La suite de regresión conserva sus nueve tamaños para la sala y las tiendas.
Se revisaron visualmente capturas del resumen, detalle de infraestructura,
revisión final y vista móvil. La captura no sustituye la prueba interactiva.

## Entorno y límites

Los navegadores utilizan `tests/browser_fixture.py`: carga el HTML, CSS y
JavaScript entregados en un DOM de Chromium con un doble de Web Storage.
Las peticiones externas se bloquean. La navegación HTTP del navegador está
restringida administrativamente en este entorno; por tanto, estas suites NO
prueban un despliegue HTTP completo en navegador. La suite del servidor usa
HTTP real con el cliente de Python, independientemente de ese aislamiento.

No se han probado Supabase en producción, dos equipos físicos independientes,
permisos de base de datos, un servicio remoto de confirmación, una partida 3D
completa ni cuotas bancarias que el modelo original no define. Los registros
se anuncian como locales; no se afirma entrega al servidor.

El cambio no incorpora todas las propuestas conceptuales de ampliación de SIDE.
Implementa el resumen de Empresa y la revisión solicitados, con historial local
y correcciones asociadas verificadas en los escenarios descritos.

## Reproducir

Desde `final_SIDE1`:

```sh
node --test tests/decision_review_model.test.js tests/side_rules.test.js
python tests/local_server_test.py
python tests/company_review_checks.py
python tests/ui_final_checks.py
```

Las suites de navegador requieren Playwright para Python y Chromium. Se puede
indicar el ejecutable mediante `CHROMIUM_PATH` y la carpeta de resultados con
`SIDE_QA_OUTPUT`. Son dependencias de pruebas, no del lanzador del juego.
Para usar SIDE localmente basta Python 3 y un navegador; el motor 3D mantiene
sus dependencias externas originales.
