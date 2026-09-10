import { createExplorer } from './explorer.js';
import { INDEX_TIP } from '../lib/landmarks.js';
import { drawVideo, videoFit, toCanvas, dist, smooth } from '../lib/utils.js';
import { steps, completes, reaction } from './lesson.mjs';
import { setupCapture } from './recorder.js';

const $ = id => document.getElementById(id);
const canvas = $('stage'), ctx = canvas.getContext('2d');
let step = 0, complete = false, transition, tracker, video, face = null, hands = [], demo = false;
let generation = 0, cameraBusy = false, lastSeen = 0, heldSince = 0, baseline = null;
let distance = 0.2, reverse = false, customImage = null, imageGeneration = 0;
const explorer = createExplorer(canvas, () => capture.stop());
const capture = setupCapture(canvas, $('photo'), $('record'), $('capture-status'), $('save-status'), $('download'), explorer.getAudioTracks);
const imageControl = document.querySelector('[data-control="image"]');
const imageHome = imageControl.parentNode;
let exploring = false;

function renderStep() {
  clearTimeout(transition);
  complete = false; heldSince = 0; baseline = null;
  const free = step === steps.length;
  const current = steps[step];
  $('tutorial-panel').hidden = free;
  $('explorer').hidden = !free;
  document.body.classList.toggle('exploring', free);
  if (free && !exploring) {
    exploring = true;
    explorer.enter({ amount:+$('amount').value, sensitivity:+$('sensitivity').value/100, reverse, effect:$('effect').value });
    $('explore-image').append(imageControl);
    if (!demo && video) startCamera();
  } else if (!free && exploring) {
    exploring = false; explorer.reset(); imageHome.insertBefore(imageControl, $('next'));
    $('stage-title').textContent = 'Stretch it!'; $('stage-eyebrow').textContent = '01 / 두 손으로 놀기'; $('sensor-label').textContent = '두 손 사이';
  }
  $('step-label').textContent = free ? 'MY VERSION · 나만의 장난감' : `STEP ${step + 1} / ${steps.length}`;
  $('progress').value = step;
  $('progress-value').textContent = `${Math.round(step / steps.length * 100)}%`;
  $('step-title').textContent = free ? '이제 내 취향대로!' : current.title;
  $('step-detail').textContent = free ? '가장 재미있는 반응 하나를 골라 조금만 바꿔보세요. 완성하면 사진이나 영상으로 남겨요.' : current.detail;
  $('step-icon').textContent = free ? '★' : current.icon;
  $('success').textContent = '';
  $('next').hidden = step !== 7;
  $('next').textContent = step === 7 ? '튜토리얼 끝! 자유롭게 놀기 →' : '다음으로 →';
  document.querySelectorAll('[data-control]').forEach(el => {
    const visible = free ? el.dataset.control !== 'camera' : el.dataset.control === current.control;
    el.hidden = !visible;
    el.classList.toggle('highlight', visible && !free);
  });
  $('demo-controls').classList.toggle('highlight', demo && [1, 2, 7].includes(step));
  if (demo && step === 1) $('step-detail').textContent = '지금은 연습용 손 두 개가 있어요. 아래 슬라이더가 손을 대신해요.';
  if (demo && [2, 7].includes(step)) $('step-detail').textContent = '무대 아래 슬라이더를 왼쪽과 오른쪽으로 움직여보세요.';
}
function advance() { if (step < steps.length) { step++; renderStep(); } }
function event(name, value) {
  if (complete || !completes(step, name, value)) return;
  complete = true;
  $('success').textContent = name === 'hands' ? '✓ 두 손을 찾았어요!' : '✓ 좋아요! 해냈어요.';
  if (step <= 2) transition = setTimeout(advance, 1100);
  else { $('next').hidden = false; $('next').classList.add('highlight'); }
}
$('next').onclick = advance;
$('teacher-next').onclick = advance;
function stopCamera() {
  generation++;
  tracker?.stop(); tracker = null; video = null; face = null; hands = [];
  explorer.mute();
  cameraBusy = false; $('camera').disabled = false;
}
async function startCamera() {
  if (cameraBusy) return;
  stopCamera(); demo = false;
  $('demo-controls').hidden = true;
  cameraBusy = true;
  $('camera').disabled = true;
  $('camera-error').textContent = '카메라를 준비하고 있어요. 권한 창이 뜨면 허용해 주세요.';
  const attempt = generation;
  let candidate;
  const timeout = setTimeout(() => {
    if (attempt !== generation) return;
    generation++; cameraBusy = false; $('camera').disabled = false;
    $('camera-error').textContent = '카메라 준비가 오래 걸려요. 권한을 확인하거나 손 없이 해보기를 눌러주세요.';
    $('retry').hidden = false;
  }, 25000);
  try {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('insecure');
    // Load the external runtime only here: demo and local assets work if the CDN fails.
    const { Tracker } = await import('../lib/tracker.js');
    if (attempt !== generation) return;
    candidate = new Tracker({ face: step === steps.length, hands: true, maxHands: 2, smoothing: 0.6 });
    candidate.onUpdate(data => {
      if (attempt !== generation) { candidate.stop(); return; }
      hands = data.hands; face = data.face; video = data.video; lastSeen = performance.now();
    });
    await candidate.start();
    if (attempt !== generation) { candidate.stop(); return; }
    tracker = candidate; video = candidate.video;
    const track = video.srcObject.getVideoTracks()[0];
    track.addEventListener('ended', () => {
      if (tracker !== candidate) return;
      stopCamera(); $('camera-error').textContent = '카메라 연결이 끊겼어요. 다시 켜거나 손 없이 해보세요.'; $('retry').hidden = false;
    });
    $('camera-error').textContent = '';
    $('retry').hidden = true;
    $('mode').textContent = '카메라 켜짐';
    event('ready');
  } catch {
    candidate?.stop();
    if (attempt !== generation) return;
    $('camera-error').textContent = '카메라가 아직 켜지지 않았어요. 주소 옆 카메라 권한을 허용하고, 다른 앱이 카메라를 쓰고 있다면 닫아주세요. 손 없이도 계속할 수 있어요.';
    $('retry').hidden = false;
    $('mode').textContent = '카메라 확인';
  } finally {
    clearTimeout(timeout);
    if (attempt === generation) { cameraBusy = false; $('camera').disabled = false; }
  }
}
$('camera').onclick = startCamera;
$('retry').onclick = startCamera;
$('demo').onclick = () => {
  stopCamera(); demo = true; renderStep();
  $('demo-controls').hidden = false;
  $('camera-error').textContent = '';
  $('retry').hidden = false;
  $('mode').textContent = '연습용 손 · 데모';
  event('ready');
};
$('amount').oninput = e => event('amount', +e.target.value);
$('reverse').onclick = () => {
  reverse = true; $('normal').setAttribute('aria-pressed', 'false'); $('reverse').setAttribute('aria-pressed', 'true'); event('reverse');
};
$('normal').onclick = () => {
  reverse = false; $('normal').setAttribute('aria-pressed', 'true'); $('reverse').setAttribute('aria-pressed', 'false');
};
$('effect').onchange = e => event('effect', e.target.value);
$('default-image').onclick = () => { imageGeneration++; customImage = null; $('image').value = ''; $('image-status').textContent = '준비된 그림을 골랐어요.'; event('image'); };
$('image').onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  const attempt = ++imageGeneration;
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 10 * 1024 * 1024) {
    $('image-status').textContent = '10MB 이하의 PNG, JPG, WebP, GIF 그림을 골라주세요.'; e.target.value = ''; return;
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    if (attempt !== imageGeneration) return;
    if (img.naturalWidth * img.naturalHeight > 32000000) throw new Error('large image');
    // Keep the stage responsive even with a large phone photo.
    const scale = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
    const local = document.createElement('canvas'); local.width = Math.round(img.naturalWidth * scale); local.height = Math.round(img.naturalHeight * scale);
    local.getContext('2d').drawImage(img, 0, 0, local.width, local.height);
    customImage = local; $('image-status').textContent = '내 그림이 들어왔어요!'; event('image');
  } catch { if (attempt === imageGeneration) $('image-status').textContent = '그림을 읽지 못했어요. 더 작은 다른 그림을 골라주세요.'; }
  finally { URL.revokeObjectURL(url); }
};
$('reset').onclick = () => {
  capture.stop(); stopCamera(); imageGeneration++; customImage = null; demo = false; distance = 0.2; step = 0;
  $('amount').value = 60; $('sensitivity').value = 100; $('effect').value = 'size'; $('demo-distance').value = 25; $('image').value = '';
  $('normal').click(); $('image-status').textContent = ''; $('camera-error').textContent = ''; $('retry').hidden = true; $('demo-controls').hidden = true; $('mode').textContent = '시작할 준비!'; renderStep();
};
window.addEventListener('pagehide', () => { capture.stop(); stopCamera(); });
function draw(now) {
  const w = canvas.width, h = canvas.height;
  if (step === steps.length) { explorer.draw({now,video,face:now-lastSeen<1200?face:null,hands:now-lastSeen<1200?hands:[],demo,img:customImage,tracker});requestAnimationFrame(draw);return; }
  ctx.fillStyle = '#12283c'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#ffffff0b'; ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  drawVideo(video, ctx, w, h, { opacity: 0.7 });
  const currentHands = now - lastSeen < 1200 ? hands : [];
  const fit = videoFit(video, w, h);
  const points = demo ? [{ x: 0.5 - (0.08 + +$('demo-distance').value / 100 * 0.62) / 2, y: 0.5 }, { x: 0.5 + (0.08 + +$('demo-distance').value / 100 * 0.62) / 2, y: 0.5 }] : currentHands.map(hand => hand.point(INDEX_TIP)).filter(Boolean);
  const detected = points.length >= 2;
  const raw = detected ? dist({ x: points[0].x, y: points[0].y }, { x: points[1].x, y: points[1].y }) : 0;
  if (detected) distance = smooth(distance, raw, 0.18);
  const output = reaction(distance, +$('sensitivity').value / 100, reverse, +$('amount').value, $('effect').value);
  const mapped = points.map(p => toCanvas(p, fit));
  const cx = detected ? (mapped[0].x + mapped[1].x) / 2 : w / 2;
  const cy = detected ? (mapped[0].y + mapped[1].y) / 2 : h / 2;
  ctx.save();
  ctx.translate(cx + Math.sin(now / 45) * output.shake, cy + Math.cos(now / 59) * output.shake);
  ctx.rotate(output.angle); ctx.globalAlpha = detected ? output.opacity : 0.45;
  if (customImage) {
    const ratio = customImage.height / customImage.width;
    const width = Math.min(output.size, h * 0.8 / ratio);
    ctx.drawImage(customImage, -width / 2, -width * ratio / 2, width, width * ratio);
  } else {
    const size = output.size;
    ctx.fillStyle = '#bdfc69'; ctx.beginPath(); ctx.roundRect(-size / 2, -size / 2, size, size, size * 0.17); ctx.fill();
    ctx.fillStyle = '#172d42'; ctx.font = `900 ${size * 0.36}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('WOW', 0, 0);
  }
  ctx.restore();
  if (detected) {
    ctx.strokeStyle = '#c1fb76'; ctx.lineWidth = 3; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.moveTo(mapped[0].x, mapped[0].y); ctx.lineTo(mapped[1].x, mapped[1].y); ctx.stroke(); ctx.setLineDash([]);
    mapped.forEach(p => { ctx.fillStyle = '#c1fb76'; ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2); ctx.fill(); });
    if (!heldSince) heldSince = now;
    if (now - heldSince > 650) event('hands', points.length);
    if (baseline === null) baseline = raw;
    if (step === 2) { baseline = Math.min(baseline, raw); event('spread', raw - baseline); }
    if (step === 7 && Math.abs(raw - baseline) > 0.18) event('compare');
  } else { heldSince = 0; baseline = null; }
  $('hands').textContent = demo ? '연습용 손 2 / 2' : `손 ${currentHands.length} / 2`;
  const percentage = detected ? Math.round(Math.max(0, Math.min(100, (distance - 0.08) / 0.62 * 100))) : 0;
  $('distance').value = percentage; $('distance-value').textContent = detected ? `${percentage}` : '—';
  $('tracking-hint').textContent = demo ? '연습 중 · 슬라이더로 손 사이를 바꿔요.' : detected ? '✓ 두 손이 보여요. 천천히 모았다 벌려보세요.' : video ? '손 전체가 화면에 보이도록 조금 뒤로 가보세요.' : '카메라를 켜거나 손 없이 해보기를 눌러요.';
  requestAnimationFrame(draw);
}
renderStep(); requestAnimationFrame(draw);
