import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {FileBlob,SpreadsheetFile} from '@oai/artifact-tool';
const src=JSON.parse(await fs.readFile('source.json','utf8'));
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load('normalized_source.xlsx'));
const s=wb.worksheets.getItem(src.sheet);
// Preserve source formatting while removing imported shared-formula metadata.
// Recreate the target's exact contents, then apply the authorized corrections.
s.getRange('A1:O162').clear({applyTo:'contents'});
for(const [cell,c] of Object.entries(src.cells))if(c.type!=='f')s.getRange(cell).values=[[c.value]];
for(const [cell,c] of Object.entries(src.cells))if(c.type==='f')s.getRange(cell).formulas=[[c.value]];
const changes={};
function value(a,v,why=''){s.getRange(a).clear({applyTo:'contents'});s.getRange(a).values=[[v]];if(src.cells[a])changes[a]={kind:'Valor / etiqueta',old:src.cells[a].value,new:v,why};}
function formula(a,f,why=''){s.getRange(a).formulas=[[f]];if(src.cells[a])changes[a]={kind:'Fórmula',old:src.cells[a].value,new:f,why};}
const f=(a,x,w)=>formula(a,'='+x,w);
const num='#,##0;(#,##0);"-"';
const pct='0.0%;(0.0%);"-"';
const blue='#0000FF', dark='#183D48';
s.getRange('P2:W74').format.font={name:'Arial',size:10,color:'#222222'};
s.getRange('P2:P74').format.columnWidth=39;
s.getRange('Q2:R74').format.columnWidth=17;
s.getRange('S2:S74').format.columnWidth=43;
s.getRange('T2:W74').format.columnWidth=17;
s.getRange('P2:W74').format.rowHeight=23;
value('P2','Capacidad y producción del ciclo');
s.getRange('P2').format.font={bold:true,size:14};
for(const [r,l,x] of [[4,'Corte (bolsos/día)','I8'],[5,'Ensamblado (bolsos/día)','I14'],[6,'Acabado (bolsos/día)','I20'],[7,'Eficiencia aplicada','M5'],[8,'Capacidad MO (bolsos/ciclo)','N5'],[9,'Capacidad MP (bolsos/ciclo)','SUM(P37:P39)'],[10,'Plan solicitado (bolsos)','D36'],[11,'Producción factible (bolsos)','SUM(E56:E58)'],[12,'Plan pendiente (bolsos)','MAX(0,Q10-Q11)'],[13,'Uso de capacidad MO','IF(Q8=0,0,Q11/Q8)'],[14,'Ventas factibles, Empresa A','SUM(W37:W39)'],[15,'Reputación próxima (0–10)','G75'],[16,'Mejora vs. resultado original','IF(Q18=0,0,Q11/Q18-1)']]){value('P'+r,l);f('Q'+r,x);}
value('P18','Producción original guardada');value('Q18',365);
value('P19','Comparación con el archivo recibido');
value('S2','Supuestos y controles');s.getRange('S2').format.font={bold:true,size:14};
const inputs=[[4,'Días productivos por ciclo',24],[5,'Bono máximo por proporción N3',0.06],[6,'Bono por jefatura (máximo 1)',0.04],[7,'Reputación previa, Empresa A',7],[8,'Presupuesto publicitario de referencia',10000],[9,'Calidad N1 (0–100)',100/3],[10,'Calidad N2 (0–100)',200/3],[11,'Calidad N3 (0–100)',100],[12,'Peso de cumplimiento del plan',0.25],[13,'Peso de personal experto',0.25],[14,'Peso de calidad de MP',0.25],[15,'Peso de publicidad',0.25]];
for(const [r,l,v] of inputs){value('S'+r,l);value('T'+r,v);s.getRange('T'+r).format.font.color=blue;s.getRange('T'+r).format.fill='#FFF2CC';}
value('S17','Empresa A representa al jugador.');
value('S18','Competidores: calidad supuesta de 50/100.');
value('S19','Los puntajes son reglas propuestas sin calibrar.');
value('S20','Reputación previa mueve la demanda actual.');
value('P22','Unidades y alcance');s.getRange('P22').format.font.bold=true;
const notes=[
'Inventarios y compras: unidades de producción.',
'Cuero en m², accesorios en juegos e hilo en m.',
'Supuesto: compras E63:E71 ya convertidas.',
'Un juego de accesorios equivale a un bolso.',
'Sin merma adicional ni inventario de bolsos.',
'Cada nivel usa su receta y calidad especificada.',
'No se mezclan calidades entre niveles.',
'Tiempo de MO igual por bolso en los tres niveles.',
'Objetivo: máximo volumen dentro del plan.',
'Se conserva el mix entre pedidos factibles.',
'No se ha optimizado beneficio monetario.'
];notes.forEach((x,i)=>value('P'+(23+i),x));
s.getRange('P23:P33').format.font.size=10;
s.getRange('P4:Q18').setNumberFormat(num);
for(const a of ['Q7','Q13','Q16','T5:T6','T12:T15'])s.getRange(a).setNumberFormat(pct);
s.getRange('Q7').setNumberFormat('0.00%');
s.getRange('Q4:Q6').setNumberFormat('0.0');s.getRange('Q15').setNumberFormat('0.00');s.getRange('T9:T11').setNumberFormat('0.00');
f('L5','K5*$T$4','Días productivos editables; se conserva el ciclo de 24 días.');
f('M10','IF(L9=0,0,L10/L9)','Evita división por cero cuando no hay operarios.');
f('M5','IF(L9=0,0,MAX(0,MIN(1,K7+$T$5*M10+$T$6*MIN(1,MAX(0,F21)))))','Se usa proporción N3 de todas las máquinas. Bono máximo propuesto 6 puntos, jefatura 4 puntos y eficiencia limitada al 100%.');
f('N5','ROUNDDOWN(MAX(0,L5*M5),0)','Capacidad entera conservadora; no redondear por encima de la capacidad.');
value('N4','Capacidad de MO');value('O5','Ver producción factible en Q11');
value('K9','Operarios productivos');value('K10','Operarios N3');
value('B23','Eficiencia: base + bono por proporción N3 + jefatura. Coeficientes editables en T5:T6.');
value('E34','Cupo de MO');value('D35','Capacidad MO');
s.getRange('P36:W36').values=[['Capacidad MP','Demanda A','Pedido factible','Cuota exacta','Base entera','Resto','Prioridad','Venta factible']];
s.getRange('P36:W36').format={fill:dark,font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},wrapText:true,rowHeight:33};
const recipes=[['D31','G31','J31'],['E32','H32','K32'],['F33','I33','L33']];
for(let i=0;i<3;i++){
 const r=37+i, j=56+i, st=63+i, dr=[128,141,154][i];
 f('P'+r,`ROUNDDOWN(MAX(0,MIN((D${st}+E${st})/${recipes[i][0]},(D${st+3}+E${st+3})/${recipes[i][1]},(D${st+6}+E${st+6})/${recipes[i][2]})),0)`);
 f('Q'+r,`J${dr}`);
 f('R'+r,`MAX(0,MIN(D${r},P${r},Q${r}))`);
 f('S'+r,`IF(SUM($R$37:$R$39)=0,0,MIN($E$35,SUM($R$37:$R$39))*R${r}/SUM($R$37:$R$39))`);
 f('T'+r,`ROUNDDOWN(S${r},0)`);
 f('U'+r,`S${r}-T${r}`);
 f('V'+r,`COUNTIFS($U$37:$U$39,">"&U${r})+COUNTIFS($U$37:U${r},U${r})`);
 f('E'+r,`T${r}+IF(V${r}<=MIN($E$35,SUM($R$37:$R$39))-SUM($T$37:$T$39),1,0)`,'Reparte unidades por restos mayores sobre pedidos factibles, con límite de plan, MO, MP y demanda; no pierde unidades al truncar.');
 f('D'+j,`MAX(0,MIN(E${r},P${r},D${r},Q${r}))`,'Sustituye disponibilidades manuales no conciliadas por límites trazables a stock, receta, MO, plan y demanda.');
 f('E'+j,`ROUNDDOWN(D${j},0)`,'Se conserva el redondeo hacia abajo sobre la producción limitada.');
 f('W'+r,`MIN(E${j},Q${r})`);
 f('K'+j,`$T$${9+i}`,'Reemplaza fechas sin significado de calidad por puntaje especificado de la receta. Escala propuesta N1=33,33, N2=66,67, N3=100.');
 for(let k=0;k<9;k++){
  const col=String.fromCharCode(68+k), recipeRow=31+i;
  f(`${col}${49+i}`,`$E${j}*${col}${recipeRow}`,'Consumo automático por producción real y receta. Evita inventarios paralelos y sustitución no validada de calidades.');
 }
}
s.getRange('P37:W39').setNumberFormat(num);s.getRange('S37:S39').setNumberFormat('0.000');s.getRange('U37:U39').setNumberFormat('0.000');
value('E36','Producción factible');f('E36','SUM(E37:E39)','Total de la asignación factible.');
value('C48','Consumo real por calidad');value('K55','Calidad especificada (0–100)');s.getRange('K55').format.wrapText=true;s.getRange('K56:K58').setNumberFormat('0.00');
value('E62','Compras convertidas');value('F62','Consumo real');value('H62','Uso de MP');value('I62','Unidad');
for(let r=63;r<=71;r++){
 const col=String.fromCharCode(68+r-63);
 f('F'+r,`SUM(${col}49:${col}51)`,'El consumo sale de la producción ejecutada, no de cifras escritas a mano.');
 f('H'+r,`IF(D${r}+E${r}=0,0,F${r}/(D${r}+E${r}))`);
 value('I'+r,r<=65?'m²':r<=68?'juego':'m');
}
s.getRange('D63:G71').setNumberFormat('#,##0.0');s.getRange('H63:H71').setNumberFormat(pct);
s.getRange('G63:G71').conditionalFormats.add('cellIs',{operator:'lessThan',formula:-0.0000001,format:{fill:'#FCE4D6',font:{color:'#9C0006',bold:true}}});
value('H62','Utilización');
f('C75','IF(D36=0,0,10*SUM(E56:E58)/D36)','Cumplimiento del plan entre 0 y 10. F51 era cantidad de cuero: multiplicarla por 10 daba 700 puntos.');
f('D75','10*M10','Aporte de personal experto entre 0 y 10, con denominador protegido.');
f('E75','IF(SUM(E56:E58)=0,0,SUMPRODUCT(E56:E58,K56:K58)/SUM(E56:E58)/10)','Calidad media ponderada por bolsos. Se eliminan referencias a H65/H68/H71 vacías y la confusión entre calidad y agotamiento de inventario.');
f('F75','IF($T$8<=0,0,10*MAX(0,MIN(1,B73/$T$8)))','Publicidad normalizada y acotada de 0 a 10; presupuesto de referencia editable.');
f('G75','IF(SUM($T$12:$T$15)=0,$T$7,MAX(0,MIN(10,(C75*$T$12+D75*$T$13+E75*$T$14+F75*$T$15)/SUM($T$12:$T$15))))','Promedio ponderado acotado, no suma de factores incompatibles. Pesos iguales propuestos y editables. Resultado aplicable al próximo ciclo.');
value('A75','Reputación próxima');value('C76','Cumplimiento del plan');value('E76','Calidad de MP');s.getRange('C75:G75').setNumberFormat('0.00');
for(const c of ['C','D','E','F','G'])f(c+'123',c+'75','Enlace al cálculo único de reputación; elimina duplicación de la lógica.');
value('A123','Reputación próxima');value('C124','Cumplimiento del plan');value('E124','Calidad de MP');s.getRange('C123:G123').setNumberFormat('0.00');
// Demand rounding: largest remainder, with deterministic company-order ties.
function demand(rows,share,out,market,totalScore){
 for(const r of rows){
  f('P'+r,`${share}${r}*$B$${market}`);
  f('Q'+r,`P${r}-ROUNDDOWN(P${r},0)`);
  f('R'+r,`COUNTIFS($Q$${rows[0]}:$Q$${rows.at(-1)},">"&Q${r})+COUNTIFS($Q$${rows[0]}:Q${r},Q${r})`);
  const floors=rows.map(x=>`ROUNDDOWN(P${x},0)`).join(',');
  f(out+r,`ROUNDDOWN(P${r},0)+IF(R${r}<=IF(${totalScore}=0,0,$B$${market})-SUM(${floors}),1,0)`,'Demanda potencial entera por restos mayores. Concilia con el mercado; no equivale a ventas sin límite de inventario.');
 }
 s.getRange(`P${rows[0]}:R${rows.at(-1)}`).setNumberFormat('0.000');
}
for(const [start,total,market,base,rate] of [[83,87,91,89,90],[97,101,105,103,104],[111,115,119,117,118]]){
 const rows=Array.from({length:4},(_,i)=>start+i);
 value('H'+(start-1),'Demanda potencial');
 for(const r of rows){
  f('E'+r,`IF(D${r}<=0,0,10*MIN($D$${start}:$D$${start+3})/D${r})`,'Puntaje precio de 0 a 10, comparable a reputación; no depende del precio máximo de un competidor.');
  f('F'+r,`MAX(0,MIN(10,C${r}))+E${r}`,'Acota reputación a la escala declarada.');
  f('G'+r,`IF($F$${total}=0,0,F${r}/$F$${total})`,'Denominador cero implica demanda no asignada.');
 }
 f('B'+market,`ROUNDDOWN(MAX(0,B${base})*MAX(0,MIN(1,B${rate})),0)`,'Mercado efectivo entero, con proporción limitada a 0–100%.');
 demand(rows,'G','H',market,`$F$${total}`);
 f('H'+total,`SUM(H${start}:H${start+3})`);
 value('P'+(start-1),'Cuota exacta');value('Q'+(start-1),'Resto');value('R'+(start-1),'Prioridad');
}
for(const [start,total,market,base,rate,wr,ideal,quality] of [[128,132,136,134,135,124,null,56],[141,145,149,147,148,137,140,57],[154,158,162,160,161,150,153,58]]){
 const rows=Array.from({length:4},(_,i)=>start+i);
 value('J'+(start-1),'Demanda potencial');
 f('D'+start,'$T$7','Empresa A es el jugador. Reputación previa fija para este ciclo; evita circularidad producción-demanda.');
 for(const r of rows){
  if(r===start)f('E'+r,`$K$${quality}`,'Calidad del producto independiente de reputación, vinculada a su receta.');
  else value('E'+r,50,'Calidad competidora desconocida. Supuesto neutral editable de 50/100 para el ejemplo; no es dato observado.');
  s.getRange('E'+r).setNumberFormat('0.00');if(r!==start){s.getRange('E'+r).format.font.color=blue;s.getRange('E'+r).format.fill='#FFF2CC';}
  const price=ideal?`IF($M$${ideal}<=0,0,MAX(0,MIN(100,100-ABS(C${r}-$M$${ideal})/$M$${ideal}*100)))`:`IF(MAX($C$${start}:$C$${start+3})=MIN($C$${start}:$C$${start+3}),100,MAX(0,MIN(100,100*(MAX($C$${start}:$C$${start+3})-C${r})/(MAX($C$${start}:$C$${start+3})-MIN($C$${start}:$C$${start+3})))))`;
  f('F'+r,price,'Protege precios iguales o referencia cero y evita puntajes negativos o superiores a 100.');
  f('G'+r,`10*MAX(0,MIN(10,D${r}))`,'Normaliza reputación de 0–10 a 0–100 y acota la entrada 10,2 del ejemplo.');
  f('H'+r,`IF(SUM($M$${wr}:$M$${wr+2})=0,0,($M$${wr}*F${r}+$M$${wr+1}*G${r}+$M$${wr+2}*MAX(0,MIN(100,E${r})))/SUM($M$${wr}:$M$${wr+2}))`,'Ponderación normalizada. La calidad ya no se infiere de reputación ni del total de otro segmento.');
  f('I'+r,`IF($H$${total}=0,0,H${r}/$H$${total})`,'Protege ausencia de puntaje total.');
 }
 f('B'+market,`ROUNDDOWN(MAX(0,B${base})*MAX(0,MIN(1,B${rate})),0)`,'Sustituye constante de mercado por cálculo dinámico.');
 demand(rows,'I','J',market,`$H$${total}`);
 value('P'+(start-1),'Cuota exacta');value('Q'+(start-1),'Resto');value('R'+(start-1),'Prioridad');
}
// Input constraints. Blank workforce positions mean zero, as in the supplied model.
for(const range of ['F5:F7','F11:H13','F17:H19','F21','D37:D39'])s.dataValidations.add({range,rule:{type:'whole',operator:'between',formula1:0,formula2:1000000}});
for(const range of ['D63:E71','B73'])s.dataValidations.add({range,rule:{type:'decimal',operator:'between',formula1:0,formula2:1000000000}});
for(const range of ['T5:T6','T12:T15','M124:M126','M137:M139','M150:M152'])s.dataValidations.add({range,rule:{type:'decimal',operator:'between',formula1:0,formula2:1}});
s.dataValidations.add({range:'T4',rule:{type:'whole',operator:'between',formula1:0,formula2:366}});
s.dataValidations.add({range:'T7',rule:{type:'decimal',operator:'between',formula1:0,formula2:10}});
s.dataValidations.add({range:'T8',rule:{type:'decimal',operator:'greaterThan',formula1:0}});
for(const range of ['T9:T11','E129:E131','E142:E144','E155:E157'])s.dataValidations.add({range,rule:{type:'decimal',operator:'between',formula1:0,formula2:100}});
for(const range of ['K7','B90','B104','B118','B135','B148','B161'])s.dataValidations.add({range,rule:{type:'decimal',operator:'between',formula1:0,formula2:1}});
for(const range of ['D31','G31','J31','E32','H32','K32','F33','I33','L33','M140','M153'])s.dataValidations.add({range,rule:{type:'decimal',operator:'greaterThan',formula1:0}});
// Compact operational checks observe the build without feeding it.
value('S43','Comprobaciones');s.getRange('S43').format.font.bold=true;
for(const [r,l,x] of [[44,'Exceso sobre MO','MAX(0,SUM(E56:E58)-N5)'],[45,'Unidades factibles sin asignar','MIN(N5,SUM(R37:R39))-SUM(E56:E58)'],[46,'Inventarios negativos','COUNTIFS(G63:G71,"<0")'],[47,'Diferencia ventas básicas','J132-B136'],[48,'Diferencia ventas medias','J145-B149'],[49,'Diferencia ventas premium','J158-B162']]){value('S'+r,l);f('T'+r,x);}
s.getRange('T44:T49').setNumberFormat('0.00');
s.getRange('T44:T49').conditionalFormats.add('cellIs',{operator:'notEqual',formula:0,format:{fill:'#FCE4D6',font:{color:'#9C0006',bold:true}}});
value('S52','Regla de optimización');value('S53','Limitar pedidos por stock y demanda.');value('S54','Distribuir MO por proporción factible.');value('S55','Asignar sobrantes por mayor resto decimal.');value('S56','Desempatar por orden N1, N2 y N3.');
value('S59','Calidad y reputación');value('S60','Calidad: receta de materiales por segmento.');value('S61','La reputación próxima resume el ciclo.');value('S62','Para otro ciclo, copiar G75 a T7 como valor.');value('S63','Pasar G63:G71 a D63:D71 como valores.');value('S64','Actualizar compras antes de recalcular.');
// Full inventory of all 225 original formulas, plus changed original hardcoded values.
const a=wb.worksheets.add('Auditoría producción');a.showGridLines=false;
a.getRange('A2').values=[['Auditoría de cantidad de producción']];
a.getRange('A2').format.font={name:'Arial',size:14,bold:true};
const overview=[
'Fuente: DECISIONES SIDE (14).xlsx. Alcance: CANTIDAD DE PRODUCCIÓN.',
'Se revisaron las 225 fórmulas originales. Las otras nueve hojas no forman parte de la corrección.',
'MO: se conserva MIN(corte, ensamblado, acabado). Eficiencia proporcional a N3 y acotada.',
'MP: inventario único, recetas por nivel, consumo trazable y reparto entero sin unidades perdidas.',
'Reputación: escala de 0–10, calidad independiente y aplicación al siguiente ciclo.',
'Demanda: el bloque ponderado de filas 128–162 representa al jugador como Empresa A.',
'Los bloques 83–119 se conservan como ejemplos alternativos; no se suman al modelo principal.',
'Supuesto material: compras e inventarios ya están en m², juegos y metros. Falta confirmar conversiones.',
'Supuestos nuevos: bono máximo N3 de 6 puntos, calidad 33,33/66,67/100 y cuatro pesos de 25%.',
'Las calidades competidoras de 50/100 son supuestos editables para el ejemplo, no observaciones.',
'No hay tiempos por producto, mermas verificadas ni costos conciliados: se optimiza volumen, no utilidad.',
'Original: capacidad MO 396, reparto 395 y producción 365 (190, 125, 50).',
'Original: consumo declarado excedía stock de cuero premium, metal premium e hilo de alta tenacidad.',
'Las fechas K56:K58 y errores guardados de reputación no se tratan como puntajes válidos.'
];
overview.forEach((x,i)=>a.getRange('A'+(4+i)).values=[[x]]);
a.getRange('A20:E20').values=[['Celda','Resultado de revisión','Fórmula / valor original','Fórmula / valor aplicado','Motivo']];
const audit=[];
for(const [cell,c] of Object.entries(src.cells)){
 if(c.type!=='f'&&!changes[cell])continue;
 const change=changes[cell];
 const revised=change?change.new:c.value;
 const same=c.value===revised;
 const literal=x=>typeof x==='string'&&x.startsWith('=')?"'"+x:String(x??'');
 audit.push([cell,same?'Conservada':'Corregida',literal(c.value),literal(revised),same?'Operación coherente con sus unidades y dependencias; se conserva.':change.why||'Etiqueta ajustada a la nueva lógica.']);
}
a.getRange(`A21:E${20+audit.length}`).values=audit;
a.getRange(`A4:E${20+audit.length}`).format.font={name:'Arial',size:10};
a.getRange('A20:E20').format={fill:dark,font:{bold:true,color:'#FFFFFF',name:'Arial',size:10},wrapText:true,rowHeight:30};
a.getRange('A21:A'+(20+audit.length)).format.columnWidth=13;
a.getRange('B21:B'+(20+audit.length)).format.columnWidth=23;
a.getRange('C21:D'+(20+audit.length)).format.columnWidth=75;
a.getRange('E21:E'+(20+audit.length)).format.columnWidth=75;
a.getRange('A21:E'+(20+audit.length)).format.wrapText=true;
a.getRange('A21:E'+(20+audit.length)).format.verticalAlignment='center';
audit.forEach((row,i)=>{const lines=Math.max(1,...row.slice(2).map(x=>Math.ceil(String(x).length/65)));a.getRange(`A${21+i}:E${21+i}`).format.rowHeight=Math.max(28,lines*14+10);});
a.getRange('A4:A17').format.rowHeight=23;
a.freezePanes.freezeRows(20);
await fs.writeFile('changes.json',JSON.stringify(changes,null,2));
// Verify live recalculation and boundary behavior, then restore original inputs.
const get=x=>s.getRange(x).values[0][0];
const eq=(x,y)=>assert.equal(get(x),y,x);
wb.recalculate();
eq('N5',397);eq('E56',191);eq('E57',137);eq('E58',69);eq('Q11',397);
const baseline={};for(const x of ['I8','I14','I20','M5','N5','E56','E57','E58','G75','J128','J141','J154'])baseline[x]=get(x);
const test=(name,edit,check,restore)=>{edit();wb.recalculate();check();restore();wb.recalculate();console.log('PASS',name);};
test('plan cero',()=>s.getRange('D37:D39').values=[[0],[0],[0]],()=>eq('Q11',0),()=>s.getRange('D37:D39').values=[[250],[180],[90]]);
test('menor plan',()=>s.getRange('D37:D39').values=[[10],[10],[10]],()=>{eq('Q11',30);eq('E56',10);eq('E57',10);eq('E58',10)},()=>s.getRange('D37:D39').values=[[250],[180],[90]]);
test('sin accesorios N2',()=>s.getRange('E67').values=[[0]],()=>{eq('E57',0);eq('Q11',340)},()=>s.getRange('E67').values=[[190]]);
const workforce=['F5:F7','F11:H13','F17:H19'].map(x=>[x,s.getRange(x).values]);
test('sin operarios',()=>{for(const [x]of workforce)s.getRange(x).values=[[0]]},()=>{eq('N5',0);eq('Q11',0);eq('M10',0)},()=>{for(const [x,v]of workforce)s.getRange(x).values=v});
test('jefatura no acumulable',()=>s.getRange('F21').values=[[10]],()=>eq('M5',baseline.M5),()=>s.getRange('F21').values=[[1]]);
const prices=s.getRange('C128:C131').values;
test('precios iguales',()=>s.getRange('C128:C131').values=[[40],[40],[40],[40]],()=>{eq('F128',100);eq('J132',3500)},()=>s.getRange('C128:C131').values=prices);
const oldDem=get('J128');
test('reputación previa mueve demanda',()=>s.getRange('T7').values=[[2]],()=>assert.ok(get('J128')<oldDem),()=>s.getRange('T7').values=[[7]]);
test('mercado cero',()=>s.getRange('B135').values=[[0]],()=>eq('E56',0),()=>s.getRange('B135').values=[[0.5]]);
test('mercado medio independiente',()=>s.getRange('B104').values=[[0.6]],()=>eq('H101',3000),()=>s.getRange('B104').values=[[0.7]]);
test('compras cero',()=>s.getRange('E63:E71').values=[[0]],()=>assert.ok(get('Q11')<397),()=>s.getRange('E63:E71').values=[[60],[55],[15],[200],[190],[0],[6],[7],[0]]);
wb.recalculate();
eq('Q11',397);for(const r of [44,45,46,47,48,49])eq('T'+r,0);
for(let r=63;r<=71;r++)assert.ok(Math.abs(get('G'+r)-(get('D'+r)+get('E'+r)-get('F'+r)))<1e-9,'Inventory reconciliation row '+r);
for(const r of [87,101,115,132,145,158])assert.equal(get((r<120?'H':'J')+r),get('B'+({87:91,101:105,115:119,132:136,145:149,158:162}[r])));
for(const [cell] of Object.entries(src.cells)){const v=get(cell);if(typeof v==='string'&&/^#(REF!|DIV\/0!|VALUE!|NAME\?|N\/A|NUM!|NULL!|SPILL!|CALC!)/.test(v))throw Error(cell+': '+v);}
console.log('BASELINE',JSON.stringify(baseline));
await fs.writeFile('results.json',JSON.stringify({baseline,inventory:s.getRange('D63:H71').values,formulasReviewed:225,auditRows:audit.length,changedOriginalFormulas:Object.entries(changes).filter(([k,v])=>src.cells[k]?.type==='f'&&v.old!==v.new).length},null,2));
console.log((await wb.inspect({kind:'table',range:"'CANTIDAD DE PRODUCCIÓN'!P4:Q18",include:'values,formulas',tableMaxRows:15,tableMaxCols:2,maxChars:3500})).ndjson);
const errors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!',options:{useRegex:true,maxResults:30},summary:'formula error scan',maxChars:4000});console.log(errors.ndjson);
await fs.writeFile('formula_scan.txt',errors.ndjson);
for(const [name,sheetName,range] of [['resultados',src.sheet,'P2:Q19'],['mp',src.sheet,'C55:L71'],['mercado',src.sheet,'B127:M132'],['audit','Auditoría producción','A2:E24'],['audit_later','Auditoría producción','A120:E125']]){
 const img=await wb.render({sheetName,range,scale:1.5,format:'png'});await fs.writeFile(name+'.png',new Uint8Array(await img.arrayBuffer()));
}
const out=await SpreadsheetFile.exportXlsx(wb);await out.save('DECISIONES_SIDE_corregido.xlsx');console.log('EXPORTED');
