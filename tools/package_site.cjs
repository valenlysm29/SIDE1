'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/site');
fs.mkdirSync(out,{recursive:true});
// Explicit public directories; never publish credentials, backups, tests or Git.
for(const name of ['assets','css','js','services','vendor','LICENSES'])fs.cpSync(path.join(root,name),path.join(out,name),{recursive:true});
for(const name of fs.readdirSync(root).filter(n=>n.endsWith('.html')||n==='CREDITS.md'))fs.copyFileSync(path.join(root,name),path.join(out,name));
fs.writeFileSync(path.join(out,'.nojekyll'),'');
console.log('Public site packaged in output/site');
