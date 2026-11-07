import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(fileURLToPath(new URL('../dist/',import.meta.url)));const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
const runtime={NEIS_API_KEY:process.env.NEIS_API_KEY||''};
if(process.argv.includes('--secret-stdin')){
 process.stdin.setEncoding('utf8');const tty=process.stdin.isTTY;if(tty)process.stdin.setRawMode(true);
 process.stderr.write('Ready for private local runtime input (hidden).\n');
 const line=await new Promise((resolve,reject)=>{let data='';const finish=()=>{process.stdin.removeAllListeners('data');if(tty)process.stdin.setRawMode(false);process.stdin.pause();};process.stdin.on('data',chunk=>{if(chunk.includes('\u0003')){finish();reject(new Error('cancelled'));return;}data+=chunk;if(data.length>4096){finish();reject(new Error('invalid input'));return;}if(/[\r\n]/.test(data)){finish();resolve(data.split(/[\r\n]/)[0]);}});});
 const input=JSON.parse(line);if(typeof input.NEIS_API_KEY!=='string')throw new Error('Runtime input is invalid');runtime.NEIS_API_KEY=input.NEIS_API_KEY;
}
const entries=new Map();const cache={async match(request){const hit=entries.get(request.url);return hit&&hit.until>Date.now()?hit.response.clone():undefined;},async put(request,response){entries.set(request.url,{until:Date.now()+300000,response:response.clone()});}};
let handler;
createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:4173');
  if(url.pathname==='/api/school-week'){
   if(!handler){const {createSchoolHandler}=await import('../server/school-api.mjs');handler=createSchoolHandler({cache});}
   const response=await handler(new Request(url,{method:req.method}),runtime,{waitUntil(promise){promise.catch(()=>{});}});
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const pathname=decodeURIComponent(url.pathname);let target=path.resolve(root,'.'+pathname);
  if(target!==root&&!target.startsWith(root+path.sep)||pathname.split('/').some(part=>part.startsWith('.'))||pathname.startsWith('/server/'))throw new Error();
  if((await stat(target)).isDirectory())target=path.join(target,'index.html');const bytes=await readFile(target);
  res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:bytes);
 }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('찾을 수 없는 페이지입니다.');}
}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
