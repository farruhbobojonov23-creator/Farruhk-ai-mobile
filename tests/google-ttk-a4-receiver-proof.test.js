import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const gateway=readFileSync(new URL('../recipe-export-api.js',import.meta.url),'utf8');
const receiver=readFileSync(new URL('../public/google-ttk.gs',import.meta.url),'utf8');
const ui=readFileSync(new URL('../public/recipe-google.js',import.meta.url),'utf8');

test('Google receiver advertises separate PDF A4 capability and saves real files',()=>{
 assert.match(receiver,/pdfA4Supported:true/);
 assert.match(receiver,/function saveOnePagePdf\(/);
 assert.match(receiver,/pdfFolder\.createFile\(Utilities\.newBlob/); 
 assert.match(receiver,/pdfUrl,pdfA4Supported:true/);
});
test('gateway does not call an old Docs-only response a completed PDF upload',()=>{
 assert.match(gateway,/GOOGLE_PDF_NOT_CONFIRMED/);
 assert.match(gateway,/if\(recipe&&!isGoogleDrivePdfUrl\(result\.pdfUrl\)\)/);
 assert.match(gateway,/documentSaved:isGoogleDocUrl\(result\.documentUrl\)/);
});
test('user can still download the canonical server PDF without Google',()=>{
 assert.match(ui,/Скачать PDF А4 на телефон/);
 assert.match(ui,/fetch\('\/api\/recipes\/pdf'/);
 assert.match(ui,/downloadPdfButton\.hidden=!pdfDownloadRecipe/);
 assert.match(ui,/checked\.pdfA4Supported===false/);
});
