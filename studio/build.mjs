import { mkdir, readFile, writeFile, cp, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=new URL('../',import.meta.url);
execFileSync(process.execPath,['kids/build.mjs'],{cwd:fileURLToPath(root),stdio:'inherit'});
await mkdir(new URL('dist/studio/',root),{recursive:true});
for(const name of ['index.html','style.css','updates.css','app.mjs','model.mjs','games.mjs','games.css'])await cp(new URL('studio/'+name,root),new URL('dist/studio/'+name,root));
await cp(new URL('challenges/',root),new URL('dist/challenges/',root),{recursive:true});
const types={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',mjs:'text/javascript; charset=utf-8',ttf:'font/ttf',txt:'text/plain; charset=utf-8',md:'text/plain; charset=utf-8'};
const assets={};
async function collect(relative){for(const entry of await readdir(new URL(relative,root),{withFileTypes:true})){const path=relative+'/'+entry.name;if(entry.isDirectory())await collect(path);else{const ext=entry.name.split('.').at(-1);assets['/'+path.slice(5)]=[types[ext]||'application/octet-stream',(await readFile(new URL(path,root))).toString('base64')];}}}
for(const relative of ['dist/kids','dist/lib','dist/studio','dist/challenges'])await collect(relative);
assets['/index.html']=['text/html; charset=utf-8',(await readFile(new URL('dist/index.html',root))).toString('base64')];
await mkdir(new URL('dist/server/studio/',root),{recursive:true});
await mkdir(new URL('dist/.openai/',root),{recursive:true});
await writeFile(new URL('dist/server/assets.mjs',root),'export default '+JSON.stringify(assets)+';\n');
await writeFile(new URL('dist/server/index.js',root),(await readFile(new URL('studio/worker.mjs',root),'utf8')).replace("'./server.mjs'","'./studio/server.mjs'"));
for(const name of ['server.mjs','model.mjs','games.mjs'])await cp(new URL('studio/'+name,root),new URL('dist/server/studio/'+name,root));
await cp(new URL('kids/',root),new URL('dist/server/kids/',root),{recursive:true});
await cp(new URL('lib/',root),new URL('dist/server/lib/',root),{recursive:true});
await cp(new URL('.openai/hosting.json',root),new URL('dist/.openai/hosting.json',root));
await cp(new URL('drizzle/',root),new URL('dist/.openai/drizzle/',root),{recursive:true});
// Keep the earlier standalone lesson intact and add this lesson beside it.
await mkdir(new URL('local-playground/studio/',root),{recursive:true});
for(const name of ['index.html','style.css','updates.css','app.mjs','model.mjs','server.mjs','local.mjs','README.md','games.mjs','games.css'])await cp(new URL('studio/'+name,root),new URL('local-playground/studio/'+name,root));
await cp(new URL('challenges/',root),new URL('local-playground/challenges/',root),{recursive:true});
await cp(new URL('lib/',root),new URL('local-playground/lib/',root),{recursive:true});
await cp(new URL('drizzle/',root),new URL('local-playground/studio/drizzle/',root),{recursive:true});
console.log('Studio Worker, existing lesson, and local standalone lesson ready.');
