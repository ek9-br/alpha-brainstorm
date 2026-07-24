import {copyFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';

const assetsDirectory=new URL('../dist/assets/',import.meta.url);
const files=await readdir(assetsDirectory);
const javascript=files.find(file=>file==='app.js')||files.find(file=>file.endsWith('.js'));
const stylesheet=files.find(file=>file==='index.css')||files.find(file=>file.endsWith('.css'));

if(!javascript)throw new Error('Arquivo JavaScript do build não encontrado.');
if(!stylesheet)throw new Error('Arquivo CSS do build não encontrado.');

const legacyJavascript=[
 'index-CTZUEW3W.js',
 'index-DOrarwhx.js',
 'index-Dru5E0yA.js',
 'index-DdCbfz5J.js',
 'index-CLBO723P.js',
 'index-l4Bs9NRE.js'
];
const legacyStylesheets=[
 'index-bkiq7i95.css',
 'index-VembXYGE.css',
 'index-D7LOXe8D.css',
 'index-B2b5GwEJ.css',
 'index-bXNSHpRG.css',
 'index-Dr_fndia.css'
];

await Promise.all([
 ...legacyJavascript.map(alias=>copyFile(join(assetsDirectory.pathname,javascript),join(assetsDirectory.pathname,alias))),
 ...legacyStylesheets.map(alias=>copyFile(join(assetsDirectory.pathname,stylesheet),join(assetsDirectory.pathname,alias)))
]);
