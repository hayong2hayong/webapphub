import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeatingChart,validateSeatingOptions} from '../dist/apps/seating-chart/seating-core.mjs';
const options={studentCount:30,rows:5,columns:6,excluded:[],blocked:[],fixed:[]};
test('paired 3-section layout assigns every included student exactly once',()=>{
 const result=createSeatingChart(options,()=>0);
 assert.equal(result.rows,5);assert.equal(result.columns,6);assert.equal(result.cells.length,30);
 assert.deepEqual(result.cells.filter(n=>n!==null).sort((a,b)=>a-b),Array.from({length:30},(_,i)=>i+1));
});
test('fixed students keep their seats in different shuffles and never appear twice',()=>{
 const input={...options,studentCount:28,fixed:[{seat:0,number:9},{seat:17,number:3}],blocked:[5]};const before=structuredClone(input);
 for(const random of [()=>0,max=>max-1]){
  const result=createSeatingChart(input,random);
  assert.equal(result.cells[0],9);assert.equal(result.cells[17],3);assert.equal(result.cells[5],null);
  assert.equal(result.cells.filter(n=>n===9).length,1);assert.equal(result.cells.filter(n=>n===3).length,1);
  assert.equal(result.cells.filter(n=>n!==null).length,28);assert.equal(result.cells.filter(n=>n===null).length,2);
 }
 assert.deepEqual(input,before);
});
test('explicit empty seats and excluded students stay empty or absent',()=>{
 const result=createSeatingChart({...options,studentCount:6,excluded:[2],blocked:[0,4],fixed:[{seat:3,number:6}]},()=>0);
 assert.equal(result.cells[0],null);assert.equal(result.cells[4],null);assert.equal(result.cells[3],6);
 assert.deepEqual(result.cells.filter(n=>n!==null).sort((a,b)=>a-b),[1,3,4,5,6]);
 assert.equal(result.assignedCount,5);assert.deepEqual(result.blocked,[0,4]);assert.deepEqual(result.fixed,[{seat:3,number:6}]);
});
test('conflicting or duplicate fixed seats and numbers are rejected',()=>{
 for(const patch of [
  {fixed:[{seat:0,number:1},{seat:0,number:2}]},{fixed:[{seat:0,number:1},{seat:1,number:1}]},
  {blocked:[0],fixed:[{seat:0,number:1}]},{excluded:[1],fixed:[{seat:0,number:1}]},
  {studentCount:10,fixed:[{seat:0,number:11}]},{fixed:[{seat:30,number:1}]},
  {fixed:[{seat:0.5,number:1}]},{fixed:null},{fixed:[null]}
 ])assert.throws(()=>createSeatingChart({...options,...patch}));
});
test('too few seats or entirely excluded class fails without mutating previous input',()=>{
 const input={...options,blocked:[0],fixed:[{seat:1,number:1}]};const before=structuredClone(input);
 assert.throws(()=>createSeatingChart(input));assert.deepEqual(input,before);
 assert.throws(()=>createSeatingChart({...options,studentCount:2,excluded:[1,2]}));
});
test('class size is limited to 30 and geometry stays three pairs by five rows',()=>{
 for(const patch of [{studentCount:31},{studentCount:0},{studentCount:1.5},{rows:4},{columns:8},{excluded:[31]},{blocked:[30]},{blocked:null}])assert.throws(()=>validateSeatingOptions({...options,...patch}));
 assert.equal(createSeatingChart({...options,studentCount:1}).assignedCount,1);
});
test('all students may be fixed and remaining seats still display as empty',()=>{
 const result=createSeatingChart({...options,studentCount:2,fixed:[{seat:8,number:1},{seat:29,number:2}]});
 assert.equal(result.cells[8],1);assert.equal(result.cells[29],2);assert.equal(result.cells.filter(n=>n===null).length,28);
});
test('empty and exclusion duplicates normalize without changing the original lists',()=>{
 const input={...options,excluded:[2,2],blocked:[1,1],fixed:[{seat:3,number:5}]};const before=structuredClone(input);
 const result=validateSeatingOptions(input);assert.deepEqual(result.excluded,[2]);assert.deepEqual(result.blocked,[1]);assert.deepEqual(input,before);
});
