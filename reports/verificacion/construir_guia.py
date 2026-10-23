"""Guía A4 reproducible desde observaciones originales, sin cambiar SIDE."""
import json, math
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from PIL import Image
import pypdfium2 as pdfium

ROOT=Path(__file__).resolve().parents[2]; OUT=ROOT/'reports/verificacion'; EVID=ROOT/'tests/output/verificacion'
X=json.loads((OUT/'datos_excel.json').read_text(encoding='utf-8-sig'))
S=json.loads((OUT/'datos_side.json').read_text(encoding='utf-8-sig'))
SI={s['id']:s for s in S['escenarios']}
pdfmetrics.registerFont(TTFont('Arial','C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('ArialB','C:/Windows/Fonts/arialbd.ttf'))
W,H=595.276,841.89; M=44; CW=W-2*M
NAVY=HexColor('#142e3f'); TEAL=HexColor('#087e8b'); LIGHT=HexColor('#e9f4f5'); GRAY=HexColor('#526572')
c=canvas.Canvas(str(OUT/'GUIA_VERIFICACION_SIDE_vs_EXCEL.pdf'),pagesize=(W,H))
c.setTitle('Guía de verificación manual SIDE vs Excel'); c.setAuthor('SIDE · Verificación')
pageno=0; y=0; positions=[]

def para(text,size=10,leading=None,color=NAVY,bold=False,gap=8):
    global y
    st=ParagraphStyle('p',fontName='ArialB' if bold else 'Arial',fontSize=size,leading=leading or size*1.38,textColor=color)
    p=Paragraph(text,st); _,hh=p.wrap(CW,760)
    if y-hh<47: raise RuntimeError(f'Desborde página {pageno}: {text[:90]}')
    p.drawOn(c,M,y-hh);y-=hh+gap

def page(title,kicker='VERIFICACIÓN MANUAL'):
    global pageno,y
    if pageno:c.showPage()
    pageno+=1;y=H-48
    c.setFillColor(TEAL);c.setFont('ArialB',8);c.drawString(M,y,kicker);y-=30
    para(title,21,25,bold=True,gap=16)
    c.setStrokeColor(HexColor('#d3dfe4'));c.line(M,36,W-M,36)
    c.setFont('Arial',8);c.setFillColor(GRAY);c.drawString(M,23,'SIDE vs DECISIONES_SIDE_16.xlsx · 23 octubre 2026')
    c.drawRightString(W-M,23,str(pageno));positions.append({'pagina':pageno,'titulo':title})

def table(rows,widths=None,size=9):
    global y
    widths=widths or [CW/len(rows[0])]*len(rows[0])
    style=ParagraphStyle('cell',fontName='Arial',fontSize=size,leading=size*1.25,textColor=NAVY)
    head=ParagraphStyle('head',parent=style,fontName='ArialB',textColor=white)
    rr=[[Paragraph(escape(str(v)).replace('\n','<br/>'),head if i==0 else style) for v in row] for i,row in enumerate(rows)]
    t=Table(rr,colWidths=widths,hAlign='LEFT');t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),TEAL),('ROWBACKGROUNDS',(0,1),(-1,-1),[white,LIGHT]),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6),('LINEBELOW',(0,-1),(-1,-1),.5,TEAL)]))
    _,hh=t.wrap(CW,760)
    if y-hh<47:raise RuntimeError(f'Tabla desborda {pageno}, y={y},h={hh}')
    t.drawOn(c,M,y-hh);y-=hh+12

def callout(text):
    global y
    st=ParagraphStyle('box',fontName='Arial',fontSize=9,leading=12,textColor=NAVY)
    p=Paragraph(text,st);_,hh=p.wrap(CW-20,600)
    c.setFillColor(HexColor('#fff2c6'));c.roundRect(M,y-hh-18,CW,hh+16,5,fill=1,stroke=0)
    p.drawOn(c,M+10,y-hh-9);y-=hh+28

def shot(path,caption,maxh=295):
    global y
    path=ROOT/path
    if not path.exists():para('Captura individual no disponible. '+caption,9,color=GRAY);return
    im=Image.open(path);iw,ih=im.size
    scale=min(CW/iw,maxh/ih);dw,dh=iw*scale,ih*scale
    if y-dh<65:raise RuntimeError(f'Captura desborda {pageno}')
    c.drawImage(ImageReader(im),M,y-dh,width=dw,height=dh)
    y-=dh+7;para(caption,8,10,color=GRAY,gap=8)

