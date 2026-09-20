'use strict';
// npm package: Khronos gltf-validator 2.0.0-dev.3.10.
const fs=require('node:fs'),path=require('node:path');
const validator=require(process.env.GLTF_VALIDATOR_PATH||'gltf-validator');
const root=path.resolve(__dirname,'..');
(async()=>{
 for(const name of ['male','female','male_casual']){
  const file=`assets/models3d/npc_realistic_${name}.glb`;
  const report=await validator.validateBytes(new Uint8Array(fs.readFileSync(path.join(root,file))),{uri:file,maxIssues:0});
  fs.mkdirSync(path.join(root,'tests/output'),{recursive:true});
  fs.writeFileSync(path.join(root,`tests/output/gltf-${name}.json`),JSON.stringify(report,null,2));
  console.log(name,report.issues.numErrors,'errors',report.issues.numWarnings,'warnings');
  if(report.issues.numErrors)process.exitCode=1;
 }
})().catch(error=>{console.error(error);process.exitCode=1});
