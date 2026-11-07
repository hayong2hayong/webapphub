import {validateBackup,MAX_BACKUP_BYTES} from './core.mjs';

// A new public tool must never cause an older personal list to be discarded.
export function restoreHubState(input,publicIds){
 const personalIds=new Set(Array.isArray(input?.apps)?input.apps.map(app=>app?.id):[]);
 const state=validateBackup(input,publicIds.filter(id=>!personalIds.has(id)));
 const occupied=new Set([...publicIds,...state.apps.map(app=>app.id)]);
 const renamed=new Map();
 const apps=state.apps.map(app=>{
  if(!publicIds.includes(app.id))return app;
  const base=`personal-${app.id.slice(0,60)}`;let id=base;let suffix=2;
  while(occupied.has(id))id=`${base}-${suffix++}`;
  occupied.add(id);renamed.set(app.id,id);return {...app,id};
 });
 return validateBackup({...state,apps,favorites:state.favorites.map(id=>renamed.get(id)||id)},publicIds);
}
export function restoreHubBackupText(text,publicIds){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BACKUP_BYTES)throw new Error('백업 파일은 512KB 이하만 가져올 수 있어요.');
 return restoreHubState(JSON.parse(text),publicIds);
}
