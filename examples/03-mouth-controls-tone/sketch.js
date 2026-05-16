import { Tracker } from "../../lib/tracker.js";
import { mapRange } from "../../lib/utils.js";

const tracker = new Tracker({ face: true, hands: false, smoothing: 0.7 });

let face = null;
let osc = null;
let started = false;

tracker.onUpdate((d) => { face = d.face; });

function setup() {
  createCanvas(windowWidth, windowHeight);
  tracker.start();
  textAlign(CENTER, CENTER);
  textSize(20);
}

function startAudio() {
  if (started) return;
  // Browsers require a user gesture before audio can play.
  userStartAudio();
  osc = new p5.Oscillator("sine");
  osc.amp(0);
  osc.start();
  started = true;
}

function draw() {
  background(20);
  fill(220);

  if (!started) {
    text("click anywhere to start audio", width / 2, height / 2);
    return;
  }
  if (!face) {
    text("show your face", width / 2, height / 2);
    osc.amp(0, 0.05);
    return;
  }

  const mouth = face.signals.mouthOpen;     // 0..1
  const tilt  = face.signals.headTilt;      // -1..1

  // Mouth → pitch (220 Hz to 880 Hz, two octaves)
  const freq = mapRange(mouth, 0, 0.6, 220, 880);
  // Tilt → volume (lean right = louder)
  const amp  = mapRange(tilt, -0.5, 0.5, 0.0, 0.4);

  osc.freq(freq, 0.05);
  osc.amp(amp, 0.05);

  // Visualise
  noFill();
  stroke(255, 200, 0);
  strokeWeight(3);
  const r = mapRange(mouth, 0, 0.6, 40, 320);
  circle(width / 2, height / 2, r);

  noStroke();
  fill(180);
  text(`pitch ${freq.toFixed(0)} Hz   vol ${(amp * 100).toFixed(0)}%`, width / 2, height - 40);
}

function mousePressed() { startAudio(); }
function touchStarted() { startAudio(); }
function windowResized() { resizeCanvas(windowWidth, windowHeight); }

window.setup = setup;
window.draw = draw;
window.mousePressed = mousePressed;
window.touchStarted = touchStarted;
window.windowResized = windowResized;
