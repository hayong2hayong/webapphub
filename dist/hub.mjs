import {CATEGORIES,validateApp,MAX_BACKUP_BYTES,filterApps} from './lib/core.mjs';
import {catalog} from './lib/catalog.mjs';
import {restoreHubState,restoreHubBackupText} from './lib/hub-state.mjs';
import {el,icon,decorateIcons,notify,showDialog,wireDialogs,downloadJSON} from './lib/ui.mjs';
decorateIcons();wireDialogs();
const $=selector=>document.querySelector(selector);
const KEY='classroom-toolbox:v1';
const publicIds=catalog.map(app=>app.id);
let state={version:1,apps:[],favorites:[]};let category='전체';let favoritesOnly=false;let pendingImport=null;
const warning=$('#storage-warning');
function storageWarning(message){warning.textContent=message;warning.hidden=false;}
try{const raw=localStorage.getItem(KEY);if(raw)state=restoreHubState(JSON.parse(raw),publicIds);}catch{storageWarning('저장된 목록을 불러오지 못했어요. 현재 탭에서는 사용할 수 있으며, 백업 파일이 있다면 가져와 주세요.');}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));warning.hidden=true;}catch{storageWarning('브라우저 저장 공간을 사용할 수 없어 현재 탭에서만 변경이 유지돼요. 목록을 백업해 주세요.');}}
function render(){
 const grid=$('#app-grid');grid.replaceChildren();const all=[...catalog,...state.apps];
 const filtered=filterApps(all,$('#search').value,category,state.favorites,favoritesOnly);
 $('#app-count').textContent=`${filtered.length}개의 도구`;
 for(const app of filtered){
  const card=el('article','app-card');const top=el('div','card-top');const tool=el('div',`tool-icon${app.builtin?'':' custom'}`);tool.append(icon(app.icon||'folder'));top.append(tool);
  const controls=el('div','card-controls');
  if(!publicIds.includes(app.id)){const edit=el('button','icon-button');edit.dataset.appId=app.id;edit.append(icon('edit'));edit.title='앱 수정';edit.setAttribute('aria-label',`${app.title} 수정`);edit.addEventListener('click',()=>openEditor(app));controls.append(edit);}
  const selected=state.favorites.includes(app.id);const favorite=el('button',`icon-button favorite${selected?' selected':''}`);favorite.append(icon('star'));favorite.setAttribute('aria-label',`${app.title} 즐겨찾기`);favorite.setAttribute('aria-pressed',String(selected));favorite.addEventListener('click',()=>{
   state.favorites=state.favorites.includes(app.id)?state.favorites.filter(id=>id!==app.id):[...state.favorites,app.id];persist();render();
   const replacement=[...grid.querySelectorAll('.favorite')].find(button=>button.getAttribute('aria-label')===`${app.title} 즐겨찾기`);(replacement||$('#search')).focus();
   notify(state.favorites.includes(app.id)?'즐겨찾기에 추가했어요.':'즐겨찾기에서 해제했어요.');
  });controls.append(favorite);top.append(controls);card.append(top);
  const link=el('a','app-link');link.href=app.url;if(!app.builtin){link.target='_blank';link.rel='noopener noreferrer';link.setAttribute('aria-label',`${app.title} 열기 (새 탭)`);}
  link.append(el('h3','',app.title),el('p','',app.description||'나만의 웹앱을 바로 실행하세요.'));
  const bottom=el('div','card-bottom');bottom.append(el('span','tag',app.category));const action=el('span','card-action',app.builtin?'열기':'새 탭으로 열기');action.append(icon(app.builtin?'arrow':'external'));bottom.append(action);link.append(bottom);card.append(link);grid.append(card);
 }
 $('#empty').hidden=filtered.length>0;
 if(!favoritesOnly&&!$('#search').value.trim()&&category==='전체'){
  const add=el('button','add-card');const circle=el('span','add-circle');circle.append(icon('plus'));add.append(circle,el('strong','','나만의 앱 추가하기'),el('small','','새로운 아이디어가 들어갈 자리'));add.addEventListener('click',()=>openEditor());grid.append(add);
 }
}
function setFilter(button){category=button.dataset.category||'전체';favoritesOnly=button.dataset.filter==='favorites';$('.filters').querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});render();}
$('.filters').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>setFilter(button)));
$('#search').addEventListener('input',render);
$('#reset-filter').addEventListener('click',()=>{$('#search').value='';setFilter($('[data-filter="all"]'));$('#search').focus();});
document.addEventListener('keydown',event=>{if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!document.querySelector('dialog[open]')&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){event.preventDefault();$('#search').focus();}});
function openEditor(app){
 const form=$('#app-form');form.reset();$('#app-error').textContent='';$('#edit-title').textContent=app?'앱 수정':'새 앱 추가';$('#delete-app').hidden=!app;
 for(const name of ['id','title','url','description','category']) form.elements.namedItem(name).value=app?.[name]??(name==='category'?CATEGORIES[0]:'');
 showDialog($('#edit-dialog'));$('#app-title').focus();
}
document.querySelectorAll('[data-add]').forEach(button=>button.addEventListener('click',()=>openEditor()));
$('#app-form').addEventListener('submit',event=>{
 event.preventDefault();const form=event.currentTarget;const input=Object.fromEntries(new FormData(form));const isNew=!input.id;
 try{if(isNew&&state.apps.length>=100)throw new Error('개인 앱은 최대 100개까지 저장할 수 있어요.');if(isNew)input.id=crypto.randomUUID();const app=validateApp(input,publicIds);state.apps=isNew?[...state.apps,app]:state.apps.map(row=>row.id===app.id?app:row);persist();$('#edit-dialog').close();render();const returnTarget=[...document.querySelectorAll('[data-app-id]')].find(button=>button.dataset.appId===app.id)||$('[data-add]');$('#edit-dialog').returnFocus=returnTarget;returnTarget.focus();notify(isNew?'새 앱을 도구함에 추가했어요.':'앱 정보를 저장했어요.');}
 catch(error){$('#app-error').textContent=error.message;}
});
$('#delete-app').addEventListener('click',()=>{$('#delete-description').textContent=`‘${$('#app-title').value}’ 링크를 내 도구함에서 삭제합니다.`;showDialog($('#delete-dialog'));});
$('#confirm-delete').addEventListener('click',()=>{const id=$('#app-form').elements.namedItem('id').value;state.apps=state.apps.filter(app=>app.id!==id);state.favorites=state.favorites.filter(row=>row!==id);persist();$('#delete-dialog').close();$('#edit-dialog').close();render();$('[data-add]').focus();notify('앱을 내 도구함에서 삭제했어요.');});
function exportList(){downloadJSON(state);notify('개인 앱과 즐겨찾기를 백업했어요.');}
$('#backup-button').addEventListener('click',exportList);$('#export-button').addEventListener('click',exportList);
$('#manage-button').addEventListener('click',()=>{pendingImport=null;$('#import-preview').hidden=true;$('#import-error').textContent='';showDialog($('#manage-dialog'));});
$('#about-button').addEventListener('click',()=>showDialog($('#about-dialog')));
$('#import-button').addEventListener('click',()=>$('#import-file').click());
$('#import-file').addEventListener('change',async event=>{
 const file=event.target.files[0];event.target.value='';pendingImport=null;$('#import-preview').hidden=true;$('#import-error').textContent='';if(!file)return;
 try{if(file.size>MAX_BACKUP_BYTES)throw new Error('백업 파일은 512KB 이하만 가져올 수 있어요.');pendingImport=restoreHubBackupText(await file.text(),publicIds);$('#import-summary').textContent=`개인 앱 ${pendingImport.apps.length}개 · 즐겨찾기 ${pendingImport.favorites.length}개`;$('#import-preview').hidden=false;$('#confirm-import').focus();}
 catch(error){$('#import-error').textContent=error instanceof SyntaxError?'올바른 JSON 백업 파일이 아닙니다. 기존 목록은 유지됩니다.':error.message;}
});
$('#cancel-import').addEventListener('click',()=>{pendingImport=null;$('#import-preview').hidden=true;$('#import-button').focus();});
$('#confirm-import').addEventListener('click',()=>{if(!pendingImport)return;state=pendingImport;pendingImport=null;persist();$('#manage-dialog').close();$('#search').value='';setFilter($('[data-filter="all"]'));notify('백업 목록을 가져왔어요.');});
render();
