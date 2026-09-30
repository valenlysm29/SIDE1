# Informe financiero y académico del docente

Los botones «Ver PDF» y «Descargar PDF» utilizan `teacher_report_pdf.js`.
El diseño sigue las referencias proporcionadas por el usuario:
`SIDE_Plantilla_Informe_Financiero_Academico.docx` y
`SIDE_Informe_Financiero_Academico_Ejemplo.pdf`.

La exportación conserva el alcance anterior: todas las empresas activas de
la partida y el ciclo reportado de cada empresa. Cada empresa comienza en
una página nueva. No se exporta el historial de ciclos que no esté en el
reporte actual. El ciclo se presenta como actual/total (por ejemplo, 1/6 o
2/6), utilizando el número de ciclos de la configuración de la partida.

El documento A4 contiene identificación, resumen, estado de resultados,
balance de caja, flujo de caja, balance general, eventos y evaluación
académica. Utiliza el logo existente de SIDE, la paleta de la referencia,
tablas con totales resaltados y numeración de páginas. Los eventos continúan
en páginas adicionales con sus encabezados. Los nombres largos se ajustan
a las celdas. La identificación muestra nombre comercial y razón social
(nombre legal) de la empresa. Se omiten estudiante/equipo e institución.
El nombre del proyecto es Proyecto Side y SIDE significa Simulador
Interactivo de Decisiones Empresariales.

Los importes conservan dos decimales. Costos operativos y salidas se
presentan como deducciones entre paréntesis; el signo del impacto de eventos
y de los flujos se conserva. Los datos ausentes muestran «Sin datos» y las
notas ausentes «Sin calificar». La nota cero es válida. No se copian al
informe las instrucciones de integración ni los datos ficticios de la
plantilla.

Los campos opcionales `config.docente` y `reporte.observacionesDocente`
se incluyen únicamente si tienen contenido.
La interfaz actual no registra estos campos. La nota utiliza la misma
resolución de notas guardadas que el panel docente. El avance utiliza los
conteos de decisiones obligatorias del reporte y, como respaldo, su
porcentaje de progreso.

## Validación local

```powershell
node --test tests/teacher_report_pdf.test.js tests/student_financial_summary.test.js tests/teacher_podium.test.js
node tests/teacher_report_pdf_ui.cjs
```

La prueba de interfaz ejecuta la página docente en Chromium con almacenamiento
aislado y jsPDF real. No utiliza cuentas, partidas ni escrituras en Supabase.
Comprueba los botones de descarga y vista previa, las empresas eliminadas,
la liberación de las URL de vista previa, las notas cero, la ausencia de datos,
la lista vacía y el error de carga del generador. Genera también un caso con
nombres largos y 48 eventos.

Se revisaron visualmente todas las páginas de los PDF generados y se verificó
la conservación de los 48 eventos, los importes, las notas y la paginación.
El ejemplo de dos páginas se guarda en
`output/pdf/SIDE_Informe_Formato_Integrado.pdf`; las evidencias adicionales
permanecen en `tests/output/teacher-pdf/`. Ambos destinos son locales e
ignorados por Git. El informe omite la leyenda explicativa sobre moneda,
decimales y paréntesis; el formato de los importes se conserva.