def fmt(v):
    if v is None:return 'Sin celda equivalente'
    if isinstance(v,(int,float)):return f'{v:,.6f}'.rstrip('0').rstrip('.')
    return str(v)

page('Comprueba SIDE con tu Excel','GUÍA DE TRABAJO · A4')
para('Una prueba que puedes repetir a mano',18,bold=True,gap=24)
para('15 escenarios para contrastar cantidades, materiales, componentes de costo, consecuencias y puntajes. Cada esperado conserva su vínculo con el archivo real, leído con fórmulas y recalculado en Microsoft Excel.',13,19)
para('Archivos de trabajo',12,bold=True)
table([['Archivo','Para qué sirve'],['DECISIONES_SIDE_16.xlsx','Fuente original. Guarda una copia antes de cambiar entradas.'],['COMPARATIVO_SIDE_vs_EXCEL.xlsx','Anota lo observado; las fórmulas calculan diferencias y estados.'],['RESUMEN_VERIFICACION.md','Resultados automáticos, alcance, límites y pruebas realizadas.']],[220,CW-220])
callout('Una coincidencia solo vale para la celda y las entradas del caso. El Excel original no ofrece una caja inicial ni una caja final integrada por ciclo. Por eso, la caja completa se documenta por separado como NO COMPARABLE.')
para('Conserva junto al registro el código de partida, el ciclo, las entradas y las capturas. Esta guía no requiere ejecutar SQL ni cambiar Supabase.',11)

page('Índice y recorrido')
table([['Sección','Página'],['Preparar Excel y reconocer las celdas','3'],['Preparar partida y ubicar las pantallas','4'],['E01–E09 · Cantidades y DOP','5–13'],['E10–E11 · Componentes del costo','14–15'],['E12 · Caja insuficiente','16'],['E13 · Puntajes de tres lotes','17'],['E14–E15 · Consecuencias','18–19'],['Caja y costos al iniciar el ciclo','20'],['Cerrar ciclo y comprobar resultados','21'],['Construir y ampliar el comparativo','22–23'],['Si algo no cuadra','24'],['Registro imprimible','25'],['Equivalencias y alcance de la evidencia','26'],['Anexo visual · DOP y stock','27']],[CW-75,75])
para('Cómo usar cada caso',12,bold=True)
para('Primero copia las entradas en Excel; después repítelas en SIDE. Consulta las celdas indicadas sin sustituir sus fórmulas. Registra Esperado y Obtenido en la misma unidad. Compara el plan antes de confundirlo con la producción que realmente alcanzaste.')
callout('Redondeo: la tolerancia absoluta está en Resumen!B4 = 0.01. El estado es OK si el valor absoluto de Obtenido menos Esperado no supera 0.01. Conserva todos los decimales disponibles; la pantalla puede mostrar menos.')

page('1 · Prepara el Excel')
for t in ['1. Abre DECISIONES_SIDE_16.xlsx y usa Archivo > Guardar como. Trabaja sobre una copia local con un nombre como VERIFICACION_COPIA.xlsx. Conserva el original intacto.','2. Activa Fórmulas > Opciones de cálculo > Automático. Después de introducir cantidades, usa Fórmulas > Calcular ahora.','3. Escribe una dirección como D37 en el cuadro de nombres, a la izquierda de la barra de fórmulas, para ir directamente a ella. La barra permite distinguir un número de una fórmula que empieza por =.','4. Usa Fórmulas > Mostrar fórmulas para revisar cómo se calcula un resultado; desactívalo para volver a ver valores. Selecciona una celda de resultado y pulsa Fórmulas > Rastrear precedentes para ver de qué celdas depende.','5. Cambia únicamente entradas de tu copia. No reemplaces resultados ni fórmulas, aunque veas un error. Guarda una copia por escenario para evitar arrastrar cambios.']:para(t)
table([['Hoja','Entradas que puedes localizar','Resultado a consultar'],['CANTIDAD DE PRODUCCIÓN','D37:D39: cantidades por molde','D36 total; D42:L44 materiales'],['Costos De Producción','D31:K31 compras; D54:D61 inventario; D46:E48 cantidades del ejemplo','U11:AD11 componentes laborales; AC33 local; W76 cuero'],['Seleccion_Ciclo0','B2:B15 códigos de decisión','C:K resultados derivados'],['Lotes_Produccion','B2:G4: segmento, cantidad, materiales y molde','H2:H4 costo; I2:I4 calidad'],['Motor_Puntajes','No tiene entrada directa para estos casos','B6, B9, B10, B11'],['Matriz_Consecuencias','Sin celdas de entrada ni fórmulas','C2:D9 condiciones y efectos escritos']],[142,183,CW-325],8.5)
callout('En cantidad cero, el original conserva #DIV/0! en ciertas celdas de reparto. No lo conviertas en cero: aquí se comparan las necesidades de material, que sí valen cero. La matriz de consecuencias contiene reglas escritas, no fórmulas.')

