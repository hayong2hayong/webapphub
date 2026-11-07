export const CATEGORIES=['수업 도구','교과 학습','학급 운영','창작 활동','종합 허브'];
export const BUILTIN_ID='number-picker';
export const MAX_BACKUP_BYTES=512*1024;
function integer(value,min,max,label){
 if(!Number.isInteger(value)||value<min||value>max) throw new Error(`${label}은(는) ${min}~${max} 사이의 정수로 입력해 주세요.`);
 return value;
}
export function parseExcluded(text,start,end){
 if(typeof text!=='string'||text.length>5000) throw new Error('제외 번호 입력이 너무 깁니다.');
 if(!text.trim()) return [];
 const tokens=text.trim().split(/[\s,]+/);
 if(tokens.some(t=>!/^\d+$/.test(t))) throw new Error('제외 번호는 쉼표 또는 공백으로 구분해 주세요. 예: 3, 7, 12');
 return [...new Set(tokens.map(t=>integer(Number(t),start,end,'제외 번호')))];
}
export function randomInteger(max){
 const limit=Math.floor(0x100000000/max)*max;
 const buffer=new Uint32Array(1);let value;
 do{crypto.getRandomValues(buffer);value=buffer[0];}while(value>=limit);
 return value%max;
}
export function drawNumbers(options,used=[],randomInt=randomInteger){
 const {start,end,count,excluded=[],avoidRepeats=true}=options;
 integer(start,1,999,'시작 번호');integer(end,start,999,'끝 번호');integer(count,1,100,'뽑을 개수');
 if(!Array.isArray(excluded)) throw new Error('제외 번호를 확인해 주세요.');
 excluded.forEach(n=>integer(n,start,end,'제외 번호'));
 const blocked=new Set([...excluded,...(avoidRepeats?used:[])]);
 const pool=Array.from({length:end-start+1},(_,i)=>i+start).filter(n=>!blocked.has(n));
 if(pool.length<count) throw new Error(`뽑을 수 있는 번호가 ${pool.length}개 남았어요. 개수를 줄이거나 다시 시작해 주세요.`);
 for(let i=pool.length-1;i>0;i--){const j=randomInt(i+1);[pool[i],pool[j]]=[pool[j],pool[i]];}
 return pool.slice(0,count);
}
function cleanText(value,max,label,required=true){
 if(typeof value!=='string'||value.length>max||/[\x00-\x1f\x7f]/.test(value)||required&&!value.trim()) throw new Error(`${label}을(를) ${required?'1':'0'}~${max}자로 입력해 주세요.`);
 return value.trim();
}
export function validateApp(input,publicIds=[BUILTIN_ID]){
 if(!input||typeof input!=='object'||Array.isArray(input)) throw new Error('앱 정보 형식을 확인해 주세요.');
 const id=cleanText(input.id,80,'앱 식별자');
 if(!/^[a-zA-Z0-9_-]+$/.test(id)||publicIds.includes(id)) throw new Error('앱 식별자가 올바르지 않습니다.');
 const title=cleanText(input.title,40,'앱 이름');const description=cleanText(input.description??'',160,'설명',false);
 const raw=cleanText(input.url,2048,'주소');let url;
 try{url=new URL(raw);}catch{throw new Error('https://로 시작하는 올바른 주소를 입력해 주세요.');}
 if(url.protocol!=='https:'||url.username||url.password||/[\s\\]/.test(raw)) throw new Error('로그인 정보가 없는 HTTPS 주소만 사용할 수 있어요.');
 if(url.href.length>2048) throw new Error('변환된 주소가 너무 길어요. 더 짧은 웹앱 주소를 입력해 주세요.');
 if(!CATEGORIES.includes(input.category)) throw new Error('분류를 선택해 주세요.');
 return {id,title,description,url:url.href,category:input.category};
}
export function validateBackup(input,publicIds=[BUILTIN_ID]){
 if(!input||input.version!==1||!Array.isArray(input.apps)||input.apps.length>100||!Array.isArray(input.favorites)||input.favorites.length>100+publicIds.length) throw new Error('지원하지 않는 백업 형식입니다. 앱은 최대 100개까지 가져올 수 있어요.');
 const apps=input.apps.map(app=>validateApp(app,publicIds));const ids=new Set(publicIds);
 for(const app of apps){if(ids.has(app.id)) throw new Error('중복된 앱 식별자가 있어 가져올 수 없습니다.');ids.add(app.id);}
 if(input.favorites.some(id=>typeof id!=='string'||!ids.has(id))) throw new Error('즐겨찾기 정보가 올바르지 않습니다.');
 return {version:1,apps,favorites:[...new Set(input.favorites)]};
}
export function parseBackupText(text,publicIds=[BUILTIN_ID]){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BACKUP_BYTES) throw new Error('백업 파일은 512KB 이하만 가져올 수 있어요.');
 return validateBackup(JSON.parse(text),publicIds);
}
export function filterApps(apps,query,category,favoriteIds,favoritesOnly){
 const normalized=query.trim().toLocaleLowerCase();
 return apps.filter(app=>(category==='전체'||app.category===category)&&(!favoritesOnly||favoriteIds.includes(app.id))&&`${app.title} ${app.description} ${app.category}`.toLocaleLowerCase().includes(normalized));
}
