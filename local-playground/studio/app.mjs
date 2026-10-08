import { sceneControls } from '../kids/catalog.mjs';
import { sources, pointers, inputValue, inputPoint } from '../kids/inputs.mjs';
import { createToys } from '../kids/toys.js';
import { drawVideo, videoFit, toCanvas, clamp } from '../lib/utils.js';
import { setupCapture } from '../kids/recorder.js';
import { toys, allowedOutputs, presets as studioPresets, fromPreset as studioPreset, normalize, newConnection, advanceValue, sentence, imageKeys } from './model.mjs';
import { gameToys, gamePresets, gamePreset, gameRule, hazardRule, createGameRenderer } from './games.mjs';

const challengeMode=location.pathname.includes('/challenges/'),presets=challengeMode?gamePresets:studioPresets,fromPreset=challengeMode?gamePreset:studioPreset;

const $=id=>document.getElementById(id), canvas=$('stage'), ctx=canvas.getContext('2d'), renderer=createToys(canvas);
const game=createGameRenderer(canvas),isGame=()=>Object.hasOwn(gameToys,project.toy);
const capture=setupCapture(canvas,$('photo'),$('record'),$('capture-status'),$('save-status'),$('download'),renderer.getAudioTracks);
const gameActions=document.createElement('div');gameActions.id='game-actions';gameActions.hidden=true;gameActions.className='game-actions';
gameActions.innerHTML='<button id="start-game" class="primary">▶ 도전 시작</button><button id="copy-challenge">챌린지 링크 복사</button><p id="game-status" role="status"></p>';
document.querySelector('.stage-wrap').before(gameActions);
const rulesPanel=document.createElement('section');rulesPanel.className='card';rulesPanel.hidden=true;rulesPanel.innerHTML='<div class="number-label"><b>02</b><h2>게임 규칙 정하기</h2></div><p id="rule-summary" class="rule-summary" role="status"></p><div id="rule-controls"></div>';
document.querySelector('.connections-section').before(rulesPanel);
const gameStyle=document.createElement('link');gameStyle.rel='stylesheet';gameStyle.href=new URL('./games.css',import.meta.url);document.head.append(gameStyle);
const params=new URLSearchParams(location.search), roomId=params.get('room');
let teacherToken='', identity=null, project=fromPreset(), image=null, localImage=null, localName='', viewing=null, room=null, mode='welcome';
let extraImages={},localImages={},imageKey='image',assetGeneration=0,shareUntil=0;
function imageData(img){if(!img)return null;const c=document.createElement('canvas');c.width=img.width;c.height=img.height;c.getContext('2d').drawImage(img,0,0);return c.toDataURL('image/webp',.8);}
const imageSlot=document.createElement('label');imageSlot.className='control';imageSlot.textContent='어디에 넣을 그림인가요?';
const imageSelect=document.createElement('select');imageSelect.setAttribute('aria-label','이미지 자리');imageSlot.append(imageSelect);$('image-control').prepend(imageSlot);
const appliedImage=document.createElement('img');appliedImage.className='applied-image';appliedImage.alt='현재 적용한 이미지';appliedImage.hidden=true;imageSlot.after(appliedImage);
function slotImage(key=imageKey){return key==='image'?image:extraImages[key];}
function slotLocal(key=imageKey){return key==='image'?localImage:localImages[key];}
function setSlot(key,img,local){if(key==='image'){image=img;localImage=local;}else{extraImages[key]=img;localImages[key]=local;}}
function imagePanel(){
  imageSelect.replaceChildren();for(const [key,label]of Object.entries(isGame()?{image:'조종 캐릭터 (커서)',...(project.toy==='catch'?{foodImage:'먹이 (별)',...Object.fromEntries(Array.from({length:project.settings.hazards},(_,i)=>[`hazardImage${i+1}`,`장애물 ${i+1}`]))}:{}),coverImage:'세계관 대표 이미지 · 배경'}:{image:'내 그림'})){const o=document.createElement('option');o.value=key;o.textContent=label;imageSelect.append(o);}
  if(![...imageSelect.options].some(o=>o.value===imageKey))imageKey='image';imageSelect.value=imageKey;
  const img=slotImage();appliedImage.hidden=!img;if(img)appliedImage.src=imageData(img);
  $('remove-image').hidden=!project[imageKey]&&!slotLocal()&&!pendingImage;
}
imageSelect.onchange=()=>{imageKey=imageSelect.value;imageGeneration++;pendingImage=null;$('pending-image').hidden=true;$('image').value='';$('image-status').textContent='';imagePanel();};
let tracker=null, video=null, face=null, hands=[], demo=true, cameraGeneration=0, cameraBusy=false;
let mouse={x:.5,y:.5}, values=[.25,.25], demoValues=[.25,.25], last=0, saveTimer, revision=0, savedRevision=0, savePromise=null, imageGeneration=0, selectedPreset=0, pendingImage=null, trash=false;
const storageKey=`${challengeMode?'body-challenge':'body-play'}:${roomId||'solo'}`;
function read(key){try{return JSON.parse(localStorage.getItem(key));}catch{return null;}}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{$('save-state').textContent='기기 저장 공간이 부족해요. 놀이 파일로 저장해주세요.';return false;}}
function base(){return `/api/rooms/${roomId}/works`;}
function activeToken(){return teacherToken||identity?.secret||'';}
async function request(path,{method='GET',data,token=activeToken(),blob}={}) {
  const response=await fetch(path,{method,headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(data?{'Content-Type':'application/json'}:{}),...(blob?{'Content-Type':blob.type}:{})},body:blob|| (data?JSON.stringify(data):undefined)});
  if(!response.ok){const b=await response.json().catch(()=>({}));throw new Error(b.error||'연결이 잠시 어려워요. 다시 시도해주세요.');}
  return response.json();
}
function show(next) {
  mode=next;for(const id of ['welcome','classroom','friends','workspace'])$(id).hidden=id!==next;
  $('home').hidden=next==='welcome'||next==='classroom';$('home').textContent=teacherToken?'교사 화면으로':'내 만들기로';
  $('gallery').hidden=!roomId||next==='welcome'||next==='friends';
  if(next!=='workspace'){capture.stop();renderer.mute();}
}
function changed() {
  if(viewing)return;
  if(isGame()){game.engine.reset(project.settings);$('start-game').dataset.phase='';$('rule-summary').textContent=ruleSummary();if(project.instruction==='움직여서 별 5개를 모아봐!'){project.instruction='움직여서 별을 모아봐!';$('instruction').value=project.instruction;}}
  revision++;persist();$('save-state').textContent=roomId?'저장할 변경이 있어요…':'이 브라우저에 저장했어요';
  clearTimeout(saveTimer);if(roomId)saveTimer=setTimeout(()=>save(),700);
  $('connection-sentence').textContent=sentence(project);
}
function persist(){write(storageKey,{identity,name:localName,project,localImage,localImages,revision,savedRevision});}
async function save() {
  if(!roomId||!identity||viewing)return;
  if(savePromise)return savePromise;
  savePromise=(async()=>{
    try{while(savedRevision<revision){const current=revision,payload=structuredClone(project);$('save-state').textContent='저장 중…';await request(`${base()}/${identity.id}`,{method:'PUT',data:{project:payload},token:identity.secret});savedRevision=current;persist();} $('save-state').textContent='✓ 선생님에게도 저장됐어요';}
    catch(e){$('save-state').textContent=e.message+' (여기를 눌러 다시 저장)';}
    finally{savePromise=null;}
  })();return savePromise;
}
$('save-state').onclick=()=>save();$('save-state').tabIndex=0;$('save-state').onkeydown=e=>{if(e.key==='Enter')save();};
function optionSelect(options,value,change) {
  const el=document.createElement('select');for(const [key,name]of Object.entries(options)){const o=document.createElement('option');o.value=key;o.textContent=name;el.append(o);}el.value=value;el.onchange=()=>change(el.value);return el;
}
function range(label,value,min,max,step,change) {
  const format=v=>['얼마나 많이','부드럽게','작은 움직임에도'].includes(label)?`${Math.round(v*100)}%`:v;
  const row=document.createElement('label'),text=document.createElement('span'),out=document.createElement('output'),input=document.createElement('input');text.textContent=label;out.textContent=format(value);text.append(out);input.type='range';input.setAttribute('aria-label',label);Object.assign(input,{min,max,step,value});input.oninput=()=>{out.textContent=format(+input.value);change(+input.value);};row.append(text,input);return row;
}
function selectRow(label,options,value,change) {const row=document.createElement('label');row.textContent=label;row.append(optionSelect(options,value,change));return row;}
function controls(host,specs) {
  host.replaceChildren();for(const spec of specs){let row;
    if(spec.type==='range')row=range(spec.label,project.settings[spec.key],spec.min,spec.max,spec.step,v=>{project.settings[spec.key]=v;changed();});
    else if(spec.type==='select')row=selectRow(spec.label,spec.options,project.settings[spec.key],v=>{project.settings[spec.key]=v;renderer.release();changed();if(spec.rule)renderGameRules();});
    else {row=document.createElement('label');row.textContent=spec.label;const el=document.createElement('input');el.type=spec.type;el.maxLength=24;if(spec.type==='checkbox')el.checked=project.settings[spec.key];else el.value=project.settings[spec.key];el.oninput=()=>{project.settings[spec.key]=spec.type==='checkbox'?el.checked:el.value;changed();if(spec.rule)renderGameRules();};row.append(el);}
    if(spec.key==='goal'&&isGame()){const number=document.createElement('input');number.type='number';number.min=spec.min;number.max=spec.max;number.value=project.settings.goal;number.setAttribute('aria-label','목표 개수 직접 입력');number.oninput=()=>{if(number.value==='')return;project.settings.goal=Math.round(clamp(Number(number.value)||1,spec.min,spec.max));number.value=project.settings.goal;row.querySelector('input[type=range]').value=project.settings.goal;row.querySelector('output').textContent=project.settings.goal;changed();};number.onblur=()=>{number.value=project.settings.goal;};row.querySelector('input[type=range]').addEventListener('input',()=>{number.value=project.settings.goal;});row.append(number);}
    row.classList.add('control');host.append(row);
    if(spec.key==='hazards')row.querySelector('input').addEventListener('change',()=>{renderGameRules();imagePanel();});
  }
}
function ruleSummary(){return gameRule(project.toy,project.settings)+(project.toy==='catch'&&project.settings.hazards?' · '+Array.from({length:project.settings.hazards},(_,i)=>`장애물 ${i+1}: ${hazardRule(project.settings,i)}`).join(' / '):'');}
function renderGameRules(){
  rulesPanel.hidden=!isGame();if(!isGame())return;
  const s=project.settings;$('rule-summary').textContent=ruleSummary();
  controls($('rule-controls'),toys[project.toy].controls.filter(c=>c.rule&&(!c.hazard||c.hazard<=s.hazards)&&(!c.penalty||s[`hazardAction${c.hazard}`]!=='gameover')&&(c.key!=='goal'||s.mode!=='timeattack')&&(c.key!=='timeLimit'||s.mode!=='timeattack')&&(c.key!=='duration'||s.mode==='timeattack'||s.timeLimit)));
}
function renderConnections() {
  $('connections').replaceChildren();$('demo-inputs').replaceChildren();$('meters').replaceChildren();
  project.connections.forEach((connection,index)=>{
    values[index]??=.5;demoValues[index]??=.25;
    const card=document.createElement('div');card.className='connection';const head=document.createElement('div');head.className='connection-head';head.textContent=`연결 ${index+1}`;
    const required=project.toy==='catch'?['moveX','moveY']:project.toy==='fit'?['size']:[];
    if(index&&!required.includes(connection.output)){const remove=document.createElement('button');remove.textContent='지우기';remove.onclick=()=>{project.connections.splice(index,1);renderConnections();changed();};head.append(remove);}card.append(head);
    const panels=document.createElement('div');panels.className='connection-panels';
    panels.append(selectRow('내가 무엇을 움직이면?',sources,connection.source,v=>{connection.source=v;values[index]=0;renderConnections();changed();}),selectRow('무엇이 변할까?',Object.fromEntries(Object.entries(allowedOutputs(project.toy)).filter(([k])=>k===connection.output||!project.connections.some(c=>c.output===k))),connection.output,v=>{connection.output=v;renderConnections();changed();}));
    if(required.includes(connection.output)){panels.lastElementChild.querySelector('select').disabled=true;const note=document.createElement('small');note.textContent='기본 조작이에요. 연결할 움직임은 바꿀 수 있어요.';panels.lastElementChild.append(note);}
    const process=document.createElement('div');process.className='process';
    process.append(range('얼마나 많이',connection.amount,0,1,.05,v=>{connection.amount=v;changed();}),range('작은 움직임에도',connection.sensitivity,.25,3,.05,v=>{connection.sensitivity=v;changed();}),range('부드럽게',connection.smoothing,0,.95,.05,v=>{connection.smoothing=v;changed();}));
    const reverse=document.createElement('label');reverse.className='toggle';const check=document.createElement('input');check.type='checkbox';check.checked=connection.reverse;check.onchange=()=>{connection.reverse=check.checked;changed();};reverse.append(check,document.createTextNode('반대로 반응하기'));process.append(reverse);panels.append(process);card.append(panels);$('connections').append(card);
    $('demo-inputs').append(range(sources[connection.source],Math.round(demoValues[index]*100),0,100,1,v=>{demoValues[index]=v/100;}));
    const meter=document.createElement('div');meter.className='sensor';const label=document.createElement('span');label.id=`meter-label-${index}`;label.textContent=sources[connection.source];const bar=document.createElement('meter');bar.id=`meter-${index}`;bar.min=0;bar.max=100;meter.append(label,bar);$('meters').append(meter);
  });
  $('add-connection').hidden=project.connections.length>=(isGame()?4:2);$('connection-sentence').textContent=sentence(project);
}
function panel() {
  renderConnections();renderGameRules();$('title').value=project.title;$('instruction').value=project.instruction;
  $('image-control').hidden=project.toy!=='stretch'&&!isGame();$('audio').hidden=project.toy!=='music';$('audio').textContent='♪ 소리 켜기';
  imagePanel();
  document.body.classList.toggle('game-stage',isGame());canvas.width=isGame()?540:960;canvas.height=isGame()?960:720;
  if($('game-actions'))$('game-actions').hidden=!isGame();
  if(isGame())$('start-game').dataset.phase='';
  $('preset-hint').textContent=toys[project.toy].hint;
  const common=[...toys[project.toy].controls.filter(s=>!s.rule&&(isGame()||['text','subtitle','color','behavior','mode','wave','brush'].includes(s.key))),...sceneControls.filter(s=>['color','background'].includes(s.key))];
  controls($('personal-controls'),common);
  controls($('extra-controls'),[...(!isGame()?[{key:'pointer',label:'작품이 따라갈 위치',type:'select',options:pointers}]:[]),{key:'hand',label:'사용할 손',type:'select',options:{auto:'자동',Left:'왼손',Right:'오른손'}},...toys[project.toy].controls.filter(s=>!s.rule&&!common.some(c=>c.key===s.key)&&s.key!=='effect'),...sceneControls.filter(s=>!['color','background'].includes(s.key)&&(!isGame()||s.key!=='guides'))]);
  for(const [i,button]of [...$('presets').children].entries())button.setAttribute('aria-pressed',String(i===selectedPreset));
}
function loadProject(p,{local=null,extras={}}={}) {
  capture.stop();renderer.mute();renderer.clear();project=normalize(p);if(isGame())game.engine.reset(project.settings);selectedPreset=presets.findIndex(p=>p[0]===project.toy&&p[2]===project.connections[0].source&&p[3]===project.connections[0].output);if(selectedPreset<0)selectedPreset=Math.max(0,presets.findIndex(p=>p[0]===project.toy));values=[.5,.5];image=null;localImage=local;imageGeneration++;pendingImage=null;$('pending-image').hidden=true;$('image-status').textContent='';$('image').value='';$('remove-image').hidden=!project.image&&!local;panel();
  extraImages={};localImages={...extras};imagePanel();const generation=++assetGeneration;
  for(const key of imageKeys){const local=slotLocal(key),assetId=project[key];
    const load=src=>{const img=new Image();img.onload=()=>{if(generation===assetGeneration&&(slotLocal(key)===local||(project[key]&&!slotLocal(key)&&!slotImage(key)))){setSlot(key,img,slotLocal(key));imagePanel();}};img.src=src;};
    if(local)load(local);
    else if(assetId&&roomId){const workId=viewing?.id||identity?.id;fetch(`${base()}/${workId}/image/${assetId}`,{headers:activeToken()?{Authorization:`Bearer ${activeToken()}`}:{}}).then(r=>{if(!r.ok)throw Error('그림을 불러오지 못했어요.');return r.blob();}).then(async blob=>{const url=URL.createObjectURL(blob),img=new Image();try{img.src=url;await img.decode();if(generation===assetGeneration&&project[key]===assetId){setSlot(key,img,null);imagePanel();}}finally{URL.revokeObjectURL(url);}}).catch(e=>{if(generation===assetGeneration)$('image-status').textContent=e.message;});}
  }
}
function editing() {
  const url=new URL(location.href);url.searchParams.delete('work');history.replaceState(null,'',url.pathname+url.search);
  document.body.classList.remove('playing');$('editor').hidden=false;$('preview').hidden=false;$('publish').hidden=!roomId;$('edit').hidden=true;$('play-instruction').hidden=true;
  $('workspace-label').textContent=challengeMode?'MY CHALLENGE · 만들고 도전하기':'MY PLAYGROUND · 만들고 해보기';$('workspace-title').textContent=`${localName}의 ${challengeMode?'몸 챌린지':'몸 놀이'}`;$('save-state').hidden=false;
  $('feedback-box').hidden=true;$('notes').hidden=!roomId;show('workspace');
}
function playView() {
  capture.stop();document.body.classList.add('playing');$('editor').hidden=true;$('preview').hidden=true;$('publish').hidden=true;$('edit').hidden=!!viewing;$('save-state').hidden=true;
  $('play-instruction').hidden=false;$('play-instruction').textContent=project.instruction||'카메라를 켜고 몸을 움직여보세요. 손 없이도 연습할 수 있어요.';
  $('workspace-label').textContent=viewing?`${viewing.name}의 놀이 · 내 몸으로 해보기`:'플레이 중';$('workspace-title').textContent=project.title||'내 몸 놀이';
  $('notes').hidden=true;$('feedback-box').hidden=!viewing||(!teacherToken&&!identity);$('feedback-label').textContent=teacherToken?'학생에게 알려줄 말':'해보고 어떤 점이 좋거나 헷갈렸나요?';show('workspace');
}
presets.forEach((preset,i)=>{const b=document.createElement('button');b.textContent=preset[1];b.onclick=async()=>{if(viewing)return;const prior=fromPreset(selectedPreset),next=fromPreset(i);selectedPreset=i;const old={title:challengeMode&&project.title===prior.title?next.title:project.title,instruction:challengeMode&&project.instruction===prior.instruction?next.instruction:project.instruction,...Object.fromEntries(imageKeys.map(k=>[k,project[k]]))};const oldImage=image,oldLocal=localImage,oldExtra=extraImages;loadProject({...next,...old},{local:oldLocal,extras:localImages});image=oldImage;extraImages=oldExtra;imagePanel();changed();};$('presets').append(b);});
$('add-connection').onclick=()=>{if(project.connections.length>=(isGame()?4:2))return;const output=Object.keys(allowedOutputs(project.toy)).find(k=>!project.connections.some(c=>c.output===k)&&k!=='reaction');project.connections.push(newConnection('tilt',output));renderConnections();changed();};
$('title').oninput=()=>{project.title=$('title').value;changed();};$('instruction').oninput=()=>{project.instruction=$('instruction').value;changed();};
$('reset').onclick=()=>{if(!confirm('현재 놀이를 처음 설정으로 돌릴까요?'))return;loadProject(fromPreset(selectedPreset));changed();};
$('preview').onclick=()=>{save();playView();};$('edit').onclick=editing;
$('join').onsubmit=async e=>{
  e.preventDefault();localName=$('name').value.trim();if(!localName)return;$('join-button').disabled=true;
  try{
    const cached=read(storageKey);
    if(roomId){if(!identity){identity=await request(base(),{method:'POST',data:{name:localName,project:fromPreset()},token:''});persist();}const w=await request(`${base()}/${identity.id}`,{token:identity.secret});localName=w.name;
      if(cached?.identity?.id===identity.id && cached.revision>cached.savedRevision){loadProject(cached.project,{local:cached.localImage,extras:cached.localImages});revision=cached.revision;savedRevision=cached.savedRevision;}
      else{loadProject(w.project);revision=0;savedRevision=0;}renderNotes(w.feedback);
    }else{loadProject(cached?.project||fromPreset(),{local:cached?.localImage,extras:cached?.localImages});}
    editing();persist();if(revision>savedRevision)save();
  }catch(e){$('entry-status').textContent=e.message;}finally{$('join-button').disabled=false;}
};
$('create-room').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{const data=await request('/api/rooms',{method:'POST',data:{title:$('class-title').value},token:''});write(`body-play:teacher:${data.id}`,data.secret);location.href=`./?room=${data.id}#teacher=${data.secret}`;}catch(e){$('entry-status').textContent=e.message;}finally{b.disabled=false;}};
$('publish').onclick=async()=>{
  if(!project.title.trim()||!project.instruction.trim()){$('save-state').textContent='놀이 이름과 “친구야, 처음엔 이렇게 해봐!”를 적어주세요.';$('title').focus();return;}
  $('publish').disabled=true;try{await save();if(savedRevision<revision)throw Error('먼저 저장을 마친 뒤 다시 공개해주세요.');await request(`${base()}/${identity.id}/publish`,{method:'POST',data:{project},token:identity.secret});$('save-state').textContent='✓ 친구 놀이에 올렸어요! 바꾼 뒤에는 다시 이 버튼을 눌러요.';}catch(e){$('save-state').textContent=e.message;}finally{$('publish').disabled=false;}
};
function renderNotes(notes){$('notes-list').replaceChildren();if(!notes?.length){$('notes-list').textContent='선생님과 친구의 한마디가 여기에 도착해요.';return;}for(const note of notes){const p=document.createElement('p'),strong=document.createElement('strong');strong.textContent=note.author+' · ';p.append(strong,document.createTextNode(note.message));$('notes-list').append(p);}}
async function list(teacher=false) {
  const host=$(teacher?'class-list':'friends-list'),status=$(teacher?'class-status':'friends-status');
  const deleted=teacher&&trash;
  try{const data=await request(base()+(deleted?'?deleted=1':''),{token:teacher?teacherToken:''});const works=data.works.filter(w=>teacher||Object.hasOwn(gameToys,w.toy)===challengeMode);host.replaceChildren();status.textContent=works.length?`${works.length}개의 ${deleted?'삭제한 작품':teacher?'학생 자리':'놀이'} · ${new Date().toLocaleTimeString('ko-KR')} 확인`:deleted?'휴지통이 비어 있어요.':teacher?'학생이 들어오면 이곳에 나타나요.':'아직 공개된 놀이가 없어요. 먼저 내 놀이를 만들어보세요.';
    for(const w of works){const card=document.createElement('article');card.className='card work-card';const badge=document.createElement('span');badge.className='badge';badge.textContent=deleted?'삭제됨':teacher?(w.published?'친구 놀이에 올라감':'만드는 중'):w.name+'의 놀이';const title=document.createElement('h2');title.textContent=teacher?w.name:w.title;const text=document.createElement('p');text.textContent=w.connections;const time=document.createElement('time');time.textContent=`최근 저장 ${new Date(w.updatedAt).toLocaleString('ko-KR')}`;card.append(badge,title,text,time);
      const button=(name,action)=>{const b=document.createElement('button');b.textContent=name;b.onclick=action;card.append(b);return b;};
      if(deleted)button('복원',async()=>{try{await request(`${base()}/${w.id}/restore`,{method:'POST',data:{}});list(true);}catch(e){status.textContent=e.message;}});
      else {
        if(w.coverImage){const cover=document.createElement('img');cover.className='work-cover';cover.alt='세계관 대표 이미지';cover.loading='lazy';cover.src=`${base()}/${w.id}/image/${w.coverImage}`;card.prepend(cover);}
        button(teacher?'작품 열기':'플레이하기',()=>{if(Object.hasOwn(gameToys,w.toy)!==challengeMode){location.href=`../${Object.hasOwn(gameToys,w.toy)?'challenges':'studio'}/?room=${roomId}&work=${w.id}`;return;}openWork(w.id,!teacher);});
        if(w.published)button('링크 복사',async()=>{await copyWorkLink(w,card,status);});
        if(teacher){
          if(w.published)button('공개된 작품 보기',()=>openWork(w.id,true));
          button('학생 재입장 링크',async()=>{try{const entry=await request(`${base()}/${w.id}/student-link`,{method:'POST',data:{}});const link=`${location.origin}/${Object.hasOwn(gameToys,w.toy)?'challenges':'studio'}/?room=${roomId}&role=student#student=${entry.id}&key=${entry.secret}`;
            $('reentry-link').value=link;$('reentry-name').textContent=`${w.name}에게 보낼 재입장 링크`;$('reentry').hidden=false;try{await navigator.clipboard.writeText(link);$('reentry-status').textContent='복사했어요. 해당 학생에게 보내면 기존 작품으로 바로 들어가요.';}catch{$('reentry-link').select();$('reentry-status').textContent='아래 링크를 복사해 해당 학생에게 보내주세요.';}
          }catch(e){status.textContent=e.message;}});
          button('작품 삭제',async()=>{if(!confirm(`${w.name}의 작품을 삭제할까요? 친구 놀이에서도 사라지며 휴지통에서 복원할 수 있어요.`))return;try{await request(`${base()}/${w.id}`,{method:'DELETE'});list(true);}catch(e){status.textContent=e.message;}});
        }
      }host.append(card);}
  }catch(e){status.textContent=e.message;}
}
async function openWork(id,published=false){
  const prior=mode;try{if(identity&&!viewing)await save();const w=await request(`${base()}/${id}${published?'?published=1':''}`,{token:teacherToken||(id===identity?.id?identity.secret:'')});viewing={id:w.id,name:w.name};loadProject(w.project);playView();if(isGame()){const url=new URL(location.href);url.searchParams.set('work',w.id);history.replaceState(null,'',url.pathname+url.search);}$('feedback-status').textContent='';$('feedback-message').value='';}catch(e){$(prior==='classroom'?'class-status':prior==='welcome'?'entry-status':'friends-status').textContent=e.message;}
}
$('gallery').onclick=async()=>{if(identity&&!viewing)await save();show('friends');list();};$('refresh-friends').onclick=()=>list();$('refresh-class').onclick=()=>list(true);
$('home').onclick=async()=>{const url=new URL(location.href);url.searchParams.delete('work');history.replaceState(null,'',url.pathname+url.search);if(teacherToken){viewing=null;show('classroom');list(true);}else{viewing=null;if(roomId&&!identity){show('welcome');return;}const cached=read(storageKey);loadProject(cached?.project||fromPreset(),{local:cached?.localImage,extras:cached?.localImages});editing();}};
$('feedback-form').onsubmit=async e=>{e.preventDefault();if(!viewing)return;const b=e.submitter;b.disabled=true;try{await request(`${base()}/${viewing.id}/feedback`,{method:'POST',data:{message:$('feedback-message').value,from:identity?.id}});$('feedback-message').value='';$('feedback-status').textContent='✓ 한마디를 보냈어요.';}catch(e){$('feedback-status').textContent=e.message;}finally{b.disabled=false;}};
async function copy(id){try{await navigator.clipboard.writeText($(id).value);$('class-status').textContent='링크를 복사했어요.';}catch{$(id).select();$('class-status').textContent='링크를 선택했어요. 복사해서 보내주세요.';}}
$('copy-student').onclick=()=>copy('student-link');$('copy-teacher').onclick=()=>copy('teacher-link');
$('copy-reentry').onclick=()=>copy('reentry-link');
$('start-game').onclick=()=>{game.engine.start(project.settings);$('game-status').textContent='3, 2, 1… 도전!';};
async function copyWorkLink(w,host,status){shareUntil=Date.now()+60000;const url=`${location.origin}/${Object.hasOwn(gameToys,w.toy||w.project?.toy)?'challenges':'studio'}/?room=${roomId}&work=${w.id}`;let input=host.querySelector('.share-link');if(!input){input=document.createElement('input');input.className='share-link';input.readOnly=true;input.setAttribute('aria-label','공유할 작품 링크');host.append(input);}input.value=url;try{await navigator.clipboard.writeText(url);status.textContent='✓ 링크를 복사했어요. 로그인 없이 플레이할 수 있어요.';}catch{input.focus();input.select();status.textContent='아래 링크를 길게 누르거나 선택해서 복사해주세요.';}}
$('copy-challenge').onclick=async()=>{try{if(!roomId)throw Error('함께하는 수업에서 친구 챌린지에 올린 뒤 링크를 복사해요.');const id=viewing?.id||identity?.id;if(!id)throw Error('먼저 챌린지를 골라주세요.');const w=await request(`${base()}/${id}`,{token:''});if(!w.published)throw Error('먼저 친구 챌린지에 올려주세요.');await copyWorkLink(w,gameActions,$('game-status'));}catch(e){$('game-status').textContent=e.message;}};
$('trash-toggle').onclick=()=>{trash=!trash;$('trash-toggle').textContent=trash?'학생 목록으로':'휴지통';$('reentry').hidden=true;list(true);};
async function imageFile(file){
  if(!file||!/^image\/(png|jpeg|webp|gif)$/.test(file.type)||file.size>10000000)throw Error('10MB 이하 PNG, JPG, WebP, GIF 그림을 골라주세요.');
  const url=URL.createObjectURL(file),img=new Image();try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});const c=document.createElement('canvas'),ratio=Math.min(1,640/Math.max(img.width,img.height));c.width=Math.max(1,Math.round(img.width*ratio));c.height=Math.max(1,Math.round(img.height*ratio));c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c;}finally{URL.revokeObjectURL(url);}
}
$('image').onchange=async()=>{
  const generation=++imageGeneration;pendingImage=null;$('pending-image').hidden=true;$('image-status').textContent='이미지를 준비하고 있어요…';
  try{const c=await imageFile($('image').files[0]);const blob=await new Promise(r=>c.toBlob(r,'image/webp',.8));if(!blob||blob.size>300000)throw Error('그림이 너무 복잡해요. 작은 그림으로 다시 골라주세요.');
    if(generation!==imageGeneration)return;pendingImage={canvas:c,blob};$('image-preview').src=c.toDataURL('image/webp',.8);$('pending-image').hidden=false;$('remove-image').hidden=false;$('image-status').textContent='선택한 이미지를 확인하고 “이미지 적용”을 눌러주세요.';
  }catch(e){$('image-status').textContent=e.message||'이미지를 읽지 못했어요. 다른 이미지를 골라주세요.';}
};
$('apply-image').onclick=async()=>{
  if(!pendingImage)return;const generation=imageGeneration,{canvas:c,blob}=pendingImage;$('apply-image').disabled=true;$('image-status').textContent='이미지를 적용하고 있어요…';
  try{
    let id=null;if(roomId){const data=await request(`${base()}/${identity.id}/image`,{method:'POST',blob,token:identity.secret});id=data.image;}if(generation!==imageGeneration)return;
    project[imageKey]=id;setSlot(imageKey,c,roomId?null:c.toDataURL('image/webp',.8));pendingImage=null;$('pending-image').hidden=true;imagePanel();changed();$('image-status').textContent='✓ 이미지를 적용했어요.';
  }catch(e){$('image-status').textContent=e.message||'이미지를 적용하지 못했어요. 다시 눌러주세요.';}finally{$('apply-image').disabled=false;}
};
$('remove-image').onclick=()=>{imageGeneration++;setSlot(imageKey,null,null);project[imageKey]=null;pendingImage=null;$('pending-image').hidden=true;$('image').value='';imagePanel();changed();$('image-status').textContent='✓ 선택한 자리의 이미지를 삭제했어요.';};
$('export').onclick=async()=>{
  const data={version:2,project,localImage:localImage||imageData(image),localImages:Object.fromEntries(imageKeys.slice(1).map(k=>[k,slotLocal(k)||imageData(slotImage(k))]))};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=(project.title||'내-몸-놀이')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('import').onchange=async()=>{try{const f=$('import').files[0];if(!f||f.size>3000000)throw Error('3MB 이하 놀이 파일을 골라주세요.');const data=JSON.parse(await f.text()),p=normalize(data.project),locals={image:data.localImage,...Object.fromEntries(imageKeys.slice(1).map(k=>[k,data.localImages?.[k]]))};
    for(const key of imageKeys){p[key]=null;if(locals[key]&&(typeof locals[key]!=='string'||!/^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(locals[key])))throw Error('그림 형식을 읽지 못했어요.');}
    loadProject(p,{local:locals.image,extras:Object.fromEntries(imageKeys.slice(1).map(key=>[key,locals[key]]))});changed();const generation=assetGeneration;
    if(roomId)for(const key of imageKeys){if(!locals[key])continue;const blob=await(await fetch(locals[key])).blob();const response=await request(`${base()}/${identity.id}/image`,{method:'POST',blob,token:identity.secret});if(generation!==assetGeneration)return;project[key]=response.image;if(key==='image')localImage=null;else localImages[key]=null;changed();}
  }catch(e){$('save-state').textContent=e.message||'놀이 파일을 읽지 못했어요.';}};

function stopCamera(){cameraGeneration++;tracker?.stop();tracker=null;video=null;face=null;hands=[];cameraBusy=false;$('camera').disabled=false;}
async function startCamera(){
  if(cameraBusy)return;stopCamera();const generation=cameraGeneration;cameraBusy=true;$('camera').disabled=true;$('camera-status').textContent='카메라를 준비하고 있어요. 권한 창에서 허용해주세요.';let candidate;
  const timer=setTimeout(()=>{if(generation!==cameraGeneration)return;stopCamera();candidate?.stop();$('camera-status').textContent='준비가 오래 걸려요. 권한을 확인하고 다시 켜거나 손 없이 해보세요.';},30000);
  try{if(!navigator.mediaDevices?.getUserMedia)throw Error();const {Tracker}=await import('../lib/tracker.js');if(generation!==cameraGeneration)return;
    candidate=new Tracker({face:true,hands:true,maxHands:2,smoothing:.25,facingMode:'user'});candidate.onUpdate(data=>{if(generation!==cameraGeneration)return;({face,hands,video}=data);});await candidate.start();
    if(generation!==cameraGeneration){candidate.stop();return;}tracker=candidate;video=candidate.video;demo=false;$('demo-panel').hidden=true;$('live-mode').textContent='카메라로 움직이는 중';$('camera-status').textContent='';
    video.srcObject.getVideoTracks()[0].addEventListener('ended',()=>{if(tracker!==candidate)return;stopCamera();demo=true;$('demo-panel').hidden=false;$('camera-status').textContent='카메라 연결이 끊겼어요. 다시 켜주세요.';});
  }catch{candidate?.stop();if(generation===cameraGeneration){stopCamera();demo=true;$('demo-panel').hidden=false;$('camera-status').textContent='카메라가 아직 켜지지 않았어요. 주소 옆 권한을 확인하고 다시 눌러주세요. 손 없이도 계속할 수 있어요.';}}
  finally{clearTimeout(timer);if(generation===cameraGeneration){cameraBusy=false;$('camera').disabled=false;}}
}
$('camera').onclick=startCamera;$('demo').onclick=()=>{stopCamera();demo=true;$('demo-panel').hidden=false;$('live-mode').textContent='손 없이 연습 중';renderer.mute();};
$('audio').onclick=async()=>{try{$('audio').textContent=await renderer.toggleAudio()?'■ 소리 끄기':'♪ 소리 켜기';}catch{$('camera-status').textContent='소리를 켜지 못했어요. 다시 눌러주세요.';}};
$('clear').onclick=()=>{renderer.clear();if(isGame())game.engine.reset(project.settings);};
function movePointer(e){const b=canvas.getBoundingClientRect();mouse={x:clamp((e.clientX-b.left)/b.width),y:clamp((e.clientY-b.top)/b.height)};if(demo&&isGame())project.connections.forEach((c,i)=>{if(['moveX','moveY','size'].includes(c.output)){demoValues[i]=c.output==='moveY'?1-mouse.y:mouse.x;const input=$('demo-inputs').children[i]?.querySelector('input');if(input){input.value=Math.round(demoValues[i]*100);input.previousElementSibling.querySelector('output').textContent=input.value;}}});}
canvas.addEventListener('pointermove',movePointer);canvas.addEventListener('pointerdown',movePointer);
window.addEventListener('pagehide',()=>{stopCamera();capture.stop();});document.addEventListener('visibilitychange',()=>{if(document.hidden){renderer.mute();$('audio').textContent='♪ 소리 켜기';}else if(revision>savedRevision)save();});
window.addEventListener('beforeunload',e=>{if(roomId&&!viewing&&revision>savedRevision){e.preventDefault();e.returnValue='';}});
function draw(now){
  // Schedule first so a failed asset or renderer cannot permanently stop camera feedback.
  requestAnimationFrame(draw);if(mode!=='workspace')return;const dt=Math.min(2,Math.max(.1,(now-last)/16.667||1));last=now;
  ctx.fillStyle=project.settings.background;ctx.fillRect(0,0,canvas.width,canvas.height);if(isGame()&&extraImages.coverImage){const img=extraImages.coverImage,r=Math.max(canvas.width/img.width,canvas.height/img.height);ctx.drawImage(img,(canvas.width-img.width*r)/2,(canvas.height-img.height*r)/2,img.width*r,img.height*r);}drawVideo(video,ctx,canvas.width,canvas.height,{opacity:project.settings.cameraOpacity});
  const fit=videoFit(video,canvas.width,canvas.height),s={...project.settings},inputs=project.connections.map((c,i)=>demo?{valid:true,value:demoValues[i],points:[]}:inputValue(c.source,face,hands,s.hand));
  inputs.forEach((input,i)=>{const c=project.connections[i],v=isGame()&&!demo&&['noseX','noseY','handX','handY'].includes(c.source)?clamp((input.value-.25)*2):input.value;values[i]=advanceValue(values[i],input.valid?v:0,c,dt);$(`meter-${i}`).value=input.valid?input.value*100:0;$(`meter-label-${i}`).textContent=`${sources[c.source]} ${input.valid?Math.round(input.value*100):'—'} → ${Math.round(values[i]*100)}`;});
  const target=inputPoint(demo?'mouse':s.pointer,face,hands,mouse,s.hand),point=target?(demo||s.pointer==='mouse'?{x:target.x*canvas.width,y:target.y*canvas.height}:toCanvas(target,fit)):null;
  if(isGame()){
    const control=Object.fromEntries(project.connections.map((c,i)=>[c.output,['moveX','moveY'].includes(c.output)?.5+(values[i]-.5)*c.amount:values[i]*c.amount]));
    const state=game.draw(project.toy,s,{controls:control,valid:inputs.every(i=>i.valid),dt:dt/60,now,img:image,foodImg:extraImages.foodImage,hazardImages:Array.from({length:4},(_,i)=>extraImages[`hazardImage${i+1}`])});
    const label=`${state.phase}:${state.score}`;
    if($('start-game').dataset.phase!==label){
      $('start-game').dataset.phase=label;$('start-game').textContent=['won','ended','lost'].includes(state.phase)?'↻ 다시 도전':['countdown','playing'].includes(state.phase)?'↻ 처음부터 도전':'▶ 도전 시작';
      if(state.phase==='playing')$('game-status').textContent='도전 중! '+gameRule(project.toy,s);
      if(state.phase==='ready')$('game-status').textContent='준비되면 도전 시작을 눌러요. '+gameRule(project.toy,s);
      if(['won','ended','lost'].includes(state.phase))$('game-status').textContent=`${state.phase==='won'?'성공!':state.phase==='lost'?'장애물에 닿아 게임 오버!':s.mode==='timeattack'?'최종 기록!':'시간 끝!'} ${state.score}${project.toy==='catch'?'개':'번'} · ${state.elapsed.toFixed(1)}초. 다시 도전해봐요.`;
    }
    $('sees').textContent=demo?'연습 입력':`손 ${hands.length} / 2 · 얼굴 ${face?'✓':'—'}`;
    $('tracking').textContent=demo?'무대에서 마우스·터치를 움직이거나 연습 슬라이더로 조종해요.':inputs.some(i=>!i.valid)?'선택한 얼굴이나 손을 보여주세요. 찾는 동안 게임 시간이 멈춰요.':'✓ 움직임이 연결됐어요!';return;
  }
  let value=.5,valid=inputs.every(i=>i.valid);ctx.save();
  project.connections.forEach((c,i)=>{
    const v=values[i]*c.amount;
    if(c.output==='reaction'){value=v;valid=inputs[i].valid;}
    else if(project.toy==='stretch'&&i===0){s.effect=c.output;s.amount=c.amount*100;value=values[i];}
    else {const anchor=s.placement==='input'&&point?point:{x:canvas.width/2,y:canvas.height/2};ctx.translate(anchor.x,anchor.y);if(c.output==='size'){const scale=.25+v*1.5;ctx.scale(scale,scale);}if(c.output==='rotate')ctx.rotate(v*Math.PI*2);if(c.output==='opacity')ctx.globalAlpha=.1+v*.9;if(c.output==='shake')ctx.translate(Math.sin(now/45)*v*50,Math.cos(now/59)*v*50);ctx.translate(-anchor.x,-anchor.y);}
  });
  const volume=inputValue(s.volumeSource,face,hands,s.hand);
  try{renderer.draw(project.toy,s,{value,point,valid,now,dt,img:image,face,hands,fit,volumeValue:s.volumeSource==='constant'||demo?1:volume.valid?volume.value:0,sourceName:sources[project.connections[0].source]});}
  catch(e){$('tracking').textContent='무대를 다시 준비해요. “무대 지우기”를 눌러주세요.';console.error(e);}finally{ctx.restore();}
  if(s.guides&&!demo){ctx.fillStyle=s.color;for(const input of inputs)for(const p of input.points){const a=toCanvas(p,fit);ctx.beginPath();ctx.arc(a.x,a.y,6,0,Math.PI*2);ctx.fill();}}
  $('sees').textContent=demo?'연습 입력':`손 ${hands.length} / 2 · 얼굴 ${face?'✓':'—'}`;
  $('tracking').textContent=demo?'슬라이더로 반응을 바꾸고, 무대 위에서 마우스를 움직여보세요.':inputs.some(i=>!i.valid)?'선택한 얼굴이나 손 전체가 화면에 보이도록 조금 뒤로 가보세요.':!point&&!['stretch','music','flow','inspect'].includes(project.toy)?'반응 값이 들어와요. “작품이 따라갈 위치”에서 고른 코·손도 보여주세요.':'✓ 움직임이 연결됐어요!';
}
async function init(){
  panel();const cached=read(storageKey);if(cached){identity=cached.identity;localName=cached.name||'';$('name').value=localName;}
  if(!roomId){if(cached?.project&&localName){loadProject(cached.project,{local:cached.localImage,extras:cached.localImages});editing();}return;}
  const fragment=new URLSearchParams(location.hash.slice(1)),secret=fragment.get('teacher');
  if(secret){write(`body-play:teacher:${roomId}`,secret);history.replaceState(null,'',location.pathname+location.search);}
  teacherToken=params.get('role')==='student'?'':secret||read(`body-play:teacher:${roomId}`)||'';
  try{room=await request(`/api/rooms/${roomId}`,{token:teacherToken});if(teacherToken&&!room.teacher)teacherToken='';$('room-title').textContent=room.title;$('local-note').textContent='선택과 그림이 수업에 저장돼요. 공개한 작품은 이 수업의 친구가 해볼 수 있어요.';$('teacher-entry').hidden=true;
    if(fragment.get('student')&&fragment.get('key')) {
      const id=fragment.get('student'),key=fragment.get('key'),w=await request(`${base()}/${encodeURIComponent(id)}`,{token:key});if(!w.owner)throw Error('이 학생 링크로 편집할 수 없어요. 선생님께 새 링크를 부탁해주세요.');
      teacherToken='';identity={id:w.id,name:w.name,secret:key};localName=w.name;revision=0;savedRevision=0;viewing=null;loadProject(w.project);renderNotes(w.feedback);persist();history.replaceState(null,'',location.pathname+location.search);editing();return;
    }
    if(params.get('work')){await openWork(params.get('work'),!teacherToken);return;}
    if(teacherToken){$('class-name').textContent=room.title;const classUrl=`${location.origin}${location.pathname}?room=${roomId}`;$('student-link').value=classUrl+'&role=student';$('teacher-link').value=classUrl+`#teacher=${teacherToken}`;show('classroom');list(true);}
    else if(identity?.id&&localName)$('join').requestSubmit();
  }catch(e){$('entry-status').textContent=e.message;$('join-button').disabled=true;}
}
setInterval(()=>{if(!roomId||document.hidden)return;if(mode==='classroom'&&Date.now()>shareUntil)list(true);if(mode==='friends'&&Date.now()>shareUntil)list();if(mode==='workspace'&&!viewing&&identity)request(`${base()}/${identity.id}`).then(w=>renderNotes(w.feedback)).catch(()=>{});if(mode==='workspace'&&!viewing&&revision>savedRevision)save();},8000);
requestAnimationFrame(draw);init();