page('2 · Prepara una partida de prueba')
para('Usa un entorno de prueba y una empresa separada. Las capturas de esta entrega proceden de una partida local de prueba; no se ha modificado Supabase.')
for t in ['1. Entra como Profesor, inicia sesión y abre Configuración. Escribe un nombre identificable para la simulación. En Caja / efectivo elige Monto fijo para todos y fija Dinero inicial por empresa (S/).','2. Usa Iniciar partida. El sistema asigna el código SIDE-XXXX; copia el código real, no escribas literalmente XXXX. Espera a que comience el ciclo según el tiempo de integración.','3. En otra sesión entra como Estudiante > Entrar a una partida. Introduce Código de partida, Nombre de tu empresa y Nombre comercial. Usa una empresa reservada para la prueba.','4. Al aparecer Costos descontados al iniciar el ciclo, anota cada importe, caja antes y caja después; luego pulsa Entendido.','5. Abre Decisiones. La pantalla actual tiene Infraestructura, Producción, Logística, Ventas, Finanzas y Resumen. Empresa se identifica al entrar y en el resumen de la empresa; no hay una pestaña Empresa independiente.']:para(t)
callout('No hay caja inicial equivalente en el Excel original. Para un control manual, escribe tu saldo de partida en una celda auxiliar de tu copia, sin tocar fórmulas. Las capturas usan S/ 100,000; las pruebas aisladas del cálculo usan S/ 1,000,000 como disponibilidad. No son una comparación de saldos: las necesidades por cantidad no dependen de esa caja.')
para('Antes de cada escenario',12,bold=True)
para('Anota ciclo, inventario, régimen laboral y decisiones previas. Para comparar faltantes, obtén inventario real mediante compras en una partida separada y registra los desembolsos. No escribas datos directamente en Supabase. Para evaluar solo necesidades, basta cambiar la meta de producción.')

