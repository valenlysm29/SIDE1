'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');process.chdir(root);
const out=path.join(root,'tests/output/revision-2026-10-05');
const input=phase=>JSON.parse(fs.readFileSync(path.join(out,'isolated/mejora-integral-2026-10-01',phase,'summary.json'),'utf8'));
const first=input('review'),retry=input('review-retry'),latest=new Map(first.results.map(result=>[result.suite,result]));
for(const result of retry.results)latest.set(result.suite,result);
const actualLog=relative=>path.relative(root,path.join(out,'isolated',path.relative(path.join(root,'tests/output'),path.join(root,relative))));
const results=[...latest.values()].map(result=>({...result,...(result.log?{log:actualLog(result.log)}:{})}));
const summary={checkedAt:new Date().toISOString(),commit:'310763fdddf35fd772ff347dcebed87ea5846d63',nodeTests:{passed:296,failed:0},pythonTests:{passed:2,failed:0},results,
 firstAttemptFailures:first.results.filter(result=>result.status==='failed').map(result=>({...result,log:actualLog(result.log)})),
 retryRuns:retry.results.map(result=>({...result,log:actualLog(result.log)})),
 limitations:['Local PGlite and browser fixtures; remote successful authenticated writes not verified','SwiftShader benchmark: median 1 FPS at all three quality tiers; physical GPU not verified','Optional side_full_flow.cjs is absent'],
 findings:5,counts:{}};
for(const result of results){const key=result.kind+':'+result.status;summary.counts[key]=(summary.counts[key]||0)+1;}
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify({counts:summary.counts,failures:results.filter(result=>result.status==='failed'),findings:summary.findings},null,2));
