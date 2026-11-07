import {drawNumbers,parseExcluded} from '../../lib/core.mjs';
import {decorateIcons,el,notify} from '../../lib/ui.mjs';
decorateIcons();const $=selector=>document.querySelector(selector);
let used=[];let history=[];let round=0;let sessionKey=null;
function readOptions(){const start=Number($('#start').value),end=Number($('#end').value);return {start,end,count:Number($('#count').value),excluded:parseExcluded($('#excluded').value,start,end),avoidRepeats:$('#avoid-repeats').checked};}
function keyFor(options){return JSON.stringify([options.start,options.end,[...options.excluded].sort((a,b)=>a-b),options.avoidRepeats]);}
function updatePool(){
 try{const options=readOptions();if(!Number.isInteger(options.start)||!Number.isInteger(options.end)||options.start<1||options.end<options.start||options.end>999)throw new Error();const previous=keyFor(options)===sessionKey?used:[];const blocked=new Set([...options.excluded,...(options.avoidRepeats?previous:[])]);const remaining=options.end-options.start+1-blocked.size;$('#pool-count').textContent=`${remaining}개 번호 ${round&&keyFor(options)===sessionKey?'남았어요':'중에서'}`;}
 catch{$('#pool-count').textContent='설정을 확인해 주세요';}
}
function renderHistory(){const list=$('#history-list');list.replaceChildren();$('#history-empty').hidden=history.length>0;for(const entry of history){const row=el('li');row.append(el('span','history-round',`${entry.round}회차`),el('span','history-values',entry.numbers.map(n=>`${n}번`).join(' · ')));list.append(row);}}
function draw(){
 const error=$('#picker-error');error.textContent='';
 try{
  const options=readOptions();const nextKey=keyFor(options);const changed=sessionKey!==nextKey;const prior=changed?[]:used;
  const numbers=drawNumbers(options,prior); // Validate and draw before changing a successful previous result.
  if(changed){used=[];history=[];round=0;}sessionKey=nextKey;round++;
  used=[...new Set([...used,...numbers])];history=[{round,numbers},...history].slice(0,20);
  $('#result-placeholder').hidden=true;const result=$('#result-numbers');result.replaceChildren();result.classList.toggle('many',numbers.length>4);numbers.forEach(n=>{const ball=el('span','number-ball',String(n));ball.setAttribute('aria-label',`${n}번`);result.append(ball);});
  $('#result-caption').textContent=numbers.length===1?'이번 차례의 주인공이에요!':`${numbers.length}개의 번호가 뽑혔어요!`;
  $('#draw-label').textContent='한 번 더 뽑기';$('#result-announcement').textContent=`${round}회차: ${numbers.join(', ')}번이 뽑혔습니다.`;renderHistory();updatePool();
 }catch(cause){error.textContent=cause.message;}
}
$('#draw').addEventListener('click',draw);$('#settings').addEventListener('submit',event=>{event.preventDefault();draw();});
$('#settings').addEventListener('input',()=>{updatePool();if(sessionKey){try{if(keyFor(readOptions())!==sessionKey)$('#result-caption').textContent='설정이 바뀌었어요. 다음 추첨은 새로 시작돼요.';}catch{}}});
$('#reset').addEventListener('click',()=>{used=[];history=[];round=0;sessionKey=null;$('#result-numbers').replaceChildren();$('#result-placeholder').hidden=false;$('#result-caption').textContent='새로운 추첨을 시작해 보세요';$('#picker-error').textContent='';$('#draw-label').textContent='번호 뽑기';$('#result-announcement').textContent='추첨 기록과 뽑은 번호를 초기화했습니다.';renderHistory();updatePool();notify('추첨을 다시 시작할 준비가 됐어요.');});
$('#fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('#result-panel').requestFullscreen)await $('#result-panel').requestFullscreen();else notify('이 브라우저는 전체 화면을 지원하지 않아요.');}catch{notify('전체 화면을 열 수 없어요. 브라우저 설정을 확인해 주세요.');}});
document.addEventListener('fullscreenchange',()=>{const label=document.fullscreenElement?'전체 화면 종료':'결과 전체 화면';$('#fullscreen').setAttribute('aria-label',label);$('#fullscreen').title=label;});updatePool();