for sc in X['escenarios']:
    sid=sc['id'];n=int(sid[1:]);page(f'{sid} · {sc["titulo"]}','ESCENARIO REPRODUCIBLE / ALCANCE DECLARADO')
    obs={m['key']:m.get('obtenido') for m in SI.get(sid,{}).get('mediciones',[])}
    if n<=9:
        q=sc['side']['quantities'];para(f'En Decisiones > Producción, selecciona cada opción de Molde a calcular y escribe Cantidad deseada con este molde: básico {q[0]}, mejorado {q[1]}, premium {q[2]}. Cambia de molde para conservar y revisar las tres metas.',10)
        para('En Excel: CANTIDAD DE PRODUCCIÓN, D37 = '+str(q[0])+', D38 = '+str(q[1])+', D39 = '+str(q[2])+'. Consulta D36 y las celdas de la tabla. Mira en SIDE el recuadro Insumos para… y el DOP debajo.',9)
        mm={m['key']:m for m in sc['mediciones']}
        rows=[['Resultado / unidad','Celda Excel','Esperado','SIDE']]
        for keys,label in [(['D36'],'Total / unidades'),(['D42','E43','F44'],'Cuero / m² (básico; mejorado; premium)'),(['G42','H43','I44'],'Accesorios / unidades'),(['J42','K43','L44'],'Hilo / m')]:
            rows.append([label,'; '.join(keys),'; '.join(fmt(mm[k]['esperado']) for k in keys),'; '.join(fmt(obs.get(k)) for k in keys)])
        table(rows,[177,95,115,CW-387],8.5)
        if n==1:para('Cantidad cero: compara materiales; los errores de reparto del original se registran aparte.',9)
        if n in (4,5,6):para('396 es la capacidad del ejemplo, no un máximo global del Excel. Estas metas comprueban requerimientos, no prometen que puedas fabricar esa cantidad.',9)
        if n==8:para('Repite E03 con inventario disponible. En Excel cambia Costos De Producción!D54, D57 y D59 a 10000. Los requerimientos deben permanecer iguales; solo el faltante puede disminuir. En SIDE este inventario fue preparado en la partida local de prueba.',9)
        shot(Path(f'tests/output/verificacion/{sid}-produccion.png'),'Captura del caso: campos Cantidad deseada y Molde a calcular marcados. Los valores de caja corresponden a la partida local.',290)
    elif n in (10,11):
        regime='MYPE' if n==10 else 'NO MYPE'
        para(f'Compara los componentes para régimen {regime}, nivel 1 en corte, ensamble y acabado. Localiza los trabajadores en Producción y el local en Infraestructura. Usa la misma duración para cualquier cuenta por ciclo: un costo mensual no es un costo total del ciclo.')
        rows=[['Componente','Excel · celda','Esperado S/','SIDE S/']]
        for m in sc['mediciones']:rows.append([m['nombre'],m['celda'],fmt(m['esperado']),fmt(obs.get(m['key']))])
        table(rows,[200,70,117,CW-387],9)
        para('Abre Costos De Producción y consulta las celdas de la tabla. No cambies fórmulas: el propio archivo ya contiene columnas separadas para cada régimen. El precio neto del cuero se consulta en W76; no lo confundas con el desembolso de comprar una presentación completa.',10)
        callout('La comparación numérica de estos componentes procede del cálculo interno probado. La interfaz puede mostrar un total por ciclo y no el importe mensual individual. Si tu pantalla no ofrece el detalle o el régimen indicado, registra esa limitación y no copies un total como si fuera salario mensual.')
        p=Path(f'tests/output/verificacion/{sid}-editor.png')
        shot(p,'Componente del editor de decisiones en navegador local. Campo de cantidad marcado; no acredita por sí solo una partida completa.',210)
    elif n==12:
        para('En una partida de prueba nueva, el profesor fija Dinero inicial por empresa (S/) = 0. Entra con otra empresa y registra el aviso de costos iniciales. Después, en Producción, escribe meta 10 de molde básico. Anota caja antes de cualquier compra.')
        table([['Control','Esperado del Excel','Observado en prueba local'],['Caja al preparar meta con capital cero','No existe celda equivalente',fmt(obs.get('caja_final'))+' S/'],['Estado de comparación','NO COMPARABLE','No equivale a una prueba de compra rechazada']],[175,165,CW-340])
        para('Para revisar caja insuficiente a mano, intenta una compra cuyo importe supere la caja y registra el mensaje y el saldo antes/después. Este paso es una comprobación adicional del juego; el Excel original no permite declarar un esperado de caja final. La evidencia entregada solo preparó la meta sin comprar ni confirmar.',10)
        shot(Path('tests/output/verificacion/E12-caja-cero.png'),'Partida local de capital cero: caja y aviso de costos iniciales. No prueba el rechazo de una compra.',300)
    elif n==13:
        para('En la copia Excel, introduce los códigos exactos de Seleccion_Ciclo0!B2:B15 que aparecen en Fuentes originales del comparativo. En Lotes_Produccion!B2:G4 reproduce los tres lotes siguientes; deja las fórmulas H:I intactas.',10)
        para('B2:B11, en orden: '+', '.join(sc['side']['seleccion'])+'. Deja B12:B15 vacías. En SIDE usa la selección vigente, sin garantía ni mantenimiento adicional; precio por bolso 250 en cada lote.',8.5)
        rows=[['Fila','Segmento; cantidad','Cuero; accesorio; hilo; molde']]
        for row in range(2,5):
            e=sc['entradas_excel']['Lotes_Produccion'];rows.append([row,f'{e["B"+str(row)]}; {e["C"+str(row)]}','; '.join(str(e[k+str(row)]) for k in 'DEFG')])
        table(rows,[38,131,CW-169],8.5)
        rows=[['Resultado','Celda Excel','Esperado','SIDE']]
        for m in sc['mediciones']:rows.append([m['nombre'],m['celda'],fmt(m['esperado']),fmt(obs.get(m['key']))])
        table(rows,[190,85,116,CW-391],8.5)
        callout('E13 usa la selección vigente guardada por el editor local y después recalculada en el Excel. Una selección histórica con decisiones retiradas no es equivalente. Los resultados documentados son de componentes aislados; no acreditan una partida completa de esos lotes.')
        shot(Path('tests/output/verificacion/E13-editor.png'),'Editor local del lote: campo marcado. La comprobación de puntajes es aislada; no una partida completa de ese lote.',140)
    else:
        low=n==14;quality=sc['side']['calidad']
        para(f'Consulta Matriz_Consecuencias!C{2 if low else 3}:D{2 if low else 3}. Caso de segmento premium con calidad {quality}. La calidad se obtiene de los materiales y el molde; no es un campo que debas escribir ni una fórmula que debas sustituir.',10)
        rows=[['Resultado de regla','Origen Excel','Esperado','SIDE']]
        for m in sc['mediciones']:rows.append([m['nombre'],f'{m["hoja"]}!{m["celda"]}',fmt(m['esperado']),fmt(obs.get(m['key']))])
        table(rows,[158,160,92,CW-410],9)
        para('En el editor de lotes busca Lote 1: Segmento = Premium y Cantidad a producir = 10. Elige materiales y molde que produzcan la calidad indicada. Conserva los demás datos de referencia del caso: eficiencia, reputación y salud financiera en 7. Son condiciones de la prueba aislada, no campos editables de la pantalla.',10)
        if low and quality==4:para('Frontera de calidad 4: cuero INS-01, accesorios INS-04, hilo INS-06 y molde INF-08. La condición de castigo del Excel exige calidad menor que 4; no se cumple en esta frontera. No hay castigo de esa regla.',9)
        if low:para('En Excel: Lotes_Produccion!B2=SEG-03; C2=10; D2=INS-01; E2=INS-04; F2=INS-06; G2=INF-08; C3=C4=0. Consulta Motor_Puntajes!B6 para comprobar calidad 4 sin editar su fórmula.',9)
        else:para('Para calidad 12 usa el lote premium de E13: cuero INS-03, accesorios INS-05, hilo INS-08 y molde INF-10. En tu copia Excel deja solo ese lote con cantidad 10 (C3=C4=0) y consulta Motor_Puntajes!B6; lee el premio escrito en Matriz_Consecuencias!D3.',9)
        para('Al cerrar el ciclo, revisa consecuencias, precio de venta y cambio de reputación en resultados. Separa el efecto de esta regla de eventos u otras decisiones. La fila del Excel es texto: el factor se obtiene interpretando el porcentaje escrito, no de una fórmula oculta.',10)
        callout('Alcance: prueba aislada del cálculo de consecuencias, con estado controlado. La captura de un resultado general de ciclo no sustituye evidencia de esta misma combinación. Consulta RESUMEN_VERIFICACION.md para saber qué se logró probar desde el navegador.')
        shot(Path(f'tests/output/verificacion/{sid}-editor.png'),'Editor local de Lote 1 con campo de cantidad marcado. Evidencia de componente; no equivale al cierre de una partida completa.',210)
    callout('Tolerancia del caso: |Obtenido − Esperado| ≤ 0.01 (Resumen!B4). Si no existe esperado del Excel, usa NO COMPARABLE. Anota unidad, entradas y captura; no redondees antes de calcular la diferencia.')

