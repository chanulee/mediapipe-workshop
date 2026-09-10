// Static packaging only; the source app runs without a build step.
import { mkdir, copyFile, cp, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
await mkdir(new URL('dist/kids/', root), { recursive: true });
for (const file of ['index.html', 'style.css', 'app.js', 'lesson.mjs', 'recorder.js']) {
  await copyFile(new URL(`kids/${file}`, root), new URL(`dist/kids/${file}`, root));
}
await cp(new URL('lib/', root), new URL('dist/lib/', root), { recursive: true });
await writeFile(new URL('dist/index.html', root), '<!doctype html><html lang="ko"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=./kids/"><title>Stretch It!</title><a href="./kids/">Stretch It 열기</a></html>');
console.log('Static site ready in dist/');
