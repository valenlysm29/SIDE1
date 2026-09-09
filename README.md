# SIDE — Simulador empresarial · versión integrada 3D

## Entrega actual: v2026.09.09.6

La entrega del 08/09/2026 incorpora una capa responsive transversal para
telefonos, tablets, portatiles y escritorios, tanto en orientacion vertical
como horizontal. Se adaptaron barras fijas, tutorial, formularios, tablas,
panel docente, resumen de empresa y HUD del simulador 3D; tambien se añadieron
areas seguras, controles tactiles y compatibilidad con movimiento reducido.

La revisión v2026.09.09.6 añade una calculadora productiva independiente para
molde básico, mejorado y premium; presenta los insumos requeridos y una
sugerencia basada en capacidad instalada. Producción y Resumen incorporan un
DOP dinámico único para toda el área productiva: consolida los moldes fabricados,
el cuero ingresa como materia prima principal, el hilo como insumo auxiliar y los
accesorios como materia prima secundaria. El DOP utiliza tres operaciones, una
actividad combinada, una inspección de accesorios y una inspección final;
luego muestra el porcentaje logrado y la producción final. La materia prima
secundaria se representa en un ramal propio que baja desde la izquierda y se une
horizontalmente al símbolo combinado de ensamblado y colocación de accesorios.
Ambas materias primas comienzan alineadas en la misma fila, como en un DOP clásico
desglosada por molde. El pie del DOP presenta la tabla de resumen, la eficiencia
de la línea, la producción mensual y el cumplimiento de la meta. La nueva pestaña
Logística concentra la compra de materias primas y el abastecimiento. La compra de
al menos un molde y la selección de un canal de ventas son obligatorias. El nombre
comercial puede volver a utilizarse para recuperar la partida local. En el primer
ciclo Resumen aparece al final; desde el segundo ciclo aparece primero.

La V4 elimina la decisión de segmento de mercado, compacta el calendario
académico y vincula el resumen con la lógica de producción del juego. Ahora se
muestran meta, capacidad y unidades posibles en corte, ensamblado y acabado,
además de la conversión de compras a materia prima y el costo productivo por
unidad. Comienza por `LEEME_FINAL_V4.txt` y consulta `CAMBIOS_FINAL_V4.md`.

El apartado **Resumen** integra todas las decisiones, filtros de envío,
historial por ciclo y cuatro indicadores financieros. **Enviar todo** abre una
revisión previa; confirmar es una acción separada. Los registros son locales,
no acuses de recibo de Supabase. La estimación es de caja, no de utilidad futura.

Comienza por `LEEME_FINAL_V3.txt`. El alcance y los límites están en
`CAMBIOS_FINAL_V3.md` y `VALIDACION_FINAL_V3.md`. Los apartados siguientes conservan
la documentación histórica del proyecto y de las entregas anteriores.


Esta versión transforma el módulo de decisiones en una experiencia tipo juego con navegación por pestañas y caja visible.

## Acceso demo
- Profesor: `profesor@upch.pe`
- Contraseña: `Heredia`
- Código estudiante: `SIDE-000`
- Cada estudiante registra su propio nombre legal y nombre comercial al ingresar. No existe una empresa predeterminada.

## Pestañas del jugador
1. Primer ciclo: Infraestructura, Producción, Canales y ventas, Finanzas, Resumen.
2. Desde el segundo ciclo: Resumen, Infraestructura, Producción, Canales y ventas, Finanzas.

## Cambios principales
- Login del estudiante únicamente con código.
- Tutorial obligatorio; se eliminó “Saltar tutorial”.
- Flechas del tutorial más gruesas.
- Caja/efectivo visible; capital inicial por defecto S/ 100,000.
- El saldo se proyecta y se actualiza al guardar cada pestaña.
- Efecto visual al descontar o aumentar caja.
- Sin códigos internos ni indicadores visibles de eficiencia/calidad/reputación.
- Títulos y pestañas anclados mientras se hace scroll.
- Cantidades para mesas, maquinaria, personal e insumos.
- Maquinaria adquirida marcada como “Ya tienes”.
- Moldes no se deprecian y quedan bloqueados desde el ciclo siguiente a su compra.
- Mantenimiento preventivo opcional: S/ 200; permite deselección.
- Local de producción movido a Infraestructura.
- Producción reúne personal, compras, materiales y volumen objetivo.
- Analista de compras: S/ 5,000 por ciclo; negocia descuentos decrecientes por ciclo.
- Eliminadas las decisiones de número de proveedores, lead time, política de pago e inventario.
- Canales: web, Los Olivos, Miraflores y San Juan de Lurigancho.
- Cada tienda física incluye un vendedor básico; se mantiene la comisión total del 1% de las ventas simuladas, sin sueldo fijo adicional.
- % de ventas a crédito se muestra como dato automático, no como decisión.
- Garantía de proveedor en 0%, 80% o 100%, sin afectar caja al elegirla.
- Inversiones y Finanzas combinadas.
- Línea de crédito muestra TEA y monto máximo definidos por el docente.
- Eliminada la decisión de depreciación.
- Banco central de rutas de iconos en `icon_bank.js`.

## Panel docente
- Caja inicial por empresa.
- Demanda configurable por distrito.
- TEA inicial por defecto 20% y límite de préstamo.
- % inicial de ventas a crédito.
- Tiempo por ciclo en horas y minutos.
- Cierre manual o automático.
- Botón para cortar el ciclo cuando el cierre es manual.
- Eventos no elegibles: solo banco de posibles eventos y ocurrencia aleatoria.
- Estado de empresa: activo/tomando decisiones o sin actividad reciente.
- Botón “Guardar e iniciar partida”.
- La TEA inicial se define en la configuración docente y se muestra en el apartado de línea de crédito.

## Nota técnica
El proyecto mantiene el modo local con `localStorage` y conserva los puntos de integración con Supabase. Las reglas que dependen de un motor contable completo de ventas/devoluciones se presentan como reglas del juego, mientras que caja, compras, cantidades, préstamo y costos sí se calculan en esta versión.

## Actualización 29/08/2026
La versión actual incorpora obligatoriedad selectiva de decisiones, saldo guardado por pestaña, capital fijo/aleatorio, ciclos manuales/automáticos, timer del estudiante, préstamo porcentual, banco de 50 eventos, noticias, seguimiento docente por apartados y resultados financieros disgregados. Consulta `CORRECCIONES_29_08_2026.md` para el detalle completo.

## Actualización 07/09/2026

Logo del estudiante en primer plano y sin recorte inferior, calendario automático por ciclos, iconos docentes SVG y cantidades de tiendas por distrito con costos, contratos y guardado. Incluye mejoras de borradores, botones y mantenimiento opcional. Consulta `CAMBIOS_07_09_2026.md` para iniciar el proyecto y conocer los cambios, y `VALIDACION_07_09_2026.md` para las pruebas y limitaciones.

## Entrega final v2026.09.07.2

El boton de entrada ahora permanece visible en un pie independiente de los
resultados desplazables. Al marcar una tienda fisica, su cantidad aparece dentro
de la tarjeta del distrito, con campo numerico y botones - / +.

Para abrir esta version, cierra el servidor anterior y ejecuta `INICIAR_JUEGO.bat`
en la carpeta recien extraida. Consulta `LEEME_FINAL_V2.txt`, `CAMBIOS_FINAL_V2.md`
y `VALIDACION_FINAL_V2.md`.