page('3 · Caja y costos al inicio del ciclo')
para('Lleva un registro cronológico: caja antes, decisión, desembolso, caja después. Revisar una calculadora de cantidades no realiza una compra. Un borrador y una decisión enviada pueden reflejar momentos distintos: anota cuál observas.')
table([['Momento','Qué anotar'],['Al comenzar el ciclo','Cada línea de Costos descontados al iniciar el ciclo, Total descontado, caja antes y caja después.'],['Antes y después de una decisión','Pestaña, opción, cantidad, precio de presentación, importe descontado y estado guardado/enviado.'],['Al cerrar el ciclo','Saldo, cobros, pagos y demás movimientos. Evita contar dos veces un costo ya cobrado al inicio.']],[132,CW-132])
para('Control aritmético: caja después = caja antes − pagos + cobros. Para un descuento individual sin otros movimientos: caja antes − caja después = importe cobrado. Comprueba también que cerrar Entendido y volver a abrir el aviso no cobre otra vez.',10)
shot(Path('tests/output/verificacion/inicio-costos-fijos.png'),'Evidencia del aviso al inicio: importa el detalle, no solo el saldo final. Esta captura pertenece a la prueba local.',290)
callout('El Excel respalda componentes como el local, pero no una conciliación completa de caja por ciclo. No presentes como igualdad contra Excel un total compuesto que el archivo no calcula.')

