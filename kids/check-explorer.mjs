import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { sources,inputValue,inputPoint,mappedValue,primaryHand } from './inputs.mjs';
import { toys,freshSettings,inputControls,sceneControls } from './catalog.mjs';
const face={point:i=>({1:{x:.5,y:.3},33:{x:.6,y:.3},263:{x:.4,y:.3}}[i]),signals:{mouthOpen:.5,smile:.4,eyebrowRaise:.7}};
const hand=(x,label)=>({handedness:label,point:i=>({x:i===4?x-.1:x,y:.6}),signals:{pinch:.8,openness:.4,fingerCount:3}});
const hands=[hand(.2,'Left'),hand(.8,'Right')];
assert.deepEqual(inputValue(undefined,face,hands),{valid:false,value:0,points:[]});
for(const source of Object.keys(sources)){assert.equal(inputValue(source,null,[]).valid,false,source);const v=inputValue(source,face,hands);assert(v.valid,source);assert(v.value>=0&&v.value<=1,source);}
assert.equal(inputValue('hands',face,[hands[0]]).valid,false);
assert.equal(inputValue('noseHand',null,hands).valid,false);
assert.equal(inputValue('pinchGap',null,[hands[0]]).valid,true);
assert.equal(inputValue('tilt',face,hands).value,.5);
assert.equal(inputValue('handX',face,hands,'Right').value,.8);
assert.equal(primaryHand([...hands].reverse()).handedness,'Left');
assert.equal(inputPoint('nose',null,hands,null),null);
assert.deepEqual(inputPoint('hands',face,hands,null),{x:.5,y:.6});
for(const value of [0,.1,.5,1])assert.equal(mappedValue(value,{sensitivity:1,reverse:false})+mappedValue(value,{sensitivity:1,reverse:true}),1);
assert.equal(Object.keys(toys).length,8);
const all=freshSettings();all.stretch.amount=99;assert.equal(freshSettings().stretch.amount,60);
for(const [key,toy] of Object.entries(toys)){
 const controls=[...inputControls,...toy.controls,...sceneControls];assert.equal(new Set(controls.map(c=>c.key)).size,controls.length);
 for(const c of controls){assert.notEqual(toy.defaults[c.key],undefined,`${key}.${c.key}`);if(c.type==='range')assert(toy.defaults[c.key]>=c.min&&toy.defaults[c.key]<=c.max);if(c.options)assert(c.options[toy.defaults[c.key]]);}
}
// Execute all renderer branches with finite-argument canvas checks, without a camera or browser.
let calls=0;
const ctx=new Proxy({getImageData:()=>({data:new Uint8ClampedArray(960*720*4).fill(255)})},{get(target,key){return target[key]??((...args)=>{for(const arg of args)if(typeof arg==='number')assert(Number.isFinite(arg),String(key));calls++;});},set(target,key,value){if(typeof value==='number')assert(Number.isFinite(value),key);target[key]=value;return true;}});
const canvas=()=>({width:960,height:720,getContext:()=>ctx});
globalThis.document={createElement:()=>canvas()};globalThis.fetch=()=>Promise.reject(new Error('offline test'));
const {createToys}=await import('./toys.js');const render=createToys(canvas());
const fit={dx:0,dy:0,dw:960,dh:720};
for(const key of Object.keys(toys)){
 const s={...toys[key].defaults};
 for(const value of [0,.5,1])for(const point of [null,{x:480,y:360}])render.draw(key,s,{value,point,valid:!!point,now:1000,dt:1,img:null,face:null,hands:[],fit,volumeValue:1,sourceName:'연습'});
 if(key==='text')for(const mode of ['morph','gravity','trail'])render.draw(key,{...s,mode},{value:.5,point:{x:400,y:300},valid:true,now:2000,dt:1});
 if(key==='stretch')for(const effect of ['size','rotate','opacity','shake'])render.draw(key,{...s,effect},{value:1,point:null,now:1000,img:null});
 render.release();render.clear();
}
assert(calls>100);
console.log('PASS: 15 inputs, absent sensors, mirrored tilt, per-toy settings, control defaults, all 8 renderer branches');

const bytes=await readFile(new URL('./vendor/Roboto-Regular.ttf',import.meta.url));
globalThis.window={opentype:createRequire(import.meta.url)('./vendor/opentype.min.js')};
globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});
const vector=createToys(canvas());await new Promise(resolve=>setImmediate(resolve));
vector.draw('outline',toys.outline.defaults,{value:.5,point:{x:480,y:360},now:1000,dt:1});
console.log('PASS: bundled font parsing and original vector-path rendering');
