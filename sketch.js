import { Tracker } from "./lib/tracker.js";
import { NOSE_TIP, INDEX_TIP } from "./lib/landmarks.js";
import { mapRange } from "./lib/utils.js";

const tracker = new Tracker({ face: true, hands: true });

let face = null;
let hands = [];
let video = null;

tracker.onUpdate((d) => {
  face = d.face;
  hands = d.hands;
  video = d.video;
});

function setup() {
  createCanvas(windowWidth, windowHeight);
  tracker.start();
  noStroke();
}

function draw() {
  background(10);

  // Live camera feed — flip horizontally so it matches the mirrored landmarks.
  if (video && video.readyState >= 2) {
    push();
    translate(width, 0);
    scale(-1, 1);
    const { dw, dh, dx, dy } = coverFit(video.videoWidth, video.videoHeight, width, height);
    image(video, dx, dy, dw, dh);
    pop();
  }

  // Draw a circle at the nose if a face is detected
  if (face) {
    const nose = face.point(NOSE_TIP);
    const size = mapRange(face.signals.mouthOpen, 0, 0.6, 40, 400);
    fill(200, 255, 0);
    circle(nose.x * width, nose.y * height, size);
  }

  // Pink dot on each index fingertip — size driven by hand openness
  // (closed fist = small, fully open hand = large).
  hands.forEach((h) => {
    const tip = h.point(INDEX_TIP);
    const size = mapRange(h.signals.openness, 0, 1, 15, 120);
    fill(255, 60, 110);
    circle(tip.x * width, tip.y * height, size);
  });
}

// Scale the video to "cover" the canvas while keeping aspect ratio.
function coverFit(srcW, srcH, dstW, dstH) {
  if (!srcW || !srcH) return { dw: dstW, dh: dstH, dx: 0, dy: 0 };
  const srcRatio = srcW / srcH;
  const dstRatio = dstW / dstH;
  let dw, dh;
  if (srcRatio > dstRatio) {
    dh = dstH;
    dw = dh * srcRatio;
  } else {
    dw = dstW;
    dh = dw / srcRatio;
  }
  return { dw, dh, dx: (dstW - dw) / 2, dy: (dstH - dh) / 2 };
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// p5 looks for setup/draw on the global scope; ES modules are scoped, so expose them.
window.setup = setup;
window.draw = draw;
window.windowResized = windowResized;