page('4 · Cierra el ciclo y revisa resultados')
for t in ['1. Conserva capturas del plan y del resumen antes del envío. Usa ENVIAR TODO o el envío de cada sección cuando hayas terminado; confirma el ciclo y empresa.','2. En el panel del profesor, usa el control Pasar al siguiente ciclo cuando corresponda. Registra si hubo eventos o noticias que puedan cambiar los resultados.','3. Consulta los resultados de la empresa: producción obtenida, estado de resultados, flujo de caja y resumen. Compara cada cantidad con su celda de origen y su unidad.','4. Para puntajes, consulta Motor_Puntajes!B6, B9, B10 y B11 con las entradas exactas de E13. Para consecuencias, lee condición y efecto de Matriz_Consecuencias. Una consecuencia puede cambiar precio o reputación sin cambiar la meta del DOP.','5. Separa meta deseada, capacidad disponible y producción real. El plan calcula qué necesitas para lo solicitado; los faltantes o restricciones aparecen después.']:para(t)
shot(Path('tests/output/logica_excel/sim-1-resultado-1.png'),'Ejemplo real de resultado de SIM-1. Es apoyo para ubicar la pantalla; no evidencia individual de E13, E14 o E15.',280)
callout('Los puntajes y efectos aislados pueden coincidir con el Excel aunque el ciclo completo incluya otros cobros, ventas, eventos y restricciones. Conserva el contexto para interpretar la comparación.')

page('5 · Construye tu propio comparativo')
para('1. Crea un libro nuevo y las hojas Resumen, DOP por cantidad, costo de producción, caja, consecuencias y puntajes. Añade Fuentes originales para conservar celda, fórmula, entradas y valor que viste en el archivo fuente.')
para('2. En Resumen escribe Tolerancia absoluta en A4 y 0.01 en B4 (o 0,01 según tu configuración). En cada hoja de tema usa estos encabezados en la fila 7:')
table([['Columna','Contenido'],['A / B','Caso / Resultado y unidad'],['C / D','Entradas concretas SIDE / Fuente Excel (hoja y celda)'],['E / F','Esperado (Excel) / Obtenido (SIDE)'],['G / H / I','Diferencia / % diferencia / Estado'],['J','Fuente SIDE, pantalla y captura']],[100,CW-100])
para('3. Copia E8 desde la celda recalculada del original. Anota la fórmula original como texto y las entradas en Fuentes originales. Escribe en F8 lo que realmente observaste en SIDE. Nunca calcules Esperado a partir de SIDE.')
para('4. Escribe fórmulas reales y arrástralas hacia abajo. Las expresiones siguientes corresponden a Excel en español con separador ;. El archivo entregado almacena las mismas funciones en el formato interno que Excel interpreta automáticamente.',10)
table([['Celda','Fórmula'],['G8','=SI(ESNUMERO(F8);F8-E8;"")'],['H8','=SI(ESNUMERO(F8);SI(E8=0;SI(F8=0;0;"N/A");G8/ABS(E8));"")'],['I8','=SI(ESNUMERO(F8);SI(ABS(G8)<=Resumen!$B$4;"OK";"DIFERENCIA");"PENDIENTE")']],[50,CW-50],9)
callout('Cuando Esperado = 0 y Obtenido ≠ 0, el porcentaje no está definido: N/A. La diferencia absoluta sigue siendo válida. Sin esperado del Excel: NO COMPARABLE, sin fórmula de diferencia numérica.')

