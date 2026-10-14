const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=process.argv[2];assert(root&&/(?:b3|b4)/.test(path.resolve(root)));
fs.mkdirSync(path.join(root,'PRUEBAS'),{recursive:true});
const results=[];
for(const [control,expected] of [['pii','personal-parameter'],['operational','operational-send'],['duplicate-view','duplicate-view'],['preconsent-load','preconsent-load']]){
 const out=path.join(root,control);
 const child=spawnSync(process.execPath,[path.join(__dirname,'qa-analytics.cjs'),out],{env:{...process.env,QA_GA4_MODE:'fixture',QA_GA4_CONTROL:control,QA_CASE_FILTER:''},encoding:'utf8',windowsHide:true});
 assert(fs.existsSync(path.join(out,'PRUEBAS','analytics.json')),'Startup failure is not a successful control');
 fs.writeFileSync(path.join(out,'command.log'),child.stdout+child.stderr,{flag:'wx'});
 const report=JSON.parse(fs.readFileSync(path.join(out,'PRUEBAS','analytics.json'),'utf8'));
 assert(report.requests.length>0);assert(report.results.length===1);
 assert.notEqual(child.status,null);assert.notEqual(child.status,0);assert.equal(report.status,'FAIL');
 assert(report.violations.some(x=>x.type===expected),'Missing expected detector: '+expected);
 assert.equal(report.errors.length,0,'Unexpected runner error is not a successful control');
 results.push({control,expected,exitCode:child.status,childStatus:report.status,status:'PASS',classification:'EXPECTED_FAILURE_CONTROL',violations:report.violations});
 console.log(JSON.stringify(results.at(-1)));
}
fs.writeFileSync(path.join(root,'PRUEBAS','analytics-negative-controls.json'),JSON.stringify({status:'PASS',results},null,2),{flag:'wx'});
