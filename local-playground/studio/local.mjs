// Node 22.13+ supplies SQLite; no packages or build are needed for local classroom use.
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { api } from './server.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),data=resolve(root,'.studio-data');
await mkdir(data,{recursive:true});const db=new DatabaseSync(resolve(data,'classroom.sqlite'));
for(const [index,name]of ['0000_studio','0001_teacher_tools'].entries())if(db.prepare('PRAGMA user_version').get().user_version<index+1){let sql;try{sql=await readFile(new URL(`./drizzle/${name}.sql`,import.meta.url),'utf8');}catch{sql=await readFile(new URL(`../drizzle/${name}.sql`,import.meta.url),'utf8');}db.exec('BEGIN');try{db.exec(sql);db.exec(`PRAGMA user_version = ${index+1}`);db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}}
export function databaseAdapter(db){return {prepare(sql){let args=[];return {bind(...values){args=values;return this;},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){return db.prepare(sql).run(...args);}};}};}
const env={DB:databaseAdapter(db),BUCKET:{async put(key,bytes,options){const file=resolve(data,'images',key);if(!file.startsWith(resolve(data,'images')+sep))throw Error('invalid asset');await mkdir(resolve(file,'..'),{recursive:true});await writeFile(file,new Uint8Array(bytes));await writeFile(file+'.meta',options.httpMetadata.contentType);},async get(key){const file=resolve(data,'images',key);if(!file.startsWith(resolve(data,'images')+sep))return null;try{return {body:await readFile(file),httpMetadata:{contentType:await readFile(file+'.meta','utf8')}};}catch{return null;}}}};
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.ttf':'font/ttf'};
const port=Number(process.env.STUDIO_PORT||8080);
const server=createServer(async(req,res)=>{try{
  const origin=`http://${req.headers.host}`,url=new URL(req.url,origin);let response;
  if(url.pathname.startsWith('/api/')){const request=new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:req,duplex:'half'}:{})});response=await api(request,env);}
  else {let path=decodeURIComponent(url.pathname);if(path==='/')path='/studio/';if(path.endsWith('/'))path+='index.html';const file=resolve(root,'.'+path);if(!file.startsWith(root)||path.split('/').some(p=>p.startsWith('.'))||!/^\/(studio|kids|lib|challenges)\//.test(path)||!['.html','.js','.mjs','.css','.ttf','.txt'].includes(extname(file)))response=new Response('Not found',{status:404});else try{response=new Response(await readFile(file),{headers:{'Content-Type':types[extname(file)]||'text/plain'}});}catch{response=new Response('Not found',{status:404});}}
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(req.method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()));
}catch(e){console.error(e);res.writeHead(500);res.end('Local server error');}});
server.listen(port,'127.0.0.1',()=>console.log(`Body Play Studio: http://127.0.0.1:${port}/studio/\nPrevious lesson: http://127.0.0.1:${port}/kids/\nStop: Ctrl+C`));
