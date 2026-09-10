import { clamp, mapRange, toCanvas } from '../lib/utils.js';
import { FACE_NAMED, HAND_NAMED } from '../lib/landmarks.js';

export function createToys(canvas) {
  const ctx=canvas.getContext('2d'), w=canvas.width, h=canvas.height;
  const ink=document.createElement('canvas'); ink.width=w;ink.height=h;const pen=ink.getContext('2d');
  let particles=[], previous=null, textKey='', textPoints=[], history=[], letters=[], font=null, pathKey='', paths=[], fallbackKey='', fallbackLetters=[];
  let audio,osc,gain,destination,enabled=false;
  fetch(new URL('./vendor/Roboto-Regular.ttf',import.meta.url)).then(r=>{if(!r.ok)throw Error();return r.arrayBuffer();}).then(buffer=>{font=window.opentype.parse(buffer);pathKey='';}).catch(()=>{});
  function clear(){pen.clearRect(0,0,w,h);previous=null;particles=[];textKey='';pathKey='';history=[];letters=[];}
  function mute(){enabled=false;if(gain)gain.gain.setTargetAtTime(0,audio.currentTime,.02);}
  async function toggleAudio(){
    if(enabled){mute();return false;}
    if(!audio){audio=new AudioContext();osc=audio.createOscillator();gain=audio.createGain();gain.gain.value=0;destination=audio.createMediaStreamDestination();osc.connect(gain);gain.connect(audio.destination);gain.connect(destination);osc.start();}
    await audio.resume();enabled=true;return true;
  }
  function circle(x,y,r){ctx.beginPath();ctx.arc(x,y,Math.max(.1,r),0,Math.PI*2);ctx.fill();}
  function caption(text,x,y,size=26){ctx.font=`700 ${size}px Arial, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x,y);}
  function artwork(s,value,point,img,now){
    const size=s.effect==='size'?s.minSize+value*(s.maxSize-s.minSize)*s.amount/100:230;
    const angle=s.rotation*Math.PI/180+(s.effect==='rotate'?value*s.amount/100*Math.PI*2:0);
    const shake=s.effect==='shake'?value*s.amount*.35:0;
    ctx.save();ctx.translate(s.placement==='center'?w/2:point?.x??w/2,s.placement==='center'?h/2:point?.y??h/2);ctx.translate(Math.sin(now/45)*shake,Math.cos(now/59)*shake);ctx.rotate(angle);
    ctx.globalAlpha=s.effect==='opacity'?1-s.amount/100+value*s.amount/100:1;
    if(img){const ratio=img.height/img.width,width=Math.min(size,h*.85/ratio);ctx.drawImage(img,-width/2,-width*ratio/2,width,width*ratio);}
    else{ctx.fillStyle=s.color;ctx.beginPath();ctx.roundRect(-size/2,-size/2,size,size,size*.17);ctx.fill();ctx.fillStyle=s.background;caption('WOW',0,0,size*.36);}
    ctx.restore();
  }
  function follow(s,value,p,dt){
    while(particles.length<s.count)particles.push({x:Math.random()*w,y:Math.random()*h,vx:0,vy:0});particles.length=s.count;
    ctx.fillStyle=s.color;
    for(const a of particles){
      if(p){const dx=p.x-a.x,dy=p.y-a.y,d=Math.hypot(dx,dy),force=mapRange(d,0,s.radius,1,0)*s.force*(.3+value*1.7),sign=s.behavior==='away'?-1:1;
        a.vx+=dx/(d+1)*force*sign*dt;a.vy+=dy/(d+1)*force*sign*dt;
        if(s.behavior==='orbit'){a.vx-=dy/(d+1)*force*dt;a.vy+=dx/(d+1)*force*dt;}}
      a.vx*=s.damping**dt;a.vy*=s.damping**dt;const speed=Math.hypot(a.vx,a.vy);if(speed>s.speed){a.vx*=s.speed/speed;a.vy*=s.speed/speed;}
      a.x=(a.x+a.vx*dt+w)%w;a.y=(a.y+a.vy*dt+h)%h;
      if(s.shape==='square')ctx.fillRect(a.x-s.size/2,a.y-s.size/2,s.size,s.size);else circle(a.x,a.y,s.size/2);
    }
  }
  function drawInk(s,value,p,valid,now){
    const down=p && (s.drawWhen==='always'||valid&&(s.drawWhen==='above'?value>=s.threshold:value<=s.threshold));
    if(down){pen.save();pen.globalCompositeOperation=s.brush==='eraser'?'destination-out':'source-over';pen.globalAlpha=s.opacity;pen.strokeStyle=pen.fillStyle=s.rainbow?`hsl(${now/25%360} 100% 65%)`:s.color;pen.lineCap=pen.lineJoin='round';pen.lineWidth=s.width;
      if(s.brush==='dots'||!previous){pen.beginPath();pen.arc(p.x,p.y,s.width/2,0,Math.PI*2);pen.fill();}
      else{pen.beginPath();pen.moveTo(previous.x,previous.y);pen.lineTo(p.x,p.y);pen.stroke();}pen.restore();previous=p;
    }else previous=null;
    ctx.drawImage(ink,0,0);
  }
  function music(s,value,valid,volumeValue,now){
    let frequency=s.low+(s.high-s.low)*value;if(s.quantize)frequency=440*2**(Math.round(12*Math.log2(frequency/440))/12);
    if(audio){osc.type=s.wave;osc.frequency.setTargetAtTime(frequency,audio.currentTime,.05);gain.gain.setTargetAtTime(enabled&&valid?s.volume*volumeValue:0,audio.currentTime,.05);}
    ctx.strokeStyle=s.color;ctx.lineWidth=4;ctx.beginPath();const radius=40+value*170;
    for(let i=0;i<=160;i++){const t=i/160*Math.PI*2,r=radius+Math.sin(t*12+now/90)*volumeValue*15;const x=w/2+Math.cos(t)*r,y=h/2+Math.sin(t)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.stroke();ctx.fillStyle=s.color;caption(`${Math.round(frequency)} Hz`,w/2,h/2);caption(enabled?'몸으로 연주 중':'소리 켜기를 눌러요',w/2,h-90,22);
  }
  function inspect(s,value,face,hands,fit){
    for(const [person,kind] of [[face,'face'],...hands.map(a=>[a,'hand'])]){
      if(!person||!(kind==='face'?s.facePoints:s.handPoints))continue;
      ctx.fillStyle=s.color;
      if(s.points!=='off')for(const index of s.points==='named'?Object.values(kind==='face'?FACE_NAMED:HAND_NAMED):person.raw.map((_,i)=>i)){
        if(!person.raw[index])continue;const p=toCanvas(person.raw[index],fit);circle(p.x,p.y,s.dotSize/2);if(s.labels){ctx.font='12px Arial';ctx.textAlign='left';ctx.fillText(index,p.x+6,p.y);}}
      if(s.boxes&&person.bbox){const b=person.bbox;ctx.strokeStyle=s.color;ctx.strokeRect(fit.dx+b.x*fit.dw,fit.dy+b.y*fit.dh,b.w*fit.dw,b.h*fit.dh);}
      if(s.bubbles){const p=toCanvas(person.point(kind==='face'?1:8),fit);ctx.globalAlpha=.35;circle(p.x,p.y,(s.bubbleMin+value*(s.bubbleMax-s.bubbleMin))/2);ctx.globalAlpha=1;}
    }
  }
  function flow(s,value,valid,sourceName,now){
    const xs=[150,470,790],y=280;ctx.strokeStyle=s.color;ctx.lineWidth=3;
    for(let i=0;i<2;i++){ctx.beginPath();ctx.moveTo(xs[i]+95,y);ctx.lineTo(xs[i+1]-95,y);ctx.stroke();if(s.pulse&&valid){ctx.fillStyle=s.color;circle(xs[i]+95+(now/1500%1)*130,y,6);}}
    ['내 움직임','컴퓨터가 읽은 값','화면 반응'].forEach((label,i)=>{ctx.fillStyle='#14253bee';ctx.fillRect(xs[i]-115,y-95,230,190);ctx.fillStyle=s.color;caption(label,xs[i],y-55,22);});
    ctx.fillStyle='#ffffff';caption(sourceName,xs[0],y+10,20);caption(valid?`${Math.round(value*100)}`:'기다리는 중',xs[1],y+10,30);
    ctx.save();ctx.translate(xs[2]+(s.output==='shake'?Math.sin(now/50)*value*s.amount*20:0),y+15);ctx.rotate(s.output==='rotate'?value*s.amount*Math.PI*2:0);ctx.globalAlpha=s.output==='opacity'?clamp(1-s.amount+value*s.amount):1;const size=s.output==='size'?20+value*s.amount*60:60;ctx.fillStyle=s.color;ctx.fillRect(-size/2,-size/2,size,size);ctx.restore();ctx.fillStyle=s.color;caption('움직임을 바꾸면, 값이 바뀌고, 화면도 달라져요.',w/2,500,24);
  }
  function buildText(s){
    const key=s.text+'|'+s.fontSize;if(textKey===key)return;textKey=key;
    const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle='#fff';g.textAlign='center';g.textBaseline='middle';g.font=`bold ${s.fontSize}px Arial, sans-serif`;g.fillText(s.text,w/2,h/2,w*.85);
    const pixels=g.getImageData(0,0,w,h).data;textPoints=[];
    // ponytail: 7px sampling caps the text physics at ~4,000 points; use GPU particles for denser text.
    for(let y=50;y<h-50;y+=7)for(let x=30;x<w-30;x+=7)if(pixels[(y*w+x)*4+3]>100)textPoints.push({homeX:x,homeY:y,x,y,vx:0,vy:0});
  }
  function springPoint(a,p,s,now,dt){
    let tx=a.homeX,ty=a.homeY;
    if(p){const dx=a.homeX-p.x,dy=a.homeY-p.y,d=Math.hypot(dx,dy);if(d<s.radius){const angle=Math.atan2(dy,dx),f=(1-d/s.radius)*s.strength,noise=Math.sin(now*.0048+a.homeX*.04)*s.noise*(1-d/s.radius);tx+=Math.cos(angle)*f-Math.sin(angle)*noise;ty+=Math.sin(angle)*f+Math.cos(angle)*noise;}}
    a.vx=(a.vx+(tx-a.x)*s.spring*dt)*s.damping**dt;a.vy=(a.vy+(ty-a.y)*s.spring*dt)*s.damping**dt;a.x+=a.vx*dt;a.y+=a.vy*dt;
  }
  function textMotion(s,value,p,now,dt){
    if(s.mode==='trail'){
      const target=p||{x:w/2+Math.cos(now/1000)*120,y:h/2+Math.sin(now/500)*60};history.push({...target});if(history.length>400)history.shift();
      [...s.text].forEach((char,i)=>{const t=history[Math.max(0,history.length-1-i*s.delay)],a=letters[i]||{...t};a.x+=(t.x-a.x)*s.followSpeed;a.y+=(t.y-a.y)*s.followSpeed;letters[i]=a;ctx.fillStyle=s.color;caption(char,a.x,a.y+Math.sin(now/120+i*.4)*s.wave,s.fontSize*.4);});return;
    }
    buildText(s);ctx.fillStyle=s.color;
    for(const a of textPoints){
      if(s.mode==='morph')springPoint(a,p,s,now,dt);
      else{if(p){const dx=p.x-a.x,dy=p.y-a.y,d=Math.hypot(dx,dy)||1,f=s.gravity*(1+value*3)/(d*.008+1);a.vx+=(dx/d*f-dy/d*s.orbit)*dt;a.vy+=(dy/d*f+dx/d*s.orbit)*dt;}
        a.vx+=(a.homeX-a.x)*s.returnForce*dt;a.vy+=(a.homeY-a.y)*s.returnForce*dt;a.vx*=s.damping**dt;a.vy*=s.damping**dt;const speed=Math.hypot(a.vx,a.vy);if(speed>18){a.vx*=18/speed;a.vy*=18/speed;}a.x+=a.vx*dt;a.y+=a.vy*dt;}
      circle(a.x,a.y,s.particleSize/2);
    }
  }
  // Ported from example 08: retain M/L/Q/C/Z and deform the font's actual control points.
  function outline(s,p,now,dt){
    const text=s.text+' '+s.subtitle;
    if(!font || [...text].some(ch=>ch!==' '&&!font.charToGlyphIndex(ch))){
      // Native-font fallback also supports Korean when the bundled Latin font has no glyph.
      const key=[s.text,s.subtitle,s.fontSize,s.subtitleSize].join('|');
      if(fallbackKey!==key){fallbackKey=key;fallbackLetters=[];[s.text,s.subtitle].forEach((line,row)=>{const chars=[...line],size=row?s.subtitleSize:s.fontSize,spacing=Math.min(size*.8,800/Math.max(1,chars.length));chars.forEach((ch,i)=>{const x=w/2+(i-(chars.length-1)/2)*spacing,y=h/2-40+row*100;fallbackLetters.push({ch,size,x,y,homeX:x,homeY:y,vx:0,vy:0});});});}
      ctx.save();ctx.strokeStyle=s.color;ctx.shadowColor=s.color;ctx.shadowBlur=s.glow;ctx.textAlign='center';
      for(const a of fallbackLetters){springPoint(a,p,s,now,dt);const d=p?Math.hypot(a.x-p.x,a.y-p.y):Infinity;ctx.lineWidth=mapRange(d,0,s.radius,s.hotWidth,s.lineWidth);ctx.font=`bold ${a.size}px sans-serif`;ctx.strokeText(a.ch,a.x,a.y);}ctx.restore();return;
    }
    const key=[s.text,s.subtitle,s.fontSize,s.subtitleSize].join('|');
    if(pathKey!==key){pathKey=key;paths=[[s.text,s.fontSize,-20],[s.subtitle,s.subtitleSize,70]].map(([txt,size,offset])=>{
      const commands=font.getPath(txt,(w-font.getAdvanceWidth(txt,size))/2,h/2+offset,size).commands;
      return commands.map(c=>{const command={type:c.type,points:[]};for(const suffix of ['1','2',''])if(Number.isFinite(c['x'+suffix]))command.points.push({x:c['x'+suffix],y:c['y'+suffix],homeX:c['x'+suffix],homeY:c['y'+suffix],vx:0,vy:0});return command;});});}
    ctx.save();ctx.lineJoin=ctx.lineCap='round';ctx.shadowColor=s.color;ctx.shadowBlur=s.glow;
    for(const path of paths){let nearest=Infinity;for(const c of path)for(const a of c.points){springPoint(a,p,s,now,dt);if(p)nearest=Math.min(nearest,Math.hypot(a.x-p.x,a.y-p.y));}
      ctx.strokeStyle=s.color;ctx.lineWidth=mapRange(nearest,0,s.radius,s.hotWidth,s.lineWidth);ctx.beginPath();
      for(const c of path){const args=c.points.flatMap(p=>[p.x,p.y]);if(c.type==='M')ctx.moveTo(...args);if(c.type==='L')ctx.lineTo(...args);if(c.type==='Q')ctx.quadraticCurveTo(...args);if(c.type==='C')ctx.bezierCurveTo(...args);if(c.type==='Z')ctx.closePath();}ctx.stroke();}ctx.restore();
  }
  return {clear,release(){previous=null;history=[];letters=[];},mute,toggleAudio,get audioEnabled(){return enabled;},getAudioTracks:()=>destination?.stream.getAudioTracks()||[],draw(key,s,input){
    const {value,point,valid,now,dt,img,face,hands,fit,volumeValue,sourceName}=input;
    if(key==='stretch')artwork(s,value,point,img,now);
    if(key==='follow')follow(s,value,point,dt);
    if(key==='draw')drawInk(s,value,point,valid,now);
    if(key==='music')music(s,value,valid,volumeValue,now);
    if(key==='inspect')inspect(s,value,face,hands,fit);
    if(key==='flow')flow(s,value,valid,sourceName,now);
    if(key==='text')textMotion({...s,strength:s.strength*(.3+value*1.7),wave:s.wave*(.3+value*1.7)},value,point,now,dt);
    if(key==='outline')outline({...s,strength:s.strength*(.3+value*1.7)},point,now,dt);
  }};
}
