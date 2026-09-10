import { toys, freshSettings, inputControls, sceneControls } from './catalog.mjs';
import { sources, inputValue, inputPoint, mappedValue } from './inputs.mjs';
import { drawVideo, videoFit, toCanvas, clamp } from '../lib/utils.js';
import { createToys } from './toys.js';
const $=id=>document.getElementById(id);
export function createExplorer(canvas, onSwitch){
  const renderer=createToys(canvas),ctx=canvas.getContext('2d');let settings=freshSettings(),key='stretch',last=0,smoothed=0,mouse=null;
  const select=$('toy-select');for(const [id,toy] of Object.entries(toys)){const option=document.createElement('option');option.value=id;option.textContent=toy.name;select.append(option);}
  function controls(host,descriptors){
    host.replaceChildren();
    for(const spec of descriptors){const row=document.createElement('label');row.className='explore-control';const label=document.createElement('span');label.textContent=spec.label;row.append(label);
      const control=document.createElement(spec.type==='select'?'select':'input');control.id='explore-'+spec.key;
      if(spec.type==='select')for(const [value,name] of Object.entries(spec.options)){const option=document.createElement('option');option.value=value;option.textContent=name;control.append(option);}
      else{control.type=spec.type;for(const attr of ['min','max','step'])if(spec[attr]!==undefined)control[attr]=spec[attr];if(spec.type==='text')control.maxLength=24;}
      if(spec.type==='checkbox')control.checked=settings[key][spec.key];else control.value=settings[key][spec.key];
      const output=document.createElement('output');if(spec.type==='range')output.textContent=control.value;label.append(output);row.append(control);host.append(row);
      control.oninput=()=>{settings[key][spec.key]=spec.type==='checkbox'?control.checked:spec.type==='range'?+control.value:control.value;output.textContent=spec.type==='range'?control.value:'';if(['source','pointer','hand','reverse'].includes(spec.key)){smoothed=0;renderer.release();}};
    }
  }
  function panel(){
    select.value=key;controls($('explore-inputs'),inputControls);controls($('explore-effects'),toys[key].controls);controls($('explore-scene'),sceneControls);
    $('toy-hint').textContent=toys[key].hint;$('stage-title').textContent=toys[key].name.split(' · ')[0];$('stage-eyebrow').textContent='EXPLORE / 자유롭게 실험하기';
    $('explore-image').hidden=key!=='stretch';$('audio-toggle').hidden=key!=='music';$('audio-toggle').textContent='♪ 소리 켜기';$('clear-drawing').hidden=key!=='draw';
    $('input-description').textContent='값은 반응을, 위치는 작품이 움직일 곳을 정해요. 데모에서는 슬라이더와 마우스를 사용해요.';
  }
  select.onchange=()=>{onSwitch();renderer.mute();key=select.value;renderer.release();smoothed=0;panel();};
  $('toy-reset').onclick=()=>{onSwitch();renderer.mute();settings[key]={...toys[key].defaults};renderer.clear();panel();};
  $('clear-drawing').onclick=()=>renderer.clear();
  $('audio-toggle').onclick=async()=>{try{$('audio-toggle').textContent=await renderer.toggleAudio()?'■ 소리 끄기':'♪ 소리 켜기';}catch{$('explore-status').textContent='소리를 켜지 못했어요. 다시 눌러주세요.';}};
  document.addEventListener('visibilitychange',()=>{if(document.hidden){renderer.mute();$('audio-toggle').textContent='♪ 소리 켜기';}});
  function pointer(e){const box=canvas.getBoundingClientRect();mouse={x:clamp((e.clientX-box.left)/box.width),y:clamp((e.clientY-box.top)/box.height)};}
  canvas.addEventListener('pointermove',pointer);canvas.addEventListener('pointerdown',pointer);canvas.addEventListener('pointerleave',()=>{mouse=null;});
  return {getAudioTracks:renderer.getAudioTracks,mute:()=>{renderer.mute();$('audio-toggle').textContent='♪ 소리 켜기';},
    enter(initial){Object.assign(settings.stretch,initial);key='stretch';panel();},reset(){renderer.mute();renderer.clear();settings=freshSettings();key='stretch';},
    draw({now,video,face,hands,demo,img,tracker}){
      const s=settings[key],dt=Math.min(2,Math.max(.1,(now-last)/16.667||1));last=now;
      if(tracker)tracker.opts.smoothing=s.smoothing;
      ctx.fillStyle=s.background;ctx.fillRect(0,0,canvas.width,canvas.height);drawVideo(video,ctx,canvas.width,canvas.height,{opacity:s.cameraOpacity});
      const fit=videoFit(video,canvas.width,canvas.height);
      const input=demo?{valid:true,value:+$('demo-distance').value/100,points:[]}:inputValue(s.source,face,hands,s.hand);
      const target=inputPoint(demo?'mouse':s.pointer,face,hands,mouse,s.hand);
      const point=target?(demo||s.pointer==='mouse'?{x:target.x*canvas.width,y:target.y*canvas.height}:toCanvas(target,fit)):null;
      const value=mappedValue(input.value,s);smoothed+=(value-smoothed)*(1-s.smoothing**dt);
      const volumeInput=demo?input:inputValue(s.volumeSource,face,hands,s.hand);
      const volumeValue=s.volumeSource==='constant'?1:volumeInput.valid?volumeInput.value:0;
      renderer.draw(key,s,{value:smoothed,point,valid:input.valid,now,dt,img,face,hands,fit,volumeValue,sourceName:sources[s.source]});
      if(s.guides){ctx.fillStyle=s.color;for(const p of input.points){const a=toCanvas(p,fit);ctx.beginPath();ctx.arc(a.x,a.y,7,0,Math.PI*2);ctx.fill();}if(point){ctx.strokeStyle=s.color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(point.x,point.y,15,0,Math.PI*2);ctx.stroke();}}
      $('hands').textContent=demo?'연습 입력 · 데모':`손 ${hands.length} / 2 · 얼굴 ${face?'✓':'—'}`;
      $('sensor-label').textContent=sources[s.source];$('distance').value=input.valid?input.value*100:0;$('distance-value').textContent=input.valid?`${Math.round(input.value*100)}`:'—';
      $('tracking-hint').textContent=demo?'연습 중 · 슬라이더로 값을, 무대 위 마우스/터치로 위치를 바꿔요.':!input.valid?`${sources[s.source]} 입력을 기다려요. 얼굴이나 필요한 손이 화면에 보이게 해주세요.`:!point&&!['music','flow','inspect'].includes(key)?'반응 값은 보이지만 위치가 없어요. 선택한 코·손을 보여주거나 마우스를 움직여요.':'✓ 움직임이 연결됐어요. 컨트롤을 바꾸며 비교해보세요.';
      $('live-values').textContent=`입력 ${input.valid?Math.round(input.value*100):'—'} → 반응 ${input.valid?Math.round(smoothed*100):'—'} · ${face?'얼굴 감지':'얼굴 없음'} · 손 ${hands.length}개${demo?' (카메라 감지와 무관한 연습 값)':''}`;
    }
  };
}
