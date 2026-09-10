import { INDEX_TIP, THUMB_TIP, NOSE_TIP, LEFT_EYE, RIGHT_EYE } from '../lib/landmarks.js';
import { clamp, mapRange } from '../lib/utils.js';
export const sources = {
  hands: '두 손 사이', pinchGap: '한 손 엄지 ↔ 검지', noseHand: '코 ↔ 검지',
  mouth: '입 벌리기', pinch: '손가락 붙이기', openness: '손 펼치기', fingers: '편 손가락 수',
  tilt: '고개 기울이기', smile: '웃기', brow: '눈썹 올리기', handX: '손 좌우', handY: '손 위아래', noseX: '코 좌우', noseY: '코 위아래',
};
export const pointers = { hand: '검지', pinch: '엄지와 검지 가운데', nose: '코', hands: '두 손 가운데', mouse: '마우스 / 터치' };
export function primaryHand(hands, side = 'auto') { return side === 'auto' ? [...hands].sort((a,b) => a.handedness.localeCompare(b.handedness))[0] : hands.find(h => h.handedness === side); }
const gap = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);
export function inputValue(source, face, hands, side = 'auto') {
  if (!Object.hasOwn(sources, source)) return { valid: false, value: 0, points: [] };
  const hand = primaryHand(hands, side), tip = hand?.point(INDEX_TIP), thumb = hand?.point(THUMB_TIP), nose = face?.point(NOSE_TIP);
  let value = null, points = [];
  if (source === 'hands' && hands.length >= 2) { points = hands.slice(0,2).map(h => h.point(INDEX_TIP)); value = mapRange(gap(...points), .08,.7,0,1); }
  if (source === 'pinchGap' && tip && thumb) { points = [thumb,tip]; value = mapRange(gap(...points), .015,.22,0,1); }
  if (source === 'noseHand' && tip && nose) { points = [nose,tip]; value = mapRange(gap(...points), .04,.65,0,1); }
  const faceSignals = { mouth:'mouthOpen', smile:'smile', brow:'eyebrowRaise' };
  if (faceSignals[source] && face) { value = face.signals[faceSignals[source]]; points = [nose]; }
  if (source === 'tilt' && face) {
    // Use the eye line modulo PI: a mirrored face must not saturate the tilt value.
    const a=face.point(LEFT_EYE), b=face.point(RIGHT_EYE);
    let angle=Math.atan2(b.y-a.y,b.x-a.x); if(angle>Math.PI/2)angle-=Math.PI; if(angle< -Math.PI/2)angle+=Math.PI;
    value=mapRange(angle,-Math.PI/4,Math.PI/4,0,1); points=[nose];
  }
  if (['pinch','openness','fingers'].includes(source) && hand) { value = source === 'fingers' ? hand.signals.fingerCount/5 : hand.signals[source]; points=[tip]; }
  if (source.startsWith('hand') && ['handX','handY'].includes(source) && tip) { value=source==='handX'?tip.x:1-tip.y;points=[tip]; }
  if (['noseX','noseY'].includes(source) && nose) { value=source==='noseX'?nose.x:1-nose.y;points=[nose]; }
  return { valid:Number.isFinite(value), value:Number.isFinite(value)?clamp(value):0, points:points.filter(Boolean) };
}
export function inputPoint(source, face, hands, mouse, side='auto') {
  const h=primaryHand(hands,side), a=h?.point(INDEX_TIP), b=h?.point(THUMB_TIP);
  if(source==='mouse')return mouse;
  if(source==='nose')return face?.point(NOSE_TIP) || null;
  if(source==='hand')return a || null;
  if(source==='pinch')return a&&b?{x:(a.x+b.x)/2,y:(a.y+b.y)/2}:null;
  if(source==='hands' && hands.length>=2){const p=hands[0].point(INDEX_TIP),q=hands[1].point(INDEX_TIP);return{x:(p.x+q.x)/2,y:(p.y+q.y)/2};}
  return null;
}
export function mappedValue(value, settings) { const v=clamp(value*settings.sensitivity);return settings.reverse?1-v:v; }
