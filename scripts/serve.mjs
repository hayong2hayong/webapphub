import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(fileURLToPath(new URL('../dist/',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};

createServer(async(req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
  const url=new URL(req.url,'http://127.0.0.1:8000');
  const pathname=decodeURIComponent(url.pathname);
  const parts=pathname.split(/[\\/]/);
  let target=path.resolve(root,'.'+pathname);
  if(target!==root&&!target.startsWith(root+path.sep)||parts.some(part=>part.startsWith('.'))||parts[1]==='server')throw new Error();
  if((await stat(target)).isDirectory())target=path.join(target,'index.html');
  const bytes=await readFile(target);
  res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(req.method==='HEAD'?undefined:bytes);
 }catch{
  res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});
  res.end(req.method==='HEAD'?undefined:'찾을 수 없는 페이지입니다.');
 }
}).listen(8000,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:8000'));
