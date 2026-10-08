const range=(key,label,min,max,step=1)=>({key,label,type:'range',min,max,step});
const common={color:'#c4ff63',background:'#101b32',cameraOpacity:.35,guides:false,hand:'auto',pointer:'nose',mode:'target',timeLimit:true,duration:30,goal:5,avatar:'✦'};
const shared=[{key:'mode',label:'어떻게 끝날까?',type:'select',options:{target:'목표 개수를 채우면 성공',timeattack:'시간 안에 최대한 많이'},rule:true},{...range('goal','목표 개수',1,50),rule:true},{key:'timeLimit',label:'목표 채우기에도 제한 시간 두기',type:'checkbox',rule:true},{...range('duration','제한 시간 (초)',10,120,5),rule:true},{key:'avatar',label:'내 캐릭터',type:'select',options:{'✦':'별','🐱':'고양이','👾':'외계인','🍊':'귤','🪩':'미러볼'}}];
const hazardControls=Array.from({length:4},(_,i)=>[{key:`hazardAction${i+1}`,label:`장애물 ${i+1}에 닿으면?`,type:'select',options:{penalty:'점수 깎기',gameover:'바로 게임 오버'},rule:true,hazard:i+1},{...range(`hazardPenalty${i+1}`,`장애물 ${i+1} 감점`,1,20),rule:true,hazard:i+1,penalty:true}]).flat();
const hazardDefaults=Object.fromEntries(Array.from({length:4},(_,i)=>[[`hazardAction${i+1}`,'penalty'],[`hazardPenalty${i+1}`,1]]).flat());
export const hazardRule=(s,i)=>s[`hazardAction${i+1}`]==='gameover'?'게임 오버':`−${s[`hazardPenalty${i+1}`]??1}점`;
export const timed=s=>s.mode==='timeattack'||s.timeLimit!==false;
export function gameRule(toy,s){const action=toy==='catch'?'모으기':'맞추기';return s.mode==='timeattack'?`${s.duration}초 동안 최대한 많이 ${action}`:`${timed(s)?s.duration+'초 안에 ':''}${s.goal}${toy==='catch'?'개':'번'} ${action}`;}
export const gameToys={
  catch:{hint:'좌우·위아래를 다른 움직임에 연결해요. 먹이를 모으고 장애물은 피하세요.',defaults:{...common,...hazardDefaults,playerSize:55,targetSize:40,speed:.6,hazards:0},controls:[...shared,range('playerSize','내 캐릭터 크기',25,100,5),range('targetSize','별 크기',20,90,5),range('speed','별이 움직이는 빠르기',0,2,.1),{...range('hazards','장애물 개수',0,4),rule:true},...hazardControls]},
  fit:{hint:'움직임으로 그림을 키우고 줄여 목표 테두리에 맞춰요. 맞춘 채로 잠깐 유지하면 성공!',defaults:{...common,goal:3,target:.5,tolerance:.12,hold:1.5,shuffle:true},controls:[...shared,range('target','처음 목표 크기',.15,.85,.05),range('tolerance','얼마나 넉넉하게?',.04,.25,.01),range('hold','몇 초 유지할까?',.5,3,.25),{key:'shuffle',label:'성공할 때마다 목표 바꾸기',type:'checkbox'}]},
};
export const gameOutputs={moveX:'좌우로 움직이기',moveY:'위아래로 움직이기',size:'커지기',rotate:'빙글 돌기',opacity:'나타나기',shake:'흔들리기'};
export const gamePresets=[['catch','별 먹기 · 코로 조종','noseX','moveX'],['catch','별 먹기 · 손으로 조종','handX','moveX'],['fit','딱 맞춰! · 두 손으로','hands','size'],['fit','딱 맞춰! · 입으로','mouth','size']];
export function gamePreset(index=0){const [toy,,source,output]=gamePresets[index]||gamePresets[0];const connection=(source,output)=>({source,output,sensitivity:1,reverse:false,smoothing:.35,amount:1});return {toy,settings:{...gameToys[toy].defaults},connections:toy==='catch'?[connection(source,output),connection(source==='handX'?'handY':'noseY','moveY')]:[connection(source,output)],title:toy==='catch'?'별을 모아라!':'딱 맞춰 챌린지',instruction:toy==='catch'?'움직여서 별을 모아봐!':'그림을 테두리에 맞춘 채 잠깐 멈춰봐!',image:null,foodImage:null,coverImage:null,...Object.fromEntries(Array.from({length:4},(_,i)=>[`hazardImage${i+1}`,null]))};}

