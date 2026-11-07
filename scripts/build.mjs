import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../dist/',import.meta.url));
const extensions=new Set(['.html','.css','.mjs','.js','.svg','.json','.png','.jpg','.jpeg','.webp','.avif','.gif','.ico','.woff','.woff2']);
const assets=[];

async function inspect(directory){
 for(const entry of await readdir(directory,{withFileTypes:true})){
  if(entry.name.startsWith('.')||entry.name.toLowerCase()==='server'||entry.isSymbolicLink())throw new Error('dist에는 공개 정적 파일만 둘 수 있습니다.');
  const full=path.join(directory,entry.name);
  if(entry.isDirectory()){await inspect(full);continue;}
  if(!entry.isFile()||!extensions.has(path.extname(entry.name).toLowerCase()))throw new Error(`지원하지 않는 공개 파일: ${path.relative(root,full)}`);
  if(/\.(mjs|js)$/.test(entry.name)){
   const check=spawnSync(process.execPath,['--check',full],{encoding:'utf8'});
   if(check.status!==0)throw new Error(check.stderr||`스크립트를 확인하지 못했습니다: ${entry.name}`);
  }
  assets.push(path.relative(root,full).split(path.sep).join('/'));
 }
}

await inspect(root);
for(const file of ['index.html','hub.mjs','styles.css','lib/catalog.mjs','apps/number-picker/index.html','apps/seating-chart/index.html']){
 if(!assets.includes(file))throw new Error(`필수 공개 파일이 없습니다: ${file}`);
}
console.log(`정적 파일 ${assets.length}개와 JavaScript 문법을 확인했습니다. 배포 폴더: dist/`);
