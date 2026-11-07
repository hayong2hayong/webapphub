import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildWorker} from '../scripts/build-worker.mjs';
test('worker build serves existing nested assets, keeps private files out and forwards API only to the server',async()=>{
 const root=await mkdtemp(join(tmpdir(),'school-build-test-'));
 try{
  for(const path of ['.openai','dist/apps/example','dist/lib','server'])await mkdir(join(root,path),{recursive:true});
  await writeFile(join(root,'.openai/hosting.json'),JSON.stringify({project_id:'test-project',d1:null}));
  await writeFile(join(root,'dist/index.html'),'<h1>도구함</h1>');
  await writeFile(join(root,'dist/apps/example/index.html'),'<p>기존 앱</p>');
  await writeFile(join(root,'dist/lib/example.mjs'),'export const value=3;');
  await writeFile(join(root,'dist/.env.local'),'DO_NOT_PUBLISH');
  await writeFile(join(root,'server/school-api.mjs'),'export function createSchoolHandler(){return async(request,env)=>Response.json({configured:!!env.NEIS_API_KEY});}');
  await buildWorker(root);
  const source=await readFile(join(root,'dist/server/index.js'),'utf8');
  assert.ok(!source.includes('DO_NOT_PUBLISH'));
  const {default:worker}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  assert.equal(await (await worker.fetch(new Request('https://unit.test/'),{},{})).text(),'<h1>도구함</h1>');
  assert.equal(await (await worker.fetch(new Request('https://unit.test/apps/example/'),{},{})).text(),'<p>기존 앱</p>');
  assert.equal((await worker.fetch(new Request('https://unit.test/apps/example'),{},{})).status,308);
  assert.match((await worker.fetch(new Request('https://unit.test/lib/example.mjs'),{},{})).headers.get('content-type'),/javascript/);
  assert.equal((await worker.fetch(new Request('https://unit.test/.env.local'),{},{})).status,404);
  const api=await worker.fetch(new Request('https://unit.test/api/school-week?date=2026-11-07'),{NEIS_API_KEY:'private-test-key'},{});
  assert.deepEqual(await api.json(),{configured:true});
  const head=await worker.fetch(new Request('https://unit.test/',{method:'HEAD'}),{},{});assert.equal(await head.text(),'');assert.equal(head.status,200);
  assert.equal((await worker.fetch(new Request('https://unit.test/',{method:'POST'}),{},{})).status,405);
  const manifest=JSON.parse(await readFile(join(root,'dist/.openai/hosting.json'),'utf8'));assert.equal(manifest.project_id,'test-project');assert.equal(manifest.static,undefined);assert.equal(manifest.d1,null);
 }finally{assert.ok(pathIsTestTemporary(root));await rm(root,{recursive:true,force:true});}
});
function pathIsTestTemporary(root){return root.startsWith(join(tmpdir(),'school-build-test-'));}
