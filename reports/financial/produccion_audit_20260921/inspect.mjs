import fs from 'node:fs/promises';
import {FileBlob,SpreadsheetFile} from '@oai/artifact-tool';
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load('C:/Users/Asus/Downloads/DECISIONES SIDE (14).xlsx'));
console.log((await wb.inspect({kind:'sheet',include:'id,name',maxChars:3000})).ndjson);
const p=await wb.render({sheetName:'CANTIDAD DE PRODUCCIÓN',range:'C3:N21',scale:1.5,format:'png'});
await fs.writeFile('original_mo.png',new Uint8Array(await p.arrayBuffer()));
console.log('rendered');
