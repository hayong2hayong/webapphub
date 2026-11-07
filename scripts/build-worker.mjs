import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const projectRoot=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon'};
export async function buildWorker(root=projectRoot){
 const manifest=JSON.parse(await readFile(path.join(root,'.openai/hosting.json'),'utf8'));
 if(manifest.static)throw new Error('Worker 배포 전 원본 hosting.json에서 static 설정을 제거하세요.');
 const assets={};const assetRoot=path.join(root,'dist');
 async function collect(directory){
  for(const item of await readdir(directory,{withFileTypes:true})){
   if(item.name.startsWith('.')||directory===assetRoot&&item.name==='server')continue;
   const full=path.join(directory,item.name);
   if(item.isSymbolicLink())throw new Error('공개 자원에 심볼릭 링크를 포함할 수 없습니다.');
   if(item.isDirectory()){await collect(full);continue;}
   const extension=path.extname(item.name).toLowerCase();if(!types[extension])continue;
   const bytes=await readFile(full);const text=['.html','.css','.mjs','.js','.svg','.json'].includes(extension);
   assets['/'+path.relative(assetRoot,full).split(path.sep).join('/')]={body:bytes.toString(text?'utf8':'base64'),encoding:text?'text':'base64',type:types[extension]};
  }
 }
 await collect(assetRoot);
 if(!assets['/index.html'])throw new Error('허브 index.html이 없습니다.');
 const api=await readFile(path.join(root,'server/school-api.mjs'),'utf8');
 if(/^\s*import\s/m.test(api))throw new Error('서버 모듈은 외부 import 없이 빌드되어야 합니다.');
 const source=`${api}\nconst PUBLIC_ASSETS=${JSON.stringify(assets)};\nconst schoolHandler=createSchoolHandler();\nexport default {async fetch(request,env={},ctx={}){\n const url=new URL(request.url);\n if(url.pathname.startsWith('/api/')){if(url.pathname!=='/api/school-week')return new Response('Not found',{status:404});return schoolHandler(request,env,ctx);}\n if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});\n let key=url.pathname;if(key.endsWith('/'))key+='index.html';\n if(!PUBLIC_ASSETS[key]&&!url.pathname.endsWith('/')&&PUBLIC_ASSETS[url.pathname+'/index.html'])return Response.redirect(url.origin+url.pathname+'/'+url.search,308);\n const asset=PUBLIC_ASSETS[key];if(!asset)return new Response('Not found',{status:404});\n const body=asset.encoding==='text'?asset.body:Uint8Array.from(atob(asset.body),char=>char.charCodeAt(0));\n return new Response(request.method==='HEAD'?null:body,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});\n}};\n`;
 await mkdir(path.join(root,'dist/server'),{recursive:true});await mkdir(path.join(root,'dist/.openai'),{recursive:true});
 await writeFile(path.join(root,'dist/server/index.js'),source);
 await writeFile(path.join(root,'dist/.openai/hosting.json'),JSON.stringify(manifest,null,2)+'\n');
 return {assetCount:Object.keys(assets).length,workerBytes:Buffer.byteLength(source)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(await buildWorker()));
