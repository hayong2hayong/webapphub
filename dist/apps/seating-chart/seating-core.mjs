import {randomInteger} from '../../lib/core.mjs';

function bounded(value,min,max,label){
 if(!Number.isInteger(value)||value<min||value>max)throw new Error(`${label}은(는) ${min}~${max} 사이의 정수로 입력해 주세요.`);
 return value;
}
export function validateSeatingOptions(options){
 if(!options||typeof options!=='object')throw new Error('배정 조건을 확인해 주세요.');
 const studentCount=bounded(options.studentCount,1,30,'학생 수');
 const {rows=5,columns=6,excluded=[],blocked=[],fixed=[]}=options;
 if(rows!==5||columns!==6)throw new Error('자리 배치는 짝꿍 3분단, 5행(30석)을 사용해 주세요.');
 if(!Array.isArray(excluded)||!Array.isArray(blocked)||!Array.isArray(fixed))throw new Error('제외 번호·빈자리·고정석 설정을 확인해 주세요.');
 excluded.forEach(number=>bounded(number,1,studentCount,'제외 번호'));
 blocked.forEach(index=>bounded(index,0,rows*columns-1,'자리 위치'));
 const normalizedFixed=[];const fixedSeats=new Set(),fixedNumbers=new Set();
 for(const item of fixed){
  if(!item||typeof item!=='object')throw new Error('고정석 설정을 확인해 주세요.');
  const seat=bounded(item.seat,0,29,'고정석 위치'),number=bounded(item.number,1,studentCount,'고정할 번호');
  if(fixedSeats.has(seat))throw new Error('한 자리에는 한 번호만 고정할 수 있어요.');
  if(fixedNumbers.has(number))throw new Error(`${number}번이 이미 다른 자리에 고정되어 있어요.`);
  if(blocked.includes(seat))throw new Error('빈자리로 지정한 자리에는 번호를 고정할 수 없어요.');
  if(excluded.includes(number))throw new Error(`${number}번은 제외 번호이면서 고정석에 지정되어 있어요. 고정을 해제하거나 제외 번호를 바꿔 주세요.`);
  fixedSeats.add(seat);fixedNumbers.add(number);normalizedFixed.push({seat,number});
 }
 return {studentCount,rows,columns,excluded:[...new Set(excluded)].sort((a,b)=>a-b),blocked:[...new Set(blocked)].sort((a,b)=>a-b),fixed:normalizedFixed.sort((a,b)=>a.seat-b.seat)};
}
export function createSeatingChart(options,randomInt=randomInteger){
 const validated=validateSeatingOptions(options);
 const {rows,columns,studentCount,excluded,blocked,fixed}=validated;
 const excludedSet=new Set(excluded),blockedSet=new Set(blocked),fixedMap=new Map(fixed.map(item=>[item.seat,item.number])),fixedNumbers=new Set(fixed.map(item=>item.number));
 const students=Array.from({length:studentCount},(_,i)=>i+1).filter(number=>!excludedSet.has(number));
 if(students.length===0)throw new Error('배정할 번호가 없어요. 제외 번호를 줄여 주세요.');
 const available=rows*columns-blocked.length;
 if(available<students.length)throw new Error(`빈자리를 제외하면 ${available}석, 배정할 번호는 ${students.length}개예요. 빈자리 지정이나 제외 번호를 확인해 주세요.`);
 const pool=[...students.filter(number=>!fixedNumbers.has(number)),...Array(available-students.length).fill(null)];
 for(let i=pool.length-1;i>0;i--){const j=randomInt(i+1);[pool[i],pool[j]]=[pool[j],pool[i]];}
 let cursor=0;
 const cells=Array.from({length:rows*columns},(_,index)=>fixedMap.has(index)?fixedMap.get(index):blockedSet.has(index)?null:pool[cursor++]);
 return {rows,columns,cells,blocked,fixed,studentCount,assignedCount:students.length};
}