// Game time advances only while inputs are visible and the page is active.
export function createGame(random=Math.random){
  let state;
  const target=()=>({x:.15+random()*.7,y:.2+random()*.6,phase:random()*Math.PI*2});
  function reset(s){state={phase:'ready',countdown:3,elapsed:0,score:0,hold:0,targetSize:s.target,star:target(),obstacles:Array.from({length:s.hazards||0},target),cooldown:0};return state;}
  function start(s){reset(s);state.phase='countdown';}
  function step(toy,s,control,dt,valid=true){
    if(!state)reset(s);dt=Math.max(0,Math.min(.1,dt));
    if(!valid||!['countdown','playing'].includes(state.phase))return state;
    if(state.phase==='countdown'){state.countdown-=dt;if(state.countdown<=0)state.phase='playing';return state;}
    state.elapsed+=dt;state.cooldown=Math.max(0,state.cooldown-dt);
    if(toy==='catch'){
      const star=position(state.star,s.speed,state.elapsed);
      const distance=(a,b)=>Math.hypot((a.x-b.x)*540,(a.y-b.y)*960);
      const playerSize=s.playerSize*(control.scale??1);
      if(distance(control,star)<(playerSize+s.targetSize)/2){state.score++;state.star=target();}
      const hits=state.obstacles.flatMap((o,i)=>distance(control,position(o,s.speed,state.elapsed))<(playerSize+38)/2?[i]:[]);
      if(hits.some(i=>s[`hazardAction${i+1}`]==='gameover')){state.phase='lost';return state;}
      if(!state.cooldown&&hits.length){state.score=Math.max(0,state.score-(s[`hazardPenalty${hits[0]+1}`]??1));state.cooldown=1;}
    }else{
      state.hold=Math.abs(control.size-state.targetSize)<=s.tolerance?state.hold+dt:0;
      if(state.hold>=s.hold){state.score++;state.hold=0;if(s.shuffle)state.targetSize=.2+random()*.6;}
    }
    if(s.mode!=='timeattack'&&state.score>=s.goal)state.phase='won';else if(timed(s)&&state.elapsed>=s.duration){state.elapsed=s.duration;state.phase='ended';}
    return state;
  }
  return {reset,start,step,get state(){return state;}};
}
export function position(p,speed,time){return{x:Math.max(.1,Math.min(.9,p.x+Math.sin(time*speed+p.phase)*.08)),y:Math.max(.15,Math.min(.87,p.y+Math.cos(time*speed+p.phase)*.05))};}
export function createGameRenderer(canvas){
  const ctx=canvas.getContext('2d'),engine=createGame();
  function text(str,x,y,size=28,color='#fff'){ctx.fillStyle=color;ctx.font=`800 ${size}px system-ui,sans-serif`;ctx.textAlign='center';ctx.fillText(str,x,y);}
  function avatar(s,img,x,y,size,rotation=0,opacity=1,shake=0,now=0){ctx.save();ctx.translate(x+Math.sin(now/45)*shake*18,y);ctx.rotate(rotation*Math.PI*2);ctx.globalAlpha=opacity;if(img){const ratio=Math.min(size/img.width,size/img.height);ctx.drawImage(img,-img.width*ratio/2,-img.height*ratio/2,img.width*ratio,img.height*ratio);}else text(s.avatar,0,size*.3,size,s.color);ctx.restore();}
  function draw(toy,s,{controls,valid,dt,now,img,foodImg,hazardImages=[]}){
    const c={x:controls.moveX??.5,y:1-(controls.moveY??.5),size:controls.size??.5,scale:controls.size==null?1:.4+controls.size*1.6};
    const st=engine.step(toy,s,c,document.hidden?0:dt,valid);
    ctx.fillStyle='#101b3250';ctx.fillRect(0,0,540,960);
    text(toy==='catch'?'별 먹기 챌린지':'딱 맞춰 챌린지',270,125,24,s.color);
    text(gameRule(toy,s),270,165,22);
    if(toy==='catch'){
      const star=position(st.star,s.speed,st.elapsed);if(foodImg)avatar(s,foodImg,star.x*540,star.y*960,s.targetSize);else text('✦',star.x*540,star.y*960+15,s.targetSize,'#ffe078');
      st.obstacles.forEach((o,i)=>{const p=position(o,s.speed,st.elapsed);if(hazardImages[i])avatar(s,hazardImages[i],p.x*540,p.y*960,38);else text('✕',p.x*540,p.y*960+12,38,'#ff7d98');text(`${i+1} · ${hazardRule(s,i)}`,p.x*540,p.y*960+42,17,'#ffc4d1');});
      avatar(s,img,c.x*540,c.y*960,s.playerSize*c.scale,controls.rotate,controls.opacity==null?1:.2+.8*controls.opacity,controls.shake,now);
    }else{
      const radius=45+st.targetSize*150;ctx.strokeStyle=s.color;ctx.lineWidth=7;ctx.setLineDash([14,10]);ctx.beginPath();ctx.arc(270,475,radius,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
      avatar(s,img,270,475,(45+c.size*150)*2,controls.rotate,controls.opacity==null?1:.2+.8*controls.opacity,controls.shake,now);
      ctx.fillStyle='#ffffff35';ctx.fillRect(100,720,340,12);ctx.fillStyle=s.color;ctx.fillRect(100,720,340*Math.min(1,st.hold/s.hold),12);
      text(Math.abs(c.size-st.targetSize)<=s.tolerance?'좋아! 그대로 유지해!':'테두리 크기에 맞춰봐',270,685,25);
    }
    text(s.mode==='timeattack'?`${st.score}${toy==='catch'?'개':'번'}`:`${st.score} / ${s.goal}`,95,65,35,s.color);text(`${timed(s)?Math.max(0,Math.ceil(s.duration-st.elapsed)):Math.floor(st.elapsed)}초`,445,65,30);
    if(!valid&&['countdown','playing'].includes(st.phase)){ctx.fillStyle='#101b32cc';ctx.fillRect(20,780,500,90);text('움직임을 찾으면 다시 시작해요',270,832,23);}
    if(st.phase==='countdown')text(String(Math.max(1,Math.ceil(st.countdown))),270,460,140);
    if(['ready','won','ended','lost'].includes(st.phase)){
      ctx.fillStyle='#101b32dd';ctx.fillRect(45,330,450,280);
      text(st.phase==='ready'?'몸으로 도전!':st.phase==='won'?'도전 성공!':st.phase==='lost'?'게임 오버!':s.mode==='timeattack'?'최종 기록!':'시간 끝!',270,415,38,s.color);
      text(st.phase==='ready'?'도전 시작을 눌러요':`${st.score}${toy==='catch'?'개':'번'} · ${st.elapsed.toFixed(1)}초`,270,480,25);
      text(st.phase==='ready'?'카메라 또는 연습 슬라이더로 조종':st.phase==='lost'?'장애물에 닿았어요. 다시 도전!':'설정을 바꾸고 다시 해봐요',270,540,20);
    }
    return st;
  }
  return {engine,draw};
}
