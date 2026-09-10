import assert from 'node:assert/strict';
import { setupCapture } from './recorder.js';
let tick = 0, sequence = 0, stopped = 0, visibility;
const timers = new Map();
globalThis.setInterval = (fn, delay) => { const id = ++sequence; timers.set(id, { fn, delay, next: tick + delay }); return id; };
globalThis.clearInterval = id => timers.delete(id);
globalThis.performance = { now: () => tick };
globalThis.document = { hidden: false, addEventListener: (_, fn) => { visibility = fn; } };
class Recorder {
  static isTypeSupported(type) { return type === 'video/webm'; }
  constructor() { this.state = 'inactive'; this.mimeType = 'video/webm'; }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.ondataavailable({ data: new Blob(['video']) }); this.onstop(); }
}
globalThis.MediaRecorder = Recorder;
function el() { return { textContent: '', disabled: false, hidden: true, click() { this.clicks = (this.clicks || 0) + 1; } }; }
const photo = el(), record = el(), overlay = el(), status = el(), link = el();
const canvas = { toBlob: fn => fn(new Blob(['png'])), captureStream: () => ({ getTracks: () => [{ stop: () => stopped++ }] }) };
const capture = setupCapture(canvas, photo, record, overlay, status, link);
function advance(ms) {
  const end = tick + ms;
  while (true) {
    const next = [...timers.entries()].filter(([, t]) => t.next <= end).sort((a,b) => a[1].next - b[1].next)[0];
    if (!next) break;
    tick = next[1].next; next[1].next += next[1].delay; next[1].fn();
  }
  tick = end;
}
photo.onclick(); assert(link.download.endsWith('.png')); assert.equal(link.clicks, 1);
record.onclick(); assert.equal(capture.active, true); advance(2999); assert.equal(link.clicks, 1);
advance(1); assert.match(overlay.textContent, /10초/); advance(9999); assert.equal(link.clicks, 1);
advance(1); assert.equal(link.clicks, 2); assert(link.download.endsWith('.webm')); assert.equal(capture.active, false); assert.equal(stopped, 1);
record.onclick(); advance(1000); capture.stop(); advance(13000); assert.equal(link.clicks, 2); assert.equal(timers.size, 0);
record.onclick(); advance(4000); document.hidden = true; visibility(); assert.equal(link.clicks, 3); assert.equal(capture.active, false); assert.equal(stopped, 2);
console.log('PASS: photo, 3-second countdown, 10-second recording, cancel, early save, track cleanup');
