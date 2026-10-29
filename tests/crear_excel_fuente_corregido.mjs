import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {FileBlob,SpreadsheetFile}=await import(process.env.SIDE_ARTIFACT_TOOL ? pathToFileURL(process.env.SIDE_ARTIFACT_TOOL).href : '@oai/artifact-tool');
const source='tests/output/excel_fuente_actual/fuente_inmutable.xlsx',dest='output/SIDE_prueba_cantidad_produccion_corregido.xlsx';
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(source)),s=wb.worksheets.getItemAt(5);
try{const pic=await wb.render({sheetName:s.name,range:'C4:N23',scale:1,format:'png'});await fs.writeFile('tests/output/excel_fuente_actual/antes.png',new Uint8Array(await pic.arrayBuffer()));}catch(e){console.error('Render original:',e.message)}
const corrections={
 M5:'=K7+SUM(F7,F13:H13,F19:H19)/100+4%*F21',
 E46:'=MAX(0,ROUNDDOWN(MIN(D46,$N$5,($H$38+SUM($D$54:$D$56))/D38,($I$38+SUM($D$57:$D$58))/E38,($J$38+SUM($D$59:$D$61))/F38),0))',
 E47:'=MAX(0,ROUNDDOWN(MIN(D47,$N$5-E46,($H$38+SUM($D$54:$D$56)-L46)/D39,($I$38+SUM($D$57:$D$58)-M46)/E39,($J$38+SUM($D$59:$D$61)-N46)/F39),0))',
 E48:'=MAX(0,ROUNDDOWN(MIN(D48,$N$5-E46-E47,($H$38+SUM($D$54:$D$56)-L46-L47)/D40,($I$38+SUM($D$57:$D$58)-M46-M47)/E40,($J$38+SUM($D$59:$D$61)-N46-N47)/F40),0))',
 F46:'=IFERROR(E46/E49,0)',F47:'=IFERROR(E47/E49,0)',F48:'=IFERROR(E48/E49,0)',
 F54:'=MIN(D54+E54,$L$49)',F55:'=MIN(D55+E55,MAX(0,$L$49-F54))',F56:'=MIN(D56+E56,MAX(0,$L$49-F54-F55))',
 F57:'=MIN(D57+E57,$M$49)',F58:'=MIN(D58+E58,MAX(0,$M$49-F57))',
 F59:'=MIN(D59+E59,$N$49)',F60:'=MIN(D60+E60,MAX(0,$N$49-F59))',F61:'=MIN(D61+E61,MAX(0,$N$49-F59-F60))',
 H56:'=IFERROR(F56/SUM(F54:F56),0)',H58:'=IFERROR(F58/SUM(F57:F58),0)',H61:'=IFERROR(F61/SUM(F59:F61),0)',
 AB88:'=V76*F54',AB89:'=V77*F55',AB90:'=V78*F56',AB91:'=V79*F57',AB92:'=V80*F58',AB93:'=V81*F59',AB94:'=V82*F60',AB95:'=V83*F61'
};
const trace=wb.worksheets.add('Trazabilidad');trace.getRange('A1:D1').values=[['Celda','Fórmula o valor original','Valor original en fuente','Fórmula corregida']];
const rows=[];for(const [cell,formula] of Object.entries(corrections)){const r=s.getRange(cell);const orig=r.formulas?.[0]?.[0]||r.values?.[0]?.[0]||'';const value=r.values?.[0]?.[0]??'';rows.push([cell,String(orig).startsWith('=')?"'"+orig:String(orig),value,"'"+formula]);r.formulas=[[formula]];}
trace.getRange(`A2:D${rows.length+1}`).values=rows;trace.getRange('A:A').format.columnWidth=13;trace.getRange('B:D').format.columnWidth=52;trace.getRange('A1:D1').format.font.bold=true;trace.freezePanes.freezeRows(1);
wb.recalculate();await fs.mkdir('output',{recursive:true});await (await SpreadsheetFile.exportXlsx(wb)).save(dest);
try{const pic=await wb.render({sheetName:s.name,range:'C4:N23',scale:1,format:'png'});await fs.writeFile('tests/output/excel_fuente_actual/corregido.png',new Uint8Array(await pic.arrayBuffer()));}catch(e){console.error('Render corregido:',e.message)}
console.log('Creado',dest,'celdas corregidas',rows.length);
