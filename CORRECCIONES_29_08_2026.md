# SIDE — Correcciones 29/08/2026

Esta versión mantiene el simulador 3D, el nombre legal/comercial dinámico de cada empresa y las flechas gruesas, e integra las nuevas reglas de la simulación.

## 1. Infraestructura y producción
- **Local de producción**: aparece preseleccionado y marcado como **costo obligatorio**. Existe una sola alternativa de local y no puede desmarcarse.
- **Maquinaria disponible para producción**: antes de fijar la meta de producción se muestra un resumen con:
  - maquinaria que la empresa ya tenía de ciclos anteriores;
  - maquinaria comprada en el ciclo actual.
- Se mantiene únicamente el **mantenimiento correctivo** con monto simbólico de S/ 200 cuando corresponda.
- Se incorpora **Garantía de productos terminados** como decisión obligatoria de cobertura comercial.

## 2. Caja y guardado por pestaña
- La cabecera muestra **SALDO FINAL GUARDADO**.
- El saldo visible no cambia mientras el estudiante prueba alternativas.
- El bloque **GASTADO / MOVIMIENTO DE ESTA PESTAÑA** cambia incrementalmente con las decisiones del borrador.
- La caja se actualiza recién cuando se presiona **GUARDAR DECISIONES**.
- Si el gasto proyectado excede la caja, se bloquea el guardado de la pestaña.

## 3. Obligatoriedad y controles
- **Canales de venta**: obligatorio seleccionar al menos uno y se muestra un aviso visible.
- **Marketing**: decisión obligatoria.
- **Capacitación del equipo**: opcional y puede elegirse “No capacitar este ciclo”.
- **Préstamo**: opcional.
- Las decisiones opcionales **no suman al porcentaje de progreso**.
- Decisiones de una sola alternativa usan **radio button**.
- Decisiones de selección múltiple usan **checkbox**.
- Al llegar al 100% se habilita **ENVIAR DECISIONES**. Solo después se habilita el acceso al simulador 3D.

## 4. Personal comercial
- Cada tienda física incorpora automáticamente **1 vendedor básico**.
- Se registra una **comisión del 1% de la venta** como salida de caja cuando se realiza una venta 3D.
- Este personal ya no es una decisión manual del estudiante.

## 5. Configuración docente
- **Código de partida asignado automáticamente y bloqueado** (campo de solo lectura y visualmente oscurecido).
- Caja inicial configurable con radio button:
  - monto fijo para todos;
  - monto aleatorio, indicando rango mínimo y máximo.
- El capital aleatorio de cada empresa se calcula de manera estable: no cambia al recargar la página.
- Número de ciclos fijo configurado por el docente.
- Duración por ciclo configurada en horas y minutos.
- **Modo manual**: el profesor controla inicio/cierre y se muestra el disclaimer correspondiente.
- **Modo automático**: requiere horario de inicio, avanza por sí solo y muestra su disclaimer.
- El estudiante ve un **timer sincronizado** tanto en su lobby como en el menú de decisiones.

## 6. Financiamiento
- El docente fija únicamente la **TEA inicial**.
- El monto máximo del préstamo se calcula automáticamente como **50% de la caja inicial de la empresa**.
- Se muestra una referencia inicial equivalente al **25% de la caja inicial**.
- La TEA queda bloqueada cuando la partida ya está activa.

## 7. Una sola partida activa
- El panel docente mantiene un único código asignado para la partida activa.
- La interfaz impide iniciar una segunda partida activa distinta.
- El esquema Supabase incluye un **índice único parcial** que impide a nivel de base de datos que un profesor tenga dos partidas con estado `activa` simultáneamente.

## 8. Eventos y noticias
- Banco de **50 eventos configurables**.
- Elegir eventos es opcional para el docente.
- Cada evento muestra:
  - descripción;
  - afectados: grupal o individual;
  - ciclos por afectar;
  - probabilidad de ocurrencia;
  - implicancia en palabras.
- Eventos **grupales** confirmados afectan a todas las empresas.
- Eventos **individuales** se resuelven por empresa según su probabilidad.
- Se genera una sección **Noticias del ciclo** para docente y estudiantes.
- El simulador 3D solo utiliza los eventos oficiales habilitados por el docente; si no se habilitan eventos, no inventa eventos adicionales.

## 9. Resultados del estudiante
El estudiante visualiza resultados disgregados:
- **Estado de resultados**: ingresos, costos, impacto de eventos y utilidad.
- **Balance de caja**: caja inicial, préstamos y caja final.
- **Flujo de caja**: operación, financiamiento, eventos y flujo neto.
- Los eventos activos se muestran en Noticias y su implicancia queda registrada en los resultados.

## 10. Panel docente y seguimiento
- Cada empresa muestra los apartados A–E terminados/incompletos.
- Se visualiza porcentaje de decisiones obligatorias completadas y si las decisiones fueron enviadas.
- Resultados separados en tres tablas:
  1. Estado de resultados.
  2. Balance de caja.
  3. Flujo de caja.
- El detalle de eventos por empresa incluye: **Descripción, Afectados, Ciclos, Implicancia y Ocurrencia**.

## 11. Elementos preservados
- Simulador 3D integral.
- Nombre legal y nombre comercial definidos por el estudiante.
- Nombre comercial reflejado dentro del 3D.
- Flechas SVG gruesas en tutorial, inicio de sesión, navegación y panel docente.
- Optimización gráfica/FPS de la versión previa.


## Banco de eventos Perú — ampliación
- Banco ampliado a 92 eventos contextualizados al Perú.
- Modos de selección docente: Manual y Aleatoria.
- Filtros por búsqueda, categoría y alcance (grupal/individual).
- Tabla desplazable con Descripción, Afectados, Ciclos por afectar, Implicancia y Ocurrencia.
- Se incorpora desplazamiento temporal +0 / +1 / +2 para que el impacto pueda iniciar en el mismo ciclo o en ciclos posteriores.
- Eventos grupales, cuando ocurren, afectan a todas las empresas; los individuales se resuelven por empresa.
- Noticias y reportes muestran el momento de afectación y la implicancia.
