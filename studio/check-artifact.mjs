import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker from '../dist/server/index.js';
for(const path of ['/kids/','/kids/app.js','/kids/style.css','/kids/inputs.mjs','/kids/toys.js','/lib/tracker.js','/studio/','/studio/app.mjs','/studio/model.mjs','/challenges/','/studio/games.mjs','/studio/games.css']){
  const response=await worker.fetch(new Request('https://class.example'+path),{});
  assert.equal(response.status,200,path);
  const source=await readFile(new URL('..'+(path.endsWith('/')?path+'index.html':path),import.meta.url));
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),source,`${path} served without changes`);
}
assert.equal((await worker.fetch(new Request('https://class.example/studio'),{})).status,302);
assert.equal((await worker.fetch(new Request('https://class.example/.studio-data/classroom.sqlite'),{})).status,404);
console.log('PASS: deployed Worker serves the original lesson and new studio byte-for-byte; private files are not served');
