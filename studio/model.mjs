import { toys as originalToys } from '../kids/catalog.mjs';
import { gameToys, gameOutputs } from './games.mjs';
import { sources, pointers, mappedValue } from '../kids/inputs.mjs';
export const toys={...originalToys,...gameToys};
export const imageKeys=['image','foodImage','coverImage'];

export const outputs = { reaction:'장난감의 반응', ...gameOutputs };
export const allowedOutputs=toy=>Object.fromEntries(Object.entries(outputs).filter(([key])=>Object.hasOwn(gameToys,toy)?key!=='reaction'&&(toy==='catch'||!['moveX','moveY'].includes(key)):!['moveX','moveY'].includes(key)));
export const presets = [
  ['stretch','손으로 그림 늘리기','hands','size'],
  ['stretch','입으로 그림 돌리기','mouth','rotate'],
  ['follow','코를 따라오는 별','noseX','reaction'],
  ['draw','손가락으로 그림 그리기','pinch','reaction'],
  ['music','입으로 연주하기','mouth','reaction'],
  ['text','손으로 글자 밀기','pinchGap','reaction'],
  ['outline','코로 글자 간질이기','mouth','reaction'],
];
export function newConnection(source='hands', output='size') {
  return { source, output, sensitivity:1, reverse:false, smoothing:.5, amount:.8 };
}
export function fromPreset(index=0) {
  const [toy,,source,output]=presets[index]||presets[0];
  const settings={...toys[toy].defaults};
  if(toy==='outline') settings.pointer='nose';
  if(toy==='stretch') settings.placement='center';
  return {toy,settings,connections:[newConnection(source,output)],title:'',instruction:'',image:null,foodImage:null,coverImage:null};
}
export function normalize(raw) {
  if(!raw || !Object.hasOwn(toys,raw.toy)) throw new Error('장난감을 다시 골라주세요.');
  const toy=raw.toy, settings={...toys[toy].defaults};
  // Only catalog fields enter the renderer; numeric values retain their advertised limits.
  for(const spec of [...toys[toy].controls]) {
    const v=raw.settings?.[spec.key];
    if(spec.type==='range' && Number.isFinite(v)) settings[spec.key]=Math.min(spec.max,Math.max(spec.min,v));
    if(spec.type==='select' && Object.hasOwn(spec.options,v)) settings[spec.key]=v;
    if(spec.type==='checkbox' && typeof v==='boolean') settings[spec.key]=v;
    if(spec.type==='text' && typeof v==='string') settings[spec.key]=v.slice(0,24);
  }
  for(const k of ['color','background']) if(/^#[a-f\d]{6}$/i.test(raw.settings?.[k])) settings[k]=raw.settings[k];
  for(const k of ['cameraOpacity','guides','pointer','hand']) {
    const v=raw.settings?.[k];
    if(k==='cameraOpacity' && Number.isFinite(v)) settings[k]=Math.max(0,Math.min(1,v));
    if(k==='guides' && typeof v==='boolean') settings[k]=v;
    if(k==='pointer' && Object.hasOwn(pointers,v)) settings[k]=v;
    if(k==='hand' && ['auto','Left','Right'].includes(v)) settings[k]=v;
  }
  const connections=(Array.isArray(raw.connections)?raw.connections:[]).slice(0,Object.hasOwn(gameToys,toy)?4:2).map(c=>{
    if(!c || !Object.hasOwn(sources,c.source) || !Object.hasOwn(allowedOutputs(toy),c.output)) throw new Error('움직임과 반응을 다시 골라주세요.');
    const clean=newConnection(c.source,c.output);
    for(const [k,min,max] of [['sensitivity',.25,3],['smoothing',0,.95],['amount',0,1]]) if(Number.isFinite(c[k])) clean[k]=Math.max(min,Math.min(max,c[k]));
    clean.reverse=c.reverse===true;return clean;
  });
  if(!connections.length || new Set(connections.map(c=>c.output)).size!==connections.length) throw new Error('서로 다른 반응을 연결해주세요.');
  const required=toy==='catch'?['moveX','moveY']:toy==='fit'?['size']:[];
  if(required.some(output=>!connections.some(c=>c.output===output)))throw new Error('이 챌린지의 기본 조종 연결을 유지해주세요.');
  return {toy,settings,connections,title:String(raw.title||'').trim().slice(0,40),instruction:String(raw.instruction||'').trim().slice(0,160),...Object.fromEntries(imageKeys.map(key=>[key,typeof raw[key]==='string'&&/^[a-f\d-]{36}$/.test(raw[key])?raw[key]:null]))};
}
export function advanceValue(previous,input,c,dt=1) {
  const target=mappedValue(input,c);
  return previous+(target-previous)*(1-c.smoothing**dt);
}
export function sentence(project) {
  return project.connections.map(c=>`${sources[c.source]} → ${c.reverse?'반대로 · ':''}${outputs[c.output]}`).join(' / ');
}
