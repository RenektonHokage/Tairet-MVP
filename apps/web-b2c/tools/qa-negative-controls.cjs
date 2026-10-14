const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const q=require('./qa-support.cjs'),root=process.argv[2],reference=process.argv[3];q.prepare(root);
const results=[];
for(const [script,file] of [['qa-smoke.cjs','smoke.json'],['qa-visual-final.cjs','visual-final.json']]){
 for(const control of ['clean','candidate-error','overflow']){
  const evidence=path.join(root,script.replace('.cjs','')+'-'+control),args=[path.join(__dirname,script),evidence];
  if(script==='qa-visual-final.cjs')args.push(reference);
  const child=spawnSync(process.execPath,args,{env:{...process.env,QA_CONTROL:control},encoding:'utf8',windowsHide:true});
  fs.writeFileSync(path.join(evidence,'command.log'),child.stdout+child.stderr,{flag:'wx'});
  const reportPath=path.join(evidence,'PRUEBAS',file);assert(fs.existsSync(reportPath),'Missing structured report does not prove failure detection');
  const report=JSON.parse(fs.readFileSync(reportPath,'utf8'));
  assert(report.records.length>0);assert.equal(report.environmentErrors.length,0);assert.equal(report.referenceErrors.length,0);
  if(control==='clean'){assert.equal(child.status,0);assert.equal(report.status,'PASS');}
  else{
   assert.notEqual(child.status,0);assert.notEqual(child.status,null);assert.equal(report.status,'FAIL');
   if(control==='candidate-error'){assert(report.candidateErrors.some(e=>e.message.includes('QA_CONTROLLED_CANDIDATE_ERROR')));assert(!report.failures.some(e=>e.type==='overflow'));}
   if(control==='overflow'){assert.equal(report.candidateErrors.length,0);assert(report.records.some(e=>e.kind!=='reference'&&e.overflow));assert(report.failures.some(e=>e.type==='overflow'));}
  }
  results.push({script,control,classification:control==='clean'?'CLEAN_CONTROL':'EXPECTED_FAILURE_CONTROL',exitCode:child.status,result:'PASS',childStatus:report.status,records:report.records.length,report:reportPath});
  console.log(JSON.stringify(results.at(-1)));
 }
}
q.save(root,'negative-controls.json',{status:'PASS',results});
