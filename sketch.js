import { Tracker } from "./lib/tracker.js";
import { NOSE_TIP, INDEX_TIP } from "./lib/landmarks.js";
import { smooth, mapRange, debugDraw } from "./lib/utils.js";

const tracker = new Tracker({ face: true, hands: true });

let face = null;
let hands = [];

tracker.onUpdate((d) => {
  face = d.face;
  hands = d.hands;
});

function setup() {
  createCanvas(windowWidth, windowHeight);
  tracker.start();
  noStroke();
}

function draw() {
  background(10);

  // Draw a circle at the nose if a face is detected
  if (face) {
    const nose = face.point(NOSE_TIP);
    const size = mapRange(face.signals.mouthOpen, 0, 0.6, 40, 400);
    fill(200, 255, 0);
    circle(nose.x * width, nose.y * height, size);
  }

  // Draw a circle at each index fingertip
  hands.forEach((h) => {
    const tip = h.point(INDEX_TIP);
    fill(255, 60, 110);
    circle(tip.x * width, tip.y * height, 30);
  });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// p5 looks for setup/draw on the global scope; ES modules are scoped, so expose them.
window.setup = setup;
window.draw = draw;
window.windowResized = windowResized;