page('6 · Colores, resumen y casos nuevos')
para('5. Da formato numérico a Esperado, Obtenido y Diferencia; aplica porcentaje a H. Muestra suficientes decimales para revisar resultados como el costo NO MYPE. El formato visual no debe alterar los valores guardados.')
para('6. Selecciona A8:J100 o el rango real. En Inicio > Formato condicional > Nueva regla > Utilice una fórmula, añade las reglas siguientes:')
table([['Regla','Relleno'],['=$I8="OK"','Verde'],['=$I8="DIFERENCIA"','Rojo'],['=$I8="PENDIENTE"','Amarillo'],['=$I8="NO COMPARABLE"','Gris']],[CW-110,110])
para('7. En Resumen crea una fila por tema. Por ejemplo, para las filas 8 a 100 de DOP por cantidad:')
table([['Conteo','Fórmula de ejemplo'],['Total','=CONTARA(\'DOP por cantidad\'!A8:A100)'],['Coinciden','=CONTAR.SI(\'DOP por cantidad\'!I8:I100;"OK")'],['No coinciden','=CONTAR.SI(\'DOP por cantidad\'!I8:I100;"DIFERENCIA")'],['Pendientes / sin equivalente','Misma fórmula, sustituyendo el texto por PENDIENTE o NO COMPARABLE.']],[130,CW-130],9)
para('8. Suma cada columna para el total. Divide OK entre OK + DIFERENCIA para el porcentaje de coincidencia sobre resultados comparables. No cuentes NO COMPARABLE como fallo ni como coincidencia.')
para('9. Para un caso nuevo, duplica una fila del tema y cambia identificador, entradas y fuente. Recalcula primero la copia Excel. Amplía los rangos de resumen, filtros y formato condicional. Guarda el archivo junto a la captura y anota la versión de SIDE.')
callout('El libro entregado usa una fila por resultado, no una fila por escenario. Por eso, total de resultados y total de escenarios son conteos distintos. Fuentes originales conserva la trazabilidad de cada fila.')

page('7 · Si algo no cuadra')
for t in ['1. Descarta un error de captura: mismo molde, cantidad, unidad, régimen, nivel laboral, inventario, ciclo y empresa. Vuelve a escribir la entrada en la copia Excel y recalcula. Comprueba que no sobrescribiste una fórmula.','2. Revisa el redondeo: mira la barra de fórmulas, aumenta decimales y conserva precisión completa en E y F. Aplica 0.01 como tolerancia absoluta, no como porcentaje.','3. Busca un patrón: si la diferencia es casi constante al probar varias cantidades, revisa costos fijos o cargos ya descontados. Si crece con la cantidad, revisa unidades, precio unitario, material, porcentaje o presentación de compra. Estos patrones orientan la revisión; no demuestran la causa.','4. Separa el plan de lo realizado: el DOP para la meta no debe cambiar porque varíe el stock. El faltante y la producción factible sí pueden cambiar. Compara el mismo momento del proceso.','5. En consecuencias, revisa la condición exacta: calidad, segmento, eficiencia y demás factores. En puntajes confirma los códigos de decisión y los tres lotes. No sumes efectos de ciclos distintos.']:para(t)
table([['Dato que debes reportar','Qué incluir'],['Caso y contexto','ID, partida SIDE-XXXX, empresa, ciclo, fecha y versión.'],['Esperado','Archivo fuente, hoja, celda, entradas y fórmula visible.'],['Obtenido','Valor, unidad, pantalla y momento guardado/enviado/cerrado.'],['Diferencia','Obtenido − Esperado, porcentaje si corresponde y tolerancia.'],['Evidencia','Captura completa y campo marcado; copia Excel del caso.']],[145,CW-145])
callout('No cambies reglas del juego ni fórmulas para obtener un OK. Conserva la diferencia y consulta el resumen técnico. Un campo que la pantalla no ofrece debe declararse no disponible; no reemplazarlo por otro parecido.')

