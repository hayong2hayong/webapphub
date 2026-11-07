import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../dist/lib/core.mjs';
const {drawNumbers,parseExcluded,validateApp,validateBackup,filterApps}=core;
const options={start:1,end:5,excluded:[2],count:3,avoidRepeats:true};
const app={id:'personal-one',title:'수업 도구',description:'간단한 도구',url:'https://example.org/tool',category:'수업 도구'};
test('excluded and previously used numbers cannot be drawn; input is unchanged',()=>{
 const used=[3];const before=structuredClone(options);
 assert.deepEqual(drawNumbers({...options,count:3},used,()=>0).sort((a,b)=>a-b),[1,4,5]);
 assert.deepEqual(options,before);assert.deepEqual(used,[3]);
});
test('drawing the full pool returns each candidate exactly once',()=>{
 const result=drawNumbers({...options,count:4},[],()=>0);
 assert.deepEqual([...result].sort((a,b)=>a-b),[1,3,4,5]);
});
test('exhausted pool and invalid integer bounds are rejected',()=>{
 for(const patch of [{count:5},{start:6},{start:0},{end:1000},{count:0},{count:1.5},{start:1.5},{count:101}]) assert.throws(()=>drawNumbers({...options,...patch},[]));
 assert.throws(()=>drawNumbers(options,[1,3,4,5]));
});
test('allowing repeats reuses earlier rounds but stays distinct within a round',()=>{
 assert.deepEqual(drawNumbers({...options,avoidRepeats:false,count:4},[1,3,4,5],()=>0).sort((a,b)=>a-b),[1,3,4,5]);
});
test('exclusions accept commas and whitespace but reject malformed and out-of-range values',()=>{
 assert.deepEqual(parseExcluded('2, 4 4\n5',1,5),[2,4,5]);
 assert.deepEqual(parseExcluded('',1,5),[]);
 for(const input of ['2.5','2x','0','6','-1','2-4']) assert.throws(()=>parseExcluded(input,1,5));
});
test('unsafe URL schemes, credentials, control characters and excessive fields are rejected',()=>{
 for(const url of ['javascript:alert(1)','http://example.org','https://u:p@example.org','https://exa\nmple.org']) assert.throws(()=>validateApp({...app,url}));
 assert.throws(()=>validateApp({...app,title:'x'.repeat(41)}));
 assert.throws(()=>validateApp({...app,category:'unrecognized'}));
 assert.equal(validateApp({...app,title:' 도구 '}).title,'도구');
});
test('backup validation rejects collisions, broken shapes and unknown favorites without changing input',()=>{
 const valid={version:1,apps:[app],favorites:['number-picker','personal-one']};
 const before=structuredClone(valid);assert.deepEqual(validateBackup(valid),valid);assert.deepEqual(valid,before);
 for(const bad of [{...valid,version:2},{...valid,apps:[app,app]},{...valid,apps:[{...app,id:'number-picker'}]},{...valid,favorites:['missing']},{...valid,apps:Array.from({length:101},(_,i)=>({...app,id:'p'+i}))},{version:1,apps:null,favorites:[]}]) assert.throws(()=>validateBackup(bad));
});
test('search combines category and favorite filters and treats query as text',()=>{
 const rows=[app,{...app,id:'p2',title:'미술 메모',category:'창작 활동'}];
 assert.deepEqual(filterApps(rows,'미술','전체',[],false).map(a=>a.id),['p2']);
 assert.equal(filterApps(rows,'','수업 도구',['p2'],true).length,0);
 assert.equal(filterApps(rows,'<script>','전체',[],false).length,0);
});
test('canonical Unicode URLs must remain valid across a save/reload cycle',()=>{
 const safe=validateApp({...app,url:'https://example.org/수업'});
 assert.deepEqual(validateApp(safe),safe);
 assert.throws(()=>validateApp({...app,url:'https://example.org/'+'가'.repeat(300)}));
});
test('new public catalog favorites survive reload and their ids cannot be imported as personal apps',()=>{
 const publicIds=['number-picker','next-tool'];
 assert.deepEqual(validateBackup({version:1,apps:[app],favorites:['next-tool']},publicIds).favorites,['next-tool']);
 assert.throws(()=>validateApp({...app,id:'next-tool'},publicIds));
 assert.throws(()=>validateBackup({version:1,apps:[{...app,id:'next-tool'}],favorites:[]},publicIds));
});
test('a maximum-size valid catalog can export and import all 100 personal apps',()=>{
 const apps=Array.from({length:100},(_,i)=>({...app,id:'p'+i,title:'가'.repeat(40),description:'가'.repeat(160),url:'https://example.org/'+ 'a'.repeat(2028)}));
 const backup={version:1,apps,favorites:apps.map(a=>a.id)};
 const text=JSON.stringify(backup,null,2);
 assert.equal(typeof core.parseBackupText,'function');
 assert.equal(core.parseBackupText(text).apps.length,100);
 assert.throws(()=>core.parseBackupText(' '.repeat(1024*1024)));
});
