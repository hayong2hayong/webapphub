import test from 'node:test';
import assert from 'node:assert/strict';
import * as hubState from '../dist/lib/hub-state.mjs';
const {restoreHubState}=hubState;
import {validateBackup} from '../dist/lib/core.mjs';
import {catalog} from '../dist/lib/catalog.mjs';
const publicIds=['number-picker','seating-chart'];
const personal={id:'legacy-app',title:'기존 앱',description:'',url:'https://example.org/tool',category:'학급 운영'};
test('existing version 1 personal apps and favorites survive a catalog addition',()=>{
 const previous={version:1,apps:[personal],favorites:['number-picker','legacy-app']};
 assert.deepEqual(restoreHubState(previous,publicIds),previous);
});
test('a legacy personal id colliding with a new public app is migrated without dropping data',()=>{
 const input={version:1,apps:[{...personal,id:'seating-chart'},{...personal,id:'personal-seating-chart'}],favorites:['number-picker','seating-chart']};
 const before=structuredClone(input);const result=restoreHubState(input,publicIds);
 assert.equal(result.apps.length,2);assert.equal(result.apps[0].id,'personal-seating-chart-2');
 assert.deepEqual(result.favorites,['number-picker','personal-seating-chart-2']);assert.deepEqual(input,before);
 assert.deepEqual(validateBackup(result,publicIds),result);
});
test('the complete new catalog allows seating favorites to round-trip through a JSON backup',()=>{
 assert.ok(catalog.some(app=>app.id==='seating-chart'));
 const backup={version:1,apps:[personal],favorites:['seating-chart','number-picker']};
 assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(backup)),catalog.map(app=>app.id)),backup);
});
test('importing a valid older backup migrates personal id collisions and enforces its file limit',()=>{
 const previous={version:1,apps:[{...personal,id:'seating-chart'}],favorites:['seating-chart']};
 assert.equal(typeof hubState.restoreHubBackupText,'function');
 const restored=hubState.restoreHubBackupText(JSON.stringify(previous),publicIds);
 assert.equal(restored.apps[0].id,'personal-seating-chart');
 assert.deepEqual(restored.favorites,['personal-seating-chart']);
 assert.throws(()=>hubState.restoreHubBackupText(' '.repeat(1024*1024),publicIds));
 assert.throws(()=>hubState.restoreHubBackupText('{broken}',publicIds));
});