page('8 · Hoja de registro imprimible')
para('Partida SIDE-________   Empresa ___________________________<br/>Ciclo ______   Fecha __________   Versión SIDE ______________<br/>Archivo Excel / copia ______________________________________',11,19)
table([['Caso','Entrada / celda fuente','Esperado','Obtenido','Diferencia','Estado']]+[[f'E{i:02}', '\n', '', '', '', ''] for i in range(1,16)],[40,177,73,73,75,CW-438],8.5)
para('Tolerancia usada __________   Capturas guardadas en __________________<br/>Inventario / caja antes _____________________________________________<br/>Costos iniciales / decisiones previas _________________________________<br/>Observaciones ___________________________________________________<br/>________________________________________________________________',10,19)

page('Anexo · Equivalencias y evidencia')
table([['En Excel','En SIDE / cómo reconocerlo'],['D37 / D38 / D39','Producción > Cantidad deseada con este molde: Molde básico / mejorado / premium.'],['D36 / D42:L44','Meta total / Insumos para… y requerimientos del DOP.'],['Inventario D54:D61','Stock disponible; influye en el faltante, después de calcular la meta.'],['Molde 1 / 2 / 3','Molde básico / mejorado / premium.'],['Costos De Producción','Componentes laborales y de compras; los totales en pantalla pueden tener otra duración.'],['Seleccion_Ciclo0 / Lotes_Produccion','Decisiones y composición de lotes del catálogo; no todos los códigos tienen campo visible.'],['Motor_Puntajes','Puntajes internos de calidad, eficiencia, reputación y salud financiera; distinguir de la nota docente.'],['Matriz_Consecuencias','Efectos de condiciones al cerrar el ciclo; reglas escritas del Excel.'],['Empresa','Nombre legal y comercial al entrar; resumen de empresa. No hay pestaña Empresa independiente.'],['Infraestructura / Producción / Ventas / Finanzas','Pestañas actuales del mismo nombre; además existen Logística y Resumen.']],[161,CW-161],9)
para('Cómo interpretar la evidencia',12,bold=True)
para('Los valores de esta guía se leen de datos_excel.json y datos_side.json. Los esperados proceden del original recalculado en Excel, no del código del juego. Las capturas de E01–E09 ubican los campos y sus necesidades. Las capturas de SIM documentan resultados de ciclo propios; no acreditan por sí solas las combinaciones de E13–E15.',9)
para('La guía conserva límites: errores originales, caja sin celda equivalente, ausencia de máximo global y valores aislados que no tienen campo editable. RESUMEN_VERIFICACION.md enumera el resultado de las pruebas y cualquier parte aún no cubierta.',9)
callout('No debes ejecutar nada en Supabase para usar estos tres archivos. Repite las comprobaciones en tu copia Excel y en una partida de prueba.')
page('Anexo visual · DOP y stock')
para('E03 y E08 solicitan la misma cantidad: diez bolsos básicos. Revisa las dos capturas del bloque de necesidades. Los requerimientos brutos son iguales; la disponibilidad se compara después.',10)
shot(Path('tests/output/verificacion/E03-necesidades.png'),'E03: cantidad 10, inventario cero. Necesidades calculadas desde la meta.',255)
shot(Path('tests/output/verificacion/E08-necesidades.png'),'E08: misma cantidad, inventario preparado en la prueba local. Conserva los requerimientos; cambia el faltante.',255)
callout('No confundas requerimiento bruto con compra pendiente. El Excel respalda los materiales por cantidad; la sugerencia inversa de recursos y la transición de caja completa tienen el alcance señalado en el resumen.')
c.save()
render=EVID/'pdf';render.mkdir(parents=True,exist_ok=True)
doc=pdfium.PdfDocument(str(OUT/'GUIA_VERIFICACION_SIDE_vs_EXCEL.pdf'))
for i in range(len(doc)):
    p=doc[i];im=p.render(scale=1.25).to_pil();im.save(render/f'pagina-{i+1:02}.png')
    txt=p.get_textpage().get_text_range()
    if len(txt)<90:raise RuntimeError(f'Página vacía {i+1}')
(render/'indice_paginas.json').write_text(json.dumps(positions,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'paginas':len(doc),'archivo':'reports/verificacion/GUIA_VERIFICACION_SIDE_vs_EXCEL.pdf','render':str(render)},ensure_ascii=False))
